"use client";

import React, { useEffect, useRef, useState } from "react";
import type { C2Theme } from "../CommandCenter";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Hourglass,
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
      className={`relative overflow-hidden rounded-xl p-2.5 sm:p-3 md:p-4 transition-all duration-300 group cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
        pulse ? "c2-pulse-border" : ""
      }`}
      style={{
        background: "var(--c2-bg-card)",
        border: "1px solid var(--c2-border)",
        borderTopColor: accentColor,
        borderTopWidth: "2px",
        boxShadow: "var(--c2-card-shadow)",
      }}
      onClick={onClick}
    >
      {/* Glow effect */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${glowColor}, transparent)`,
          opacity: "var(--c2-glow-opacity)",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--c2-text-muted)" }}
          >
            {label}
          </span>
          <div
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
        </div>

        <div className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight" style={{ color: "var(--c2-text)" }}>
          <AnimatedNumber value={value} format={format} prefix={prefix} suffix={suffix} />
        </div>

        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <span className={`text-[11px] font-semibold ${trend >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
            <span className="text-[10px] ml-1" style={{ color: "var(--c2-text-muted)" }}>
              vs yesterday
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
  const revenueTrend =
    yesterdayRevenue && yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
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
  );
}
