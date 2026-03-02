"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, Navigation, Search, AlertCircle } from "lucide-react";

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

// Clean single-line SVG for custom marker (no whitespace issues on mobile)
const MARKER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C8.95 0 0 8.95 0 20c0 14 20 32 20 32s20-18 20-32C40 8.95 31.05 0 20 0z" fill="#059669"/><circle cx="20" cy="18" r="8" fill="white"/></svg>';

// Custom Brand Styling for the map (Dark Green UI elements)
const customMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8e2" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] }
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

    // Use refs for map objects to avoid stale closures and double-init issues
    const gMapRef = useRef<any>(null);
    const gMarkerRef = useRef<any>(null);
    const initDoneRef = useRef(false);

    const [address, setAddress] = useState("");
    const [structuredDetails, setStructuredDetails] = useState<LocationDetails>({ street: "", city: "", state: "", pincode: "" });
    const [loading, setLoading] = useState(false);

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

        return {
            street: street.replace(/,\s*$/, ""),
            city,
            state,
            pincode
        };
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

        // Guard: prevent React Strict Mode double-initialization
        if (initDoneRef.current && gMapRef.current) return;

        const initMap = () => {
            if (!window.google || !mapRef.current) return;

            // Double-check: if already initialized (race condition), skip
            if (initDoneRef.current && gMapRef.current) return;

            const gMap = new window.google.maps.Map(mapRef.current, {
                center: HYDERABAD_CENTER,
                zoom: 12,
                mapTypeControl: false,
                streetViewControl: false,
                gestureHandling: "greedy",
                styles: customMapStyles
            });

            // Delivery Radius Circle
            new window.google.maps.Circle({
                strokeColor: "#059669",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#10b981",
                fillOpacity: 0.1,
                map: gMap,
                center: HYDERABAD_CENTER,
                radius: MAX_DELIVERY_RADIUS_KM * 1000,
                clickable: false
            });

            const gMarker = new window.google.maps.Marker({
                position: HYDERABAD_CENTER,
                map: gMap,
                draggable: true,
                animation: window.google.maps.Animation.DROP,
                icon: {
                    url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(MARKER_SVG),
                    scaledSize: new window.google.maps.Size(40, 52),
                    anchor: new window.google.maps.Point(20, 52),
                },
            });

            // Store in refs immediately (before Autocomplete which may fail)
            gMapRef.current = gMap;
            gMarkerRef.current = gMarker;
            initDoneRef.current = true;

            // Map click — move pin to tapped location
            gMap.addListener("click", (e: any) => {
                gMarker.setPosition(e.latLng);
                geocodePosition(e.latLng);
            });

            // Marker drag — geocode new position
            gMarker.addListener("dragend", () => {
                geocodePosition(gMarker.getPosition());
            });

            // Trigger resize after modal slide-in animation so map registers taps correctly
            setTimeout(() => {
                window.google.maps.event.trigger(gMap, "resize");
            }, 300);

            // Autocomplete search — wrapped in try-catch because deprecated for new API keys (March 2025)
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
                    // Autocomplete not available (new API key after March 2025) — search bar won't auto-suggest
                    // but map click & drag still work fine
                    console.warn("Places Autocomplete unavailable — use map click/drag to select location");
                }
            }

            // High Accuracy Locate Me on start
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const myLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    gMap.setCenter(myLoc);
                    gMap.setZoom(15);
                    gMarker.setPosition(myLoc);
                    geocodePosition(myLoc);
                }, undefined, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
            }
        };

        if (!window.google) {
            // Prevent duplicate script injection (race condition on re-open)
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

        // Cleanup: reset initialization flag on unmount so re-open reinitializes properly
        return () => {
            initDoneRef.current = false;
            gMapRef.current = null;
            gMarkerRef.current = null;
        };
    }, [isOpen, geocodePosition, checkGeofence]);

    const handleLocateMe = useCallback(() => {
        if (navigator.geolocation && gMapRef.current && gMarkerRef.current) {
            setLoading(true);
            navigator.geolocation.getCurrentPosition(pos => {
                const l = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                gMapRef.current.panTo(l);
                gMapRef.current.setZoom(16);
                gMarkerRef.current.setPosition(l);
                geocodePosition(l);
            }, undefined, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        }
    }, [geocodePosition]);

    // Track if component is mounted (needed for createPortal with SSR/Next.js)
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const handleConfirm = () => {
        if (address && !isOutOfZone) {
            onLocationSelect(address, structuredDetails);
            onClose();
        }
    };

    if (!isOpen || !mounted) return null;

    // Render via portal directly into document.body to escape Radix Dialog's
    // pointer-events: none on <body>. Without this, the Sheet (Radix Dialog)
    // blocks ALL touch/click events on MapPicker because it's outside the dialog portal.
    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex flex-col md:p-8 justify-end md:justify-center items-center" style={{ pointerEvents: "auto" }}>
            <div className="bg-white w-full max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] md:max-h-[90vh] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">

                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-emerald-600" />
                            Pin your location
                        </h3>
                        <p className="text-xs text-slate-500">Drag the pin or tap on the map</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative z-10 bg-white border-b border-slate-100 p-3 shadow-sm flex items-center">
                    <div className="absolute left-6 text-slate-400"><Search className="w-5 h-5" /></div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search street, area or building..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm font-medium"
                    />
                </div>

                {/* Map container — flex-1 fills available height, touch-action prevents browser hijacking */}
                <div className="relative flex-1 min-h-[250px] w-full bg-slate-100" style={{ touchAction: "none" }}>
                    <div ref={mapRef} className="absolute inset-0 w-full h-full" />
                    <button
                        onClick={handleLocateMe}
                        className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg border border-slate-100 text-slate-700 hover:text-emerald-600 transition-colors z-10"
                        title="High Precision Locate Me"
                    >
                        <Navigation className="w-5 h-5" />
                    </button>

                    {/* Geofencing Warning Overlay */}
                    {isOutOfZone && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 flex items-center gap-2 rounded-full shadow-lg text-sm font-bold animate-in fade-in slide-in-from-top-4 z-10">
                            <AlertCircle className="w-4 h-4" />
                            Outside Delivery Zone ({distanceKm}km away)
                        </div>
                    )}
                </div>

                <div className="p-5 bg-white border-t border-slate-100">
                    <div className="flex gap-4 items-center">
                        <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0 border ${isOutOfZone ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            {isOutOfZone ? <AlertCircle className="w-6 h-6 text-red-600" /> : <MapPin className="w-6 h-6 text-emerald-600" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="font-bold text-slate-800 text-sm mb-1">Delivery Address</div>
                            <div className={`text-sm truncate ${isOutOfZone ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                                {loading ? "Locating with high precision..." :
                                    isOutOfZone ? "We currently do not deliver to this area." :
                                        address || "Search or click on the map"}
                            </div>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={!address || loading || isOutOfZone}
                            className={`px-6 py-3 rounded-xl font-bold transition-all shrink-0 shadow-md ${!address || loading || isOutOfZone
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/10'
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
