const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
// ─── Default SMTP config (fallback if settings/smtp doc doesn't exist) ───
const DEFAULT_SMTP = {
  user: "raju2uraju@gmail.com",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  fromName: "KKR Groceries",
};

initializeApp();
const db = getFirestore();

// ─── Premium Email Template Builder ───
function emailLayout(bodyContent, preheader = "") {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>KKR Groceries</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head><body style="margin:0;padding:0;background:#f1f5f0;font-family:'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f0;padding:24px 8px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#064e3b 0%,#047857 50%,#059669 100%);padding:32px 24px;text-align:center;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;line-height:56px;font-size:28px;margin:0 auto 12px;">🥬</div>
    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">KKR Groceries</div>
    <div style="color:#a7f3d0;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin-top:4px;">Hyderabad B2B Wholesale</div>
  </td></tr></table>
</td></tr>
<!-- Body -->
<tr><td style="background:#ffffff;padding:0;">
  ${bodyContent}
</td></tr>
<!-- Footer -->
<tr><td style="background:#f8faf8;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
  <div style="color:#64748b;font-size:12px;line-height:1.6;">
    <strong style="color:#047857;">KKR Groceries</strong> &mdash; Hyderabad B2B Vegetable Wholesale<br>
    <span style="color:#94a3b8;">This is an automated notification. Please do not reply.</span>
  </div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildItemsTable(cartItems) {
  const hdrStyle = "padding:8px 6px;font-size:11px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #059669;";
  const cellStyle = "padding:10px 6px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;";
  const rows = cartItems.map((item, i) => {
    const imgSrc = item.image || "";
    const hasImg = imgSrc && !imgSrc.startsWith("data:");
    const lineTotal = (item.price * item.qty).toLocaleString("en-IN");
    const imgHtml = hasImg
      ? `<img src="${imgSrc}" alt="${item.name}" width="36" height="36" style="width:36px;height:36px;border-radius:8px;object-fit:cover;display:block;border:1px solid #e2e8f0;" />`
      : `<div style="width:36px;height:36px;border-radius:8px;background:#f1f5f9;text-align:center;line-height:36px;font-size:14px;font-weight:700;color:#cbd5e1;">${item.name.charAt(0)}</div>`;
    const names = [
      `<span style="font-weight:600;color:#1e293b;">${item.name}</span>`,
      item.telugu ? `<span style="color:#94a3b8;font-size:11px;">${item.telugu}</span>` : "",
      item.hindi ? `<span style="color:#b0b8c4;font-size:11px;font-style:italic;">${item.hindi}</span>` : "",
    ].filter(Boolean).join(`<span style="color:#d1d5db;font-size:10px;"> · </span>`);
    return `<tr>
      <td style="${cellStyle}text-align:center;color:#94a3b8;font-size:12px;font-weight:600;" width="28">${i + 1}</td>
      <td style="${cellStyle}" width="42" valign="middle">${imgHtml}</td>
      <td style="${cellStyle}">${names}</td>
      <td style="${cellStyle}text-align:center;font-weight:600;" width="40">${item.qty}</td>
      <td style="${cellStyle}text-align:center;color:#64748b;" width="44">${item.unit}</td>
      <td style="${cellStyle}text-align:right;color:#64748b;" width="52">₹${item.price}</td>
      <td style="${cellStyle}text-align:right;font-weight:700;color:#047857;" width="64">₹${lineTotal}</td>
    </tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <th style="${hdrStyle}text-align:center;" width="28">#</th>
      <th style="${hdrStyle}" width="42"></th>
      <th style="${hdrStyle}text-align:left;">Item</th>
      <th style="${hdrStyle}text-align:center;" width="40">Qty</th>
      <th style="${hdrStyle}text-align:center;" width="44">Unit</th>
      <th style="${hdrStyle}text-align:right;" width="52">Price</th>
      <th style="${hdrStyle}text-align:right;" width="64">Amount</th>
    </tr>
    ${rows}
  </table>`;
}

function buildOrderEmailHtml({ orderId, customerName, phone, shopName, deliveryAddress, lat, lng, cart, totalValue, productCount, variant }) {
  const isBuyer = variant === "buyer";
  const greeting = isBuyer
    ? `<h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 4px;">Thank you, ${customerName}!</h2>
       <p style="color:#64748b;font-size:14px;margin:0;">Your order has been placed successfully and is being reviewed.</p>`
    : `<h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 4px;">New Order Received</h2>
       <p style="color:#64748b;font-size:14px;margin:0;">A new wholesale order has been placed and needs your attention.</p>`;

  const body = `
  <!-- Greeting + Badge -->
  <div style="padding:28px 24px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top">${greeting}</td>
      <td width="100" align="right" valign="top">
        <div style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">⏳ Pending</div>
      </td>
    </tr></table>
  </div>

  <!-- Order ID Bar -->
  <div style="background:#f0fdf4;padding:14px 24px;border-top:1px solid #dcfce7;border-bottom:1px solid #dcfce7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="color:#047857;font-size:12px;font-weight:600;">ORDER ID</span><br><span style="color:#064e3b;font-size:15px;font-weight:700;letter-spacing:0.5px;">${orderId}</span></td>
      <td align="right"><span style="color:#047857;font-size:12px;font-weight:600;">${productCount} ITEMS</span><br><span style="color:#064e3b;font-size:18px;font-weight:800;">${totalValue}</span></td>
    </tr></table>
  </div>

  <!-- Items -->
  <div style="padding:20px 24px 8px;">
    <div style="font-size:13px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Order Items</div>
    ${buildItemsTable(cart)}
  </div>

  <!-- Total -->
  <div style="margin:0 24px;padding:16px 20px;background:linear-gradient(135deg,#064e3b,#047857);border-radius:12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="color:#a7f3d0;font-size:13px;font-weight:600;">Total Amount</span></td>
      <td align="right"><span style="color:#ffffff;font-size:22px;font-weight:800;">${totalValue}</span></td>
    </tr></table>
  </div>

  <!-- Customer & Delivery Details -->
  <div style="padding:20px 24px 28px;">
    <div style="font-size:13px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Delivery Details</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:4px;">
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" width="36" valign="top"><span style="font-size:16px;">👤</span></td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Customer</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${customerName}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top"><span style="font-size:16px;">📱</span></td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Phone</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${phone}</div>
        </td>
      </tr>
      ${shopName && shopName !== "Not specified" ? `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top"><span style="font-size:16px;">🏪</span></td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Shop / Business</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${shopName}</div>
        </td>
      </tr>` : ""}
      ${deliveryAddress ? (() => {
        const mapsUrl = lat && lng
          ? `https://www.google.com/maps?q=${lat},${lng}`
          : `https://www.google.com/maps/search/${encodeURIComponent(deliveryAddress)}`;
        return `<tr>
        <td style="padding:10px 16px;" valign="top"><span style="font-size:16px;">📍</span></td>
        <td style="padding:10px 16px;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Delivery Address</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${deliveryAddress}</div>
          <a href="${mapsUrl}" target="_blank" style="display:inline-block;margin-top:6px;color:#047857;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #047857;padding:4px 10px;border-radius:6px;">📍 Open in Google Maps →</a>
        </td>
      </tr>`;
      })() : ""}
    </table>
  </div>

  ${isBuyer ? `<div style="padding:0 24px 28px;text-align:center;">
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">We'll notify you when your order is accepted and ready for delivery. Thank you for choosing KKR Groceries!</p>
  </div>` : `<div style="padding:0 24px 28px;text-align:center;">
    <a href="https://kkr-groceries-02.web.app/dashboard/admin" style="display:inline-block;background:#047857;color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none;">Open Admin Dashboard →</a>
  </div>`}`;

  return emailLayout(body, `New order ${orderId} — ${productCount} items — ${totalValue}`);
}

function buildStatusEmailHtml({ orderId, customerName, newStatus, cart, totalValue, productCount, statusInfo }) {
  const statusColors = { Accepted: "#2563eb", Fulfilled: "#059669", Rejected: "#dc2626" };
  const statusBg = { Accepted: "#eff6ff", Fulfilled: "#f0fdf4", Rejected: "#fef2f2" };
  const statusEmoji = { Accepted: "✅", Fulfilled: "🚚", Rejected: "❌" };
  const color = statusColors[newStatus] || "#475569";
  const bg = statusBg[newStatus] || "#f8fafc";
  const emoji = statusEmoji[newStatus] || "📦";

  const body = `
  <!-- Status Hero -->
  <div style="padding:32px 24px;text-align:center;">
    <div style="width:64px;height:64px;background:${bg};border-radius:50%;line-height:64px;font-size:28px;margin:0 auto 16px;">${emoji}</div>
    <div style="display:inline-block;background:${color};color:#ffffff;font-size:12px;font-weight:700;padding:5px 16px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">${newStatus}</div>
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:12px 0 8px;">${statusInfo.heading}</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0;max-width:400px;display:inline-block;">${statusInfo.body}</p>
  </div>

  <!-- Order ID Bar -->
  <div style="background:${bg};padding:14px 24px;border-top:1px solid ${color}20;border-bottom:1px solid ${color}20;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="color:${color};font-size:12px;font-weight:600;">ORDER ID</span><br><span style="color:#1e293b;font-size:15px;font-weight:700;">${orderId}</span></td>
      <td align="right"><span style="color:${color};font-size:12px;font-weight:600;">${productCount} ITEMS</span><br><span style="color:#1e293b;font-size:18px;font-weight:800;">${totalValue}</span></td>
    </tr></table>
  </div>

  ${cart && cart.length > 0 ? `
  <!-- Items -->
  <div style="padding:20px 24px 8px;">
    <div style="font-size:13px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Order Items</div>
    ${buildItemsTable(cart)}
  </div>

  <!-- Total -->
  <div style="margin:0 24px 24px;padding:16px 20px;background:linear-gradient(135deg,#064e3b,#047857);border-radius:12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="color:#a7f3d0;font-size:13px;font-weight:600;">Total Amount</span></td>
      <td align="right"><span style="color:#ffffff;font-size:22px;font-weight:800;">${totalValue}</span></td>
    </tr></table>
  </div>` : `
  <div style="padding:0 24px 24px;">
    <div style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center;">
      <span style="color:#475569;font-size:14px;font-weight:600;">${productCount} items &mdash; ${totalValue}</span>
    </div>
  </div>`}

  <div style="padding:0 24px 28px;text-align:center;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">Thank you for choosing KKR Groceries.</p>
  </div>`;

  return emailLayout(body, `Order ${orderId} — ${statusInfo.heading}`);
}

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

// ─── SMTP config: Firestore-backed with in-memory cache ───
let _smtpCache = { config: null, ts: 0 };
const SMTP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSmtpConfig() {
  if (_smtpCache.config && Date.now() - _smtpCache.ts < SMTP_CACHE_TTL) {
    return _smtpCache.config;
  }
  try {
    const snap = await db.collection("settings").doc("smtp").get();
    if (snap.exists) {
      const data = snap.data();
      if (data.user && data.password) {
        const config = {
          user: data.user,
          password: data.password,
          host: data.host || DEFAULT_SMTP.host,
          port: data.port || DEFAULT_SMTP.port,
          secure: data.secure ?? DEFAULT_SMTP.secure,
          fromName: data.fromName || DEFAULT_SMTP.fromName,
        };
        _smtpCache = { config, ts: Date.now() };
        return config;
      }
    }
  } catch (err) {
    console.warn("Failed to read settings/smtp, using fallback:", err.message);
  }
  // Fallback: use hardcoded defaults + env secret
  return {
    ...DEFAULT_SMTP,
    password: process.env.GMAIL_APP_PASSWORD || "",
  };
}

// ─── App Mode: test/real with cached lookup ───
const NAMESPACED_COLLECTIONS = new Set(["orders", "stockPurchases", "accountEntries", "notifications"]);
let _modeCache = { mode: null, ts: 0 };
const MODE_CACHE_TTL = 60_000; // 1 minute

async function getAppMode() {
  if (_modeCache.mode && Date.now() - _modeCache.ts < MODE_CACHE_TTL) {
    return _modeCache.mode;
  }
  try {
    const snap = await db.collection("settings").doc("appMode").get();
    if (snap.exists && snap.data().mode === "real") {
      _modeCache = { mode: "real", ts: Date.now() };
      return "real";
    }
  } catch (e) {
    console.warn("Failed to read appMode, defaulting to test:", e.message);
  }
  _modeCache = { mode: "test", ts: Date.now() };
  return "test";
}

function resolveCol(baseName, mode) {
  if (mode === "test" && NAMESPACED_COLLECTIONS.has(baseName)) {
    return `test_${baseName}`;
  }
  return baseName;
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
    };

    const mode = await getAppMode();
    await db.collection(resolveCol("orders", mode)).doc(orderId).set(orderDoc);

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
          subject: `🛒 New Order: ${orderId} — ${data.totalValue}`,
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
            subject: `✅ Order Confirmed: ${orderId} — ${data.totalValue}`,
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

    // Status-specific messages
    const statusMessages = {
      Accepted: {
        subject: `Order ${displayOrderId} Accepted`,
        heading: "Your order has been accepted!",
        body: `Great news, ${customerName}! Your order has been accepted and is being prepared for delivery.`,
        color: "#2563eb",
      },
      Fulfilled: {
        subject: `Order ${displayOrderId} Fulfilled`,
        heading: "Your order has been fulfilled!",
        body: `Hi ${customerName}, your order has been fulfilled and is on its way. Thank you for choosing KKR Groceries!`,
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
    const statusEmailData = {
      orderId: displayOrderId,
      customerName,
      newStatus,
      cart: order.cart || [],
      totalValue: order.totalValue || "N/A",
      productCount: order.productCount || 0,
      statusInfo,
    };
    const emailHtml = buildStatusEmailHtml(statusEmailData);

    // Queue email to buyer if they have email
    if (buyerEmail) {
      try {
        await db.collection("mail").add({
          to: [buyerEmail],
          message: {
            subject: `${newStatus === "Accepted" ? "✅" : newStatus === "Fulfilled" ? "🚚" : "❌"} ${statusInfo.subject}`,
            html: emailHtml,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
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
          subject: `📋 [Admin] ${statusInfo.subject}`,
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

/**
 * Trigger Email: watches the `mail` collection and sends emails via Gmail SMTP.
 * Documents must have: { to: string[], message: { subject, html } }
 * SMTP config is read from Firestore settings/smtp (admin-configurable).
 */
exports.processMailQueue = onDocumentCreated(
  { document: "mail/{mailId}", secrets: ["GMAIL_APP_PASSWORD"] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const mailDoc = snap.data();
    const { to, message } = mailDoc;

    if (!to || !Array.isArray(to) || to.length === 0 || !message) {
      console.error("Invalid mail document:", snap.id);
      await snap.ref.update({ status: "error", error: "Invalid mail document format" });
      return;
    }

    // Read SMTP config from Firestore (cached, fallback to env/defaults)
    const smtp = await getSmtpConfig();

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    try {
      await transporter.sendMail({
        from: `${smtp.fromName} <${smtp.user}>`,
        to: to.join(", "),
        subject: message.subject,
        html: message.html,
      });

      await snap.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
      });
      console.log(`Email sent to ${to.join(", ")} — subject: ${message.subject}`);
    } catch (err) {
      console.error("Email send failed:", err);
      await snap.ref.update({
        status: "error",
        error: err.message,
        attempts: FieldValue.increment(1),
      });
    }
  }
);

/**
 * Test SMTP configuration by sending a test email.
 * Reads settings/smtp from Firestore and verifies credentials work.
 */
exports.testSmtpConfig = onCall({ secrets: ["GMAIL_APP_PASSWORD"] }, async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "testSmtp", 5, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many test emails. Please wait.");
    }

    const { testEmail } = request.data || {};

    // Read SMTP config from Firestore
    const smtp = await getSmtpConfig();

    if (!smtp.user || !smtp.password) {
      throw new HttpsError("failed-precondition", "SMTP credentials not configured. Save Gmail address and App Password first.");
    }

    const recipient = testEmail || smtp.user;

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });

    await transporter.sendMail({
      from: `${smtp.fromName} <${smtp.user}>`,
      to: recipient,
      subject: "✅ KKR Groceries — SMTP Test Successful",
      html: emailLayout(
        `<div style="padding:28px 24px;text-align:center;">
          <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;line-height:64px;font-size:28px;margin:0 auto 16px;">✅</div>
          <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px;">SMTP Configuration Working!</h2>
          <p style="color:#64748b;font-size:14px;margin:0;">Email notifications are properly configured and operational.</p>
          <div style="margin-top:16px;padding:12px 20px;background:#f8fafc;border-radius:10px;display:inline-block;">
            <span style="color:#94a3b8;font-size:12px;">Sender:</span>
            <span style="color:#047857;font-size:13px;font-weight:600;margin-left:4px;">${smtp.user}</span>
          </div>
        </div>`,
        "SMTP test successful"
      ),
    });

    console.log(`SMTP test email sent to ${recipient} by ${caller.uid}`);
    return { success: true, message: `Test email sent to ${recipient}` };

  } catch (error) {
    console.error("SMTP test failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `SMTP test failed: ${error.message}`);
  }
});
