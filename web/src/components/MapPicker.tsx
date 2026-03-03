"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, Navigation, Search, AlertCircle, Crosshair, Maximize2 } from "lucide-react";

declare global {
    interface Window {
        google: any;
    }
}

export interface LocationDetails {
    street: string;
    city: string;
    state: string;
    pincode: string;
    lat?: number;
    lng?: number;
}

const HYDERABAD_CENTER = { lat: 17.3850, lng: 78.4867 };
const MAX_DELIVERY_RADIUS_KM = 50;

// ─── Branded 🥬 Map Pin SVG ────────────────────────────────────────────────
function createBrandedPin(color = "#059669", darkColor = "#064e3b") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="68" viewBox="0 0 52 68"><defs><filter id="s" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${darkColor}" flood-opacity="0.45"/></filter><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${darkColor}"/></linearGradient></defs><path d="M26 2C13.3 2 3 12.3 3 25c0 17 23 39 23 39s23-22 23-39C49 12.3 38.7 2 26 2z" fill="url(#g)" filter="url(#s)"/><circle cx="26" cy="23" r="13" fill="white" opacity="0.95"/><text x="26" y="29" text-anchor="middle" font-size="17">🥬</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ─── Premium Emerald Light Map Style ────────────────────────────────────────
const premiumLightStyle = [
    { elementType: "geometry", stylers: [{ color: "#f0fdf4" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#064e3b" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "simplified" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d1fae5" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d1fae5" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#a7f3d0" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#047857" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#a7f3d0" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#047857" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#065f46" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#bbf7d0" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#047857" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] },
    { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#f0fdf4" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#d1fae5" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#065f46" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#a7f3d0" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
];

export function MapPicker({
    isOpen,
    onClose,
    onLocationSelect
}: {
    isOpen: boolean;
    onClose: () => void;
    onLocationSelect: (address: string, details: LocationDetails) => void;
}) {
    const mapRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const gMapRef = useRef<any>(null);
    const gMarkerRef = useRef<any>(null);
    const initDoneRef = useRef(false);

    const [address, setAddress] = useState("");
    const [structuredDetails, setStructuredDetails] = useState<LocationDetails>({ street: "", city: "", state: "", pincode: "" });
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [isOutOfZone, setIsOutOfZone] = useState(false);
    const [distanceKm, setDistanceKm] = useState(0);

    const parseAddressComponents = (components: any[]) => {
        let street = "", city = "", state = "", pincode = "";
        components.forEach((c) => {
            if (c.types.includes("route") || c.types.includes("sublocality")) street += c.long_name + ", ";
            if (c.types.includes("locality")) city = c.long_name;
            if (c.types.includes("administrative_area_level_1")) state = c.long_name;
            if (c.types.includes("postal_code")) pincode = c.long_name;
        });
        return { street: street.replace(/,\s*$/, ""), city, state, pincode };
    };

    const checkGeofence = useCallback((pos: any) => {
        if (!window.google) return true;
        const center = new window.google.maps.LatLng(HYDERABAD_CENTER.lat, HYDERABAD_CENTER.lng);
        const current = new window.google.maps.LatLng(typeof pos.lat === 'function' ? pos.lat() : pos.lat, typeof pos.lng === 'function' ? pos.lng() : pos.lng);
        const distanceMeters = window.google.maps.geometry.spherical.computeDistanceBetween(center, current);
        const distanceKilo = distanceMeters / 1000;
        setDistanceKm(Math.round(distanceKilo * 10) / 10);
        if (distanceKilo > MAX_DELIVERY_RADIUS_KM) {
            setIsOutOfZone(true);
            return false;
        }
        setIsOutOfZone(false);
        return true;
    }, []);

    const geocodePosition = useCallback((pos: any) => {
        if (!window.google) return;
        setLoading(true);
        checkGeofence(pos);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: pos }, (results: any, status: string) => {
            setLoading(false);
            setLocating(false);
            if (status === "OK" && results[0]) {
                setAddress(results[0].formatted_address);
                if (searchInputRef.current) searchInputRef.current.value = results[0].formatted_address;
                const details = parseAddressComponents(results[0].address_components);
                const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
                const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
                setStructuredDetails({ ...details, lat, lng });
            } else {
                setAddress("Location not found");
            }
        });
    }, [checkGeofence]);

    useEffect(() => {
        if (!isOpen) return;
        if (initDoneRef.current && gMapRef.current) return;

        const initMap = () => {
            if (!window.google || !mapRef.current) return;
            if (initDoneRef.current && gMapRef.current) return;

            const gMap = new window.google.maps.Map(mapRef.current, {
                center: HYDERABAD_CENTER,
                zoom: 12,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
                gestureHandling: "greedy",
                styles: premiumLightStyle,
                backgroundColor: "#f0fdf4",
            });

            // Delivery Radius — outer glow circle
            new window.google.maps.Circle({
                strokeColor: "#059669",
                strokeOpacity: 0.3,
                strokeWeight: 1.5,
                fillColor: "#10b981",
                fillOpacity: 0.04,
                map: gMap,
                center: HYDERABAD_CENTER,
                radius: MAX_DELIVERY_RADIUS_KM * 1000,
                clickable: false,
            });

            // Inner dashed-feel ring at center
            new window.google.maps.Circle({
                strokeColor: "#059669",
                strokeOpacity: 0.15,
                strokeWeight: 1,
                fillColor: "transparent",
                fillOpacity: 0,
                map: gMap,
                center: HYDERABAD_CENTER,
                radius: MAX_DELIVERY_RADIUS_KM * 500,
                clickable: false,
            });

            const gMarker = new window.google.maps.Marker({
                position: HYDERABAD_CENTER,
                map: gMap,
                draggable: true,
                animation: window.google.maps.Animation.DROP,
                title: "Drag to your delivery location",
                icon: {
                    url: createBrandedPin("#059669", "#064e3b"),
                    scaledSize: new window.google.maps.Size(48, 63),
                    anchor: new window.google.maps.Point(24, 63),
                },
            });

            gMapRef.current = gMap;
            gMarkerRef.current = gMarker;
            initDoneRef.current = true;

            gMap.addListener("click", (e: any) => {
                gMarker.setPosition(e.latLng);
                geocodePosition(e.latLng);
            });

            gMarker.addListener("dragend", () => {
                geocodePosition(gMarker.getPosition());
            });

            setTimeout(() => {
                window.google.maps.event.trigger(gMap, "resize");
            }, 300);

            // Autocomplete search
            if (searchInputRef.current) {
                try {
                    const gAutocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
                        componentRestrictions: { country: "in" },
                        fields: ["formatted_address", "geometry", "address_components"],
                    });
                    gAutocomplete.bindTo("bounds", gMap);
                    gAutocomplete.addListener("place_changed", () => {
                        const place = gAutocomplete.getPlace();
                        if (!place.geometry || !place.geometry.location) return;
                        gMap.setCenter(place.geometry.location);
                        gMap.setZoom(16);
                        gMarker.setPosition(place.geometry.location);
                        checkGeofence(place.geometry.location);
                        setAddress(place.formatted_address || "");
                        const placeDetails = parseAddressComponents(place.address_components || []);
                        setStructuredDetails({
                            ...placeDetails,
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                        });
                    });
                } catch {
                    console.warn("Places Autocomplete unavailable — use map click/drag to select location");
                }
            }

            // High Accuracy Locate Me on start
            if (navigator.geolocation) {
                setLocating(true);
                navigator.geolocation.getCurrentPosition((pos) => {
                    const myLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    gMap.setCenter(myLoc);
                    gMap.setZoom(15);
                    gMarker.setPosition(myLoc);
                    geocodePosition(myLoc);
                }, () => setLocating(false), { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
            }
        };

        if (!window.google) {
            const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
            if (existing) {
                existing.addEventListener("load", initMap);
            } else {
                const script = document.createElement("script");
                script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places,geometry,visualization`;
                script.async = true;
                script.defer = true;
                script.onload = initMap;
                document.head.appendChild(script);
            }
        } else {
            initMap();
        }

        return () => {
            initDoneRef.current = false;
            gMapRef.current = null;
            gMarkerRef.current = null;
        };
    }, [isOpen, geocodePosition, checkGeofence]);

    const handleLocateMe = useCallback(() => {
        if (navigator.geolocation && gMapRef.current && gMarkerRef.current) {
            setLocating(true);
            setLoading(true);
            navigator.geolocation.getCurrentPosition(pos => {
                const l = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                gMapRef.current.panTo(l);
                gMapRef.current.setZoom(16);
                gMarkerRef.current.setPosition(l);
                geocodePosition(l);
            }, () => { setLocating(false); setLoading(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        }
    }, [geocodePosition]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const handleConfirm = () => {
        if (address && !isOutOfZone) {
            onLocationSelect(address, structuredDetails);
            onClose();
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex flex-col md:p-6 justify-end md:justify-center items-center" style={{ pointerEvents: "auto" }}>
            <div className="bg-white w-full max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] md:max-h-[92vh] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">

                {/* ── Header ────────────────────────────────────────── */}
                <div className="px-5 py-4 border-b border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2.5">
                            <span className="text-xl">🥬</span>
                            Pin your delivery location
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Drag the pin or search for your address</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Search Bar ─────────────────────────────────────── */}
                <div className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-emerald-50 px-4 py-3">
                    <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500"><Search className="w-4 h-4" /></div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search street, area or landmark..."
                            className="w-full pl-10 pr-4 py-3 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-300 focus:bg-white transition-all text-sm font-medium placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* ── Map Container ──────────────────────────────────── */}
                <div className="relative flex-1 min-h-[280px] w-full bg-emerald-50" style={{ touchAction: "none" }}>
                    <div ref={mapRef} className="absolute inset-0 w-full h-full" />

                    {/* Floating Distance Badge */}
                    {address && !isOutOfZone && distanceKm > 0 && (
                        <div className="absolute bottom-20 left-3 bg-white/90 backdrop-blur-md border border-emerald-200/60 text-emerald-700 px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-1.5 z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <MapPin className="w-3 h-3" />
                            {distanceKm} km away
                        </div>
                    )}

                    {/* Locate Me FAB */}
                    <button
                        onClick={handleLocateMe}
                        className={`absolute bottom-4 right-4 w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center z-10 transition-all duration-300 ${
                            locating
                                ? "bg-emerald-50 border-emerald-400 text-emerald-600 animate-pulse shadow-emerald-200"
                                : "bg-white border-emerald-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 hover:shadow-emerald-100"
                        }`}
                        title="Locate me with GPS"
                    >
                        <Navigation className={`w-5 h-5 ${locating ? "animate-spin" : ""}`} style={locating ? { animationDuration: "2s" } : undefined} />
                    </button>

                    {/* Geofencing Warning */}
                    {isOutOfZone && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-2.5 flex items-center gap-2 rounded-2xl shadow-xl shadow-red-500/20 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 z-10">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Outside Delivery Zone • {distanceKm}km away
                        </div>
                    )}
                </div>

                {/* ── Bottom Confirm Bar ─────────────────────────────── */}
                <div className="px-5 py-4 bg-white/95 backdrop-blur-sm border-t border-emerald-100">
                    <div className="flex gap-4 items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                            isOutOfZone
                                ? "bg-red-50 border border-red-200 text-red-500"
                                : address
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
                                    : "bg-slate-50 border border-slate-200 text-slate-400"
                        }`}>
                            {isOutOfZone
                                ? <AlertCircle className="w-5 h-5" />
                                : address
                                    ? <span className="text-lg">🥬</span>
                                    : <MapPin className="w-5 h-5" />
                            }
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                            <div className="font-bold text-slate-800 text-sm mb-0.5">
                                {loading ? "Finding your location..." : isOutOfZone ? "Outside delivery area" : address ? "Delivery Address" : "Select location"}
                            </div>
                            <div className={`text-xs truncate ${isOutOfZone ? "text-red-500 font-medium" : "text-slate-400"}`}>
                                {loading ? "Using high-precision GPS..." :
                                    isOutOfZone ? `We deliver within ${MAX_DELIVERY_RADIUS_KM}km of Hyderabad` :
                                        address || "Tap map, drag pin, or search above"}
                            </div>
                            {address && !isOutOfZone && structuredDetails.city && (
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600">
                                    {structuredDetails.city && <span className="bg-emerald-50 px-2 py-0.5 rounded-md font-medium">{structuredDetails.city}</span>}
                                    {structuredDetails.pincode && <span className="bg-emerald-50 px-2 py-0.5 rounded-md font-medium">{structuredDetails.pincode}</span>}
                                    {structuredDetails.state && <span className="text-emerald-400">{structuredDetails.state}</span>}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={!address || loading || isOutOfZone}
                            className={`px-6 py-3 rounded-2xl font-bold transition-all shrink-0 text-sm ${
                                !address || loading || isOutOfZone
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98]"
                            }`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
