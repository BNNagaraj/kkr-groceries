const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3333;
const PUBLIC = path.join(__dirname, "..", "web", "public");

const HTML = `<!DOCTYPE html>
<html><head><title>Upload KKR Logo</title>
<style>
  body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f1f5f9; }
  .drop { border: 3px dashed #064e3b; border-radius: 20px; padding: 60px; text-align: center; background: white; cursor: pointer; transition: all 0.2s; max-width: 400px; }
  .drop:hover, .drop.over { border-color: #f97316; background: #fff7ed; }
  h2 { color: #064e3b; margin: 0 0 8px; }
  p { color: #64748b; margin: 0; }
  .ok { color: #059669; font-weight: bold; font-size: 24px; }
  input { display: none; }
</style></head><body>
<div class="drop" id="drop" onclick="document.getElementById('f').click()">
  <h2>Drop KKR Groceries Logo Here</h2>
  <p>or click to browse (PNG/JPG)</p>
  <input type="file" id="f" accept="image/*">
  <div id="status"></div>
</div>
<script>
const drop = document.getElementById('drop'), f = document.getElementById('f'), st = document.getElementById('status');
drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files[0]); };
f.onchange = () => upload(f.files[0]);
function upload(file) {
  if (!file) return;
  st.textContent = 'Uploading...';
  const fd = new FormData(); fd.append('logo', file);
  fetch('/upload', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => { st.innerHTML = '<div class="ok">Done! Logo saved. You can close this tab.</div>'; })
    .catch(e => { st.textContent = 'Error: ' + e.message; });
}
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
    return;
  }
  if (req.method === "POST" && req.url === "/upload") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      // Parse multipart boundary
      const ct = req.headers["content-type"] || "";
      const bm = ct.match(/boundary=(.+)/);
      if (!bm) { res.writeHead(400); res.end("No boundary"); return; }
      const boundary = bm[1];
      const parts = buf.toString("binary").split("--" + boundary);
      for (const part of parts) {
        if (!part.includes("filename=")) continue;
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd < 0) continue;
        const body = part.slice(headerEnd + 4).replace(/\r\n$/, "");
        const imgBuf = Buffer.from(body, "binary");
        const logoPath = path.join(PUBLIC, "logo.png");
        fs.writeFileSync(logoPath, imgBuf);
        console.log("Saved logo to", logoPath, "(" + imgBuf.length + " bytes)");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, size: imgBuf.length }));
        // Auto-shutdown after save
        setTimeout(() => { console.log("Upload server shutting down."); server.close(); process.exit(0); }, 1000);
        return;
      }
      res.writeHead(400);
      res.end("No file found");
    });
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("Upload server ready at http://localhost:" + PORT);
  console.log("Drop or select your KKR Groceries logo image...");
});
