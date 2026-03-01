"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Save, MapPin, Store, FileText, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DeliverySettings,
  BusinessSettings,
  CheckoutFormSettings,
  CustomField,
  DEFAULT_DELIVERY,
  DEFAULT_BUSINESS,
  DEFAULT_CHECKOUT,
} from "@/types/settings";

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

const customMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8e2" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] },
];

export default function SettingsTab() {
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [business, setBusiness] = useState<BusinessSettings>(DEFAULT_BUSINESS);
  const [checkout, setCheckout] = useState<CheckoutFormSettings>(DEFAULT_CHECKOUT);
  const [loading, setLoading] = useState(true);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingCheckout, setSavingCheckout] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const circleInstance = useRef<any>(null);

  // Load all settings
  useEffect(() => {
    (async () => {
      try {
        const [dSnap, bSnap, cSnap] = await Promise.all([
          getDoc(doc(db, "settings", "delivery")),
          getDoc(doc(db, "settings", "business")),
          getDoc(doc(db, "settings", "checkout")),
        ]);
        if (dSnap.exists()) setDelivery({ ...DEFAULT_DELIVERY, ...dSnap.data() });
        if (bSnap.exists()) setBusiness({ ...DEFAULT_BUSINESS, ...bSnap.data() });
        if (cSnap.exists()) setCheckout({ ...DEFAULT_CHECKOUT, ...cSnap.data() });
      } catch (e) {
        console.error("[Settings] Failed to load:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Initialize Google Map for delivery zone
  const initMap = useCallback(() => {
    if (!window.google || !mapRef.current || mapInstance.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: delivery.centerLat, lng: delivery.centerLng },
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      styles: customMapStyles,
    });

    const marker = new window.google.maps.Marker({
      position: { lat: delivery.centerLat, lng: delivery.centerLng },
      map,
      draggable: true,
      title: "Delivery center",
    });

    const circle = new window.google.maps.Circle({
      strokeColor: "#059669",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#10b981",
      fillOpacity: 0.1,
      map,
      center: { lat: delivery.centerLat, lng: delivery.centerLng },
      radius: delivery.radiusKm * 1000,
      clickable: false,
    });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      const lat = pos.lat();
      const lng = pos.lng();
      setDelivery((prev) => ({ ...prev, centerLat: lat, centerLng: lng }));
      circle.setCenter({ lat, lng });
    });

    mapInstance.current = map;
    markerInstance.current = marker;
    circleInstance.current = circle;
  }, [delivery.centerLat, delivery.centerLng, delivery.radiusKm]);

  // Load Google Maps script
  useEffect(() => {
    if (loading) return;

    if (!window.google) {
      const existing = document.querySelector(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      );
      if (!existing) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry,visualization`;
        script.async = true;
        script.defer = true;
        script.onload = initMap;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", initMap);
      }
    } else {
      initMap();
    }
  }, [loading, initMap]);

  // Update circle radius when slider changes
  useEffect(() => {
    if (circleInstance.current) {
      circleInstance.current.setRadius(delivery.radiusKm * 1000);
    }
  }, [delivery.radiusKm]);

  const saveDelivery = async () => {
    setSavingDelivery(true);
    try {
      await setDoc(doc(db, "settings", "delivery"), delivery, { merge: true });
      toast.success("Delivery zone settings saved!");
    } catch (e) {
      console.error("[Settings] Save delivery error:", e);
      toast.error("Failed to save delivery settings.");
    } finally {
      setSavingDelivery(false);
    }
  };

  const saveBusiness_ = async () => {
    setSavingBusiness(true);
    try {
      await setDoc(doc(db, "settings", "business"), business, { merge: true });
      toast.success("Business settings saved!");
    } catch (e) {
      console.error("[Settings] Save business error:", e);
      toast.error("Failed to save business settings.");
    } finally {
      setSavingBusiness(false);
    }
  };

  const saveCheckout_ = async () => {
    setSavingCheckout(true);
    try {
      await setDoc(doc(db, "settings", "checkout"), checkout, { merge: true });
      toast.success("Checkout form settings saved!");
    } catch (e) {
      console.error("[Settings] Save checkout error:", e);
      toast.error("Failed to save checkout settings.");
    } finally {
      setSavingCheckout(false);
    }
  };

  const addCustomField = () => {
    setCheckout((prev) => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { label: "", key: "", type: "text" as const, required: false },
      ],
    }));
  };

  const updateCustomField = (
    idx: number,
    field: keyof CustomField,
    value: string | boolean | string[]
  ) => {
    setCheckout((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === idx ? { ...cf, [field]: value } : cf
      ),
    }));
  };

  const removeCustomField = (idx: number) => {
    setCheckout((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-400 mt-2">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delivery Zone Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Delivery Zone</h3>
                <p className="text-sm text-slate-500">
                  Set delivery center and radius on the map
                </p>
              </div>
            </div>
            <Button onClick={saveDelivery} disabled={savingDelivery} size="sm">
              <Save className="w-4 h-4" />
              {savingDelivery ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div ref={mapRef} className="h-[350px] w-full bg-slate-100" />

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">
                Zone Name
              </label>
              <Input
                value={delivery.zoneName}
                onChange={(e) =>
                  setDelivery((p) => ({ ...p, zoneName: e.target.value }))
                }
                placeholder="e.g. Hyderabad"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">
                Center Lat
              </label>
              <Input
                type="number"
                step="0.0001"
                value={delivery.centerLat}
                onChange={(e) =>
                  setDelivery((p) => ({
                    ...p,
                    centerLat: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">
                Center Lng
              </label>
              <Input
                type="number"
                step="0.0001"
                value={delivery.centerLng}
                onChange={(e) =>
                  setDelivery((p) => ({
                    ...p,
                    centerLng: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Delivery Radius: {delivery.radiusKm} km
            </label>
            <input
              type="range"
              min={5}
              max={150}
              value={delivery.radiusKm}
              onChange={(e) =>
                setDelivery((p) => ({
                  ...p,
                  radiusKm: parseInt(e.target.value),
                }))
              }
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>5 km</span>
              <span>150 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Business Settings</h3>
              <p className="text-sm text-slate-500">
                Store info, delivery charges, minimum order
              </p>
            </div>
          </div>
          <Button onClick={saveBusiness_} disabled={savingBusiness} size="sm">
            <Save className="w-4 h-4" />
            {savingBusiness ? "Saving..." : "Save"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Store Name
            </label>
            <Input
              value={business.storeName}
              onChange={(e) =>
                setBusiness((p) => ({ ...p, storeName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Contact Phone
            </label>
            <Input
              value={business.contactPhone}
              onChange={(e) =>
                setBusiness((p) => ({ ...p, contactPhone: e.target.value }))
              }
              placeholder="+91 ..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Contact Email
            </label>
            <Input
              type="email"
              value={business.contactEmail}
              onChange={(e) =>
                setBusiness((p) => ({ ...p, contactEmail: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              GST Number
            </label>
            <Input
              value={business.gstNumber || ""}
              onChange={(e) =>
                setBusiness((p) => ({ ...p, gstNumber: e.target.value }))
              }
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Address
            </label>
            <Input
              value={business.address}
              onChange={(e) =>
                setBusiness((p) => ({ ...p, address: e.target.value }))
              }
              placeholder="Full business address"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Delivery Charges (₹)
            </label>
            <Input
              type="number"
              value={business.deliveryCharges}
              onChange={(e) =>
                setBusiness((p) => ({
                  ...p,
                  deliveryCharges: parseFloat(e.target.value) || 0,
                }))
              }
              min={0}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              Minimum Order Value (₹)
            </label>
            <Input
              type="number"
              value={business.minOrderValue}
              onChange={(e) =>
                setBusiness((p) => ({
                  ...p,
                  minOrderValue: parseFloat(e.target.value) || 0,
                }))
              }
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Checkout Form Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Checkout Form</h3>
              <p className="text-sm text-slate-500">
                Configure required fields and custom inputs
              </p>
            </div>
          </div>
          <Button onClick={saveCheckout_} disabled={savingCheckout} size="sm">
            <Save className="w-4 h-4" />
            {savingCheckout ? "Saving..." : "Save"}
          </Button>
        </div>

        <div className="space-y-4">
          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={checkout.requireShopName}
                onChange={(e) =>
                  setCheckout((p) => ({
                    ...p,
                    requireShopName: e.target.checked,
                  }))
                }
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Require Shop Name
              </span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={checkout.requirePincode}
                onChange={(e) =>
                  setCheckout((p) => ({
                    ...p,
                    requirePincode: e.target.checked,
                  }))
                }
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Require Pincode
              </span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={checkout.showMapPicker}
                onChange={(e) =>
                  setCheckout((p) => ({
                    ...p,
                    showMapPicker: e.target.checked,
                  }))
                }
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Show Map Picker
              </span>
            </label>
          </div>

          {/* Custom Fields */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-700 text-sm">
                Custom Checkout Fields
              </h4>
              <Button variant="outline" size="sm" onClick={addCustomField}>
                <Plus className="w-4 h-4" /> Add Field
              </Button>
            </div>

            {checkout.customFields.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">
                No custom fields configured. Click &quot;Add Field&quot; to create one.
              </p>
            )}

            <div className="space-y-3">
              {checkout.customFields.map((cf, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                >
                  <Input
                    value={cf.label}
                    onChange={(e) =>
                      updateCustomField(idx, "label", e.target.value)
                    }
                    placeholder="Label"
                    className="flex-1"
                  />
                  <Input
                    value={cf.key}
                    onChange={(e) =>
                      updateCustomField(idx, "key", e.target.value)
                    }
                    placeholder="Key"
                    className="w-28"
                  />
                  <select
                    value={cf.type}
                    onChange={(e) =>
                      updateCustomField(idx, "type", e.target.value)
                    }
                    className="px-2 py-2 border border-slate-200 rounded-md text-sm bg-white"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cf.required}
                      onChange={(e) =>
                        updateCustomField(idx, "required", e.target.checked)
                      }
                      className="rounded text-emerald-600"
                    />
                    Required
                  </label>
                  <button
                    onClick={() => removeCustomField(idx)}
                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
