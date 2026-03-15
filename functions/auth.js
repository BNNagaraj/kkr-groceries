/**
 * Auth/claims Cloud Functions.
 * - setAdminClaim
 * - setDeliveryClaim
 * - setAgentClaim
 * - listRegisteredUsers
 * - getUserClaims
 * - updateUserStatus
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  db, FieldValue, getAuth,
  resolveCol, getAppMode,
  isRateLimited, requireAdmin,
} = require("./utils");

/**
 * Set admin claim for a user
 * Only callable by existing admins (using email verification)
 */
exports.setAdminClaim = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "setAdminClaim", 10, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { email, admin = true } = request.data;

    if (!email) {
      throw new HttpsError('invalid-argument', 'Email is required.');
    }

    // Get user by email
    let user;
    try {
      user = await getAuth().getUserByEmail(email);
    } catch (userError) {
      throw new HttpsError('not-found', `User with email ${email} not found.`);
    }

    // Merge with existing claims so we don't wipe delivery (or other) claims
    const existingClaims = user.customClaims || {};
    await getAuth().setCustomUserClaims(user.uid, { ...existingClaims, admin });

    console.log(`Admin claim set for user ${email} (${user.uid}): admin=${admin}`);

    return {
      success: true,
      message: `Admin claim ${admin ? 'set' : 'removed'} for ${email}`,
      uid: user.uid
    };

  } catch (error) {
    console.error('Error in setAdminClaim:', error);
    throw new HttpsError(
      error.code || 'internal',
      error.message || 'Failed to set admin claim'
    );
  }
});

/**
 * Set or remove the "delivery" custom claim on a user (admin-only).
 * Uses UID instead of email because delivery boys may be phone-only.
 */
exports.setDeliveryClaim = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "setDeliveryClaim", 10, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { uid, delivery = true } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "User UID is required.");
    }

    let user;
    try {
      user = await getAuth().getUser(uid);
    } catch (userError) {
      throw new HttpsError("not-found", `User with UID ${uid} not found.`);
    }

    // Merge with existing claims so we don't wipe admin (or other) claims
    const existingClaims = user.customClaims || {};
    await getAuth().setCustomUserClaims(user.uid, { ...existingClaims, delivery });

    console.log(`Delivery claim set for user ${user.displayName || user.uid}: delivery=${delivery}`);

    return {
      success: true,
      message: `Delivery role ${delivery ? "granted" : "revoked"} for ${user.displayName || user.uid}`,
      uid: user.uid,
    };
  } catch (error) {
    console.error("Error in setDeliveryClaim:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to set delivery claim"
    );
  }
});

/**
 * Set or remove the "agent" custom claim + agentStoreId on a user (admin-only).
 */
exports.setAgentClaim = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "setAgentClaim", 10, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { uid, agent = true, storeId = null } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "User UID is required.");
    }
    if (agent && !storeId) {
      throw new HttpsError("invalid-argument", "storeId is required when granting agent role.");
    }

    // Validate store exists
    if (agent && storeId) {
      const storeSnap = await db.collection(resolveCol("stores", await getAppMode())).doc(storeId).get();
      if (!storeSnap.exists) {
        throw new HttpsError("not-found", `Store ${storeId} does not exist.`);
      }
    }

    let user;
    try {
      user = await getAuth().getUser(uid);
    } catch (userError) {
      throw new HttpsError("not-found", `User with UID ${uid} not found.`);
    }

    const existingClaims = user.customClaims || {};

    if (agent) {
      await getAuth().setCustomUserClaims(user.uid, { ...existingClaims, agent: true, agentStoreId: storeId });
    } else {
      // Remove agent claims
      const { agent: _a, agentStoreId: _s, ...rest } = existingClaims;
      await getAuth().setCustomUserClaims(user.uid, rest);
    }

    console.log(`Agent claim set for user ${user.displayName || user.uid}: agent=${agent}, storeId=${storeId}`);

    return {
      success: true,
      message: `Agent role ${agent ? "granted" : "revoked"} for ${user.displayName || user.uid}`,
      uid: user.uid,
    };
  } catch (error) {
    console.error("Error in setAgentClaim:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to set agent claim"
    );
  }
});

/**
 * List all registered Firebase Auth users (admin-only)
 */
exports.listRegisteredUsers = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "listUsers", 10, 5 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { pageToken, pageSize = 100 } = request.data || {};
    const listResult = await getAuth().listUsers(Math.min(pageSize, 500), pageToken || undefined);

    // Fetch order counts per user
    const listMode = await getAppMode();
    const ordersSnap = await db.collection(resolveCol("orders", listMode)).get();
    const orderCounts = {};
    const orderTotals = {};
    ordersSnap.docs.forEach((d) => {
      const data = d.data();
      const uid = data.userId || "anonymous";
      orderCounts[uid] = (orderCounts[uid] || 0) + 1;
      const total = typeof data.totalValue === "number"
        ? data.totalValue
        : parseInt((data.totalValue || "0").replace(/[^0-9]/g, ""), 10);
      orderTotals[uid] = (orderTotals[uid] || 0) + total;
    });

    return {
      users: listResult.users.map((u) => ({
        uid: u.uid,
        email: u.email || null,
        phone: u.phoneNumber || null,
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        createdAt: u.metadata.creationTime || null,
        lastSignIn: u.metadata.lastSignInTime || null,
        disabled: u.disabled,
        isAdmin: u.customClaims?.admin === true,
        isDelivery: u.customClaims?.delivery === true,
        isAgent: u.customClaims?.agent === true,
        agentStoreId: u.customClaims?.agentStoreId || null,
        orderCount: orderCounts[u.uid] || 0,
        totalSpent: orderTotals[u.uid] || 0,
      })),
      nextPageToken: listResult.pageToken || null,
    };
  } catch (error) {
    console.error("Error in listRegisteredUsers:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to list users"
    );
  }
});

/**
 * Get user claims (for debugging)
 */
exports.getUserClaims = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "getUserClaims", 20, 5 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { email } = request.data;

    if (!email) {
      throw new HttpsError('invalid-argument', 'Email is required.');
    }

    const user = await getAuth().getUserByEmail(email);

    return {
      email: user.email,
      uid: user.uid,
      customClaims: user.customClaims || {},
      isAdmin: user.customClaims?.admin === true
    };

  } catch (error) {
    console.error('Error in getUserClaims:', error);
    throw new HttpsError(
      error.code || 'internal',
      error.message || 'Failed to get user claims'
    );
  }
});

/**
 * Enable or disable a user account (admin-only)
 */
exports.updateUserStatus = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "updateUserStatus", 20, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { uid, disabled } = request.data;
    if (!uid || typeof disabled !== "boolean") {
      throw new HttpsError("invalid-argument", "Missing uid or disabled flag.");
    }

    // Prevent admin from disabling themselves
    if (uid === caller.uid) {
      throw new HttpsError("failed-precondition", "Cannot disable your own account.");
    }

    await getAuth().updateUser(uid, { disabled });

    console.log(`User ${uid} ${disabled ? "disabled" : "enabled"} by ${caller.uid}`);

    return {
      success: true,
      message: `User ${disabled ? "disabled" : "enabled"} successfully.`,
    };
  } catch (error) {
    console.error("Error in updateUserStatus:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to update user status"
    );
  }
});
