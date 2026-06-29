import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const outDir = path.join(publicDir, "og-templates");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const W = 1200, H = 630;
const FONT = `font-family="'Segoe UI',Arial,Helvetica,sans-serif"`;

async function makeLogo(size) {
  return sharp(path.join(publicDir, "logo-white.png"))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function render(name, bg, composites) {
  await sharp({
    create: { width: W, height: H, channels: 4, background: bg },
  })
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(path.join(outDir, `${name}.jpg`));
  console.log(`  ${name}.jpg`);
}

function svg(w, h, content) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
  );
}

// ─── 1. dark-premium ───
async function darkPremium() {
  const logo = await makeLogo(440);
  await render("dark-premium", { r: 26, g: 26, b: 46, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a1a2e"/>
            <stop offset="50%" stop-color="#16213e"/>
            <stop offset="100%" stop-color="#0f0f1a"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#g1)"/>
        <circle cx="270" cy="315" r="300" fill="rgba(247,148,29,0.08)"/>
        <circle cx="270" cy="315" r="200" fill="rgba(247,148,29,0.06)"/>
        <circle cx="270" cy="315" r="120" fill="rgba(247,148,29,0.05)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(470, 490, `
        <rect x="5" y="5" width="460" height="480" rx="24" fill="white"/>
      `), top: 70, left: 35,
    },
    { input: logo, top: 95, left: 50 },
    {
      input: svg(600, 500, `
        <text x="300" y="70" text-anchor="middle" ${FONT} font-weight="900" font-size="54" fill="white" letter-spacing="-1">KKR Groceries</text>
        <rect x="80" y="95" width="440" height="3" rx="2" fill="#F7941D"/>
        <text x="300" y="150" text-anchor="middle" ${FONT} font-weight="600" font-size="24" fill="#F7941D" letter-spacing="3">B2B WHOLESALE VEGETABLES</text>
        <text x="300" y="205" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.7)">Fresh vegetables at APMC wholesale prices</text>
        <text x="300" y="235" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.7)">for hotels, restaurants</text>
        <text x="300" y="265" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.7)">&amp; retailers in Hyderabad</text>
        <rect x="40" y="295" width="230" height="44" rx="22" fill="rgba(247,148,29,0.15)" stroke="#F7941D" stroke-width="1.5"/>
        <text x="155" y="324" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#F7941D">📍 Hyderabad, Telangana</text>
        <rect x="290" y="295" width="270" height="44" rx="22" fill="rgba(247,148,29,0.15)" stroke="#F7941D" stroke-width="1.5"/>
        <text x="425" y="324" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#F7941D">🚛 Same-day Delivery</text>
        <rect x="60" y="370" width="480" height="52" rx="26" fill="#F7941D"/>
        <text x="300" y="404" text-anchor="middle" ${FONT} font-weight="800" font-size="20" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 75, left: 570,
    },
  ]);
}

// ─── 2. clean-split ───
async function cleanSplit() {
  const logo = await makeLogo(400);
  await render("clean-split", { r: 255, g: 255, b: 255, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="white"/>
        <rect x="0" y="0" width="520" height="${H}" fill="#F7941D"/>
        <defs><linearGradient id="sh" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(0,0,0,0.05)"/></linearGradient></defs>
        <rect x="0" y="0" width="520" height="${H}" fill="url(#sh)"/>
        <polygon points="460,0 560,0 520,630 420,630" fill="white"/>
        <rect x="0" y="600" width="${W}" height="30" fill="#F7941D"/>
        <rect x="0" y="600" width="520" height="30" fill="#E07B0D"/>
      `), top: 0, left: 0,
    },
    { input: logo, top: 115, left: 40 },
    {
      input: svg(620, 520, `
        <text x="310" y="80" text-anchor="middle" ${FONT} font-weight="900" font-size="56" fill="#1a1a2e" letter-spacing="-1">KKR Groceries</text>
        <rect x="110" y="105" width="400" height="4" rx="2" fill="#F7941D"/>
        <text x="310" y="160" text-anchor="middle" ${FONT} font-weight="700" font-size="26" fill="#F7941D" letter-spacing="1">B2B WHOLESALE VEGETABLES</text>
        <text x="310" y="215" text-anchor="middle" ${FONT} font-size="21" fill="#64748b">Fresh vegetables at APMC wholesale prices</text>
        <text x="310" y="247" text-anchor="middle" ${FONT} font-size="21" fill="#64748b">for hotels, restaurants</text>
        <text x="310" y="279" text-anchor="middle" ${FONT} font-size="21" fill="#64748b">&amp; retailers in Hyderabad</text>
        <rect x="30" y="315" width="260" height="46" rx="23" fill="#FFF7ED" stroke="#F7941D" stroke-width="1.5"/>
        <text x="160" y="345" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="#E07B0D">📍 Hyderabad, Telangana</text>
        <rect x="310" y="315" width="270" height="46" rx="23" fill="#FFF7ED" stroke="#F7941D" stroke-width="1.5"/>
        <text x="445" y="345" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="#E07B0D">🚛 Same-day Delivery</text>
        <rect x="80" y="395" width="460" height="54" rx="27" fill="#F7941D"/>
        <text x="310" y="430" text-anchor="middle" ${FONT} font-weight="800" font-size="21" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 55, left: 540,
    },
  ]);
}

// ─── 3. centered-hero ───
async function centeredHero() {
  const logo = await makeLogo(320);
  await render("centered-hero", { r: 255, g: 248, b: 238, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="bg" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stop-color="#FFF8EE"/>
            <stop offset="100%" stop-color="#FFF0DB"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        <rect x="0" y="0" width="${W}" height="8" fill="#F7941D"/>
        <rect x="0" y="622" width="${W}" height="8" fill="#F7941D"/>
        <circle cx="100" cy="100" r="60" fill="rgba(247,148,29,0.06)"/>
        <circle cx="1100" cy="530" r="80" fill="rgba(247,148,29,0.06)"/>
      `), top: 0, left: 0,
    },
    { input: logo, top: 30, left: 440 },
    {
      input: svg(1000, 280, `
        <text x="500" y="50" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="#1a1a2e" letter-spacing="-1">KKR Groceries</text>
        <text x="500" y="95" text-anchor="middle" ${FONT} font-weight="600" font-size="24" fill="#F7941D" letter-spacing="2">B2B WHOLESALE VEGETABLES · HYDERABAD</text>
        <rect x="300" y="115" width="400" height="3" rx="2" fill="rgba(247,148,29,0.3)"/>
        <text x="500" y="155" text-anchor="middle" ${FONT} font-size="20" fill="#64748b">Fresh vegetables at APMC wholesale prices</text>
        <text x="500" y="183" text-anchor="middle" ${FONT} font-size="20" fill="#64748b">for hotels, restaurants &amp; retailers in Hyderabad</text>
        <rect x="100" y="215" width="350" height="46" rx="23" fill="white" stroke="#F7941D" stroke-width="1.5"/>
        <text x="275" y="245" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="#E07B0D">📍 Hyderabad  ·  🚛 Same-day Delivery</text>
        <rect x="480" y="215" width="420" height="46" rx="23" fill="#F7941D"/>
        <text x="690" y="245" text-anchor="middle" ${FONT} font-weight="800" font-size="17" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 340, left: 100,
    },
  ]);
}

// ─── 4. bold-green ───
async function boldGreen() {
  const logo = await makeLogo(460);
  await render("bold-green", { r: 6, g: 78, b: 59, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="100%" stop-color="#065f46"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#g)"/>
        <rect x="0" y="0" width="${W}" height="10" fill="#F7941D"/>
        <rect x="0" y="620" width="${W}" height="10" fill="#F7941D"/>
        <circle cx="1050" cy="120" r="200" fill="rgba(247,148,29,0.06)"/>
        <circle cx="150" cy="500" r="150" fill="rgba(247,148,29,0.04)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(490, 510, `
        <rect x="5" y="5" width="480" height="500" rx="24" fill="white"/>
      `), top: 60, left: 30,
    },
    { input: logo, top: 85, left: 45 },
    {
      input: svg(620, 500, `
        <text x="310" y="75" text-anchor="middle" ${FONT} font-weight="900" font-size="56" fill="white" letter-spacing="-1">KKR Groceries</text>
        <rect x="80" y="100" width="460" height="4" rx="2" fill="#F7941D"/>
        <text x="310" y="155" text-anchor="middle" ${FONT} font-weight="700" font-size="26" fill="#F7941D" letter-spacing="1">B2B WHOLESALE VEGETABLES</text>
        <text x="310" y="215" text-anchor="middle" ${FONT} font-size="21" fill="rgba(255,255,255,0.8)">Fresh vegetables at APMC wholesale prices</text>
        <text x="310" y="247" text-anchor="middle" ${FONT} font-size="21" fill="rgba(255,255,255,0.8)">for hotels, restaurants</text>
        <text x="310" y="279" text-anchor="middle" ${FONT} font-size="21" fill="rgba(255,255,255,0.8)">&amp; retailers in Hyderabad</text>
        <rect x="30" y="315" width="260" height="44" rx="22" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <text x="160" y="344" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="white">📍 Hyderabad, Telangana</text>
        <rect x="310" y="315" width="270" height="44" rx="22" fill="rgba(247,148,29,0.2)" stroke="#F7941D" stroke-width="1"/>
        <text x="445" y="344" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="#F7941D">🚛 Same-day Delivery</text>
        <rect x="60" y="395" width="500" height="54" rx="27" fill="#F7941D"/>
        <text x="310" y="430" text-anchor="middle" ${FONT} font-weight="800" font-size="21" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 65, left: 550,
    },
  ]);
}

// ─── 5. gradient-orange ───
async function gradientOrange() {
  const logo = await makeLogo(440);
  await render("gradient-orange", { r: 247, g: 148, b: 29, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FF9A2E"/>
            <stop offset="50%" stop-color="#F7941D"/>
            <stop offset="100%" stop-color="#D97B0D"/>
          </linearGradient>
          <linearGradient id="sh" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        <rect width="${W}" height="${H}" fill="url(#sh)"/>
        <circle cx="1100" cy="80" r="200" fill="rgba(255,255,255,0.05)"/>
        <circle cx="1140" cy="560" r="130" fill="rgba(255,255,255,0.04)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(490, 510, `
        <rect x="5" y="5" width="480" height="500" rx="28" fill="rgba(255,255,255,0.95)"/>
      `), top: 60, left: 25,
    },
    { input: logo, top: 85, left: 50 },
    {
      input: svg(620, 510, `
        <text x="310" y="75" text-anchor="middle" ${FONT} font-weight="900" font-size="56" fill="white" letter-spacing="-1">KKR Groceries</text>
        <rect x="100" y="100" width="420" height="3" rx="2" fill="rgba(255,255,255,0.4)"/>
        <rect x="80" y="125" width="460" height="46" rx="23" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
        <text x="310" y="155" text-anchor="middle" ${FONT} font-weight="700" font-size="21" fill="white" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="310" y="225" text-anchor="middle" ${FONT} font-size="21" fill="rgba(255,255,255,0.9)">Fresh vegetables at APMC wholesale prices</text>
        <text x="310" y="257" text-anchor="middle" ${FONT} font-size="21" fill="rgba(255,255,255,0.9)">for hotels, restaurants</text>
        <text x="310" y="289" text-anchor="middle" ${FONT} font-size="21" fill="rgba(255,255,255,0.9)">&amp; retailers in Hyderabad</text>
        <rect x="30" y="325" width="260" height="46" rx="23" fill="white"/>
        <text x="160" y="355" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="#E07B0D">📍 Hyderabad, Telangana</text>
        <rect x="310" y="325" width="270" height="46" rx="23" fill="white"/>
        <text x="445" y="355" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="#E07B0D">🚛 Same-day Delivery</text>
        <rect x="70" y="405" width="480" height="54" rx="27" fill="white"/>
        <text x="310" y="440" text-anchor="middle" ${FONT} font-weight="800" font-size="21" fill="#F7941D">Order Now → kkr-groceries-02.web.app</text>
      `), top: 60, left: 545,
    },
  ]);
}

// ─── 6. minimal-white ───
async function minimalWhite() {
  const logo = await makeLogo(200);
  await render("minimal-white", { r: 255, g: 255, b: 255, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="white"/>
        <rect x="0" y="0" width="${W}" height="4" fill="#F7941D"/>
      `), top: 0, left: 0,
    },
    { input: logo, top: 50, left: 60 },
    {
      input: svg(880, 530, `
        <text x="0" y="65" ${FONT} font-weight="900" font-size="64" fill="#1a1a2e" letter-spacing="-2">KKR Groceries</text>
        <text x="0" y="110" ${FONT} font-weight="600" font-size="22" fill="#F7941D" letter-spacing="4">B2B WHOLESALE VEGETABLES</text>
        <rect x="0" y="130" width="600" height="2" fill="rgba(247,148,29,0.4)"/>
        <text x="0" y="180" ${FONT} font-size="22" fill="#64748b">Fresh vegetables at APMC wholesale prices</text>
        <text x="0" y="212" ${FONT} font-size="22" fill="#64748b">for hotels, restaurants &amp; retailers in Hyderabad</text>
        <rect x="0" y="260" width="280" height="42" rx="21" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
        <text x="140" y="287" text-anchor="middle" ${FONT} font-weight="600" font-size="16" fill="#94a3b8">📍 Hyderabad, Telangana</text>
        <rect x="300" y="260" width="260" height="42" rx="21" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
        <text x="430" y="287" text-anchor="middle" ${FONT} font-weight="600" font-size="16" fill="#94a3b8">🚛 Same-day Delivery</text>
        <rect x="0" y="330" width="380" height="44" rx="22" fill="#F7941D"/>
        <text x="190" y="359" text-anchor="middle" ${FONT} font-weight="700" font-size="17" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 60, left: 290,
    },
  ]);
}

// ─── 7. duotone ───
async function duotone() {
  const logo = await makeLogo(220);
  await render("duotone", { r: 30, g: 30, b: 46, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect x="0" y="0" width="600" height="${H}" fill="#1e1e2e"/>
        <rect x="600" y="0" width="600" height="${H}" fill="#F7941D"/>
        <circle cx="600" cy="280" r="140" fill="white"/>
      `), top: 0, left: 0,
    },
    { input: logo, top: 170, left: 490 },
    {
      input: svg(W, 250, `
        <text x="600" y="50" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="white" letter-spacing="-1">KKR Groceries</text>
        <text x="600" y="90" text-anchor="middle" ${FONT} font-weight="700" font-size="24" fill="rgba(255,255,255,0.9)" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="600" y="135" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.7)">Fresh vegetables at APMC wholesale prices for hotels,</text>
        <text x="600" y="163" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.7)">restaurants &amp; retailers in Hyderabad</text>
        <rect x="140" y="195" width="280" height="42" rx="21" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <text x="280" y="222" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="white">📍 Hyderabad, Telangana</text>
        <rect x="440" y="195" width="260" height="42" rx="21" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <text x="570" y="222" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="white">🚛 Same-day Delivery</text>
        <rect x="740" y="195" width="320" height="42" rx="21" fill="white"/>
        <text x="900" y="222" text-anchor="middle" ${FONT} font-weight="800" font-size="16" fill="#F7941D">Order Now → kkr-groceries-02.web.app</text>
      `), top: 405, left: 0,
    },
  ]);
}

// ─── 8. editorial ───
async function editorial() {
  const logo = await makeLogo(280);
  await render("editorial", { r: 250, g: 247, b: 242, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="#FAF7F2"/>
        <!-- Double border frame -->
        <rect x="20" y="20" width="1160" height="590" rx="0" fill="none" stroke="#2a2a2a" stroke-width="2"/>
        <rect x="28" y="28" width="1144" height="574" rx="0" fill="none" stroke="#2a2a2a" stroke-width="1"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(1100, 100, `
        <text x="550" y="55" text-anchor="middle" ${FONT} font-weight="900" font-size="42" fill="#2a2a2a" letter-spacing="12">KKR GROCERIES</text>
        <rect x="200" y="75" width="700" height="1.5" fill="#2a2a2a"/>
      `), top: 45, left: 50,
    },
    { input: logo, top: 150, left: 460 },
    {
      input: svg(1000, 180, `
        <text x="500" y="35" text-anchor="middle" ${FONT} font-weight="600" font-size="20" fill="#6b6b6b" letter-spacing="5">B2B WHOLESALE VEGETABLES</text>
        <text x="500" y="80" text-anchor="middle" ${FONT} font-size="19" fill="#8a8a8a">Fresh vegetables at APMC wholesale prices</text>
        <text x="500" y="108" text-anchor="middle" ${FONT} font-size="19" fill="#8a8a8a">for hotels, restaurants &amp; retailers in Hyderabad</text>
        <rect x="200" y="130" width="600" height="1" fill="#c0b8ae"/>
        <text x="300" y="165" text-anchor="middle" ${FONT} font-weight="600" font-size="14" fill="#8a8a8a" letter-spacing="3">📍 HYDERABAD, TELANGANA</text>
        <text x="700" y="165" text-anchor="middle" ${FONT} font-weight="600" font-size="14" fill="#8a8a8a" letter-spacing="3">🚛 SAME-DAY DELIVERY</text>
      `), top: 430, left: 100,
    },
  ]);
}

// ─── 9. bold-type ───
async function boldType() {
  const logo = await makeLogo(360);
  await render("bold-type", { r: 247, g: 148, b: 29, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="#F7941D"/>
        <!-- Massive watermark text -->
        <text x="600" y="480" text-anchor="middle" ${FONT} font-weight="900" font-size="220" fill="rgba(255,255,255,0.08)" letter-spacing="-10">KKR</text>
      `), top: 0, left: 0,
    },
    {
      input: svg(400, 430, `
        <rect x="5" y="5" width="390" height="420" rx="24" fill="white"/>
      `), top: 100, left: 40,
    },
    { input: logo, top: 135, left: 60 },
    {
      input: svg(660, 430, `
        <text x="0" y="65" ${FONT} font-weight="900" font-size="64" fill="white" letter-spacing="-2">KKR Groceries</text>
        <text x="0" y="115" ${FONT} font-weight="700" font-size="28" fill="rgba(255,255,255,0.95)" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="0" y="175" ${FONT} font-size="22" fill="rgba(255,255,255,0.9)">Fresh vegetables at APMC wholesale prices</text>
        <text x="0" y="207" ${FONT} font-size="22" fill="rgba(255,255,255,0.9)">for hotels, restaurants</text>
        <text x="0" y="239" ${FONT} font-size="22" fill="rgba(255,255,255,0.9)">&amp; retailers in Hyderabad</text>
        <rect x="0" y="280" width="600" height="56" rx="28" fill="white"/>
        <text x="300" y="315" text-anchor="middle" ${FONT} font-weight="800" font-size="21" fill="#F7941D">Order Now → kkr-groceries-02.web.app</text>
      `), top: 120, left: 490,
    },
  ]);
}

// ─── 10. neon-glow ───
async function neonGlow() {
  const logo = await makeLogo(400);
  await render("neon-glow", { r: 10, g: 10, b: 15, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="#0a0a0f"/>
        <!-- Neon glow circles -->
        <circle cx="270" cy="315" r="320" fill="rgba(247,148,29,0.03)"/>
        <circle cx="270" cy="315" r="250" fill="rgba(247,148,29,0.05)"/>
        <circle cx="270" cy="315" r="180" fill="rgba(247,148,29,0.07)"/>
        <circle cx="270" cy="315" r="120" fill="rgba(247,148,29,0.09)"/>
        <!-- Neon line accents -->
        <rect x="540" y="100" width="2" height="430" fill="rgba(247,148,29,0.4)"/>
        <rect x="537" y="100" width="8" height="430" rx="4" fill="rgba(247,148,29,0.1)"/>
        <!-- Top neon line -->
        <rect x="0" y="0" width="${W}" height="3" fill="#F7941D"/>
        <rect x="0" y="3" width="${W}" height="6" fill="rgba(247,148,29,0.2)"/>
        <!-- Bottom neon line -->
        <rect x="0" y="621" width="${W}" height="3" fill="#F7941D"/>
        <rect x="0" y="615" width="${W}" height="6" fill="rgba(247,148,29,0.2)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(440, 460, `
        <rect x="10" y="10" width="420" height="440" rx="24" fill="rgba(255,255,255,0.97)"/>
      `), top: 85, left: 50,
    },
    { input: logo, top: 115, left: 70 },
    {
      input: svg(600, 480, `
        <!-- Title with glow effect: offset copies for glow -->
        <text x="300" y="72" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="rgba(247,148,29,0.3)" dx="2" dy="2">KKR Groceries</text>
        <text x="300" y="72" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="rgba(247,148,29,0.15)" dx="-2" dy="-2">KKR Groceries</text>
        <text x="300" y="72" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="white">KKR Groceries</text>
        <rect x="60" y="100" width="480" height="3" rx="2" fill="#F7941D"/>
        <rect x="55" y="97" width="490" height="9" rx="5" fill="rgba(247,148,29,0.15)"/>
        <text x="300" y="155" text-anchor="middle" ${FONT} font-weight="700" font-size="24" fill="#F7941D" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="300" y="210" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.65)">Fresh vegetables at APMC wholesale prices</text>
        <text x="300" y="240" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.65)">for hotels, restaurants</text>
        <text x="300" y="270" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.65)">&amp; retailers in Hyderabad</text>
        <rect x="40" y="305" width="230" height="42" rx="21" fill="rgba(247,148,29,0.1)" stroke="#F7941D" stroke-width="1.5"/>
        <text x="155" y="332" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#F7941D">📍 Hyderabad, Telangana</text>
        <rect x="290" y="305" width="260" height="42" rx="21" fill="rgba(247,148,29,0.1)" stroke="#F7941D" stroke-width="1.5"/>
        <text x="420" y="332" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#F7941D">🚛 Same-day Delivery</text>
        <!-- CTA with glow -->
        <rect x="55" y="380" width="490" height="52" rx="26" fill="rgba(247,148,29,0.15)" stroke="#F7941D" stroke-width="2"/>
        <rect x="50" y="375" width="500" height="62" rx="31" fill="rgba(247,148,29,0.06)"/>
        <text x="300" y="413" text-anchor="middle" ${FONT} font-weight="800" font-size="20" fill="#F7941D">Order Now → kkr-groceries-02.web.app</text>
      `), top: 75, left: 565,
    },
  ]);
}

// ─── 11. geometric ───
async function geometric() {
  const logo = await makeLogo(340);
  await render("geometric", { r: 247, g: 148, b: 29, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="#F7941D"/>
        <!-- Geometric pattern overlay -->
        <polygon points="0,0 120,0 60,100" fill="rgba(255,255,255,0.06)"/>
        <polygon points="200,0 320,0 260,100" fill="rgba(255,255,255,0.04)"/>
        <polygon points="400,0 520,0 460,100" fill="rgba(255,255,255,0.06)"/>
        <polygon points="600,0 720,0 660,100" fill="rgba(255,255,255,0.04)"/>
        <polygon points="800,0 920,0 860,100" fill="rgba(255,255,255,0.06)"/>
        <polygon points="1000,0 1120,0 1060,100" fill="rgba(255,255,255,0.04)"/>
        <polygon points="60,530 180,530 120,630" fill="rgba(255,255,255,0.06)"/>
        <polygon points="260,530 380,530 320,630" fill="rgba(255,255,255,0.04)"/>
        <polygon points="460,530 580,530 520,630" fill="rgba(255,255,255,0.06)"/>
        <polygon points="660,530 780,530 720,630" fill="rgba(255,255,255,0.04)"/>
        <polygon points="860,530 980,530 920,630" fill="rgba(255,255,255,0.06)"/>
        <polygon points="1060,530 1180,530 1120,630" fill="rgba(255,255,255,0.04)"/>
        <!-- Hexagons -->
        <polygon points="1100,280 1140,250 1180,280 1180,330 1140,360 1100,330" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <polygon points="50,400 90,370 130,400 130,450 90,480 50,450" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <polygon points="1020,120 1060,90 1100,120 1100,170 1060,200 1020,170" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(1000, 500, `
        <rect x="0" y="0" width="1000" height="500" rx="20" fill="white"/>
      `), top: 65, left: 100,
    },
    { input: logo, top: 145, left: 140 },
    {
      input: svg(560, 420, `
        <text x="280" y="65" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="#1a1a2e" letter-spacing="-1">KKR Groceries</text>
        <rect x="40" y="90" width="480" height="4" rx="2" fill="#F7941D"/>
        <text x="280" y="145" text-anchor="middle" ${FONT} font-weight="700" font-size="24" fill="#F7941D" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="280" y="200" text-anchor="middle" ${FONT} font-size="20" fill="#64748b">Fresh vegetables at APMC wholesale prices</text>
        <text x="280" y="230" text-anchor="middle" ${FONT} font-size="20" fill="#64748b">for hotels, restaurants</text>
        <text x="280" y="260" text-anchor="middle" ${FONT} font-size="20" fill="#64748b">&amp; retailers in Hyderabad</text>
        <rect x="10" y="295" width="240" height="42" rx="21" fill="#FFF7ED" stroke="#F7941D" stroke-width="1.5"/>
        <text x="130" y="322" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#E07B0D">📍 Hyderabad, Telangana</text>
        <rect x="270" y="295" width="240" height="42" rx="21" fill="#FFF7ED" stroke="#F7941D" stroke-width="1.5"/>
        <text x="390" y="322" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#E07B0D">🚛 Same-day Delivery</text>
        <rect x="40" y="365" width="480" height="50" rx="25" fill="#F7941D"/>
        <text x="280" y="397" text-anchor="middle" ${FONT} font-weight="800" font-size="20" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 100, left: 490,
    },
  ]);
}

// ─── 12. gradient-mesh ───
async function gradientMesh() {
  const logo = await makeLogo(380);
  await render("gradient-mesh", { r: 247, g: 148, b: 29, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="mesh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F7941D"/>
            <stop offset="40%" stop-color="#FF6B6B"/>
            <stop offset="100%" stop-color="#7C3AED"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#mesh)"/>
        <circle cx="200" cy="100" r="250" fill="rgba(255,255,255,0.04)"/>
        <circle cx="1000" cy="500" r="300" fill="rgba(124,58,237,0.1)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(1100, 520, `
        <rect x="0" y="0" width="1100" height="520" rx="24" fill="rgba(255,255,255,0.85)"/>
      `), top: 55, left: 50,
    },
    { input: logo, top: 125, left: 80 },
    {
      input: svg(600, 450, `
        <text x="300" y="65" text-anchor="middle" ${FONT} font-weight="900" font-size="52" fill="#1a1a2e" letter-spacing="-1">KKR Groceries</text>
        <rect x="60" y="90" width="480" height="4" rx="2" fill="#F7941D"/>
        <text x="300" y="145" text-anchor="middle" ${FONT} font-weight="700" font-size="24" fill="#F7941D" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="300" y="205" text-anchor="middle" ${FONT} font-size="20" fill="#4a4a5a">Fresh vegetables at APMC wholesale prices</text>
        <text x="300" y="235" text-anchor="middle" ${FONT} font-size="20" fill="#4a4a5a">for hotels, restaurants</text>
        <text x="300" y="265" text-anchor="middle" ${FONT} font-size="20" fill="#4a4a5a">&amp; retailers in Hyderabad</text>
        <rect x="30" y="300" width="240" height="42" rx="21" fill="none" stroke="#7C3AED" stroke-width="1.5"/>
        <text x="150" y="327" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#7C3AED">📍 Hyderabad, Telangana</text>
        <rect x="290" y="300" width="260" height="42" rx="21" fill="none" stroke="#FF6B6B" stroke-width="1.5"/>
        <text x="420" y="327" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#FF6B6B">🚛 Same-day Delivery</text>
        <rect x="60" y="375" width="480" height="52" rx="26" fill="#F7941D"/>
        <text x="300" y="408" text-anchor="middle" ${FONT} font-weight="800" font-size="20" fill="white">Order Now → kkr-groceries-02.web.app</text>
      `), top: 85, left: 500,
    },
  ]);
}

// ─── 13. vintage-stamp ───
async function vintageStamp() {
  const logo = await makeLogo(200);
  // Simulate curved text with rotated text elements around a circle
  const cx = 600, cy = 290, r = 220;
  const stampText = "KKR GROCERIES";
  const anglePerChar = 10;
  const startAngle = -((stampText.length - 1) * anglePerChar) / 2 - 90;
  let curvedTextSvg = "";
  for (let i = 0; i < stampText.length; i++) {
    const angle = startAngle + i * anglePerChar;
    const rad = (angle * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    curvedTextSvg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" ${FONT} font-weight="900" font-size="32" fill="#8B4513" letter-spacing="2" transform="rotate(${angle + 90},${x.toFixed(1)},${y.toFixed(1)})">${stampText[i] === " " ? "&#160;" : stampText[i]}</text>`;
  }
  // Bottom curved text
  const bottomText = "EST. HYDERABAD";
  const startAngleBottom = ((bottomText.length - 1) * anglePerChar) / 2 + 90;
  for (let i = 0; i < bottomText.length; i++) {
    const angle = startAngleBottom - i * anglePerChar;
    const rad = (angle * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    curvedTextSvg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" ${FONT} font-weight="700" font-size="22" fill="#A0704E" letter-spacing="3" transform="rotate(${angle - 90},${x.toFixed(1)},${y.toFixed(1)})">${bottomText[i] === " " ? "&#160;" : bottomText[i]}</text>`;
  }

  await render("vintage-stamp", { r: 245, g: 230, b: 208, alpha: 255 }, [
    {
      input: svg(W, H, `
        <rect width="${W}" height="${H}" fill="#F5E6D0"/>
        <!-- Subtle parchment texture via circles -->
        <circle cx="200" cy="100" r="300" fill="rgba(160,112,78,0.03)"/>
        <circle cx="1000" cy="500" r="250" fill="rgba(160,112,78,0.03)"/>
        <!-- Double circle border -->
        <circle cx="600" cy="290" r="260" fill="none" stroke="#F7941D" stroke-width="4"/>
        <circle cx="600" cy="290" r="248" fill="none" stroke="#D4894A" stroke-width="2"/>
        <!-- Decorative dots on circle -->
        <circle cx="600" cy="30" r="5" fill="#F7941D"/>
        <circle cx="600" cy="550" r="5" fill="#F7941D"/>
        <circle cx="340" cy="290" r="5" fill="#F7941D"/>
        <circle cx="860" cy="290" r="5" fill="#F7941D"/>
        ${curvedTextSvg}
      `), top: 0, left: 0,
    },
    { input: logo, top: 200, left: 500 },
    {
      input: svg(800, 80, `
        <text x="400" y="30" text-anchor="middle" ${FONT} font-size="19" fill="#8B6942">Fresh vegetables at APMC wholesale prices</text>
        <text x="400" y="58" text-anchor="middle" ${FONT} font-size="19" fill="#8B6942">for hotels, restaurants &amp; retailers in Hyderabad</text>
      `), top: 550, left: 200,
    },
  ]);
}

// ─── 14. corporate-blue ───
async function corporateBlue() {
  const logo = await makeLogo(420);
  await render("corporate-blue", { r: 30, g: 58, b: 95, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e3a5f"/>
            <stop offset="100%" stop-color="#2563eb"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#blue)"/>
        <circle cx="1050" cy="130" r="200" fill="rgba(255,255,255,0.04)"/>
        <circle cx="100" cy="530" r="150" fill="rgba(255,255,255,0.03)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(470, 490, `
        <rect x="5" y="5" width="460" height="480" rx="16" fill="white"/>
      `), top: 70, left: 35,
    },
    { input: logo, top: 105, left: 60 },
    {
      input: svg(620, 500, `
        <text x="310" y="70" text-anchor="middle" ${FONT} font-weight="900" font-size="54" fill="white" letter-spacing="-1">KKR Groceries</text>
        <rect x="80" y="95" width="440" height="3" rx="2" fill="rgba(147,197,253,0.5)"/>
        <text x="310" y="150" text-anchor="middle" ${FONT} font-weight="600" font-size="24" fill="rgba(147,197,253,1)" letter-spacing="3">B2B WHOLESALE VEGETABLES</text>
        <text x="310" y="210" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.8)">Fresh vegetables at APMC wholesale prices</text>
        <text x="310" y="240" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.8)">for hotels, restaurants</text>
        <text x="310" y="270" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.8)">&amp; retailers in Hyderabad</text>
        <rect x="40" y="305" width="240" height="44" rx="22" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
        <text x="160" y="334" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="white">📍 Hyderabad, Telangana</text>
        <rect x="300" y="305" width="260" height="44" rx="22" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
        <text x="430" y="334" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="white">🚛 Same-day Delivery</text>
        <rect x="60" y="380" width="500" height="52" rx="26" fill="white"/>
        <text x="310" y="414" text-anchor="middle" ${FONT} font-weight="800" font-size="20" fill="#2563eb">Order Now → kkr-groceries-02.web.app</text>
      `), top: 70, left: 560,
    },
  ]);
}

// ─── 15. fresh-market ───
async function freshMarket() {
  const logo = await makeLogo(420);
  await render("fresh-market", { r: 6, g: 95, b: 70, alpha: 255 }, [
    {
      input: svg(W, H, `
        <defs>
          <linearGradient id="green" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#065f46"/>
            <stop offset="50%" stop-color="#059669"/>
            <stop offset="100%" stop-color="#10b981"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#green)"/>
        <!-- Leaf/nature decorative shapes -->
        <ellipse cx="100" cy="80" rx="80" ry="40" transform="rotate(-30,100,80)" fill="rgba(16,185,129,0.2)"/>
        <ellipse cx="1120" cy="100" rx="100" ry="50" transform="rotate(20,1120,100)" fill="rgba(16,185,129,0.15)"/>
        <ellipse cx="80" cy="520" rx="60" ry="30" transform="rotate(15,80,520)" fill="rgba(16,185,129,0.2)"/>
        <ellipse cx="1100" cy="550" rx="90" ry="45" transform="rotate(-25,1100,550)" fill="rgba(16,185,129,0.15)"/>
        <!-- Small leaf shapes -->
        <path d="M150,200 Q180,170 210,200 Q180,230 150,200Z" fill="rgba(134,239,172,0.1)"/>
        <path d="M1050,400 Q1080,370 1110,400 Q1080,430 1050,400Z" fill="rgba(134,239,172,0.1)"/>
        <path d="M950,80 Q970,50 990,80 Q970,110 950,80Z" fill="rgba(134,239,172,0.08)"/>
      `), top: 0, left: 0,
    },
    {
      input: svg(470, 490, `
        <rect x="5" y="5" width="460" height="480" rx="24" fill="rgba(255,255,255,0.92)"/>
      `), top: 70, left: 35,
    },
    { input: logo, top: 95, left: 60 },
    {
      input: svg(620, 500, `
        <text x="310" y="70" text-anchor="middle" ${FONT} font-weight="900" font-size="54" fill="white" letter-spacing="-1">KKR Groceries</text>
        <rect x="80" y="95" width="440" height="3" rx="2" fill="rgba(255,255,255,0.3)"/>
        <text x="310" y="150" text-anchor="middle" ${FONT} font-weight="700" font-size="24" fill="#86efac" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
        <text x="310" y="210" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.85)">Fresh vegetables at APMC wholesale prices</text>
        <text x="310" y="240" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.85)">for hotels, restaurants</text>
        <text x="310" y="270" text-anchor="middle" ${FONT} font-size="20" fill="rgba(255,255,255,0.85)">&amp; retailers in Hyderabad</text>
        <rect x="40" y="305" width="240" height="44" rx="22" fill="rgba(255,255,255,0.15)" stroke="rgba(134,239,172,0.4)" stroke-width="1.5"/>
        <text x="160" y="334" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#86efac">📍 Hyderabad, Telangana</text>
        <rect x="300" y="305" width="260" height="44" rx="22" fill="rgba(255,255,255,0.15)" stroke="rgba(134,239,172,0.4)" stroke-width="1.5"/>
        <text x="430" y="334" text-anchor="middle" ${FONT} font-weight="700" font-size="16" fill="#86efac">🚛 Same-day Delivery</text>
        <rect x="60" y="380" width="500" height="52" rx="26" fill="#059669"/>
        <text x="310" y="413" text-anchor="middle" ${FONT} font-weight="800" font-size="20" fill="white">🌿 Order Now → kkr-groceries-02.web.app 🌿</text>
      `), top: 70, left: 560,
    },
  ]);
}

// ─── Run all ───
console.log("Generating 15 OG banner templates...\n");
await Promise.all([
  darkPremium(),
  cleanSplit(),
  centeredHero(),
  boldGreen(),
  gradientOrange(),
  minimalWhite(),
  duotone(),
  editorial(),
  boldType(),
  neonGlow(),
  geometric(),
  gradientMesh(),
  vintageStamp(),
  corporateBlue(),
  freshMarket(),
]);
console.log(`\nAll 15 templates saved to: ${outDir}`);
