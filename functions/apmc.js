/**
 * APMC Market Rates — Cloud Function
 *
 * Fetches daily commodity prices from data.gov.in API for mandis across India.
 * Caches results in Firestore to avoid hitting API limits.
 * Cache TTL: 4 hours (single state), 6 hours (all-India multi-state).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

// data.gov.in resource for "Current Daily Price of Various Commodities"
const APMC_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
// Public API key (free tier, 1000 req/hr)
const APMC_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MULTI_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (multi-state)
const CACHE_DOC = "settings/apmc_cache";
const MULTI_CACHE_DOC = "settings/apmc_multi_cache";

// All major agricultural states in India — ordered nearest to Hyderabad first
const DEFAULT_STATES = [
  // Nearest (South & Deccan)
  "Telangana",
  "Andhra Pradesh",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Kerala",
  "Goa",
  // Central & West
  "Madhya Pradesh",
  "Gujarat",
  "Rajasthan",
  "Chhattisgarh",
  // North
  "Uttar Pradesh",
  "Punjab",
  "Haryana",
  "Delhi",
  "Uttarakhand",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  // East & Northeast
  "West Bengal",
  "Bihar",
  "Odisha",
  "Jharkhand",
  "Assam",
  "Tripura",
  "Meghalaya",
  "Manipur",
];

/**
 * fetchAPMCPrices — callable Cloud Function
 *
 * Input:  { state?: string }  (defaults to "Telangana")
 * Output: { records: APMCRecord[], fromCache: boolean, fetchedAt: string }
 */
exports.fetchAPMCPrices = onCall(
  { region: "asia-south1", memory: "256MiB" },
  async (request) => {
    const state = request.data?.state || "Telangana";

    // 1. Check cache
    try {
      const cacheSnap = await db.doc(CACHE_DOC).get();
      if (cacheSnap.exists) {
        const cache = cacheSnap.data();
        const cacheAge = Date.now() - (cache.fetchedAt?.toMillis?.() || 0);
        if (cacheAge < CACHE_TTL_MS && cache.state === state && cache.records?.length > 0) {
          return {
            records: cache.records,
            fromCache: true,
            fetchedAt: cache.fetchedAt.toDate().toISOString(),
            total: cache.records.length,
          };
        }
      }
    } catch (e) {
      console.warn("Cache read failed:", e.message);
    }

    // 2. Fetch from data.gov.in API
    let allRecords = [];
    try {
      let offset = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`https://api.data.gov.in/resource/${APMC_RESOURCE_ID}`);
        url.searchParams.set("api-key", APMC_API_KEY);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("filters[state]", state);

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error(`API returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const records = data.records || [];
        allRecords = allRecords.concat(records);

        // Check if more pages
        if (records.length < limit || allRecords.length >= (data.total || 0)) {
          hasMore = false;
        } else {
          offset += limit;
        }

        // Safety: max 2000 records
        if (allRecords.length >= 2000) break;
      }
    } catch (e) {
      console.error("data.gov.in API fetch failed:", e.message);

      // If API fails and we have stale cache, return it
      try {
        const cacheSnap = await db.doc(CACHE_DOC).get();
        if (cacheSnap.exists && cacheSnap.data().records?.length > 0) {
          const cache = cacheSnap.data();
          return {
            records: cache.records,
            fromCache: true,
            stale: true,
            fetchedAt: cache.fetchedAt.toDate().toISOString(),
            total: cache.records.length,
          };
        }
      } catch { /* ignore */ }

      throw new HttpsError("unavailable", "Unable to fetch APMC prices. Try again later.");
    }

    // 3. Normalize records — prices from API are per quintal (100 kg), convert to per kg
    const normalized = allRecords.map((r) => ({
      state: r.state || "",
      district: r.district || "",
      market: r.market || "",
      commodity: r.commodity || "",
      variety: r.variety || "",
      grade: r.grade || "",
      arrivalDate: r.arrival_date || "",
      minPrice: Math.round((Number(r.min_price) || 0) / 100),   // per quintal → per kg
      maxPrice: Math.round((Number(r.max_price) || 0) / 100),
      modalPrice: Math.round((Number(r.modal_price) || 0) / 100),
    }));

    // 4. Update cache
    try {
      await db.doc(CACHE_DOC).set({
        records: normalized,
        state,
        fetchedAt: FieldValue.serverTimestamp(),
        recordCount: normalized.length,
      });
    } catch (e) {
      console.warn("Cache write failed:", e.message);
    }

    return {
      records: normalized,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      total: normalized.length,
    };
  }
);

// ─── Helper: fetch all records for a single state (paginated) ──────────
async function fetchStateRecords(state) {
  const records = [];
  let offset = 0;
  const limit = 500;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`https://api.data.gov.in/resource/${APMC_RESOURCE_ID}`);
    url.searchParams.set("api-key", APMC_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("filters[state]", state);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API ${res.status} for ${state}`);

    const data = await res.json();
    const page = data.records || [];
    records.push(...page);

    if (page.length < limit || records.length >= (data.total || 0)) hasMore = false;
    else offset += limit;
    if (records.length >= 500) break; // per-state cap (lower for all-India to stay within limits)
  }

  return records;
}

/**
 * fetchMultiStateAPMCPrices — callable Cloud Function
 *
 * Fetches commodity prices from multiple states in parallel.
 * Input:  { states?: string[] }
 * Output: { records: APMCRecord[], fromCache, fetchedAt, stateBreakdown }
 */
exports.fetchMultiStateAPMCPrices = onCall(
  { region: "asia-south1", memory: "1GiB", timeoutSeconds: 120 },
  async (request) => {
    const states = request.data?.states || DEFAULT_STATES;
    const cacheKey = states.slice().sort().join("|");

    // 1. Check cache
    try {
      const cacheSnap = await db.doc(MULTI_CACHE_DOC).get();
      if (cacheSnap.exists) {
        const cache = cacheSnap.data();
        const cacheAge = Date.now() - (cache.fetchedAt?.toMillis?.() || 0);
        if (cacheAge < MULTI_CACHE_TTL_MS && cache.cacheKey === cacheKey && cache.records?.length > 0) {
          return {
            records: cache.records,
            fromCache: true,
            fetchedAt: cache.fetchedAt.toDate().toISOString(),
            total: cache.records.length,
            stateBreakdown: cache.stateBreakdown || {},
          };
        }
      }
    } catch (e) {
      console.warn("Multi-cache read failed:", e.message);
    }

    // 2. Fetch all states in parallel
    let allRecords = [];
    const stateBreakdown = {};
    try {
      const results = await Promise.allSettled(states.map((s) => fetchStateRecords(s)));

      for (let i = 0; i < states.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const raw = result.value;
          stateBreakdown[states[i]] = raw.length;
          // Normalize
          const normalized = raw.map((r) => ({
            state: r.state || states[i],
            district: r.district || "",
            market: r.market || "",
            commodity: r.commodity || "",
            variety: r.variety || "",
            grade: r.grade || "",
            arrivalDate: r.arrival_date || "",
            minPrice: Math.round((Number(r.min_price) || 0) / 100),
            maxPrice: Math.round((Number(r.max_price) || 0) / 100),
            modalPrice: Math.round((Number(r.modal_price) || 0) / 100),
          }));
          allRecords = allRecords.concat(normalized);
        } else {
          console.warn(`Failed to fetch ${states[i]}:`, result.reason?.message);
          stateBreakdown[states[i]] = 0;
        }
      }
    } catch (e) {
      console.error("Multi-state fetch failed:", e.message);

      // Stale cache fallback
      try {
        const cacheSnap = await db.doc(MULTI_CACHE_DOC).get();
        if (cacheSnap.exists && cacheSnap.data().records?.length > 0) {
          const cache = cacheSnap.data();
          return {
            records: cache.records,
            fromCache: true,
            stale: true,
            fetchedAt: cache.fetchedAt.toDate().toISOString(),
            total: cache.records.length,
            stateBreakdown: cache.stateBreakdown || {},
          };
        }
      } catch { /* ignore */ }

      throw new HttpsError("unavailable", "Unable to fetch multi-state APMC prices.");
    }

    if (allRecords.length === 0) {
      throw new HttpsError("not-found", "No APMC data available for the requested states.");
    }

    // 3. Update cache
    try {
      await db.doc(MULTI_CACHE_DOC).set({
        records: allRecords,
        cacheKey,
        stateBreakdown,
        fetchedAt: FieldValue.serverTimestamp(),
        recordCount: allRecords.length,
      });
    } catch (e) {
      console.warn("Multi-cache write failed:", e.message);
    }

    return {
      records: allRecords,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      total: allRecords.length,
      stateBreakdown,
    };
  }
);
