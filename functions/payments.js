/**
 * Payment Cloud Functions.
 * - submitPaymentUTR: buyer submits the UPI reference (UTR) for their own order
 *   after paying via the UPI deep-link / QR. Admin then reconciles & marks paid.
 *
 * (Razorpay auto-confirm functions will be added here in Phase 2.)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  db, FieldValue,
  resolveCol, getAppMode,
  isRateLimited, requireAdmin,
} = require("./utils");

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

  console.log(`Payment UTR submitted for order ${orderId} by ${request.auth.uid}`);
  return { success: true };
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
  return { success: true };
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
