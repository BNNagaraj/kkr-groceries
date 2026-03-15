/**
 * APMC Price Service
 *
 * Two sources:
 * 1. Real API — calls fetchAPMCPrices Cloud Function (data.gov.in)
 * 2. Simulated — deterministic client-side fallback when API unavailable
 *
 * Products from the catalog are matched by name to show admin-uploaded images.
 */

import { functionsAsia } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface APMCPrice {
  commodity: string;
  variety?: string;
  minPrice: number;
  modalPrice: number;
  maxPrice: number;
  date: string;
  market?: string;
  isReal?: boolean; // true = from data.gov.in API
}

export interface APMCApiRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrivalDate: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
}

interface CommodityRange {
  name: string;
  bMin: number;
  bMax: number;
}

// ─── Expanded commodity list for simulation fallback ────────────────────
// Covers most common Indian vegetables to match typical product catalogs
const COMMODITY_BASE_RANGES: CommodityRange[] = [
  // Fruit Vegetables
  { name: "Tomato", bMin: 18, bMax: 35 },
  { name: "Brinjal", bMin: 22, bMax: 42 },
  { name: "Green Chilli", bMin: 30, bMax: 65 },
  { name: "Lady Finger", bMin: 28, bMax: 50 },
  { name: "Capsicum", bMin: 35, bMax: 65 },
  { name: "Bitter Gourd", bMin: 30, bMax: 55 },
  { name: "Cucumber", bMin: 15, bMax: 30 },
  { name: "Cluster Beans", bMin: 35, bMax: 70 },
  // Roots, Tubers & Bulbs
  { name: "Onion", bMin: 22, bMax: 45 },
  { name: "Potato", bMin: 20, bMax: 38 },
  { name: "Carrot", bMin: 30, bMax: 55 },
  { name: "Beetroot", bMin: 20, bMax: 40 },
  { name: "Radish", bMin: 15, bMax: 30 },
  { name: "Garlic", bMin: 80, bMax: 200 },
  { name: "Ginger", bMin: 60, bMax: 150 },
  { name: "Sweet Potato", bMin: 20, bMax: 40 },
  // Gourds
  { name: "Bottle Gourd", bMin: 25, bMax: 45 },
  { name: "Ridge Gourd", bMin: 28, bMax: 50 },
  { name: "Snake Gourd", bMin: 25, bMax: 45 },
  { name: "Ash Gourd", bMin: 15, bMax: 30 },
  { name: "Pumpkin", bMin: 15, bMax: 35 },
  // Leafy & Herbs
  { name: "Spinach", bMin: 10, bMax: 25 },
  { name: "Coriander", bMin: 20, bMax: 50 },
  { name: "Mint", bMin: 15, bMax: 35 },
  { name: "Curry Leaves", bMin: 30, bMax: 80 },
  { name: "Methi", bMin: 15, bMax: 35 },
  // Cruciferous
  { name: "Cauliflower", bMin: 20, bMax: 40 },
  { name: "Cabbage", bMin: 15, bMax: 30 },
  { name: "Drumstick", bMin: 30, bMax: 80 },
  // Beans & Pods
  { name: "French Beans", bMin: 30, bMax: 60 },
  { name: "Broad Beans", bMin: 25, bMax: 50 },
  { name: "Green Peas", bMin: 40, bMax: 80 },
  // Fruits (commonly sold)
  { name: "Banana", bMin: 25, bMax: 50 },
  { name: "Lemon", bMin: 40, bMax: 100 },
  { name: "Raw Mango", bMin: 25, bMax: 60 },
  { name: "Coconut", bMin: 15, bMax: 30 },
];

export const APMC_MARKETS = [
  "Bowenpally",
  "Gaddiannaram",
  "Gudimalkapur",
  "Monda",
] as const;

export type APMCMarket = (typeof APMC_MARKETS)[number];

export const MARKET_LABELS: Record<APMCMarket, string> = {
  Bowenpally: "Hyderabad (Bowenpally)",
  Gaddiannaram: "Hyderabad (Gaddiannaram)",
  Gudimalkapur: "Hyderabad (Gudimalkapur)",
  Monda: "Secunderabad (Monda Market)",
};

// ─── Fuzzy name matching ────────────────────────────────────────────────
// Maps common APMC commodity names to product catalog names
const NAME_ALIASES: Record<string, string[]> = {
  "tomato": ["tomato", "tamatar", "tamata"],
  "onion": ["onion", "ullipaya", "pyaz"],
  "potato": ["potato", "aloo", "bangala dumpa"],
  "green chilli": ["green chilli", "chilli", "mirchi", "mirapa"],
  "lady finger": ["lady finger", "ladyfinger", "okra", "bhindi", "bendakaya", "lady's finger"],
  "brinjal": ["brinjal", "eggplant", "vankaya", "baingan"],
  "cauliflower": ["cauliflower", "gobi", "cauliflower gobi"],
  "cabbage": ["cabbage", "patta gobi"],
  "carrot": ["carrot", "gajar"],
  "spinach": ["spinach", "palak", "palakura"],
  "bottle gourd": ["bottle gourd", "lauki", "sorakaya", "anapakaya"],
  "ridge gourd": ["ridge gourd", "turai", "beerakaya"],
  "capsicum": ["capsicum", "bell pepper", "shimla mirch"],
  "bitter gourd": ["bitter gourd", "karela", "kakarakaya"],
  "cucumber": ["cucumber", "kheera", "dosakaya"],
  "drumstick": ["drumstick", "moringa", "munagakaya"],
  "coriander": ["coriander", "dhaniya", "kothimeera"],
  "mint": ["mint", "pudina"],
  "beans": ["beans", "french beans", "broad beans"],
  "cluster beans": ["cluster beans", "guar", "goruchikkudu"],
  "beetroot": ["beetroot", "beet root", "beet"],
  "radish": ["radish", "mooli", "mullangi"],
  "garlic": ["garlic", "lahsun", "vellulli"],
  "ginger": ["ginger", "adrak", "allam"],
  "pumpkin": ["pumpkin", "kaddu", "gummadikaya"],
  "green peas": ["green peas", "peas", "matar", "batani"],
  "banana": ["banana", "kela", "arati pandu"],
  "lemon": ["lemon", "lime", "nimbu", "nimmakaya"],
  "coconut": ["coconut", "nariyal", "kobbari"],
  "curry leaves": ["curry leaves", "kadi patta", "karivepaku"],
  "methi": ["methi", "fenugreek", "menthi"],
  "snake gourd": ["snake gourd", "potlakaya"],
  "ash gourd": ["ash gourd", "boodida gummadikaya"],
  "sweet potato": ["sweet potato", "shakarkandi", "genasulu"],
  "raw mango": ["raw mango", "kairi"],
};

/**
 * Match an APMC commodity name to a product from the catalog.
 * Returns the product's image URL if matched, undefined otherwise.
 */
export function matchCommodityToProduct(
  commodityName: string,
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>
): string | undefined {
  const lower = commodityName.toLowerCase().trim();

  for (const product of products) {
    const pName = product.name.toLowerCase().trim();

    // Direct match
    if (pName === lower || pName.includes(lower) || lower.includes(pName)) {
      return product.image;
    }

    // Check aliases
    for (const [, aliases] of Object.entries(NAME_ALIASES)) {
      const matchesCommodity = aliases.some(a => lower.includes(a) || a.includes(lower));
      const matchesProduct = aliases.some(a => pName.includes(a) || a.includes(pName));
      if (matchesCommodity && matchesProduct) {
        return product.image;
      }
    }

    // Check Telugu/Hindi names
    if (product.telugu && product.telugu.toLowerCase().includes(lower)) return product.image;
    if (product.hindi && product.hindi.toLowerCase().includes(lower)) return product.image;
  }

  return undefined;
}

// ─── Analytics types ────────────────────────────────────────────────────

export interface SupplySignal {
  commodity: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  bMin: number;        // base range min
  bMax: number;        // base range max
  signal: "surplus" | "shortage" | "normal";
  signalStrength: number; // 0-100
  spreadRatio: number;    // (max-min)/modal
  position: number;       // 0-1, where modal sits in bMin..bMax range
}

export interface ArbitrageOpportunity {
  commodity: string;
  localPrice: number;
  localMarket: string;
  localState: string;
  remotePrice: number;
  remoteMarket: string;
  remoteState: string;
  margin: number;
  marginPercent: number;
}

/**
 * Fetch real APMC prices from data.gov.in via Cloud Function.
 * Returns null if the call fails (caller should fall back to simulated).
 */
export async function fetchRealAPMCPrices(): Promise<{
  records: APMCApiRecord[];
  fromCache: boolean;
  fetchedAt: string;
  total: number;
} | null> {
  try {
    const fn = httpsCallable(functionsAsia, "fetchAPMCPrices");
    const result = await fn({ state: "Telangana" });
    return result.data as any;
  } catch (e) {
    console.warn("[APMC] Cloud Function failed, falling back to simulated:", e);
    return null;
  }
}

/**
 * Convert API records to APMCPrice[] grouped by market.
 */
export function apiRecordsToPrices(records: APMCApiRecord[], market?: string): APMCPrice[] {
  // Filter by market if specified
  let filtered = records;
  if (market) {
    const marketLower = market.toLowerCase();
    filtered = records.filter(r =>
      r.market.toLowerCase().includes(marketLower) ||
      marketLower.includes(r.market.toLowerCase().split("(")[0].trim())
    );
  }

  // Dedupe by commodity (keep latest/first occurrence)
  const seen = new Map<string, APMCPrice>();
  for (const r of filtered) {
    const key = r.commodity.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        commodity: r.commodity,
        variety: r.variety,
        minPrice: r.minPrice,
        modalPrice: r.modalPrice,
        maxPrice: r.maxPrice,
        date: r.arrivalDate,
        market: r.market,
        isReal: true,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.commodity.localeCompare(b.commodity));
}

/**
 * Get unique markets from API records.
 */
export function getMarketsFromRecords(records: APMCApiRecord[]): string[] {
  const markets = new Set<string>();
  for (const r of records) {
    if (r.market) markets.add(r.market);
  }
  return Array.from(markets).sort();
}

/**
 * Generate simulated APMC prices (deterministic fallback).
 * Uses a date+market based seed for consistent prices per day per market.
 */
export function generateAPMCPrices(marketName: APMCMarket = "Bowenpally"): APMCPrice[] {
  const d = new Date();

  let marketHash = 0;
  for (let i = 0; i < marketName.length; i++) {
    marketHash += marketName.charCodeAt(i);
  }

  const seed =
    d.getFullYear() * 10000 +
    (d.getMonth() + 1) * 100 +
    d.getDate() +
    marketHash;

  return COMMODITY_BASE_RANGES.map((c, i) => {
    const h = ((seed * (i + 7)) % 1000) / 1000;
    const min = c.bMin + Math.floor(h * (c.bMax - c.bMin) * 0.4);
    const max =
      c.bMin +
      Math.floor(h * (c.bMax - c.bMin) * 0.8) +
      Math.floor((c.bMax - c.bMin) * 0.3);
    const modal = Math.floor((min + max) / 2);

    return {
      commodity: c.name,
      minPrice: min,
      maxPrice: Math.min(max, c.bMax),
      modalPrice: modal,
      date: d.toISOString().split("T")[0],
      isReal: false,
    };
  });
}

// ─── Multi-state fetch ──────────────────────────────────────────────────

export async function fetchMultiStateAPMCPrices(): Promise<{
  records: APMCApiRecord[];
  fromCache: boolean;
  fetchedAt: string;
  total: number;
  stateBreakdown: Record<string, number>;
} | null> {
  try {
    const fn = httpsCallable(functionsAsia, "fetchMultiStateAPMCPrices");
    const result = await fn({});
    return result.data as any;
  } catch (e) {
    console.warn("[APMC] Multi-state fetch failed:", e);
    return null;
  }
}

// ─── Supply Signal computation ──────────────────────────────────────────

/**
 * Normalize a commodity name to a canonical key for matching.
 */
function canonicalize(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(NAME_ALIASES)) {
    if (aliases.some(a => lower.includes(a) || a.includes(lower))) {
      return canonical;
    }
  }
  return lower;
}

/**
 * Compute supply signals from price data.
 * Uses COMMODITY_BASE_RANGES as reference baseline.
 * Works with both real API data and simulated data.
 */
export function computeSupplySignals(prices: APMCPrice[]): SupplySignal[] {
  // Build a lookup of base ranges by canonical name
  const rangeMap = new Map<string, CommodityRange>();
  for (const r of COMMODITY_BASE_RANGES) {
    rangeMap.set(canonicalize(r.name), r);
  }

  // Group prices by canonical commodity name, averaging across markets
  const grouped = new Map<string, { name: string; modals: number[]; mins: number[]; maxs: number[] }>();
  for (const p of prices) {
    const key = canonicalize(p.commodity);
    if (!grouped.has(key)) {
      grouped.set(key, { name: p.commodity, modals: [], mins: [], maxs: [] });
    }
    const g = grouped.get(key)!;
    g.modals.push(p.modalPrice);
    g.mins.push(p.minPrice);
    g.maxs.push(p.maxPrice);
  }

  const signals: SupplySignal[] = [];
  for (const [key, g] of grouped) {
    const range = rangeMap.get(key);
    if (!range) continue; // skip commodities without a baseline

    const avgModal = Math.round(g.modals.reduce((a, b) => a + b, 0) / g.modals.length);
    const avgMin = Math.round(g.mins.reduce((a, b) => a + b, 0) / g.mins.length);
    const avgMax = Math.round(g.maxs.reduce((a, b) => a + b, 0) / g.maxs.length);

    const midpoint = (range.bMin + range.bMax) / 2;
    const rangeSpan = range.bMax - range.bMin;
    if (rangeSpan === 0) continue;

    // Position: 0 = at bMin (cheapest), 1 = at bMax (most expensive)
    const position = Math.max(0, Math.min(1, (avgModal - range.bMin) / rangeSpan));

    // Signal: below 0.4 = surplus, above 0.6 = shortage
    let signal: "surplus" | "shortage" | "normal" = "normal";
    let signalStrength = 0;

    if (position < 0.4) {
      signal = "surplus";
      signalStrength = Math.round((0.4 - position) / 0.4 * 100);
    } else if (position > 0.6) {
      signal = "shortage";
      signalStrength = Math.round((position - 0.6) / 0.4 * 100);
    }

    const spreadRatio = avgModal > 0 ? Math.round((avgMax - avgMin) / avgModal * 100) : 0;

    signals.push({
      commodity: g.name,
      modalPrice: avgModal,
      minPrice: avgMin,
      maxPrice: avgMax,
      bMin: range.bMin,
      bMax: range.bMax,
      signal,
      signalStrength: Math.min(100, signalStrength),
      spreadRatio,
      position,
    });
  }

  // Sort: shortages first (desc strength), then surpluses (desc strength), then normal
  return signals.sort((a, b) => {
    const order = { shortage: 0, surplus: 1, normal: 2 };
    if (order[a.signal] !== order[b.signal]) return order[a.signal] - order[b.signal];
    return b.signalStrength - a.signalStrength;
  });
}

// ─── Arbitrage computation ──────────────────────────────────────────────

/**
 * Compute arbitrage opportunities by comparing local Hyderabad prices
 * with prices from other states.
 */
export function computeArbitrageOpportunities(
  localPrices: APMCPrice[],
  multiStateRecords: APMCApiRecord[],
  localMarketName: string
): ArbitrageOpportunity[] {
  // Build local price map by canonical name
  const localMap = new Map<string, APMCPrice>();
  for (const p of localPrices) {
    localMap.set(canonicalize(p.commodity), p);
  }

  // Group remote records by canonical commodity
  const remoteMap = new Map<string, { price: number; market: string; state: string }[]>();
  for (const r of multiStateRecords) {
    // Skip Telangana records (we're comparing against them)
    if (r.state === "Telangana") continue;
    if (r.modalPrice <= 0) continue;

    const key = canonicalize(r.commodity);
    if (!remoteMap.has(key)) remoteMap.set(key, []);
    remoteMap.get(key)!.push({
      price: r.modalPrice,
      market: r.market,
      state: r.state,
    });
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const [key, localPrice] of localMap) {
    const remotes = remoteMap.get(key);
    if (!remotes || remotes.length === 0) continue;

    // Find cheapest remote
    const cheapest = remotes.reduce((a, b) => (a.price < b.price ? a : b));
    const margin = localPrice.modalPrice - cheapest.price;
    if (margin <= 0) continue; // no opportunity if remote is more expensive

    const marginPercent = localPrice.modalPrice > 0
      ? Math.round(margin / localPrice.modalPrice * 100)
      : 0;

    // Only include meaningful opportunities
    if (margin < 3 && marginPercent < 15) continue;

    opportunities.push({
      commodity: localPrice.commodity,
      localPrice: localPrice.modalPrice,
      localMarket: localPrice.market || localMarketName,
      localState: "Telangana",
      remotePrice: cheapest.price,
      remoteMarket: cheapest.market,
      remoteState: cheapest.state,
      margin,
      marginPercent,
    });
  }

  return opportunities.sort((a, b) => b.margin - a.margin);
}
