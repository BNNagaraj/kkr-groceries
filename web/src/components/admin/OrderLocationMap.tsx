"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Order } from "@/types/order";
import { MapPin, Loader2, Filter, Calendar, TrendingUp } from "lucide-react";
import MapStyleSettings, { buildMapStyles, loadMapSettings } from "../MapStyleSettings";

declare global {
  interface Window {
    google: any;
  }
}

const HYDERABAD_CENTER = { lat: 17.385, lng: 78.4867 };
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const GEOCODE_CACHE_KEY = "kkr-geocode-cache";

// ─── Branded 🥬 Pin SVG Generator ──────────────────────────────────────────
function createBrandedPin(color: string, darkColor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="58" viewBox="0 0 44 58"><defs><filter id="s" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${darkColor}" flood-opacity="0.5"/></filter><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${darkColor}"/></linearGradient></defs><path d="M22 2C10.4 2 1 11.4 1 23c0 14.5 21 33 21 33s21-18.5 21-33C43 11.4 33.6 2 22 2z" fill="url(#g)" filter="url(#s)"/><circle cx="22" cy="21" r="11" fill="white" opacity="0.95"/><text x="22" y="26.5" text-anchor="middle" font-size="14">🥬</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ─── Status Color Map ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; dark: string; label: string; bg: string; text: string }> = {
  Pending:   { color: "#f59e0b", dark: "#b45309", label: "Pending",   bg: "bg-amber-500",   text: "text-amber-400" },
  Accepted:  { color: "#3b82f6", dark: "#1d4ed8", label: "Accepted",  bg: "bg-blue-500",    text: "text-blue-400" },
  Fulfilled: { color: "#059669", dark: "#064e3b", label: "Fulfilled", bg: "bg-emerald-500",  text: "text-emerald-400" },
  Rejected: { color: "#ef4444", dark: "#991b1b", label: "Rejected", bg: "bg-red-500",      text: "text-red-400" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);
type DateRange = "7d" | "30d" | "all";


interface GeoCoord { lat: number; lng: number; }

function loadGeocodeCache(): Record<string, GeoCoord> {
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); } catch { return {}; }
}
function saveGeocodeCache(cache: Record<string, GeoCoord>) {
  try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function parseTotal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
  return 0;
}

interface Props { orders: Order[]; }

export default function OrderLocationMap({ orders }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(ALL_STATUSES));
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [mapObj, setMapObj] = useState<any>(null);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (dateRange === "all") return orders;
    const now = Date.now();
    const days = dateRange === "7d" ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return orders.filter(o => {
      const raw = o.timestamp || o.createdAt;
      if (!raw) return false;
      let ts = 0;
      if (typeof raw === "string") ts = new Date(raw).getTime();
      else if (typeof raw === "object" && "toDate" in raw) ts = (raw as any).toDate().getTime();
      else if (typeof raw === "number") ts = raw;
      return ts >= cutoff;
    });
  }, [orders, dateRange]);

  // Stats
  const stats = useMemo(() => {
    const visible = filteredOrders.filter(o => activeStatuses.has(o.status || "Pending"));
    const total = visible.reduce((sum, o) => sum + parseTotal(o.totalValue), 0);
    const locations = new Set(visible.map(o => o.location).filter(Boolean));
    return { count: visible.length, total, locations: locations.size };
  }, [filteredOrders, activeStatuses]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { counts[s] = 0; });
    filteredOrders.forEach(o => { counts[o.status || "Pending"] = (counts[o.status || "Pending"] || 0) + 1; });
    return counts;
  }, [filteredOrders]);

  const resolveCoordinates = useCallback(async (ordersToResolve: Order[]): Promise<Map<string, GeoCoord>> => {
    const result = new Map<string, GeoCoord>();
    const cache = loadGeocodeCache();
    const toGeocode: string[] = [];

    ordersToResolve.forEach((o) => {
      if (o.lat && o.lng) {
        result.set(o.id, { lat: o.lat, lng: o.lng });
      } else if (o.location && cache[o.location]) {
        result.set(o.id, cache[o.location]);
      } else if (o.location && !toGeocode.includes(o.location)) {
        toGeocode.push(o.location);
      }
    });

    if (toGeocode.length > 0 && window.google) {
      setGeocoding(true);
      setGeocodeProgress({ done: 0, total: toGeocode.length });
      const geocoder = new window.google.maps.Geocoder();

      for (let i = 0; i < toGeocode.length; i++) {
        const addr = toGeocode[i];
        try {
          const response = await new Promise<any>((resolve, reject) => {
            geocoder.geocode({ address: addr + ", India" }, (results: any, status: string) => {
              if (status === "OK" && results[0]) resolve(results[0]);
              else reject(new Error(status));
            });
          });
          const coord: GeoCoord = { lat: response.geometry.location.lat(), lng: response.geometry.location.lng() };
          cache[addr] = coord;
          ordersToResolve.forEach((o) => {
            if (o.location === addr && !result.has(o.id)) result.set(o.id, coord);
          });
        } catch {}
        setGeocodeProgress({ done: i + 1, total: toGeocode.length });
        if (i < toGeocode.length - 1) await new Promise((r) => setTimeout(r, 50));
      }

      saveGeocodeCache(cache);
      setGeocoding(false);
    }
    return result;
  }, []);

  const initMapAndMarkers = useCallback(async () => {
    if (!window.google || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: HYDERABAD_CENTER,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        fullscreenControlOptions: { position: window.google.maps.ControlPosition.TOP_RIGHT },
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
        styles: buildMapStyles(loadMapSettings()),
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
      setMapObj(mapInstance.current);
    }

    const map = mapInstance.current;
    const infoWindow = infoWindowRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const visibleOrders = filteredOrders.filter(o => activeStatuses.has(o.status || "Pending"));
    const coords = await resolveCoordinates(visibleOrders);

    visibleOrders.forEach((order) => {
      const coord = coords.get(order.id);
      if (!coord) return;

      const status = order.status || "Pending";
      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;

      const marker = new window.google.maps.Marker({
        position: coord,
        map,
        title: order.customerName || "Customer",
        icon: {
          url: createBrandedPin(cfg.color, cfg.dark),
          scaledSize: new window.google.maps.Size(40, 53),
          anchor: new window.google.maps.Point(20, 53),
        },
        animation: window.google.maps.Animation.DROP,
      });

      marker.addListener("click", () => {
        const totalVal = parseTotal(order.totalValue);
        const date = order.timestamp || "";
        const statusBg = { Pending: "#fbbf24", Accepted: "#60a5fa", Shipped: "#818cf8", Fulfilled: "#34d399", Rejected: "#f87171" }[status] || "#94a3b8";

        infoWindow.setContent(`
          <div style="font-family:'Outfit',system-ui,sans-serif;max-width:280px;padding:2px 0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span style="font-size:22px;">🥬</span>
              <div>
                <div style="font-weight:700;font-size:14px;color:#1e293b;line-height:1.2;">${order.customerName || "Customer"}</div>
                ${order.shopName && order.shopName.toLowerCase() !== "not specified" ? `<div style="font-size:11px;color:#64748b;margin-top:1px;">🏪 ${order.shopName}</div>` : ""}
              </div>
            </div>
            <div style="background:linear-gradient(135deg,#f0fdf4,#ecfdf5);padding:10px 12px;border-radius:10px;margin-bottom:8px;border:1px solid #d1fae5;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:800;color:#059669;font-size:16px;">₹${totalVal.toLocaleString("en-IN")}</span>
                <span style="background:${statusBg};color:white;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.3px;">${status}</span>
              </div>
              ${order.cart ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${Array.isArray(order.cart) ? order.cart.length : 0} items</div>` : ""}
            </div>
            <div style="font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;">
              <span>📱 ${order.phone || "N/A"}</span>
              <span>${date}</span>
            </div>
            ${order.location ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;line-height:1.4;">📍 ${order.location}</div>` : ""}
          </div>
        `);
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds
    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getPosition()));
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      const listener = window.google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom() > 15) map.setZoom(15);
        window.google.maps.event.removeListener(listener);
      });
    }
  }, [filteredOrders, activeStatuses, resolveCoordinates]);

  // Load Google Maps & init
  useEffect(() => {
    if (!window.google) {
      const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry,visualization`;
        script.async = true;
        script.defer = true;
        script.onload = () => initMapAndMarkers();
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", () => initMapAndMarkers());
        if (window.google) initMapAndMarkers();
      }
    } else {
      initMapAndMarkers();
    }
  }, [initMapAndMarkers]);

  const toggleStatus = (status: string) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-emerald-900/30 shadow-xl shadow-emerald-950/20 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="p-4 border-b border-emerald-900/20 bg-gradient-to-r from-slate-900 to-emerald-950/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🥬</span>
            <h3 className="font-bold text-white text-sm tracking-wide">Order Locations</h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-400/20">
              {stats.count} orders
            </span>
          </div>
          {geocoding && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Geocoding {geocodeProgress.done}/{geocodeProgress.total}
            </div>
          )}
        </div>

        {/* ── Controls Row ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range */}
          <div className="flex rounded-xl overflow-hidden border border-emerald-800/40 bg-slate-800/50">
            {(["7d", "30d", "all"] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  dateRange === r
                    ? "bg-emerald-600 text-white shadow-inner"
                    : "text-emerald-400/70 hover:text-emerald-300 hover:bg-slate-700/50"
                }`}
              >
                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-emerald-800/30 mx-1" />

          {/* Status Filter Pills */}
          {ALL_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status];
            const isActive = activeStatuses.has(status);
            const count = statusCounts[status] || 0;
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
                  isActive
                    ? "border-current bg-current/10 shadow-sm"
                    : "border-slate-700 bg-slate-800/30 text-slate-500 hover:text-slate-400"
                }`}
                style={isActive ? { color: cfg.color, borderColor: cfg.color + "40" } : undefined}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? cfg.bg : "bg-slate-600"}`} />
                {cfg.label}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────── */}
      <div className="relative">
        <div ref={mapRef} className="h-[480px] w-full bg-gray-100" />
        {mapObj && <MapStyleSettings mapInstance={mapObj} position="top-left" />}
      </div>

      {/* ── Legend & Stats Footer ────────────────────────────── */}
      <div className="px-4 py-3 border-t border-emerald-900/20 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {ALL_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
                <span className="text-slate-400">{cfg.label}</span>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-slate-500">
          <span className="text-emerald-400 font-semibold">₹{stats.total.toLocaleString("en-IN")}</span>
          <span className="mx-1.5">•</span>
          <span>{stats.locations} locations</span>
        </div>
      </div>
    </div>
  );
}
