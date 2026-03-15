"use client";

import React, { useMemo } from "react";
import type { C2Theme } from "../CommandCenter";
import type { Order } from "@/types/order";
import type { Store } from "@/types/settings";
import { parseTotal } from "@/lib/helpers";
import { Warehouse, TrendingUp, ShoppingCart, Target, Package, ArrowRightLeft } from "lucide-react";

interface StoreAnalyticsProps {
  orders: Order[];
  stores: Store[];
  theme: C2Theme;
  onSelectStore?: (storeId: string) => void;
}

interface StoreMetrics {
  storeId: string;
  storeName: string;
  storeType: "own" | "agent";
  totalOrders: number;
  pendingOrders: number;
  acceptedOrders: number;
  shippedOrders: number;
  fulfilledOrders: number;
  rejectedOrders: number;
  revenue: number;
  pendingRevenue: number;
  fulfillmentRate: number;
  avgOrderValue: number;
}

export default function StoreAnalytics({ orders, stores, theme, onSelectStore }: StoreAnalyticsProps) {
  const storeMetrics = useMemo<StoreMetrics[]>(() => {
    // Group orders by assignedStoreId
    const byStore: Record<string, Order[]> = {};
    const unassigned: Order[] = [];

    orders.forEach((o) => {
      if (o.assignedStoreId) {
        if (!byStore[o.assignedStoreId]) byStore[o.assignedStoreId] = [];
        byStore[o.assignedStoreId].push(o);
      } else {
        unassigned.push(o);
      }
    });

    const metrics: StoreMetrics[] = stores.map((store) => {
      const storeOrders = byStore[store.id] || [];
      const fulfilled = storeOrders.filter((o) => o.status === "Fulfilled");
      const active = storeOrders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected");
      const revenue = fulfilled.reduce((s, o) => s + parseTotal(o.totalValue), 0);
      const pendingRev = active.reduce((s, o) => s + parseTotal(o.totalValue), 0);

      return {
        storeId: store.id,
        storeName: store.name,
        storeType: (store.type as "own" | "agent") || "own",
        totalOrders: storeOrders.length,
        pendingOrders: storeOrders.filter((o) => o.status === "Pending").length,
        acceptedOrders: storeOrders.filter((o) => o.status === "Accepted").length,
        shippedOrders: storeOrders.filter((o) => o.status === "Shipped").length,
        fulfilledOrders: fulfilled.length,
        rejectedOrders: storeOrders.filter((o) => o.status === "Rejected").length,
        revenue,
        pendingRevenue: pendingRev,
        fulfillmentRate: storeOrders.length > 0 ? Math.round((fulfilled.length / storeOrders.length) * 100) : 0,
        avgOrderValue: fulfilled.length > 0 ? Math.round(revenue / fulfilled.length) : 0,
      };
    });

    // Add "Unassigned" if there are unassigned orders
    if (unassigned.length > 0) {
      const uFulfilled = unassigned.filter((o) => o.status === "Fulfilled");
      const uActive = unassigned.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected");
      const uRevenue = uFulfilled.reduce((s, o) => s + parseTotal(o.totalValue), 0);
      metrics.push({
        storeId: "__unassigned__",
        storeName: "Unassigned",
        storeType: "own",
        totalOrders: unassigned.length,
        pendingOrders: unassigned.filter((o) => o.status === "Pending").length,
        acceptedOrders: unassigned.filter((o) => o.status === "Accepted").length,
        shippedOrders: unassigned.filter((o) => o.status === "Shipped").length,
        fulfilledOrders: uFulfilled.length,
        rejectedOrders: unassigned.filter((o) => o.status === "Rejected").length,
        revenue: uRevenue,
        pendingRevenue: uActive.reduce((s, o) => s + parseTotal(o.totalValue), 0),
        fulfillmentRate: unassigned.length > 0 ? Math.round((uFulfilled.length / unassigned.length) * 100) : 0,
        avgOrderValue: uFulfilled.length > 0 ? Math.round(uRevenue / uFulfilled.length) : 0,
      });
    }

    // Sort by revenue desc
    return metrics.sort((a, b) => b.revenue - a.revenue);
  }, [orders, stores]);

  // Aggregates for comparison bar
  const totalRevenue = storeMetrics.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-2.5 sm:px-4 py-2.5 sm:py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <h3 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2" style={{ color: "var(--c2-text)" }}>
          <ArrowRightLeft className="w-4 h-4 text-purple-500" />
          Store Comparison
        </h3>
        <span className="text-[9px] font-mono" style={{ color: "var(--c2-text-muted)" }}>
          {storeMetrics.filter((m) => m.totalOrders > 0).length} active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-2 sm:p-3 space-y-2">
        {storeMetrics.length === 0 ? (
          <div className="text-[11px] py-8 text-center" style={{ color: "var(--c2-text-muted)" }}>
            No stores found
          </div>
        ) : (
          storeMetrics.map((m) => {
            const revPct = totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0;
            return (
              <div
                key={m.storeId}
                className="rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: "var(--c2-bg-secondary)",
                  border: "1px solid var(--c2-border-subtle)",
                }}
                onClick={() => m.storeId !== "__unassigned__" && onSelectStore?.(m.storeId)}
              >
                {/* Store header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Warehouse className="w-3 h-3 text-purple-500" />
                    <span className="text-[11px] font-bold truncate max-w-[100px]" style={{ color: "var(--c2-text)" }}>
                      {m.storeName}
                    </span>
                    {m.storeId !== "__unassigned__" && (
                      <span
                        className="text-[8px] px-1 py-0.5 rounded-full font-bold"
                        style={{
                          background: m.storeType === "agent" ? "rgba(249,115,22,0.12)" : "rgba(16,185,129,0.12)",
                          color: m.storeType === "agent" ? "#f97316" : "#10b981",
                        }}
                      >
                        {m.storeType === "agent" ? "AGENT" : "OWN"}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: "#10b981" }}>
                    ₹{m.revenue.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Revenue bar */}
                <div className="h-1 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--c2-bg-card)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(revPct, 2)}%`, backgroundColor: "#10b981" }}
                  />
                </div>

                {/* Pipeline mini badges */}
                <div className="flex items-center gap-1 flex-wrap">
                  {m.pendingOrders > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                      {m.pendingOrders} Pending
                    </span>
                  )}
                  {m.acceptedOrders > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                      {m.acceptedOrders} Accepted
                    </span>
                  )}
                  {m.shippedOrders > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                      {m.shippedOrders} Shipped
                    </span>
                  )}
                  {m.fulfilledOrders > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                      {m.fulfilledOrders} Done
                    </span>
                  )}
                  {m.totalOrders === 0 && (
                    <span className="text-[8px] italic" style={{ color: "var(--c2-text-muted)" }}>No orders</span>
                  )}
                  {/* Fulfillment rate */}
                  <span className="ml-auto text-[8px] font-bold" style={{ color: m.fulfillmentRate >= 80 ? "#10b981" : m.fulfillmentRate >= 50 ? "#f59e0b" : "var(--c2-text-muted)" }}>
                    {m.fulfillmentRate}% ful.
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
