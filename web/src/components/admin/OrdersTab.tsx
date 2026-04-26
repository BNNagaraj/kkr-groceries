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
import {
  LayoutDashboard,
  RefreshCw,
  Download,
  Calendar,
  List,
  ShoppingCart,
} from "lucide-react";
import { Order, OrderStatus, STATUS_TIMESTAMP_FIELDS, OrderCartItem } from "@/types/order";
import { useDeliveryOTP } from "@/hooks/useDeliveryOTP";
// jsPDF lazy-loaded on click (~200KB kept out of initial bundle)
const lazyDownloadInvoice = async (order: Order) => {
  const { downloadInvoice } = await import("@/lib/invoice");
  downloadInvoice(order);
};
import dynamic from "next/dynamic";
import { useMode } from "@/contexts/ModeContext";
import { Product } from "@/contexts/AppContext";
import OrderEditModal from "./OrderEditModal";
import { AdminOrderCard } from "./AdminOrderCard";
import { DeliveryOtpDialog } from "./DeliveryOtpDialog";

const BuyList = dynamic(() => import("./BuyList"), { ssr: false });
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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

const STATUS_FILTERS: Array<OrderStatus | "all"> = ["all", "Pending", "Accepted", "Shipped", "Fulfilled", "Rejected"];

const DATE_MS_MAP: Record<string, number> = {
  week: 7 * DAY,
  fortnight: 14 * DAY,
  month: 30 * DAY,
  quarter: 90 * DAY,
  half: 180 * DAY,
  year: 365 * DAY,
};

/** Get midnight of today in local timezone */
function getMidnightToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface OrdersTabProps {
  products?: Product[];
  highlightOrderId?: string | null;
  onHighlightClear?: () => void;
}

export default function OrdersTab({ products = [], highlightOrderId, onHighlightClear }: OrdersTabProps) {
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
  const [viewMode, setViewMode] = useState<"orders" | "buylist">("orders");
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  // OTP on Fulfill — hook owns settings load, send/verify, recaptcha lifecycle.
  // The actual fulfill action is `handleStatusChange` declared below; we wire it
  // through a ref so the hook can be initialized before that function exists.
  const otpFulfillRef = useRef<((orderId: string) => Promise<void>) | null>(null);
  const otp = useDeliveryOTP({
    recaptchaContainerId: "otp-recaptcha-container",
    onVerified: async (orderId) => {
      await otpFulfillRef.current?.(orderId);
    },
    logPrefix: "[OTP]",
  });

  const loadOrders = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      lastDocRef.current = null;
    } else {
      setLoadingMore(true);
    }

    try {
      // ── Strategy ──────────────────────────────────────────────
      // Firestore composite indexes for (status + createdAt) may not exist.
      // So we always query by date range + orderBy("createdAt") server-side
      // (single-field index, always works), and apply status filter client-side.
      // We fetch extra results when status-filtering to compensate for filtered-out items.
      const constraints: QueryConstraint[] = [];

      // Date range filter (server-side — single field index on createdAt)
      if (dateFilter === "today") {
        constraints.push(where("createdAt", ">=", Timestamp.fromDate(getMidnightToday())));
      } else if (dateFilter === "custom") {
        if (customFrom) {
          constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(customFrom + "T00:00:00"))));
        }
        if (customTo) {
          constraints.push(where("createdAt", "<=", Timestamp.fromDate(new Date(customTo + "T23:59:59.999"))));
        }
      } else if (dateFilter !== "all" && DATE_MS_MAP[dateFilter]) {
        const startMs = Date.now() - DATE_MS_MAP[dateFilter];
        constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(startMs))));
      }

      constraints.push(orderBy("createdAt", "desc"));

      // Fetch more when status-filtering to ensure enough visible results
      const fetchLimit = statusFilter !== "all" ? ORDERS_PER_PAGE * 4 : ORDERS_PER_PAGE;
      constraints.push(limit(fetchLimit));

      if (!reset && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      const q = query(collection(db, col("orders")), ...constraints);
      const snap = await getDocs(q);
      let newOrders = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);

      // Apply status filter client-side (no composite index needed)
      if (statusFilter !== "all") {
        newOrders = newOrders.filter((o) => (o.status || "Pending") === statusFilter);
      }

      setHasMore(snap.docs.length === fetchLimit);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;

      if (reset) {
        setOrders(newOrders);
      } else {
        setOrders((prev) => [...prev, ...newOrders]);
      }
    } catch (e) {
      console.error("[Orders] Query failed:", e);
      toast.error("Failed to load orders. Retrying with basic query...");
      try {
        const snap = await getDocs(query(collection(db, col("orders")), orderBy("createdAt", "desc"), limit(ORDERS_PER_PAGE)));
        let data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
        if (statusFilter !== "all") {
          data = data.filter((o) => (o.status || "Pending") === statusFilter);
        }
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

  // Cross-tab navigation: scroll to and highlight a specific order card
  useEffect(() => {
    if (!highlightOrderId) return;

    // Reset filters to show all orders so the target card is visible
    setDateFilter("all");
    setStatusFilter("all");

    // Wait for orders to render, then scroll
    const timer = setTimeout(() => {
      const el = document.getElementById(`order-card-${highlightOrderId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Clear highlight after animation completes (3s)
      const clearTimer = setTimeout(() => {
        onHighlightClear?.();
      }, 3000);
      return () => clearTimeout(clearTimer);
    }, 400);

    return () => clearTimeout(timer);
  }, [highlightOrderId, onHighlightClear]);

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

  // Wire the OTP hook's `onVerified` callback to handleStatusChange. Re-binds each
  // render so the hook always sees the freshest closure without re-initializing.
  otpFulfillRef.current = (orderId: string) => handleStatusChange(orderId, "Fulfilled");

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

  const handleFulfillClick = (order: Order) => {
    // Open OTP dialog if OTP is required AND buyer has any reachable channel.
    // Otherwise fulfill immediately.
    const hasAnyContact = !!(order.userEmail || order.phone || order.userId);
    if (otp.required && hasAnyContact) {
      otp.openDialog(order);
    } else {
      handleStatusChange(order.id, "Fulfilled");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-slate-400" /> Order Management
          <span className="text-sm font-normal text-slate-400">({orders.length})</span>
        </h2>
        <div className="flex gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode("orders")}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === "orders"
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <List className="w-3.5 h-3.5" /> Orders
            </button>
            <button
              onClick={() => { setViewMode("buylist"); setStatusFilter("all"); }}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === "buylist"
                  ? "bg-emerald-700 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Buy List
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadOrders(true)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
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

      {/* Buy List View */}
      {viewMode === "buylist" && (
        <BuyList orders={orders} products={products} productImageMap={productImageMap} />
      )}

      {/* Status Filter — Orders view only */}
      {viewMode === "orders" && <div className="flex flex-wrap gap-1.5">
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
      </div>}

      {/* Loading state */}
      {viewMode === "orders" && loading && (
        <div className="text-center py-12 text-slate-400">Loading orders...</div>
      )}

      {/* Empty state */}
      {viewMode === "orders" && !loading && orders.length === 0 && (
        <div className="text-center py-12 text-slate-400">No orders found for this timeframe.</div>
      )}

      {/* Order cards */}
      {viewMode === "orders" && !loading &&
        orders.map((o) => (
          <AdminOrderCard
            key={o.id}
            order={o}
            productImageMap={productImageMap}
            highlight={highlightOrderId === o.id}
            onAccept={(id) => handleStatusChange(id, "Accepted")}
            onShip={(id) => handleStatusChange(id, "Shipped")}
            onReject={(id) => handleStatusChange(id, "Rejected")}
            onFulfillClick={handleFulfillClick}
            onEdit={(order) => setEditingOrder(order)}
            onCancelModification={handleCancelModification}
            onDownloadInvoice={lazyDownloadInvoice}
          />
        ))}
      {/* Load More */}
      {viewMode === "orders" && !loading && hasMore && (
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

      {/* OTP Verification Dialog */}
      <DeliveryOtpDialog
        otp={otp}
        onFulfillWithoutOtp={(orderId) => handleStatusChange(orderId, "Fulfilled")}
      />

      {/* Invisible reCAPTCHA container — OUTSIDE Dialog so it persists across open/close */}
      <div id="otp-recaptcha-container" />
    </div>
  );
}
