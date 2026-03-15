"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, X, Navigation, Search, AlertCircle, Hash, Copy, Check, LocateFixed, Map, Clock, ChevronRight } from "lucide-react";
import MapStyleSettings, { buildMapStyles, loadMapSettings } from "./MapStyleSettings";

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

export interface RecentLocation {
    id: string;
    label: string;
    address: string;
    lat?: number;
    lng?: number;
    pincode?: string;
}

const HYDERABAD_CENTER = { lat: 17.3850, lng: 78.4867 };
const MAX_DELIVERY_RADIUS_KM = 50;
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

// ─── Two-phase location picker ──────────────────────────────────────────────
//
//   Flow diagram:
//   ┌────────────────────────────────────────────────────────────────────────┐
//   │  MapPicker opens                                                       │
//   │       │                                                                │
//   │       ▼                                                                │
//   │  ┌──────────────┐   GPS succeeds   ┌──────────────────┐               │
//   │  │  GPS Phase   │ ───────────────►  │ Show address +   │──► Confirm   │
//   │  │  (default)   │                   │ static map       │               │
//   │  └──────┬───────┘                   └────────┬─────────┘               │
//   │         │                                    │                         │
//   │         │ GPS fails/denied                   │ "Use different"         │
//   │         │ OR user taps "Choose on Map"       │                         │
//   │         ▼                                    ▼                         │
//   │  ┌──────────────────────────────────────────────────┐                  │
//   │  │  Manual Phase (full map + search + drag pin)     │──► Confirm      │
//   │  │  Shows recent locations as quick-pick chips      │                  │
//   │  └──────────────────────────────────────────────────┘                  │
//   └────────────────────────────────────────────────────────────────────────┘
//

// ─── Input detection helpers ────────────────────────────────────────────────
const COORD_REGEX = /^\s*(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)\s*$/;
const PLUS_CODE_REGEX = /^[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}(\s+.*)?$/i;

function parseCoordinates(input: string): { lat: number; lng: number } | null {
    const match = input.match(COORD_REGEX);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
}

function isPlusCode(input: string): boolean {
    return PLUS_CODE_REGEX.test(input.trim());
}

type SearchMode = "search" | "coords" | "pluscode";

// ─── Branded Map Pin SVG ────────────────────────────────────────────────
function createBrandedPin(color = "#059669", darkColor = "#064e3b") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="68" viewBox="0 0 52 68"><defs><filter id="s" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${darkColor}" flood-opacity="0.45"/></filter><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${darkColor}"/></linearGradient></defs><path d="M26 2C13.3 2 3 12.3 3 25c0 17 23 39 23 39s23-22 23-39C49 12.3 38.7 2 26 2z" fill="url(#g)" filter="url(#s)"/><circle cx="26" cy="23" r="13" fill="white" opacity="0.95"/><text x="26" y="29" text-anchor="middle" font-size="17">🥬</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ─── Static map preview URL ─────────────────────────────────────────────
function staticMapUrl(lat: number, lng: number, zoom = 15, w = 400, h = 200) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&scale=2&markers=color:green%7C${lat},${lng}&key=${GOOGLE_MAPS_KEY}`;
}


export function MapPicker({
    isOpen,
    onClose,
    onLocationSelect,
    recentLocations = [],
}: {
    isOpen: boolean;
    onClose: () => void;
    onLocationSelect: (address: string, details: LocationDetails) => void;
    recentLocations?: RecentLocation[];
}) {
    // ─── Phase: "gps" (default) or "manual" (full map) ────────────────
    const [phase, setPhase] = useState<"gps" | "manual">("gps");
    const [gpsStatus, setGpsStatus] = useState<"detecting" | "success" | "denied" | "error">("detecting");

    const mapRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const gMapRef = useRef<any>(null);
    const gMarkerRef = useRef<any>(null);
    const initDoneRef = useRef(false);
    const autocompleteRef = useRef<any>(null);

    const [address, setAddress] = useState("");
    const [structuredDetails, setStructuredDetails] = useState<LocationDetails>({ street: "", city: "", state: "", pincode: "" });
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [isOutOfZone, setIsOutOfZone] = useState(false);
    const [distanceKm, setDistanceKm] = useState(0);
    const [mapObj, setMapObj] = useState<any>(null);
    const [searchMode, setSearchMode] = useState<SearchMode>("search");
    const [copied, setCopied] = useState(false);
    const [searchError, setSearchError] = useState("");

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setPhase("gps");
            setGpsStatus("detecting");
            setAddress("");
            setStructuredDetails({ street: "", city: "", state: "", pincode: "" });
            setIsOutOfZone(false);
            setDistanceKm(0);
            setSearchError("");
            setSearchMode("search");
        }
    }, [isOpen]);

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
        setSearchError("");
        checkGeofence(pos);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: pos }, (results: any, status: string) => {
            setLoading(false);
            setLocating(false);
            if (status === "OK" && results[0]) {
                setAddress(results[0].formatted_address);
                if (searchInputRef.current && searchMode === "search") {
                    searchInputRef.current.value = results[0].formatted_address;
                }
                const details = parseAddressComponents(results[0].address_components);
                const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
                const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
                setStructuredDetails({ ...details, lat, lng });
            } else {
                setAddress("Location not found");
            }
        });
    }, [checkGeofence, searchMode]);

    // ─── GPS Phase: auto-detect on open ────────────────────────────────
    useEffect(() => {
        if (!isOpen || phase !== "gps") return;

        // Load Google Maps script if needed (for geocoding GPS result)
        const ensureGoogle = (cb: () => void) => {
            if (window.google) { cb(); return; }
            const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
            if (existing) {
                existing.addEventListener("load", cb);
            } else {
                const script = document.createElement("script");
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry,visualization`;
                script.async = true;
                script.defer = true;
                script.onload = cb;
                document.head.appendChild(script);
            }
        };

        if (!navigator.geolocation) {
            setGpsStatus("denied");
            return;
        }

        setGpsStatus("detecting");
        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const myLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                ensureGoogle(() => {
                    // Check geofence
                    checkGeofence(myLoc);
                    // Geocode to get address
                    setLoading(true);
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: myLoc }, (results: any, status: string) => {
                        setLoading(false);
                        setLocating(false);
                        if (status === "OK" && results[0]) {
                            setAddress(results[0].formatted_address);
                            const details = parseAddressComponents(results[0].address_components);
                            setStructuredDetails({ ...details, lat: myLoc.lat, lng: myLoc.lng });
                            setGpsStatus("success");
                        } else {
                            setGpsStatus("error");
                        }
                    });
                });
            },
            () => {
                setLocating(false);
                setGpsStatus("denied");
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }, [isOpen, phase, checkGeofence]);

    // ─── Move pin to specific coordinates ────────────────────────────
    const moveToLocation = useCallback((lat: number, lng: number) => {
        if (!gMapRef.current || !gMarkerRef.current) return;
        const pos = { lat, lng };
        gMapRef.current.panTo(pos);
        gMapRef.current.setZoom(16);
        gMarkerRef.current.setPosition(pos);
        geocodePosition(pos);
    }, [geocodePosition]);

    // ─── Handle coordinate/pluscode/address search on Enter ──────────
    const handleSearchSubmit = useCallback(() => {
        const input = searchInputRef.current?.value?.trim();
        if (!input) return;
        setSearchError("");

        const coords = parseCoordinates(input);
        if (coords) { moveToLocation(coords.lat, coords.lng); return; }

        if (isPlusCode(input)) {
            if (!window.google) return;
            setLoading(true);
            const geocoder = new window.google.maps.Geocoder();
            const plusCodeQuery = input.includes(" ") ? input : `${input} Hyderabad`;
            geocoder.geocode({ address: plusCodeQuery }, (results: any, status: string) => {
                setLoading(false);
                if (status === "OK" && results[0]?.geometry?.location) {
                    const loc = results[0].geometry.location;
                    moveToLocation(loc.lat(), loc.lng());
                } else {
                    setSearchError("Plus Code not found. Try adding city name: 7J9W+PG Hyderabad");
                }
            });
            return;
        }

        if (!window.google) return;
        setLoading(true);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: input + ", India" }, (results: any, status: string) => {
            setLoading(false);
            if (status === "OK" && results[0]?.geometry?.location) {
                const loc = results[0].geometry.location;
                moveToLocation(loc.lat(), loc.lng());
            } else {
                setSearchError("Location not found. Try a different search.");
            }
        });
    }, [moveToLocation]);

    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (autocompleteRef.current) {
                setTimeout(() => {
                    const input = searchInputRef.current?.value?.trim();
                    if (!input) return;
                    if (parseCoordinates(input) || isPlusCode(input)) {
                        handleSearchSubmit();
                    }
                }, 100);
            } else {
                handleSearchSubmit();
            }
        }
    }, [handleSearchSubmit]);

    const handleSearchInput = useCallback(() => {
        const val = searchInputRef.current?.value?.trim() || "";
        setSearchError("");
        if (parseCoordinates(val)) setSearchMode("coords");
        else if (isPlusCode(val)) setSearchMode("pluscode");
        else setSearchMode("search");
    }, []);

    const handleCopyCoords = useCallback(() => {
        if (!structuredDetails.lat || !structuredDetails.lng) return;
        const text = `${structuredDetails.lat.toFixed(4)}, ${structuredDetails.lng.toFixed(4)}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [structuredDetails]);

    const handleClearSearch = useCallback(() => {
        if (searchInputRef.current) {
            searchInputRef.current.value = "";
            searchInputRef.current.focus();
        }
        setSearchMode("search");
        setSearchError("");
    }, []);

    // ─── Fix Google Places Autocomplete dropdown click/touch ──────────
    //
    //   Problem: Google Places Autocomplete appends .pac-container to
    //   document.body. MapPicker's fixed overlay (z-[300]) sits on top,
    //   intercepting pointer events so the user can't tap suggestions.
    //
    //   Fix: Inject a style rule that lifts .pac-container above everything
    //   and add a mousedown/touchstart listener that stops the overlay from
    //   swallowing the event.
    useEffect(() => {
        if (!isOpen || phase !== "manual") return;

        const styleId = "__pac-container-fix__";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `.pac-container { z-index: 99999 !important; pointer-events: auto !important; }`;
            document.head.appendChild(style);
        }

        // Stop the MapPicker overlay from eating mousedown/touchstart on .pac-container items
        const handler = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest(".pac-container")) {
                e.stopPropagation();
            }
        };
        document.addEventListener("mousedown", handler, true);
        document.addEventListener("touchstart", handler, true);

        return () => {
            document.removeEventListener("mousedown", handler, true);
            document.removeEventListener("touchstart", handler, true);
        };
    }, [isOpen, phase]);

    // ─── Manual phase: initialize full Google Map ─────────────────────
    //
    //   Render inline (no portal) — rendered inside Radix SheetContent
    //   so MapPicker's inputs stay within the focus scope.
    //   position:fixed escapes layout/overflow but stays in focus scope.

    useEffect(() => {
        if (!isOpen || phase !== "manual") return;
        if (initDoneRef.current && gMapRef.current) return;

        const initMap = () => {
            if (!window.google || !mapRef.current) return;
            if (initDoneRef.current && gMapRef.current) return;

            // Start map at GPS location if we have it, otherwise Hyderabad center
            const startCenter = (structuredDetails.lat && structuredDetails.lng)
                ? { lat: structuredDetails.lat, lng: structuredDetails.lng }
                : HYDERABAD_CENTER;
            const startZoom = (structuredDetails.lat && structuredDetails.lng) ? 15 : 12;

            const gMap = new window.google.maps.Map(mapRef.current, {
                center: startCenter,
                zoom: startZoom,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
                gestureHandling: "greedy",
                styles: (() => { try { return buildMapStyles(loadMapSettings()); } catch { return []; } })(),
            });

            new window.google.maps.Circle({
                strokeColor: "#059669",
                strokeOpacity: 0.6,
                strokeWeight: 2,
                fillColor: "#10b981",
                fillOpacity: 0.02,
                map: gMap,
                center: HYDERABAD_CENTER,
                radius: MAX_DELIVERY_RADIUS_KM * 1000,
                clickable: false,
            });

            const gMarker = new window.google.maps.Marker({
                position: startCenter,
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
            setMapObj(gMap);

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
                    autocompleteRef.current = gAutocomplete;
                    gAutocomplete.addListener("place_changed", () => {
                        const place = gAutocomplete.getPlace();
                        if (!place.geometry || !place.geometry.location) return;
                        gMap.setCenter(place.geometry.location);
                        gMap.setZoom(16);
                        gMarker.setPosition(place.geometry.location);
                        checkGeofence(place.geometry.location);
                        setAddress(place.formatted_address || "");
                        setSearchError("");
                        const placeDetails = parseAddressComponents(place.address_components || []);
                        setStructuredDetails({
                            ...placeDetails,
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                        });
                    });
                } catch {
                    console.warn("Places Autocomplete unavailable");
                }
            }

            // If entering manual without a GPS fix, auto-locate
            if (!structuredDetails.lat && navigator.geolocation) {
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
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry,visualization`;
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
            autocompleteRef.current = null;
            setMapObj(null);
        };
    }, [isOpen, phase, geocodePosition, checkGeofence]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleConfirm = () => {
        if (address && !isOutOfZone) {
            onLocationSelect(address, structuredDetails);
            onClose();
        }
    };

    // Select a recent location directly (skip map)
    const handleSelectRecent = (loc: RecentLocation) => {
        const details: LocationDetails = {
            street: "",
            city: "",
            state: "",
            pincode: loc.pincode || "",
            lat: loc.lat,
            lng: loc.lng,
        };
        onLocationSelect(loc.address, details);
        onClose();
    };

    // Switch to manual and optionally jump to a location
    const goManual = (lat?: number, lng?: number) => {
        if (lat && lng) {
            // Pre-set so the map initializes at this position
            setStructuredDetails(prev => ({ ...prev, lat, lng }));
        }
        setPhase("manual");
    };

    const placeholderText = searchMode === "coords"
        ? "Press Enter to go to coordinates"
        : searchMode === "pluscode"
            ? "Press Enter to go to Plus Code location"
            : "Search address, paste coordinates, or Plus Code...";

    // SSR-safe guard
    if (!isOpen || typeof document === "undefined") return null;

    // ─────────────────────────────────────────────────────────────────────
    //  GPS PHASE — compact, no full map
    // ─────────────────────────────────────────────────────────────────────
    if (phase === "gps") {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex flex-col justify-end md:justify-center items-center md:p-6" style={{ pointerEvents: "auto" }}>
                <div className="bg-white w-full max-w-md md:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2.5">
                                <span className="text-xl">🥬</span>
                                Delivery Location
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">We'll deliver your fresh vegetables here</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

                        {/* GPS Detection Card */}
                        {gpsStatus === "detecting" && (
                            <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-5 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <Navigation className="w-5 h-5 text-emerald-600 animate-spin" style={{ animationDuration: "2s" }} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-emerald-800 text-sm">Detecting your location...</div>
                                        <div className="text-xs text-emerald-600 mt-0.5">Using high-precision GPS</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* GPS Success Card */}
                        {gpsStatus === "success" && address && (
                            <div className="space-y-3 animate-in fade-in duration-300">
                                {/* Static map preview */}
                                {structuredDetails.lat && structuredDetails.lng && (
                                    <div className="rounded-2xl overflow-hidden border border-emerald-200/60 shadow-sm">
                                        <img
                                            src={staticMapUrl(structuredDetails.lat, structuredDetails.lng)}
                                            alt="Location preview"
                                            className="w-full h-[160px] object-cover"
                                            loading="eager"
                                        />
                                    </div>
                                )}

                                {/* Address info */}
                                <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                            <MapPin className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 text-sm">Your Current Location</div>
                                            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{address}</div>
                                            {structuredDetails.city && (
                                                <div className="flex items-center gap-1.5 mt-2 text-xs">
                                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-medium">{structuredDetails.city}</span>
                                                    {structuredDetails.pincode && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-medium">{structuredDetails.pincode}</span>}
                                                </div>
                                            )}
                                            {distanceKm > 0 && !isOutOfZone && (
                                                <div className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {distanceKm} km from Hyderabad center
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Out of zone warning */}
                                {isOutOfZone && (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <div className="font-bold text-red-700 text-sm">Outside Delivery Zone</div>
                                            <div className="text-xs text-red-500 mt-0.5">We deliver within {MAX_DELIVERY_RADIUS_KM}km of Hyderabad. Try a different location.</div>
                                        </div>
                                    </div>
                                )}

                                {/* Confirm button */}
                                <button
                                    onClick={handleConfirm}
                                    disabled={isOutOfZone}
                                    className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all ${
                                        isOutOfZone
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                            : "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98]"
                                    }`}
                                >
                                    Confirm This Location
                                </button>

                                {/* Choose different */}
                                <button
                                    onClick={() => goManual(structuredDetails.lat, structuredDetails.lng)}
                                    className="w-full py-2.5 text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Map className="w-4 h-4" />
                                    Use a different location
                                </button>
                            </div>
                        )}

                        {/* GPS Failed/Denied */}
                        {(gpsStatus === "denied" || gpsStatus === "error") && (
                            <div className="space-y-3 animate-in fade-in duration-300">
                                <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                        <AlertCircle className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">
                                            {gpsStatus === "denied" ? "GPS Permission Denied" : "Couldn't detect location"}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {gpsStatus === "denied"
                                                ? "Allow location access in browser settings, or choose manually"
                                                : "Please select your location manually"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent Locations — shown when GPS fails OR always as alternative */}
                        {recentLocations.length > 0 && (gpsStatus === "denied" || gpsStatus === "error" || gpsStatus === "success") && (
                            <div className="space-y-2 animate-in fade-in duration-300">
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase tracking-wider px-1">
                                    <Clock className="w-3 h-3" />
                                    Recent Locations
                                </div>
                                {recentLocations.map((loc) => (
                                    <button
                                        key={loc.id}
                                        onClick={() => handleSelectRecent(loc)}
                                        className="w-full text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200/60 hover:border-emerald-200 rounded-xl p-3.5 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0 border border-slate-200 group-hover:border-emerald-300 transition-colors">
                                                <MapPin className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {loc.label && <div className="font-semibold text-slate-700 text-sm truncate">{loc.label}</div>}
                                                <div className="text-xs text-slate-400 truncate mt-0.5">{loc.address}</div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 shrink-0 transition-colors" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Choose on Map button — always visible after GPS resolves */}
                        {(gpsStatus === "denied" || gpsStatus === "error") && (
                            <button
                                onClick={() => goManual()}
                                className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Map className="w-4 h-4" />
                                Choose on Map
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    //  MANUAL PHASE — full interactive map
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex flex-col md:p-6 justify-end md:justify-center items-center" style={{ pointerEvents: "auto" }}>
            <div className="bg-white w-full max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] md:max-h-[92vh] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">

                {/* ── Header ────────────────────────────────────────── */}
                <div className="px-5 py-4 border-b border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2.5">
                            <span className="text-xl">🥬</span>
                            Choose Location
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Search, paste coordinates, Plus Code, or drag the pin</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Smart Search Bar ─────────────────────────────── */}
                <div className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-emerald-50 px-4 py-3">
                    <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500">
                            {searchMode === "coords" ? <Hash className="w-4 h-4" /> :
                             searchMode === "pluscode" ? <LocateFixed className="w-4 h-4" /> :
                             <Search className="w-4 h-4" />}
                        </div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={placeholderText}
                            onKeyDown={handleSearchKeyDown}
                            onInput={handleSearchInput}
                            className={`w-full pl-10 pr-20 py-3 border rounded-2xl focus:outline-none focus:ring-2 transition-all text-sm font-medium placeholder:text-slate-400 ${
                                searchMode === "coords"
                                    ? "bg-blue-50/50 border-blue-200/60 focus:ring-blue-500/40 focus:border-blue-300 focus:bg-white"
                                    : searchMode === "pluscode"
                                        ? "bg-purple-50/50 border-purple-200/60 focus:ring-purple-500/40 focus:border-purple-300 focus:bg-white"
                                        : "bg-emerald-50/50 border-emerald-200/60 focus:ring-emerald-500/40 focus:border-emerald-300 focus:bg-white"
                            }`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {(searchMode === "coords" || searchMode === "pluscode") && (
                                <button
                                    onClick={handleSearchSubmit}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all ${
                                        searchMode === "coords"
                                            ? "bg-blue-500 hover:bg-blue-600"
                                            : "bg-purple-500 hover:bg-purple-600"
                                    }`}
                                >
                                    Go
                                </button>
                            )}
                            {searchInputRef.current?.value && (
                                <button
                                    onClick={handleClearSearch}
                                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Smart detection hints */}
                    {searchMode === "coords" && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 animate-in fade-in duration-200">
                            <Hash className="w-3 h-3" />
                            <span>Coordinates detected — press <kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-[10px]">Enter</kbd> or <span className="font-semibold">Go</span></span>
                        </div>
                    )}
                    {searchMode === "pluscode" && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 animate-in fade-in duration-200">
                            <LocateFixed className="w-3 h-3" />
                            <span>Plus Code detected — press <kbd className="bg-purple-100 px-1.5 py-0.5 rounded font-mono text-[10px]">Enter</kbd> or <span className="font-semibold">Go</span></span>
                        </div>
                    )}

                    {searchError && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500 animate-in fade-in duration-200">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{searchError}</span>
                        </div>
                    )}

                    {/* Recent location chips (compact, in search bar area) */}
                    {recentLocations.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Recent:</span>
                            {recentLocations.slice(0, 3).map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => {
                                        if (loc.lat && loc.lng) {
                                            moveToLocation(loc.lat, loc.lng);
                                        } else if (searchInputRef.current) {
                                            searchInputRef.current.value = loc.address;
                                            searchInputRef.current.focus();
                                            handleSearchSubmit();
                                        }
                                    }}
                                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50/50 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors font-medium truncate max-w-[180px]"
                                    title={loc.address}
                                >
                                    <Clock className="w-2.5 h-2.5 inline mr-1 opacity-50" />
                                    {loc.label || loc.address.split(",")[0]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Map Container ──────────────────────────────────── */}
                <div className="relative flex-1 min-h-[280px] w-full bg-gray-100" style={{ touchAction: "none" }}>
                    <div ref={mapRef} className="absolute inset-0 w-full h-full" />

                    {mapObj && <MapStyleSettings mapInstance={mapObj} position="top-left" />}

                    {/* Floating Distance Badge */}
                    {address && !isOutOfZone && distanceKm > 0 && (
                        <div className="absolute bottom-20 left-3 bg-white/90 backdrop-blur-md border border-emerald-200/60 text-emerald-700 px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-1.5 z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <MapPin className="w-3 h-3" />
                            {distanceKm} km away
                        </div>
                    )}

                    {/* Floating Coordinates Badge */}
                    {structuredDetails.lat != null && structuredDetails.lng != null && address && !isOutOfZone && (
                        <button
                            onClick={handleCopyCoords}
                            title="Copy coordinates"
                            className="absolute top-3 right-3 bg-white/90 backdrop-blur-md border border-slate-200/60 text-slate-600 px-3 py-1.5 rounded-full shadow-lg text-xs font-mono flex items-center gap-1.5 z-10 hover:bg-white hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer animate-in fade-in duration-300"
                        >
                            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copied!" : `${structuredDetails.lat.toFixed(4)}, ${structuredDetails.lng.toFixed(4)}`}
                        </button>
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
                                        address || "Tap map, drag pin, search, or paste coordinates"}
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
        </div>
    );
}
