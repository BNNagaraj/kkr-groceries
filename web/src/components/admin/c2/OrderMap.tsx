"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { C2Theme } from "../CommandCenter";
import { Order, OrderStatus } from "@/types/order";
import type { DeliverySettings } from "@/types/settings";
import { MapPin, Loader2, Maximize2, Minimize2, Flame, Eye, EyeOff } from "lucide-react";
import MapStyleSettings, { loadMapSettings, buildMapStyles } from "../../MapStyleSettings";

declare global {
  interface Window {
    google: any;
    __c2MapStatusChange?: (orderId: string, newStatus: string) => void;
    __c2MapViewOrder?: (orderId: string) => void;
  }
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const GEOCODE_CACHE_KEY = "kkr-geocode-cache";

// ─── Pin Size Presets ────────────────────────────────────────────────────────
const PIN_SIZES = {
  small: { w: 18, h: 24, anchor: 9, label: "S" },
  medium: { w: 24, h: 32, anchor: 12, label: "M" },
  large: { w: 32, h: 43, anchor: 16, label: "L" },
} as const;
type PinSize = keyof typeof PIN_SIZES;

// ─── Map View Mode ──────────────────────────────────────────────────────────
type MapViewMode = "pins" | "heat";

// ─── Map Styles ──────────────────────────────────────────────────────────────
const C2_MAP_STYLES_DARK = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a4a" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#6a6a8e" }] },
  { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#16213e" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#5a5a7e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2a2a4a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#3a3a5a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#2a2a4a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2a2a4a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a5a7a" }] },
];

// ─── Heatmap Gradient ────────────────────────────────────────────────────────
const HEATMAP_GRADIENT = [
  "rgba(16,185,129,0)",
  "rgba(52,211,153,0.2)",
  "rgba(110,231,183,0.35)",
  "rgba(245,158,11,0.5)",
  "rgba(249,115,22,0.6)",
  "rgba(239,68,68,0.7)",
  "rgba(220,38,38,0.8)",
  "rgba(153,27,27,0.9)",
];

// ─── Status Config ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; dark: string }> = {
  Pending:   { color: "#f59e0b", dark: "#b45309" },
  Accepted:  { color: "#3b82f6", dark: "#1d4ed8" },
  Shipped:   { color: "#8b5cf6", dark: "#6d28d9" },
  Fulfilled: { color: "#10b981", dark: "#059669" },
  Rejected:  { color: "#ef4444", dark: "#991b1b" },
};

// ─── SVG Pin Generators ─────────────────────────────────────────────────────
function createC2Pin(color: string, darkColor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${darkColor}"/></linearGradient>
    </defs>
    <path d="M18 2C9 2 1 10 1 19c0 12 17 27 17 27s17-15 17-27C35 10 27 2 18 2z" fill="url(#g)" filter="url(#glow)" opacity="0.95"/>
    <circle cx="18" cy="17" r="7" fill="white" opacity="0.9"/>
    <circle cx="18" cy="17" r="3" fill="${darkColor}" opacity="0.8"/>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function createUserPinSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="12" fill="#3b82f6" stroke="white" stroke-width="2.5" opacity="0.85"/>
    <circle cx="14" cy="10" r="3.5" fill="white" opacity="0.9"/>
    <ellipse cx="14" cy="19" rx="5.5" ry="3.5" fill="white" opacity="0.7"/>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function readStorageString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

// ─── Compute next actions for an order ───────────────────────────────────────
function getNextActions(status: string): { label: string; status: OrderStatus; color: string }[] {
  const actions: { label: string; status: OrderStatus; color: string }[] = [];
  if (status === "Pending") {
    actions.push({ label: "Accept", status: "Accepted", color: "#3b82f6" });
    actions.push({ label: "Reject", status: "Rejected", color: "#ef4444" });
  } else if (status === "Accepted") {
    actions.push({ label: "Ship", status: "Shipped", color: "#8b5cf6" });
  } else if (status === "Shipped") {
    actions.push({ label: "Fulfill", status: "Fulfilled", color: "#10b981" });
  }
  return actions;
}

// ─── Build info window HTML ──────────────────────────────────────────────────
function buildInfoWindowHTML(order: Order, theme: C2Theme): string {
  const status = order.status || "Pending";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
  const totalVal = parseTotal(order.totalValue);
  const isDark = theme === "dark";
  const bg = isDark ? "#1e293b" : "#ffffff";
  const textPrimary = isDark ? "#e2e8f0" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const borderColor = isDark ? "#334155" : "#e2e8f0";
  const cardBg = isDark ? "#0f172a" : "#f8fafc";

  const cart = order.cart || [];
  const cartRows = cart.slice(0, 8).map((item) =>
    `<tr style="border-bottom:1px solid ${borderColor};">
      <td style="padding:3px 4px;font-size:10px;color:${textPrimary};max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</td>
      <td style="padding:3px 4px;font-size:10px;color:${textSecondary};white-space:nowrap;text-align:right;">${item.qty} ${item.unit}</td>
      <td style="padding:3px 4px;font-size:10px;color:${textSecondary};text-align:right;">\u20B9${item.price}</td>
    </tr>`
  ).join("");
  const moreItems = cart.length > 8 ? `<div style="font-size:9px;color:${textSecondary};text-align:center;padding:4px;">+${cart.length - 8} more items</div>` : "";

  const actions = getNextActions(status);
  const actionBtns = actions.map((a) =>
    `<button data-c2-action="${a.status}" data-order-id="${order.id}" style="flex:1;padding:6px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid ${a.color}40;background:${a.color}20;color:${a.color};transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${a.label}</button>`
  ).join("");

  return `
    <div style="font-family:system-ui,sans-serif;max-width:300px;padding:4px 0;background:transparent;">
      <div style="margin-bottom:8px;">
        <div style="font-weight:700;font-size:13px;color:${textPrimary};">${order.customerName || "Customer"}</div>
        ${order.shopName ? `<div style="font-size:10px;color:${textSecondary};margin-top:1px;">${order.shopName}</div>` : ""}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:${cardBg};border-radius:8px;border:1px solid ${borderColor};">
        <span style="font-weight:800;color:#059669;font-size:14px;">\u20B9${totalVal.toLocaleString("en-IN")}</span>
        <span style="background:${cfg.color};color:white;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;">${status}</span>
      </div>
      ${order.phone ? `<div style="font-size:10px;color:${textSecondary};margin-top:6px;">\uD83D\uDCF1 ${order.phone}</div>` : ""}
      ${cart.length > 0 ? `
        <div style="max-height:150px;overflow-y:auto;margin:8px 0;border:1px solid ${borderColor};border-radius:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid ${borderColor};">
                <th style="padding:4px;font-size:9px;font-weight:600;color:${textSecondary};text-align:left;">Item</th>
                <th style="padding:4px;font-size:9px;font-weight:600;color:${textSecondary};text-align:right;">Qty</th>
                <th style="padding:4px;font-size:9px;font-weight:600;color:${textSecondary};text-align:right;">Price</th>
              </tr>
            </thead>
            <tbody>${cartRows}</tbody>
          </table>
          ${moreItems}
        </div>
      ` : ""}
      ${actions.length > 0 ? `<div style="display:flex;gap:6px;margin-top:8px;">${actionBtns}</div>` : ""}
      <div style="margin-top:8px;text-align:center;">
        <a href="#" data-c2-view-order="${order.id}" style="font-size:10px;color:#3b82f6;text-decoration:none;font-weight:600;">View Full Order \u2192</a>
      </div>
    </div>
  `;
}

// ─── Online User Marker Type ────────────────────────────────────────────────
export interface OnlineUserMarker {
  uid: string;
  displayName: string | null;
  email: string | null;
  lat?: number;
  lng?: number;
  location?: string;
}

// ─── Main C2 Map Component ──────────────────────────────────────────────────
interface OrderMapProps {
  orders: Order[];
  theme: C2Theme;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  onViewFullOrder?: (orderId: string) => void;
  deliveryZone?: DeliverySettings;
  onlineUsers?: OnlineUserMarker[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function OrderMap({
  orders,
  theme,
  onStatusChange,
  onViewFullOrder,
  deliveryZone,
  onlineUsers,
  isExpanded,
  onToggleExpand,
}: OrderMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });

  const [pinSize, setPinSize] = useState<PinSize>(() =>
    readStorageString("kkr-c2-pin-size", "small") as PinSize
  );

  // Map view mode: pins (markers) or heat (heatmap overlay)
  const [mapView, setMapView] = useState<MapViewMode>("pins");
  // Show/hide delivery zone circle
  const [showZone, setShowZone] = useState(true);
  // Map object for MapStyleSettings
  const [mapObj, setMapObj] = useState<any>(null);
  // Show/hide legend
  const [showLegend, setShowLegend] = useState(true);

  // Refs for managing features
  const isFirstLoadRef = useRef(true);
  const heatmapLayerRef = useRef<any>(null);
  const zoneCircleRef = useRef<any>(null);
  const userMarkersRef = useRef<any[]>([]);
  const resolvedCoordsRef = useRef<Map<string, GeoCoord>>(new Map());

  // Expose global callbacks for info window button events
  useEffect(() => {
    window.__c2MapStatusChange = (orderId: string, newStatus: string) => {
      onStatusChange?.(orderId, newStatus as OrderStatus);
    };
    window.__c2MapViewOrder = (orderId: string) => {
      onViewFullOrder?.(orderId);
    };
    return () => {
      delete window.__c2MapStatusChange;
      delete window.__c2MapViewOrder;
    };
  }, [onStatusChange, onViewFullOrder]);

  // Delivery zone center or default to Hyderabad
  const mapCenter = useMemo(() => {
    if (deliveryZone) return { lat: deliveryZone.centerLat, lng: deliveryZone.centerLng };
    return { lat: 17.385, lng: 78.4867 };
  }, [deliveryZone]);

  const mappableOrders = useMemo(
    () => orders.filter((o) => o.lat || o.location),
    [orders]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const s = o.status || "Pending";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [orders]);

  // ─── Geocode resolver ──────────────────────────────────────────────────────
  const resolveCoordinates = useCallback(
    async (ordersToResolve: Order[]): Promise<Map<string, GeoCoord>> => {
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
              geocoder.geocode(
                { address: addr + ", India" },
                (results: any, status: string) => {
                  if (status === "OK" && results[0]) resolve(results[0]);
                  else reject(new Error(status));
                }
              );
            });
            const coord: GeoCoord = {
              lat: response.geometry.location.lat(),
              lng: response.geometry.location.lng(),
            };
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

      resolvedCoordsRef.current = result;
      return result;
    },
    []
  );

  // ─── Init map + markers ────────────────────────────────────────────────────
  const initMapAndMarkers = useCallback(async () => {
    if (!window.google || !mapRef.current) return;

    // PHASE 5 FIX: Save current view to restore after marker rebuild
    let savedCenter: any = null;
    let savedZoom: number | null = null;
    if (mapInstance.current && !isFirstLoadRef.current) {
      savedCenter = mapInstance.current.getCenter();
      savedZoom = mapInstance.current.getZoom();
    }

    if (!mapInstance.current) {
      // Determine initial styles — dark mode uses C2 dark styles, light mode uses MapStyleSettings
      const initialStyles = theme === "dark"
        ? C2_MAP_STYLES_DARK
        : buildMapStyles(loadMapSettings());

      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: mapCenter,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER,
        },
        styles: initialStyles,
        backgroundColor: theme === "dark" ? "#0f172a" : "#f8fafc",
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
      setMapObj(mapInstance.current);
    } else {
      // Update styles on theme change
      mapInstance.current.setOptions({
        styles: theme === "dark" ? C2_MAP_STYLES_DARK : buildMapStyles(loadMapSettings()),
        backgroundColor: theme === "dark" ? "#0f172a" : "#f8fafc",
      });
    }

    const map = mapInstance.current;
    const infoWindow = infoWindowRef.current;
    const pinCfg = PIN_SIZES[pinSize];

    // Clear existing order markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Clear existing heatmap
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setMap(null);
      heatmapLayerRef.current = null;
    }

    const coords = await resolveCoordinates(mappableOrders);

    // Create order markers (visible only in "pins" mode)
    mappableOrders.forEach((order) => {
      const coord = coords.get(order.id);
      if (!coord) return;

      const status = order.status || "Pending";
      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
      const isFulfilledOrRejected = status === "Fulfilled" || status === "Rejected";

      const marker = new window.google.maps.Marker({
        position: coord,
        map: mapView === "pins" ? map : null,
        title: `${order.customerName || "Customer"} \u2014 \u20B9${parseTotal(order.totalValue).toLocaleString("en-IN")}`,
        icon: {
          url: createC2Pin(cfg.color, cfg.dark),
          scaledSize: new window.google.maps.Size(pinCfg.w, pinCfg.h),
          anchor: new window.google.maps.Point(pinCfg.anchor, pinCfg.h),
        },
        opacity: isFulfilledOrRejected ? 0.4 : 1,
        animation: isFirstLoadRef.current ? window.google.maps.Animation.DROP : null,
      });

      marker.addListener("click", () => {
        infoWindow.setContent(buildInfoWindowHTML(order, theme));
        infoWindow.open(map, marker);

        window.google.maps.event.addListenerOnce(infoWindow, "domready", () => {
          document.querySelectorAll("[data-c2-action]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.preventDefault();
              const action = (btn as HTMLElement).getAttribute("data-c2-action")!;
              const oid = (btn as HTMLElement).getAttribute("data-order-id")!;
              window.__c2MapStatusChange?.(oid, action);
              infoWindow.close();
            });
          });
          document.querySelectorAll("[data-c2-view-order]").forEach((link) => {
            link.addEventListener("click", (e) => {
              e.preventDefault();
              const oid = (link as HTMLElement).getAttribute("data-c2-view-order")!;
              window.__c2MapViewOrder?.(oid);
              infoWindow.close();
            });
          });
        });
      });

      markersRef.current.push(marker);
    });

    // Create heatmap layer (visible only in "heat" mode)
    if (mapView === "heat" && window.google.maps.visualization) {
      const heatData: any[] = [];
      mappableOrders.forEach((order) => {
        const coord = coords.get(order.id);
        if (!coord) return;
        heatData.push({
          location: new window.google.maps.LatLng(coord.lat, coord.lng),
          weight: Math.max(1, parseTotal(order.totalValue) / 100),
        });
      });
      heatmapLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
        data: heatData,
        map,
        radius: 30,
        opacity: 0.7,
        gradient: HEATMAP_GRADIENT,
      });
    }

    // ─── Delivery Zone Circle ─────────────────────────────────────────────
    if (zoneCircleRef.current) {
      zoneCircleRef.current.setMap(null);
      zoneCircleRef.current = null;
    }
    if (deliveryZone && showZone) {
      zoneCircleRef.current = new window.google.maps.Circle({
        center: { lat: deliveryZone.centerLat, lng: deliveryZone.centerLng },
        radius: deliveryZone.radiusKm * 1000,
        map,
        strokeColor: "#10b981",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#10b981",
        fillOpacity: 0.06,
        clickable: false,
      });
    }

    // ─── Online User Markers ──────────────────────────────────────────────
    userMarkersRef.current.forEach((m) => m.setMap(null));
    userMarkersRef.current = [];

    if (onlineUsers && mapView === "pins") {
      const userPinUrl = createUserPinSvg();
      const geocodeCache = loadGeocodeCache();

      for (const user of onlineUsers) {
        let userCoord: GeoCoord | null = null;
        if (user.lat && user.lng) {
          userCoord = { lat: user.lat, lng: user.lng };
        } else if (user.location && geocodeCache[user.location]) {
          userCoord = geocodeCache[user.location];
        }
        if (!userCoord) continue;

        const userMarker = new window.google.maps.Marker({
          position: userCoord,
          map,
          title: `${user.displayName || user.email || "User"} (online)`,
          icon: {
            url: userPinUrl,
            scaledSize: new window.google.maps.Size(22, 22),
            anchor: new window.google.maps.Point(11, 11),
          },
          opacity: 0.9,
          zIndex: 1,
        });

        userMarker.addListener("click", () => {
          const isDark = theme === "dark";
          const bg = isDark ? "#1e293b" : "#ffffff";
          const text = isDark ? "#e2e8f0" : "#0f172a";
          const muted = isDark ? "#94a3b8" : "#64748b";
          infoWindow.setContent(`
            <div style="font-family:system-ui,sans-serif;padding:4px 0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;">
                  <span style="color:white;font-weight:700;font-size:11px;">${(user.displayName || user.email || "?")[0].toUpperCase()}</span>
                </div>
                <div>
                  <div style="font-weight:700;font-size:12px;color:${text};">${user.displayName || "User"}</div>
                  ${user.email ? `<div style="font-size:10px;color:${muted};">${user.email}</div>` : ""}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:6px;height:6px;border-radius:50%;background:#22c55e;"></span>
                <span style="font-size:10px;color:#22c55e;font-weight:600;">Online Now</span>
              </div>
              ${user.location ? `<div style="font-size:10px;color:${muted};margin-top:4px;">\uD83D\uDCCD ${user.location}</div>` : ""}
            </div>
          `);
          infoWindow.open(map, userMarker);
        });

        userMarkersRef.current.push(userMarker);
      }
    }

    // ─── Initial View / Restore View ─────────────────────────────────────
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      // Fit to delivery zone if available, else fit to markers
      if (deliveryZone) {
        const zoneBounds = new window.google.maps.Circle({
          center: { lat: deliveryZone.centerLat, lng: deliveryZone.centerLng },
          radius: deliveryZone.radiusKm * 1000,
        }).getBounds();
        if (zoneBounds) map.fitBounds(zoneBounds, { top: 30, right: 30, bottom: 30, left: 30 });
      } else if (markersRef.current.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        markersRef.current.forEach((m) => bounds.extend(m.getPosition()));
        map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
        const listener = window.google.maps.event.addListener(map, "idle", () => {
          if (map.getZoom() > 15) map.setZoom(15);
          window.google.maps.event.removeListener(listener);
        });
      }
    } else if (savedCenter && savedZoom !== null) {
      // PHASE 5 FIX: Restore previous zoom/center instead of resetting
      map.setCenter(savedCenter);
      map.setZoom(savedZoom);
    }
  }, [mappableOrders, resolveCoordinates, theme, pinSize, mapCenter, deliveryZone, showZone, mapView, onlineUsers]);

  // ─── Load Google Maps & init ───────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
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

  const handlePinSizeChange = (size: PinSize) => {
    setPinSize(size);
    try { localStorage.setItem("kkr-c2-pin-size", size); } catch {}
  };

  const onlineUserCount = onlineUsers?.filter((u) => u.lat || u.location).length || 0;

  return (
    <div className="h-full flex flex-col">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <h3 className="text-sm font-bold tracking-wide flex items-center gap-2" style={{ color: "var(--c2-text)" }}>
          <MapPin className="w-4 h-4 text-emerald-500" />
          Live Order Map
          {deliveryZone && (
            <span className="text-[9px] font-normal" style={{ color: "var(--c2-text-muted)" }}>
              {deliveryZone.zoneName}
            </span>
          )}
        </h3>

        <div className="flex items-center gap-2">
          {geocoding && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              {geocodeProgress.done}/{geocodeProgress.total}
            </div>
          )}

          {/* Pins / Heat toggle */}
          <div className="flex items-center gap-0.5 rounded-md overflow-hidden" style={{ border: "1px solid var(--c2-border)" }}>
            <button
              onClick={() => setMapView("pins")}
              className="px-2 py-1 text-[9px] font-bold transition-colors flex items-center gap-1"
              style={{
                background: mapView === "pins" ? "var(--c2-text)" : "transparent",
                color: mapView === "pins" ? "var(--c2-bg)" : "var(--c2-text-muted)",
              }}
              title="Pin markers"
            >
              <MapPin className="w-2.5 h-2.5" /> Pins
            </button>
            <button
              onClick={() => setMapView("heat")}
              className="px-2 py-1 text-[9px] font-bold transition-colors flex items-center gap-1"
              style={{
                background: mapView === "heat" ? "var(--c2-text)" : "transparent",
                color: mapView === "heat" ? "var(--c2-bg)" : "var(--c2-text-muted)",
              }}
              title="Heat map"
            >
              <Flame className="w-2.5 h-2.5" /> Heat
            </button>
          </div>

          {/* Zone toggle */}
          {deliveryZone && (
            <button
              onClick={() => setShowZone((p) => !p)}
              className="px-2 py-1 rounded-md text-[9px] font-bold transition-colors"
              style={{
                border: "1px solid var(--c2-border)",
                background: showZone ? "rgba(16,185,129,0.15)" : "transparent",
                color: showZone ? "#10b981" : "var(--c2-text-muted)",
              }}
              title={showZone ? "Hide delivery zone" : "Show delivery zone"}
            >
              {showZone ? <Eye className="w-2.5 h-2.5 inline mr-0.5" /> : <EyeOff className="w-2.5 h-2.5 inline mr-0.5" />}
              Zone
            </button>
          )}

          {/* Pin size controls (only in pins mode) */}
          {mapView === "pins" && (
            <div className="flex items-center gap-0.5 rounded-md overflow-hidden" style={{ border: "1px solid var(--c2-border)" }}>
              {(Object.keys(PIN_SIZES) as PinSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => handlePinSizeChange(size)}
                  className="px-2 py-1 text-[9px] font-bold transition-colors"
                  style={{
                    background: pinSize === size ? "var(--c2-text)" : "transparent",
                    color: pinSize === size ? "var(--c2-bg)" : "var(--c2-text-muted)",
                  }}
                  title={`${size} pins`}
                >
                  {PIN_SIZES[size].label}
                </button>
              ))}
            </div>
          )}

          {/* Expand/Collapse */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "var(--c2-text-muted)", border: "1px solid var(--c2-border)" }}
              title={isExpanded ? "Collapse map" : "Expand map fullscreen"}
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* ─── Map Container ──────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {GOOGLE_MAPS_KEY ? (
          <>
            <div
              ref={mapRef}
              className="absolute inset-0"
              style={{ backgroundColor: theme === "dark" ? "#0f172a" : "#f8fafc" }}
            />

            {/* MapStyleSettings overlay (light mode style control) */}
            {mapObj && <MapStyleSettings mapInstance={mapObj} position="top-left" />}

            {/* ─── Legend Overlay ────────────────────────────────────────── */}
            {showLegend && (
              <div
                className="absolute bottom-3 left-3 z-10 rounded-xl p-3 backdrop-blur-sm shadow-lg"
                style={{
                  background: theme === "dark" ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.92)",
                  border: `1px solid ${theme === "dark" ? "rgba(51,65,85,0.5)" : "rgba(226,232,240,0.8)"}`,
                  minWidth: isExpanded ? "180px" : "140px",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[8px] font-bold uppercase tracking-widest"
                    style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}
                  >
                    Legend
                  </span>
                  <button
                    onClick={() => setShowLegend(false)}
                    className="text-[8px] font-bold opacity-40 hover:opacity-100 transition-opacity"
                    style={{ color: theme === "dark" ? "#94a3b8" : "#64748b" }}
                  >
                    \u2715
                  </button>
                </div>

                {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                  <div key={status} className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span
                      className="text-[9px] flex-1"
                      style={{ color: theme === "dark" ? "#94a3b8" : "#475569" }}
                    >
                      {status}
                    </span>
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}
                    >
                      {statusCounts[status] || 0}
                    </span>
                  </div>
                ))}

                {deliveryZone && showZone && (
                  <div
                    className="flex items-center gap-2 mt-2 pt-2"
                    style={{ borderTop: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}` }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 border border-emerald-500/60"
                      style={{ background: "rgba(16,185,129,0.2)" }}
                    />
                    <span
                      className="text-[9px]"
                      style={{ color: theme === "dark" ? "#94a3b8" : "#475569" }}
                    >
                      {deliveryZone.zoneName} ({deliveryZone.radiusKm}km)
                    </span>
                  </div>
                )}

                {onlineUserCount > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-blue-500" />
                    <span
                      className="text-[9px] flex-1"
                      style={{ color: theme === "dark" ? "#94a3b8" : "#475569" }}
                    >
                      Online Users
                    </span>
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}
                    >
                      {onlineUserCount}
                    </span>
                  </div>
                )}

                {mapView === "heat" && (
                  <div
                    className="mt-2 pt-2"
                    style={{ borderTop: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}` }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[8px] shrink-0"
                        style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}
                      >
                        Low
                      </span>
                      <div
                        className="flex-1 h-1.5 rounded-full"
                        style={{
                          background: "linear-gradient(90deg, #10b981, #34d399, #f59e0b, #ef4444, #991b1b)",
                        }}
                      />
                      <span
                        className="text-[8px] shrink-0"
                        style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}
                      >
                        High
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Toggle legend back if hidden */}
            {!showLegend && (
              <button
                onClick={() => setShowLegend(true)}
                className="absolute bottom-3 left-3 z-10 px-2 py-1 rounded-lg text-[9px] font-bold shadow-md backdrop-blur-sm"
                style={{
                  background: theme === "dark" ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)",
                  color: theme === "dark" ? "#94a3b8" : "#64748b",
                  border: `1px solid ${theme === "dark" ? "rgba(51,65,85,0.5)" : "rgba(226,232,240,0.8)"}`,
                }}
              >
                Legend
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--c2-bg-secondary)" }}>
            <div className="text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--c2-text-muted)" }} />
              <div className="text-sm" style={{ color: "var(--c2-text-muted)" }}>
                Google Maps API key not configured
              </div>
              <div className="text-[10px] mt-1" style={{ color: "var(--c2-text-muted)", opacity: 0.6 }}>
                Set NEXT_PUBLIC_GOOGLE_MAPS_KEY in .env.local
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
