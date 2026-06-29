/**
 * OG Banner Generation — Cloud Functions for KKR Groceries
 *
 * Exports:
 *   generateOgBanner (onCall)   — Admin-only: renders an OG image from a template + content, saves to Storage
 *   serveOgBanner   (onRequest) — Public HTTP: serves the active OG banner image from Storage
 *
 * Uses Sharp for SVG-on-canvas compositing (no headless browser needed).
 * All 15 templates produce a 1200x630 JPEG.
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { getStorage } = require("firebase-admin/storage");
const sharp = require("sharp");
const https = require("https");
const http = require("http");
const { db, FieldValue, requireAdmin, isRateLimited } = require("./utils");

// ─── Constants ───────────────────────────────────────────────────────────────

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const STORAGE_PATH = "og-banner/active.jpg";
const FONT = "'Segoe UI',Arial,Helvetica,sans-serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Split text into lines of approximately `maxChars` characters, breaking at spaces. */
function wrapText(text, maxChars = 40) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Download a URL and return a Buffer. Follows one redirect. */
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        const redirectClient = res.headers.location.startsWith("https") ? https : http;
        redirectClient.get(res.headers.location, { timeout: 10000 }, (res2) => {
          const chunks = [];
          res2.on("data", (c) => chunks.push(c));
          res2.on("end", () => resolve(Buffer.concat(chunks)));
          res2.on("error", reject);
        }).on("error", reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Generate a simple orange-square placeholder logo with "KKR" text. */
async function generatePlaceholderLogo(size = 400) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="40" fill="#F7941D"/>
    <text x="${size / 2}" y="${size / 2 + size * 0.12}" text-anchor="middle"
          font-family="${FONT}" font-size="${size * 0.3}" font-weight="800" fill="#fff">KKR</text>
    <text x="${size / 2}" y="${size / 2 + size * 0.28}" text-anchor="middle"
          font-family="${FONT}" font-size="${size * 0.09}" fill="rgba(255,255,255,0.85)">GROCERIES</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Prepare a logo buffer: download or generate, then resize to fit template. */
async function prepareLogo(customLogoUrl, targetSize = 400) {
  let raw;
  if (customLogoUrl) {
    try {
      raw = await downloadUrl(customLogoUrl);
    } catch (err) {
      console.warn("Failed to download custom logo, using placeholder:", err.message);
      raw = await generatePlaceholderLogo(targetSize);
    }
  } else {
    raw = await generatePlaceholderLogo(targetSize);
  }
  return sharp(raw)
    .resize(targetSize, targetSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** Render description lines as SVG tspan elements. */
function descTspans(desc, x, startY, lineHeight, attrs = "") {
  const lines = wrapText(desc, 40);
  return lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}"${attrs}>${escXml(line)}</tspan>`)
    .join("");
}

/** Build pill-shaped SVG elements for location and delivery. */
function pills(location, delivery, x, y, opts = {}) {
  const {
    bg = "rgba(247,148,29,0.15)",
    fg = "#F7941D",
    stroke = "none",
    fontSize = 18,
    gap = 220,
  } = opts;
  const parts = [];
  if (location) {
    parts.push(
      `<rect x="${x}" y="${y}" width="200" height="38" rx="19" fill="${bg}" ${stroke !== "none" ? `stroke="${stroke}" stroke-width="1.5"` : ""}/>` +
      `<text x="${x + 100}" y="${y + 24}" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" fill="${fg}">${escXml(location)}</text>`
    );
  }
  if (delivery) {
    const dx = location ? x + gap : x;
    parts.push(
      `<rect x="${dx}" y="${y}" width="200" height="38" rx="19" fill="${bg}" ${stroke !== "none" ? `stroke="${stroke}" stroke-width="1.5"` : ""}/>` +
      `<text x="${dx + 100}" y="${y + 24}" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" fill="${fg}">${escXml(delivery)}</text>`
    );
  }
  return parts.join("\n");
}

/** Build a CTA button as SVG. */
function ctaButton(text, x, y, opts = {}) {
  const {
    bg = "#F7941D",
    fg = "#fff",
    width = 220,
    height = 48,
    fontSize = 20,
    rx = 24,
  } = opts;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${bg}"/>
    <text x="${x + width / 2}" y="${y + height / 2 + 7}" text-anchor="middle"
          font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="${fg}">${escXml(text)}</text>
  `;
}


// ─── Template Renderers ──────────────────────────────────────────────────────
// Each template: async (content, logoBuffer) => JPEG Buffer

const TEMPLATES = {

  // ── 1. dark-premium ──────────────────────────────────────────────────────
  "dark-premium": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 38);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a1a2e"/>
          <stop offset="50%" stop-color="#16213e"/>
          <stop offset="100%" stop-color="#0f0f1a"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
      <!-- Glow circles -->
      <circle cx="300" cy="315" r="260" fill="rgba(247,148,29,0.06)"/>
      <circle cx="300" cy="315" r="180" fill="rgba(247,148,29,0.08)"/>
      <circle cx="300" cy="315" r="100" fill="rgba(247,148,29,0.05)"/>
      <!-- Logo card -->
      <rect x="80" y="115" width="400" height="400" rx="24" fill="rgba(255,255,255,0.95)"
            filter="drop-shadow(0 8px 32px rgba(0,0,0,0.3))"/>
      <!-- Right side text -->
      <text x="540" y="140" font-family="${FONT}" font-size="42" font-weight="800" fill="#fff">${escXml(title)}</text>
      <rect x="540" y="158" width="80" height="4" rx="2" fill="#F7941D"/>
      <text x="540" y="200" font-family="${FONT}" font-size="24" font-weight="600" fill="#F7941D">${escXml(subtitle)}</text>
      <text x="540" y="240" font-family="${FONT}" font-size="18" fill="rgba(255,255,255,0.85)">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 26}">${escXml(l)}</tspan>`).join("")}
      </text>
      ${pills(location, delivery, 540, 240 + descLines.length * 26 + 20, { bg: "rgba(247,148,29,0.2)", fg: "#F7941D" })}
      ${ctaButton(cta || "Shop Now", 540, 240 + descLines.length * 26 + 80)}
    </svg>`;

    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 15, g: 15, b: 26, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoBuffer, top: 155, left: 120, gravity: "northwest" },
      ])
      .flatten({ background: { r: 15, g: 15, b: 26 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 2. clean-split ───────────────────────────────────────────────────────
  "clean-split": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 34);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="leftPanel">
          <polygon points="0,0 520,0 460,630 0,630"/>
        </clipPath>
      </defs>
      <!-- White background -->
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#ffffff"/>
      <!-- Orange left panel with diagonal cut -->
      <polygon points="0,0 520,0 460,630 0,630" fill="#F7941D"/>
      <!-- Orange bottom bar -->
      <rect x="0" y="${OG_HEIGHT - 8}" width="${OG_WIDTH}" height="8" fill="#F7941D"/>
      <!-- Right side text -->
      <text x="540" y="120" font-family="${FONT}" font-size="40" font-weight="800" fill="#1a1a2e">${escXml(title)}</text>
      <rect x="540" y="138" width="60" height="4" rx="2" fill="#F7941D"/>
      <text x="540" y="180" font-family="${FONT}" font-size="22" font-weight="600" fill="#F7941D">${escXml(subtitle)}</text>
      <text x="540" y="220" font-family="${FONT}" font-size="17" fill="#555">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      ${pills(location, delivery, 540, 220 + descLines.length * 24 + 16, { bg: "rgba(247,148,29,0.12)", fg: "#F7941D" })}
      ${ctaButton(cta || "Order Now", 540, 220 + descLines.length * 24 + 76)}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(340, 340, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 145, left: 60, gravity: "northwest" },
      ])
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 3. centered-hero ─────────────────────────────────────────────────────
  "centered-hero": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 50);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFF8EE"/>
          <stop offset="100%" stop-color="#FFF0DB"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#cream)"/>
      <!-- Top / bottom orange bars -->
      <rect x="0" y="0" width="${OG_WIDTH}" height="8" fill="#F7941D"/>
      <rect x="0" y="${OG_HEIGHT - 8}" width="${OG_WIDTH}" height="8" fill="#F7941D"/>
      <!-- Title -->
      <text x="600" y="260" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="800" fill="#1a1a2e">${escXml(title)}</text>
      <!-- Subtitle -->
      <text x="600" y="300" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="600" fill="#F7941D">${escXml(subtitle)}</text>
      <!-- Description -->
      <text x="600" y="340" text-anchor="middle" font-family="${FONT}" font-size="17" fill="#555">
        ${descLines.map((l, i) => `<tspan x="600" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- Pills centered -->
      ${pills(location, delivery, 390, 340 + descLines.length * 24 + 10, { bg: "rgba(247,148,29,0.15)", fg: "#F7941D" })}
      <!-- CTA -->
      ${ctaButton(cta || "Shop Fresh", 490, 340 + descLines.length * 24 + 66)}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 255, g: 248, b: 238, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 40, left: 510, gravity: "northwest" },
      ])
      .flatten({ background: { r: 255, g: 248, b: 238 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 4. bold-green ────────────────────────────────────────────────────────
  "bold-green": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 36);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="greenbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#064e3b"/>
          <stop offset="100%" stop-color="#065f46"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#greenbg)"/>
      <!-- Orange top/bottom bars -->
      <rect x="0" y="0" width="${OG_WIDTH}" height="6" fill="#F7941D"/>
      <rect x="0" y="${OG_HEIGHT - 6}" width="${OG_WIDTH}" height="6" fill="#F7941D"/>
      <!-- White card for logo -->
      <rect x="60" y="100" width="420" height="420" rx="20" fill="rgba(255,255,255,0.95)"
            filter="drop-shadow(0 6px 24px rgba(0,0,0,0.25))"/>
      <!-- Right text -->
      <text x="540" y="150" font-family="${FONT}" font-size="40" font-weight="800" fill="#fff">${escXml(title)}</text>
      <rect x="540" y="168" width="70" height="4" rx="2" fill="#F7941D"/>
      <text x="540" y="210" font-family="${FONT}" font-size="22" font-weight="600" fill="#F7941D">${escXml(subtitle)}</text>
      <text x="540" y="250" font-family="${FONT}" font-size="17" fill="rgba(255,255,255,0.85)">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      ${pills(location, delivery, 540, 250 + descLines.length * 24 + 16, { bg: "rgba(247,148,29,0.2)", fg: "#F7941D" })}
      ${ctaButton(cta || "Order Now", 540, 250 + descLines.length * 24 + 76)}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 6, g: 78, b: 59, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 130, left: 90, gravity: "northwest" },
      ])
      .flatten({ background: { r: 6, g: 78, b: 59 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 5. gradient-orange ───────────────────────────────────────────────────
  "gradient-orange": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 36);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="orangebg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF9A2E"/>
          <stop offset="50%" stop-color="#F7941D"/>
          <stop offset="100%" stop-color="#D97B0D"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#orangebg)"/>
      <!-- Frosted card for logo -->
      <rect x="50" y="90" width="440" height="450" rx="24" fill="rgba(255,255,255,0.25)"
            stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <!-- Right text in white -->
      <text x="540" y="150" font-family="${FONT}" font-size="42" font-weight="800" fill="#fff">${escXml(title)}</text>
      <text x="540" y="195" font-family="${FONT}" font-size="22" font-weight="600" fill="rgba(255,255,255,0.9)">${escXml(subtitle)}</text>
      <text x="540" y="235" font-family="${FONT}" font-size="17" fill="rgba(255,255,255,0.85)">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      ${pills(location, delivery, 540, 235 + descLines.length * 24 + 16, { bg: "rgba(255,255,255,0.2)", fg: "#fff", stroke: "rgba(255,255,255,0.5)" })}
      ${ctaButton(cta || "Shop Now", 540, 235 + descLines.length * 24 + 76, { bg: "#fff", fg: "#D97B0D" })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(380, 380, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 247, g: 148, b: 29, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 125, left: 80, gravity: "northwest" },
      ])
      .flatten({ background: { r: 247, g: 148, b: 29 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 6. minimal-white ─────────────────────────────────────────────────────
  "minimal-white": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 60);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#ffffff"/>
      <!-- 4px orange top border -->
      <rect x="0" y="0" width="${OG_WIDTH}" height="4" fill="#F7941D"/>
      <!-- Logo card -->
      <rect x="40" y="30" width="260" height="260" rx="16" fill="#fff"
            stroke="#eee" stroke-width="1" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.06))"/>
      <!-- Title + subtitle top right -->
      <text x="340" y="80" font-family="${FONT}" font-size="34" font-weight="800" fill="#1a1a2e">${escXml(title)}</text>
      <text x="340" y="115" font-family="${FONT}" font-size="20" font-weight="500" fill="#F7941D">${escXml(subtitle)}</text>
      <!-- Divider -->
      <rect x="340" y="135" width="${OG_WIDTH - 390}" height="2" rx="1" fill="#F7941D" opacity="0.3"/>
      <!-- Description below divider -->
      <text x="340" y="170" font-family="${FONT}" font-size="16" fill="#666">
        ${descLines.map((l, i) => `<tspan x="340" dy="${i === 0 ? 0 : 22}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- Location/delivery pills with thin border -->
      ${pills(location, delivery, 340, 170 + descLines.length * 22 + 16, { bg: "#fff", fg: "#888", stroke: "#ddd", fontSize: 16 })}
      <!-- Small orange CTA -->
      ${ctaButton(cta || "Visit Us", 340, 170 + descLines.length * 22 + 72, { width: 160, height: 40, fontSize: 16, rx: 20 })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(220, 220, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 50, left: 60, gravity: "northwest" },
      ])
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 7. duotone ───────────────────────────────────────────────────────────
  "duotone": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 46);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <!-- Left half: dark charcoal -->
      <rect x="0" y="0" width="600" height="${OG_HEIGHT}" fill="#1e1e2e"/>
      <!-- Right half: orange -->
      <rect x="600" y="0" width="600" height="${OG_HEIGHT}" fill="#F7941D"/>
      <!-- Logo circle on dividing line -->
      <circle cx="600" cy="200" r="120" fill="#fff" filter="drop-shadow(0 4px 16px rgba(0,0,0,0.2))"/>
      <!-- Title centered below logo -->
      <text x="600" y="370" text-anchor="middle" font-family="${FONT}" font-size="38" font-weight="800" fill="#fff">${escXml(title)}</text>
      <!-- Subtitle pill -->
      <rect x="420" y="388" width="360" height="36" rx="18" fill="rgba(255,255,255,0.2)"/>
      <text x="600" y="412" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="600" fill="#fff">${escXml(subtitle)}</text>
      <!-- Description -->
      <text x="600" y="450" text-anchor="middle" font-family="${FONT}" font-size="16" fill="rgba(255,255,255,0.85)">
        ${descLines.map((l, i) => `<tspan x="600" dy="${i === 0 ? 0 : 22}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- Pills at bottom -->
      ${pills(location, delivery, 340, 450 + descLines.length * 22 + 10, { bg: "rgba(255,255,255,0.15)", fg: "#fff", gap: 240 })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 30, g: 30, b: 46, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 110, left: 510, gravity: "northwest" },
      ])
      .flatten({ background: { r: 30, g: 30, b: 46 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 8. editorial ─────────────────────────────────────────────────────────
  "editorial": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery } = content;
    const descLines = wrapText(description, 55);
    // Large spaced uppercase title
    const spacedTitle = (title || "").toUpperCase().split("").join(" ");
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#FAF7F2"/>
      <!-- Double-line border inset 20px -->
      <rect x="20" y="20" width="${OG_WIDTH - 40}" height="${OG_HEIGHT - 40}" rx="0" fill="none" stroke="#1a1a2e" stroke-width="2"/>
      <rect x="26" y="26" width="${OG_WIDTH - 52}" height="${OG_HEIGHT - 52}" rx="0" fill="none" stroke="#1a1a2e" stroke-width="0.5"/>
      <!-- Large spaced uppercase title -->
      <text x="600" y="90" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="700"
            letter-spacing="6" fill="#1a1a2e">${escXml(spacedTitle.substring(0, 60))}</text>
      <!-- Thin rule -->
      <rect x="200" y="108" width="800" height="1" fill="#1a1a2e" opacity="0.3"/>
      <!-- Subtitle -->
      <text x="600" y="140" text-anchor="middle" font-family="${FONT}" font-size="18" fill="#F7941D" font-style="italic">${escXml(subtitle)}</text>
      <!-- Description below logo area -->
      <text x="600" y="440" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#555">
        ${descLines.map((l, i) => `<tspan x="600" dy="${i === 0 ? 0 : 22}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- Location/delivery at bottom -->
      <text x="400" y="${OG_HEIGHT - 50}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#888">${escXml(location || "")}</text>
      <text x="800" y="${OG_HEIGHT - 50}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#888">${escXml(delivery || "")}</text>
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(260, 260, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 250, g: 247, b: 242, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 155, left: 470, gravity: "northwest" },
      ])
      .flatten({ background: { r: 250, g: 247, b: 242 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 9. bold-type ─────────────────────────────────────────────────────────
  "bold-type": async (content, logoBuffer) => {
    const { title, subtitle, description, cta } = content;
    const descLines = wrapText(description, 34);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#FF8C00"/>
      <!-- Large watermark KKR -->
      <text x="600" y="420" text-anchor="middle" font-family="${FONT}" font-size="300" font-weight="900"
            fill="rgba(255,255,255,0.06)">KKR</text>
      <!-- Logo card left -->
      <rect x="50" y="80" width="380" height="380" rx="24" fill="rgba(255,255,255,0.95)"
            filter="drop-shadow(0 6px 24px rgba(0,0,0,0.15))"/>
      <!-- Right: large title -->
      <text x="480" y="160" font-family="${FONT}" font-size="52" font-weight="900" fill="#fff">${escXml(title)}</text>
      <text x="480" y="200" font-family="${FONT}" font-size="22" font-weight="500" fill="rgba(255,255,255,0.9)">${escXml(subtitle)}</text>
      <!-- Description -->
      <text x="480" y="245" font-family="${FONT}" font-size="17" fill="rgba(255,255,255,0.85)">
        ${descLines.map((l, i) => `<tspan x="480" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- White CTA bar at bottom -->
      <rect x="0" y="${OG_HEIGHT - 60}" width="${OG_WIDTH}" height="60" fill="rgba(255,255,255,0.95)"/>
      <text x="600" y="${OG_HEIGHT - 24}" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="#FF8C00">${escXml(cta || "Shop Fresh Wholesale")}</text>
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(340, 340, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 255, g: 140, b: 0, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 100, left: 70, gravity: "northwest" },
      ])
      .flatten({ background: { r: 255, g: 140, b: 0 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 10. neon-glow ────────────────────────────────────────────────────────
  "neon-glow": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 36);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#0a0a0f"/>
      <!-- Concentric glow circles behind logo area -->
      <circle cx="270" cy="310" r="300" fill="rgba(247,148,29,0.03)"/>
      <circle cx="270" cy="310" r="230" fill="rgba(247,148,29,0.05)"/>
      <circle cx="270" cy="310" r="170" fill="rgba(247,148,29,0.07)"/>
      <circle cx="270" cy="310" r="110" fill="rgba(247,148,29,0.04)"/>
      <circle cx="270" cy="310" r="60" fill="rgba(247,148,29,0.03)"/>
      <!-- Logo white card -->
      <rect x="60" y="100" width="420" height="420" rx="20" fill="rgba(255,255,255,0.95)"
            filter="drop-shadow(0 0 40px rgba(247,148,29,0.3))"/>
      <!-- Title -->
      <text x="540" y="150" font-family="${FONT}" font-size="40" font-weight="800" fill="#fff">${escXml(title)}</text>
      <!-- Neon accent line -->
      <rect x="540" y="168" width="120" height="3" rx="1.5" fill="#F7941D"
            filter="drop-shadow(0 0 8px rgba(247,148,29,0.8))"/>
      <text x="540" y="210" font-family="${FONT}" font-size="20" font-weight="600" fill="#F7941D">${escXml(subtitle)}</text>
      <!-- Description -->
      <text x="540" y="250" font-family="${FONT}" font-size="17" fill="rgba(255,255,255,0.8)">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- Orange-bordered pills -->
      ${pills(location, delivery, 540, 250 + descLines.length * 24 + 16, { bg: "transparent", fg: "#F7941D", stroke: "#F7941D" })}
      <!-- Orange CTA -->
      ${ctaButton(cta || "Shop Now", 540, 250 + descLines.length * 24 + 76)}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 130, left: 90, gravity: "northwest" },
      ])
      .flatten({ background: { r: 10, g: 10, b: 15 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 11. geometric ────────────────────────────────────────────────────────
  "geometric": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 34);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#F7941D"/>
      <!-- Geometric pattern: triangles and hexagons at 8% white opacity -->
      <polygon points="100,50 150,130 50,130" fill="rgba(255,255,255,0.08)"/>
      <polygon points="1050,30 1120,90 1080,170 1010,170 970,90" fill="rgba(255,255,255,0.08)"/>
      <polygon points="200,500 260,580 140,580" fill="rgba(255,255,255,0.08)"/>
      <polygon points="900,450 980,450 1020,520 980,590 900,590 860,520" fill="rgba(255,255,255,0.08)"/>
      <polygon points="50,300 100,250 150,300 100,350" fill="rgba(255,255,255,0.06)"/>
      <polygon points="1100,250 1170,300 1100,350" fill="rgba(255,255,255,0.06)"/>
      <polygon points="600,10 640,70 560,70" fill="rgba(255,255,255,0.05)"/>
      <polygon points="700,560 760,600 700,630 640,600" fill="rgba(255,255,255,0.05)"/>
      <!-- White centered card -->
      <rect x="70" y="75" width="1060" height="480" rx="20" fill="rgba(255,255,255,0.96)"
            filter="drop-shadow(0 8px 32px rgba(0,0,0,0.12))"/>
      <!-- Inside card: logo left, text right -->
      <text x="540" y="155" font-family="${FONT}" font-size="38" font-weight="800" fill="#F7941D">${escXml(title)}</text>
      <text x="540" y="195" font-family="${FONT}" font-size="20" font-weight="600" fill="#1a1a2e">${escXml(subtitle)}</text>
      <rect x="540" y="210" width="60" height="3" rx="1.5" fill="#F7941D"/>
      <text x="540" y="245" font-family="${FONT}" font-size="16" fill="#555">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 22}">${escXml(l)}</tspan>`).join("")}
      </text>
      ${pills(location, delivery, 540, 245 + descLines.length * 22 + 12, { bg: "rgba(247,148,29,0.1)", fg: "#F7941D" })}
      ${ctaButton(cta || "Order Now", 540, 245 + descLines.length * 22 + 68, { bg: "#F7941D", fg: "#fff" })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 247, g: 148, b: 29, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 135, left: 100, gravity: "northwest" },
      ])
      .flatten({ background: { r: 247, g: 148, b: 29 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 12. gradient-mesh ────────────────────────────────────────────────────
  "gradient-mesh": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 34);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mesh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F7941D"/>
          <stop offset="50%" stop-color="#FF6B6B"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#mesh)"/>
      <!-- White centered card -->
      <rect x="70" y="75" width="1060" height="480" rx="24" fill="rgba(255,255,255,0.92)"
            filter="drop-shadow(0 8px 32px rgba(0,0,0,0.15))"/>
      <!-- Logo on left side of card, text on right -->
      <text x="520" y="155" font-family="${FONT}" font-size="38" font-weight="800" fill="#1a1a2e">${escXml(title)}</text>
      <text x="520" y="195" font-family="${FONT}" font-size="20" font-weight="600" fill="#7C3AED">${escXml(subtitle)}</text>
      <rect x="520" y="210" width="60" height="3" rx="1.5" fill="#F7941D"/>
      <text x="520" y="245" font-family="${FONT}" font-size="16" fill="#555">
        ${descLines.map((l, i) => `<tspan x="520" dy="${i === 0 ? 0 : 22}">${escXml(l)}</tspan>`).join("")}
      </text>
      ${pills(location, delivery, 520, 245 + descLines.length * 22 + 12, { bg: "rgba(124,58,237,0.1)", fg: "#7C3AED" })}
      ${ctaButton(cta || "Shop Now", 520, 245 + descLines.length * 22 + 68, { bg: "linear-gradient(#F7941D,#7C3AED)" })}
      <!-- Fallback CTA since SVG linear gradient in fill needs a def -->
      <rect x="520" y="${245 + descLines.length * 22 + 68}" width="220" height="48" rx="24" fill="#7C3AED"/>
      <text x="${520 + 110}" y="${245 + descLines.length * 22 + 68 + 31}" text-anchor="middle"
            font-family="${FONT}" font-size="20" font-weight="700" fill="#fff">${escXml(cta || "Shop Now")}</text>
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(340, 340, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 247, g: 148, b: 29, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 145, left: 100, gravity: "northwest" },
      ])
      .flatten({ background: { r: 247, g: 148, b: 29 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 13. vintage-stamp ────────────────────────────────────────────────────
  "vintage-stamp": async (content, logoBuffer) => {
    const { title, subtitle, description, cta } = content;
    const descLines = wrapText(description, 50);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#F5E6D0"/>
      <!-- Large circle outline -->
      <circle cx="600" cy="260" r="250" fill="none" stroke="#F7941D" stroke-width="3"/>
      <circle cx="600" cy="260" r="242" fill="none" stroke="#F7941D" stroke-width="0.5" opacity="0.4"/>
      <!-- Title below logo inside circle -->
      <text x="600" y="380" text-anchor="middle" font-family="${FONT}" font-size="32" font-weight="800" fill="#1a1a2e">${escXml(title)}</text>
      <!-- Subtitle outside circle below -->
      <text x="600" y="535" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="600" fill="#F7941D">${escXml(subtitle)}</text>
      <!-- Description at bottom -->
      <text x="600" y="565" text-anchor="middle" font-family="${FONT}" font-size="15" fill="#888">
        ${descLines.map((l, i) => `<tspan x="600" dy="${i === 0 ? 0 : 20}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- CTA at very bottom -->
      ${ctaButton(cta || "Visit Us", 490, 565 + descLines.length * 20 + 5, { width: 220, height: 40, fontSize: 18, rx: 20 })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(260, 260, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 245, g: 230, b: 208, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 70, left: 470, gravity: "northwest" },
      ])
      .flatten({ background: { r: 245, g: 230, b: 208 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 14. corporate-blue ───────────────────────────────────────────────────
  "corporate-blue": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 36);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bluebg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e3a5f"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bluebg)"/>
      <!-- White logo card left -->
      <rect x="60" y="100" width="420" height="420" rx="16" fill="rgba(255,255,255,0.95)"
            filter="drop-shadow(0 6px 24px rgba(0,0,0,0.2))"/>
      <!-- Right: white title -->
      <text x="540" y="150" font-family="${FONT}" font-size="40" font-weight="800" fill="#fff">${escXml(title)}</text>
      <!-- Light blue line -->
      <rect x="540" y="168" width="80" height="3" rx="1.5" fill="#93c5fd"/>
      <!-- White subtitle -->
      <text x="540" y="210" font-family="${FONT}" font-size="22" font-weight="600" fill="rgba(255,255,255,0.9)">${escXml(subtitle)}</text>
      <!-- White description -->
      <text x="540" y="250" font-family="${FONT}" font-size="17" fill="rgba(255,255,255,0.8)">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- Blue-white pills with semi-transparent bg -->
      ${pills(location, delivery, 540, 250 + descLines.length * 24 + 16, { bg: "rgba(255,255,255,0.15)", fg: "#fff", stroke: "rgba(255,255,255,0.3)" })}
      <!-- White CTA button with blue text -->
      ${ctaButton(cta || "Learn More", 540, 250 + descLines.length * 24 + 76, { bg: "#fff", fg: "#1e3a5f" })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 30, g: 58, b: 95, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 130, left: 90, gravity: "northwest" },
      ])
      .flatten({ background: { r: 30, g: 58, b: 95 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },

  // ── 15. fresh-market ─────────────────────────────────────────────────────
  "fresh-market": async (content, logoBuffer) => {
    const { title, subtitle, description, location, delivery, cta } = content;
    const descLines = wrapText(description, 36);
    const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="greenfresh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#065f46"/>
          <stop offset="50%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#greenfresh)"/>
      <!-- Decorative leaf shapes in lighter green -->
      <path d="M80,50 Q120,10 160,50 Q120,90 80,50 Z" fill="rgba(134,239,172,0.15)"/>
      <path d="M1040,80 Q1080,40 1120,80 Q1080,120 1040,80 Z" fill="rgba(134,239,172,0.12)"/>
      <path d="M150,520 Q200,470 250,520 Q200,570 150,520 Z" fill="rgba(134,239,172,0.1)"/>
      <path d="M950,500 Q1010,440 1070,500 Q1010,560 950,500 Z" fill="rgba(134,239,172,0.12)"/>
      <path d="M50,280 Q90,240 130,280 Q90,320 50,280 Z" fill="rgba(134,239,172,0.08)"/>
      <path d="M1100,300 Q1140,260 1180,300 Q1140,340 1100,300 Z" fill="rgba(134,239,172,0.08)"/>
      <!-- White frosted card for logo -->
      <rect x="50" y="90" width="440" height="450" rx="24" fill="rgba(255,255,255,0.2)"
            stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <!-- Right: white title -->
      <text x="540" y="150" font-family="${FONT}" font-size="42" font-weight="800" fill="#fff">${escXml(title)}</text>
      <!-- Green-white line -->
      <rect x="540" y="168" width="80" height="3" rx="1.5" fill="rgba(255,255,255,0.6)"/>
      <!-- Light green subtitle -->
      <text x="540" y="210" font-family="${FONT}" font-size="22" font-weight="600" fill="#86efac">${escXml(subtitle)}</text>
      <!-- White description -->
      <text x="540" y="250" font-family="${FONT}" font-size="17" fill="rgba(255,255,255,0.85)">
        ${descLines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : 24}">${escXml(l)}</tspan>`).join("")}
      </text>
      <!-- White pills -->
      ${pills(location, delivery, 540, 250 + descLines.length * 24 + 16, { bg: "rgba(255,255,255,0.15)", fg: "#fff", stroke: "rgba(255,255,255,0.3)" })}
      <!-- Green CTA with white text -->
      ${ctaButton(cta || "Shop Fresh", 540, 250 + descLines.length * 24 + 76, { bg: "#fff", fg: "#065f46" })}
    </svg>`;

    const logoResized = await sharp(logoBuffer).resize(380, 380, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const base = sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 6, g: 95, b: 70, alpha: 1 } } });
    return base
      .composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: logoResized, top: 125, left: 80, gravity: "northwest" },
      ])
      .flatten({ background: { r: 6, g: 95, b: 70 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  },
};


// ─── Cloud Functions ─────────────────────────────────────────────────────────

/**
 * generateOgBanner (onCall)
 * Admin-only. Renders an OG banner image from a template and content, saves to Storage.
 */
exports.generateOgBanner = onCall(
  { region: "asia-south1", memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    // 1. Validate admin
    await requireAdmin(request);

    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Not authenticated");

    // Rate limit: 20 calls per 5 minutes
    if (await isRateLimited(uid, "generateOgBanner", 20, 5 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { templateId, content, customLogoUrl } = request.data || {};

    // 2. Validate input
    if (!templateId || !TEMPLATES[templateId]) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid templateId. Must be one of: ${Object.keys(TEMPLATES).join(", ")}`
      );
    }
    if (!content || typeof content !== "object") {
      throw new HttpsError("invalid-argument", "content object is required");
    }
    if (!content.title) {
      throw new HttpsError("invalid-argument", "content.title is required");
    }

    // Sanitise content with defaults
    const sanitised = {
      title: String(content.title || "").substring(0, 80),
      subtitle: String(content.subtitle || "").substring(0, 100),
      description: String(content.description || "").substring(0, 300),
      location: String(content.location || "").substring(0, 40),
      delivery: String(content.delivery || "").substring(0, 40),
      cta: String(content.cta || "").substring(0, 30),
      ctaUrl: String(content.ctaUrl || "").substring(0, 200),
    };

    try {
      // 3. Prepare logo
      const logoBuffer = await prepareLogo(customLogoUrl, 460);

      // 4. Render template
      const renderer = TEMPLATES[templateId];
      const jpegBuffer = await renderer(sanitised, logoBuffer);

      // 5. Save to Storage
      const bucket = getStorage().bucket();
      const file = bucket.file(STORAGE_PATH);
      await file.save(jpegBuffer, {
        metadata: {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=3600",
          metadata: {
            templateId,
            generatedAt: new Date().toISOString(),
            generatedBy: uid,
          },
        },
      });

      // Make the file publicly readable
      await file.makePublic();
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${STORAGE_PATH}`;

      // 6. Update Firestore settings
      await db.doc("settings/ogBanner").set(
        {
          imageUrl,
          templateId,
          content: sanitised,
          customLogoUrl: customLogoUrl || null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        },
        { merge: true }
      );

      console.log(`OG banner generated: template=${templateId}, url=${imageUrl}`);
      return { success: true, imageUrl };
    } catch (err) {
      console.error("Error generating OG banner:", err);
      throw new HttpsError("internal", `Failed to generate OG banner: ${err.message}`);
    }
  }
);

/**
 * serveOgBanner (onRequest)
 * Public HTTP endpoint. Serves the active OG banner image from Storage.
 * Falls back to a simple orange placeholder if no banner has been generated.
 */
exports.serveOgBanner = onRequest(
  { region: "asia-south1", memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    // CORS headers for broad access
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Max-Age", "3600");
      res.status(204).send("");
      return;
    }

    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(STORAGE_PATH);

      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=3600");
        res.status(200).send(buffer);
      } else {
        // Generate a simple 1200x630 orange placeholder
        const placeholderSvg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="plbg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FF9A2E"/>
              <stop offset="100%" stop-color="#F7941D"/>
            </linearGradient>
          </defs>
          <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#plbg)"/>
          <text x="600" y="280" text-anchor="middle" font-family="${FONT}" font-size="72" font-weight="900" fill="#fff">KKR</text>
          <text x="600" y="340" text-anchor="middle" font-family="${FONT}" font-size="28" fill="rgba(255,255,255,0.9)">GROCERIES</text>
          <text x="600" y="400" text-anchor="middle" font-family="${FONT}" font-size="20" fill="rgba(255,255,255,0.7)">Wholesale Fresh Vegetables — Hyderabad</text>
        </svg>`;

        const placeholderBuffer = await sharp(Buffer.from(placeholderSvg))
          .jpeg({ quality: 85 })
          .toBuffer();

        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=300");
        res.status(200).send(placeholderBuffer);
      }
    } catch (err) {
      console.error("Error serving OG banner:", err);

      // Last-resort: return a minimal placeholder
      try {
        const fallbackSvg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#F7941D"/>
          <text x="600" y="330" text-anchor="middle" font-family="${FONT}" font-size="64" font-weight="900" fill="#fff">KKR GROCERIES</text>
        </svg>`;
        const fallback = await sharp(Buffer.from(fallbackSvg)).jpeg({ quality: 80 }).toBuffer();
        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=60");
        res.status(200).send(fallback);
      } catch (innerErr) {
        res.status(500).send("Internal server error");
      }
    }
  }
);
