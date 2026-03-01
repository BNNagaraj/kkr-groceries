"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Order } from "@/types/order";
import { MapPin, Loader2 } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}

const HYDERABAD_CENTER = { lat: 17.385, lng: 78.4867 };
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const GEOCODE_CACHE_KEY = "kkr-geocode-cache";

const customMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8e2" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] },
];

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
  } catch {
    // Storage full — ignore
  }
}

interface Props {
  orders: Order[];
}

export default function OrderLocationMap({ orders }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });

  const resolveCoordinates = useCallback(
    async (
      ordersToResolve: Order[]
    ): Promise<Map<string, GeoCoord>> => {
      const result = new Map<string, GeoCoord>();
      const cache = loadGeocodeCache();
      const toGeocode: string[] = [];

      // First pass: use stored lat/lng or cached geocodes
      ordersToResolve.forEach((o) => {
        if (o.lat && o.lng) {
          result.set(o.id, { lat: o.lat, lng: o.lng });
        } else if (o.location && cache[o.location]) {
          result.set(o.id, cache[o.location]);
        } else if (o.location) {
          if (!toGeocode.includes(o.location)) {
            toGeocode.push(o.location);
          }
        }
      });

      // Geocode missing addresses
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
                  if (status === "OK" && results[0]) {
                    resolve(results[0]);
                  } else {
                    reject(new Error(status));
                  }
                }
              );
            });

            const coord: GeoCoord = {
              lat: response.geometry.location.lat(),
              lng: response.geometry.location.lng(),
            };
            cache[addr] = coord;

            // Map all orders with this address
            ordersToResolve.forEach((o) => {
              if (o.location === addr && !result.has(o.id)) {
                result.set(o.id, coord);
              }
            });
          } catch {
            // Skip failed geocodes
          }

          setGeocodeProgress({ done: i + 1, total: toGeocode.length });

          // Throttle: 50ms between requests
          if (i < toGeocode.length - 1) {
            await new Promise((r) => setTimeout(r, 50));
          }
        }

        saveGeocodeCache(cache);
        setGeocoding(false);
      }

      return result;
    },
    []
  );

  const initMapAndMarkers = useCallback(async () => {
    if (!window.google || !mapRef.current) return;

    // Create map
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: HYDERABAD_CENTER,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        styles: customMapStyles,
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }

    const map = mapInstance.current;
    const infoWindow = infoWindowRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Resolve coordinates
    const coords = await resolveCoordinates(orders);

    // Place markers
    orders.forEach((order) => {
      const coord = coords.get(order.id);
      if (!coord) return;

      const marker = new window.google.maps.Marker({
        position: coord,
        map,
        title: order.customerName || "Customer",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#059669",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        const date = order.timestamp || "";
        infoWindow.setContent(`
          <div style="min-width:180px;font-family:system-ui,sans-serif;padding:4px 0;">
            <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:4px;">
              ${order.customerName || "Customer"}
            </div>
            <div style="font-size:12px;color:#64748b;margin-bottom:2px;">
              📱 ${order.phone || "N/A"}
            </div>
            ${order.shopName ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px;">🏪 ${order.shopName}</div>` : ""}
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">
              📍 ${order.location || "N/A"}
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:4px;margin-top:4px;">
              <span style="font-weight:600;color:#059669;">${order.totalValue || "₹0"}</span>
              <span style="font-size:11px;color:#94a3b8;">${date}</span>
            </div>
          </div>
        `);
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds if we have markers
    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getPosition()));
      map.fitBounds(bounds);
      // Don't zoom in too much
      const listener = window.google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom() > 15) map.setZoom(15);
        window.google.maps.event.removeListener(listener);
      });
    }
  }, [orders, resolveCoordinates]);

  // Load Google Maps and init
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
        script.onload = () => initMapAndMarkers();
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", () => initMapAndMarkers());
        // If already loaded
        if (window.google) initMapAndMarkers();
      }
    } else {
      initMapAndMarkers();
    }
  }, [initMapAndMarkers]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-800">Buying Locations</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {orders.length} orders
          </span>
        </div>
        {geocoding && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Geocoding {geocodeProgress.done}/{geocodeProgress.total}...
          </div>
        )}
      </div>
      <div ref={mapRef} className="h-[500px] w-full bg-slate-100" />
    </div>
  );
}
