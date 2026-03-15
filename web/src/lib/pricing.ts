import type { PriceTier } from "@/contexts/AppContext";

/**
 * Resolves the effective unit price for a given quantity using whole-order slab pricing.
 * The entire quantity gets the rate of the matched tier.
 * Returns basePrice if no tiers defined or qty doesn't match any tier.
 */
export function resolveSlabPrice(
  qty: number,
  basePrice: number,
  tiers?: PriceTier[]
): number {
  if (!tiers || tiers.length === 0) return basePrice;

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const tier = sorted[i];
    const maxQty = tier.maxQty === 0 ? Infinity : tier.maxQty;
    if (qty >= tier.minQty && qty <= maxQty) {
      return tier.price;
    }
  }

  return basePrice;
}

/**
 * Returns a human-readable label for the applied slab, e.g., "101-500 @ Rs.8/Kg"
 */
export function getAppliedTierLabel(
  qty: number,
  basePrice: number,
  tiers?: PriceTier[],
  unit?: string
): string | undefined {
  if (!tiers || tiers.length === 0) return undefined;

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const tier = sorted[i];
    const maxQty = tier.maxQty === 0 ? Infinity : tier.maxQty;
    if (qty >= tier.minQty && qty <= maxQty) {
      const range =
        maxQty === Infinity
          ? `${tier.minQty}+`
          : `${tier.minQty}-${tier.maxQty}`;
      return `${range} @ \u20B9${tier.price}${unit ? "/" + unit : ""}`;
    }
  }

  return undefined;
}

/**
 * Formats tiers for display on product cards.
 */
export function formatTiersForDisplay(
  tiers: PriceTier[]
): { range: string; price: number; minQty: number; maxQty: number }[] {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  return sorted.map((t) => ({
    range: t.maxQty === 0 ? `${t.minQty}+` : `${t.minQty}-${t.maxQty}`,
    price: t.price,
    minQty: t.minQty,
    maxQty: t.maxQty,
  }));
}

/**
 * Returns the index of the active tier for a given qty, or -1 if no tier matches.
 */
export function getActiveTierIndex(
  qty: number,
  tiers: PriceTier[]
): number {
  if (!tiers || tiers.length === 0 || qty <= 0) return -1;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const maxQty = sorted[i].maxQty === 0 ? Infinity : sorted[i].maxQty;
    if (qty >= sorted[i].minQty && qty <= maxQty) return i;
  }
  return -1;
}

/**
 * Computes the "nudge" to encourage buyer to reach the next tier.
 * Returns null if already at the best tier or no tiers.
 */
export function getNextTierNudge(
  qty: number,
  basePrice: number,
  tiers: PriceTier[],
  unit: string
): { qtyNeeded: number; savingsPerUnit: number; nextPrice: number; label: string } | null {
  if (!tiers || tiers.length <= 1 || qty <= 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const activeIdx = getActiveTierIndex(qty, tiers);

  // Find the next tier after the active one
  const nextIdx = activeIdx + 1;
  if (nextIdx >= sorted.length) return null; // already at best tier

  const currentPrice = activeIdx >= 0 ? sorted[activeIdx].price : basePrice;
  const nextTier = sorted[nextIdx];
  const qtyNeeded = nextTier.minQty - qty;
  const savingsPerUnit = currentPrice - nextTier.price;

  if (qtyNeeded <= 0 || savingsPerUnit <= 0) return null;

  return {
    qtyNeeded,
    savingsPerUnit,
    nextPrice: nextTier.price,
    label: `Add ${qtyNeeded} more ${unit} to save Rs.${savingsPerUnit}/${unit}`,
  };
}
