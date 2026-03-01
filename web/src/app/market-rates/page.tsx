"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import {
  generateAPMCPrices,
  APMC_MARKETS,
  MARKET_LABELS,
  APMCMarket,
} from "@/lib/apmc";
import { Button } from "@/components/ui/button";

export default function MarketRatesPage() {
  const [selectedMarket, setSelectedMarket] = useState<APMCMarket>("Bowenpally");
  const [refreshKey, setRefreshKey] = useState(0);

  const prices = useMemo(
    () => generateAPMCPrices(selectedMarket),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedMarket, refreshKey]
  );

  const date = prices[0]?.date || "N/A";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#064e3b] to-[#065f46] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-emerald-100 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Store
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> APMC Live Rates
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 mt-2">
        {/* Info Banner */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-emerald-800 font-bold flex items-center gap-2 mb-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Hyderabad APMC Market Prices
            </h2>
            <p className="text-emerald-700/80 text-sm">
              Daily wholesale vegetable rates from major Hyderabad APMC markets
            </p>
          </div>
          <div className="text-xs bg-white text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-100 font-bold shadow-sm whitespace-nowrap">
            Updated: {date}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Select Market
            </label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value as APMCMarket)}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-800 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            >
              {APMC_MARKETS.map((m) => (
                <option key={m} value={m}>
                  {MARKET_LABELS[m]}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              Prices in ₹ per Kg/Piece
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Prices
          </Button>
        </div>

        {/* Price Legend */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="py-2 px-3 bg-blue-50 rounded-xl border border-blue-100">
            <TrendingDown className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Minimum
            </span>
          </div>
          <div className="py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <BarChart3 className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Modal (Avg)
            </span>
          </div>
          <div className="py-2 px-3 bg-red-50 rounded-xl border border-red-100">
            <TrendingUp className="w-4 h-4 text-red-600 mx-auto mb-0.5" />
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">
              Maximum
            </span>
          </div>
        </div>

        {/* Prices Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                  Commodity
                </th>
                <th className="px-4 py-3 text-right font-bold text-[10px] text-blue-600 uppercase tracking-wider">
                  Min ₹
                </th>
                <th className="px-4 py-3 text-right font-bold text-[10px] text-emerald-600 uppercase tracking-wider">
                  Modal ₹
                </th>
                <th className="px-4 py-3 text-right font-bold text-[10px] text-red-600 uppercase tracking-wider">
                  Max ₹
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prices.map((p, idx) => (
                <tr
                  key={p.commodity}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {p.commodity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold text-xs">
                      ₹{p.minPrice}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-sm">
                      ₹{p.modalPrice}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-semibold text-xs">
                      ₹{p.maxPrice}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Prices are indicative and may vary. Source: APMC Market Committee, Hyderabad.
        </p>
      </main>
    </div>
  );
}
