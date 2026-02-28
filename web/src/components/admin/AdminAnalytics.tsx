"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Order } from "@/types/order";

/** Safely extract a numeric value from totalValue (can be string "₹1,234" or number 1234) */
function parseTotal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
  return 0;
}

export default function AdminAnalytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [ChartComponents, setChartComponents] = useState<{
    Bar: any;
    Pie: any;
    Doughnut: any;
  } | null>(null);
  const registered = useRef(false);

  // Fetch all orders
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "orders"));
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
        setOrders(data);
      } catch (e) {
        console.error("[AdminAnalytics] Failed to fetch orders:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Dynamic chart.js import — keeps chart.js out of Turbopack's static module graph
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [chartjs, reactChartjs2] = await Promise.all([
        import("chart.js"),
        import("react-chartjs-2"),
      ]);

      if (cancelled) return;

      if (!registered.current) {
        chartjs.Chart.register(
          chartjs.CategoryScale,
          chartjs.LinearScale,
          chartjs.BarElement,
          chartjs.Title,
          chartjs.Tooltip,
          chartjs.Legend,
          chartjs.ArcElement
        );
        registered.current = true;
      }

      setChartComponents({
        Bar: reactChartjs2.Bar,
        Pie: reactChartjs2.Pie,
        Doughnut: reactChartjs2.Doughnut,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Compute analytics from orders
  const analytics = useMemo(() => {
    const totalRevenue = orders.reduce((acc, o) => acc + parseTotal(o.totalValue), 0);
    const totalOrders = orders.length;
    const uniqueCustomers = new Set(orders.map((o) => o.userId)).size;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Revenue by date
    const revenueByDate: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.timestamp) {
        const d = o.timestamp.split(",")[0];
        revenueByDate[d] = (revenueByDate[d] || 0) + parseTotal(o.totalValue);
      }
    });
    const recentDates = Object.keys(revenueByDate).sort().slice(-10);

    // Top products by quantity ordered
    const productCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const cart = o.cart || [];
      cart.forEach((item) => {
        productCounts[item.name] = (productCounts[item.name] || 0) + item.qty;
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Orders by status
    const statusCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const s = o.status || "Pending";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // Top customers by revenue
    const customerRevenue: Record<string, { name: string; total: number }> = {};
    orders.forEach((o) => {
      const key = o.userId || "anonymous";
      if (!customerRevenue[key]) {
        customerRevenue[key] = { name: o.shopName || o.customerName || "Unknown", total: 0 };
      }
      customerRevenue[key].total += parseTotal(o.totalValue);
    });
    const topCustomers = Object.values(customerRevenue)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalRevenue,
      totalOrders,
      uniqueCustomers,
      avgOrderValue,
      revenueByDate,
      recentDates,
      topProducts,
      statusCounts,
      topCustomers,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
        <div className="text-slate-400 animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
        <h3 className="text-xl font-bold text-slate-800">No Orders Yet</h3>
        <p className="text-slate-500 mt-2">Analytics will appear once orders are placed.</p>
      </div>
    );
  }

  const { totalRevenue, totalOrders, uniqueCustomers, avgOrderValue } = analytics;
  const STATUS_COLORS: Record<string, string> = {
    Pending: "#f59e0b",
    Accepted: "#3b82f6",
    Fulfilled: "#10b981",
    Rejected: "#ef4444",
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
          <div className="text-3xl font-bold text-emerald-700">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </div>
          <div className="text-sm text-emerald-600 font-medium">Total Revenue</div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <div className="text-3xl font-bold text-blue-700">{totalOrders}</div>
          <div className="text-sm text-blue-600 font-medium">Total Orders</div>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
          <div className="text-3xl font-bold text-amber-700">{uniqueCustomers}</div>
          <div className="text-sm text-amber-600 font-medium">Unique Customers</div>
        </div>
        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
          <div className="text-3xl font-bold text-purple-700">
            ₹{avgOrderValue.toLocaleString("en-IN")}
          </div>
          <div className="text-sm text-purple-600 font-medium">Avg Order Value</div>
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-4 text-slate-800">Top Customers</h3>
        <div className="space-y-2">
          {analytics.topCustomers.map((c, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-700">{c.name}</span>
              </div>
              <span className="font-bold text-slate-800">₹{c.total.toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      {ChartComponents ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[340px]">
            <h3 className="font-bold mb-4 text-slate-800">Revenue Trend</h3>
            <ChartComponents.Bar
              data={{
                labels: analytics.recentDates,
                datasets: [
                  {
                    label: "Revenue (₹)",
                    data: analytics.recentDates.map((d: string) => analytics.revenueByDate[d] || 0),
                    backgroundColor: "#10b981",
                    borderRadius: 4,
                  },
                ],
              }}
              options={{ maintainAspectRatio: false }}
            />
          </div>

          {/* Top Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[340px] flex flex-col">
            <h3 className="font-bold mb-4 text-slate-800">Top Products</h3>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <ChartComponents.Pie
                data={{
                  labels: analytics.topProducts.map((x: [string, number]) => x[0]),
                  datasets: [
                    {
                      data: analytics.topProducts.map((x: [string, number]) => x[1]),
                      backgroundColor: [
                        "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
                      ],
                    },
                  ],
                }}
                options={{ maintainAspectRatio: false }}
              />
            </div>
          </div>

          {/* Orders by Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[340px] flex flex-col lg:col-span-2">
            <h3 className="font-bold mb-4 text-slate-800">Orders by Status</h3>
            <div className="flex-1 min-h-0 flex items-center justify-center max-w-md mx-auto w-full">
              <ChartComponents.Doughnut
                data={{
                  labels: Object.keys(analytics.statusCounts),
                  datasets: [
                    {
                      data: Object.values(analytics.statusCounts),
                      backgroundColor: Object.keys(analytics.statusCounts).map(
                        (s) => STATUS_COLORS[s] || "#94a3b8"
                      ),
                    },
                  ],
                }}
                options={{ maintainAspectRatio: false }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-slate-400 animate-pulse">
          Loading charts...
        </div>
      )}
    </div>
  );
}
