"use client";

import React, { useMemo } from "react";
import { Store } from "@/types/settings";
import { Order } from "@/types/order";
import { StoreInventoryItem } from "@/types/inventory";
import { parseTotal } from "@/lib/helpers";
import {
  Warehouse,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  ArrowRight,
} from "lucide-react";

interface StoreOverviewProps {
  stores: Store[];
  orders: Order[];
  inventory: StoreInventoryItem[];
  onSelectStore: (storeId: string) => void;
}

interface StoreMetrics {
  storeId: string;
  storeName: string;
  store: Store;
  totalOrders: number;
  revenue: number;
  pending: number;
  accepted: number;
  shipped: number;
  fulfilled: number;
  rejected: number;
  stockItems: number;
  stockValue: number;
  lowStock: number;
  fulfillmentRate: number;
}

export default function StoreOverview({ stores, orders, inventory, onSelectStore }: StoreOverviewProps) {
  // Compute per-store metrics
  const storeMetrics = useMemo(() => {
    const metricsMap = new Map<string, StoreMetrics>();

    // Initialize all stores
    for (const store of stores) {
      metricsMap.set(store.id, {
        storeId: store.id,
        storeName: store.name,
        store,
        totalOrders: 0,
        revenue: 0,
        pending: 0,
        accepted: 0,
        shipped: 0,
        fulfilled: 0,
        rejected: 0,
        stockItems: 0,
        stockValue: 0,
        lowStock: 0,
        fulfillmentRate: 0,
      });
    }

    // Aggregate order metrics
    for (const order of orders) {
      const sid = order.assignedStoreId;
      if (!sid || !metricsMap.has(sid)) continue;
      const m = metricsMap.get(sid)!;
      m.totalOrders++;
      m.revenue += parseTotal(order.totalValue);
      const status = (order.status || "Pending").toLowerCase();
      if (status === "pending") m.pending++;
      else if (status === "accepted") m.accepted++;
      else if (status === "shipped") m.shipped++;
      else if (status === "fulfilled") m.fulfilled++;
      else if (status === "rejected") m.rejected++;
    }

    // Aggregate inventory metrics
    for (const inv of inventory) {
      const m = metricsMap.get(inv.storeId);
      if (!m) continue;
      m.stockItems += inv.currentQty;
      m.stockValue += inv.currentQty * (inv.costPrice || 0);
      if (inv.reorderLevel > 0 && inv.currentQty <= inv.reorderLevel) m.lowStock++;
    }

    // Compute fulfillment rates
    for (const m of metricsMap.values()) {
      const nonRejected = m.totalOrders - m.rejected;
      m.fulfillmentRate = nonRejected > 0 ? Math.round((m.fulfilled / nonRejected) * 100) : 0;
    }

    return Array.from(metricsMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [stores, orders, inventory]);

  // Aggregate KPIs
  const totals = useMemo(() => {
    return storeMetrics.reduce(
      (acc, m) => ({
        orders: acc.orders + m.totalOrders,
        revenue: acc.revenue + m.revenue,
        pending: acc.pending + m.pending,
        activeStores: acc.activeStores + (m.store.isActive ? 1 : 0),
        lowStock: acc.lowStock + m.lowStock,
        stockValue: acc.stockValue + m.stockValue,
      }),
      { orders: 0, revenue: 0, pending: 0, activeStores: 0, lowStock: 0, stockValue: 0 }
    );
  }, [storeMetrics]);

  const getHealthBadge = (m: StoreMetrics) => {
    if (!m.store.isActive) return { label: "Inactive", color: "bg-slate-100 text-slate-500" };
    if (m.lowStock > 3) return { label: "Critical", color: "bg-red-100 text-red-700" };
    if (m.lowStock > 0) return { label: "Warning", color: "bg-amber-100 text-amber-700" };
    if (m.fulfillmentRate >= 80) return { label: "Healthy", color: "bg-emerald-100 text-emerald-700" };
    if (m.totalOrders === 0) return { label: "New", color: "bg-blue-100 text-blue-700" };
    return { label: "Active", color: "bg-emerald-50 text-emerald-600" };
  };

  return (
    <div className="space-y-6">
      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Active Stores"
          value={totals.activeStores}
          total={stores.length}
          icon={<Warehouse className="w-4 h-4 text-purple-600" />}
          color="purple"
        />
        <KPICard
          label="Total Orders"
          value={totals.orders}
          icon={<ShoppingCart className="w-4 h-4 text-blue-600" />}
          color="blue"
        />
        <KPICard
          label="Total Revenue"
          value={`\u20B9${totals.revenue.toLocaleString("en-IN")}`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          color="emerald"
        />
        <KPICard
          label="Pending Orders"
          value={totals.pending}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          color="amber"
        />
        <KPICard
          label="Stock Value"
          value={`\u20B9${totals.stockValue.toLocaleString("en-IN")}`}
          icon={<Package className="w-4 h-4 text-indigo-600" />}
          color="indigo"
        />
        <KPICard
          label="Low Stock Alerts"
          value={totals.lowStock}
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          color="red"
          alert={totals.lowStock > 0}
        />
      </div>

      {/* Store Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {storeMetrics.map((m) => {
          const health = getHealthBadge(m);
          return (
            <button
              key={m.storeId}
              onClick={() => onSelectStore(m.storeId)}
              className={`group text-left p-5 rounded-2xl border transition-all hover:shadow-md hover:border-purple-300 ${
                m.store.isActive ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-70"
              }`}
            >
              {/* Store Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    m.store.isActive ? "bg-purple-100" : "bg-slate-200"
                  }`}>
                    <Warehouse className={`w-5 h-5 ${m.store.isActive ? "text-purple-600" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 group-hover:text-purple-700 transition-colors">
                      {m.storeName}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {m.store.address.length > 40
                        ? m.store.address.slice(0, 40) + "..."
                        : m.store.address}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${health.color}`}>
                  {health.label}
                </span>
              </div>

              {/* Revenue + Orders Row */}
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <div className="text-lg font-bold text-slate-800">
                    {"\u20B9"}{m.revenue.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-slate-400">Revenue</div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <div className="text-lg font-bold text-slate-800">{m.totalOrders}</div>
                  <div className="text-[10px] text-slate-400">Orders</div>
                </div>
                {m.fulfillmentRate > 0 && (
                  <>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                      <div className={`text-lg font-bold ${
                        m.fulfillmentRate >= 80 ? "text-emerald-600" : m.fulfillmentRate >= 50 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {m.fulfillmentRate}%
                      </div>
                      <div className="text-[10px] text-slate-400">Fulfilled</div>
                    </div>
                  </>
                )}
              </div>

              {/* Mini Pipeline */}
              <div className="flex items-center gap-1.5 mb-3">
                {m.pending > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {m.pending}
                  </span>
                )}
                {m.accepted > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {m.accepted}
                  </span>
                )}
                {m.shipped > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-purple-50 text-purple-700 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> {m.shipped}
                  </span>
                )}
                {m.fulfilled > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {m.fulfilled}
                  </span>
                )}
                {m.rejected > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-600 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> {m.rejected}
                  </span>
                )}
                {m.totalOrders === 0 && (
                  <span className="text-[10px] text-slate-400">No orders yet</span>
                )}
              </div>

              {/* Stock Summary */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-slate-500">
                    <Package className="w-3 h-3 inline mr-0.5" />
                    {m.stockItems.toLocaleString("en-IN")} units
                  </span>
                  {m.lowStock > 0 && (
                    <span className="text-red-600 font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      {m.lowStock} low
                    </span>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      {stores.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Warehouse className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">No stores configured</p>
          <p className="text-sm mt-1">Add stores from the Stores management section to see analytics here</p>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label,
  value,
  total,
  icon,
  color,
  alert,
}: {
  label: string;
  value: string | number;
  total?: number;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        alert ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg bg-${color}-50 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold text-slate-800">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-slate-400">/{total}</span>
        )}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
