"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { db, functions } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Order } from "@/types/order";
import { StockPurchase, StockAnalyticsData } from "@/types/stock";
import { parseTotal, formatCurrency } from "@/lib/helpers";
import { useMode } from "@/contexts/ModeContext";
import {
  BarChart3,
  Users,
  Map,
  Globe2,
  Loader2,
  Shield,
  Phone,
  Mail,
  Clock,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import OrderLocationMap from "./OrderLocationMap";
import HeatMap from "./HeatMap";

type SubTab = "overview" | "users" | "map" | "geographic" | "stock";

interface RegisteredUser {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  disabled: boolean;
  isAdmin: boolean;
  orderCount: number;
  totalSpent: number;
}

interface PresenceDoc {
  uid: string;
  userId?: string; // old schema field
  displayName: string | null;
  email: string | null;
  phone: string | null;
  lastSeen: Timestamp | null;
  online?: boolean; // new schema
  status?: string; // old schema: "online" | "offline"
}

export default function AdminAnalytics() {
  const { col } = useMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("overview");

  // Chart.js dynamic imports
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [ChartComponents, setChartComponents] = useState<{
    Bar: any;
    Pie: any;
    Doughnut: any;
  } | null>(null);
  const registered = useRef(false);

  // Users state
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const usersLoaded = useRef(false);

  // Stock purchases
  const [stockPurchases, setStockPurchases] = useState<StockPurchase[]>([]);
  const stockLoaded = useRef(false);

  // Online presence
  const [onlineUsers, setOnlineUsers] = useState<PresenceDoc[]>([]);

  // Fetch all orders
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, col("orders")));
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
        setOrders(data);
      } catch (e) {
        console.error("[AdminAnalytics] Failed to fetch orders:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [col]);

  // Fetch stock purchases when Stock tab is activated
  useEffect(() => {
    if (activeSubTab !== "stock" || stockLoaded.current) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, col("stockPurchases")));
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as StockPurchase);
        setStockPurchases(data);
        stockLoaded.current = true;
      } catch (e) {
        console.error("[AdminAnalytics] Failed to fetch stock purchases:", e);
      }
    })();
  }, [activeSubTab, col]);

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

  // Listen to presence collection for online users
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "presence"),
      (snap) => {
        const now = Date.now();
        const twoMinutesAgo = now - 2 * 60 * 1000;

        const users: PresenceDoc[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as PresenceDoc;
          const lastSeen = data.lastSeen;
          let lastSeenMs = 0;
          if (lastSeen && typeof lastSeen.toMillis === "function") {
            lastSeenMs = lastSeen.toMillis();
          }
          // Support both new schema (online: boolean) and old schema (status: string)
          const isOnline = data.online === true || data.status === "online";
          if (lastSeenMs > twoMinutesAgo || isOnline) {
            users.push({ ...data, uid: data.uid || data.userId || d.id, lastSeen });
          }
        });
        setOnlineUsers(users);
      },
      (err) => {
        console.warn("[Presence] listener error:", err.message);
      }
    );
    return unsub;
  }, []);

  // Load registered users when Users tab is activated
  useEffect(() => {
    if (activeSubTab !== "users" || usersLoaded.current) return;

    (async () => {
      setUsersLoading(true);
      setUsersError("");
      try {
        const listUsers = httpsCallable<
          { pageSize?: number },
          { users: RegisteredUser[]; nextPageToken: string | null }
        >(functions, "listRegisteredUsers");
        const result = await listUsers({ pageSize: 500 });
        setRegisteredUsers(result.data.users);
        usersLoaded.current = true;
      } catch (e: any) {
        console.error("[AdminAnalytics] Failed to load users:", e);
        setUsersError(e.message || "Failed to load users.");
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [activeSubTab]);

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

    // Revenue by pincode
    const revenueByPincode: Record<string, { revenue: number; count: number }> = {};
    orders.forEach((o) => {
      const pin = o.pincode || "Unknown";
      if (!revenueByPincode[pin]) revenueByPincode[pin] = { revenue: 0, count: 0 };
      revenueByPincode[pin].revenue += parseTotal(o.totalValue);
      revenueByPincode[pin].count += 1;
    });
    const topPincodes = Object.entries(revenueByPincode)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);

    // Orders by day of week
    const dayOfWeekCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    orders.forEach((o) => {
      if (o.createdAt && typeof o.createdAt.toDate === "function") {
        const day = dayNames[o.createdAt.toDate().getDay()];
        dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1;
      }
    });

    // Orders by hour
    const hourCounts: number[] = new Array(24).fill(0);
    orders.forEach((o) => {
      if (o.createdAt && typeof o.createdAt.toDate === "function") {
        const hour = o.createdAt.toDate().getHours();
        hourCounts[hour] += 1;
      }
    });

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
      topPincodes,
      dayOfWeekCounts,
      hourCounts,
    };
  }, [orders]);

  // Compute stock analytics (bought vs sold)
  const stockAnalytics = useMemo(() => {
    if (stockPurchases.length === 0 && orders.length === 0) return null;

    // Aggregate bought quantities per product
    const boughtMap: Record<string, { qty: number; cost: number; unit: string }> = {};
    stockPurchases.forEach((sp) => {
      const key = sp.productName.toLowerCase();
      if (!boughtMap[key]) boughtMap[key] = { qty: 0, cost: 0, unit: sp.unit };
      boughtMap[key].qty += sp.qty;
      boughtMap[key].cost += sp.totalCost;
    });

    // Aggregate sold quantities from fulfilled orders
    const soldMap: Record<string, { qty: number; revenue: number }> = {};
    const fulfilledOrders = orders.filter((o) => o.status === "Fulfilled");
    fulfilledOrders.forEach((o) => {
      const cart = o.revisedFulfilledCart || o.revisedAcceptedCart || o.cart || [];
      cart.forEach((item) => {
        const key = item.name.toLowerCase();
        if (!soldMap[key]) soldMap[key] = { qty: 0, revenue: 0 };
        soldMap[key].qty += item.qty;
        soldMap[key].revenue += item.qty * item.price;
      });
    });

    // Merge into comparison data
    const allProducts = new Set([...Object.keys(boughtMap), ...Object.keys(soldMap)]);
    const comparison: StockAnalyticsData[] = [];
    let totalCost = 0;
    let totalRevenue = 0;

    allProducts.forEach((key) => {
      const bought = boughtMap[key] || { qty: 0, cost: 0, unit: "kg" };
      const sold = soldMap[key] || { qty: 0, revenue: 0 };
      const diff = bought.qty - sold.qty;
      const wastagePercent = bought.qty > 0 ? Math.max(0, (diff / bought.qty) * 100) : 0;
      const profit = sold.revenue - bought.cost;

      totalCost += bought.cost;
      totalRevenue += sold.revenue;

      // Use the original casing from either source
      const displayName =
        stockPurchases.find((sp) => sp.productName.toLowerCase() === key)?.productName ||
        key.charAt(0).toUpperCase() + key.slice(1);

      comparison.push({
        productName: displayName,
        qtyBought: bought.qty,
        qtySold: sold.qty,
        difference: diff,
        wastagePercent: Math.round(wastagePercent * 10) / 10,
        totalCost: bought.cost,
        totalRevenue: sold.revenue,
        profit,
      });
    });

    comparison.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      comparison,
      totalCost,
      totalRevenue,
      netProfit: totalRevenue - totalCost,
      totalWastage:
        totalCost > 0
          ? Math.round(
              (comparison.reduce((acc, c) => acc + Math.max(0, c.difference), 0) /
                comparison.reduce((acc, c) => acc + c.qtyBought, 0 )) *
                100 *
                10
            ) / 10
          : 0,
    };
  }, [stockPurchases, orders]);

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

  const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "stock", label: "Stock", icon: <Package className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "map", label: "Map", icon: <Map className="w-4 h-4" /> },
    { key: "geographic", label: "Geographic", icon: <Globe2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === tab.key
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.key === "users" && onlineUsers.length > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-green-400 text-white text-[10px] flex items-center justify-center font-bold">
                {onlineUsers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary Cards (always visible) */}
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

      {/* ========== OVERVIEW TAB ========== */}
      {activeSubTab === "overview" && (
        <>
          {/* Online Users Badge */}
          {onlineUsers.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {onlineUsers.length} Online Now
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {onlineUsers.slice(0, 8).map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full text-xs font-medium text-green-700 border border-green-100"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {u.displayName || u.email || u.phone || u.uid.slice(0, 8)}
                  </div>
                ))}
                {onlineUsers.length > 8 && (
                  <span className="text-xs text-slate-400 self-center">
                    +{onlineUsers.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

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

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[340px] flex flex-col">
                <h3 className="font-bold mb-4 text-slate-800">Top Products</h3>
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <ChartComponents.Pie
                    data={{
                      labels: analytics.topProducts.map((x: [string, number]) => x[0]),
                      datasets: [
                        {
                          data: analytics.topProducts.map((x: [string, number]) => x[1]),
                          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
                        },
                      ],
                    }}
                    options={{ maintainAspectRatio: false }}
                  />
                </div>
              </div>

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
        </>
      )}

      {/* ========== USERS TAB ========== */}
      {activeSubTab === "users" && (
        <div className="space-y-6">
          {/* Online Users Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <h3 className="font-bold text-slate-800">
                Online Users ({onlineUsers.length})
              </h3>
            </div>
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No users currently online.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {onlineUsers.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                      {(u.displayName || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-800 truncate">
                        {u.displayName || u.email || u.phone || "Anonymous"}
                      </div>
                      {u.phone && (
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {u.phone}
                        </div>
                      )}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registered Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">
                Registered Users
                {registeredUsers.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    ({registeredUsers.length})
                  </span>
                )}
              </h3>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-400">Loading users...</span>
              </div>
            ) : usersError ? (
              <div className="text-center py-16 text-red-500 text-sm">{usersError}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 text-center">Orders</th>
                      <th className="px-4 py-3 text-right">Spent</th>
                      <th className="px-4 py-3">Registered</th>
                      <th className="px-4 py-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registeredUsers.map((u) => {
                      const isOnline = onlineUsers.some((ou) => ou.uid === u.uid);
                      return (
                        <tr key={u.uid} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-500">
                                  {(u.displayName || u.email || "?")[0].toUpperCase()}
                                </div>
                                {isOnline && (
                                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">
                                  {u.displayName || "—"}
                                </div>
                                {u.isAdmin && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                    <Shield className="w-3 h-3" /> Admin
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {u.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {u.phone}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {u.email ? (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[180px]">{u.email}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <ShoppingCart className="w-3 h-3 text-slate-400" />
                              {u.orderCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {u.totalSpent > 0 ? `₹${u.totalSpent.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {u.createdAt ? (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(u.createdAt).toLocaleDateString("en-IN")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {u.lastSignIn
                              ? new Date(u.lastSignIn).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== STOCK TAB ========== */}
      {activeSubTab === "stock" && (
        <div className="space-y-6">
          {!stockLoaded.current ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-400">Loading stock data...</span>
            </div>
          ) : !stockAnalytics || stockAnalytics.comparison.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-600">No Stock Data</h3>
              <p className="text-sm text-slate-400 mt-1">
                Add stock purchases from the &quot;Buying Stock&quot; tab to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Stock Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-medium text-red-600">Total Stock Cost</span>
                  </div>
                  <div className="text-2xl font-bold text-red-700">
                    {formatCurrency(stockAnalytics.totalCost)}
                  </div>
                </div>
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600">Total Revenue</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(stockAnalytics.totalRevenue)}
                  </div>
                </div>
                <div
                  className={`p-5 rounded-2xl border ${
                    stockAnalytics.netProfit >= 0
                      ? "bg-green-50 border-green-100"
                      : "bg-red-50 border-red-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {stockAnalytics.netProfit >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        stockAnalytics.netProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      Net Profit
                    </span>
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      stockAnalytics.netProfit >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {stockAnalytics.netProfit >= 0 ? "" : "-"}
                    {formatCurrency(Math.abs(stockAnalytics.netProfit))}
                  </div>
                </div>
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-amber-600">Avg Wastage</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-700">
                    {stockAnalytics.totalWastage}%
                  </div>
                </div>
              </div>

              {/* Bought vs Sold Comparison Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Bought vs Sold — Per Product</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Compares stock purchased against fulfilled orders
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-center">Bought</th>
                        <th className="px-4 py-3 text-center">Sold</th>
                        <th className="px-4 py-3 text-center">Remaining</th>
                        <th className="px-4 py-3 text-center">Wastage %</th>
                        <th className="px-4 py-3 text-right">Cost</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                        <th className="px-4 py-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockAnalytics.comparison.map((row) => (
                        <tr key={row.productName} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {row.productName}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {row.qtyBought}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {row.qtySold}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-medium ${
                                row.difference > 0
                                  ? "text-amber-600"
                                  : row.difference < 0
                                  ? "text-blue-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {row.difference > 0 ? "+" : ""}
                              {row.difference}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                                row.wastagePercent > 20
                                  ? "bg-red-100 text-red-700"
                                  : row.wastagePercent > 5
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {row.wastagePercent}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {formatCurrency(row.totalCost)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600">
                            {formatCurrency(row.totalRevenue)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              row.profit >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {row.profit >= 0 ? "" : "-"}
                            {formatCurrency(Math.abs(row.profit))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                      <tr className="font-bold text-sm">
                        <td className="px-4 py-3 text-slate-700">Total</td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {stockAnalytics.comparison.reduce((a, c) => a + c.qtyBought, 0)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {stockAnalytics.comparison.reduce((a, c) => a + c.qtySold, 0)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {stockAnalytics.comparison.reduce((a, c) => a + c.difference, 0)}
                        </td>
                        <td className="px-4 py-3 text-center text-amber-700">
                          {stockAnalytics.totalWastage}%
                        </td>
                        <td className="px-4 py-3 text-right text-red-700">
                          {formatCurrency(stockAnalytics.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700">
                          {formatCurrency(stockAnalytics.totalRevenue)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            stockAnalytics.netProfit >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {stockAnalytics.netProfit >= 0 ? "" : "-"}
                          {formatCurrency(Math.abs(stockAnalytics.netProfit))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Charts */}
              {ChartComponents && stockAnalytics.comparison.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bought vs Sold Bar Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[380px]">
                    <h3 className="font-bold mb-4 text-slate-800">Bought vs Sold (Qty)</h3>
                    <ChartComponents.Bar
                      data={{
                        labels: stockAnalytics.comparison.slice(0, 10).map((c) => c.productName),
                        datasets: [
                          {
                            label: "Bought",
                            data: stockAnalytics.comparison.slice(0, 10).map((c) => c.qtyBought),
                            backgroundColor: "#ef4444",
                            borderRadius: 4,
                          },
                          {
                            label: "Sold",
                            data: stockAnalytics.comparison.slice(0, 10).map((c) => c.qtySold),
                            backgroundColor: "#10b981",
                            borderRadius: 4,
                          },
                        ],
                      }}
                      options={{ maintainAspectRatio: false }}
                    />
                  </div>

                  {/* Profit by Product Pie */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[380px] flex flex-col">
                    <h3 className="font-bold mb-4 text-slate-800">Profit by Product</h3>
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      <ChartComponents.Pie
                        data={{
                          labels: stockAnalytics.comparison
                            .filter((c) => c.profit > 0)
                            .slice(0, 8)
                            .map((c) => c.productName),
                          datasets: [
                            {
                              data: stockAnalytics.comparison
                                .filter((c) => c.profit > 0)
                                .slice(0, 8)
                                .map((c) => c.profit),
                              backgroundColor: [
                                "#10b981",
                                "#3b82f6",
                                "#f59e0b",
                                "#8b5cf6",
                                "#ef4444",
                                "#06b6d4",
                                "#ec4899",
                                "#84cc16",
                              ],
                            },
                          ],
                        }}
                        options={{ maintainAspectRatio: false }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== MAP TAB ========== */}
      {activeSubTab === "map" && (
        <div className="space-y-6">
          <OrderLocationMap orders={orders} />
          <HeatMap orders={orders} />
        </div>
      )}

      {/* ========== GEOGRAPHIC TAB ========== */}
      {activeSubTab === "geographic" && (
        <div className="space-y-6">
          {/* Revenue by Pincode */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-4 text-slate-800">Revenue by Pincode</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Pincode</th>
                    <th className="px-4 py-3 text-center">Orders</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Avg Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.topPincodes.map(([pin, data], i) => (
                    <tr key={pin} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{pin}</td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {data.count}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        ₹{data.revenue.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ₹{Math.round(data.revenue / data.count).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Time-based Charts */}
          {ChartComponents && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Orders by Day of Week */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[340px]">
                <h3 className="font-bold mb-4 text-slate-800">Orders by Day of Week</h3>
                <ChartComponents.Bar
                  data={{
                    labels: Object.keys(analytics.dayOfWeekCounts),
                    datasets: [
                      {
                        label: "Orders",
                        data: Object.values(analytics.dayOfWeekCounts),
                        backgroundColor: "#3b82f6",
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{ maintainAspectRatio: false }}
                />
              </div>

              {/* Orders by Hour */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[340px]">
                <h3 className="font-bold mb-4 text-slate-800">Orders by Hour</h3>
                <ChartComponents.Bar
                  data={{
                    labels: analytics.hourCounts.map((_: number, i: number) =>
                      `${i.toString().padStart(2, "0")}:00`
                    ),
                    datasets: [
                      {
                        label: "Orders",
                        data: analytics.hourCounts,
                        backgroundColor: "#8b5cf6",
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
