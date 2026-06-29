import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

async function main() {
    const logoPath = path.join(publicDir, "logo-white.png");

    // Resize logo — larger, more prominent
    const logoBuffer = await sharp(logoPath)
        .resize(460, 460, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    // 1200x630 premium banner
    await sharp({
        create: {
            width: 1200,
            height: 630,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 255 },
        },
    })
        .composite([
            // === BACKGROUND: Rich gradient left panel ===
            {
                input: Buffer.from(
                    `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="#FF8C00"/>
                                <stop offset="40%" stop-color="#F7941D"/>
                                <stop offset="100%" stop-color="#E07B0D"/>
                            </linearGradient>
                            <linearGradient id="shine" x1="0" y1="0" x2="0.3" y2="1">
                                <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
                                <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                            </linearGradient>
                        </defs>
                        <!-- Full orange gradient background -->
                        <rect width="1200" height="630" fill="url(#bg)"/>
                        <!-- Subtle shine overlay top-left -->
                        <rect width="1200" height="630" fill="url(#shine)"/>
                        <!-- Decorative circles -->
                        <circle cx="1100" cy="80" r="180" fill="rgba(255,255,255,0.06)"/>
                        <circle cx="1150" cy="550" r="120" fill="rgba(255,255,255,0.04)"/>
                        <circle cx="50" cy="580" r="90" fill="rgba(255,255,255,0.04)"/>
                    </svg>`
                ),
                top: 0,
                left: 0,
            },
            // === LEFT: Logo on frosted white card ===
            {
                input: Buffer.from(
                    `<svg width="500" height="520" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
                                <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="rgba(0,0,0,0.15)"/>
                            </filter>
                        </defs>
                        <rect x="10" y="10" width="480" height="500" rx="24" fill="white" filter="url(#shadow)"/>
                    </svg>`
                ),
                top: 55,
                left: 25,
            },
            {
                input: logoBuffer,
                top: 85,
                left: 45,
            },
            // === RIGHT: Premium text layout ===
            {
                input: Buffer.from(
                    `<svg width="640" height="520" xmlns="http://www.w3.org/2000/svg">
                        <!-- Title -->
                        <text x="320" y="85" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="900" font-size="58" fill="white" letter-spacing="-1">KKR Groceries</text>

                        <!-- Accent line -->
                        <rect x="200" y="110" width="240" height="4" rx="2" fill="rgba(255,255,255,0.5)"/>

                        <!-- Subtitle badge -->
                        <rect x="130" y="140" width="380" height="46" rx="23" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
                        <text x="320" y="170" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="700" font-size="22" fill="white" letter-spacing="2">B2B WHOLESALE VEGETABLES</text>

                        <!-- Description -->
                        <text x="320" y="240" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-size="22" fill="rgba(255,255,255,0.9)">Fresh vegetables at APMC wholesale</text>
                        <text x="320" y="272" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-size="22" fill="rgba(255,255,255,0.9)">prices for hotels, restaurants</text>
                        <text x="320" y="304" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-size="22" fill="rgba(255,255,255,0.9)">&amp; retailers in Hyderabad</text>

                        <!-- Feature pills -->
                        <rect x="30" y="350" width="275" height="48" rx="24" fill="white"/>
                        <text x="168" y="381" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="700" font-size="18" fill="#E07B0D">📍  Hyderabad, Telangana</text>

                        <rect x="325" y="350" width="280" height="48" rx="24" fill="white"/>
                        <text x="465" y="381" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="700" font-size="18" fill="#3A9B42">🚛  Same-day Delivery</text>

                        <!-- Bottom CTA -->
                        <rect x="100" y="430" width="440" height="56" rx="28" fill="white"/>
                        <text x="320" y="466" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="800" font-size="22" fill="#F7941D">Order Now → kkr-groceries-02.web.app</text>
                    </svg>`
                ),
                top: 55,
                left: 535,
            },
        ])
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(path.join(publicDir, "og-image.jpg"));

    const fileSize = fs.statSync(path.join(publicDir, "og-image.jpg")).size;
    console.log(`✅ og-image.jpg: 1200x630, ${(fileSize / 1024).toFixed(0)} KB`);
}

main().catch(console.error);
