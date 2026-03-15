"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import {
  Package,
  CheckCircle2,
  Truck,
  PackageCheck,
  MapPin,
  Clock,
  Phone,
  User,
  Warehouse,
  Navigation,
  Shield,
  AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface TrackingDoc {
  orderId: string;
  orderDocId: string;
  deliveryBoyUid: string;
  deliveryBoyName: string;
  customerName: string;
  storeId: string | null;
  storeName: string | null;
  status: string;
  createdAt: Timestamp | null;
  expiresAt: Date | Timestamp | null;
  collectionName: string;
}

interface PresenceDoc {
  lat?: number;
  lng?: number;
  lastSeen?: Timestamp;
  online?: boolean;
  status?: string;
  displayName?: string;
  phone?: string;
}

interface OrderSnapshot {
  status: string;
  customerName: string;
  shopName?: string;
  location?: string;
  phone?: string;
  cart?: Array<{ name: string; qty: number; unit: string; price: number }>;
  totalValue?: string;
  productCount?: number;
  assignedToName?: string;
  assignedStoreName?: string;
  assignedAt?: Timestamp;
  placedAt?: Timestamp;
  acceptedAt?: Timestamp;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
}

// ─── Status pipeline ────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { status: "Pending", label: "Order Placed", icon: Package, color: "#f59e0b" },
  { status: "Accepted", label: "Accepted", icon: CheckCircle2, color: "#3b82f6" },
  { status: "Shipped", label: "Out for Delivery", icon: Truck, color: "#8b5cf6" },
  { status: "Fulfilled", label: "Delivered", icon: PackageCheck, color: "#10b981" },
];

function getStageIndex(status: string): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

function formatTime(ts: Timestamp | null | undefined): string {
  if (!ts || !ts.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(ts: Timestamp | null | undefined): string {
  if (!ts || !ts.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── Haversine distance ─────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function TrackPage() {
  const [token, setToken] = useState<string | null>(null);
  const [trackingColName, setTrackingColName] = useState("deliveryTracking");
  const [tracking, setTracking] = useState<TrackingDoc | null>(null);
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [presence, setPresence] = useState<PresenceDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract token from URL path: /track/{token} or /track/{token}/
  // Also read mode from query params for test/prod namespacing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    if (urlMode === "test") {
      setTrackingColName("test_deliveryTracking");
    }

    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean); // ["track", "{token}"]
    if (parts.length >= 2 && parts[0] === "track") {
      setToken(parts[1]);
    } else {
      // Fallback: check query param
      const t = params.get("token");
      if (t) {
        setToken(t);
      } else {
        setError("No tracking token found. Please check your tracking link.");
        setLoading(false);
      }
    }
  }, []);

  // Listen to tracking doc
  useEffect(() => {
    if (!token) return;

    const unsub = onSnapshot(
      doc(db, trackingColName, token),
      (snap) => {
        if (!snap.exists()) {
          setError("Tracking link expired or invalid.");
          setLoading(false);
          return;
        }
        const data = snap.data() as TrackingDoc;

        // Check expiry
        const expiresAt = data.expiresAt;
        if (expiresAt) {
          const expiryMs = expiresAt instanceof Timestamp
            ? expiresAt.toMillis()
            : new Date(expiresAt as unknown as string).getTime();
          if (Date.now() > expiryMs) {
            setError("This tracking link has expired (24h limit).");
            setLoading(false);
            return;
          }
        }

        setTracking(data);
        setLoading(false);
      },
      (err) => {
        console.error("[Track] Tracking doc error:", err);
        setError("Failed to load tracking data.");
        setLoading(false);
      }
    );
    return unsub;
  }, [token, trackingColName]);

  // Listen to order doc (real-time status updates)
  useEffect(() => {
    if (!tracking) return;
    const colName = tracking.collectionName || "orders";
    const unsub = onSnapshot(
      doc(db, colName, tracking.orderDocId),
      (snap) => {
        if (snap.exists()) {
          setOrder(snap.data() as OrderSnapshot);
        }
      },
      (err) => console.warn("[Track] Order listener error:", err)
    );
    return unsub;
  }, [tracking]);

  // Listen to delivery boy presence (GPS location)
  useEffect(() => {
    if (!tracking?.deliveryBoyUid) return;
    const unsub = onSnapshot(
      doc(db, "presence", tracking.deliveryBoyUid),
      (snap) => {
        if (snap.exists()) {
          setPresence(snap.data() as PresenceDoc);
        }
      },
      (err) => console.warn("[Track] Presence listener error:", err)
    );
    return unsub;
  }, [tracking?.deliveryBoyUid]);

  // Current status
  const currentStatus = order?.status || tracking?.status || "Pending";
  const stageIndex = getStageIndex(currentStatus);
  const isDelivered = currentStatus === "Fulfilled";
  const isRejected = currentStatus === "Rejected";

  // Delivery boy info
  const deliveryName = order?.assignedToName || tracking?.deliveryBoyName || "Delivery Partner";
  const isOnline = presence?.online === true || presence?.status === "online";
  const hasGPS = !!(presence?.lat && presence?.lng);

  // ETA estimate (rough — based on distance if GPS available)
  const etaMinutes = useMemo(() => {
    if (!hasGPS || !order?.location || isDelivered) return null;
    // We don't have the customer lat/lng easily, but if presence has coords we can show "nearby" or distance
    return null; // Will enhance later with actual customer coordinates
  }, [hasGPS, order, isDelivered]);

  // Last updated time
  const lastUpdated = presence?.lastSeen
    ? formatTime(presence.lastSeen)
    : null;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-flex mb-4">
            <div className="w-14 h-14 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
            <Truck className="absolute inset-0 m-auto w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-slate-600">Loading tracking info...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to live updates</p>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Tracking Unavailable</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              If you believe this is an error, please contact the store directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥬</span>
            <span className="text-sm font-bold text-emerald-800 tracking-wide">KKR Groceries</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] text-slate-400 font-medium">Secure Tracking</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* ─── Status Hero Card ─────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Status banner */}
          <div
            className="px-5 py-4"
            style={{
              background: isRejected
                ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
                : isDelivered
                ? "linear-gradient(135deg, #ecfdf5, #d1fae5)"
                : "linear-gradient(135deg, #eff6ff, #dbeafe)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold" style={{ color: isRejected ? "#991b1b" : isDelivered ? "#065f46" : "#1e40af" }}>
                  {isRejected ? "Order Rejected" : isDelivered ? "Order Delivered!" : "Your Order is On the Way"}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: isRejected ? "#b91c1c" : isDelivered ? "#047857" : "#3b82f6" }}>
                  Order #{tracking?.orderId?.slice(-8) || "---"}
                  {order?.placedAt && ` • Placed ${formatDateTime(order.placedAt)}`}
                </p>
              </div>
              {isDelivered && <PackageCheck className="w-10 h-10 text-emerald-500" />}
              {isRejected && <AlertTriangle className="w-10 h-10 text-red-400" />}
              {!isDelivered && !isRejected && (
                <div className="relative">
                  <Truck className="w-10 h-10 text-blue-500" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                </div>
              )}
            </div>
          </div>

          {/* Pipeline progress */}
          {!isRejected && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                {PIPELINE_STAGES.map((stage, i) => {
                  const Icon = stage.icon;
                  const isComplete = i <= stageIndex;
                  const isCurrent = i === stageIndex;
                  return (
                    <React.Fragment key={stage.status}>
                      <div className="flex flex-col items-center gap-1 relative">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isCurrent ? "scale-110" : ""
                          }`}
                          style={{
                            background: isComplete ? `${stage.color}15` : "#f1f5f9",
                            boxShadow: isCurrent ? `0 0 0 2px white, 0 0 0 4px ${stage.color}` : "none",
                          }}
                        >
                          <Icon
                            className="w-4 h-4 transition-colors"
                            style={{ color: isComplete ? stage.color : "#94a3b8" }}
                          />
                        </div>
                        <span
                          className="text-[9px] font-semibold text-center leading-tight max-w-[60px]"
                          style={{ color: isComplete ? stage.color : "#94a3b8" }}
                        >
                          {stage.label}
                        </span>
                        {/* Timestamp under current/completed stages */}
                        {isComplete && (
                          <span className="text-[8px] text-slate-400">
                            {i === 0 && formatTime(order?.placedAt)}
                            {i === 1 && formatTime(order?.acceptedAt)}
                            {i === 2 && formatTime(order?.shippedAt)}
                            {i === 3 && formatTime(order?.deliveredAt)}
                          </span>
                        )}
                      </div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <div className="flex-1 h-0.5 mx-1 rounded-full transition-colors duration-500" style={{
                          background: i < stageIndex ? stage.color : "#e2e8f0",
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Delivery Partner Card ─────────────────────────── */}
        {(currentStatus === "Shipped" || currentStatus === "Accepted") && (
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Partner</h3>
              {isOnline && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Online
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {deliveryName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{deliveryName}</p>
                {tracking?.storeName && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Warehouse className="w-3 h-3" />
                    {tracking.storeName}
                  </p>
                )}
              </div>
              {/* Call button (if delivery boy phone in presence) */}
              {presence?.phone && (
                <a
                  href={`tel:${presence.phone}`}
                  className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                >
                  <Phone className="w-4 h-4 text-emerald-600" />
                </a>
              )}
            </div>

            {/* GPS indicator */}
            {hasGPS && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] text-slate-500">
                  Live GPS tracking active
                </span>
                {lastUpdated && (
                  <span className="text-[10px] text-slate-400 ml-auto">
                    Updated {lastUpdated}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Delivered confirmation ─────────────────────────── */}
        {isDelivered && (
          <div className="bg-emerald-50 rounded-2xl shadow-lg p-5 text-center">
            <PackageCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-emerald-800">Order Delivered Successfully</h3>
            {order?.deliveredAt && (
              <p className="text-xs text-emerald-600 mt-1">
                Delivered at {formatDateTime(order.deliveredAt)}
              </p>
            )}
            <p className="text-xs text-emerald-500 mt-2">
              Thank you for ordering with KKR Groceries!
            </p>
          </div>
        )}

        {/* ─── Order Summary Card ─────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Summary</h3>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-700">{order?.customerName || tracking?.customerName || "Customer"}</span>
            </div>
            {order?.shopName && (
              <div className="flex items-center gap-2">
                <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm text-slate-700">{order.shopName}</span>
              </div>
            )}
            {order?.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                <span className="text-sm text-slate-700">{order.location}</span>
              </div>
            )}
          </div>

          {/* Cart items */}
          {order?.cart && order.cart.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="space-y-1.5">
                {order.cart.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate flex-1">{item.name}</span>
                    <span className="text-slate-400 mx-2 shrink-0">
                      {item.qty} {item.unit}
                    </span>
                    <span className="text-slate-700 font-semibold shrink-0">
                      ₹{(item.price * item.qty).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
              {order.totalValue && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-600">
                    Total ({order.productCount || order.cart.length} items)
                  </span>
                  <span className="text-sm font-bold text-emerald-700">₹{order.totalValue}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Store Info ─────────────────────────────────────── */}
        {tracking?.storeName && (
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Fulfilling Store</h3>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Warehouse className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-sm font-semibold text-slate-700">{tracking.storeName}</span>
            </div>
          </div>
        )}

        {/* ─── Footer ─────────────────────────────────────────── */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-slate-400">
            This tracking link expires 24 hours after generation.
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            KKR Groceries • Hyderabad B2B Wholesale
          </p>
        </div>
      </div>
    </div>
  );
}
