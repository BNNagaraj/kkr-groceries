"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { db, functions } from "@/lib/firebase";
import { getOtpAuth, isOtpConfigValid } from "@/lib/firebase-otp";
import { normalizeIndianPhone } from "@/lib/validation";
import { httpsCallable } from "firebase/functions";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  ConfirmationResult,
} from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
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
  Truck,
  ShieldCheck,
  Loader2,
  Phone as PhoneIcon,
  Mail,
  MessageSquare,
  List,
  ShoppingCart,
} from "lucide-react";
import { Order, OrderStatus, STATUS_TIMESTAMP_FIELDS, OrderCartItem } from "@/types/order";
import type { OtpChannel } from "@/types/settings";
// jsPDF lazy-loaded on click (~200KB kept out of initial bundle)
const lazyDownloadInvoice = async (order: Order) => {
  const { downloadInvoice } = await import("@/lib/invoice");
  downloadInvoice(order);
};
import dynamic from "next/dynamic";
import { useMode } from "@/contexts/ModeContext";
import { Product } from "@/contexts/AppContext";
import OrderEditModal from "./OrderEditModal";

const BuyList = dynamic(() => import("./BuyList"), { ssr: false });
import { StatusTimeline, formatStatusTime } from "@/components/OrderTimeline";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    otpRecaptchaVerifier?: RecaptchaVerifier;
  }
}

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

function statusBadgeVariant(status: OrderStatus, hasPendingMod: boolean): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Fulfilled") return "default";
  if (status === "Shipped") return "secondary";
  if (status === "Accepted") return "secondary";
  if (status === "Rejected") return "destructive";
  if (hasPendingMod) return "outline";
  return "outline";
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

  // OTP on Fulfill
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpChannels, setOtpChannels] = useState<OtpChannel>("email");
  const [otpDialogOrder, setOtpDialogOrder] = useState<Order | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  // SMS via Firebase Phone Auth (second project)
  const [smsConfirmation, setSmsConfirmation] = useState<ConfirmationResult | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Fetch requireDeliveryOTP + otpChannels setting
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, col("settings"), "checkout"));
        if (snap.exists()) {
          const data = snap.data();
          setOtpRequired(data.requireDeliveryOTP === true);
          if (data.otpChannels) setOtpChannels(data.otpChannels as OtpChannel);
        }
      } catch (e) {
        console.warn("Failed to fetch OTP setting:", e);
      }
    })();
  }, [col]);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (window.otpRecaptchaVerifier) {
        window.otpRecaptchaVerifier.clear();
        window.otpRecaptchaVerifier = undefined;
      }
    };
  }, []);

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
    // Open OTP dialog if OTP is required AND buyer has phone or email
    if (otpRequired && (order.userEmail || order.phone)) {
      setOtpDialogOrder(order);
      setOtpCode("");
      setOtpSent(false);
      setSmsSent(false);
      setEmailSent(false);
      setSmsConfirmation(null);
      setOtpError("");
    } else {
      handleStatusChange(order.id, "Fulfilled");
    }
  };

  const handleSendOtp = async () => {
    if (!otpDialogOrder) return;
    setOtpSending(true);
    setOtpError("");

    const wantEmail = otpChannels === "email" || otpChannels === "both";
    const wantSms = otpChannels === "sms" || otpChannels === "both";
    const hasEmail = !!otpDialogOrder.userEmail;
    const hasPhone = !!otpDialogOrder.phone;

    let emailOk = false;
    let smsOk = false;
    const errors: string[] = [];

    // 1. Send Email OTP (existing Cloud Function)
    if (wantEmail && hasEmail) {
      try {
        const sendFn = httpsCallable(functions, "sendDeliveryOTP");
        await sendFn({ orderId: otpDialogOrder.id, orderCollection: col("orders") });
        emailOk = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Email OTP failed";
        errors.push(`Email: ${msg}`);
      }
    }

    // 2. Send SMS OTP via Firebase Phone Auth (second project)
    if (wantSms && hasPhone) {
      try {
        // Pre-check: ensure OTP Firebase config is available
        if (!isOtpConfigValid()) {
          throw Object.assign(new Error("OTP Firebase config missing. Rebuild with NEXT_PUBLIC_OTP_FIREBASE_* env vars."), { code: "config/missing" });
        }

        // Normalize phone to E.164 format: +91 + 10-digit number
        const cleanPhone = `+91${normalizeIndianPhone(otpDialogOrder.phone)}`;

        const otpAuthInstance = getOtpAuth();

        // Always clear & recreate RecaptchaVerifier
        if (window.otpRecaptchaVerifier) {
          try { window.otpRecaptchaVerifier.clear(); } catch {}
          window.otpRecaptchaVerifier = undefined;
        }

        // Use element ID string (more reliable than DOM ref in React)
        const containerId = "otp-recaptcha-container";
        const containerEl = document.getElementById(containerId);
        if (!containerEl) {
          throw Object.assign(new Error("reCAPTCHA container not found in DOM"), { code: "recaptcha/no-container" });
        }

        window.otpRecaptchaVerifier = new RecaptchaVerifier(otpAuthInstance, containerId, {
          size: "invisible",
        });

        // In production, explicitly render reCAPTCHA before use.
        // On localhost (testing mode), skip render — auto-resolved by Firebase.
        if (window.location.hostname !== "localhost") {
          await window.otpRecaptchaVerifier.render();
        }

        const confirmation = await signInWithPhoneNumber(otpAuthInstance, cleanPhone, window.otpRecaptchaVerifier);
        setSmsConfirmation(confirmation);
        smsOk = true;
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        console.error("[OTP SMS] Firebase Phone Auth error:", error.code, error.message, err);

        // Cleanup recaptcha on error
        if (window.otpRecaptchaVerifier) {
          try { window.otpRecaptchaVerifier.clear(); } catch {}
          window.otpRecaptchaVerifier = undefined;
        }

        if (error.code === "auth/too-many-requests") {
          errors.push("SMS: Too many attempts. Wait a few minutes.");
        } else if (error.code === "auth/invalid-phone-number") {
          errors.push("SMS: Invalid phone number format.");
        } else if (error.code === "auth/unauthorized-domain" || error.code === "auth/operation-not-allowed") {
          errors.push(`SMS: Domain not authorized. Add "${window.location.hostname}" to OTP project's Authorized Domains in Firebase Console > Authentication > Settings.`);
        } else if (error.code === "auth/internal-error" || error.code === "auth/captcha-check-failed") {
          errors.push(`SMS: reCAPTCHA failed. Ensure "${window.location.hostname}" is in OTP project's Authorized Domains and Phone Auth is enabled.`);
        } else if (error.code === "config/missing") {
          errors.push(`SMS: ${error.message}`);
        } else {
          errors.push(`SMS: ${error.message || "Failed to send"} (${error.code || "unknown"})`);
        }
      }
    }

    // Update state based on results
    setSmsSent(smsOk);
    setEmailSent(emailOk);
    setOtpSent(emailOk || smsOk);

    if (emailOk || smsOk) {
      const channels: string[] = [];
      if (smsOk) channels.push("SMS");
      if (emailOk) channels.push("Email");
      toast.success(`OTP sent via ${channels.join(" & ")}`);
    }

    if (errors.length > 0 && !emailOk && !smsOk) {
      setOtpError(errors.join("\n"));
      toast.error("Failed to send OTP.");
    } else if (errors.length > 0) {
      // Partial success — show warning
      setOtpError(errors.join("\n"));
    }

    setOtpSending(false);
  };

  const handleVerifyOtp = async () => {
    if (!otpDialogOrder || !otpCode) return;
    setOtpVerifying(true);
    setOtpError("");

    let verified = false;

    // Try 1: SMS verification via Firebase Phone Auth (if SMS was sent)
    if (smsConfirmation) {
      try {
        await smsConfirmation.confirm(otpCode);
        // Clean up ghost auth session on second project
        try { await signOut(getOtpAuth()); } catch { /* ignore */ }
        verified = true;
      } catch {
        // SMS code didn't match — try email next
      }
    }

    // Try 2: Email OTP verification via Cloud Function (if email was sent)
    if (!verified && emailSent) {
      try {
        const verifyFn = httpsCallable(functions, "verifyDeliveryOTP");
        await verifyFn({ orderId: otpDialogOrder.id, otp: otpCode });
        verified = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Invalid OTP";
        if (!smsConfirmation) {
          // Only email was available, show email-specific error
          setOtpError(msg);
        }
      }
    }

    if (verified) {
      // Clean up RecaptchaVerifier so next send creates a fresh one
      if (window.otpRecaptchaVerifier) {
        window.otpRecaptchaVerifier.clear();
        window.otpRecaptchaVerifier = undefined;
      }
      toast.success("OTP verified! Marking as fulfilled.");
      await handleStatusChange(otpDialogOrder.id, "Fulfilled");
      setOtpDialogOrder(null);
    } else if (!otpError) {
      setOtpError("Incorrect OTP. Please check the code and try again.");
    }

    setOtpVerifying(false);
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
        orders.map((o) => {
          const hasPendingMod = o.modificationStatus === "PendingBuyerApproval";
          const statusText = hasPendingMod ? "Pending Approval" : o.status || "Pending";
          const cart = o.cart || [];

          return (
            <div
              key={o.id}
              id={`order-card-${o.id}`}
              className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden${
                highlightOrderId === o.id ? " c2-order-highlight" : ""
              }`}
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-emerald-600">
                          <th className="py-2 px-2 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider w-8">#</th>
                          <th className="py-2 px-2 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Item</th>
                          <th className="py-2 px-2 text-center text-xs font-bold text-emerald-700 uppercase tracking-wider w-14">Qty</th>
                          <th className="py-2 px-2 text-center text-xs font-bold text-emerald-700 uppercase tracking-wider w-16">Unit</th>
                          <th className="py-2 px-2 text-right text-xs font-bold text-emerald-700 uppercase tracking-wider w-16">Price</th>
                          <th className="py-2 px-2 text-right text-xs font-bold text-emerald-700 uppercase tracking-wider w-20">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, idx) => {
                          const amount = (item.qty || 0) * (item.price || 0);
                          const origItem = o.originalCart
                            ? o.originalCart.find((oi: OrderCartItem) => oi.name === item.name)
                            : undefined;
                          const qtyChanged = origItem && origItem.qty !== item.qty;
                          const priceChanged = origItem && origItem.price !== item.price;
                          const resolvedImg = item.image || productImageMap[(item.name || "").toLowerCase()] || "";

                          return (
                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-2 text-slate-400 text-xs">{idx + 1}</td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden relative shrink-0 flex items-center justify-center">
                                    {resolvedImg ? (
                                      <Image src={resolvedImg} alt={item.name} fill sizes="40px" className="object-cover" unoptimized={!resolvedImg.includes("googleapis.com")} />
                                    ) : (
                                      <span className="text-xs font-bold text-slate-300">{item.name?.[0] || "?"}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-slate-700 font-medium">{item.name}</span>
                                    {(item.telugu || item.hindi) && (
                                      <div className="text-xs text-slate-400">
                                        {[item.telugu, item.hindi].filter(Boolean).join(" · ")}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                {qtyChanged && (
                                  <span className="line-through text-slate-400 mr-1 text-xs">{origItem.qty}</span>
                                )}
                                <span className={qtyChanged ? "bg-yellow-100 rounded px-1" : "text-slate-700"}>{item.qty}</span>
                              </td>
                              <td className="py-2 px-2 text-center text-slate-500">{item.unit}</td>
                              <td className="py-2 px-2 text-right">
                                {priceChanged && (
                                  <span className="line-through text-slate-400 mr-1 text-xs">&#8377;{origItem.price}</span>
                                )}
                                <span className={priceChanged ? "bg-yellow-100 rounded px-1" : "text-slate-700"}>&#8377;{item.price}</span>
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-emerald-700">&#8377;{amount.toLocaleString("en-IN")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
                      <Button variant="secondary" size="sm" onClick={() => lazyDownloadInvoice(o)}>
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
                      <Button size="sm" variant="secondary" onClick={() => lazyDownloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange(o.id, "Rejected")}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </>
                  ) : o.status === "Accepted" ? (
                    <>
                      <Button size="sm" onClick={() => handleStatusChange(o.id, "Shipped")} className="bg-indigo-500 hover:bg-indigo-600">
                        <Truck className="w-3.5 h-3.5" /> Ship
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => lazyDownloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingOrder(o)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                    </>
                  ) : o.status === "Shipped" ? (
                    <>
                      <Button size="sm" onClick={() => handleFulfillClick(o)}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fulfill
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => lazyDownloadInvoice(o)}>
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingOrder(o)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                    </>
                  ) : o.status === "Fulfilled" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => lazyDownloadInvoice(o)}>
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
      <Dialog open={!!otpDialogOrder} onOpenChange={(open) => {
        if (!open) {
          setOtpDialogOrder(null);
          // Cleanup recaptcha when closing dialog
          if (window.otpRecaptchaVerifier) {
            window.otpRecaptchaVerifier.clear();
            window.otpRecaptchaVerifier = undefined;
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Delivery OTP Verification
            </DialogTitle>
            <DialogDescription>
              Send OTP to confirm delivery of order{" "}
              <span className="font-mono font-semibold text-slate-700">
                {otpDialogOrder?.orderId || otpDialogOrder?.id}
              </span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer info */}
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1.5">
              <div><span className="text-slate-400">Customer:</span> <span className="font-medium">{otpDialogOrder?.customerName}</span></div>
              <div className="flex items-center gap-1.5">
                <PhoneIcon className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">Phone:</span>
                <span className="font-medium">{otpDialogOrder?.phone || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">Email:</span>
                <span className="font-medium">{otpDialogOrder?.userEmail || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">Channel:</span>
                <span className="font-medium text-xs uppercase tracking-wider">
                  {otpChannels === "both" ? "SMS & Email" : otpChannels === "sms" ? "SMS" : "Email"}
                </span>
              </div>
            </div>

            {(() => {
              const wantEmail = otpChannels === "email" || otpChannels === "both";
              const wantSms = otpChannels === "sms" || otpChannels === "both";
              const hasEmail = !!otpDialogOrder?.userEmail;
              const hasPhone = !!otpDialogOrder?.phone;
              const canSend = (wantEmail && hasEmail) || (wantSms && hasPhone);

              // Build dynamic button label
              const channelParts: string[] = [];
              if (wantSms && hasPhone) channelParts.push("SMS");
              if (wantEmail && hasEmail) channelParts.push("Email");
              const channelLabel = channelParts.length > 0 ? channelParts.join(" & ") : "N/A";

              return !otpSent ? (
                /* Step 1: Send OTP */
                <div className="space-y-3">
                  <Button
                    onClick={handleSendOtp}
                    disabled={otpSending || !canSend}
                    className="w-full bg-amber-500 hover:bg-amber-600"
                  >
                    {otpSending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                    ) : (
                      <><ShieldCheck className="w-4 h-4" /> Send OTP via {channelLabel}</>
                    )}
                  </Button>
                  {!canSend && (
                    <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-2">
                      No contact info available for the selected channel{otpChannels === "both" ? "s" : ""}.
                      {!hasPhone && wantSms && <span className="block text-xs mt-0.5">Phone number missing.</span>}
                      {!hasEmail && wantEmail && <span className="block text-xs mt-0.5">Email missing.</span>}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => {
                          handleStatusChange(otpDialogOrder!.id, "Fulfilled");
                          setOtpDialogOrder(null);
                        }}
                      >
                        Fulfill Without OTP
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Enter & Verify OTP */
                <div className="space-y-3">
                  {/* Show which channels succeeded */}
                  <div className="space-y-1">
                    {smsSent && (
                      <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> SMS sent to {otpDialogOrder?.phone}
                      </div>
                    )}
                    {emailSent && (
                      <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Email sent to {otpDialogOrder?.userEmail}
                      </div>
                    )}
                    {smsSent && emailSent && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        SMS and Email have different codes. Enter either one to verify.
                      </p>
                    )}
                  </div>
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying || otpCode.length !== 6}
                      className="flex-1"
                    >
                      {otpVerifying ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> Verify &amp; Fulfill</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleSendOtp} disabled={otpSending} size="sm">
                      Resend
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* Error message */}
            {otpError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2 whitespace-pre-line">
                {otpError}
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>

      {/* Invisible reCAPTCHA container — OUTSIDE Dialog so it persists across open/close */}
      <div id="otp-recaptcha-container" />
    </div>
  );
}
