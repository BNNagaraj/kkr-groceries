"use client";

import React, { useEffect, useRef, useState } from "react";
import type { C2Theme } from "../CommandCenter";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Hourglass,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  accentColor: string;
  glowColor: string;
  trend?: number;
  pulse?: boolean;
  format?: "currency" | "number" | "percent";
}

function AnimatedNumber({
  value,
  format = "number",
  prefix = "",
  suffix = "",
}: {
  value: number;
  format?: "currency" | "number" | "percent";
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;
    prev.current = end;
    const duration = 600;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  const formatted =
    format === "currency" || format === "number"
      ? display.toLocaleString("en-IN")
      : `${display}`;

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

function MetricCard({
  label,
  value,
  prefix = "",
  suffix = "",
  icon,
  accentColor,
  glowColor,
  trend,
  pulse,
  format = "number",
  onClick,
}: MetricCardProps & { onClick?: () => void }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-2.5 sm:p-3 md:p-3.5 transition-all duration-200 group cursor-pointer hover:translate-y-[-1px] active:translate-y-0 ${
        pulse ? "c2-pulse-border" : ""
      }`}
      style={{
        background: "var(--c2-kpi-bg)",
        border: "1px solid var(--c2-border)",
        boxShadow: "var(--c2-card-shadow)",
      }}
      onClick={onClick}
    >
      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)` }}
      />

      {/* Subtle corner glow */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full transition-opacity duration-500 group-hover:opacity-[0.12]"
        style={{
          background: `radial-gradient(circle, ${glowColor}, transparent)`,
          opacity: "var(--c2-glow-opacity)",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <span
            className="text-[9px] sm:text-[10px] font-bold tracking-[0.08em] uppercase"
            style={{ color: "var(--c2-text-muted)" }}
          >
            {label}
          </span>
          <div
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}10`, border: `1px solid ${accentColor}15` }}
          >
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
        </div>

        <div className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight tabular-nums" style={{ color: "var(--c2-text)" }}>
          <AnimatedNumber value={value} format={format} prefix={prefix} suffix={suffix} />
        </div>

        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend >= 0 ? (
              <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5 text-red-500" />
            )}
            <span className={`text-[10px] font-bold tabular-nums ${trend >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
            <span className="text-[9px] ml-0.5" style={{ color: "var(--c2-text-muted)" }}>
              vs yest
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface LiveMetricsProps {
  todayRevenue: number;
  activeOrders: number;
  onlineUsers: number;
  fulfillmentRate: number;
  avgOrderValue: number;
  pendingRevenue: number;
  yesterdayRevenue?: number;
  revenueLabel?: string;
  theme: C2Theme;
  onCardClick?: (metric: string) => void;
}

export default function LiveMetrics({
  todayRevenue,
  activeOrders,
  onlineUsers,
  fulfillmentRate,
  avgOrderValue,
  pendingRevenue,
  yesterdayRevenue,
  revenueLabel,
  onCardClick,
}: LiveMetricsProps) {
  const [expanded, setExpanded] = useState(false);

  const revenueTrend =
    yesterdayRevenue && yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : undefined;

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <MetricCard
          label={revenueLabel || "Today's Revenue"}
          value={todayRevenue}
          prefix={"\u20B9"}
          icon={<DollarSign className="w-4 h-4" />}
          accentColor="#10b981"
          glowColor="#10b981"
          format="currency"
          trend={revenueTrend}
          onClick={() => onCardClick?.("revenue")}
        />
        <MetricCard
          label="Active Orders"
          value={activeOrders}
          icon={<ShoppingCart className="w-4 h-4" />}
          accentColor="#f59e0b"
          glowColor="#f59e0b"
          pulse={activeOrders > 0}
          onClick={() => onCardClick?.("active")}
        />
        <MetricCard
          label="Online Users"
          value={onlineUsers}
          icon={<Users className="w-4 h-4" />}
          accentColor="#22c55e"
          glowColor="#22c55e"
          onClick={() => onCardClick?.("users")}
        />
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
          <MetricCard
            label="Fulfillment Rate"
            value={fulfillmentRate}
            suffix="%"
            icon={<Target className="w-4 h-4" />}
            accentColor="#3b82f6"
            glowColor="#3b82f6"
            format="percent"
            onClick={() => onCardClick?.("fulfillment")}
          />
          <MetricCard
            label="Avg Order Value"
            value={avgOrderValue}
            prefix={"\u20B9"}
            icon={<TrendingUp className="w-4 h-4" />}
            accentColor="#8b5cf6"
            glowColor="#8b5cf6"
            format="currency"
            onClick={() => onCardClick?.("aov")}
          />
          <MetricCard
            label="Pending Revenue"
            value={pendingRevenue}
            prefix={"\u20B9"}
            icon={<Hourglass className="w-4 h-4" />}
            accentColor="#f97316"
            glowColor="#f97316"
            format="currency"
            pulse={pendingRevenue > 0}
            onClick={() => onCardClick?.("pending")}
          />
        </div>
      )}

      <div className="flex justify-center mt-1">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: "var(--c2-text-muted)" }}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide details" : "More metrics"}
        </button>
      </div>
    </div>
  );
}
