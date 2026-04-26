/**
 * Shared utilities for KKR Groceries Cloud Functions.
 * All modules import from this file for common helpers, DB access, and caches.
 */
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");

// ─── Sentry — lazy init so a missing DSN doesn't slow function discovery ───
let _sentryReady = false;
function getSentry() {
  if (_sentryReady) {
    // eslint-disable-next-line global-require
    return require("@sentry/node");
  }
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    _sentryReady = true; // mark as "tried" so we don't re-check every call
    return null;
  }
  // eslint-disable-next-line global-require
  const Sentry = require("@sentry/node");
  Sentry.init({
    dsn,
    environment: process.env.FUNCTIONS_EMULATOR ? "emulator" : "production",
    tracesSampleRate: 0.05, // 5% — keep cost low for high-volume callable functions
    sendDefaultPii: false,
  });
  _sentryReady = true;
  return Sentry;
}

/**
 * Wraps a Cloud Function handler so any thrown error is captured to Sentry
 * before being re-thrown. Preserves the original error so the existing
 * HttpsError flow continues to work for the client.
 *
 * Usage:
 *   exports.myFn = onCall(withSentry("myFn", async (request) => { ... }));
 */
function withSentry(fnName, handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      const Sentry = getSentry();
      if (Sentry) {
        Sentry.withScope((scope) => {
          scope.setTag("function", fnName);
          if (request?.auth?.uid) scope.setUser({ id: request.auth.uid });
          if (request?.data) scope.setContext("requestData", safeData(request.data));
          Sentry.captureException(err);
        });
        // Best-effort flush so the event reaches Sentry before the function exits.
        try { await Sentry.flush(2000); } catch { /* ignore */ }
      }
      throw err;
    }
  };
}

/** Strip large fields from request data before sending to Sentry. */
function safeData(data) {
  if (!data || typeof data !== "object") return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 200)}…[${v.length} chars]`;
    } else if (typeof v === "object" && v !== null) {
      out[k] = "[object]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

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

// Try to get storage, but don't fail if it's not configured
let storage;
try {
  storage = getStorage();
} catch (e) {
  console.warn("Storage not initialized:", e.message);
}

// ─── Product catalog cache (5-min TTL) ───
let _productCache = null;
let _productCacheTime = 0;
const PRODUCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedProducts() {
  if (_productCache && Date.now() - _productCacheTime < PRODUCT_CACHE_TTL) {
    return _productCache;
  }
  const snap = await db.collection("products").get();
  _productCache = {};
  snap.docs.forEach(d => { _productCache[d.id] = d.data(); });
  _productCacheTime = Date.now();
  return _productCache;
}

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

// ─── Haversine Distance (km) ───
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Store Scoring Helper (shared by submitOrder + assignOrderToStore) ───
/**
 * Score and rank stores for an order based on proximity and inventory fulfillment.
 *
 * @param {Object} opts
 * @param {Array}  opts.stores          - Active store objects with { id, name, lat, lng, ... }
 * @param {Object} opts.invMap          - { storeId: { productId: { currentQty, ... } } }
 * @param {Object} opts.nameToProductId - { lowercaseName: productId }
 * @param {Array}  opts.cart            - Order cart items [{ id, name, qty, unit, ... }]
 * @param {number|null} opts.orderLat   - Order delivery latitude (nullable)
 * @param {number|null} opts.orderLng   - Order delivery longitude (nullable)
 *
 * @returns {Array} Sorted array of { store, storeId, storeName, distanceKm, fulfillmentPercent,
 *                  tier, availableItems, missingItems } — best first.
 */
function scoreStoresForOrder({ stores, invMap, nameToProductId, cart, orderLat, orderLng }) {
  const TIER_LIMITS = [5, 10, 20, Infinity]; // km

  const getTier = (dist) => {
    if (dist === null) return TIER_LIMITS.length; // no-GPS stores last
    for (let i = 0; i < TIER_LIMITS.length; i++) {
      if (dist <= TIER_LIMITS[i]) return i;
    }
    return TIER_LIMITS.length;
  };

  const results = stores.map((store) => {
    // ── Distance ──
    let distanceKm = null;
    if (orderLat && orderLng && store.lat && store.lng) {
      distanceKm = haversineKm(orderLat, orderLng, store.lat, store.lng);
    }

    // ── Inventory fulfillment ──
    const storeInv = invMap[store.id] || {};
    const availableItems = [];
    const missingItems = [];

    cart.forEach((item) => {
      let productId = item.id != null ? String(item.id) : null;
      if (!productId && item.name) {
        productId = nameToProductId[item.name.toLowerCase()] || null;
      }

      const invItem = productId ? storeInv[productId] : null;
      const availableQty = invItem ? invItem.currentQty : 0;
      const requestedQty = item.qty || 0;

      if (availableQty >= requestedQty) {
        availableItems.push({
          productName: item.name,
          productId: productId || "",
          requestedQty,
          availableQty,
          unit: item.unit || "",
        });
      } else {
        missingItems.push({
          productName: item.name,
          productId: productId || "",
          requestedQty,
          availableQty,
          shortfall: requestedQty - availableQty,
          unit: item.unit || "",
        });
      }
    });

    const fulfillmentPercent = cart.length > 0 ? availableItems.length / cart.length : 0;
    const tier = getTier(distanceKm);

    return {
      store,
      storeId: store.id,
      storeName: store.name || "",
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
      fulfillmentPercent,
      tier,
      availableItems,
      missingItems,
    };
  });

  // ── Hyper-local rule: any store within 2 km wins outright ──
  const hyperLocal = results
    .filter((r) => r.distanceKm !== null && r.distanceKm <= 2)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (hyperLocal.length > 0) {
    // Put the hyper-local store first, then append the rest sorted normally
    const rest = results
      .filter((r) => !(r.distanceKm !== null && r.distanceKm <= 2))
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        if (b.fulfillmentPercent !== a.fulfillmentPercent) return b.fulfillmentPercent - a.fulfillmentPercent;
        return (a.distanceKm || 999) - (b.distanceKm || 999);
      });
    return [...hyperLocal, ...rest];
  }

  // ── Standard sort: tier → fulfillment → distance ──
  results.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.fulfillmentPercent !== a.fulfillmentPercent) return b.fulfillmentPercent - a.fulfillmentPercent;
    return (a.distanceKm || 999) - (b.distanceKm || 999);
  });

  return results;
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
const NAMESPACED_COLLECTIONS = new Set(["orders", "stockPurchases", "accountEntries", "notifications", "stores", "storeInventory", "stockTransactions", "deliveryTracking"]);
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
    <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;line-height:56px;font-size:28px;margin:0 auto 12px;">\u{1F96C}</div>
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
    ].filter(Boolean).join(`<span style="color:#d1d5db;font-size:10px;"> \u00B7 </span>`);
    return `<tr>
      <td style="${cellStyle}text-align:center;color:#94a3b8;font-size:12px;font-weight:600;" width="28">${i + 1}</td>
      <td style="${cellStyle}" width="42" valign="middle">${imgHtml}</td>
      <td style="${cellStyle}">${names}</td>
      <td style="${cellStyle}text-align:center;font-weight:600;" width="40">${item.qty}</td>
      <td style="${cellStyle}text-align:center;color:#64748b;" width="44">${item.unit}</td>
      <td style="${cellStyle}text-align:right;color:#64748b;" width="52">\u20B9${item.price}</td>
      <td style="${cellStyle}text-align:right;font-weight:700;color:#047857;" width="64">\u20B9${lineTotal}</td>
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
        <div style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">\u23F3 Pending</div>
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
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" width="36" valign="top"><span style="font-size:16px;">\u{1F464}</span></td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Customer</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${customerName}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top"><span style="font-size:16px;">\u{1F4F1}</span></td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Phone</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${phone}</div>
        </td>
      </tr>
      ${shopName && shopName !== "Not specified" ? `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top"><span style="font-size:16px;">\u{1F3EA}</span></td>
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
        <td style="padding:10px 16px;" valign="top"><span style="font-size:16px;">\u{1F4CD}</span></td>
        <td style="padding:10px 16px;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Delivery Address</div>
          <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${deliveryAddress}</div>
          <a href="${mapsUrl}" target="_blank" style="display:inline-block;margin-top:6px;color:#047857;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #047857;padding:4px 10px;border-radius:6px;">\u{1F4CD} Open in Google Maps \u2192</a>
        </td>
      </tr>`;
      })() : ""}
    </table>
  </div>

  ${isBuyer ? `<div style="padding:0 24px 28px;text-align:center;">
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">We'll notify you when your order is accepted and ready for delivery. Thank you for choosing KKR Groceries!</p>
  </div>` : `<div style="padding:0 24px 28px;text-align:center;">
    <a href="https://kkr-groceries-02.web.app/dashboard/admin" style="display:inline-block;background:#047857;color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none;">Open Admin Dashboard \u2192</a>
  </div>`}`;

  return emailLayout(body, `New order ${orderId} \u2014 ${productCount} items \u2014 ${totalValue}`);
}

function buildStatusEmailHtml({ orderId, customerName, newStatus, cart, totalValue, productCount, statusInfo }) {
  const statusColors = { Accepted: "#2563eb", Shipped: "#6366f1", Fulfilled: "#059669", Rejected: "#dc2626" };
  const statusBg = { Accepted: "#eff6ff", Shipped: "#eef2ff", Fulfilled: "#f0fdf4", Rejected: "#fef2f2" };
  const statusEmoji = { Accepted: "\u2705", Shipped: "\u{1F69A}", Fulfilled: "\u{1F4E6}", Rejected: "\u274C" };
  const color = statusColors[newStatus] || "#475569";
  const bg = statusBg[newStatus] || "#f8fafc";
  const emoji = statusEmoji[newStatus] || "\u{1F4E6}";

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

  return emailLayout(body, `Order ${orderId} \u2014 ${statusInfo.heading}`);
}

module.exports = {
  // Firebase instances
  db,
  FieldValue,
  getAuth,
  storage,
  // Caches & lookups
  getCachedProducts,
  resolveSlabPrice,
  // Geo & scoring
  haversineKm,
  scoreStoresForOrder,
  // Collection namespace
  NAMESPACED_COLLECTIONS,
  resolveCol,
  getAppMode,
  // Rate limiting
  isRateLimited,
  // Auth helpers
  requireAuth,
  requireAdmin,
  // Admin emails
  getAdminEmails,
  getNotificationEmails,
  // SMTP
  getSmtpConfig,
  DEFAULT_SMTP,
  // Email templates
  emailLayout,
  buildItemsTable,
  buildOrderEmailHtml,
  buildStatusEmailHtml,
  // Observability
  withSentry,
};
