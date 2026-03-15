"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import {
  X, Leaf, TrendingUp, TrendingDown, Minus, Calendar,
  Award, MapPin, BarChart3, Activity, Zap, ShieldCheck, ArrowDown,
} from "lucide-react";
import {
  APMCPrice,
  APMCApiRecord,
  matchCommodityToProduct,
  getSeasonInfo,
  isMarketOpen,
  canonicalize,
} from "@/lib/apmc";

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface PriceHistoryEntry {
  date: string;
  minPrice: number;
  modalPrice: number;
  maxPrice: number;
}

interface Props {
  commodity: string;
  currentPrice: APMCPrice;
  history: PriceHistoryEntry[];
  allMarketPrices: APMCPrice[];
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>;
  onClose: () => void;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shortDay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return DAY_LABELS[d.getDay()] || dateStr.slice(-2);
  } catch {
    return dateStr.slice(-2);
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

/* ═══════════════ Main Component ═══════════════ */

export function CommodityDeepDive({
  commodity,
  currentPrice,
  history,
  allMarketPrices,
  products,
  onClose,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const img = matchCommodityToProduct(commodity, products);
  const matchedProduct = products.find(p => {
    const pName = p.name.toLowerCase().trim();
    const cName = commodity.toLowerCase().trim();
    return pName === cName || pName.includes(cName) || cName.includes(pName);
  });

  // Season info
  const seasonInfo = getSeasonInfo(commodity);
  const season = {
    name: seasonInfo.label,
    emoji: seasonInfo.inSeason ? "🟢" : "🔴",
    months: seasonInfo.months,
  };

  // History stats
  const historyModals = history.map(h => h.modalPrice);
  const historyMin = historyModals.length > 0 ? Math.min(...historyModals) : 0;
  const historyMax = historyModals.length > 0 ? Math.max(...historyModals) : 0;
  const historyAvg = historyModals.length > 0
    ? Math.round(historyModals.reduce((a, b) => a + b, 0) / historyModals.length)
    : 0;

  // Market comparison: find cheapest
  const sortedMarkets = [...allMarketPrices].sort((a, b) => a.modalPrice - b.modalPrice);
  const cheapestPrice = sortedMarkets.length > 0 ? sortedMarkets[0].modalPrice : 0;

  // Supply signal (inline computation matching SupplySignals pattern)
  const signal = computeInlineSignal(currentPrice);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-300"
      >
        {/* ── Section 1: HEADER ── */}
        <div className="relative bg-gradient-to-br from-[#0a2f1f] via-[#0d3b28] to-[#062019] px-5 pt-5 pb-6 rounded-t-3xl sm:rounded-t-3xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-4">
            {/* Product image */}
            {img ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 bg-white/10 shadow-lg">
                <Image
                  src={img}
                  alt={commodity}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized={img.startsWith("data:")}
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl border-2 border-emerald-400/30 bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Leaf className="w-7 h-7 text-emerald-300" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold text-white tracking-tight truncate">
                {commodity}
              </h2>
              {matchedProduct?.telugu && (
                <p className="text-emerald-200/80 text-sm mt-0.5">{matchedProduct.telugu}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/20">
                  {season.emoji} {season.name} · {season.months}
                </span>
              </div>
            </div>

            {/* Current price */}
            <div className="shrink-0 text-right">
              <div className="text-2xl font-extrabold text-white tabular-nums leading-none">
                ₹{currentPrice.modalPrice}
              </div>
              <div className="text-emerald-200/80 text-xs mt-1">per kg</div>
            </div>
          </div>
        </div>

        {/* ── Section 2: PRICE CHART ── */}
        {history.length >= 2 && (
          <div className="px-5 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                7-Day Trend
              </h3>
              <div className="flex gap-3 text-[10px] font-bold">
                <span className="text-blue-500">Min ₹{historyMin}</span>
                <span className="text-emerald-600">Avg ₹{historyAvg}</span>
                <span className="text-red-500">Max ₹{historyMax}</span>
              </div>
            </div>

            <PriceChart history={history} />
          </div>
        )}

        {/* ── Section 3: DAILY BREAKDOWN ── */}
        {history.length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              Daily Breakdown
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200/80">
              {/* Table header */}
              <div className="grid grid-cols-4 gap-0 bg-slate-50 border-b border-slate-200/80 px-3 py-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</span>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider text-right">Min</span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-right">Modal</span>
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider text-right">Max</span>
              </div>
              {/* Table rows */}
              <div className="divide-y divide-slate-100/80">
                {history.map((h, idx) => {
                  const isToday = idx === history.length - 1;
                  return (
                    <div
                      key={h.date}
                      className={`grid grid-cols-4 gap-0 px-3 py-2.5 ${isToday ? "bg-emerald-50/40" : "hover:bg-slate-50/50"} transition-colors`}
                    >
                      <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                        {formatDate(h.date)}
                        {isToday && (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Today
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-blue-600/80 font-semibold tabular-nums text-right">₹{h.minPrice}</span>
                      <span className="text-xs text-emerald-700 font-extrabold tabular-nums text-right">₹{h.modalPrice}</span>
                      <span className="text-xs text-red-600/80 font-semibold tabular-nums text-right">₹{h.maxPrice}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Section 4: MARKET COMPARISON ── */}
        {sortedMarkets.length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-emerald-500" />
              Market Comparison
              <span className="text-[10px] font-medium text-slate-400 ml-auto">
                {sortedMarkets.length} market{sortedMarkets.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <div className="space-y-2">
              {sortedMarkets.map((mp, idx) => {
                const isCheapest = mp.modalPrice === cheapestPrice;
                let marketOpen = false;
                try { marketOpen = isMarketOpen(mp.market || ""); } catch { /* not available yet */ }

                return (
                  <div
                    key={`${mp.market}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      isCheapest
                        ? "bg-emerald-50/60 border-emerald-200/80"
                        : "bg-white border-slate-200/60 hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Market icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCheapest ? "bg-emerald-100 text-emerald-500" : "bg-slate-100 text-slate-400"
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>

                    {/* Market name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {mp.market || "Unknown Market"}
                        </span>
                        {isCheapest && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-0.5 shrink-0">
                            <Award className="w-2.5 h-2.5" />
                            Best Price
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        ₹{mp.minPrice}–₹{mp.maxPrice} range
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <div className={`font-extrabold text-sm tabular-nums ${
                        isCheapest ? "text-emerald-700" : "text-slate-700"
                      }`}>
                        ₹{mp.modalPrice}/kg
                      </div>
                      {mp.variety && mp.variety !== "Other" && mp.variety !== commodity && (
                        <div className="text-[10px] text-slate-400">{mp.variety}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section 5: SUPPLY SIGNAL ── */}
        <div className="px-5 py-4 pb-8">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-500" />
            Supply Signal
          </h3>

          <SupplySignalBar signal={signal} commodity={commodity} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Price Chart (SVG) ═══════════════ */

function PriceChart({ history }: { history: PriceHistoryEntry[] }) {
  if (history.length < 2) return null;

  const W = 320;
  const H = 150;
  const PAD_X = 36;
  const PAD_Y = 20;
  const PAD_BOTTOM = 28;

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y - PAD_BOTTOM;

  const modals = history.map(h => h.modalPrice);
  const allPrices = history.flatMap(h => [h.minPrice, h.modalPrice, h.maxPrice]);
  const yMin = Math.min(...allPrices) - 2;
  const yMax = Math.max(...allPrices) + 2;
  const yRange = yMax - yMin || 1;

  const toX = (i: number) => PAD_X + (i / (history.length - 1)) * chartW;
  const toY = (val: number) => PAD_Y + (1 - (val - yMin) / yRange) * chartH;

  // Build line path for modal prices
  const linePath = modals
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");

  // Build fill area path
  const fillPath =
    linePath +
    ` L ${toX(history.length - 1).toFixed(1)} ${(PAD_Y + chartH).toFixed(1)}` +
    ` L ${toX(0).toFixed(1)} ${(PAD_Y + chartH).toFixed(1)} Z`;

  // Today point
  const lastIdx = history.length - 1;
  const todayX = toX(lastIdx);
  const todayY = toY(modals[lastIdx]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 150 }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-axis grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = PAD_Y + (1 - frac) * chartH;
        const val = Math.round(yMin + frac * yRange);
        return (
          <g key={frac}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={PAD_X - 6} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize={9} fontFamily="system-ui">
              {val}
            </text>
          </g>
        );
      })}

      {/* X-axis day labels */}
      {history.map((h, i) => (
        <text
          key={i}
          x={toX(i)}
          y={H - 6}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={9}
          fontFamily="system-ui"
        >
          {shortDay(h.date)}
        </text>
      ))}

      {/* Fill area */}
      <path d={fillPath} fill="url(#areaGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {modals.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r={i === lastIdx ? 4 : 2.5} fill={i === lastIdx ? "#059669" : "#10b981"} stroke="white" strokeWidth={i === lastIdx ? 2 : 1} />
      ))}

      {/* Today price label */}
      <rect
        x={todayX - 18}
        y={todayY - 22}
        width={36}
        height={16}
        rx={4}
        fill="#059669"
      />
      <text
        x={todayX}
        y={todayY - 11}
        textAnchor="middle"
        fill="white"
        fontSize={9}
        fontWeight="bold"
        fontFamily="system-ui"
      >
        {`\u20B9${modals[lastIdx]}`}
      </text>
    </svg>
  );
}

/* ═══════════════ Supply Signal Bar (reuses SupplySignals pattern) ═══════════════ */

interface InlineSignal {
  signal: "surplus" | "shortage" | "normal";
  signalStrength: number;
  position: number;
  spreadRatio: number;
  bMin: number;
  bMax: number;
}

/**
 * Lightweight inline signal computation — matches SupplySignals.tsx pattern.
 * Uses the well-known base range constants from apmc.ts.
 */
function computeInlineSignal(price: APMCPrice): InlineSignal {
  // Fallback base ranges for common commodities
  const BASE_RANGES: Record<string, { bMin: number; bMax: number }> = {
    tomato: { bMin: 18, bMax: 35 }, brinjal: { bMin: 22, bMax: 42 },
    "green chilli": { bMin: 30, bMax: 65 }, "lady finger": { bMin: 28, bMax: 50 },
    capsicum: { bMin: 35, bMax: 65 }, "bitter gourd": { bMin: 30, bMax: 55 },
    cucumber: { bMin: 15, bMax: 30 }, "cluster beans": { bMin: 35, bMax: 70 },
    onion: { bMin: 22, bMax: 45 }, potato: { bMin: 20, bMax: 38 },
    carrot: { bMin: 30, bMax: 55 }, beetroot: { bMin: 20, bMax: 40 },
    radish: { bMin: 15, bMax: 30 }, garlic: { bMin: 80, bMax: 200 },
    ginger: { bMin: 60, bMax: 150 }, "sweet potato": { bMin: 20, bMax: 40 },
    "bottle gourd": { bMin: 25, bMax: 45 }, "ridge gourd": { bMin: 28, bMax: 50 },
    "snake gourd": { bMin: 25, bMax: 45 }, "ash gourd": { bMin: 15, bMax: 30 },
    pumpkin: { bMin: 15, bMax: 35 }, spinach: { bMin: 10, bMax: 25 },
    coriander: { bMin: 20, bMax: 50 }, mint: { bMin: 15, bMax: 35 },
    "curry leaves": { bMin: 30, bMax: 80 }, methi: { bMin: 15, bMax: 35 },
    cauliflower: { bMin: 20, bMax: 40 }, cabbage: { bMin: 15, bMax: 30 },
    drumstick: { bMin: 30, bMax: 80 }, "french beans": { bMin: 30, bMax: 60 },
    "broad beans": { bMin: 25, bMax: 50 }, "green peas": { bMin: 40, bMax: 80 },
    banana: { bMin: 25, bMax: 50 }, lemon: { bMin: 40, bMax: 100 },
    "raw mango": { bMin: 25, bMax: 60 }, coconut: { bMin: 15, bMax: 30 },
  };

  let key: string;
  try {
    key = canonicalize(price.commodity);
  } catch {
    key = price.commodity.toLowerCase().trim();
  }

  const range = BASE_RANGES[key] || { bMin: price.minPrice, bMax: price.maxPrice };
  const rangeSpan = range.bMax - range.bMin;
  const position = rangeSpan > 0
    ? Math.max(0, Math.min(1, (price.modalPrice - range.bMin) / rangeSpan))
    : 0.5;

  let signal: "surplus" | "shortage" | "normal" = "normal";
  let signalStrength = 0;
  if (position < 0.4) {
    signal = "surplus";
    signalStrength = Math.round((0.4 - position) / 0.4 * 100);
  } else if (position > 0.6) {
    signal = "shortage";
    signalStrength = Math.round((position - 0.6) / 0.4 * 100);
  }

  const spreadRatio = price.modalPrice > 0
    ? Math.round((price.maxPrice - price.minPrice) / price.modalPrice * 100)
    : 0;

  return { signal, signalStrength: Math.min(100, signalStrength), position, spreadRatio, bMin: range.bMin, bMax: range.bMax };
}

function SupplySignalBar({ signal, commodity }: { signal: InlineSignal; commodity: string }) {
  const isShortage = signal.signal === "shortage";
  const isSurplus = signal.signal === "surplus";

  const labelColor = isShortage ? "text-red-600" : isSurplus ? "text-emerald-600" : "text-slate-500";
  const labelBg = isShortage ? "bg-red-50" : isSurplus ? "bg-emerald-50" : "bg-slate-50";
  const barFill = isShortage ? "bg-red-400" : isSurplus ? "bg-emerald-400" : "bg-slate-400";
  const markerColor = isShortage ? "bg-red-500 border-red-200" : isSurplus ? "bg-emerald-500 border-emerald-200" : "bg-slate-500 border-slate-200";
  const signalIcon = isShortage
    ? <Zap className="w-3.5 h-3.5" />
    : isSurplus
      ? <ArrowDown className="w-3.5 h-3.5" />
      : <ShieldCheck className="w-3.5 h-3.5" />;
  const signalLabel = isShortage ? "Shortage" : isSurplus ? "Surplus" : "Normal";
  const strengthLabel = signal.signalStrength > 60 ? "Strong" : signal.signalStrength > 30 ? "Moderate" : "Mild";

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4">
      {/* Signal badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${labelBg} ${labelColor}`}>
          {signalIcon}
          {signalLabel}
        </span>
        {signal.signal !== "normal" && signal.signalStrength > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${labelBg} ${labelColor}`}>
            {strengthLabel}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-400">
          Spread: {signal.spreadRatio}% · Range: ₹{signal.bMin}–₹{signal.bMax}
        </span>
      </div>

      {/* Range bar */}
      <div className="relative h-3 bg-gradient-to-r from-emerald-100/80 via-slate-100 to-red-100/80 rounded-full overflow-visible">
        <div
          className={`absolute top-0 left-0 h-full rounded-full opacity-30 ${barFill}`}
          style={{ width: `${signal.position * 100}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${markerColor} border-2 shadow-sm`}
          style={{ left: `calc(${Math.max(2, Math.min(98, signal.position * 100))}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] mt-1.5 text-slate-400">
        <span className="text-emerald-400">Surplus zone</span>
        <span className="text-slate-400">Normal</span>
        <span className="text-red-400">Shortage zone</span>
      </div>
    </div>
  );
}
