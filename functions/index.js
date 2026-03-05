const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const { generateInvoicePdf } = require("./invoice");
// ─── Default SMTP config (fallback if settings/smtp doc doesn't exist) ───
const DEFAULT_SMTP = {
  user: "kkr.groceries.hyd@gmail.com",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  fromName: "KKR Groceries",
};

initializeApp();
const db = getFirestore();

// ─── Slab/Tiered Pricing Resolution ───
function resolveSlabPrice(qty, basePrice, priceTiers) {
  if (!priceTiers || !Array.isArray(priceTiers) || priceTiers.length === 0) {
    return basePrice;
  }
  const sorted = [...priceTiers].sort((a, b) => a.minQty - b.minQty);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const tier = sorted[i];
    const maxQty = tier.maxQty === 0 ? Infinity : tier.maxQty;
    if (qty >= tier.minQty && qty <= maxQty) {
      return tier.price;
    }
  }
  return basePrice;
}

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
  const statusColors = { Accepted: "#2563eb", Shipped: "#6366f1", Fulfilled: "#059669", Rejected: "#dc2626" };
  const statusBg = { Accepted: "#eff6ff", Shipped: "#eef2ff", Fulfilled: "#f0fdf4", Rejected: "#fef2f2" };
  const statusEmoji = { Accepted: "✅", Shipped: "🚚", Fulfilled: "📦", Rejected: "❌" };
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
        // Strip spaces from Gmail app passwords (displayed as "xxxx xxxx xxxx xxxx"
        // but must be sent as "xxxxxxxxxxxxxxxx" for SMTP AUTH)
        const config = {
          user: data.user.trim(),
          password: data.password.replace(/\s+/g, ""),
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
    password: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
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

    // Validate MOQ — fetch product definitions and check quantities
    const productsSnap = await db.collection("products").get();
    const productMap = {};
    productsSnap.docs.forEach((doc) => {
      const pData = doc.data();
      productMap[doc.id] = pData;
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
          `${item.name || product.name}: expected ₹${expectedPrice} for qty ${item.qty}, got ₹${item.price}`
        );
      }
    }

    if (priceViolations.length > 0) {
      throw new HttpsError(
        "invalid-argument",
        `Price mismatch: ${priceViolations.join("; ")}`
      );
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
            subject: `${newStatus === "Accepted" ? "✅" : newStatus === "Shipped" ? "🚚" : newStatus === "Fulfilled" ? "📦" : "❌"} ${statusInfo.subject}`,
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
      const mailOptions = {
        from: `${smtp.fromName} <${smtp.user}>`,
        to: to.join(", "),
        subject: message.subject,
        html: message.html,
      };
      // Attach PDF files if present in the mail document
      if (mailDoc.attachments && Array.isArray(mailDoc.attachments)) {
        mailOptions.attachments = mailDoc.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.from(att.content, "base64"),
          contentType: att.contentType || "application/pdf",
        }));
      }
      await transporter.sendMail(mailOptions);

      await snap.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
        smtpUser: smtp.user,
      });
      console.log(`Email sent to ${to.join(", ")} — subject: ${message.subject}${mailOptions.attachments ? ` (${mailOptions.attachments.length} attachment(s))` : ""}`);
    } catch (err) {
      console.error("Email send failed:", err);
      let errorCategory = "unknown";
      if (err.code === "EAUTH") errorCategory = "auth";
      else if (err.code === "ECONNECTION" || err.code === "ESOCKET") errorCategory = "connection";
      else if (err.code === "EENVELOPE") errorCategory = "recipient";
      else if (err.message?.includes("rate")) errorCategory = "rate_limit";

      await snap.ref.update({
        status: "error",
        error: err.message,
        errorCategory,
        processedAt: FieldValue.serverTimestamp(),
        smtpUser: smtp.user,
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

    const { testEmail, recipients } = request.data || {};

    // Read SMTP config from Firestore
    const smtp = await getSmtpConfig();

    console.log(`[SMTP-DEBUG] user="${smtp.user}", passLen=${smtp.password?.length || 0}, host=${smtp.host}, port=${smtp.port}, secure=${smtp.secure}`);

    if (!smtp.user || !smtp.password) {
      throw new HttpsError("failed-precondition", "SMTP credentials not configured. Save Gmail address and App Password first.");
    }

    // Support single testEmail, array of recipients, or default to smtp.user
    const recipientList = recipients && Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : (testEmail ? [testEmail] : [smtp.user]);
    const recipient = recipientList.join(", ");

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

/**
 * Get aggregated email statistics from the mail collection.
 * Returns counts by status + recent failures for the Activity dashboard.
 */
exports.getEmailStats = onCall(async (request) => {
  await requireAdmin(request);

  const mailRef = db.collection("mail");
  const [sentSnap, errorSnap, retriedSnap, totalSnap] = await Promise.all([
    mailRef.where("status", "==", "sent").count().get(),
    mailRef.where("status", "==", "error").count().get(),
    mailRef.where("status", "==", "retried").count().get(),
    mailRef.count().get(),
  ]);

  const total = totalSnap.data().count;
  const sent = sentSnap.data().count;
  const errors = errorSnap.data().count;
  const retried = retriedSnap.data().count;
  const pending = total - sent - errors - retried;

  // Recent failures (last 10)
  const failedSnap = await mailRef
    .where("status", "==", "error")
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const recentFailures = failedSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      to: data.to || [],
      subject: data.message?.subject || "(no subject)",
      error: data.error || "Unknown error",
      errorCategory: data.errorCategory || "unknown",
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      attempts: data.attempts || 1,
    };
  });

  return { total, sent, errors, pending, retried, recentFailures };
});

/**
 * Get paginated email logs from the mail collection.
 * Supports status filtering and cursor-based pagination.
 */
exports.getEmailLogs = onCall(async (request) => {
  await requireAdmin(request);
  const { statusFilter, limit: pageSize = 25, startAfterId } = request.data || {};

  let q = db.collection("mail").orderBy("createdAt", "desc");
  if (statusFilter && statusFilter !== "all") {
    q = q.where("status", "==", statusFilter);
  }
  if (startAfterId) {
    const startDoc = await db.collection("mail").doc(startAfterId).get();
    if (startDoc.exists) q = q.startAfter(startDoc);
  }
  q = q.limit(Math.min(pageSize, 50)); // cap at 50

  const snap = await q.get();
  return {
    logs: snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        to: data.to || [],
        subject: data.message?.subject || "(no subject)",
        status: data.status || "pending",
        error: data.error,
        errorCategory: data.errorCategory,
        smtpUser: data.smtpUser,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        sentAt: data.sentAt?.toDate?.()?.toISOString() || null,
        attempts: data.attempts || 0,
        retriedFrom: data.retriedFrom || null,
      };
    }),
    hasMore: snap.docs.length === Math.min(pageSize, 50),
  };
});

/**
 * Retry a failed email by creating a new mail doc with the same content.
 * Marks original as "retried" and creates fresh doc to trigger processMailQueue.
 */
exports.retryFailedEmail = onCall(async (request) => {
  await requireAdmin(request);
  const { mailId } = request.data || {};
  if (!mailId) throw new HttpsError("invalid-argument", "mailId is required");

  const mailDoc = await db.collection("mail").doc(mailId).get();
  if (!mailDoc.exists) throw new HttpsError("not-found", "Mail document not found");

  const data = mailDoc.data();
  if (data.status !== "error") {
    throw new HttpsError("failed-precondition", "Only failed emails can be retried");
  }

  // Create new mail doc with same content (triggers processMailQueue)
  const newDoc = await db.collection("mail").add({
    to: data.to,
    message: data.message,
    createdAt: FieldValue.serverTimestamp(),
    retriedFrom: mailId,
  });

  // Mark original as retried
  await mailDoc.ref.update({ status: "retried", retriedAs: newDoc.id });

  console.log(`Retried mail ${mailId} as ${newDoc.id}`);
  return { success: true, newMailId: newDoc.id };
});

// ─── GSTIN Verification (Self-Hosted — Direct GST Portal) ──────────────────
/**
 * Verify a GSTIN by querying the official GST portal (services.gst.gov.in).
 * Uses Google Cloud Vision API for captcha solving with retry logic.
 * Results are cached in Firestore (gstin_cache/{gstin}) to avoid repeated lookups.
 * No third-party API keys required — completely free and self-hosted.
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_PORTAL = "https://services.gst.gov.in";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Solve a captcha image using Google Cloud Vision OCR */
async function solveCaptcha(imageBuffer) {
  // Lazy-load vision library to avoid deployment timeout
  const vision = require("@google-cloud/vision");
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.textDetection({
    image: { content: imageBuffer.toString("base64") },
  });
  const text = result.textAnnotations?.[0]?.description || "";
  return text.replace(/[\n\r\s]/g, "").trim();
}

/** Build address string from GST portal address object */
function buildAddress(pradr) {
  if (!pradr) return "";
  // GST portal may return address as a flat string in "adr" or structured object in "addr"
  if (typeof pradr.adr === "string" && pradr.adr.trim()) {
    return pradr.adr.trim();
  }
  if (pradr.addr && typeof pradr.addr === "object") {
    const a = pradr.addr;
    return [a.bno, a.bnm, a.flno, a.st, a.loc, a.dst, a.stcd, a.pncd]
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

/** Query the GST portal with session + captcha flow (single attempt) */
/** HTTP helper using Node.js built-in https (no external dependency) */
function httpsRequest(url, options = {}) {
  const https = require("https");
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };
    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const cookies = (res.headers["set-cookie"] || [])
          .map((c) => c.split(";")[0]);
        resolve({ statusCode: res.statusCode, headers: res.headers, cookies, body });
      });
    });
    req.on("error", reject);
    req.setTimeout(options.timeout || 15000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function queryGSTPortal(gstin) {
  // Step 1: Initialize session — get cookies
  const sessionRes = await httpsRequest(GST_PORTAL + "/services/searchtp", {
    headers: { "User-Agent": UA },
  });
  const sessionCookies = sessionRes.cookies.join("; ");

  // Step 2: Fetch captcha image
  const captchaRes = await httpsRequest(GST_PORTAL + "/services/captcha", {
    headers: { Cookie: sessionCookies, "User-Agent": UA },
  });
  const allCookies = sessionCookies +
    (captchaRes.cookies.length ? "; " + captchaRes.cookies.join("; ") : "");
  const imageBuffer = captchaRes.body;

  // Step 3: Solve captcha with Google Cloud Vision
  const captchaText = await solveCaptcha(imageBuffer);
  if (!captchaText) throw new Error("Empty captcha OCR result");

  // Step 4: Query taxpayer details
  const postBody = JSON.stringify({ gstin, captcha: captchaText });
  const queryRes = await httpsRequest(
    GST_PORTAL + "/services/api/search/taxpayerDetails",
    {
      method: "POST",
      headers: {
        Cookie: allCookies,
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postBody),
        Referer: GST_PORTAL + "/services/searchtp",
      },
      body: postBody,
    }
  );

  let data;
  try {
    data = JSON.parse(queryRes.body.toString("utf8"));
  } catch {
    throw new Error("Invalid response from GST portal");
  }
  // The portal returns taxpayer JSON on success, or an error message string on captcha failure
  if (data && data.gstin) return data;
  throw new Error(typeof data === "string" ? data : data?.error || "Captcha verification failed");
}

exports.verifyGSTIN = onCall({ timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const gstin = (request.data.gstin || "").trim().toUpperCase();

  // 1. Format validation
  if (!gstin || !GSTIN_REGEX.test(gstin)) {
    return {
      valid: false,
      formatValid: false,
      verified: false,
      message: "Invalid GSTIN format. Must be 15 characters (e.g. 22AAAAA0000A1Z5).",
    };
  }

  // 2. Check Firestore cache first
  try {
    const cacheSnap = await db.collection("gstin_cache").doc(gstin).get();
    if (cacheSnap.exists) {
      const cached = cacheSnap.data();
      // Cache is valid for 30 days AND must have entityType (added in v2)
      const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
      if (cacheAge < 30 * 24 * 60 * 60 * 1000 && cached.entityType) {
        console.log(`GSTIN ${gstin}: returning cached result`);
        return { ...cached, fromCache: true };
      }
    }
  } catch (e) {
    console.warn("Cache read error:", e.message);
  }

  // 3. Query GST portal with retry logic (up to 5 attempts)
  const MAX_RETRIES = 5;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`GSTIN ${gstin}: attempt ${attempt}/${MAX_RETRIES}`);
      const data = await queryGSTPortal(gstin);

      // Extract entity type from PAN embedded in GSTIN
      // GSTIN format: 2-digit state + 10-char PAN + 1 entity + 1 Z + 1 check
      // PAN's 4th character (index 3 of PAN = index 5 of GSTIN) indicates entity type
      const panEntityChar = gstin.charAt(5);
      const ENTITY_TYPE_MAP = {
        P: "Proprietorship",
        C: "Company",
        H: "HUF",
        F: "Partnership Firm",
        A: "AOP (Association of Persons)",
        T: "Trust",
        B: "BOI (Body of Individuals)",
        L: "Local Authority",
        J: "Artificial Juridical Person",
        G: "Government",
      };
      const entityType = ENTITY_TYPE_MAP[panEntityChar] || data.ctb || "Other";

      // For Proprietorships, the legal name (lgnm) IS the owner's personal name
      const isProprietorship = panEntityChar === "P";
      const ownerName = isProprietorship ? (data.lgnm || "") : "";

      const result = {
        valid: true,
        formatValid: true,
        verified: true,
        tradeName: data.tradeNam || "",
        legalName: data.lgnm || "",
        entityType,
        ownerName,
        status: data.sts || "",
        businessType: data.ctb || "",
        address: buildAddress(data.pradr),
        registrationDate: data.rgdt || "",
        message: `Verified — ${data.sts || "Unknown status"}`,
        cachedAt: new Date().toISOString(),
      };

      // 4. Cache the result in Firestore
      try {
        await db.collection("gstin_cache").doc(gstin).set(result);
        console.log(`GSTIN ${gstin}: cached successfully`);
      } catch (e) {
        console.warn("Cache write error:", e.message);
      }

      return result;
    } catch (err) {
      lastError = err.message || "Unknown error";
      console.warn(`GSTIN ${gstin}: attempt ${attempt} failed — ${lastError}`);
      // Brief pause before retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // All retries exhausted
  return {
    valid: true,
    formatValid: true,
    verified: false,
    message: `GSTIN format is valid but verification failed after ${MAX_RETRIES} attempts. Please try again. (${lastError})`,
  };
});

// ════════════════════════════════════════════════════════════════════════════
// Delivery OTP — Send & Verify
// ════════════════════════════════════════════════════════════════════════════

/**
 * sendDeliveryOTP — generates a 6-digit OTP, stores it in Firestore,
 * and emails it to the customer.
 */
exports.sendDeliveryOTP = onCall(async (request) => {
  const caller = await requireAdmin(request);
  const { orderId, orderCollection } = request.data;
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId.");

  const mode = await getAppMode();
  const colName = orderCollection || resolveCol("orders", mode);

  const orderSnap = await db.collection(colName).doc(orderId).get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data();

  const buyerEmail = order.userEmail || null;
  if (!buyerEmail) {
    throw new HttpsError("failed-precondition", "Customer has no email on file. Cannot send OTP.");
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP in Firestore
  await db.collection("delivery_otps").doc(orderId).set({
    otp,
    orderId,
    buyerEmail,
    expiresAt: expiresAt.toISOString(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
    verified: false,
    attempts: 0,
  });

  // Build OTP email
  const customerName = order.customerName || "Customer";
  const displayOrderId = order.orderId || orderId;
  const otpEmailHtml = emailLayout(`
    <div style="padding:32px 24px;text-align:center;">
      <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;line-height:64px;font-size:28px;margin:0 auto 16px;">🔐</div>
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

  // Queue email
  await db.collection("mail").add({
    to: [buyerEmail],
    message: {
      subject: `🔐 Delivery OTP for Order ${displayOrderId}`,
      html: otpEmailHtml,
    },
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Delivery OTP sent for ${orderId} to ${buyerEmail} by admin ${caller.uid}`);
  return { success: true, message: `OTP sent to ${buyerEmail}` };
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
