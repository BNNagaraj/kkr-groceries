"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { Order } from "@/types/order";
import { formatCurrency, parseTotal } from "@/lib/helpers";
import { toast } from "sonner";
import {
  Truck,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ViewTab = "active" | "completed";

const STATUS_COLORS: Record<string, string> = {
  Accepted: "bg-blue-100 text-blue-700 border-blue-200",
  Shipped: "bg-amber-100 text-amber-700 border-amber-200",
  Fulfilled: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function DeliveryDashboard() {
  const { currentUser } = useAuth();
  const { col } = useMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ViewTab>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Real-time listener for assigned orders
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, col("orders")),
      where("assignedTo", "==", currentUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
        // Sort by most recent first
        data.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tB - tA;
        });
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error("[DeliveryDashboard] Snapshot error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [currentUser, col]);

  const activeOrders = orders.filter(
    (o) => o.status === "Accepted" || o.status === "Shipped"
  );
  const completedOrders = orders.filter(
    (o) => o.status === "Fulfilled" || o.status === "Rejected"
  );
  const displayOrders = tab === "active" ? activeOrders : completedOrders;

  const handleMarkDelivered = useCallback(
    async (orderId: string) => {
      setMarkingId(orderId);
      try {
        await updateDoc(doc(db, col("orders"), orderId), {
          status: "Fulfilled",
          deliveredAt: serverTimestamp(),
        });
        toast.success("Order marked as delivered!");
      } catch (e) {
        console.error("[DeliveryDashboard] Mark delivered failed:", e);
        toast.error("Failed to mark as delivered.");
      } finally {
        setMarkingId(null);
      }
    },
    [col]
  );

  const openNavigation = (lat: number, lng: number) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank"
    );
  };

  const formatTime = (ts?: Timestamp) => {
    if (!ts || typeof ts.toDate !== "function") return "—";
    return ts.toDate().toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Truck className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">My Deliveries</h2>
            <p className="text-sm text-slate-500">
              {activeOrders.length} active
              {activeOrders.length !== 1 ? " deliveries" : " delivery"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
            tab === "active"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Active ({activeOrders.length})
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
            tab === "completed"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Completed ({completedOrders.length})
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading deliveries...
        </div>
      )}

      {/* Empty */}
      {!loading && displayOrders.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {tab === "active"
              ? "No active deliveries right now."
              : "No completed deliveries yet."}
          </p>
        </div>
      )}

      {/* Order Cards */}
      {!loading &&
        displayOrders.map((order) => {
          const isExpanded = expandedId === order.id;
          const isMarking = markingId === order.id;
          const total = parseTotal(order.totalValue);

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Card Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-800 text-sm">
                      #{order.orderId}
                    </span>
                    <Badge
                      className={`text-[10px] ${
                        STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {order.status}
                    </Badge>
                    {order.assignedStoreName && (
                      <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                        {order.assignedStoreName}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-slate-700 font-medium">
                    {order.customerName}
                    {order.shopName && (
                      <span className="text-slate-400 font-normal">
                        {" "}• {order.shopName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{order.location || "—"}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-emerald-700 text-sm">
                    {formatCurrency(total)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {order.productCount} items
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 mt-1 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 mt-1 ml-auto" />
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                  {/* Timestamps */}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Placed: {formatTime(order.placedAt)}
                    </span>
                    {order.acceptedAt && (
                      <span>Accepted: {formatTime(order.acceptedAt)}</span>
                    )}
                    {order.shippedAt && (
                      <span>Shipped: {formatTime(order.shippedAt)}</span>
                    )}
                    {order.deliveredAt && (
                      <span>Delivered: {formatTime(order.deliveredAt)}</span>
                    )}
                  </div>

                  {/* Cart Items */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" /> Cart Items
                    </div>
                    <div className="space-y-1.5">
                      {order.cart.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-slate-700">
                            {item.name}
                            <span className="text-slate-400 ml-1">
                              x{item.qty} {item.unit}
                            </span>
                          </span>
                          <span className="font-medium text-slate-700">
                            {formatCurrency(item.price * item.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between font-bold text-sm">
                      <span>Total</span>
                      <span className="text-emerald-700">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Call Customer */}
                    {order.phone && (
                      <a
                        href={`tel:${order.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                      >
                        <Phone className="w-4 h-4" /> Call
                      </a>
                    )}

                    {/* Navigate */}
                    {order.lat && order.lng && (
                      <button
                        onClick={() => openNavigation(order.lat!, order.lng!)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        <Navigation className="w-4 h-4" /> Navigate
                      </button>
                    )}

                    {/* Mark Delivered */}
                    {(order.status === "Accepted" ||
                      order.status === "Shipped") && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkDelivered(order.id)}
                        disabled={isMarking}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isMarking ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Mark Delivered
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
