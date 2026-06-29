import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const draftsDir = path.join(__dirname, "..", "og-drafts");
if (!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir);

async function makeLogo(size) {
    return sharp(path.join(publicDir, "logo-white.png"))
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

// ─── DRAFT A: Dark Premium ───
async function draftA() {
    const logo = await makeLogo(440);
    await sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 24, g: 24, b: 32, alpha: 255 } },
    }).composite([
        {
            input: Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#1a1a2e"/>
                        <stop offset="50%" stop-color="#16213e"/>
                        <stop offset="100%" stop-color="#0f0f1a"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="630" fill="url(#g1)"/>
                <!-- Glow behind logo -->
                <circle cx="270" cy="315" r="280" fill="rgba(247,148,29,0.08)"/>
                <circle cx="270" cy="315" r="180" fill="rgba(247,148,29,0.06)"/>
                <!-- Accent line -->
                <rect x="540" y="300" width="3" height="200" rx="2" fill="rgba(247,148,29,0.3)"/>
            </svg>`), top: 0, left: 0,
        },
        // White card behind logo
        {
            input: Buffer.from(`<svg width="470" height="490" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="460" height="480" rx="24" fill="white"
                      filter="drop-shadow(0 12px 40px rgba(247,148,29,0.25))"/>
            </svg>`), top: 70, left: 35,
        },
        { input: logo, top: 95, left: 50 },
        // Right side text
        {
            input: Buffer.from(`<svg width="600" height="500" xmlns="http://www.w3.org/2000/svg">
                <text x="300" y="70" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="900" font-size="54" fill="white" letter-spacing="-1">KKR Groceries</text>
                <rect x="80" y="95" width="440" height="3" rx="2" fill="#F7941D"/>
                <text x="300" y="150" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="600" font-size="24" fill="#F7941D" letter-spacing="3">B2B WHOLESALE VEGETABLES</text>
                <text x="300" y="210" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="20" fill="rgba(255,255,255,0.7)">Fresh vegetables at APMC wholesale prices</text>
                <text x="300" y="242" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="20" fill="rgba(255,255,255,0.7)">for hotels, restaurants &amp; retailers</text>
                <rect x="40" y="280" width="230" height="44" rx="22" fill="rgba(247,148,29,0.15)" stroke="#F7941D" stroke-width="1.5"/>
                <text x="155" y="309" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#F7941D">📍 Hyderabad</text>
                <rect x="290" y="280" width="270" height="44" rx="22" fill="rgba(58,155,66,0.15)" stroke="#3A9B42" stroke-width="1.5"/>
                <text x="425" y="309" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#3A9B42">🚛 Same-day Delivery</text>
                <rect x="60" y="360" width="480" height="52" rx="26" fill="#F7941D"/>
                <text x="300" y="394" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="800" font-size="20" fill="white">Order Now → kkr-groceries-02.web.app</text>
            </svg>`), top: 75, left: 570,
        },
    ]).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(draftsDir, "draft-A-dark.jpg"));
    console.log("✅ Draft A: Dark Premium");
}

// ─── DRAFT B: Clean White Split ───
async function draftB() {
    const logo = await makeLogo(400);
    await sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
    }).composite([
        {
            input: Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
                <rect width="1200" height="630" fill="white"/>
                <!-- Left orange accent panel -->
                <rect x="0" y="0" width="520" height="630" fill="#F7941D"/>
                <rect x="0" y="0" width="520" height="630" fill="url(#sh)" opacity="0.5"/>
                <defs><linearGradient id="sh" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(0,0,0,0.05)"/></linearGradient></defs>
                <!-- Diagonal cut -->
                <polygon points="460,0 560,0 520,630 420,630" fill="white"/>
                <!-- Bottom accent bar -->
                <rect x="0" y="600" width="1200" height="30" fill="#F7941D"/>
                <rect x="0" y="600" width="520" height="30" fill="#E07B0D"/>
            </svg>`), top: 0, left: 0,
        },
        // Logo centered in left panel
        { input: logo, top: 115, left: 40 },
        // Right side text
        {
            input: Buffer.from(`<svg width="620" height="520" xmlns="http://www.w3.org/2000/svg">
                <text x="310" y="80" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="900" font-size="56" fill="#1a1a2e" letter-spacing="-1">KKR Groceries</text>
                <rect x="110" y="105" width="400" height="4" rx="2" fill="#F7941D"/>
                <text x="310" y="160" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="26" fill="#F7941D" letter-spacing="1">B2B Wholesale Vegetables</text>
                <text x="310" y="220" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="#64748b">Fresh vegetables at APMC wholesale</text>
                <text x="310" y="252" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="#64748b">prices for hotels, restaurants</text>
                <text x="310" y="284" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="#64748b">&amp; retailers in Hyderabad</text>
                <!-- Pills row -->
                <rect x="30" y="320" width="260" height="46" rx="23" fill="#FFF7ED" stroke="#F7941D" stroke-width="1.5"/>
                <text x="160" y="350" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#E07B0D">📍 Hyderabad, Telangana</text>
                <rect x="310" y="320" width="270" height="46" rx="23" fill="#F0FFF4" stroke="#3A9B42" stroke-width="1.5"/>
                <text x="445" y="350" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#2d7a32">🚛 Same-day Delivery</text>
                <!-- CTA -->
                <rect x="80" y="400" width="460" height="54" rx="27" fill="#F7941D"/>
                <text x="310" y="435" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="800" font-size="21" fill="white">Order Now → kkr-groceries-02.web.app</text>
            </svg>`), top: 55, left: 540,
        },
    ]).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(draftsDir, "draft-B-split.jpg"));
    console.log("✅ Draft B: Clean White Split");
}

// ─── DRAFT C: Centered Hero ───
async function draftC() {
    const logo = await makeLogo(320);
    await sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
    }).composite([
        {
            input: Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bg" x1="0.5" y1="0" x2="0.5" y2="1">
                        <stop offset="0%" stop-color="#FFF8EE"/>
                        <stop offset="100%" stop-color="#FFF0DB"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="630" fill="url(#bg)"/>
                <!-- Top orange bar -->
                <rect x="0" y="0" width="1200" height="8" fill="#F7941D"/>
                <!-- Bottom orange bar -->
                <rect x="0" y="622" width="1200" height="8" fill="#F7941D"/>
                <!-- Decorative dots -->
                <circle cx="100" cy="100" r="60" fill="rgba(247,148,29,0.06)"/>
                <circle cx="1100" cy="530" r="80" fill="rgba(247,148,29,0.06)"/>
                <circle cx="1050" cy="100" r="40" fill="rgba(58,155,66,0.06)"/>
            </svg>`), top: 0, left: 0,
        },
        // Center logo
        { input: logo, top: 30, left: 440 },
        // Text below
        {
            input: Buffer.from(`<svg width="1000" height="280" xmlns="http://www.w3.org/2000/svg">
                <text x="500" y="50" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="900" font-size="52" fill="#1a1a2e" letter-spacing="-1">KKR Groceries</text>
                <text x="500" y="95" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="600" font-size="24" fill="#F7941D" letter-spacing="2">B2B WHOLESALE VEGETABLES · HYDERABAD</text>
                <rect x="300" y="115" width="400" height="3" rx="2" fill="rgba(247,148,29,0.3)"/>
                <text x="500" y="160" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="20" fill="#64748b">Fresh vegetables at APMC wholesale prices for hotels, restaurants &amp; retailers</text>
                <!-- Pills -->
                <rect x="100" y="195" width="350" height="46" rx="23" fill="white" stroke="#F7941D" stroke-width="1.5"/>
                <text x="275" y="225" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#E07B0D">📍 Hyderabad  ·  🚛 Same-day Delivery</text>
                <rect x="480" y="195" width="420" height="46" rx="23" fill="#F7941D"/>
                <text x="690" y="225" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="800" font-size="17" fill="white">Order Now → kkr-groceries-02.web.app</text>
            </svg>`), top: 340, left: 100,
        },
    ]).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(draftsDir, "draft-C-centered.jpg"));
    console.log("✅ Draft C: Centered Hero");
}

// ─── DRAFT D: Bold Green + Orange ───
async function draftD() {
    const logo = await makeLogo(460);
    await sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 6, g: 78, b: 59, alpha: 255 } },
    }).composite([
        {
            input: Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#064e3b"/>
                        <stop offset="100%" stop-color="#065f46"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="630" fill="url(#g)"/>
                <!-- Orange accent strip -->
                <rect x="0" y="0" width="1200" height="10" fill="#F7941D"/>
                <rect x="0" y="620" width="1200" height="10" fill="#F7941D"/>
                <!-- Pattern -->
                <circle cx="1050" cy="120" r="200" fill="rgba(247,148,29,0.06)"/>
                <circle cx="150" cy="500" r="150" fill="rgba(247,148,29,0.04)"/>
            </svg>`), top: 0, left: 0,
        },
        // White card for logo
        {
            input: Buffer.from(`<svg width="490" height="510" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="480" height="500" rx="24" fill="white"/>
            </svg>`), top: 60, left: 30,
        },
        { input: logo, top: 85, left: 45 },
        // Right text
        {
            input: Buffer.from(`<svg width="620" height="500" xmlns="http://www.w3.org/2000/svg">
                <text x="310" y="75" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="900" font-size="56" fill="white" letter-spacing="-1">KKR Groceries</text>
                <rect x="80" y="100" width="460" height="4" rx="2" fill="#F7941D"/>
                <text x="310" y="155" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="26" fill="#F7941D" letter-spacing="1">B2B Wholesale Vegetables</text>
                <text x="310" y="215" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="rgba(255,255,255,0.8)">Fresh vegetables at APMC wholesale</text>
                <text x="310" y="247" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="rgba(255,255,255,0.8)">prices for hotels, restaurants</text>
                <text x="310" y="279" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="rgba(255,255,255,0.8)">&amp; retailers in Hyderabad</text>
                <!-- Pills -->
                <rect x="30" y="315" width="260" height="44" rx="22" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                <text x="160" y="344" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="white">📍 Hyderabad, Telangana</text>
                <rect x="310" y="315" width="270" height="44" rx="22" fill="rgba(247,148,29,0.2)" stroke="#F7941D" stroke-width="1"/>
                <text x="445" y="344" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#F7941D">🚛 Same-day Delivery</text>
                <!-- CTA -->
                <rect x="60" y="395" width="500" height="54" rx="27" fill="#F7941D"/>
                <text x="310" y="430" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="800" font-size="21" fill="white">Order Now → kkr-groceries-02.web.app</text>
            </svg>`), top: 65, left: 550,
        },
    ]).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(draftsDir, "draft-D-green.jpg"));
    console.log("✅ Draft D: Bold Green + Orange");
}

// ─── DRAFT E: Gradient Orange (improved original) ───
async function draftE() {
    const logo = await makeLogo(440);
    await sharp({
        create: { width: 1200, height: 630, channels: 4, background: { r: 247, g: 148, b: 29, alpha: 255 } },
    }).composite([
        {
            input: Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
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
                <rect width="1200" height="630" fill="url(#bg)"/>
                <rect width="1200" height="630" fill="url(#sh)"/>
                <circle cx="1100" cy="80" r="200" fill="rgba(255,255,255,0.05)"/>
                <circle cx="1140" cy="560" r="130" fill="rgba(255,255,255,0.04)"/>
            </svg>`), top: 0, left: 0,
        },
        // Frosted white card for logo
        {
            input: Buffer.from(`<svg width="490" height="510" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="480" height="500" rx="28" fill="rgba(255,255,255,0.95)"/>
            </svg>`), top: 60, left: 25,
        },
        { input: logo, top: 85, left: 50 },
        // Right text — white on orange
        {
            input: Buffer.from(`<svg width="620" height="510" xmlns="http://www.w3.org/2000/svg">
                <text x="310" y="75" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="900" font-size="56" fill="white" letter-spacing="-1">KKR Groceries</text>
                <rect x="100" y="100" width="420" height="3" rx="2" fill="rgba(255,255,255,0.4)"/>
                <!-- Subtitle pill -->
                <rect x="80" y="125" width="460" height="46" rx="23" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
                <text x="310" y="155" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="21" fill="white" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>
                <text x="310" y="225" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="rgba(255,255,255,0.9)">Fresh vegetables at APMC wholesale</text>
                <text x="310" y="257" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="rgba(255,255,255,0.9)">prices for hotels, restaurants</text>
                <text x="310" y="289" text-anchor="middle" font-family="'Segoe UI',Arial" font-size="21" fill="rgba(255,255,255,0.9)">&amp; retailers in Hyderabad</text>
                <!-- White pills -->
                <rect x="30" y="325" width="260" height="46" rx="23" fill="white"/>
                <text x="160" y="355" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#E07B0D">📍 Hyderabad, Telangana</text>
                <rect x="310" y="325" width="270" height="46" rx="23" fill="white"/>
                <text x="445" y="355" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="700" font-size="17" fill="#3A9B42">🚛 Same-day Delivery</text>
                <!-- CTA -->
                <rect x="70" y="405" width="480" height="54" rx="27" fill="white"/>
                <text x="310" y="440" text-anchor="middle" font-family="'Segoe UI',Arial" font-weight="800" font-size="21" fill="#F7941D">Order Now → kkr-groceries-02.web.app</text>
            </svg>`), top: 60, left: 545,
        },
    ]).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(draftsDir, "draft-E-orange.jpg"));
    console.log("✅ Draft E: Gradient Orange (polished)");
}

await Promise.all([draftA(), draftB(), draftC(), draftD(), draftE()]);
console.log(`\n📂 All drafts saved to: ${draftsDir}`);
