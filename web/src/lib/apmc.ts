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
export function canonicalize(name: string): string {
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

// ─── Price History & Trends ─────────────────────────────────────────────

export interface PriceHistoryEntry {
  date: string;
  records: APMCApiRecord[];
}

export interface CommodityTrend {
  commodity: string;
  prices: { date: string; modalPrice: number }[];
  change: number;
  changePercent: number;
  direction: "up" | "down" | "stable";
  sparklinePath: string;
}

export interface SeasonInfo {
  inSeason: boolean;
  label: string;
  months: string;
}

/**
 * Fetch price history from Cloud Function.
 */
export async function fetchPriceHistory(days = 7): Promise<PriceHistoryEntry[]> {
  try {
    const fn = httpsCallable(functionsAsia, "fetchPriceHistory");
    const result = await fn({ days });
    const data = result.data as { history?: PriceHistoryEntry[] };
    return data.history ?? [];
  } catch (e) {
    console.warn("[APMC] fetchPriceHistory failed:", e);
    return [];
  }
}

/**
 * Generate an SVG path string from an array of numeric values.
 * Normalizes values to fit within the given width x height viewBox.
 */
export function generateSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `M0,${height / 2} L${width},${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // All values are the same — horizontal line at middle
  if (range === 0) return `M0,${height / 2} L${width},${height / 2}`;

  const stepX = width / (values.length - 1);
  const parts: string[] = [];

  for (let i = 0; i < values.length; i++) {
    const x = Math.round(i * stepX * 100) / 100;
    // Invert Y so higher values are at the top
    const y = Math.round((1 - (values[i] - min) / range) * height * 100) / 100;
    parts.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }

  return parts.join(" ");
}

/**
 * Compute per-commodity trends from current prices and historical data.
 */
export function computeTrends(
  currentPrices: APMCPrice[],
  history: PriceHistoryEntry[]
): CommodityTrend[] {
  const trends: CommodityTrend[] = [];

  // Sort history by date ascending
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const price of currentPrices) {
    const key = canonicalize(price.commodity);

    // Collect historical modal prices for this commodity
    const pricePoints: { date: string; modalPrice: number }[] = [];

    for (const entry of sortedHistory) {
      for (const rec of entry.records) {
        if (canonicalize(rec.commodity) === key) {
          pricePoints.push({ date: entry.date, modalPrice: rec.modalPrice });
          break; // one match per day is enough
        }
      }
    }

    // Add today's price
    pricePoints.push({ date: price.date, modalPrice: price.modalPrice });

    if (pricePoints.length < 2) {
      trends.push({
        commodity: key,
        prices: pricePoints,
        change: 0,
        changePercent: 0,
        direction: "stable",
        sparklinePath: generateSparklinePath(
          pricePoints.map(p => p.modalPrice),
          60,
          20
        ),
      });
      continue;
    }

    const firstPrice = pricePoints[0].modalPrice;
    const lastPrice = pricePoints[pricePoints.length - 1].modalPrice;
    const change = lastPrice - firstPrice;
    const changePercent =
      firstPrice > 0 ? Math.round((change / firstPrice) * 10000) / 100 : 0;

    let direction: "up" | "down" | "stable" = "stable";
    if (changePercent > 2) direction = "up";
    else if (changePercent < -2) direction = "down";

    trends.push({
      commodity: key,
      prices: pricePoints,
      change,
      changePercent,
      direction,
      sparklinePath: generateSparklinePath(
        pricePoints.map(p => p.modalPrice),
        60,
        20
      ),
    });
  }

  return trends;
}

// ─── Commodity Seasons (South India / Hyderabad context) ────────────────

export const COMMODITY_SEASONS: Record<
  string,
  { months: number[]; peakMonths?: number[] }
> = {
  "tomato": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [11,12,1,2,3] },
  "onion": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [11,12,1,2,3,4,6,7,8,9] },
  "green chilli": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [10,11,12,1,2,3] },
  "cauliflower": { months: [10,11,12,1,2,3] },
  "cabbage": { months: [10,11,12,1,2,3] },
  "carrot": { months: [10,11,12,1,2,3] },
  "green peas": { months: [11,12,1,2,3] },
  "spinach": { months: [10,11,12,1,2,3] },
  "cucumber": { months: [2,3,4,5,6] },
  "bottle gourd": { months: [2,3,4,5,6,9,10,11] },
  "drumstick": { months: [2,3,4,5] },
  "raw mango": { months: [2,3,4,5] },
  "brinjal": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [10,11,12,1,2,3] },
  "lady finger": { months: [3,4,5,6,7,8,9,10], peakMonths: [5,6,7,8] },
  "capsicum": { months: [10,11,12,1,2,3,4], peakMonths: [11,12,1,2] },
  "bitter gourd": { months: [3,4,5,6,7,8,9], peakMonths: [5,6,7] },
  "cluster beans": { months: [6,7,8,9,10], peakMonths: [7,8,9] },
  "potato": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [12,1,2,3] },
  "beetroot": { months: [10,11,12,1,2,3] },
  "radish": { months: [10,11,12,1,2,3] },
  "garlic": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [2,3,4,5] },
  "ginger": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [11,12,1,2,3] },
  "sweet potato": { months: [10,11,12,1,2,3], peakMonths: [11,12,1] },
  "ridge gourd": { months: [3,4,5,6,7,8,9], peakMonths: [5,6,7] },
  "snake gourd": { months: [3,4,5,6,7,8], peakMonths: [4,5,6] },
  "ash gourd": { months: [6,7,8,9,10,11], peakMonths: [8,9,10] },
  "pumpkin": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [9,10,11,12] },
  "coriander": { months: [10,11,12,1,2,3], peakMonths: [11,12,1] },
  "mint": { months: [10,11,12,1,2,3], peakMonths: [11,12,1,2] },
  "curry leaves": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [3,4,5,6] },
  "methi": { months: [10,11,12,1,2,3], peakMonths: [11,12,1] },
  "french beans": { months: [10,11,12,1,2,3], peakMonths: [11,12,1,2] },
  "broad beans": { months: [10,11,12,1,2,3] },
  "banana": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [3,4,5,9,10,11] },
  "lemon": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [6,7,8,9] },
  "coconut": { months: [1,2,3,4,5,6,7,8,9,10,11,12], peakMonths: [1,2,3,8,9,10] },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Convert a sorted array of month numbers to a human-readable range string.
 * e.g. [10,11,12,1,2,3] → "Oct-Mar"
 */
function monthRangeLabel(months: number[]): string {
  if (months.length === 0) return "";
  if (months.length === 12) return "Year-round";
  return `${MONTH_NAMES[months[0] - 1]}-${MONTH_NAMES[months[months.length - 1] - 1]}`;
}

/**
 * Get season information for a commodity.
 */
export function getSeasonInfo(commodity: string, month?: number): SeasonInfo {
  const key = canonicalize(commodity);
  const now = month ?? new Date().getMonth() + 1; // 1-based
  const season = COMMODITY_SEASONS[key];

  if (!season) {
    return { inSeason: true, label: "Year-round", months: "Year-round" };
  }

  const inSeason = season.months.includes(now);
  return {
    inSeason,
    label: inSeason ? "In Season" : "Off Season",
    months: monthRangeLabel(season.months),
  };
}

// ─── Market Hours ───────────────────────────────────────────────────────

export const MARKET_HOURS: Record<string, { open: number; close: number }> = {
  "Bowenpally": { open: 4, close: 10 },
  "Gaddiannaram": { open: 4, close: 10 },
  "Gudimalkapur": { open: 5, close: 11 },
  "Monda": { open: 4, close: 10 },
};

/**
 * Check if a market is currently open based on IST time.
 */
export function isMarketOpen(market: string): boolean {
  const hours = MARKET_HOURS[market];
  if (!hours) return false;

  // Get current IST hour (UTC+5:30)
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000;
  const istHour = new Date(istMs).getHours();

  return istHour >= hours.open && istHour < hours.close;
}

// ─── WhatsApp & CSV Export ──────────────────────────────────────────────

/**
 * Generate a formatted text message for WhatsApp sharing.
 */
export function generateWhatsAppMessage(
  prices: APMCPrice[],
  supplySignals: SupplySignal[],
  market: string,
  date: string
): string {
  const lines: string[] = [];

  lines.push(`📊 *${market} Mandi Prices*`);
  lines.push(`📅 ${date}`);
  lines.push("");

  // Top shortages
  const shortages = supplySignals
    .filter(s => s.signal === "shortage")
    .slice(0, 3);
  if (shortages.length > 0) {
    lines.push("🔴 *Shortages:*");
    for (const s of shortages) {
      lines.push(`  ${s.commodity} — ₹${s.modalPrice}/kg (${s.signalStrength}%)`);
    }
    lines.push("");
  }

  // Top surpluses
  const surpluses = supplySignals
    .filter(s => s.signal === "surplus")
    .slice(0, 3);
  if (surpluses.length > 0) {
    lines.push("🟢 *Surpluses:*");
    for (const s of surpluses) {
      lines.push(`  ${s.commodity} — ₹${s.modalPrice}/kg (${s.signalStrength}%)`);
    }
    lines.push("");
  }

  // Top 10 prices
  const sorted = [...prices].sort((a, b) => a.commodity.localeCompare(b.commodity)).slice(0, 10);
  lines.push("💰 *Top Prices:*");
  for (const p of sorted) {
    lines.push(`  ${p.commodity}: ₹${p.minPrice}-${p.maxPrice} (modal ₹${p.modalPrice})`);
  }

  lines.push("");
  lines.push("_via KKR Groceries_");

  return lines.join("\n");
}

/**
 * Export prices to CSV format string.
 */
export function exportPricesToCSV(
  prices: APMCPrice[],
  market: string,
  date: string
): string {
  const rows: string[] = [];
  rows.push("Commodity,Variety,Min Price,Modal Price,Max Price,Market,Date");

  for (const p of prices) {
    const variety = p.variety ? `"${p.variety.replace(/"/g, '""')}"` : "";
    const commodity = `"${p.commodity.replace(/"/g, '""')}"`;
    rows.push(
      `${commodity},${variety},${p.minPrice},${p.modalPrice},${p.maxPrice},"${market}",${date}`
    );
  }

  return rows.join("\n");
}
