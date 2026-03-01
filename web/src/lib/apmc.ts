/**
 * APMC Price Service (TypeScript port)
 * Generates simulated APMC market rates for Hyderabad area markets
 */

export interface APMCPrice {
  commodity: string;
  minPrice: number;
  modalPrice: number;
  maxPrice: number;
  date: string;
}

interface CommodityRange {
  name: string;
  bMin: number;
  bMax: number;
}

const COMMODITY_BASE_RANGES: CommodityRange[] = [
  { name: "Tomato", bMin: 18, bMax: 35 },
  { name: "Onion", bMin: 22, bMax: 45 },
  { name: "Potato", bMin: 20, bMax: 38 },
  { name: "Green Chilli", bMin: 30, bMax: 65 },
  { name: "Lady's Finger", bMin: 28, bMax: 50 },
  { name: "Brinjal", bMin: 22, bMax: 42 },
  { name: "Cauliflower", bMin: 20, bMax: 40 },
  { name: "Cabbage", bMin: 15, bMax: 30 },
  { name: "Carrot", bMin: 30, bMax: 55 },
  { name: "Spinach", bMin: 10, bMax: 25 },
  { name: "Bottle Gourd", bMin: 25, bMax: 45 },
  { name: "Ridge Gourd", bMin: 28, bMax: 50 },
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

/**
 * Generate APMC prices for a given market.
 * Uses a date+market based seed for deterministic prices per day per market.
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
    };
  });
}
