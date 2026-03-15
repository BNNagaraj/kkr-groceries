"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Store } from "@/types/settings";
import { Order, OrderStatus } from "@/types/order";
import { StoreInventoryItem } from "@/types/inventory";
import { parseTotal } from "@/lib/helpers";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Warehouse,
  MapPin,
  Phone,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Building2,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  Loader2,
  Link,
  Copy,
} from "lucide-react";

interface StoreDetailProps {
  store: Store;
  orders: Order[];
  inventory: StoreInventoryItem[];
  onBack: () => void;
  onNavigateToOrder?: (orderId: string) => void;
}

type PipelineFilter = "all" | OrderStatus;

export default function StoreDetail({ store, orders, inventory, onBack, onNavigateToOrder }: StoreDetailProps) {
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [autoAssigningId, setAutoAssigningId] = useState<string | null>(null);
  const [trackingLinkId, setTrackingLinkId] = useState<string | null>(null);

  // Auto-assign delivery boy
  const handleAutoAssign = useCallback(async (orderId: string) => {
    setAutoAssigningId(orderId);
    try {
      const autoAssignFn = httpsCallable<
        { orderId: string },
        { success: boolean; assigned: { name: string; distanceKm: number; phone: string | null }; candidateCount: number }
      >(functions, "autoAssignDeliveryBoy");
      const result = await autoAssignFn({ orderId });
      if (result.data.success) {
        toast.success(
          `Assigned ${result.data.assigned.name} (${result.data.assigned.distanceKm}km away)`,
          { description: `${result.data.candidateCount} delivery boys were considered` }
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Auto-assign failed";
      toast.error(msg);
    } finally {
      setAutoAssigningId(null);
    }
  }, []);

  // Generate & copy tracking link
  const handleTrackingLink = useCallback(async (orderId: string) => {
    setTrackingLinkId(orderId);
    try {
      const genFn = httpsCallable<
        { orderId: string },
        { success: boolean; trackingUrl: string }
      >(functions, "generateTrackingLink");
      const result = await genFn({ orderId });
      if (result.data.success) {
        await navigator.clipboard.writeText(result.data.trackingUrl);
        toast.success("Tracking link copied to clipboard!", {
          description: result.data.trackingUrl,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate tracking link";
      toast.error(msg);
    } finally {
      setTrackingLinkId(null);
    }
  }, []);

  // Orders for this store
  const storeOrders = useMemo(
    () => orders.filter((o) => o.assignedStoreId === store.id),
    [orders, store.id]
  );

  // Inventory for this store
  const storeInventory = useMemo(
    () => inventory.filter((inv) => inv.storeId === store.id),
    [inventory, store.id]
  );

  // Pipeline counts
  const pipeline = useMemo(() => {
    const counts = { Pending: 0, Accepted: 0, Shipped: 0, Fulfilled: 0, Rejected: 0 };
    for (const o of storeOrders) {
      const s = o.status || "Pending";
      if (s in counts) counts[s as OrderStatus]++;
    }
    return counts;
  }, [storeOrders]);

  // Revenue
  const revenue = useMemo(
    () => storeOrders.filter((o) => o.status === "Fulfilled").reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [storeOrders]
  );

  const totalRevenue = useMemo(
    () => storeOrders.reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [storeOrders]
  );

  // Inventory stats
  const invStats = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    let lowStock = 0;
    for (const inv of storeInventory) {
      totalQty += inv.currentQty;
      totalValue += inv.currentQty * (inv.costPrice || 0);
      if (inv.reorderLevel > 0 && inv.currentQty <= inv.reorderLevel) lowStock++;
    }
    return { totalQty, totalValue, lowStock, items: storeInventory.length };
  }, [storeInventory]);

  // Filtered orders for pipeline view
  const filteredOrders = useMemo(() => {
    let list = storeOrders;
    if (pipelineFilter !== "all") {
      list = list.filter((o) => o.status === pipelineFilter);
    }
    // Sort by most recent first
    return list.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [storeOrders, pipelineFilter]);

  const fulfillmentRate = useMemo(() => {
    const nonRejected = storeOrders.length - pipeline.Rejected;
    return nonRejected > 0 ? Math.round((pipeline.Fulfilled / nonRejected) * 100) : 0;
  }, [storeOrders.length, pipeline]);

  return (
    <div className="space-y-6">
      {/* Back Button + Store Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-1 p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              store.isActive ? "bg-purple-100" : "bg-slate-200"
            }`}>
              <Warehouse className={`w-6 h-6 ${store.isActive ? "text-purple-600" : "text-slate-400"}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{store.name}</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {store.address}
                </span>
                {store.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {store.phone}
                  </span>
                )}
              </div>
            </div>
            {/* Badges */}
            <div className="flex items-center gap-2 ml-auto">
              {(store.type || "own") === "own" ? (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Own Run
                </span>
              ) : (
                <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-lg flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Agent: {store.agentName}
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                store.isActive ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"
              }`}>
                {store.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total Orders" value={storeOrders.length} icon={<ShoppingCart className="w-4 h-4 text-blue-600" />} />
        <StatCard label="Revenue (Fulfilled)" value={`\u20B9${revenue.toLocaleString("en-IN")}`} icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} />
        <StatCard label="Pipeline Value" value={`\u20B9${totalRevenue.toLocaleString("en-IN")}`} icon={<TrendingUp className="w-4 h-4 text-blue-600" />} />
        <StatCard label="Fulfillment Rate" value={`${fulfillmentRate}%`} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
        <StatCard label="Stock Items" value={invStats.items} subtitle={`${invStats.totalQty.toLocaleString("en-IN")} units`} icon={<Package className="w-4 h-4 text-purple-600" />} />
        <StatCard
          label="Low Stock"
          value={invStats.lowStock}
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          alert={invStats.lowStock > 0}
        />
      </div>

      {/* Order Pipeline */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">Order Pipeline</h3>
          {/* Pipeline Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <PipelineTab
              label="All"
              count={storeOrders.length}
              active={pipelineFilter === "all"}
              onClick={() => setPipelineFilter("all")}
              color="slate"
            />
            <PipelineTab
              label="Pending"
              count={pipeline.Pending}
              active={pipelineFilter === "Pending"}
              onClick={() => setPipelineFilter("Pending")}
              color="amber"
            />
            <PipelineTab
              label="Accepted"
              count={pipeline.Accepted}
              active={pipelineFilter === "Accepted"}
              onClick={() => setPipelineFilter("Accepted")}
              color="blue"
            />
            <PipelineTab
              label="Shipped"
              count={pipeline.Shipped}
              active={pipelineFilter === "Shipped"}
              onClick={() => setPipelineFilter("Shipped")}
              color="purple"
            />
            <PipelineTab
              label="Fulfilled"
              count={pipeline.Fulfilled}
              active={pipelineFilter === "Fulfilled"}
              onClick={() => setPipelineFilter("Fulfilled")}
              color="emerald"
            />
            <PipelineTab
              label="Rejected"
              count={pipeline.Rejected}
              active={pipelineFilter === "Rejected"}
              onClick={() => setPipelineFilter("Rejected")}
              color="red"
            />
          </div>
        </div>

        {/* Order List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No orders {pipelineFilter !== "all" ? `with status "${pipelineFilter}"` : "assigned to this store"}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <div key={order.id} className="hover:bg-slate-50/50 transition-colors">
                  <div
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusDotColor(order.status)}`} />

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800">
                          #{order.orderId || order.id.slice(0, 8)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {order.customerName} {order.shopName ? `(${order.shopName})` : ""} &middot; {order.productCount} items
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-slate-800">{order.totalValue}</div>
                      <div className="text-[10px] text-slate-400">{order.timestamp}</div>
                    </div>

                    {/* Expand indicator */}
                    {expandedOrderId === order.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>

                  {/* Expanded details */}
                  {expandedOrderId === order.id && (
                    <div className="px-4 pb-3 ml-6">
                      <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Customer:</span>{" "}
                            <span className="font-medium text-slate-700">{order.customerName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Phone:</span>{" "}
                            <span className="font-medium text-slate-700">{order.phone}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Location:</span>{" "}
                            <span className="font-medium text-slate-700">{order.location}</span>
                          </div>
                          {order.assignedToName && (
                            <div>
                              <span className="text-slate-400">Delivery:</span>{" "}
                              <span className="font-medium text-purple-700">{order.assignedToName}</span>
                            </div>
                          )}
                        </div>
                        {/* Cart items */}
                        <div className="border-t border-slate-200 pt-2 mt-2">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Items</div>
                          <div className="space-y-0.5">
                            {order.cart.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-slate-600">{item.name}</span>
                                <span className="text-slate-500">
                                  {item.qty} {item.unit} &times; {"\u20B9"}{item.price}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                          {/* Auto-assign delivery boy */}
                          {!order.assignedTo && (order.status === "Accepted" || order.status === "Pending") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoAssign(order.id);
                              }}
                              disabled={autoAssigningId === order.id}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 disabled:opacity-50"
                            >
                              {autoAssigningId === order.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              Auto-assign delivery
                            </button>
                          )}
                          {/* Generate tracking link (needs delivery boy assigned) */}
                          {order.assignedTo && (order.status === "Accepted" || order.status === "Shipped") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrackingLink(order.id);
                              }}
                              disabled={trackingLinkId === order.id}
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1 disabled:opacity-50"
                            >
                              {trackingLinkId === order.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Link className="w-3 h-3" />
                              )}
                              Share tracking
                            </button>
                          )}
                          {order.assignedToName && (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                              <Truck className="w-3 h-3" /> {order.assignedToName}
                            </span>
                          )}
                          {/* Navigate to full order */}
                          {onNavigateToOrder && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToOrder(order.id);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 font-medium ml-auto"
                            >
                              View full order &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      {storeInventory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Stock Inventory</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {invStats.items} products &middot; {invStats.totalQty.toLocaleString("en-IN")} total units &middot; {"\u20B9"}{invStats.totalValue.toLocaleString("en-IN")} value
            </p>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-left">Unit</th>
                  <th className="px-4 py-2 text-right">Cost Price</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {storeInventory
                  .sort((a, b) => {
                    // Low stock first
                    const aLow = a.reorderLevel > 0 && a.currentQty <= a.reorderLevel;
                    const bLow = b.reorderLevel > 0 && b.currentQty <= b.reorderLevel;
                    if (aLow && !bLow) return -1;
                    if (!aLow && bLow) return 1;
                    return a.productName.localeCompare(b.productName);
                  })
                  .map((inv) => {
                    const isLow = inv.reorderLevel > 0 && inv.currentQty <= inv.reorderLevel;
                    return (
                      <tr key={inv.id} className={isLow ? "bg-red-50/50" : "hover:bg-slate-50"}>
                        <td className="px-4 py-2 font-medium text-slate-700">{inv.productName}</td>
                        <td className={`px-4 py-2 text-right font-bold ${isLow ? "text-red-600" : "text-slate-800"}`}>
                          {inv.currentQty.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{inv.unit}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{"\u20B9"}{inv.costPrice}</td>
                        <td className="px-4 py-2 text-right font-medium text-slate-700">
                          {"\u20B9"}{(inv.currentQty * (inv.costPrice || 0)).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {isLow ? (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 justify-center w-fit mx-auto">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtitle,
  icon,
  alert,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={`p-3 rounded-xl border ${alert ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {subtitle && <div className="text-[10px] text-slate-400">{subtitle}</div>}
    </div>
  );
}

function PipelineTab({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    slate: active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
    amber: active ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
    blue: active ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100",
    purple: active ? "bg-purple-500 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100",
    emerald: active ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    red: active ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100",
  };

  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${bgMap[color] || bgMap.slate}`}
    >
      {label} {count > 0 && <span className="ml-0.5">({count})</span>}
    </button>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    Pending: "bg-amber-50 text-amber-700",
    Accepted: "bg-blue-50 text-blue-700",
    Shipped: "bg-purple-50 text-purple-700",
    Fulfilled: "bg-emerald-50 text-emerald-700",
    Rejected: "bg-red-50 text-red-600",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles[status] || styles.Pending}`}>
      {status}
    </span>
  );
}

function getStatusDotColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    Pending: "bg-amber-500",
    Accepted: "bg-blue-500",
    Shipped: "bg-purple-500",
    Fulfilled: "bg-emerald-500",
    Rejected: "bg-red-500",
  };
  return colors[status] || colors.Pending;
}
