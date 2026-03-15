/**
 * GSTIN Verification Cloud Function.
 * - verifyGSTIN
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./utils");

// ─── GSTIN Verification (Self-Hosted — Direct GST Portal) ──────────────────
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

/** Query the GST portal with session + captcha flow (single attempt) */
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
        message: `Verified \u2014 ${data.sts || "Unknown status"}`,
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
      console.warn(`GSTIN ${gstin}: attempt ${attempt} failed \u2014 ${lastError}`);
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
