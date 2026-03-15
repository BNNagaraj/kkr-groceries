/**
 * Inventory/stock Cloud Functions.
 * - recordStockTransaction
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  db, FieldValue, getAuth,
  resolveCol, getAppMode,
  isRateLimited,
  getAdminEmails, getNotificationEmails,
  emailLayout,
} = require("./utils");

/**
 * Record a stock transaction and atomically update store inventory.
 * Callable by admin or agent (for their own store).
 * Types: receipt, dispatch, sale, transfer_in, transfer_out, adjustment
 */
exports.recordStockTransaction = onCall(async (request) => {
  try {
    const authData = request.auth;
    if (!authData) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const claims = authData.token || {};
    const isAdmin = claims.admin === true;
    const isAgent = claims.agent === true;
    const agentStoreId = claims.agentStoreId || null;

    if (!isAdmin && !isAgent) {
      throw new HttpsError("permission-denied", "Must be admin or agent.");
    }

    if (await isRateLimited(authData.uid, "recordStockTransaction", 60, 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const {
      storeId, storeName, productId, productName,
      type, qty, unit, buyerName, buyerPhone,
      counterpartStoreId, counterpartStoreName,
      supplier, costPrice, notes,
    } = request.data;

    // Validate required fields
    if (!storeId || !productId || !productName || !type || !qty || !unit) {
      throw new HttpsError("invalid-argument", "Missing required fields: storeId, productId, productName, type, qty, unit.");
    }

    // Agents can only modify their own store
    if (!isAdmin && isAgent && storeId !== agentStoreId) {
      throw new HttpsError("permission-denied", "Agents can only manage their own store inventory.");
    }

    // Transfers are admin-only
    if ((type === "transfer_in" || type === "transfer_out") && !isAdmin) {
      throw new HttpsError("permission-denied", "Only admins can perform stock transfers.");
    }

    if ((type === "transfer_out") && !counterpartStoreId) {
      throw new HttpsError("invalid-argument", "counterpartStoreId required for transfers.");
    }

    const mode = await getAppMode();
    const invCol = resolveCol("storeInventory", mode);
    const txnCol = resolveCol("stockTransactions", mode);

    const callerName = authData.token.name || authData.token.email || authData.uid;

    // Determine qty delta for inventory
    const addTypes = new Set(["receipt", "transfer_in", "adjustment"]);
    const subTypes = new Set(["dispatch", "sale", "transfer_out"]);
    let delta = 0;
    if (addTypes.has(type)) delta = Math.abs(qty);
    else if (subTypes.has(type)) delta = -Math.abs(qty);

    const invDocId = `${storeId}_${productId}`;

    // Capture values from inside the transaction for post-commit low-stock check
    let finalQty = 0;
    let finalReorderLevel = 0;

    await db.runTransaction(async (txn) => {
      // ── ALL READS FIRST (Firestore requirement) ──
      const invRef = db.collection(invCol).doc(invDocId);
      const invSnap = await txn.get(invRef);

      // Pre-read counterpart inventory for transfers
      let counterInvRef = null;
      let counterSnap = null;
      if (type === "transfer_out" && counterpartStoreId) {
        const counterInvDocId = `${counterpartStoreId}_${productId}`;
        counterInvRef = db.collection(invCol).doc(counterInvDocId);
        counterSnap = await txn.get(counterInvRef);
      }

      // ── PROCESS & VALIDATE ──
      let currentQty = 0;
      if (invSnap.exists) {
        currentQty = invSnap.data().currentQty || 0;
      }

      const newQty = currentQty + delta;
      if (newQty < 0 && type !== "adjustment") {
        throw new HttpsError("failed-precondition", `Insufficient stock. Available: ${currentQty}, requested: ${Math.abs(qty)}`);
      }

      // Capture for post-commit low-stock check
      finalQty = newQty;
      finalReorderLevel = invSnap.exists ? (invSnap.data().reorderLevel || 0) : 0;

      // ── ALL WRITES ──
      // Upsert inventory doc
      txn.set(invRef, {
        storeId,
        storeName: storeName || "",
        productId,
        productName,
        currentQty: newQty,
        unit,
        reorderLevel: invSnap.exists ? (invSnap.data().reorderLevel || 0) : 0,
        costPrice: costPrice || (invSnap.exists ? (invSnap.data().costPrice || 0) : 0),
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // Write transaction record
      const txnRef = db.collection(txnCol).doc();
      txn.set(txnRef, {
        storeId,
        storeName: storeName || "",
        productId,
        productName,
        type,
        qty: Math.abs(qty),
        unit,
        buyerName: buyerName || null,
        buyerPhone: buyerPhone || null,
        counterpartStoreId: counterpartStoreId || null,
        counterpartStoreName: counterpartStoreName || null,
        supplier: supplier || null,
        costPrice: costPrice || null,
        notes: notes || null,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: authData.uid,
        createdByName: callerName,
      });

      // For transfer_out, also update counterpart store (reads already done above)
      if (type === "transfer_out" && counterpartStoreId && counterInvRef) {
        const counterQty = counterSnap.exists ? (counterSnap.data().currentQty || 0) : 0;

        txn.set(counterInvRef, {
          storeId: counterpartStoreId,
          storeName: counterpartStoreName || "",
          productId,
          productName,
          currentQty: counterQty + Math.abs(qty),
          unit,
          reorderLevel: counterSnap.exists ? (counterSnap.data().reorderLevel || 0) : 0,
          costPrice: costPrice || (counterSnap.exists ? (counterSnap.data().costPrice || 0) : 0),
          lastUpdated: FieldValue.serverTimestamp(),
        });

        // Mirror transaction for counterpart store
        const mirrorTxnRef = db.collection(txnCol).doc();
        txn.set(mirrorTxnRef, {
          storeId: counterpartStoreId,
          storeName: counterpartStoreName || "",
          productId,
          productName,
          type: "transfer_in",
          qty: Math.abs(qty),
          unit,
          counterpartStoreId: storeId,
          counterpartStoreName: storeName || "",
          supplier: null,
          costPrice: costPrice || null,
          notes: notes ? `Transfer from ${storeName}: ${notes}` : `Transfer from ${storeName}`,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: authData.uid,
          createdByName: callerName,
        });
      }
    });

    // ── Low stock notification (email + in-app) ──
    if (finalReorderLevel > 0 && finalQty <= finalReorderLevel && finalQty >= 0) {
      try {
        // Check cooldown: only alert once per hour per item per store
        const invDoc = await db.collection(invCol).doc(invDocId).get();
        const lastAlert = invDoc.exists && invDoc.data().lastAlertSentAt;
        const cooldownMs = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        const canAlert = !lastAlert || (now - lastAlert.toMillis()) > cooldownMs;

        if (canAlert) {
          // Update cooldown timestamp
          await db.collection(invCol).doc(invDocId).update({
            lastAlertSentAt: FieldValue.serverTimestamp(),
          });

          const alertSubject = `\u26A0\uFE0F Low Stock: ${productName} at ${storeName || storeId}`;
          const alertBody = emailLayout(`
            <div style="padding:24px;">
              <div style="text-align:center;margin-bottom:16px;">
                <div style="display:inline-block;width:48px;height:48px;background:#fef3c7;border-radius:12px;line-height:48px;font-size:24px;">\u26A0\uFE0F</div>
              </div>
              <h2 style="color:#92400e;font-size:18px;font-weight:700;text-align:center;margin:0 0 16px;">Low Stock Alert</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;font-weight:600;">Product</td>
                  <td style="padding:10px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;font-weight:700;">${productName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;font-weight:600;">Store</td>
                  <td style="padding:10px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${storeName || storeId}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;font-weight:600;">Current Qty</td>
                  <td style="padding:10px 12px;font-size:15px;color:#dc2626;border-bottom:1px solid #f1f5f9;font-weight:700;">${finalQty} ${unit}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#64748b;font-weight:600;">Reorder Level</td>
                  <td style="padding:10px 12px;font-size:13px;color:#f59e0b;font-weight:700;">${finalReorderLevel} ${unit}</td>
                </tr>
              </table>
              <div style="text-align:center;margin-top:20px;">
                <a href="https://kkr-groceries-02.web.app/dashboard/admin" style="display:inline-block;background:#059669;color:#ffffff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View Inventory</a>
              </div>
              <div style="text-align:center;margin-top:12px;font-size:11px;color:#94a3b8;">
                Triggered by: ${type} of ${Math.abs(qty)} ${unit} by ${callerName}
              </div>
            </div>
          `, `Low stock: ${productName} at ${storeName} \u2014 only ${finalQty} ${unit} remaining`);

          // Queue email
          const notifyEmails = await getNotificationEmails();
          await db.collection("mail").add({
            to: notifyEmails,
            message: {
              subject: alertSubject,
              html: alertBody,
            },
            createdAt: FieldValue.serverTimestamp(),
          });

          // In-app notification for admins
          const notifCol = resolveCol("notifications", mode);
          const adminEmails = await getAdminEmails();
          // Look up admin UIDs from Auth
          for (const email of adminEmails) {
            try {
              const adminUser = await getAuth().getUserByEmail(email);
              await db.collection(notifCol).add({
                userId: adminUser.uid,
                title: "Low Stock Alert",
                body: `${productName} at ${storeName || storeId}: ${finalQty} ${unit} (reorder: ${finalReorderLevel})`,
                type: "low_stock",
                storeId,
                productId,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              });
            } catch (lookupErr) {
              console.warn(`Could not create notification for ${email}:`, lookupErr.message);
            }
          }

          console.log(`Low stock alert sent: ${productName} at ${storeName} \u2014 ${finalQty}/${finalReorderLevel} ${unit}`);
        }
      } catch (alertErr) {
        // Don't fail the transaction for alert errors
        console.error("Low stock alert failed (non-fatal):", alertErr);
      }
    }

    return { success: true, message: `Stock ${type} recorded successfully.` };
  } catch (error) {
    console.error("Error in recordStockTransaction:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to record stock transaction"
    );
  }
});
