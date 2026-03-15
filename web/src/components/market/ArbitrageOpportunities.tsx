"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MapPin, TrendingUp, Leaf, Filter, RefreshCw, ArrowRight, Globe, ChevronDown } from "lucide-react";
import { ArbitrageOpportunity, matchCommodityToProduct } from "@/lib/apmc";

const MARGIN_FILTERS = [
  { label: "All", value: 3 },
  { label: "₹5+", value: 5 },
  { label: "₹10+", value: 10 },
  { label: "₹15+", value: 15 },
  { label: "₹25+", value: 25 },
  { label: "₹50+", value: 50 },
];

// Distance tier from Hyderabad for visual indicator
const STATE_DISTANCE_TIER: Record<string, "nearby" | "medium" | "far"> = {
  "Telangana": "nearby", "Andhra Pradesh": "nearby", "Karnataka": "nearby",
  "Maharashtra": "nearby", "Tamil Nadu": "nearby", "Goa": "nearby",
  "Kerala": "medium", "Madhya Pradesh": "medium", "Gujarat": "medium",
  "Chhattisgarh": "medium", "Odisha": "medium",
  "Rajasthan": "far", "Uttar Pradesh": "far", "Punjab": "far",
  "Haryana": "far", "Delhi": "far", "Uttarakhand": "far",
  "Himachal Pradesh": "far", "Jammu and Kashmir": "far",
  "West Bengal": "far", "Bihar": "far", "Jharkhand": "far",
  "Assam": "far", "Tripura": "far", "Meghalaya": "far", "Manipur": "far",
};

function distanceLabel(state: string): { text: string; color: string; dot: string } {
  const tier = STATE_DISTANCE_TIER[state] || "far";
  if (tier === "nearby") return { text: "Nearby", color: "text-emerald-600", dot: "bg-emerald-400" };
  if (tier === "medium") return { text: "Medium", color: "text-amber-600", dot: "bg-amber-400" };
  return { text: "Far", color: "text-red-500", dot: "bg-red-400" };
}

interface Props {
  opportunities: ArbitrageOpportunity[];
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>;
  loading?: boolean;
  selectedMarket: string;
  stateBreakdown?: Record<string, number>;
}

export function ArbitrageOpportunities({ opportunities, products, loading, selectedMarket, stateBreakdown }: Props) {
  const [minMargin, setMinMargin] = useState(3);
  const [showAllStates, setShowAllStates] = useState(false);

  const filtered = opportunities.filter(o => o.margin >= minMargin);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
        </div>
        <p className="text-slate-700 font-bold mb-1">Scanning All-India Markets</p>
        <p className="text-slate-400 text-sm">Fetching prices from mandis across 26 states...</p>
        <div className="mt-4 flex justify-center gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const stateEntries = stateBreakdown ? Object.entries(stateBreakdown).filter(([, count]) => count > 0).sort(([, a], [, b]) => b - a) : [];
  const visibleStates = showAllStates ? stateEntries : stateEntries.slice(0, 8);
  const totalRecords = stateEntries.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="space-y-4">
      {/* ── Filter + Stats Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            Margin:
          </div>
          <div className="flex gap-1">
            {MARGIN_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setMinMargin(f.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  minMargin === f.value
                    ? "bg-[#0a2f1f] text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs font-semibold text-slate-500">
            <span className="text-emerald-600 font-extrabold">{filtered.length}</span> opportunit{filtered.length === 1 ? "y" : "ies"}
          </div>
        </div>
      </div>

      {/* ── State Coverage ── */}
      {stateEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100/80 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-500 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">Market Coverage</h3>
              <p className="text-[10px] text-slate-400">
                {stateEntries.length} states · {totalRecords.toLocaleString("en-IN")} price records
              </p>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {visibleStates.map(([state, count]) => {
                const dist = distanceLabel(state);
                return (
                  <span
                    key={state}
                    className="inline-flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dist.dot} shrink-0`} />
                    <span className="text-slate-700 font-medium">{state}</span>
                    <span className="text-slate-400 font-mono text-[10px]">{count}</span>
                  </span>
                );
              })}
              {stateEntries.length > 8 && (
                <button
                  onClick={() => setShowAllStates(!showAllStates)}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold hover:text-emerald-700 px-2 py-1"
                >
                  {showAllStates ? "Show less" : `+${stateEntries.length - 8} more`}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showAllStates ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
            {/* Distance legend */}
            <div className="flex gap-4 mt-2.5 pt-2.5 border-t border-slate-100">
              {([["Nearby", "bg-emerald-400"], ["Medium", "bg-amber-400"], ["Far", "bg-red-400"]] as const).map(([label, dot]) => (
                <span key={label} className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── No Opportunities ── */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-slate-600 font-bold mb-1">No Arbitrage Opportunities</p>
          <p className="text-slate-400 text-sm">
            {opportunities.length > 0
              ? `Try lowering the minimum margin (currently ₹${minMargin}/kg)`
              : "No matching commodities found across states"}
          </p>
        </div>
      )}

      {/* ── Opportunity Cards ── */}
      <div className="space-y-2.5">
        {filtered.map((o, idx) => {
          const img = matchCommodityToProduct(o.commodity, products);
          const isHighMargin = o.marginPercent >= 30;
          const dist = distanceLabel(o.remoteState);

          return (
            <div
              key={`${o.commodity}-${idx}`}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                isHighMargin ? "border-emerald-200/80" : "border-slate-200/80"
              }`}
            >
              {/* High margin accent bar */}
              {isHighMargin && (
                <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
              )}

              <div className="p-4">
                {/* Header: image + name + margin */}
                <div className="flex items-center gap-3 mb-3.5">
                  {img ? (
                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200/80 shrink-0 bg-slate-50 shadow-sm">
                      <Image src={img} alt={o.commodity} width={44} height={44} className="w-full h-full object-cover" unoptimized={img.startsWith("data:")} />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 flex items-center justify-center shrink-0">
                      <Leaf className="w-5 h-5 text-emerald-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{o.commodity}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${dist.color} bg-slate-50`}>
                        {dist.text}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Cross-state price differential
                    </div>
                  </div>

                  {/* Margin badge */}
                  <div className={`shrink-0 text-right px-3 py-2 rounded-xl ${
                    isHighMargin
                      ? "bg-emerald-50 border border-emerald-200/60"
                      : "bg-slate-50 border border-slate-200/60"
                  }`}>
                    <div className={`font-extrabold text-base tabular-nums leading-none ${
                      isHighMargin ? "text-emerald-700" : "text-slate-700"
                    }`}>
                      ₹{o.margin}
                    </div>
                    <div className={`text-[10px] font-bold mt-0.5 ${
                      isHighMargin ? "text-emerald-500" : "text-slate-400"
                    }`}>
                      {o.marginPercent}% margin
                    </div>
                  </div>
                </div>

                {/* Price comparison — flow layout */}
                <div className="flex items-stretch gap-2">
                  {/* Buy (cheaper) */}
                  <div className="flex-1 bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Buy from</span>
                    </div>
                    <div className="font-extrabold text-emerald-700 text-lg tabular-nums leading-none mb-1">
                      ₹{o.remotePrice}<span className="text-xs font-bold text-emerald-500">/kg</span>
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium truncate" title={o.remoteMarket}>
                      {o.remoteMarket}
                    </div>
                    <div className="text-[10px] text-emerald-500/70">{o.remoteState}</div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center px-1">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  {/* Sell (expensive) */}
                  <div className="flex-1 bg-red-50/50 border border-red-100/80 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded-md bg-red-100 flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-red-500" />
                      </div>
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Sell at</span>
                    </div>
                    <div className="font-extrabold text-red-700 text-lg tabular-nums leading-none mb-1">
                      ₹{o.localPrice}<span className="text-xs font-bold text-red-500">/kg</span>
                    </div>
                    <div className="text-[11px] text-red-600 font-medium truncate" title={o.localMarket}>
                      {o.localMarket}
                    </div>
                    <div className="text-[10px] text-red-500/70">{o.localState}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
