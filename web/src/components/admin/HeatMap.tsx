"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Order } from "@/types/order";
import { Flame, Loader2, Layers, Palette } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}

const HYDERABAD_CENTER = { lat: 17.385, lng: 78.4867 };
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const GEOCODE_CACHE_KEY = "kkr-geocode-cache";

function parseTotal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
  return 0;
}

interface GeoCoord { lat: number; lng: number; }

function loadGeocodeCache(): Record<string, GeoCoord> {
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); } catch { return {}; }
}
function saveGeocodeCache(cache: Record<string, GeoCoord>) {
  try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// ─── Premium Dark Emerald Map Style ─────────────────────────────────────────
const darkEmeraldStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f1b15" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6ee7b7" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1610" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#162b1f" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f3d2c" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1a3526" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#264f38" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#34d399" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#082f1e" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#34d399" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#11231a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0d2e1c" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0f2318" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#0f1b15" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#162b1f" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1f3d2c" }] },
];

// ─── Gradient Presets ───────────────────────────────────────────────────────
type GradientKey = "emerald" | "fire" | "revenue";

const GRADIENT_PRESETS: Record<GradientKey, { label: string; emoji: string; colors: string[]; cssGradient: string }> = {
  emerald: {
    label: "Emerald",
    emoji: "🥬",
    colors: [
      "rgba(209, 250, 229, 0)",
      "rgba(167, 243, 208, 0.4)",
      "rgba(110, 231, 183, 0.6)",
      "rgba(52, 211, 153, 0.7)",
      "rgba(16, 185, 129, 0.8)",
      "rgba(5, 150, 105, 0.85)",
      "rgba(4, 120, 87, 0.9)",
      "rgba(6, 78, 59, 1)",
    ],
    cssGradient: "linear-gradient(90deg, #d1fae5, #6ee7b7, #10b981, #059669, #064e3b)",
  },
  fire: {
    label: "Fire",
    emoji: "🔥",
    colors: [
      "rgba(254, 240, 138, 0)",
      "rgba(253, 224, 71, 0.4)",
      "rgba(251, 191, 36, 0.5)",
      "rgba(251, 146, 60, 0.6)",
      "rgba(249, 115, 22, 0.7)",
      "rgba(239, 68, 68, 0.8)",
      "rgba(220, 38, 38, 0.9)",
      "rgba(153, 27, 27, 1)",
    ],
    cssGradient: "linear-gradient(90deg, #fef08a, #fbbf24, #fb923c, #f97316, #ef4444, #991b1b)",
  },
  revenue: {
    label: "Revenue",
    emoji: "💰",
    colors: [
      "rgba(253, 230, 138, 0)",
      "rgba(252, 211, 77, 0.4)",
      "rgba(251, 191, 36, 0.5)",
      "rgba(245, 158, 11, 0.6)",
      "rgba(217, 119, 6, 0.7)",
      "rgba(180, 83, 9, 0.8)",
      "rgba(146, 64, 14, 0.9)",
      "rgba(120, 53, 15, 1)",
    ],
    cssGradient: "linear-gradient(90deg, #fde68a, #fbbf24, #f59e0b, #d97706, #b45309, #78350f)",
  },
};

interface Props { orders: Order[]; }

export default function HeatMap({ orders }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const heatmapLayer = useRef<any>(null);
  const [mode, setMode] = useState<"density" | "revenue">("density");
  const [radius, setRadius] = useState(35);
  const [opacity, setOpacity] = useState(0.75);
  const [gradient, setGradient] = useState<GradientKey>("emerald");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const resolvedCoords = useRef<Map<string, GeoCoord>>(new Map());

  const resolveCoordinates = useCallback(async () => {
    const cache = loadGeocodeCache();
    const result = new Map<string, GeoCoord>();
    const toGeocode: string[] = [];

    orders.forEach((o) => {
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
          orders.forEach((o) => {
            if (o.location === addr && !result.has(o.id)) result.set(o.id, coord);
          });
        } catch {}
        setGeocodeProgress({ done: i + 1, total: toGeocode.length });
        if (i < toGeocode.length - 1) await new Promise((r) => setTimeout(r, 50));
      }

      saveGeocodeCache(cache);
      setGeocoding(false);
    }

    resolvedCoords.current = result;
    return result;
  }, [orders]);

  const updateHeatmap = useCallback(() => {
    if (!window.google || !mapInstance.current) return;

    const coords = resolvedCoords.current;
    const data: any[] = [];

    orders.forEach((o) => {
      const coord = coords.get(o.id);
      if (!coord) return;
      if (mode === "revenue") {
        data.push({
          location: new window.google.maps.LatLng(coord.lat, coord.lng),
          weight: Math.max(1, parseTotal(o.totalValue) / 100),
        });
      } else {
        data.push(new window.google.maps.LatLng(coord.lat, coord.lng));
      }
    });

    if (heatmapLayer.current) heatmapLayer.current.setMap(null);

    heatmapLayer.current = new window.google.maps.visualization.HeatmapLayer({
      data,
      map: mapInstance.current,
      radius,
      opacity,
      gradient: GRADIENT_PRESETS[gradient].colors,
    });
  }, [orders, mode, radius, opacity, gradient]);

  const initMap = useCallback(async () => {
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
        styles: darkEmeraldStyle,
        backgroundColor: "#0f1b15",
      });
    }

    await resolveCoordinates();
    updateHeatmap();
  }, [resolveCoordinates, updateHeatmap]);

  // Load Google Maps
  useEffect(() => {
    if (!window.google) {
      const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry,visualization`;
        script.async = true;
        script.defer = true;
        script.onload = () => initMap();
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", () => initMap());
        if (window.google) initMap();
      }
    } else {
      initMap();
    }
  }, [initMap]);

  // Update heatmap when controls change
  useEffect(() => {
    updateHeatmap();
  }, [mode, radius, opacity, gradient, updateHeatmap]);

  const resolvedCount = resolvedCoords.current.size;

  return (
    <div className="bg-slate-900 rounded-2xl border border-emerald-900/30 shadow-xl shadow-emerald-950/20 overflow-hidden">
      {/* ── Header & Controls ─────────────────────────────────── */}
      <div className="p-4 border-b border-emerald-900/20 bg-gradient-to-r from-slate-900 to-emerald-950/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-white text-sm tracking-wide">Order Heatmap</h3>
            <span className="text-[10px] text-orange-400 bg-orange-400/10 px-2.5 py-0.5 rounded-full font-semibold border border-orange-400/20">
              {resolvedCount} points
            </span>
          </div>
          {geocoding && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Geocoding {geocodeProgress.done}/{geocodeProgress.total}
            </div>
          )}
        </div>

        {/* ── Controls ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-emerald-800/40 bg-slate-800/50">
            <button
              onClick={() => setMode("density")}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                mode === "density"
                  ? "bg-emerald-600 text-white shadow-inner"
                  : "text-emerald-400/70 hover:text-emerald-300 hover:bg-slate-700/50"
              }`}
            >
              <Layers className="w-3 h-3" /> Density
            </button>
            <button
              onClick={() => setMode("revenue")}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                mode === "revenue"
                  ? "bg-emerald-600 text-white shadow-inner"
                  : "text-emerald-400/70 hover:text-emerald-300 hover:bg-slate-700/50"
              }`}
            >
              💰 Revenue
            </button>
          </div>

          <div className="w-px h-5 bg-emerald-800/30" />

          {/* Gradient Preset Buttons */}
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-slate-500" />
            {(Object.keys(GRADIENT_PRESETS) as GradientKey[]).map(key => {
              const preset = GRADIENT_PRESETS[key];
              const isActive = gradient === key;
              return (
                <button
                  key={key}
                  onClick={() => setGradient(key)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all border ${
                    isActive
                      ? "border-emerald-400/60 bg-slate-700 shadow-md scale-110"
                      : "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 opacity-60 hover:opacity-100"
                  }`}
                  title={preset.label}
                >
                  {preset.emoji}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-emerald-800/30" />

          {/* Radius Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 min-w-[60px]">Spread: {radius}</span>
            <input
              type="range"
              min={15}
              max={80}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="w-20 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-emerald-500/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-300"
            />
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 min-w-[68px]">Intensity: {Math.round(opacity * 100)}%</span>
            <input
              type="range"
              min={20}
              max={100}
              value={opacity * 100}
              onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
              className="w-20 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-emerald-500/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-300"
            />
          </div>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────── */}
      <div ref={mapRef} className="h-[480px] w-full bg-slate-900" />

      {/* ── Legend Footer ──────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-emerald-900/20 bg-slate-900/80">
        <div className="flex items-center justify-between gap-4">
          {/* Gradient Bar */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[10px] text-slate-500 font-medium shrink-0">Low</span>
            <div
              className="flex-1 h-2.5 rounded-full max-w-[200px]"
              style={{ background: GRADIENT_PRESETS[gradient].cssGradient }}
            />
            <span className="text-[10px] text-slate-500 font-medium shrink-0">High</span>
          </div>

          {/* Stats */}
          <div className="text-[11px] text-slate-500 shrink-0">
            {mode === "density" ? (
              <span>{resolvedCount} data points visualized</span>
            ) : (
              <span>
                Revenue-weighted • <span className="text-emerald-400 font-semibold">
                  ₹{orders.reduce((s, o) => s + parseTotal(o.totalValue), 0).toLocaleString("en-IN")}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
