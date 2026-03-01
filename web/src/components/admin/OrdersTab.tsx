"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  startAfter,
  serverTimestamp,
  DocumentSnapshot,
  deleteField,
  addDoc,
  where,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import Image from "next/image";
import {
  LayoutDashboard,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Pencil,
  FileText,
  MapPin,
  Clock,
  Calendar,
} from "lucide-react";
import { Order, OrderStatus, STATUS_TIMESTAMP_FIELDS, OrderCartItem } from "@/types/order";
import { downloadInvoice } from "@/lib/invoice";
import { useMode } from "@/contexts/ModeContext";
import { Product } from "@/contexts/AppContext";
import OrderEditModal from "./OrderEditModal";
import { StatusTimeline, formatStatusTime } from "@/components/OrderTimeline";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ORDERS_PER_PAGE = 50;
const DAY = 86400000;

const DATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "fortnight", label: "2 Weeks" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "half", label: "6 Months" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom Range" },
] as const;

type DateFilterKey = (typeof DATE_FILTERS)[number]["key"];

const STATUS_FILTERS: Array<OrderStatus | "all"> = ["all", "Pending", "Accepted", "Fulfilled", "Rejected"];

const DATE_MS_MAP: Record<string, number> = {
  today: DAY,
  week: 7 * DAY,
  fortnight: 14 * DAY,
  month: 30 * DAY,
  quarter: 90 * DAY,
  half: 180 * DAY,
  year: 365 * DAY,
};

function statusBadgeVariant(status: OrderStatus, hasPendingMod: boolean): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Fulfilled") return "default";
  if (status === "Accepted") return "secondary";
  if (status === "Rejected") return "destructive";
  if (hasPendingMod) return "outline";
  return "outline";
}

export default function OrdersTab({ products = [] }: { products?: Product[] }) {
  const { col } = useMode();

  // Lookup map: product name → image URL (for backfilling orders missing images)
  const productImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => {
      if (p.image) map[p.name.toLowerCase()] = p.image;
    });
    return map;
  }, [products]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const loadOrders = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      lastDocRef.current = null;
    } else {
      setLoadingMore(true);
    }

    try {
      // Build query constraints for server-side filtering
      const constraints: QueryConstraint[] = [];

      // Status filter (must come before orderBy if using composite index)
      if (statusFilter !== "all") {
        constraints.push(where("status", "==", statusFilter));
      }

      // Date range filter
      if (dateFilter === "custom" && customFrom) {
        constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(customFrom + "T00:00:00"))));
        if (customTo) {
          const toDate = new Date(customTo + "T23:59:59.999");
          constraints.push(where("createdAt", "<=", Timestamp.fromDate(toDate)));
        }
      } else if (dateFilter !== "all" && DATE_MS_MAP[dateFilter]) {
        const startMs = Date.now() - DATE_MS_MAP[dateFilter];
        constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(startMs))));
      }

      constraints.push(orderBy("createdAt", "desc"));
      constraints.push(limit(ORDERS_PER_PAGE));

      if (!reset && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      const q = query(collection(db, col("orders")), ...constraints);
      const snap = await getDocs(q);
      const newOrders = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);

      setHasMore(snap.docs.length === ORDERS_PER_PAGE);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;

      if (reset) {
        setOrders(newOrders);
      } else {
        setOrders((prev) => [...prev, ...newOrders]);
      }
    } catch (e) {
      console.warn("[Orders] Query failed, trying fallback:", e);
      try {
        const snap = await getDocs(query(collection(db, col("orders")), orderBy("createdAt", "desc"), limit(ORDERS_PER_PAGE)));
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
        setOrders(data);
        setHasMore(false);
      } catch (e2) {
        console.error("[Orders] Fallback failed:", e2);
        toast.error("Failed to load orders.");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [dateFilter, statusFilter, customFrom, customTo, col]);

  useEffect(() => {
    loadOrders(true);
  }, [loadOrders]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      const timestampField = STATUS_TIMESTAMP_FIELDS[newStatus];
      if (timestampField) {
        updates[timestampField] = serverTimestamp();
      }
      if (newStatus === "Fulfilled") {
        updates.shippedAt = serverTimestamp();
      }

      await updateDoc(doc(db, col("orders"), orderId), updates);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      toast.success(`Order ${newStatus.toLowerCase()} successfully.`);

      // Send notification to buyer (fire-and-forget)
      try {
        const notifyFn = httpsCallable(functions, "notifyOrderStatusChange");
        notifyFn({ orderId, newStatus, orderCollection: col("orders") });
      } catch (notifyErr) {
        console.warn("Failed to trigger status notification:", notifyErr);
      }
    } catch (e) {
      console.error("Failed to update status:", e);
      toast.error("Failed to update order status.", {
        description: "You may need to sign out and back in to refresh admin permissions.",
      });
    }
  };

  const handleCancelModification = async (orderId: string) => {
    try {
      await updateDoc(doc(db, col("orders"), orderId), {
        pendingModification: deleteField(),
        modificationStatus: deleteField(),
        buyerNotified: false,
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, pendingModification: undefined, modificationStatus: undefined }
            : o
        )
      );
      toast.success("Modification cancelled.");
    } catch (e) {
      console.error("Failed to cancel modification:", e);
      toast.error("Failed to cancel modification.");
    }
  };

  const handleSaveEdit = async (
    orderId: string,
    proposedCart: OrderCartItem[],
    changes: string[],
    userId: string
  ) => {
    let totalVal = 0;
    const finalSummary: string[] = [];
    let newCount = 0;

    proposedCart.forEach((item) => {
      totalVal += item.qty * item.price;
      finalSummary.push(`${item.name} x${item.qty}`);
      newCount++;
    });

    const pendingModification = {
      proposedCart,
      proposedSummary: finalSummary.join(", "),
      proposedTotalValue: "\u20B9" + totalVal.toLocaleString("en-IN"),
      proposedCount: newCount,
      changes: changes.length > 0 ? changes : ["Order details updated"],
      modifiedAt: new Date().toISOString(),
      modifiedBy: "admin",
      status: "PendingBuyerApproval" as const,
    };

    await updateDoc(doc(db, col("orders"), orderId), {
      pendingModification,
      modificationStatus: "PendingBuyerApproval",
    });

    // Send notification to buyer
    if (userId) {
      try {
        await addDoc(collection(db, col("notifications")), {
          userId,
          orderId,
          type: "orderModification",
          title: "Order Modification Request",
          message: `Your order ${orderId} has been modified. Changes: ${changes.join(", ")}`,
          changes,
          read: false,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, col("orders"), orderId), {
          buyerNotified: true,
          notificationSentAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Failed to send notification:", e);
      }
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, pendingModification, modificationStatus: "PendingBuyerApproval" }
          : o
      )
    );
    setEditingOrder(null);
    toast.success("Changes sent to buyer for approval.");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-slate-400" /> Order Management
          <span className="text-sm font-normal text-slate-400">({orders.length})</span>
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadOrders(true)}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Date Filter Chips */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              dateFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {dateFilter === "custom" && (
        <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <label className="text-xs font-semibold text-slate-500">From:</label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <label className="text-xs font-semibold text-slate-500">To:</label>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs font-semibold text-slate-400 self-center mr-1">Status:</span>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "all" ? "All Statuses" : s}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-slate-400">Loading orders...</div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className="text-center py-12 text-slate-400">No orders found for this timeframe.</div>
      )}

      {/* Order cards */}
      {!loading &&
        orders.map((o) => {
          const hasPendingMod = o.modificationStatus === "PendingBuyerApproval";
          const statusText = hasPendingMod ? "Pending Approval" : o.status || "Pending";
          const cart = o.cart || [];

          return (
            <div
              key={o.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                        {o.orderId || o.id}
                      </span>
                      <Badge variant={statusBadgeVariant(o.status || "Pending", hasPendingMod)}>
                        {statusText}
                      </Badge>
                      {hasPendingMod && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                          Waiting for buyer approval
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 mb-0.5">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {o.timestamp || formatStatusTime(o.createdAt)}
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">{o.shopName || o.customerName}</span>
                      {" \u2022 "}
                      {o.customerName} {" \u2022 "} {o.phone}
                    </div>
                    {o.location && (
                      <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(o.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:underline"
                        >
                          {o.location}
                          {o.pincode ? ` - ${o.pincode}` : ""}
                        </a>
                      </div>
                    )}
                    <StatusTimeline order={o} />
                  </div>
                </div>
              </div>

              {/* Cart items */}
              <div className="px-4 py-3">
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    {cart.map((item, idx) => {
                      const amount = (item.qty || 0) * (item.price || 0);
                      const origItem = o.originalCart
                        ? o.originalCart.find((oi: OrderCartItem) => oi.name === item.name)
                        : undefined;
                      const qtyChanged = origItem && origItem.qty !== item.qty;
                      const priceChanged = origItem && origItem.price !== item.price;

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 text-sm py-2 border-b border-slate-50 last:border-0"
                        >
                          {/* Product Image - with backfill from current products */}
                          {(() => {
                            const resolvedImg = item.image || productImageMap[(item.name || "").toLowerCase()] || "";
                            return (
                              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative shrink-0 flex items-center justify-center">
                                {resolvedImg ? (
                                  <Image
                                    src={resolvedImg}
                                    alt={item.name}
                                    fill
                                    sizes="56px"
                                    className="object-cover"
                                    unoptimized={!resolvedImg.includes("googleapis.com")}
                                  />
                                ) : (
                                  <span className="text-sm font-bold text-slate-300">
                                    {item.name?.[0] || "?"}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          {/* Product Name */}
                          <span className="text-slate-700 font-medium flex-1 min-w-0 truncate">{item.name}</span>

                          {/* Qty + Price + Total grouped on the right */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-right ${qtyChanged ? "bg-yellow-100 rounded px-1" : "text-slate-500"}`}>
                              {qtyChanged && (
                                <span className="line-through text-slate-400 mr-1 text-xs">{origItem.qty}</span>
                              )}
                              {item.qty} {item.unit}
                            </span>
                            <span className={`text-right ${priceChanged ? "bg-yellow-100 rounded px-1" : "text-slate-500"}`}>
                              {priceChanged && (
                                <span className="line-through text-slate-400 mr-1 text-xs">&#8377;{origItem.price}</span>
                              )}
                              &#8377;{item.price}
                            </span>
                            <span className="text-slate-800 font-semibold w-20 text-right">
                              &#8377;{amount.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">{o.orderSummary}</div>
                )}
              </div>

              {/* Footer: actions left + total right */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                {/* Action buttons — LEFT side */}
                <div className="flex flex-wrap gap-2">
                  {hasPendingMod ? (
                    <>
                      <Button variant="destructive" size="sm" onClick={() => handleCancelModification(o.id)}>
                        <XCircle className="w-3.5 h-3.5" /> Cancel Changes
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => downloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                    </>
                  ) : o.status === "Pending" || !o.status ? (
                    <>
                      <Button size="sm" onClick={() => handleStatusChange(o.id, "Accepted")} className="bg-blue-500 hover:bg-blue-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingOrder(o)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange(o.id, "Rejected")}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </>
                  ) : o.status === "Accepted" ? (
                    <>
                      <Button size="sm" onClick={() => handleStatusChange(o.id, "Fulfilled")}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fulfill
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingOrder(o)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                    </>
                  ) : o.status === "Fulfilled" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => downloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingOrder(o)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                    </>
                  ) : null}
                </div>

                {/* Item count + total — RIGHT side */}
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400">{o.productCount || cart.length} items</span>
                  <span className="text-lg font-extrabold text-slate-800">{o.totalValue}</span>
                </div>
              </div>
            </div>
          );
        })}

      {/* Load More */}
      {!loading && hasMore && (
        <div className="text-center pt-4">
          <Button
            variant="secondary"
            onClick={() => loadOrders(false)}
            disabled={loadingMore}
          >
            <Download className="w-4 h-4" />
            {loadingMore ? "Loading..." : "Load More Orders"}
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
