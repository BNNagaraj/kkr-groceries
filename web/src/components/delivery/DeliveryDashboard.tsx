"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { db, functions } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
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
  ShoppingCart,
  ShieldCheck,
  Send,
  X,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ViewTab = "active" | "completed";

const STATUS_COLORS: Record<string, string> = {
  Accepted: "bg-blue-100 text-blue-700 border-blue-200",
  Shipped: "bg-amber-100 text-amber-700 border-amber-200",
  Fulfilled: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// Swiggy/Zomato-style live progress stages (before the final "delivered")
const STAGES = [
  { key: "reached_store", label: "Reached store" },
  { key: "picked_up", label: "Picked up" },
  { key: "on_the_way", label: "On the way" },
] as const;

/** Google Maps link — directions to coords if available, else a search on the address text. */
function buildMapsUrl(order: { lat?: number; lng?: number; location?: string }): string | null {
  if (order.lat && order.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`;
  }
  if (order.location) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.location)}`;
  }
  return null;
}

export default function DeliveryDashboard() {
  const { currentUser } = useAuth();
  const { col } = useMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ViewTab>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Delivery-OTP state
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpFor, setOtpFor] = useState<string | null>(null); // order id in OTP-entry mode
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [cashMode, setCashMode] = useState<"full" | "partial" | "none">("full");
  const [partialAmount, setPartialAmount] = useState("");

  // Load whether delivery OTP is required (public setting)
  useEffect(() => {
    getDoc(doc(db, "settings", "checkout"))
      .then((snap) => setOtpRequired(snap.exists() && snap.data().requireDeliveryOTP === true))
      .catch(() => setOtpRequired(false));
  }, []);

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

  // Cash this agent has collected but not yet handed over (settled)
  const cashInHand = orders
    .filter((o) => o.collectedBy === currentUser?.uid && o.paymentMethod === "cash" && !o.cashSettled)
    .reduce((sum, o) => sum + (o.collectedAmount || 0), 0);

  // Mark delivered via the server function (enforces assignment + OTP + cash)
  const completeDeliveryFn = useCallback(
    async (orderId: string, opts?: { otp?: string; cashOutcome?: "full" | "partial" | "none"; collectedAmount?: number }) => {
      const fn = httpsCallable<
        { orderId: string; orderCollection: string; otp?: string; cashOutcome?: string; collectedAmount?: number },
        { success: boolean; message: string }
      >(functions, "completeDelivery");
      await fn({ orderId, orderCollection: col("orders"), otp: opts?.otp, cashOutcome: opts?.cashOutcome, collectedAmount: opts?.collectedAmount });
    },
    [col]
  );

  // Accept / Reject a new assignment (reject auto-reassigns to the next agent)
  const handleRespond = useCallback(
    async (orderId: string, response: "accept" | "reject") => {
      setRespondingId(orderId);
      try {
        const fn = httpsCallable<
          { orderId: string; orderCollection: string; response: string },
          { success: boolean; status?: string }
        >(functions, "respondToAssignment");
        const { data } = await fn({ orderId, orderCollection: col("orders"), response });
        if (response === "accept") {
          toast.success("Delivery accepted — you can start now.");
        } else if (data.status === "reassigned") {
          toast.success("Rejected — reassigned to another agent.");
        } else {
          toast.success("Rejected — sent back to admin for reassignment.");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to respond.";
        console.error("[DeliveryDashboard] respond failed:", e);
        toast.error(msg);
      } finally {
        setRespondingId(null);
      }
    },
    [col]
  );

  // Advance the Swiggy-style delivery stage (reached_store → picked_up → on_the_way)
  const advanceStage = useCallback(
    async (orderId: string, stage: string, label: string) => {
      setAdvancingId(orderId);
      try {
        const fn = httpsCallable(functions, "advanceDeliveryStage");
        await fn({ orderId, orderCollection: col("orders"), stage });
        toast.success(`Updated: ${label}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to update stage.";
        console.error("[DeliveryDashboard] Advance stage failed:", e);
        toast.error(msg);
      } finally {
        setAdvancingId(null);
      }
    },
    [col]
  );

  // Send the delivery OTP to the customer (email + app push)
  const handleSendOtp = useCallback(
    async (orderId: string) => {
      setOtpSending(true);
      try {
        const fn = httpsCallable(functions, "sendDeliveryOTP");
        await fn({ orderId, orderCollection: col("orders"), channels: { email: true, app: true } });
        toast.success("OTP sent to the customer.");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to send OTP.";
        console.error("[DeliveryDashboard] Send OTP failed:", e);
        toast.error(msg);
      } finally {
        setOtpSending(false);
      }
    },
    [col]
  );

  // An order needs cash collection if it wasn't paid online / has no pending UPI ref
  const isCodOrder = (o: Order) => o.paymentStatus !== "paid" && o.paymentStatus !== "submitted";

  // Primary "Mark Delivered" action — opens the confirm panel for OTP and/or cash.
  const handleMarkDelivered = useCallback(
    async (order: Order) => {
      const needsConfirm = otpRequired || isCodOrder(order);
      if (needsConfirm) {
        setOtpFor(order.id);
        setOtpCode("");
        setCashMode("full");
        setPartialAmount("");
        if (otpRequired) handleSendOtp(order.id);
        return;
      }
      // Prepaid + no OTP → deliver straight away
      setMarkingId(order.id);
      try {
        await completeDeliveryFn(order.id);
        toast.success("Order marked as delivered!");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to mark as delivered.";
        console.error("[DeliveryDashboard] Mark delivered failed:", e);
        toast.error(msg);
      } finally {
        setMarkingId(null);
      }
    },
    [otpRequired, handleSendOtp, completeDeliveryFn]
  );

  // Confirm delivery — validates OTP (if required) and records the cash outcome.
  const handleConfirmDelivery = useCallback(
    async (order: Order) => {
      if (otpRequired && !otpCode.trim()) {
        toast.error("Enter the OTP shown to the customer.");
        return;
      }
      const cod = isCodOrder(order);
      let collectedAmount: number | undefined;
      if (cod && cashMode === "partial") {
        collectedAmount = Number(partialAmount);
        if (!collectedAmount || collectedAmount <= 0) {
          toast.error("Enter the cash amount collected.");
          return;
        }
      }
      setMarkingId(order.id);
      try {
        await completeDeliveryFn(order.id, {
          otp: otpRequired ? otpCode.trim() : undefined,
          cashOutcome: cod ? cashMode : undefined,
          collectedAmount,
        });
        toast.success(cod && cashMode === "none" ? "Delivered — marked as payment pending." : "Delivery confirmed!");
        setOtpFor(null);
        setOtpCode("");
        setCashMode("full");
        setPartialAmount("");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to confirm delivery.";
        console.error("[DeliveryDashboard] Confirm delivery failed:", e);
        toast.error(msg);
      } finally {
        setMarkingId(null);
      }
    },
    [otpRequired, otpCode, cashMode, partialAmount, completeDeliveryFn]
  );

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

      {/* Cash in hand (COD collected, awaiting handover) */}
      {cashInHand > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs text-emerald-700 font-medium">Cash in hand (to deposit)</div>
              <div className="text-lg font-extrabold text-emerald-800">{formatCurrency(cashInHand)}</div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-600/80 max-w-[45%] text-right">Hand this over to admin — they&apos;ll mark it settled.</span>
        </div>
      )}

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

                  {/* Cash-on-Delivery reminder — collect cash unless already paid online */}
                  {(order.status === "Accepted" || order.status === "Shipped") &&
                    order.paymentStatus !== "paid" &&
                    order.paymentStatus !== "submitted" && (
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        💵 Collect {formatCurrency(total)} cash on delivery
                      </div>
                    )}

                  {/* Live progress stepper (Swiggy/Zomato style) */}
                  {(order.status === "Accepted" || order.status === "Shipped") && order.assignmentStatus !== "pending" && (() => {
                    const curIdx = order.deliveryStage ? STAGES.findIndex((s) => s.key === order.deliveryStage) : -1;
                    return (
                      <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                        {STAGES.map((s, i) => (
                          <React.Fragment key={s.key}>
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${i <= curIdx ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                              {s.label}
                            </span>
                            <span className={`w-3 h-px ${i < curIdx ? "bg-blue-300" : "bg-slate-200"}`} />
                          </React.Fragment>
                        ))}
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-400">Delivered</span>
                      </div>
                    );
                  })()}

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

                    {/* Google Maps (coords if available, else address search) */}
                    {buildMapsUrl(order) && (
                      <a
                        href={buildMapsUrl(order)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        <Navigation className="w-4 h-4" /> Google Maps
                      </a>
                    )}

                    {/* Stage-aware primary action */}
                    {(order.status === "Accepted" || order.status === "Shipped") && (() => {
                      const curIdx = order.deliveryStage ? STAGES.findIndex((s) => s.key === order.deliveryStage) : -1;
                      const nextStage = STAGES[curIdx + 1];
                      const isAdvancing = advancingId === order.id;
                      const isResponding = respondingId === order.id;

                      // New assignment → must Accept (or Reject) before doing anything
                      if (order.assignmentStatus === "pending") {
                        return (
                          <div className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                            <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5" /> New assignment — accept to start the delivery
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleRespond(order.id, "accept")}
                                disabled={isResponding}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {isResponding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRespond(order.id, "reject")}
                                disabled={isResponding}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" /> Reject
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      // Delivery confirm panel — OTP (if required) + cash outcome (if COD)
                      if (otpFor === order.id) {
                        const cod = isCodOrder(order);
                        return (
                          <div className="w-full mt-1 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-3">
                            {otpRequired && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Enter the OTP shown on the customer&apos;s app / email
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    inputMode="numeric"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="6-digit OTP"
                                    className="flex-1 px-3 py-2 rounded-lg border border-emerald-300 text-sm tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                  />
                                  <button
                                    onClick={() => handleSendOtp(order.id)}
                                    disabled={otpSending}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50 shrink-0"
                                  >
                                    {otpSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Resend
                                  </button>
                                </div>
                              </div>
                            )}

                            {cod && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Cash collected? ({formatCurrency(total)} due)
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {([
                                    { k: "full", label: `Full ${formatCurrency(total)}` },
                                    { k: "partial", label: "Partial" },
                                    { k: "none", label: "Not collected" },
                                  ] as const).map((opt) => (
                                    <button
                                      key={opt.k}
                                      onClick={() => setCashMode(opt.k)}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                        cashMode === opt.k
                                          ? opt.k === "none"
                                            ? "bg-red-100 text-red-700 border-red-300"
                                            : "bg-emerald-600 text-white border-emerald-600"
                                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                {cashMode === "partial" && (
                                  <input
                                    inputMode="numeric"
                                    value={partialAmount}
                                    onChange={(e) => setPartialAmount(e.target.value.replace(/[^0-9]/g, ""))}
                                    placeholder="Amount collected (₹)"
                                    className="w-full px-3 py-2 rounded-lg border border-emerald-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                  />
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                onClick={() => handleConfirmDelivery(order)}
                                disabled={isMarking || (otpRequired && otpCode.length < 4)}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {isMarking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Confirm Delivery
                              </Button>
                              <button
                                onClick={() => { setOtpFor(null); setOtpCode(""); setCashMode("full"); setPartialAmount(""); }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Still progressing through stages → advance to the next one
                      if (nextStage) {
                        return (
                          <Button
                            size="sm"
                            onClick={() => advanceStage(order.id, nextStage.key, nextStage.label)}
                            disabled={isAdvancing}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {isAdvancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                            Mark: {nextStage.label}
                          </Button>
                        );
                      }

                      // Final step → deliver (opens confirm panel for OTP/cash)
                      return (
                        <Button
                          size="sm"
                          onClick={() => handleMarkDelivered(order)}
                          disabled={isMarking}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {isMarking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : otpRequired ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Mark Delivered
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
