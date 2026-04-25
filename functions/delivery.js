/**
 * Delivery Cloud Functions.
 * - sendDeliveryOTP
 * - verifyDeliveryOTP
 * - autoAssignDeliveryBoy
 * - generateTrackingLink
 * - cleanupExpiredTracking (scheduled)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getMessaging } = require("firebase-admin/messaging");
const {
  db, FieldValue,
  haversineKm,
  resolveCol, getAppMode,
  isRateLimited, requireAdmin,
  emailLayout,
} = require("./utils");

/**
 * sendDeliveryOTP — generates a 6-digit OTP, stores it in Firestore,
 * and dispatches it via the requested channels (email and/or customer-app push).
 *
 * SMS is handled client-side via Firebase Phone Auth and is NOT routed here.
 *
 * Request data:
 *   - orderId        : string (required)
 *   - orderCollection: string (optional, defaults to mode-resolved "orders")
 *   - channels       : { email?: boolean, app?: boolean }
 *                      Default: { email: true } — preserves the legacy contract.
 */
exports.sendDeliveryOTP = onCall(async (request) => {
  const caller = await requireAdmin(request);
  const { orderId, orderCollection, channels } = request.data;
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId.");

  const wantEmail = !channels || channels.email === true || channels.email === undefined;
  const wantApp = !!(channels && channels.app);
  if (!wantEmail && !wantApp) {
    throw new HttpsError("invalid-argument", "At least one of email/app must be requested.");
  }

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);

  const orderSnap = await db.collection(colName).doc(orderId).get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data();

  const buyerEmail = order.userEmail || null;
  const buyerPhone = order.phone || null;
  const buyerUid = order.userId || null;
  if (wantEmail && !buyerEmail) {
    throw new HttpsError("failed-precondition", "Customer has no email on file. Cannot send email OTP.");
  }
  if (wantApp && !buyerUid) {
    throw new HttpsError("failed-precondition", "Customer has no app account linked to this order. Cannot send via Customer App.");
  }

  // Generate 6-digit OTP (shared across channels)
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP in Firestore. The "app" channel reads this doc live to render
  // the Active OTP banner on the buyer's order detail page.
  await db.collection("delivery_otps").doc(orderId).set({
    otp,
    orderId,
    orderCollection: colName,
    buyerEmail: buyerEmail || "",
    buyerPhone: buyerPhone || "",
    buyerUid: buyerUid || "",
    channels: { email: wantEmail, app: wantApp },
    expiresAt: expiresAt.toISOString(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
    verified: false,
    attempts: 0,
  });

  const customerName = order.customerName || "Customer";
  const displayOrderId = order.orderId || orderId;
  const sentTo = [];
  const errors = [];

  // ── Channel: Email ──
  if (wantEmail) {
    try {
      const otpEmailHtml = emailLayout(`
        <div style="padding:32px 24px;text-align:center;">
          <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;line-height:64px;font-size:28px;margin:0 auto 16px;">\u{1F510}</div>
          <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 8px;">Delivery Verification</h2>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Hi ${customerName}, please share this OTP with the delivery person to confirm receipt of your order.
          </p>
          <div style="background:#064e3b;border-radius:16px;padding:24px;margin:0 auto;max-width:280px;">
            <div style="color:#a7f3d0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Your OTP</div>
            <div style="color:#ffffff;font-size:36px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${otp}</div>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;">
            Order: <strong>${displayOrderId}</strong> &bull; Valid for 10 minutes
          </p>
          <p style="color:#ef4444;font-size:12px;font-weight:600;margin:8px 0 0;">
            Do not share this code with anyone other than the delivery person.
          </p>
        </div>
      `, `Your delivery OTP for order ${displayOrderId}`);

      await db.collection("mail").add({
        to: [buyerEmail],
        message: {
          subject: `\u{1F510} Delivery OTP for Order ${displayOrderId}`,
          html: otpEmailHtml,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      sentTo.push(`email:${buyerEmail}`);
    } catch (e) {
      errors.push(`email: ${e.message}`);
    }
  }

  // ── Channel: Customer App ──
  // Tries an FCM push if the buyer has a registered token. Even without a token,
  // the buyer's open order page picks up the OTP via the Firestore listener.
  if (wantApp) {
    let pushed = false;
    try {
      const tokenSnap = await db
        .collection("users")
        .doc(buyerUid)
        .collection("tokens")
        .doc("fcm")
        .get();

      if (tokenSnap.exists && tokenSnap.data().active !== false && tokenSnap.data().token) {
        await getMessaging().send({
          token: tokenSnap.data().token,
          notification: {
            title: "Delivery OTP",
            body: `Your code for order ${displayOrderId} is ${otp}. Valid for 10 minutes.`,
          },
          data: {
            type: "delivery_otp",
            orderId,
            otp,
          },
        });
        pushed = true;
      }
    } catch (e) {
      errors.push(`app push: ${e.message}`);
    }
    sentTo.push(pushed ? "app:push+banner" : "app:banner");
  }

  console.log(
    `Delivery OTP for ${orderId} dispatched via [${sentTo.join(", ")}] by admin ${caller.uid}` +
      (errors.length ? ` — partial errors: ${errors.join("; ")}` : "")
  );

  return {
    success: true,
    sentTo,
    errors,
    message: `OTP dispatched via ${sentTo.join(" + ") || "no channels"}`,
  };
});

/**
 * verifyDeliveryOTP — checks the OTP entered by admin against the stored value.
 */
exports.verifyDeliveryOTP = onCall(async (request) => {
  await requireAdmin(request);
  const { orderId, otp } = request.data;
  if (!orderId || !otp) throw new HttpsError("invalid-argument", "Missing orderId or otp.");

  const otpSnap = await db.collection("delivery_otps").doc(orderId).get();
  if (!otpSnap.exists) {
    throw new HttpsError("not-found", "No OTP found for this order. Please send a new one.");
  }

  const otpDoc = otpSnap.data();

  // Check expiry
  if (new Date(otpDoc.expiresAt) < new Date()) {
    throw new HttpsError("deadline-exceeded", "OTP has expired. Please send a new one.");
  }

  // Check attempts (max 5)
  if (otpDoc.attempts >= 5) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Please send a new OTP.");
  }

  // Increment attempts
  await db.collection("delivery_otps").doc(orderId).update({
    attempts: FieldValue.increment(1),
  });

  // Verify
  if (otpDoc.otp !== otp.trim()) {
    const remaining = 4 - otpDoc.attempts;
    throw new HttpsError("permission-denied", `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
  }

  // Mark as verified
  await db.collection("delivery_otps").doc(orderId).update({
    verified: true,
    verifiedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, message: "OTP verified successfully." };
});

/**
 * Auto-assign nearest available delivery boy to an order.
 * Called when admin wants one-tap auto-assignment.
 * Finds online delivery boys with GPS, picks nearest to assigned store (or order location).
 */
exports.autoAssignDeliveryBoy = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "autoAssignDeliveryBoy", 20, 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { orderId } = request.data || {};
    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

    const mode = await getAppMode();
    const orderCol = resolveCol("orders", mode);
    const storeCol = resolveCol("stores", mode);

    // 1. Read order
    const orderDoc = await db.collection(orderCol).doc(orderId).get();
    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const order = orderDoc.data();

    // 2. Determine reference location (assigned store > order location)
    let refLat, refLng;
    if (order.assignedStoreId) {
      const storeDoc = await db.collection(storeCol).doc(order.assignedStoreId).get();
      if (storeDoc.exists) {
        const store = storeDoc.data();
        refLat = store.lat;
        refLng = store.lng;
      }
    }
    if (!refLat || !refLng) {
      refLat = order.lat;
      refLng = order.lng;
    }
    if (!refLat || !refLng) {
      throw new HttpsError("failed-precondition", "No location available for order or assigned store.");
    }

    // 3. Find online delivery boys with GPS
    const presenceSnap = await db.collection("presence")
      .where("isDelivery", "==", true)
      .where("online", "==", true)
      .get();

    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    const candidates = [];

    for (const doc of presenceSnap.docs) {
      const p = doc.data();
      const lastSeenMs = p.lastSeen?.toMillis?.() || 0;
      if (lastSeenMs < twoMinutesAgo) continue;
      if (!p.lat || !p.lng) continue;

      // Check if already assigned to an active delivery
      const activeOrders = await db.collection(orderCol)
        .where("assignedTo", "==", p.uid || doc.id)
        .where("status", "in", ["Accepted", "Shipped"])
        .limit(1)
        .get();

      const isBusy = !activeOrders.empty;
      const distance = haversineKm(refLat, refLng, p.lat, p.lng);

      candidates.push({
        uid: p.uid || doc.id,
        name: p.displayName || p.phone || p.email?.split("@")[0] || "Unknown",
        phone: p.phone || null,
        lat: p.lat,
        lng: p.lng,
        distanceKm: Math.round(distance * 10) / 10,
        isBusy,
      });
    }

    if (candidates.length === 0) {
      throw new HttpsError("not-found", "No delivery boys with GPS are currently online.");
    }

    // 4. Score: prefer available (not busy) + closest
    candidates.sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1; // available first
      return a.distanceKm - b.distanceKm; // then nearest
    });

    const best = candidates[0];

    // 5. Assign to order
    await db.collection(orderCol).doc(orderId).update({
      assignedTo: best.uid,
      assignedToName: best.name,
      assignedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[autoAssignDeliveryBoy] Assigned ${best.name} (${best.distanceKm}km) to order ${orderId}`);

    return {
      success: true,
      assigned: {
        uid: best.uid,
        name: best.name,
        phone: best.phone,
        distanceKm: best.distanceKm,
        wasBusy: best.isBusy,
      },
      candidateCount: candidates.length,
      availableCount: candidates.filter((c) => !c.isBusy).length,
    };
  } catch (error) {
    if (error.code) throw error;
    console.error("Error in autoAssignDeliveryBoy:", error);
    throw new HttpsError("internal", error.message || "Failed to auto-assign delivery boy.");
  }
});

/**
 * Generate a tracking token for customer live-tracking.
 * Creates a short-lived token (24h) in deliveryTracking collection.
 */
exports.generateTrackingLink = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "generateTrackingLink", 30, 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests.");
    }

    const { orderId } = request.data || {};
    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

    const mode = await getAppMode();
    const orderCol = resolveCol("orders", mode);

    const orderDoc = await db.collection(orderCol).doc(orderId).get();
    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }

    const order = orderDoc.data();
    if (!order.assignedTo) {
      throw new HttpsError("failed-precondition", "No delivery boy assigned to this order.");
    }

    // Generate a random token
    const crypto = require("crypto");
    const token = crypto.randomBytes(16).toString("hex");

    // Store tracking info (24h expiry)
    const trackingCol = resolveCol("deliveryTracking", mode);
    await db.collection(trackingCol).doc(token).set({
      orderId,
      orderDocId: orderId,
      deliveryBoyUid: order.assignedTo,
      deliveryBoyName: order.assignedToName || "Delivery",
      customerName: order.customerName,
      storeId: order.assignedStoreId || null,
      storeName: order.assignedStoreName || null,
      status: order.status,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      collectionName: orderCol,
    });

    // Update order with tracking token
    await db.collection(orderCol).doc(orderId).update({
      trackingToken: token,
    });

    const modeParam = mode === "test" ? "?mode=test" : "";
    return {
      success: true,
      token,
      trackingUrl: `https://kkr-groceries-02.web.app/track/${token}${modeParam}`,
    };
  } catch (error) {
    if (error.code) throw error;
    console.error("Error in generateTrackingLink:", error);
    throw new HttpsError("internal", error.message || "Failed to generate tracking link.");
  }
});

// ─── Cleanup Expired Delivery Tracking Docs ───
exports.cleanupExpiredTracking = onSchedule("every 24 hours", async (event) => {
  const now = new Date();
  const collections = ["deliveryTracking", "test_deliveryTracking"];
  let totalDeleted = 0;

  for (const colName of collections) {
    const expiredSnap = await db.collection(colName)
      .where("expiresAt", "<", now)
      .limit(500)
      .get();

    if (!expiredSnap.empty) {
      const batch = db.batch();
      expiredSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += expiredSnap.size;
    }
  }

  console.log(`[cleanupExpiredTracking] Deleted ${totalDeleted} expired tracking docs`);
});
