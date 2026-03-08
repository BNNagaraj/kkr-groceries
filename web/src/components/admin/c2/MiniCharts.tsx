"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import type { C2Theme } from "../CommandCenter";
import type { C2DateRange } from "../CommandCenter";
import { Order } from "@/types/order";
import { parseTotal } from "@/lib/helpers";

interface ChartComponents {
  Bar: any;
  Line: any;
}

// ─── MiniCharts Component ────────────────────────────────────────────────────
interface MiniChartsProps {
  orders: Order[];
  allOrders: Order[];
  theme: C2Theme;
  dateRange?: C2DateRange;
}

export default function MiniCharts({ orders, allOrders, theme, dateRange }: MiniChartsProps) {
  const [chartComponents, setChartComponents] = useState<ChartComponents | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [chartjs, reactChartjs2] = await Promise.all([
        import("chart.js"),
        import("react-chartjs-2"),
      ]);
      if (cancelled) return;
      chartjs.Chart.register(
        chartjs.CategoryScale,
        chartjs.LinearScale,
        chartjs.BarElement,
        chartjs.LineElement,
        chartjs.PointElement,
        chartjs.Filler,
        chartjs.Tooltip,
        chartjs.Legend
      );
      setChartComponents({ Bar: reactChartjs2.Bar, Line: reactChartjs2.Line });
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Revenue by last 7 days ──
  const revenueTrend = useMemo(() => {
    // Build YYYY-MM-DD keys for reliable date matching
    const isoKeys: Record<string, number> = {};
    const shortLabels: string[] = [];
    const isoKeyList: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const shortLabel = d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" });
      isoKeys[isoKey] = 0;
      isoKeyList.push(isoKey);
      shortLabels.push(shortLabel);
    }
    allOrders.forEach((o) => {
      if (o.status === "Rejected") return;
      let orderKey = "";
      // Prefer createdAt (Firestore Timestamp)
      if (o.createdAt?.toDate) {
        const d = o.createdAt.toDate();
        orderKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      } else {
        // Fallback: parse timestamp string "D/M/YYYY, ..."
        const raw = o.timestamp || "";
        if (!raw) return;
        try {
          const parts = raw.split(",")[0].trim().split("/");
          if (parts.length === 3) {
            orderKey = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        } catch {}
      }
      if (orderKey && isoKeys.hasOwnProperty(orderKey)) {
        isoKeys[orderKey] += parseTotal(o.totalValue);
      }
    });
    return { labels: shortLabels, data: isoKeyList.map((k) => isoKeys[k]) };
  }, [allOrders]);

  // ── Orders by hour (today) ──
  const ordersByHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const counts = new Array(24).fill(0);
    orders.forEach((o) => {
      // Prefer createdAt (Firestore Timestamp)
      if (o.createdAt?.toDate) {
        counts[o.createdAt.toDate().getHours()]++;
        return;
      }
      // Fallback: parse timestamp string
      const raw = o.timestamp || "";
      try {
        const timePart = raw.split(",")[1]?.trim();
        if (timePart) {
          const d = new Date(`2000-01-01 ${timePart}`);
          if (!isNaN(d.getTime())) counts[d.getHours()]++;
        }
      } catch {}
    });
    return { labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`), data: counts };
  }, [orders]);

  // ── Top 5 Products (today) ──
  const topProducts = useMemo(() => {
    const productCounts: Record<string, number> = {};
    orders.forEach((o) => {
      (o.cart || []).forEach((item) => {
        productCounts[item.name] = (productCounts[item.name] || 0) + item.qty;
      });
    });
    return Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);

  // ── Theme-aware chart options ──
  const chartOptions = useMemo(() => {
    const isDark = theme === "dark";
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          titleColor: isDark ? "#e2e8f0" : "#0f172a",
          bodyColor: isDark ? "#94a3b8" : "#475569",
          borderColor: isDark ? "#334155" : "#e2e8f0",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 8,
          titleFont: { size: 11 },
          bodyFont: { size: 10 },
        },
      },
      scales: {
        x: {
          grid: {
            color: isDark ? "rgba(51,65,85,0.3)" : "rgba(226,232,240,0.5)",
            drawBorder: false,
          },
          ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9 }, maxRotation: 0 },
          border: { display: false },
        },
        y: {
          grid: {
            color: isDark ? "rgba(51,65,85,0.3)" : "rgba(226,232,240,0.5)",
            drawBorder: false,
          },
          ticks: { color: isDark ? "#64748b" : "#94a3b8", font: { size: 9 } },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  }, [theme]);

  if (!chartComponents) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[11px] animate-pulse" style={{ color: "var(--c2-text-muted)" }}>
          Loading charts...
        </div>
      </div>
    );
  }

  const { Bar, Line } = chartComponents;
  const productColors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-2.5 sm:px-4 py-2.5 sm:py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <h3 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2" style={{ color: "var(--c2-text)" }}>
          <span>&#x1F4CA;</span> Performance
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-2 sm:p-3 space-y-3 sm:space-y-4">
        {/* Revenue Trend (7 days) */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--c2-text-muted)" }}>
            Revenue Trend (7 Days)
          </div>
          <div className="h-24 sm:h-28">
            <Line
              data={{
                labels: revenueTrend.labels,
                datasets: [{
                  data: revenueTrend.data,
                  borderColor: "#10b981",
                  backgroundColor: theme === "dark" ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.08)",
                  borderWidth: 2,
                  fill: true,
                  tension: 0.4,
                  pointRadius: 3,
                  pointBackgroundColor: "#10b981",
                  pointBorderColor: theme === "dark" ? "#0f172a" : "#ffffff",
                  pointBorderWidth: 2,
                }],
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    ticks: {
                      ...chartOptions.scales.y.ticks,
                      callback: (val: any) => val >= 1000 ? `${Math.round(val / 1000)}k` : val,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Orders by Hour */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--c2-text-muted)" }}>
            Orders by Hour{dateRange && dateRange !== "today" ? ` (${dateRange === "yesterday" ? "Yesterday" : dateRange === "7days" ? "7D" : "All"})` : ""}
          </div>
          <div className="h-20 sm:h-24">
            <Bar
              data={{
                labels: ordersByHour.labels,
                datasets: [{
                  data: ordersByHour.data,
                  backgroundColor: ordersByHour.data.map((v) =>
                    v > 0 ? "rgba(59,130,246,0.6)" : "rgba(59,130,246,0.15)"
                  ),
                  borderColor: "rgba(59,130,246,0.8)",
                  borderWidth: 1,
                  borderRadius: 2,
                  barPercentage: 0.8,
                }],
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  x: { ...chartOptions.scales.x, ticks: { ...chartOptions.scales.x.ticks, maxTicksLimit: 6 } },
                },
              }}
            />
          </div>
        </div>

        {/* Top 5 Products */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--c2-text-muted)" }}>
            Top Products{dateRange && dateRange !== "today" ? ` (${dateRange === "yesterday" ? "Yesterday" : dateRange === "7days" ? "7D" : "All"})` : ""}
          </div>
          {topProducts.length === 0 ? (
            <div className="text-[10px] py-4 text-center" style={{ color: "var(--c2-text-muted)" }}>
              No products ordered today
            </div>
          ) : (
            <div className="space-y-1.5">
              {topProducts.map(([name, qty], i) => {
                const maxQty = topProducts[0][1] as number;
                const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-[10px] w-4 text-right shrink-0" style={{ color: "var(--c2-text-muted)" }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] truncate" style={{ color: "var(--c2-text-secondary)" }}>{name}</span>
                        <span className="text-[10px] shrink-0 ml-2" style={{ color: "var(--c2-text-muted)" }}>{qty}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--c2-bg-secondary)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: productColors[i] || "#64748b" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
