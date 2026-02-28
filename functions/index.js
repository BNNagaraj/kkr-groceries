const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
const db = getFirestore();

// ─── Admin emails: Firestore-backed with in-memory cache ───
const FALLBACK_ADMINS = ["raju2uraju@gmail.com", "kanthati.chakri@gmail.com"];
let _adminCache = { emails: null, notificationEmails: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAdminEmails() {
  if (_adminCache.emails && Date.now() - _adminCache.ts < CACHE_TTL) {
    return _adminCache.emails;
  }
  try {
    const snap = await db.collection("settings").doc("admins").get();
    if (snap.exists && Array.isArray(snap.data().emails) && snap.data().emails.length > 0) {
      _adminCache.emails = snap.data().emails.map((e) => e.toLowerCase());
      _adminCache.notificationEmails = snap.data().notificationEmails || _adminCache.emails;
      _adminCache.ts = Date.now();
      return _adminCache.emails;
    }
  } catch (err) {
    console.warn("Failed to read settings/admins, using fallback:", err.message);
  }
  return FALLBACK_ADMINS;
}

async function getNotificationEmails() {
  if (_adminCache.notificationEmails && Date.now() - _adminCache.ts < CACHE_TTL) {
    return _adminCache.notificationEmails;
  }
  await getAdminEmails(); // populates cache
  return _adminCache.notificationEmails || FALLBACK_ADMINS;
}

// ─── Rate limiter (Firestore-based) ───
async function isRateLimited(userId, action, maxCalls, windowMs) {
  const docRef = db.collection("_rateLimits").doc(`${userId}_${action}`);
  try {
    const snap = await docRef.get();
    const now = Date.now();
    if (snap.exists) {
      const data = snap.data();
      if (now - data.windowStart < windowMs) {
        if (data.count >= maxCalls) return true;
        await docRef.update({ count: FieldValue.increment(1) });
        return false;
      }
    }
    // New window
    await docRef.set({ windowStart: now, count: 1 });
    return false;
  } catch (err) {
    console.warn("Rate limit check failed, allowing:", err.message);
    return false; // fail open
  }
}

// ─── Auth helpers ───
function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth;
}

async function requireAdmin(request) {
  const caller = requireAuth(request);
  const email = caller.token?.email?.toLowerCase();
  if (caller.token?.admin === true) return caller;
  const admins = await getAdminEmails();
  if (email && admins.includes(email)) return caller;
  throw new HttpsError("permission-denied", "Admin access required.");
}

// Try to get storage, but don't fail if it's not configured
let storage;
try {
  storage = getStorage();
} catch (e) {
  console.warn("Storage not initialized:", e.message);
}

/**
 * Upload product image to Storage
 * Falls back to base64 storage in Firestore if Storage bucket doesn't exist
 */
exports.uploadProductImage = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "uploadImage", 30, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many uploads. Try again later.");
    }

    const data = request.data;
    if (!data || !data.productId || !data.base64Image) {
      throw new HttpsError("invalid-argument", "Missing productId or base64Image.");
    }

    const { productId, base64Image } = data;
    
    // Validate base64 image size (max 1MB for base64, ~750KB actual)
    const base64Size = base64Image.length * 0.75; // Approximate bytes
    if (base64Size > 1024 * 1024) {
      throw new HttpsError("invalid-argument", "Image too large. Maximum size is 1MB.");
    }

    // Try Storage first, fall back to base64 in Firestore
    let imageUrl;
    let storageAvailable = false;
    
    if (storage) {
      try {
        const bucket = storage.bucket();
        // Test if bucket exists by trying to get metadata
        await bucket.getMetadata();
        storageAvailable = true;
      } catch (bucketError) {
        console.warn("Storage bucket not available:", bucketError.message);
        storageAvailable = false;
      }
    }

    if (storageAvailable) {
      // Upload to Storage
      try {
        const bucket = storage.bucket();
        const filePath = `products/${productId}-${Date.now()}.jpg`;
        const file = bucket.file(filePath);

        // Decode base64
        const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");

        // Upload to Storage
        await file.save(buffer, {
          metadata: { contentType: "image/jpeg" },
          public: true,
        });

        // Construct Public URL
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        
        console.log(`Image uploaded to Storage: ${imageUrl}`);
      } catch (storageError) {
        console.error("Storage upload failed:", storageError);
        // Fall back to base64
        imageUrl = base64Image;
        console.log("Falling back to base64 storage");
      }
    } else {
      // Store as base64 in Firestore directly
      imageUrl = base64Image;
      console.log("Storage not available, using base64 storage");
    }

    // Update Firestore
    await db.collection("products").doc(productId.toString()).update({ 
      image: imageUrl,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      url: imageUrl,
      storageType: storageAvailable ? 'storage' : 'base64'
    };
    
  } catch (error) {
    console.error("Error in uploadProductImage:", error);
    throw new HttpsError(
      error.code || "internal", 
      error.message || "Upload failed"
    );
  }
});

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

    const orderId = `ORD-${Date.now()}`;
    const orderDoc = {
      id: orderId,
      orderId: orderId,
      userId: request.auth ? request.auth.uid : "anonymous",
      customerName: data.customerName,
      phone: data.customerPhone,
      shopName: data.shopName || "Not specified",
      location: data.deliveryAddress || null,
      cart: data.cart,
      orderSummary: data.orderSummary || "",
      productCount: data.productCount || 0,
      totalValue: data.totalValue,
      timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      createdAt: FieldValue.serverTimestamp(),
      status: "Pending",
      source: "Cloud Function",
    };

    await db.collection("orders").doc(orderId).set(orderDoc);

    // Prepare Email Notification HTML
    let itemsHtml = "";
    data.cart.forEach((item) => {
      itemsHtml += `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.qty} ${item.unit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${(item.price * item.qty).toLocaleString("en-IN")}</td>
      </tr>`;
    });

    const emailHtml = `
      <h2>New Wholesale Order: ${orderId}</h2>
      <p><strong>Customer:</strong> ${data.customerName}</p>
      <p><strong>Phone:</strong> ${data.customerPhone}</p>
      <p><strong>Shop/Business:</strong> ${data.shopName || "N/A"}</p>
      <p><strong>Delivery Location:</strong> ${data.deliveryAddress || "N/A"}</p>
      <br>
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px;">Item</th>
            <th style="padding: 8px;">Quantity</th>
            <th style="padding: 8px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <h3 style="margin-top: 20px;">Total Value: ${data.totalValue}</h3>
      <p style="color: #666; font-size: 0.9em;">Log into the KKR Groceries Admin Dashboard to accept or fulfill this order.</p>
    `;

    // Queue Email Notification
    try {
      const notifyEmails = await getNotificationEmails();
      await db.collection("mail").add({
        to: notifyEmails,
        message: {
          subject: `New Order: ${orderId} - ₹${data.totalValue}`,
          html: emailHtml,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (emailError) {
      console.error("Email queue failed:", emailError);
      // Don't fail the order if email fails
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

    // Set custom claim
    await getAuth().setCustomUserClaims(user.uid, { admin });
    
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
