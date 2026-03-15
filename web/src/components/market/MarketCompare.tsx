"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Leaf, BarChart3, AlertTriangle, Award, GitCompare, X, Check,
} from "lucide-react";
import {
  APMCApiRecord,
  matchCommodityToProduct,
  canonicalize,
  isMarketOpen,
} from "@/lib/apmc";

/* ─── Types ────────────────────────────────────────────────────────────── */

interface Props {
  apiRecords: APMCApiRecord[] | null;
  markets: string[];
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>;
}

interface MarketCommodityPrice {
  minPrice: number;
  modalPrice: number;
  maxPrice: number;
  variety?: string;
}

/* ═══════════════ Main Component ═══════════════ */

export function MarketCompare({ apiRecords, markets, products }: Props) {
  const MAX_MARKETS = 4;
  const defaultSelected = markets.slice(0, Math.min(3, markets.length));
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(defaultSelected);

  // Toggle market selection
  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev => {
      if (prev.includes(market)) {
        return prev.filter(m => m !== market);
      }
      if (prev.length >= MAX_MARKETS) return prev;
      return [...prev, market];
    });
  };

  // Build comparison matrix
  const { commodities, matrix, summaries } = useMemo(() => {
    if (!apiRecords || selectedMarkets.length < 2) {
      return { commodities: [], matrix: new Map(), summaries: new Map() };
    }

    // Group records by market -> commodity (canonical)
    const byMarket = new Map<string, Map<string, MarketCommodityPrice>>();
    for (const market of selectedMarkets) {
      byMarket.set(market, new Map());
    }

    for (const r of apiRecords) {
      if (!selectedMarkets.includes(r.market)) continue;
      if (r.modalPrice <= 0) continue;

      let key: string;
      try {
        key = canonicalize(r.commodity);
      } catch {
        key = r.commodity.toLowerCase().trim();
      }

      const marketMap = byMarket.get(r.market);
      if (!marketMap) continue;

      // Keep the first occurrence per canonical commodity per market
      if (!marketMap.has(key)) {
        marketMap.set(key, {
          minPrice: r.minPrice,
          modalPrice: r.modalPrice,
          maxPrice: r.maxPrice,
          variety: r.variety,
        });
      }
    }

    // Find commodities that appear in at least 2 selected markets
    const allKeys = new Set<string>();
    for (const [, commodityMap] of byMarket) {
      for (const key of commodityMap.keys()) {
        allKeys.add(key);
      }
    }

    const commonCommodities: string[] = [];
    const matrixData = new Map<string, Map<string, MarketCommodityPrice | null>>();

    for (const key of allKeys) {
      let marketCount = 0;
      const row = new Map<string, MarketCommodityPrice | null>();

      for (const market of selectedMarkets) {
        const price = byMarket.get(market)?.get(key) || null;
        row.set(market, price);
        if (price) marketCount++;
      }

      if (marketCount >= 2) {
        commonCommodities.push(key);
        matrixData.set(key, row);
      }
    }

    // Sort commodities alphabetically
    commonCommodities.sort((a, b) => a.localeCompare(b));

    // Compute per-market summaries
    const summaryData = new Map<string, { cheapestCount: number; avgPrice: number }>();
    for (const market of selectedMarkets) {
      let cheapestCount = 0;
      let totalPrice = 0;
      let priceCount = 0;

      for (const commodityKey of commonCommodities) {
        const row = matrixData.get(commodityKey);
        if (!row) continue;

        const price = row.get(market);
        if (price) {
          totalPrice += price.modalPrice;
          priceCount++;

          // Check if this market is cheapest for this commodity
          let isCheapest = true;
          for (const otherMarket of selectedMarkets) {
            if (otherMarket === market) continue;
            const otherPrice = row.get(otherMarket);
            if (otherPrice && otherPrice.modalPrice < price.modalPrice) {
              isCheapest = false;
              break;
            }
          }
          if (isCheapest) cheapestCount++;
        }
      }

      summaryData.set(market, {
        cheapestCount,
        avgPrice: priceCount > 0 ? Math.round(totalPrice / priceCount) : 0,
      });
    }

    return { commodities: commonCommodities, matrix: matrixData, summaries: summaryData };
  }, [apiRecords, selectedMarkets]);

  // ── Not enough markets available ──
  if (markets.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-600 font-bold mb-1">Need at Least 2 Markets</p>
        <p className="text-slate-400 text-sm">Market comparison requires data from multiple markets</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Market Selector ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100/80 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-500 flex items-center justify-center">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Select Markets</h3>
            <p className="text-[10px] text-slate-400">
              Choose 2–{MAX_MARKETS} markets to compare · {selectedMarkets.length} selected
            </p>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {markets.map((market) => {
              const isSelected = selectedMarkets.includes(market);
              const isDisabled = !isSelected && selectedMarkets.length >= MAX_MARKETS;

              let marketOpen = false;
              try { marketOpen = isMarketOpen(market); } catch { /* not available yet */ }

              return (
                <button
                  key={market}
                  onClick={() => !isDisabled && toggleMarket(market)}
                  disabled={isDisabled}
                  className={`shrink-0 flex items-center gap-2 text-xs px-3 py-2 rounded-xl font-bold transition-all border ${
                    isSelected
                      ? "bg-[#0a2f1f] text-white border-emerald-700 shadow-sm"
                      : isDisabled
                        ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                        : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {/* Market open indicator */}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    marketOpen ? "bg-emerald-400" : "bg-red-400"
                  }`} />
                  <span className="truncate max-w-[120px]">{market}</span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Not enough selected ── */}
      {selectedMarkets.length < 2 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <GitCompare className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-slate-600 font-bold mb-1">Select at Least 2 Markets</p>
          <p className="text-slate-400 text-sm">Tap on markets above to start comparing</p>
        </div>
      )}

      {/* ── No common commodities ── */}
      {selectedMarkets.length >= 2 && commodities.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-slate-600 font-bold mb-1">No Matching Commodities</p>
          <p className="text-slate-400 text-sm">No matching commodities across selected markets</p>
        </div>
      )}

      {/* ── Summary Row ── */}
      {selectedMarkets.length >= 2 && commodities.length > 0 && (
        <div className={`grid gap-2.5`} style={{ gridTemplateColumns: `repeat(${selectedMarkets.length}, minmax(0, 1fr))` }}>
          {selectedMarkets.map((market) => {
            const summary = summaries.get(market);
            if (!summary) return null;
            return (
              <div key={market} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate mb-1.5" title={market}>
                  {market}
                </div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Award className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-lg font-extrabold text-emerald-700 tabular-nums">{summary.cheapestCount}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">cheapest items</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Avg <span className="font-bold text-slate-600">₹{summary.avgPrice}</span>/kg
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Comparison Table ── */}
      {selectedMarkets.length >= 2 && commodities.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {commodities.length} Commodities Compared
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              {/* Table head */}
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[140px] min-w-[140px]">
                    Commodity
                  </th>
                  {selectedMarkets.map((market) => {
                    let marketOpen = false;
                    try { marketOpen = isMarketOpen(market); } catch { /* not available yet */ }

                    return (
                      <th key={market} className="px-3 py-2.5 text-center min-w-[90px]">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider truncate" title={market}>
                          {market}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full ${
                          marketOpen
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-500"
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${marketOpen ? "bg-emerald-400" : "bg-red-400"}`} />
                          {marketOpen ? "Open" : "Closed"}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table body */}
              <tbody className="divide-y divide-slate-100/80">
                {commodities.map((commodityKey) => {
                  const row = matrix.get(commodityKey);
                  if (!row) return null;

                  // Find cheapest and most expensive across this row
                  let cheapest = Infinity;
                  let mostExpensive = 0;
                  for (const market of selectedMarkets) {
                    const price = row.get(market);
                    if (price) {
                      if (price.modalPrice < cheapest) cheapest = price.modalPrice;
                      if (price.modalPrice > mostExpensive) mostExpensive = price.modalPrice;
                    }
                  }

                  // Get display name — use the variety or original commodity name from first available record
                  let displayName = commodityKey;
                  for (const market of selectedMarkets) {
                    const price = row.get(market);
                    if (price?.variety && price.variety !== "Other") {
                      // Use the key as display name but capitalize
                      break;
                    }
                  }
                  // Capitalize first letter of each word
                  displayName = commodityKey.replace(/\b\w/g, c => c.toUpperCase());

                  const img = matchCommodityToProduct(displayName, products);

                  return (
                    <tr key={commodityKey} className="hover:bg-emerald-50/20 transition-colors">
                      {/* Commodity name + image (sticky) */}
                      <td className="sticky left-0 z-10 bg-white px-3 py-2.5 border-r border-slate-100/80">
                        <div className="flex items-center gap-2">
                          {img ? (
                            <div className="w-6 h-6 rounded-lg overflow-hidden border border-slate-200/80 shrink-0 bg-slate-50">
                              <Image src={img} alt={displayName} width={24} height={24} className="w-full h-full object-cover" unoptimized={img.startsWith("data:")} />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-lg border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 flex items-center justify-center shrink-0">
                              <Leaf className="w-3 h-3 text-emerald-400" />
                            </div>
                          )}
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-[90px]" title={displayName}>
                            {displayName}
                          </span>
                        </div>
                      </td>

                      {/* Market price cells */}
                      {selectedMarkets.map((market) => {
                        const price = row.get(market);
                        if (!price) {
                          return (
                            <td key={market} className="px-3 py-2.5 text-center">
                              <span className="text-xs text-slate-300">—</span>
                            </td>
                          );
                        }

                        const isCheapest = price.modalPrice === cheapest && cheapest !== mostExpensive;
                        const isMostExpensive = price.modalPrice === mostExpensive && cheapest !== mostExpensive;

                        return (
                          <td key={market} className="px-3 py-2.5 text-center">
                            <span className={`inline-block text-xs font-extrabold tabular-nums px-2 py-1 rounded-lg ${
                              isCheapest
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : isMostExpensive
                                  ? "bg-red-50/60 text-red-600 border border-red-200/60"
                                  : "text-slate-700"
                            }`}>
                              ₹{price.modalPrice}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
