const sharp = require("sharp");
const https = require("https");

const url = "https://storage.googleapis.com/kkr-groceries-02.firebasestorage.app/branding/logo-main.png";
const SIZE = 224; // 2x retina for 112px display

https.get(url, (res) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", async () => {
    const buf = Buffer.concat(chunks);
    console.log("Original:", buf.length, "bytes");

    // Create circular mask
    const r = SIZE / 2;
    const circleSvg = `<svg width="${SIZE}" height="${SIZE}"><circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`;

    // Resize to square then apply circular crop
    const resized = await sharp(buf)
      .resize(SIZE, SIZE, { fit: "cover" })
      .png()
      .toBuffer();

    const circular = await sharp(resized)
      .composite([{ input: Buffer.from(circleSvg), blend: "dest-in" }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    require("fs").writeFileSync("/tmp/logo-email-circle.png", circular);
    console.log("Circular email logo:", circular.length, "bytes (" + SIZE + "x" + SIZE + ")");
  });
});
