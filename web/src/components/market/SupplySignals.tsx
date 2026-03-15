"use client";

import React from "react";
import Image from "next/image";
import { TrendingDown, TrendingUp, Minus, Leaf, AlertTriangle, Zap, ShieldCheck, ArrowDown } from "lucide-react";
import { SupplySignal, matchCommodityToProduct } from "@/lib/apmc";

interface Props {
  signals: SupplySignal[];
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>;
}

export function SupplySignals({ signals, products }: Props) {
  const shortages = signals.filter(s => s.signal === "shortage");
  const surpluses = signals.filter(s => s.signal === "surplus");
  const normals = signals.filter(s => s.signal === "normal");

  if (signals.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-600 font-bold mb-1">No Supply Signals</p>
        <p className="text-slate-400 text-sm">Price data needed to compute supply signals</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary Dashboard ── */}
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          count={shortages.length}
          label="Shortage"
          sublabel="Prices above normal"
          color="red"
        />
        <SummaryCard
          icon={<Minus className="w-5 h-5" />}
          count={normals.length}
          label="Normal"
          sublabel="Within expected range"
          color="slate"
        />
        <SummaryCard
          icon={<TrendingDown className="w-5 h-5" />}
          count={surpluses.length}
          label="Surplus"
          sublabel="Prices below normal"
          color="emerald"
        />
      </div>

      {/* ── Signal Sections ── */}
      {shortages.length > 0 && (
        <SignalSection
          title="Supply Shortage"
          subtitle="Prices trending above normal — low supply or high demand"
          icon={<Zap className="w-4 h-4" />}
          color="red"
          signals={shortages}
          products={products}
        />
      )}

      {surpluses.length > 0 && (
        <SignalSection
          title="Surplus Available"
          subtitle="Prices below normal — good buying opportunity"
          icon={<ArrowDown className="w-4 h-4" />}
          color="emerald"
          signals={surpluses}
          products={products}
        />
      )}

      {normals.length > 0 && (
        <SignalSection
          title="Normal Supply"
          subtitle="Prices within expected seasonal range"
          icon={<ShieldCheck className="w-4 h-4" />}
          color="slate"
          signals={normals}
          products={products}
        />
      )}
    </div>
  );
}

/* ═══════════════ Summary Card ═══════════════ */
function SummaryCard({ icon, count, label, sublabel, color }: {
  icon: React.ReactNode;
  count: number;
  label: string;
  sublabel: string;
  color: "red" | "emerald" | "slate";
}) {
  const colors = {
    red: {
      bg: "bg-red-50/80",
      border: "border-red-100",
      icon: "text-red-500",
      count: "text-red-700",
      label: "text-red-600",
    },
    emerald: {
      bg: "bg-emerald-50/80",
      border: "border-emerald-100",
      icon: "text-emerald-500",
      count: "text-emerald-700",
      label: "text-emerald-600",
    },
    slate: {
      bg: "bg-slate-50/80",
      border: "border-slate-200",
      icon: "text-slate-400",
      count: "text-slate-600",
      label: "text-slate-500",
    },
  };
  const c = colors[color];

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-3 text-center`}>
      <div className={`${c.icon} mx-auto mb-1.5`}>{icon}</div>
      <div className={`text-2xl sm:text-3xl font-extrabold ${c.count} tabular-nums leading-none mb-1`}>{count}</div>
      <div className={`text-[10px] font-bold ${c.label} uppercase tracking-wider`}>{label}</div>
      <div className="text-[9px] text-slate-400 mt-0.5 hidden sm:block">{sublabel}</div>
    </div>
  );
}

/* ═══════════════ Signal Section ═══════════════ */
function SignalSection({ title, subtitle, icon, color, signals, products }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: "red" | "emerald" | "slate";
  signals: SupplySignal[];
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>;
}) {
  const sectionColors = {
    red: {
      headerBg: "bg-red-50/50",
      headerBorder: "border-red-100",
      iconBg: "bg-red-100",
      iconText: "text-red-500",
      title: "text-red-800",
      subtitle: "text-red-500/70",
    },
    emerald: {
      headerBg: "bg-emerald-50/50",
      headerBorder: "border-emerald-100",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-500",
      title: "text-emerald-800",
      subtitle: "text-emerald-500/70",
    },
    slate: {
      headerBg: "bg-slate-50/50",
      headerBorder: "border-slate-200",
      iconBg: "bg-slate-200",
      iconText: "text-slate-500",
      title: "text-slate-700",
      subtitle: "text-slate-400",
    },
  };
  const sc = sectionColors[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className={`${sc.headerBg} border-b ${sc.headerBorder} px-4 py-3 flex items-center gap-2.5`}>
        <div className={`w-7 h-7 rounded-lg ${sc.iconBg} ${sc.iconText} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <h3 className={`text-sm font-bold ${sc.title}`}>{title}</h3>
          <p className={`text-[10px] ${sc.subtitle}`}>{subtitle}</p>
        </div>
        <span className={`ml-auto text-xs font-bold ${sc.title} bg-white/60 px-2.5 py-1 rounded-full`}>
          {signals.length}
        </span>
      </div>

      {/* Signal items */}
      <div className="divide-y divide-slate-100/80">
        {signals.map((s) => (
          <SignalRow key={s.commodity} signal={s} products={products} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ Signal Row ═══════════════ */
function SignalRow({ signal: s, products }: {
  signal: SupplySignal;
  products: Array<{ name: string; image: string; telugu?: string; hindi?: string }>;
}) {
  const img = matchCommodityToProduct(s.commodity, products);
  const isShortage = s.signal === "shortage";
  const isSurplus = s.signal === "surplus";

  const priceColor = isShortage ? "text-red-700" : isSurplus ? "text-emerald-700" : "text-slate-700";
  const barFill = isShortage ? "bg-red-400" : isSurplus ? "bg-emerald-400" : "bg-slate-400";
  const markerColor = isShortage ? "bg-red-500 border-red-200" : isSurplus ? "bg-emerald-500 border-emerald-200" : "bg-slate-500 border-slate-200";
  const strengthBg = isShortage ? "bg-red-50 text-red-600" : isSurplus ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500";

  return (
    <div className="p-4 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-center gap-3">
        {/* Product image */}
        {img ? (
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200/80 shrink-0 bg-slate-50 shadow-sm">
            <Image src={img} alt={s.commodity} width={40} height={40} className="w-full h-full object-cover" unoptimized={img.startsWith("data:")} />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
        )}

        {/* Name + strength */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm">{s.commodity}</span>
            {s.signal !== "normal" && s.signalStrength > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${strengthBg}`}>
                {s.signalStrength > 60 ? "Strong" : s.signalStrength > 30 ? "Moderate" : "Mild"}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Spread: {s.spreadRatio}% · Range: ₹{s.bMin}–₹{s.bMax}
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <div className={`font-extrabold text-sm tabular-nums ${priceColor}`}>
            ₹{s.modalPrice}/kg
          </div>
          <div className="text-[10px] text-slate-400">
            ₹{s.minPrice}–₹{s.maxPrice}
          </div>
        </div>
      </div>

      {/* Range bar */}
      <div className="mt-3 ml-[52px]">
        <div className="relative h-2 bg-gradient-to-r from-emerald-100/80 via-slate-100 to-red-100/80 rounded-full overflow-visible">
          {/* Fill from left to position */}
          <div
            className={`absolute top-0 left-0 h-full rounded-full opacity-30 ${barFill}`}
            style={{ width: `${s.position * 100}%` }}
          />
          {/* Position marker */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${markerColor} border-2 shadow-sm`}
            style={{ left: `calc(${Math.max(2, Math.min(98, s.position * 100))}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[9px] mt-1 text-slate-400">
          <span className="text-emerald-400">Surplus zone</span>
          <span className="text-red-400">Shortage zone</span>
        </div>
      </div>
    </div>
  );
}
