"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Store } from "@/types/settings";
import { StoreInventoryItem, StockTransaction } from "@/types/inventory";
import {
  BarChart3,
  TrendingUp,
  Package,
  Warehouse,
} from "lucide-react";

// Dynamically load Chart.js
let ChartJS: typeof import("chart.js").Chart | null = null;
let chartModulesLoaded = false;

async function loadChartModules() {
  if (chartModulesLoaded) return;
  const mod = await import("chart.js");
  mod.Chart.register(
    mod.CategoryScale,
    mod.LinearScale,
    mod.BarElement,
    mod.LineElement,
    mod.PointElement,
    mod.ArcElement,
    mod.Title,
    mod.Tooltip,
    mod.Legend,
    mod.Filler
  );
  ChartJS = mod.Chart;
  chartModulesLoaded = true;
}

interface InventoryAnalyticsProps {
  stores: Store[];
  inventory: StoreInventoryItem[];
  transactions: StockTransaction[];
}

type SubView = "stockOverview" | "txnVolume" | "storeComparison" | "topProducts";

const COLORS = [
  "#059669", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

export default function InventoryAnalytics({ stores, inventory, transactions }: InventoryAnalyticsProps) {
  const [subView, setSubView] = useState<SubView>("stockOverview");
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);

  return (
    <div className="space-y-4">
      {/* Sub-view tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {([
            { key: "stockOverview", label: "Stock Levels", icon: Package },
            { key: "txnVolume", label: "Transactions", icon: TrendingUp },
            { key: "storeComparison", label: "Store Value", icon: Warehouse },
            { key: "topProducts", label: "Top Products", icon: BarChart3 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSubView(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                subView === key ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>

        {subView === "txnVolume" && (
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value) as 7 | 30 | 90)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        )}
      </div>

      {/* Charts */}
      {subView === "stockOverview" && (
        <StockOverviewChart stores={stores} inventory={inventory} />
      )}
      {subView === "txnVolume" && (
        <TransactionVolumeChart transactions={transactions} dateRange={dateRange} />
      )}
      {subView === "storeComparison" && (
        <StoreComparisonChart stores={stores} inventory={inventory} />
      )}
      {subView === "topProducts" && (
        <TopProductsChart transactions={transactions} />
      )}
    </div>
  );
}

/* ────── Stock Overview: Bar chart of qty by product, stacked by store ────── */
function StockOverviewChart({ stores, inventory }: { stores: Store[]; inventory: StoreInventoryItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<InstanceType<typeof import("chart.js").Chart> | null>(null);

  const data = useMemo(() => {
    // Group by product
    const productMap = new Map<string, { name: string; stores: Map<string, number> }>();
    for (const inv of inventory) {
      if (!productMap.has(inv.productId)) {
        productMap.set(inv.productId, { name: inv.productName, stores: new Map() });
      }
      productMap.get(inv.productId)!.stores.set(inv.storeId, inv.currentQty);
    }
    // Sort by total qty descending, take top 15
    const products = Array.from(productMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        stores: data.stores,
        total: Array.from(data.stores.values()).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    return {
      labels: products.map((p) => p.name),
      datasets: stores.map((store, i) => ({
        label: store.name,
        data: products.map((p) => p.stores.get(store.id) || 0),
        backgroundColor: COLORS[i % COLORS.length] + "cc",
        borderRadius: 4,
      })),
    };
  }, [stores, inventory]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let mounted = true;
    loadChartModules().then(() => {
      if (!mounted || !canvasRef.current || !ChartJS) return;
      chartRef.current?.destroy();
      chartRef.current = new ChartJS(canvasRef.current, {
        type: "bar",
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
            title: { display: true, text: "Stock Levels by Product (Top 15)", font: { size: 14 } },
          },
          scales: {
            x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 45 } },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: "Quantity" } },
          },
        },
      });
    });
    return () => { mounted = false; chartRef.current?.destroy(); };
  }, [data]);

  if (inventory.length === 0) {
    return <EmptyState message="No inventory data to display." />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="h-[400px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

/* ────── Transaction Volume: Bar chart over time ────── */
function TransactionVolumeChart({ transactions, dateRange }: { transactions: StockTransaction[]; dateRange: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<InstanceType<typeof import("chart.js").Chart> | null>(null);

  const data = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);

    // Generate date labels
    const dateLabels: string[] = [];
    for (let d = new Date(cutoff); d <= now; d.setDate(d.getDate() + 1)) {
      dateLabels.push(d.toISOString().slice(0, 10));
    }

    const types = ["receipt", "sale", "transfer_out", "transfer_in", "dispatch", "adjustment"];
    const typeColors: Record<string, string> = {
      receipt: "#059669",
      sale: "#3b82f6",
      transfer_out: "#f97316",
      transfer_in: "#8b5cf6",
      dispatch: "#f59e0b",
      adjustment: "#64748b",
    };

    // Bucket transactions by date and type
    const buckets = new Map<string, Map<string, number>>();
    for (const label of dateLabels) {
      buckets.set(label, new Map(types.map((t) => [t, 0])));
    }

    for (const txn of transactions) {
      if (!txn.createdAt) continue;
      const txnDate = txn.createdAt.toDate();
      if (txnDate < cutoff) continue;
      const key = txnDate.toISOString().slice(0, 10);
      if (buckets.has(key)) {
        const typeBucket = buckets.get(key)!;
        typeBucket.set(txn.type, (typeBucket.get(txn.type) || 0) + 1);
      }
    }

    // Format labels to shorter dates
    const shortLabels = dateLabels.map((d) => {
      const date = new Date(d);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    return {
      labels: shortLabels,
      datasets: types
        .filter((type) => {
          // Only include types that have data
          return Array.from(buckets.values()).some((b) => (b.get(type) || 0) > 0);
        })
        .map((type) => ({
          label: type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          data: dateLabels.map((d) => buckets.get(d)?.get(type) || 0),
          backgroundColor: typeColors[type] + "cc",
          borderColor: typeColors[type],
          borderWidth: 1,
          borderRadius: 3,
        })),
    };
  }, [transactions, dateRange]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let mounted = true;
    loadChartModules().then(() => {
      if (!mounted || !canvasRef.current || !ChartJS) return;
      chartRef.current?.destroy();
      chartRef.current = new ChartJS(canvasRef.current, {
        type: "bar",
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
            title: { display: true, text: `Transaction Volume (Last ${dateRange} Days)`, font: { size: 14 } },
          },
          scales: {
            x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 45 } },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: "Count" } },
          },
        },
      });
    });
    return () => { mounted = false; chartRef.current?.destroy(); };
  }, [data, dateRange]);

  if (transactions.length === 0) {
    return <EmptyState message="No transactions to chart." />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="h-[400px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

/* ────── Store Comparison: Horizontal bar of stock value per store ────── */
function StoreComparisonChart({ stores, inventory }: { stores: Store[]; inventory: StoreInventoryItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<InstanceType<typeof import("chart.js").Chart> | null>(null);

  const data = useMemo(() => {
    const storeValues = stores.map((store) => {
      const storeInv = inventory.filter((i) => i.storeId === store.id);
      const value = storeInv.reduce((s, i) => s + i.currentQty * (i.costPrice || 0), 0);
      const itemCount = storeInv.reduce((s, i) => s + i.currentQty, 0);
      return { name: store.name, value, itemCount };
    }).sort((a, b) => b.value - a.value);

    return {
      labels: storeValues.map((s) => s.name),
      datasets: [
        {
          label: "Stock Value (₹)",
          data: storeValues.map((s) => s.value),
          backgroundColor: storeValues.map((_, i) => COLORS[i % COLORS.length] + "cc"),
          borderRadius: 6,
        },
      ],
    };
  }, [stores, inventory]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let mounted = true;
    loadChartModules().then(() => {
      if (!mounted || !canvasRef.current || !ChartJS) return;
      chartRef.current?.destroy();
      chartRef.current = new ChartJS(canvasRef.current, {
        type: "bar",
        data,
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: "Stock Value by Store", font: { size: 14 } },
            tooltip: {
              callbacks: {
                label: (ctx) => `₹${(ctx.raw as number).toLocaleString("en-IN")}`,
              },
            },
          },
          scales: {
            x: { beginAtZero: true, ticks: { callback: (v) => `₹${Number(v).toLocaleString("en-IN")}` } },
            y: { ticks: { font: { size: 12 } } },
          },
        },
      });
    });
    return () => { mounted = false; chartRef.current?.destroy(); };
  }, [data]);

  if (stores.length === 0) {
    return <EmptyState message="No stores to compare." />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="h-[350px]">
        <canvas ref={canvasRef} />
      </div>
      {/* Value table */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {stores.map((store, i) => {
            const storeInv = inventory.filter((inv) => inv.storeId === store.id);
            const value = storeInv.reduce((s, inv) => s + inv.currentQty * (inv.costPrice || 0), 0);
            const items = storeInv.reduce((s, inv) => s + inv.currentQty, 0);
            return (
              <div key={store.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-50">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-700 truncate">{store.name}</div>
                  <div className="text-slate-400">{items} items</div>
                </div>
                <div className="font-bold text-slate-800">₹{value.toLocaleString("en-IN")}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────── Top Products: Bar chart of most transacted products ────── */
function TopProductsChart({ transactions }: { transactions: StockTransaction[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<InstanceType<typeof import("chart.js").Chart> | null>(null);

  const data = useMemo(() => {
    const productCounts = new Map<string, { name: string; count: number; totalQty: number }>();
    for (const txn of transactions) {
      if (!productCounts.has(txn.productId)) {
        productCounts.set(txn.productId, { name: txn.productName, count: 0, totalQty: 0 });
      }
      const entry = productCounts.get(txn.productId)!;
      entry.count++;
      entry.totalQty += txn.qty;
    }

    const top10 = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      labels: top10.map((p) => p.name),
      datasets: [
        {
          label: "Transaction Count",
          data: top10.map((p) => p.count),
          backgroundColor: top10.map((_, i) => COLORS[i % COLORS.length] + "cc"),
          borderRadius: 6,
        },
      ],
    };
  }, [transactions]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let mounted = true;
    loadChartModules().then(() => {
      if (!mounted || !canvasRef.current || !ChartJS) return;
      chartRef.current?.destroy();
      chartRef.current = new ChartJS(canvasRef.current, {
        type: "bar",
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: "Top 10 Most Transacted Products", font: { size: 14 } },
          },
          scales: {
            x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
            y: { beginAtZero: true, title: { display: true, text: "Transactions" } },
          },
        },
      });
    });
    return () => { mounted = false; chartRef.current?.destroy(); };
  }, [data]);

  if (transactions.length === 0) {
    return <EmptyState message="No transactions to analyze." />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="h-[400px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

/* ────── Empty state ────── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
      <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <p className="font-medium">{message}</p>
      <p className="text-xs mt-1">Add inventory and record transactions to see analytics.</p>
    </div>
  );
}
