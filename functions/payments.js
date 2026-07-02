/**
 * Payment Cloud Functions.
 * - submitPaymentUTR: buyer submits the UPI reference (UTR) for their own order
 *   after paying via the UPI deep-link / QR. Admin then reconciles & marks paid.
 *
 * (Razorpay auto-confirm functions will be added here in Phase 2.)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  db, FieldValue,
  resolveCol, getAppMode,
  isRateLimited, requireAdmin,
  buildOrderEmailHtml, getBusinessTagline,
  getNotificationEmails,
} = require("./utils");

/**
 * Activate an AwaitingPayment (UPI) order — it now counts as PLACED.
 * Flips status to "Pending" and sends the new-order emails that submitOrder
 * deferred. Called when the buyer submits a UTR or switches to COD.
 * No-op for orders in any other status.
 */
async function activateAwaitingOrder(orderRef, order, buyerEmail) {
  if (order.status !== "AwaitingPayment") return false;

  await orderRef.update({
    status: "Pending",
    placedAt: FieldValue.serverTimestamp(),
  });

  const emailData = {
    orderId: order.orderId || orderRef.id,
    customerName: order.customerName,
    phone: order.phone,
    shopName: order.shopName || "Not specified",
    deliveryAddress: order.location || null,
    lat: order.lat || null,
    lng: order.lng || null,
    cart: order.cart || [],
    totalValue: order.totalValue,
    productCount: order.productCount || (order.cart || []).length,
  };

  await getBusinessTagline();

  try {
    const notifyEmails = await getNotificationEmails();
    await db.collection("mail").add({
      to: notifyEmails,
      message: {
        subject: `\u{1F6D2} New Order: ${emailData.orderId} — ${order.totalValue}`,
        html: buildOrderEmailHtml({ ...emailData, variant: "admin" }),
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("[activateAwaitingOrder] admin email failed:", e.message);
  }

  if (buyerEmail || order.userEmail) {
    try {
      await db.collection("mail").add({
        to: [buyerEmail || order.userEmail],
        message: {
          subject: `✅ Order Confirmed: ${emailData.orderId} — ${order.totalValue}`,
          html: buildOrderEmailHtml({ ...emailData, variant: "buyer" }),
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error("[activateAwaitingOrder] buyer email failed:", e.message);
    }
  }

  console.log(`[activateAwaitingOrder] Order ${orderRef.id} activated (AwaitingPayment → Pending)`);
  return true;
}

exports.submitPaymentUTR = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const { orderId, orderCollection, utr } = request.data || {};
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");
  const ref = String(utr || "").trim();
  if (ref.length < 6 || ref.length > 40) {
    throw new HttpsError("invalid-argument", "Enter a valid UPI reference / UTR number.");
  }

  if (await isRateLimited(request.auth.uid, "submitPaymentUTR", 20, 10 * 60 * 1000)) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Please wait a moment.");
  }

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);
  const orderRef = db.collection(colName).doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data();

  // Only the order's buyer may submit a reference for it
  if (order.userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "You can only submit payment for your own order.");
  }
  if (order.paymentStatus === "paid") {
    return { success: true, alreadyPaid: true };
  }

  await orderRef.update({
    paymentStatus: "submitted",
    paymentMethod: "upi",
    paymentRef: ref,
    paymentSubmittedAt: FieldValue.serverTimestamp(),
  });

  // Payment made — if the order was waiting on it, it is now officially placed.
  const activated = await activateAwaitingOrder(orderRef, order, request.auth.token?.email || null);

  console.log(`Payment UTR submitted for order ${orderId} by ${request.auth.uid}`);
  return { success: true, activated };
});

/**
 * chooseCOD — the buyer opts to pay cash on delivery instead of paying online.
 * Sets paymentMethod = "cod" (status stays "unpaid" until the agent collects).
 */
exports.chooseCOD = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { orderId, orderCollection } = request.data || {};
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);
  const orderRef = db.collection(colName).doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data();

  if (order.userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "You can only update your own order.");
  }
  if (order.paymentStatus === "paid") {
    return { success: true, alreadyPaid: true };
  }

  await orderRef.update({ paymentMethod: "cod", paymentStatus: "unpaid" });

  // COD is allowed to place immediately — activate if it was awaiting payment.
  const activated = await activateAwaitingOrder(orderRef, order, request.auth.token?.email || null);

  return { success: true, activated };
});

/**
 * expireUnpaidOrders — hourly sweep that cancels UPI orders still awaiting
 * payment after 24 hours, so abandoned checkouts don't linger as zombie
 * orders. The buyer is notified and can simply order again.
 */
exports.expireUnpaidOrders = onSchedule("every 60 minutes", async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const colName of ["orders", "test_orders"]) {
    try {
      const snap = await db.collection(colName).where("status", "==", "AwaitingPayment").get();
      if (snap.empty) continue;
      const notifCol = colName === "orders" ? "notifications" : "test_notifications";
      let expired = 0;
      for (const d of snap.docs) {
        const o = d.data();
        const createdMs = o.createdAt?.toMillis?.() || 0;
        if (!createdMs || createdMs > cutoff.getTime()) continue;
        await d.ref.update({
          status: "Rejected",
          rejectedAt: FieldValue.serverTimestamp(),
          rejectReason: "Payment not completed within 24 hours",
        });
        if (o.userId && !String(o.userId).startsWith("anon")) {
          try {
            await db.collection(notifCol).add({
              userId: o.userId,
              orderId: d.id,
              type: "order_expired",
              title: "Order cancelled — payment not received",
              message: `Order #${o.orderId || d.id} was cancelled because payment wasn't completed. You can place it again anytime.`,
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          } catch (_) { /* ignore */ }
        }
        expired += 1;
      }
      if (expired > 0) console.log(`[expireUnpaidOrders] ${colName}: expired ${expired} order(s)`);
    } catch (e) {
      console.error(`[expireUnpaidOrders] ${colName} sweep failed:`, e.message);
    }
  }
});

/**
 * settleAgentCash — admin marks all unsettled cash (COD) collected by a given
 * agent as handed over / settled. Clears the agent's "cash in hand".
 */
exports.settleAgentCash = onCall(async (request) => {
  const caller = await requireAdmin(request);
  if (await isRateLimited(caller.uid, "settleAgentCash", 30, 10 * 60 * 1000)) {
    throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
  }
  const { agentUid, orderCollection } = request.data || {};
  if (!agentUid) throw new HttpsError("invalid-argument", "agentUid is required.");

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);

  // Single-field query (no composite index); filter the rest in memory.
  const snap = await db.collection(colName).where("collectedBy", "==", agentUid).get();
  const batch = db.batch();
  let settledCount = 0;
  let settledAmount = 0;
  snap.docs.forEach((d) => {
    const o = d.data();
    if (o.paymentMethod === "cash" && o.cashSettled !== true) {
      batch.update(d.ref, {
        cashSettled: true,
        settledAt: FieldValue.serverTimestamp(),
        settledBy: caller.uid,
      });
      settledCount += 1;
      settledAmount += Number(o.collectedAmount || 0);
    }
  });
  if (settledCount > 0) await batch.commit();

  console.log(`settleAgentCash: agent ${agentUid} — ${settledCount} orders, ₹${settledAmount} by ${caller.uid}`);
  return { success: true, settledCount, settledAmount };
});
