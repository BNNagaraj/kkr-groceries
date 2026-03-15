"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Timestamp } from "firebase/firestore";
import { usePresenceData } from "@/contexts/PresenceContext";
import type { PresenceDoc } from "@/contexts/PresenceContext";
import { Order } from "@/types/order";
import { Store } from "@/types/settings";
import { toast } from "sonner";
import {
  Truck,
  MapPin,
  Phone,
  Clock,
  Package,
  Navigation,
  Signal,
  SignalZero,
  User,
  CheckCircle2,
  Map as MapIcon,
  List,
  Zap,
  Loader2,
  Trophy,
  TrendingUp,
  BarChart3,
  Star,
} from "lucide-react";

// PresenceDoc is imported from @/contexts/PresenceContext

interface DeliveryBoyInfo {
  uid: string;
  name: string;
  phone: string | null;
  email: string | null;
  hasGPS: boolean;
  lat?: number;
  lng?: number;
  lastSeen: Timestamp | null;
  currentOrder: Order | null;
  totalDeliveries: number;
  activeDeliveries: number;
  isOnline: boolean;
}

interface DeliveryFleetPanelProps {
  orders: Order[];
  stores: Store[];
}

export default function DeliveryFleetPanel({ orders, stores }: DeliveryFleetPanelProps) {
  const { presenceList } = usePresenceData();
  const [filterStatus, setFilterStatus] = useState<"all" | "online" | "busy" | "offline">("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Filter to delivery-role presence docs from shared context
  const presenceDocs = useMemo(
    () => presenceList.filter((p) => p.isDelivery || p.role === "delivery"),
    [presenceList]
  );

  // Build delivery boy info with order assignments
  const deliveryBoys = useMemo(() => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;

    return presenceDocs.map((p) => {
      const lastSeenMs = p.lastSeen?.toMillis?.() || 0;
      const isOnline = (p.online === true || p.status === "online") && lastSeenMs > twoMinutesAgo;

      const assignedOrders = orders.filter((o) => o.assignedTo === p.uid);
      const activeDeliveries = assignedOrders.filter(
        (o) => o.status === "Shipped" || o.status === "Accepted"
      ).length;
      const totalDeliveries = assignedOrders.filter((o) => o.status === "Fulfilled").length;
      const currentOrder = assignedOrders.find((o) => o.status === "Shipped") ||
        assignedOrders.find((o) => o.status === "Accepted") || null;

      return {
        uid: p.uid,
        name: p.displayName || p.email?.split("@")[0] || p.phone || "Unknown",
        phone: p.phone,
        email: p.email,
        hasGPS: !!(p.lat && p.lng),
        lat: p.lat,
        lng: p.lng,
        lastSeen: p.lastSeen,
        isOnline,
        currentOrder,
        totalDeliveries,
        activeDeliveries,
      } as DeliveryBoyInfo;
    }).sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return b.activeDeliveries - a.activeDeliveries;
    });
  }, [presenceDocs, orders]);

  // Filter
  const filteredBoys = useMemo(() => {
    if (filterStatus === "all") return deliveryBoys;
    if (filterStatus === "online") return deliveryBoys.filter((b) => b.isOnline && b.activeDeliveries === 0);
    if (filterStatus === "busy") return deliveryBoys.filter((b) => b.isOnline && b.activeDeliveries > 0);
    if (filterStatus === "offline") return deliveryBoys.filter((b) => !b.isOnline);
    return deliveryBoys;
  }, [deliveryBoys, filterStatus]);

  // Counts
  const counts = useMemo(() => ({
    total: deliveryBoys.length,
    online: deliveryBoys.filter((b) => b.isOnline && b.activeDeliveries === 0).length,
    busy: deliveryBoys.filter((b) => b.isOnline && b.activeDeliveries > 0).length,
    offline: deliveryBoys.filter((b) => !b.isOnline).length,
  }), [deliveryBoys]);

  // ── Leaflet Map ──
  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    try {
      const L = (await import("leaflet")).default;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore CSS import for side effects
      await import("leaflet/dist/leaflet.css");

      const map = L.map(mapContainerRef.current, {
        center: [17.385, 78.4867], // Hyderabad default
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

      // Trigger resize after render
      setTimeout(() => map.invalidateSize(), 200);
    } catch (e) {
      console.warn("[Fleet] Failed to init Leaflet:", e);
    }
  }, []);

  // Initialize map when view mode switches to map
  useEffect(() => {
    if (viewMode === "map" && !mapInstanceRef.current) {
      const timeout = setTimeout(initMap, 100);
      return () => clearTimeout(timeout);
    }
  }, [viewMode, initMap]);

  // Update markers when delivery boys or map changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const L = require("leaflet");
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const bounds: [number, number][] = [];

    // Add store markers (purple squares)
    stores.filter((s) => s.isActive).forEach((store) => {
      const icon = L.divIcon({
        html: `<div style="width:28px;height:28px;background:#7c3aed;border-radius:6px;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 21V8l9-4 9 4v13"/><path d="M9 21v-4h6v4"/></svg>
        </div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([store.lat, store.lng], { icon }).addTo(map);
      marker.bindPopup(`<b>${store.name}</b><br/><small>${store.address}</small>`);
      markersRef.current.push(marker);
      bounds.push([store.lat, store.lng]);
    });

    // Add delivery boy markers
    deliveryBoys.forEach((boy) => {
      if (!boy.lat || !boy.lng) return;

      const bgColor = boy.isOnline
        ? boy.activeDeliveries > 0 ? "#3b82f6" : "#10b981"
        : "#94a3b8";
      const pulseHtml = boy.isOnline && boy.activeDeliveries > 0
        ? `<div style="position:absolute;inset:-4px;border-radius:50%;background:${bgColor};opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
        : "";

      const icon = L.divIcon({
        html: `<div style="position:relative;width:32px;height:32px;">
          ${pulseHtml}
          <div style="position:absolute;inset:0;width:32px;height:32px;background:${bgColor};border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
          </div>
        </div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([boy.lat, boy.lng], { icon }).addTo(map);

      const popupContent = `
        <div style="min-width:160px;">
          <b>${boy.name}</b>${boy.phone ? ` <small>(${boy.phone})</small>` : ""}
          <br/><small style="color:${boy.isOnline ? (boy.activeDeliveries > 0 ? '#3b82f6' : '#10b981') : '#94a3b8'}">
            ${boy.isOnline ? (boy.activeDeliveries > 0 ? `On delivery (${boy.activeDeliveries} active)` : "Available") : "Offline"}
          </small>
          ${boy.currentOrder ? `<br/><small>Delivering #${boy.currentOrder.orderId || boy.currentOrder.id.slice(0, 8)} to ${boy.currentOrder.customerName}</small>` : ""}
          <br/><small style="color:#94a3b8">${formatLastSeen(boy.lastSeen)}</small>
        </div>
      `;
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
      bounds.push([boy.lat, boy.lng]);
    });

    // Fit bounds
    if (bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (e) {
        // ignore if bounds are invalid
      }
    }
  }, [mapReady, deliveryBoys, stores]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Fleet Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FleetCard
          label="Total Fleet"
          value={counts.total}
          icon={<Truck className="w-4 h-4 text-slate-600" />}
          pulse={false}
        />
        <FleetCard
          label="Available"
          value={counts.online}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          pulse={counts.online > 0}
        />
        <FleetCard
          label="On Delivery"
          value={counts.busy}
          icon={<Navigation className="w-4 h-4 text-blue-600" />}
          pulse={false}
        />
        <FleetCard
          label="Offline"
          value={counts.offline}
          icon={<SignalZero className="w-4 h-4 text-slate-400" />}
          pulse={false}
        />
      </div>

      {/* Delivery Performance Metrics */}
      {deliveryBoys.length > 0 && (
        <DeliveryPerformance deliveryBoys={deliveryBoys} orders={orders} />
      )}

      {/* Filter Tabs + View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "online", "busy", "offline"] as const).map((status) => {
            const labels = { all: "All", online: "Available", busy: "On Delivery", offline: "Offline" };
            const countMap = { all: counts.total, online: counts.online, busy: counts.busy, offline: counts.offline };
            const active = filterStatus === status;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {labels[status]} ({countMap[status]})
              </button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "map" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            title="Map view"
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div
            ref={mapContainerRef}
            className="w-full"
            style={{ height: "450px" }}
          />
          {/* Legend */}
          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow" /> On Delivery
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-400 border border-white shadow" /> Offline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-purple-600 border border-white shadow" /> Store
            </span>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {filteredBoys.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-medium text-slate-500">No delivery personnel found</p>
              <p className="text-xs mt-1">
                {counts.total === 0
                  ? "Set delivery role for users to see them here"
                  : "No delivery boys match this filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredBoys.map((boy) => (
                <DeliveryBoyCard key={boy.uid} boy={boy} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Delivery Boy Card ────────────────────────────────────────────────────────
function DeliveryBoyCard({ boy }: { boy: DeliveryBoyInfo }) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        boy.isOnline
          ? boy.activeDeliveries > 0
            ? "border-blue-200 bg-blue-50/30"
            : "border-emerald-200 bg-emerald-50/30"
          : "border-slate-200 bg-slate-50/50 opacity-70"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            boy.isOnline ? "bg-emerald-100" : "bg-slate-200"
          }`}>
            <User className={`w-5 h-5 ${boy.isOnline ? "text-emerald-600" : "text-slate-400"}`} />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
            boy.isOnline
              ? boy.activeDeliveries > 0 ? "bg-blue-500" : "bg-emerald-500"
              : "bg-slate-400"
          }`}>
            {boy.isOnline && boy.activeDeliveries > 0 && (
              <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-800 truncate">{boy.name}</div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {boy.phone && (
              <span className="flex items-center gap-0.5">
                <Phone className="w-3 h-3" /> {boy.phone}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {boy.hasGPS ? (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Signal className="w-3 h-3" /> GPS
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <SignalZero className="w-3 h-3" /> No GPS
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-3 text-[11px] mb-3">
        <span className="flex items-center gap-1 text-slate-500">
          <Package className="w-3 h-3" />
          <span className="font-bold text-slate-700">{boy.totalDeliveries}</span> delivered
        </span>
        {boy.activeDeliveries > 0 && (
          <span className="flex items-center gap-1 text-blue-600 font-semibold">
            <Navigation className="w-3 h-3" />
            {boy.activeDeliveries} active
          </span>
        )}
        {boy.lastSeen && (
          <span className="flex items-center gap-1 text-slate-400 ml-auto">
            <Clock className="w-3 h-3" />
            {formatLastSeen(boy.lastSeen)}
          </span>
        )}
      </div>

      {/* Current Delivery */}
      {boy.currentOrder && (
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 mt-2">
          <div className="text-[10px] font-bold text-blue-600 uppercase mb-1 flex items-center gap-1">
            <Navigation className="w-3 h-3" /> Current Delivery
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700">
                #{boy.currentOrder.orderId || boy.currentOrder.id.slice(0, 8)}
              </span>
              <span className="text-[11px] text-slate-500 ml-2">{boy.currentOrder.customerName}</span>
            </div>
            <span className="text-xs font-bold text-slate-700">{boy.currentOrder.totalValue}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {boy.currentOrder.location?.slice(0, 50) || "No address"}
            {boy.currentOrder.assignedStoreName && (
              <span className="text-purple-600 ml-1">
                from {boy.currentOrder.assignedStoreName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      {boy.hasGPS && boy.lat && boy.lng && (
        <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {boy.lat.toFixed(4)}, {boy.lng.toFixed(4)}
        </div>
      )}
    </div>
  );
}

// ─── Fleet KPI Card ───────────────────────────────────────────────────────────
function FleetCard({
  label,
  value,
  icon,
  pulse,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  pulse: boolean;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        {pulse && value > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

// ─── Delivery Performance Panel ──────────────────────────────────────────────
function DeliveryPerformance({ deliveryBoys, orders }: { deliveryBoys: DeliveryBoyInfo[]; orders: Order[] }) {
  const stats = useMemo(() => {
    const totalDelivered = deliveryBoys.reduce((s, b) => s + b.totalDeliveries, 0);
    const totalActive = deliveryBoys.reduce((s, b) => s + b.activeDeliveries, 0);
    const gpsTracked = deliveryBoys.filter((b) => b.hasGPS && b.isOnline).length;
    const onlineCount = deliveryBoys.filter((b) => b.isOnline).length;
    const gpsRate = onlineCount > 0 ? Math.round((gpsTracked / onlineCount) * 100) : 0;

    // Top performers by fulfilled deliveries
    const topPerformers = [...deliveryBoys]
      .filter((b) => b.totalDeliveries > 0)
      .sort((a, b) => b.totalDeliveries - a.totalDeliveries)
      .slice(0, 3);

    // Average deliveries per person
    const avgDeliveries = deliveryBoys.length > 0
      ? Math.round(totalDelivered / deliveryBoys.length * 10) / 10
      : 0;

    return { totalDelivered, totalActive, gpsRate, topPerformers, avgDeliveries };
  }, [deliveryBoys]);

  if (stats.totalDelivered === 0 && stats.totalActive === 0) return null;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        Fleet Performance
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">{stats.totalDelivered}</div>
          <div className="text-[10px] text-slate-500">Total Delivered</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600">{stats.totalActive}</div>
          <div className="text-[10px] text-slate-500">Active Now</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-emerald-600">{stats.gpsRate}%</div>
          <div className="text-[10px] text-slate-500">GPS Coverage</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-purple-600">{stats.avgDeliveries}</div>
          <div className="text-[10px] text-slate-500">Avg per Person</div>
        </div>
      </div>

      {/* Top Performers */}
      {stats.topPerformers.length > 0 && (
        <div className="border-t border-slate-200 pt-2.5 mt-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-500" />
            Top Performers
          </div>
          <div className="flex items-center gap-3">
            {stats.topPerformers.map((boy, i) => (
              <div key={boy.uid} className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold" style={{
                  color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#cd7f32",
                }}>
                  {i === 0 ? <Star className="w-3 h-3 inline" /> : `#${i + 1}`}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[80px]">{boy.name}</span>
                <span className="text-[10px] text-slate-400">({boy.totalDeliveries})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatLastSeen(ts: Timestamp | null): string {
  if (!ts?.toMillis) return "Unknown";
  const ms = Date.now() - ts.toMillis();
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
