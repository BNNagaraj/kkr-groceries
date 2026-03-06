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
): { range: string; price: number }[] {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  return sorted.map((t) => ({
    range: t.maxQty === 0 ? `${t.minQty}+` : `${t.minQty}-${t.maxQty}`,
    price: t.price,
  }));
}
