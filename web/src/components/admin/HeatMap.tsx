"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Order } from "@/types/order";
import { Flame, Loader2 } from "lucide-react";

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

interface GeoCoord {
  lat: number;
  lng: number;
}

function loadGeocodeCache(): Record<string, GeoCoord> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache: Record<string, GeoCoord>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

const customMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8e2" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] },
];

interface Props {
  orders: Order[];
}

export default function HeatMap({ orders }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const heatmapLayer = useRef<any>(null);
  const [mode, setMode] = useState<"density" | "revenue">("density");
  const [radius, setRadius] = useState(30);
  const [opacity, setOpacity] = useState(0.7);
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
          orders.forEach((o) => {
            if (o.location === addr && !result.has(o.id)) {
              result.set(o.id, coord);
            }
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
        const weight = Math.max(1, parseTotal(o.totalValue) / 100);
        data.push({
          location: new window.google.maps.LatLng(coord.lat, coord.lng),
          weight,
        });
      } else {
        data.push(new window.google.maps.LatLng(coord.lat, coord.lng));
      }
    });

    if (heatmapLayer.current) {
      heatmapLayer.current.setMap(null);
    }

    heatmapLayer.current = new window.google.maps.visualization.HeatmapLayer({
      data,
      map: mapInstance.current,
      radius,
      opacity,
      gradient: [
        "rgba(0, 255, 255, 0)",
        "rgba(0, 255, 255, 1)",
        "rgba(0, 191, 255, 1)",
        "rgba(0, 127, 255, 1)",
        "rgba(0, 63, 255, 1)",
        "rgba(0, 0, 255, 1)",
        "rgba(0, 0, 223, 1)",
        "rgba(0, 0, 191, 1)",
        "rgba(0, 0, 159, 1)",
        "rgba(0, 0, 127, 1)",
        "rgba(63, 0, 91, 1)",
        "rgba(127, 0, 63, 1)",
        "rgba(191, 0, 31, 1)",
        "rgba(255, 0, 0, 1)",
      ],
    });
  }, [orders, mode, radius, opacity]);

  const initMap = useCallback(async () => {
    if (!window.google || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: HYDERABAD_CENTER,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        styles: customMapStyles,
      });
    }

    await resolveCoordinates();
    updateHeatmap();
  }, [resolveCoordinates, updateHeatmap]);

  // Load Google Maps
  useEffect(() => {
    if (!window.google) {
      const existing = document.querySelector(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      );
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
  }, [mode, radius, opacity, updateHeatmap]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-slate-800">Order Heat Map</h3>
          </div>
          {geocoding && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Geocoding {geocodeProgress.done}/{geocodeProgress.total}...
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Mode:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              <button
                onClick={() => setMode("density")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "density"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Order Density
              </button>
              <button
                onClick={() => setMode("revenue")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "revenue"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Revenue Weight
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Radius: {radius}</span>
            <input
              type="range"
              min={10}
              max={80}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="w-24 accent-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              Opacity: {Math.round(opacity * 100)}%
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={opacity * 100}
              onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
              className="w-24 accent-emerald-600"
            />
          </div>
        </div>
      </div>

      <div ref={mapRef} className="h-[500px] w-full bg-slate-100" />
    </div>
  );
}
