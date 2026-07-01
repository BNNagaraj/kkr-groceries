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
  emailLayout, getBusinessTagline,
  getNotificationEmails,
} = require("./utils");

/**
 * Best-effort push to a delivery agent's device on a new assignment.
 * Reads the FCM token the client stored on presence/{uid} (see web push.ts).
 * No-op if the agent hasn't registered a token — never throws.
 */
async function sendAssignmentPush(uid, displayId, location) {
  try {
    const snap = await db.collection("presence").doc(uid).get();
    const token = snap.exists ? snap.data().fcmToken : null;
    if (!token) return;
    await getMessaging().send({
      token,
      notification: {
        title: "New delivery assigned",
        body: `Order #${displayId} — ${location || "address on file"}.`,
      },
      data: { type: "delivery_assigned", url: "/delivery", tag: "kkr-delivery" },
      webpush: {
        fcmOptions: { link: "/delivery" },
        notification: { icon: "/icon-192.png", requireInteraction: true },
      },
    });
  } catch (e) {
    console.warn("[sendAssignmentPush] failed:", e.message);
  }
}

/**
 * Find delivery-agent candidates near a reference point, excluding any UIDs
 * (e.g. agents who already rejected the order). Returns the best candidate
 * (available + nearest first) and the full sorted list.
 */
async function findBestAgent(orderCol, refLat, refLng, excludeUids = []) {
  const presenceSnap = await db.collection("presence")
    .where("isDelivery", "==", true)
    .where("online", "==", true)
    .get();

  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
  const exclude = new Set(excludeUids);
  const candidates = [];

  for (const docSnap of presenceSnap.docs) {
    const p = docSnap.data();
    const uid = p.uid || docSnap.id;
    if (exclude.has(uid)) continue;
    if (p.available === false) continue; // agent toggled themselves off-shift
    const lastSeenMs = p.lastSeen?.toMillis?.() || 0;
    if (lastSeenMs < twoMinutesAgo) continue;
    if (!p.lat || !p.lng) continue;

    const activeOrders = await db.collection(orderCol)
      .where("assignedTo", "==", uid)
      .where("status", "in", ["Accepted", "Shipped"])
      .limit(1)
      .get();

    candidates.push({
      uid,
      name: p.displayName || p.phone || p.email?.split("@")[0] || "Unknown",
      phone: p.phone || null,
      lat: p.lat,
      lng: p.lng,
      distanceKm: Math.round(haversineKm(refLat, refLng, p.lat, p.lng) * 10) / 10,
      tier: p.tier === "overflow" ? "overflow" : "core",
      isBusy: !activeOrders.empty,
    });
  }

  candidates.sort((a, b) => {
    if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1; // available first
    // Prefer core riders; overflow/gig riders are only reached once core
    // capacity is exhausted (no available core nearer than them).
    const at = a.tier === "overflow" ? 1 : 0;
    const bt = b.tier === "overflow" ? 1 : 0;
    if (at !== bt) return at - bt;
    return a.distanceKm - b.distanceKm; // then nearest
  });

  return { best: candidates[0] || null, candidates };
}

/**
 * Authorize a caller as either an admin OR the delivery agent assigned to the
 * given order. Returns { uid, isAdmin }. Throws HttpsError otherwise.
 */
async function authorizeAdminOrAssignedAgent(request, order) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  // Admins are always allowed
  try {
    await requireAdmin(request);
    return { uid: request.auth.uid, isAdmin: true };
  } catch (_) {
    // not an admin — fall through to the assigned-agent check
  }
  const hasDeliveryClaim = !!(request.auth.token && request.auth.token.delivery === true);
  if (hasDeliveryClaim && order.assignedTo === request.auth.uid) {
    return { uid: request.auth.uid, isAdmin: false };
  }
  throw new HttpsError("permission-denied", "You are not authorized for this delivery.");
}

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

  // Admin OR the delivery agent assigned to this order may dispatch the OTP.
  const caller = await authorizeAdminOrAssignedAgent(request, order);

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
      await getBusinessTagline();
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
  // Three surfaces for the same OTP code:
  //   1. Live banner on the buyer's order detail page (Firestore listener on delivery_otps)
  //   2. Notification doc → appears in the bell dropdown across all buyer pages
  //   3. FCM push if the buyer has a registered token (otherwise no-op)
  if (wantApp) {
    let pushed = false;

    // 1+2. Notification doc — drives both the bell entry and the in-app popup
    try {
      const notifCol = resolveCol("notifications", mode);
      await db.collection(notifCol).add({
        userId: buyerUid,
        orderId,
        type: "delivery_otp",
        title: "Delivery OTP",
        message: `Your code for order ${displayOrderId} is ${otp}. Valid 10 minutes.`,
        otp,
        expiresAt: expiresAt.toISOString(),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      errors.push(`app notification: ${e.message}`);
    }

    // 3. FCM push (best-effort)
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
    sentTo.push(pushed ? "app:push+bell+banner" : "app:bell+banner");
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
 * completeDelivery — marks an order as delivered (Fulfilled).
 *
 * Callable by the admin OR the delivery agent assigned to the order. This is
 * the ONLY way a delivery agent completes a delivery (they have no direct write
 * access to order docs). When `requireDeliveryOTP` is enabled in settings, a
 * valid OTP must be supplied — it is verified here, server-side, before the
 * order is marked delivered.
 *
 * Request data: { orderId, orderCollection?, otp? }
 */
exports.completeDelivery = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const { orderId, orderCollection, otp, cashOutcome, collectedAmount } = request.data || {};
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId.");

  if (await isRateLimited(request.auth.uid, "completeDelivery", 30, 10 * 60 * 1000)) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Please wait a moment.");
  }

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);
  const orderRef = db.collection(colName).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data();

  // Admin OR the assigned delivery agent only
  const caller = await authorizeAdminOrAssignedAgent(request, order);

  if (order.status === "Fulfilled") {
    return { success: true, message: "Order is already marked delivered." };
  }

  // OTP enforcement (only when the business requires it)
  let requireOtp = false;
  try {
    const checkoutSnap = await db.collection("settings").doc("checkout").get();
    requireOtp = checkoutSnap.exists && checkoutSnap.data().requireDeliveryOTP === true;
  } catch (_) { /* default to not required if settings unreadable */ }

  if (requireOtp) {
    if (!otp) throw new HttpsError("failed-precondition", "Delivery OTP is required to complete this delivery.");
    const otpSnap = await db.collection("delivery_otps").doc(orderId).get();
    if (!otpSnap.exists) throw new HttpsError("not-found", "No OTP found for this order. Please send one first.");
    const otpDoc = otpSnap.data();
    if (new Date(otpDoc.expiresAt) < new Date()) {
      throw new HttpsError("deadline-exceeded", "OTP has expired. Please send a new one.");
    }
    if ((otpDoc.attempts || 0) >= 5) {
      throw new HttpsError("resource-exhausted", "Too many OTP attempts. Please send a new one.");
    }
    await db.collection("delivery_otps").doc(orderId).update({ attempts: FieldValue.increment(1) });
    if (otpDoc.otp !== String(otp).trim()) {
      const remaining = 4 - (otpDoc.attempts || 0);
      throw new HttpsError("permission-denied", `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
    }
    await db.collection("delivery_otps").doc(orderId).update({
      verified: true,
      verifiedAt: FieldValue.serverTimestamp(),
    });
  }

  const update = {
    status: "Fulfilled",
    deliveredAt: FieldValue.serverTimestamp(),
    deliveredBy: caller.uid,
  };

  // Cash on Delivery: for orders not paid online (and not awaiting a UPI
  // reference), record the agent's explicit cash-collection outcome.
  //   full     → Paid (Cash), full amount
  //   partial  → Partial, records collectedAmount, remainder stays outstanding
  //   none     → Delivered but Unpaid (outstanding) — no cash booked
  const ps = order.paymentStatus;
  if (ps !== "paid" && ps !== "submitted") {
    const orderTotal = Math.round(Number(String(order.totalValue || "0").replace(/[^0-9.]/g, "")) || 0);
    const outcome = cashOutcome || "full"; // default keeps prior behaviour
    if (outcome === "none") {
      update.paymentMethod = "cod"; // delivered, payment still pending
    } else if (outcome === "partial") {
      const amt = Math.max(0, Math.min(orderTotal, Math.round(Number(collectedAmount) || 0)));
      update.paymentStatus = amt >= orderTotal ? "paid" : "partial";
      update.paymentMethod = "cash";
      update.collectedAmount = amt;
      update.collectedBy = caller.uid;
      update.paidAt = FieldValue.serverTimestamp();
    } else {
      update.paymentStatus = "paid";
      update.paymentMethod = "cash";
      update.collectedAmount = orderTotal;
      update.collectedBy = caller.uid;
      update.paidAt = FieldValue.serverTimestamp();
    }
  }

  await orderRef.update(update);

  // ── Self-learning flywheel ──
  // Feed the actual outcome back into the fleet ETA model. We learn the real
  // "minutes per stop" (travel + wait + service) directly from completions —
  // coordinate-free and robust. For a batched trip, elapsed since assignment is
  // divided by the stops completed so far to approximate per-stop time. An EMA
  // lets the model track seasonal/operational drift. This is the compounding
  // loop: every delivery sharpens future ETAs. Best-effort — never blocks.
  try {
    const startMs = order.assignedAt?.toMillis?.() || order.acceptedAt?.toMillis?.() || null;
    if (startMs) {
      const elapsedMin = (Date.now() - startMs) / 60000;
      const stopsSoFar = (typeof order.batchStopIndex === "number" ? order.batchStopIndex : 0) + 1;
      const perStop = elapsedMin / stopsSoFar;
      if (perStop >= 1 && perStop <= 180) { // drop implausible samples
        const modelRef = db.collection("settings").doc("deliveryModel");
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(modelRef);
          const m = snap.exists ? snap.data() : {};
          const prev = typeof m.perStopMin === "number" ? m.perStopMin : perStop;
          const alpha = 0.2; // weight on the newest sample
          const perStopMin = Math.round((prev * (1 - alpha) + perStop * alpha) * 10) / 10;
          tx.set(modelRef, {
            perStopMin,
            sampleCount: (m.sampleCount || 0) + 1,
            slaMinutes: typeof m.slaMinutes === "number" ? m.slaMinutes : 90,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        });
      }
    }
  } catch (e) {
    console.warn("[flywheel] model update skipped:", e.message);
  }

  console.log(`Order ${orderId} delivered by ${caller.isAdmin ? "admin" : "agent"} ${caller.uid} (cash: ${cashOutcome || "full"})`);
  return { success: true, message: "Delivery completed.", cashCollected: update.paymentMethod === "cash" };
});

/**
 * reportDeliveryFailure — the agent (or admin) marks a delivery as failed with a
 * reason. The order is returned to the dispatch pool (status → Accepted,
 * unassigned) so it can be re-attempted, admins are emailed, and the customer is
 * notified. Nothing is marked paid/fulfilled.
 *
 * Request data: { orderId, orderCollection?, reason }
 */
exports.reportDeliveryFailure = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { orderId, orderCollection, reason } = request.data || {};
  const REASONS = ["customer_unavailable", "wrong_address", "customer_refused", "unreachable", "other"];
  if (!orderId || !REASONS.includes(reason)) {
    throw new HttpsError("invalid-argument", "orderId and a valid reason are required.");
  }

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);
  const orderRef = db.collection(colName).doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data();

  const caller = await authorizeAdminOrAssignedAgent(request, order);
  const displayId = order.orderId || orderId;

  const REASON_LABELS = {
    customer_unavailable: "Customer not available",
    wrong_address: "Wrong / incomplete address",
    customer_refused: "Customer refused the order",
    unreachable: "Couldn't reach the customer",
    other: "Other",
  };

  // Return the order to the actionable pool, unassigned, for re-dispatch.
  await orderRef.update({
    status: "Accepted",
    assignedTo: FieldValue.delete(),
    assignedToName: FieldValue.delete(),
    assignmentStatus: FieldValue.delete(),
    deliveryStage: FieldValue.delete(),
    deliveryFailed: true,
    lastFailureReason: reason,
    failedAt: FieldValue.serverTimestamp(),
    failedBy: caller.uid,
    failedAttempts: FieldValue.increment(1),
  });

  // Email admins
  try {
    const notifyEmails = await getNotificationEmails();
    await getBusinessTagline();
    const html = emailLayout(
      `<div style="padding:28px 24px;">
        <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px;">⚠️ Delivery attempt failed</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 4px;">Order <strong>#${displayId}</strong> could not be delivered.</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 4px;">Reason: <strong>${REASON_LABELS[reason]}</strong></p>
        <p style="color:#64748b;font-size:14px;margin:0;">${order.location || ""}</p>
        <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">The order is back in the pool — reassign it to re-attempt delivery.</p>
      </div>`,
      `Delivery failed for order ${displayId}`
    );
    await db.collection("mail").add({
      to: notifyEmails,
      message: { subject: `⚠️ Delivery failed — Order ${displayId} (${REASON_LABELS[reason]})`, html },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("[reportDeliveryFailure] email failed:", e.message);
  }

  // Notify the customer
  try {
    if (order.userId && order.userId !== "anonymous") {
      const notifCol = resolveCol("notifications", mode);
      await db.collection(notifCol).add({
        userId: order.userId,
        orderId,
        type: "delivery_failed",
        title: "Delivery attempt unsuccessful",
        message: `We couldn't complete delivery of order #${displayId}. Our team will re-attempt shortly.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("[reportDeliveryFailure] customer notify failed:", e.message);
  }

  console.log(`Order ${orderId} delivery failed (${reason}) reported by ${caller.uid}`);
  return { success: true, reason };
});

/**
 * advanceDeliveryStage — Swiggy/Zomato-style live progress for an in-transit
 * order. Callable by the admin OR the assigned delivery agent. Sets the
 * `deliveryStage` field and pings the customer on the recognizable stages.
 *
 * Valid stages (before the final "delivered", which goes via completeDelivery):
 *   reached_store → picked_up → on_the_way
 */
exports.advanceDeliveryStage = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const { orderId, orderCollection, stage } = request.data || {};
  const VALID = ["reached_store", "picked_up", "on_the_way"];
  if (!orderId || !VALID.includes(stage)) {
    throw new HttpsError("invalid-argument", "orderId and a valid stage are required.");
  }

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);
  const orderRef = db.collection(colName).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data();

  const caller = await authorizeAdminOrAssignedAgent(request, order);

  await orderRef.update({
    deliveryStage: stage,
    deliveryStageAt: FieldValue.serverTimestamp(),
  });

  // Notify the customer on the stages they care about
  try {
    if ((stage === "picked_up" || stage === "on_the_way") && order.userId && order.userId !== "anonymous") {
      const notifCol = resolveCol("notifications", mode);
      const displayId = order.orderId || orderId;
      const title = stage === "picked_up" ? "Order picked up" : "Out for delivery";
      const message =
        stage === "picked_up"
          ? `Order #${displayId} has been picked up and will be on its way shortly.`
          : `Order #${displayId} is on the way to you!`;
      await db.collection(notifCol).add({
        userId: order.userId,
        orderId,
        type: "delivery_update",
        title,
        message,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (notifErr) {
    console.warn("[advanceDeliveryStage] customer notify failed:", notifErr.message);
  }

  console.log(`Order ${orderId} stage → ${stage} by ${caller.isAdmin ? "admin" : "agent"} ${caller.uid}`);
  return { success: true, stage };
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
    let storeAgentUid = null;
    let storeName = null;
    if (order.assignedStoreId) {
      const storeDoc = await db.collection(storeCol).doc(order.assignedStoreId).get();
      if (storeDoc.exists) {
        const store = storeDoc.data();
        refLat = store.lat;
        refLng = store.lng;
        storeAgentUid = store.agentUid || null;
        storeName = store.name || null;
      }
    }
    if (!refLat || !refLng) {
      refLat = order.lat;
      refLng = order.lng;
    }
    if (!refLat || !refLng) {
      throw new HttpsError("failed-precondition", "No location available for order or assigned store.");
    }

    // 3-4. Find the best candidate (excluding any agent who already rejected it)
    const { best, candidates } = await findBestAgent(orderCol, refLat, refLng, order.rejectedBy || []);
    if (!best) {
      throw new HttpsError("not-found", "No delivery boys with GPS are currently online.");
    }

    // 5. Assign to order (assignmentStatus "pending" → awaits agent Accept/Reject)
    await db.collection(orderCol).doc(orderId).update({
      assignedTo: best.uid,
      assignedToName: best.name,
      assignmentStatus: "pending",
      assignedAt: FieldValue.serverTimestamp(),
    });

    // 6. Notify the assigned delivery agent (and the store agent, if any)
    try {
      const notifCol = resolveCol("notifications", mode);
      const displayId = order.orderId || orderId;
      await db.collection(notifCol).add({
        userId: best.uid,
        orderId,
        type: "delivery_assigned",
        title: "New delivery assigned",
        message: `Order #${displayId} — ${order.location || "address on file"}.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (storeAgentUid) {
        await db.collection(notifCol).add({
          userId: storeAgentUid,
          orderId,
          type: "store_order",
          title: "Order out for delivery",
          message: `Order #${displayId} from ${storeName || "your store"} assigned to ${best.name}.`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (notifErr) {
      console.warn("[autoAssignDeliveryBoy] notify failed:", notifErr.message);
    }

    // Push notification to the agent's device (best-effort).
    await sendAssignmentPush(best.uid, order.orderId || orderId, order.location);

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
 * autoBatchAssign — the "100x" dispatch core.
 *
 * Instead of one-order-at-a-time assignment, this groups nearby pending orders
 * into route-sequenced multi-stop TRIPS and hands each trip to a single rider,
 * minimising total travel. For grocery (many small orders, short distances),
 * this is the real throughput multiplier: one rider doing N batched drops per
 * trip instead of N separate round-trips.
 *
 * Algorithm (greedy, deterministic, no external solver):
 *   1. Collect pending, unassigned, geocoded orders.
 *   2. Group by origin store so a trip departs from one hub (fallback: cluster
 *      centroid when an order has no store).
 *   3. Build batches by nearest-neighbour chaining from the origin — capping
 *      batch size and the hop between consecutive stops (maxLegKm) so a batch
 *      stays spatially tight and direction-coherent. The chain order *is* the
 *      optimised stop sequence (nearest-next from the hub).
 *   4. Assign each batch to the best available rider near its first stop, one
 *      rider per batch per run.
 *
 * Request data: { orderCollection?, maxBatchSize=6, maxLegKm=3, dryRun=false }
 *   - dryRun: compute and return the plan WITHOUT writing (for admin preview).
 */
exports.autoBatchAssign = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "autoBatchAssign", 10, 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const data = request.data || {};
    const maxBatchSize = Math.min(Math.max(parseInt(data.maxBatchSize, 10) || 6, 1), 12);
    const maxLegKm = Math.min(Math.max(Number(data.maxLegKm) || 3, 0.2), 20);
    const dryRun = data.dryRun === true;

    const mode = await getAppMode();
    const orderCol = data.orderCollection || resolveCol("orders", mode);
    const storeCol = resolveCol("stores", mode);
    const notifCol = resolveCol("notifications", mode);

    // 1. Pending, unassigned, geocoded orders.
    const snap = await db.collection(orderCol).where("status", "==", "Accepted").get();
    const pending = [];
    let skippedNoGeo = 0;
    snap.forEach((d) => {
      const o = d.data();
      if (o.assignedTo) return;
      if (typeof o.lat !== "number" || typeof o.lng !== "number") { skippedNoGeo += 1; return; }
      pending.push({ id: d.id, orderId: o.orderId || d.id, lat: o.lat, lng: o.lng, location: o.location || null, storeId: o.assignedStoreId || null });
    });

    if (pending.length === 0) {
      return { success: true, batches: [], assignedOrders: 0, ridersUsed: 0, unassignedBatches: 0, skippedNoGeo, message: "No unassigned, geocoded orders to batch." };
    }

    // 2. Group by origin store; resolve each origin's coordinates.
    const storeIds = [...new Set(pending.map((o) => o.storeId).filter(Boolean))];
    const storeCoords = {};
    await Promise.all(storeIds.map(async (sid) => {
      const sDoc = await db.collection(storeCol).doc(sid).get();
      if (sDoc.exists) {
        const s = sDoc.data();
        if (typeof s.lat === "number" && typeof s.lng === "number") storeCoords[sid] = { lat: s.lat, lng: s.lng, name: s.name || null };
      }
    }));

    const groups = {};
    for (const o of pending) {
      const key = o.storeId && storeCoords[o.storeId] ? o.storeId : "_none";
      (groups[key] = groups[key] || []).push(o);
    }

    // 3. Build route-sequenced batches per group (nearest-neighbour from origin).
    const plannedBatches = [];
    for (const [key, groupOrders] of Object.entries(groups)) {
      const origin = key !== "_none" && storeCoords[key]
        ? storeCoords[key]
        : { // centroid fallback
            lat: groupOrders.reduce((s, o) => s + o.lat, 0) / groupOrders.length,
            lng: groupOrders.reduce((s, o) => s + o.lng, 0) / groupOrders.length,
            name: null,
          };
      const remaining = [...groupOrders];
      while (remaining.length) {
        const batch = [];
        let cur = { lat: origin.lat, lng: origin.lng };
        while (batch.length < maxBatchSize && remaining.length) {
          let bestIdx = 0;
          let bestD = Infinity;
          for (let i = 0; i < remaining.length; i++) {
            const d = haversineKm(cur.lat, cur.lng, remaining[i].lat, remaining[i].lng);
            if (d < bestD) { bestD = d; bestIdx = i; }
          }
          // Seed stop always joins; later stops only if within the leg cap.
          if (batch.length > 0 && bestD > maxLegKm) break;
          const [stop] = remaining.splice(bestIdx, 1);
          stop.legKm = Math.round(bestD * 10) / 10;
          batch.push(stop);
          cur = { lat: stop.lat, lng: stop.lng };
        }
        plannedBatches.push({ origin, storeId: key === "_none" ? null : key, stops: batch });
      }
    }

    // 4. Assign each batch to the best available rider (one rider per batch/run).
    const usedRiders = new Set();
    const results = [];
    let assignedOrders = 0;
    let unassignedBatches = 0;

    for (const b of plannedBatches) {
      const first = b.stops[0];
      const { best } = await findBestAgent(orderCol, first.lat, first.lng, [...usedRiders]);
      const totalKm = Math.round(b.stops.reduce((s, st) => s + (st.legKm || 0), 0) * 10) / 10;
      const summary = {
        stopCount: b.stops.length,
        totalKm,
        storeName: b.storeId && storeCoords[b.storeId] ? storeCoords[b.storeId].name : null,
        stops: b.stops.map((s, i) => ({ orderId: s.orderId, seq: i + 1, location: s.location, legKm: s.legKm })),
        rider: best ? { uid: best.uid, name: best.name } : null,
        assigned: false,
      };

      if (!best) { unassignedBatches += 1; results.push(summary); continue; }

      if (!dryRun) {
        const batchId = db.collection(orderCol).doc().id;
        const wb = db.batch();
        b.stops.forEach((s, i) => {
          wb.update(db.collection(orderCol).doc(s.id), {
            assignedTo: best.uid,
            assignedToName: best.name,
            assignmentStatus: "pending",
            assignedAt: FieldValue.serverTimestamp(),
            batchId,
            batchSize: b.stops.length,
            batchStopIndex: i,
          });
        });
        await wb.commit();

        // One notification + one push per trip.
        try {
          await db.collection(notifCol).add({
            userId: best.uid,
            type: "delivery_assigned",
            title: `New trip — ${b.stops.length} stops`,
            message: `${b.stops.length} deliveries batched into one route (${totalKm} km).`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (_) { /* ignore */ }
        await sendAssignmentPush(best.uid, `${b.stops.length}-stop trip`, `${totalKm} km route`);
      }

      usedRiders.add(best.uid);
      assignedOrders += b.stops.length; // orders assigned (real run) / would-assign (dry run)
      summary.assigned = !dryRun;
      results.push(summary);
    }

    return {
      success: true,
      dryRun,
      batches: results,
      batchCount: results.length,
      assignedOrders, // in dryRun this is the count that WOULD be assigned
      ridersUsed: usedRiders.size,
      unassignedBatches,
      skippedNoGeo,
    };
  } catch (error) {
    if (error.code) throw error;
    console.error("Error in autoBatchAssign:", error);
    throw new HttpsError("internal", error.message || "Failed to batch-assign.");
  }
});

/**
 * setRiderTier — admin designates a delivery agent as "core" (regular staff,
 * preferred for assignment) or "overflow" (gig/peak riders, used only once
 * core capacity is exhausted). Writes presence/{uid}.tier via the admin SDK
 * (presence rules only allow self-writes, so this must be a server function).
 *
 * Request data: { uid, tier: "core" | "overflow" }
 */
exports.setRiderTier = onCall(async (request) => {
  const caller = await requireAdmin(request);
  const { uid, tier } = request.data || {};
  if (!uid || (tier !== "core" && tier !== "overflow")) {
    throw new HttpsError("invalid-argument", "uid and tier (core|overflow) are required.");
  }
  await db.collection("presence").doc(uid).set({ tier }, { merge: true });
  console.log(`[setRiderTier] ${caller.uid} set rider ${uid} -> ${tier}`);
  return { success: true, tier };
});

/**
 * respondToAssignment — a delivery agent (or admin) accepts or rejects an
 * assigned order.
 *   accept → assignmentStatus = "accepted"
 *   reject → agent removed, added to rejectedBy, admins emailed, and the system
 *            attempts to AUTO-REASSIGN to the next-best agent (excluding anyone
 *            who already rejected). If none available, the order is left
 *            unassigned for the admin to reassign manually.
 *
 * Request data: { orderId, orderCollection?, response: "accept" | "reject" }
 */
exports.respondToAssignment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const { orderId, orderCollection, response } = request.data || {};
  if (!orderId || !["accept", "reject"].includes(response)) {
    throw new HttpsError("invalid-argument", "orderId and response (accept|reject) are required.");
  }

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);
  const orderRef = db.collection(colName).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data();

  const caller = await authorizeAdminOrAssignedAgent(request, order);
  const displayId = order.orderId || orderId;

  // ── Accept ──
  if (response === "accept") {
    await orderRef.update({
      assignmentStatus: "accepted",
      assignmentRespondedAt: FieldValue.serverTimestamp(),
    });
    return { success: true, status: "accepted" };
  }

  // ── Reject ──
  const rejectorName = order.assignedToName || "Delivery agent";
  const rejectedBy = Array.from(new Set([...(order.rejectedBy || []), caller.uid]));

  await orderRef.update({
    assignedTo: FieldValue.delete(),
    assignedToName: FieldValue.delete(),
    assignmentStatus: FieldValue.delete(),
    rejectedBy,
  });

  // Email admins about the rejection
  try {
    const notifyEmails = await getNotificationEmails();
    await getBusinessTagline();
    const html = emailLayout(
      `<div style="padding:28px 24px;">
        <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px;">🚫 Delivery assignment rejected</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 4px;"><strong>${rejectorName}</strong> rejected the delivery for order <strong>#${displayId}</strong>.</p>
        <p style="color:#64748b;font-size:14px;margin:0;">${order.location || ""}</p>
      </div>`,
      `Delivery rejected for order ${displayId}`
    );
    await db.collection("mail").add({
      to: notifyEmails,
      message: { subject: `🚫 Delivery rejected — Order ${displayId}`, html },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("[respondToAssignment] reject email failed:", e.message);
  }

  // Attempt auto-reassign to the next-best agent (excluding rejecters)
  let refLat = order.lat;
  let refLng = order.lng;
  try {
    if (order.assignedStoreId) {
      const storeCol = resolveCol("stores", mode);
      const sd = await db.collection(storeCol).doc(order.assignedStoreId).get();
      if (sd.exists) {
        refLat = sd.data().lat || refLat;
        refLng = sd.data().lng || refLng;
      }
    }
  } catch (_) { /* ignore */ }

  if (refLat && refLng) {
    const { best } = await findBestAgent(colName, refLat, refLng, rejectedBy);
    if (best) {
      await orderRef.update({
        assignedTo: best.uid,
        assignedToName: best.name,
        assignmentStatus: "pending",
        assignedAt: FieldValue.serverTimestamp(),
      });
      try {
        const notifCol = resolveCol("notifications", mode);
        await db.collection(notifCol).add({
          userId: best.uid,
          orderId,
          type: "delivery_assigned",
          title: "New delivery assigned",
          message: `Order #${displayId} — ${order.location || "address on file"}.`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (_) { /* ignore */ }
      await sendAssignmentPush(best.uid, displayId, order.location);
      console.log(`[respondToAssignment] Order ${orderId} reassigned to ${best.name} after rejection by ${caller.uid}`);
      return { success: true, status: "reassigned", assigned: { uid: best.uid, name: best.name, distanceKm: best.distanceKm } };
    }
  }

  console.log(`[respondToAssignment] Order ${orderId} left unassigned after rejection by ${caller.uid}`);
  return { success: true, status: "unassigned" };
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
