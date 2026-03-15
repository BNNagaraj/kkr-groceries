/**
 * Order-related Cloud Functions.
 * - submitOrder
 * - assignOrderToStore
 * - notifyOrderStatusChange
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateInvoicePdf } = require("./invoice");
const {
  db, FieldValue, getAuth,
  getCachedProducts, resolveSlabPrice,
  haversineKm, scoreStoresForOrder,
  resolveCol, getAppMode,
  isRateLimited, requireAdmin,
  getNotificationEmails,
  buildOrderEmailHtml, buildStatusEmailHtml,
  emailLayout,
} = require("./utils");

/**
 * Submit order - stores order and sends email notification
 */
exports.submitOrder = onCall(async (request) => {
  try {
    const userId = request.auth?.uid || "anon_" + (request.rawRequest?.ip || "unknown");
    if (await isRateLimited(userId, "submitOrder", 5, 15 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many orders. Please wait before placing another.");
    }

    const data = request.data;
    if (!data || !data.cart || data.cart.length === 0) {
      throw new HttpsError("invalid-argument", "Order must contain items.");
    }
    if (!data.customerName || !data.customerPhone) {
      throw new HttpsError("invalid-argument", "Missing required customer details.");
    }

    // Validate MOQ — fetch product definitions and check quantities (cached)
    const cachedProducts = await getCachedProducts();
    const productMap = {};
    Object.entries(cachedProducts).forEach(([docId, pData]) => {
      productMap[docId] = pData;
      // Also map by numeric id if present
      if (pData.id !== undefined) productMap[String(pData.id)] = pData;
    });

    const moqViolations = [];
    for (const item of data.cart) {
      const productId = String(item.id);
      const product = productMap[productId];
      if (!product) continue; // skip unknown products

      const moqRequired = product.moqRequired !== false;
      const moq = product.moq > 0 ? product.moq : 1;

      if (moqRequired && item.qty < moq) {
        moqViolations.push(`${item.name || product.name}: minimum ${moq} ${product.unit || item.unit}, got ${item.qty}`);
      }
    }

    if (moqViolations.length > 0) {
      throw new HttpsError(
        "invalid-argument",
        `Minimum order quantity not met: ${moqViolations.join("; ")}`
      );
    }

    // Validate slab pricing — ensure client-sent price matches server-resolved slab
    const priceViolations = [];
    for (const item of data.cart) {
      const productId = String(item.id);
      const product = productMap[productId];
      if (!product) continue;

      const expectedPrice = resolveSlabPrice(item.qty, product.price, product.priceTiers);
      if (Math.abs(item.price - expectedPrice) > 0.01) {
        priceViolations.push(
          `${item.name || product.name}: expected \u20B9${expectedPrice} for qty ${item.qty}, got \u20B9${item.price}`
        );
      }
    }

    if (priceViolations.length > 0) {
      throw new HttpsError(
        "invalid-argument",
        `Price mismatch: ${priceViolations.join("; ")}`
      );
    }

    // ── Delivery Zone Validation ──
    const orderLat = data.locationDetails?.lat;
    const orderLng = data.locationDetails?.lng;
    if (orderLat != null && orderLng != null) {
      try {
        const deliverySnap = await db.collection("settings").doc("delivery").get();
        if (deliverySnap.exists) {
          const dz = deliverySnap.data();
          if (dz.centerLat && dz.centerLng && dz.radiusKm) {
            const dist = haversineKm(orderLat, orderLng, dz.centerLat, dz.centerLng);
            if (dist > dz.radiusKm) {
              throw new HttpsError(
                "out-of-range",
                `Delivery location is ${dist.toFixed(1)} km away, outside the ${dz.zoneName || "delivery"} zone (${dz.radiusKm} km radius). Please choose a location within the service area.`
              );
            }
          }
        }
      } catch (e) {
        if (e.code === "out-of-range") throw e;
        console.warn("Zone check failed, allowing order:", e.message);
      }
    }

    // Fetch buyer profile for GSTIN / billing address
    // Checkout-supplied GSTIN (already verified on client) takes precedence over profile
    let buyerGstin = data.gstin || null;
    let billingAddress = null;
    let buyerLegalName = data.gstinLegalName || null;
    let buyerEntityType = data.gstinEntityType || null;
    if (request.auth?.uid) {
      try {
        const profileSnap = await db.collection("users").doc(request.auth.uid).get();
        if (profileSnap.exists) {
          const p = profileSnap.data();
          // Only use profile GSTIN if none was supplied at checkout
          if (!buyerGstin && p.gstin && p.gstinVerified) {
            buyerGstin = p.gstin;
            buyerLegalName = p.legalName || null;
            buyerEntityType = p.entityType || null;
          }
          if (!billingAddress && p.registeredAddress) {
            billingAddress = p.registeredAddress;
          }
        }
      } catch (e) {
        console.warn("Could not fetch buyer profile:", e.message);
      }
    }

    const orderId = `ORD-${Date.now()}`;
    const orderDoc = {
      id: orderId,
      orderId: orderId,
      userId: request.auth ? request.auth.uid : "anonymous",
      userEmail: request.auth?.token?.email || null,
      customerName: data.customerName,
      phone: data.customerPhone,
      shopName: data.shopName || "Not specified",
      location: data.deliveryAddress || null,
      lat: data.locationDetails?.lat || null,
      lng: data.locationDetails?.lng || null,
      cart: data.cart,
      orderSummary: data.orderSummary || "",
      productCount: data.productCount || 0,
      totalValue: data.totalValue,
      timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      createdAt: FieldValue.serverTimestamp(),
      status: "Pending",
      source: "Cloud Function",
      // GSTIN / billing details (from checkout or buyer profile)
      ...(buyerGstin && { buyerGstin }),
      ...(billingAddress && { billingAddress }),
      ...(buyerLegalName && { buyerLegalName }),
      ...(buyerEntityType && { buyerEntityType }),
    };

    const mode = await getAppMode();
    const orderCol = resolveCol("orders", mode);
    await db.collection(orderCol).doc(orderId).set(orderDoc);

    // ── Auto-assign to nearest store (proximity-first, non-blocking) ──
    try {
      const storeCol = resolveCol("stores", mode);
      const invCol = resolveCol("storeInventory", mode);

      const storesSnap = await db.collection(storeCol).where("isActive", "==", true).get();
      if (!storesSnap.empty) {
        const stores = storesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const storeIds = stores.map((s) => s.id);

        // Read inventory — only for cart products (doc IDs = storeId_productId)
        const cartProductIds = orderDoc.cart.map(item => String(item.id)).filter(Boolean);
        const invDocRefs = [];
        for (const sid of storeIds.slice(0, 30)) {
          for (const pid of cartProductIds) {
            invDocRefs.push(db.collection(invCol).doc(`${sid}_${pid}`));
          }
        }
        const invDocs = invDocRefs.length > 0 ? await db.getAll(...invDocRefs) : [];
        const invMap = {};
        const nameToProductId = {};
        invDocs.filter(d => d.exists).forEach((d) => {
          const inv = d.data();
          if (!invMap[inv.storeId]) invMap[inv.storeId] = {};
          invMap[inv.storeId][inv.productId] = { currentQty: inv.currentQty || 0 };
          if (inv.productName) nameToProductId[inv.productName.toLowerCase()] = inv.productId;
        });

        const ranked = scoreStoresForOrder({
          stores,
          invMap,
          nameToProductId,
          cart: orderDoc.cart,
          orderLat: orderDoc.lat,
          orderLng: orderDoc.lng,
        });

        const best = ranked[0] || null;

        if (best) {
          const bestStore = best.store;
          const bestDist = best.distanceKm;
          const bestFulfill = best.fulfillmentPercent;
          const currentOrder = await db.collection(orderCol).doc(orderId).get();
          const currentData = currentOrder.data();
          if (!currentData.assignedStoreId) {
            await db.collection(orderCol).doc(orderId).update({
              assignedStoreId: bestStore.id,
              assignedStoreName: bestStore.name || "",
            });
            console.log(
              `[submitOrder] Auto-assigned order ${orderId} to store "${bestStore.name}"` +
              (bestDist != null ? ` (dist=${bestDist.toFixed(1)}km, fulfill=${(bestFulfill * 100).toFixed(0)}%)` : " (no GPS)")
            );
          } else {
            console.log(`[submitOrder] Order ${orderId} already assigned to store "${currentData.assignedStoreName}", skipping auto-routing`);
          }
        }
      }
    } catch (routingErr) {
      // Non-blocking — order is already saved, routing failure shouldn't break submission
      console.warn("[submitOrder] Auto-routing failed (order still placed):", routingErr.message);
    }

    // Build email data shared between admin and buyer emails
    const emailData = {
      orderId,
      customerName: data.customerName,
      phone: data.customerPhone,
      shopName: data.shopName || "Not specified",
      deliveryAddress: data.deliveryAddress || null,
      lat: data.locationDetails?.lat || null,
      lng: data.locationDetails?.lng || null,
      cart: data.cart,
      totalValue: data.totalValue,
      productCount: data.productCount || data.cart.length,
    };

    // Queue Admin Email
    try {
      const notifyEmails = await getNotificationEmails();
      await db.collection("mail").add({
        to: notifyEmails,
        message: {
          subject: `\u{1F6D2} New Order: ${orderId} \u2014 ${data.totalValue}`,
          html: buildOrderEmailHtml({ ...emailData, variant: "admin" }),
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (emailError) {
      console.error("Admin email queue failed:", emailError);
    }

    // Queue Buyer Confirmation Email
    const buyerEmail = request.auth?.token?.email;
    if (buyerEmail) {
      try {
        await db.collection("mail").add({
          to: [buyerEmail],
          message: {
            subject: `\u2705 Order Confirmed: ${orderId} \u2014 ${data.totalValue}`,
            html: buildOrderEmailHtml({ ...emailData, variant: "buyer" }),
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (emailError) {
        console.error("Buyer email queue failed:", emailError);
      }
    }

    return { success: true, orderId: orderId, message: "Order placed successfully!" };

  } catch (error) {
    console.error("Error submitting order:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "An error occurred while saving the order."
    );
  }
});

/**
 * Notify buyer when order status changes (Accepted, Fulfilled, Rejected)
 * Called by admin panel after status update — sends branded email + in-app notification
 */
exports.notifyOrderStatusChange = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);

    const { orderId, newStatus, orderCollection } = request.data;
    if (!orderId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing orderId or newStatus.");
    }

    // Resolve collection based on mode
    const mode = await getAppMode();
    const colName = orderCollection || resolveCol("orders", mode);

    // Read order document
    const orderSnap = await db.collection(colName).doc(orderId).get();
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const order = orderSnap.data();

    const buyerUserId = order.userId;
    const buyerEmail = order.userEmail || null;
    const customerName = order.customerName || "Customer";
    const displayOrderId = order.orderId || orderId;

    // Generate invoice PDF attachment for Fulfilled orders
    let pdfAttachments = [];
    if (newStatus === "Fulfilled") {
      try {
        const bizSnap = await db.collection("settings").doc("business").get();
        const bizData = bizSnap.exists ? bizSnap.data() : {};
        const pdfBuffer = generateInvoicePdf(order, bizData);
        const pdfBase64 = pdfBuffer.toString("base64");
        pdfAttachments = [{
          filename: `Invoice_${displayOrderId}.pdf`,
          content: pdfBase64,
          contentType: "application/pdf",
        }];
        console.log(`Invoice PDF generated for ${displayOrderId}: ${pdfBuffer.length} bytes`);
      } catch (pdfErr) {
        console.error("Failed to generate invoice PDF:", pdfErr);
        // Don't block the email — send without attachment
      }
    }

    // Status-specific messages
    const statusMessages = {
      Accepted: {
        subject: `Order ${displayOrderId} Accepted`,
        heading: "Your order has been accepted!",
        body: `Great news, ${customerName}! Your order has been accepted and is being prepared for delivery.`,
        color: "#2563eb",
      },
      Shipped: {
        subject: `Order ${displayOrderId} Shipped`,
        heading: "Your order has been shipped!",
        body: `Hi ${customerName}, your order has been shipped and is on its way to you. You will be notified once it is delivered.`,
        color: "#6366f1",
      },
      Fulfilled: {
        subject: `Order ${displayOrderId} Delivered`,
        heading: "Your order has been delivered!",
        body: `Hi ${customerName}, your order has been delivered successfully. Thank you for choosing KKR Groceries!`,
        color: "#059669",
      },
      Rejected: {
        subject: `Order ${displayOrderId} Cancelled`,
        heading: "Your order has been cancelled",
        body: `Hi ${customerName}, unfortunately your order has been cancelled. Please contact us if you have questions.`,
        color: "#dc2626",
      },
    };

    const statusInfo = statusMessages[newStatus];
    if (!statusInfo) {
      return { success: true, message: "No notification needed for this status." };
    }

    // Build premium status email HTML
    const cart = order.revisedFulfilledCart || order.revisedAcceptedCart || order.cart || [];
    const statusEmailData = {
      orderId: displayOrderId,
      customerName,
      newStatus,
      cart,
      totalValue: order.totalValue || "N/A",
      productCount: order.productCount || 0,
      statusInfo,
    };
    const emailHtml = buildStatusEmailHtml(statusEmailData);

    // Queue email to buyer if they have email
    if (buyerEmail) {
      try {
        const buyerMailDoc = {
          to: [buyerEmail],
          message: {
            subject: `${newStatus === "Accepted" ? "\u2705" : newStatus === "Shipped" ? "\u{1F69A}" : newStatus === "Fulfilled" ? "\u{1F4E6}" : "\u274C"} ${statusInfo.subject}`,
            html: emailHtml,
          },
          createdAt: FieldValue.serverTimestamp(),
        };
        // Attach invoice PDF for Fulfilled orders
        if (pdfAttachments.length > 0) {
          buyerMailDoc.attachments = pdfAttachments;
        }
        await db.collection("mail").add(buyerMailDoc);
      } catch (emailErr) {
        console.error("Failed to queue buyer email:", emailErr);
      }
    }

    // Also email admin notification recipients
    try {
      const notifyEmails = await getNotificationEmails();
      await db.collection("mail").add({
        to: notifyEmails,
        message: {
          subject: `\u{1F4CB} [Admin] ${statusInfo.subject}`,
          html: emailHtml,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (adminEmailErr) {
      console.error("Failed to queue admin email:", adminEmailErr);
    }

    // Create in-app notification for buyer
    if (buyerUserId && buyerUserId !== "anonymous") {
      try {
        const notifCol = resolveCol("notifications", mode);
        await db.collection(notifCol).add({
          userId: buyerUserId,
          orderId: orderId,
          type: "statusChange",
          title: statusInfo.heading,
          message: `Order ${displayOrderId}: ${statusInfo.body}`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.error("Failed to create in-app notification:", notifErr);
      }
    }

    console.log(`Status notification sent: ${newStatus} for order ${displayOrderId} by ${caller.uid}`);
    return { success: true, message: `Notification sent for status: ${newStatus}` };

  } catch (error) {
    console.error("Error in notifyOrderStatusChange:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to send notification"
    );
  }
});

/**
 * Smart Order Routing: Score stores by stock availability + proximity
 * Returns ranked stores with fulfillment info and transfer suggestions
 */
exports.assignOrderToStore = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "assignOrderToStore", 30, 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { orderId } = request.data || {};
    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

    const mode = await getAppMode();
    const orderCol = resolveCol("orders", mode);
    const storeCol = resolveCol("stores", mode);
    const invCol = resolveCol("storeInventory", mode);

    // 1. Read the order
    const orderSnap = await db.collection(orderCol).doc(orderId).get();
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const order = orderSnap.data();
    const cartItems = order.cart || [];
    if (cartItems.length === 0) {
      throw new HttpsError("failed-precondition", "Order has no cart items.");
    }

    // 2. Read all active stores
    const storesSnap = await db.collection(storeCol).where("isActive", "==", true).get();
    if (storesSnap.empty) {
      throw new HttpsError("failed-precondition", "No active stores found.");
    }
    const stores = storesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 3. Read all inventory for active stores
    const storeIds = stores.map((s) => s.id);
    // Firestore 'in' supports up to 30 — sufficient for stores
    const invSnap = await db.collection(invCol).where("storeId", "in", storeIds).get();
    // Build inventory lookup: { storeId: { productId: { currentQty, productName, unit } } }
    const invMap = {};
    invSnap.docs.forEach((d) => {
      const data = d.data();
      if (!invMap[data.storeId]) invMap[data.storeId] = {};
      invMap[data.storeId][data.productId] = {
        currentQty: data.currentQty || 0,
        productName: data.productName || "",
        unit: data.unit || "",
      };
    });

    // Also build a name->productId lookup from inventory for matching cart items without IDs
    const nameToProductId = {};
    invSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.productName) {
        nameToProductId[data.productName.toLowerCase()] = data.productId;
      }
    });

    // 4-5. Score stores using shared helper (proximity-first with inventory tiebreaker)
    const ranked = scoreStoresForOrder({
      stores,
      invMap,
      nameToProductId,
      cart: cartItems,
      orderLat: order.lat,
      orderLng: order.lng,
    });

    // Map to the response shape the admin UI expects (fulfillmentPercent as 0-100 integer)
    const TIER_COUNT = 5; // matches helper's [5,10,20,Infinity] + no-GPS bucket
    const storeResults = ranked.map((r) => {
      const pct = Math.round(r.fulfillmentPercent * 100);
      const score = Math.round(((TIER_COUNT - r.tier) * 10 + r.fulfillmentPercent) * 1000) / 1000;
      return {
        storeId: r.storeId,
        storeName: r.storeName,
        distanceKm: r.distanceKm,
        fulfillmentPercent: pct,
        score,
        tier: r.tier,
        availableItems: r.availableItems,
        missingItems: r.missingItems,
      };
    });

    const bestStore = storeResults[0];

    // 6. Build transfer suggestions for missing items at best store
    const suggestedTransfers = [];
    if (bestStore && bestStore.missingItems.length > 0) {
      for (const missing of bestStore.missingItems) {
        if (!missing.productId) continue;
        // Find another store that has this product in sufficient qty
        for (const otherStore of stores) {
          if (otherStore.id === bestStore.storeId) continue;
          const otherInv = invMap[otherStore.id] || {};
          const otherItem = otherInv[missing.productId];
          if (otherItem && otherItem.currentQty >= missing.shortfall) {
            suggestedTransfers.push({
              fromStoreId: otherStore.id,
              fromStoreName: otherStore.name || "",
              toStoreId: bestStore.storeId,
              toStoreName: bestStore.storeName,
              productId: missing.productId,
              productName: missing.productName,
              qty: missing.shortfall,
              unit: missing.unit,
            });
            break; // Found a source, move to next missing item
          }
        }
      }
    }

    return {
      stores: storeResults,
      bestStoreId: bestStore?.storeId || "",
      bestStoreName: bestStore?.storeName || "",
      bestFulfillmentPercent: bestStore?.fulfillmentPercent || 0,
      suggestedTransfers,
    };
  } catch (error) {
    console.error("Error in assignOrderToStore:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to compute store assignment"
    );
  }
});
