"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import {
  Save, MapPin, Store, FileText, Plus, X, Loader2, Mail, Eye, EyeOff, Send,
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Settings2, Activity, TestTube2, RotateCcw, Users,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeSettingsSection from "./ThemeSettingsSection";
import {
  DeliverySettings,
  BusinessSettings,
  CheckoutFormSettings,
  CustomField,
  SmsGatewaySettings,
  DEFAULT_DELIVERY,
  DEFAULT_BUSINESS,
  DEFAULT_CHECKOUT,
  DEFAULT_SMS_GATEWAY,
} from "@/types/settings";

interface SmtpSettings {
  user: string;
  password: string;
  fromName: string;
  host: string;
  port: number;
}

interface EmailStats {
  total: number;
  sent: number;
  errors: number;
  pending: number;
  retried: number;
  recentFailures: FailedEmail[];
}

interface FailedEmail {
  id: string;
  to: string[];
  subject: string;
  error: string;
  errorCategory: string;
  createdAt: string | null;
  attempts: number;
}

interface EmailLog {
  id: string;
  to: string[];
  subject: string;
  status: string;
  error?: string;
  errorCategory?: string;
  smtpUser?: string;
  createdAt: string | null;
  sentAt?: string | null;
  attempts: number;
  retriedFrom?: string | null;
}

const DEFAULT_SMTP: SmtpSettings = {
  user: "",
  password: "",
  fromName: "KKR Groceries",
  host: "smtp.gmail.com",
  port: 587,
};

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
  const [smtp, setSmtp] = useState<SmtpSettings>(DEFAULT_SMTP);
  const [smsGateway, setSmsGateway] = useState<SmsGatewaySettings>(DEFAULT_SMS_GATEWAY);
  const [loading, setLoading] = useState(true);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingSmsGateway, setSavingSmsGateway] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSubTab, setEmailSubTab] = useState<"config" | "activity" | "test">("config");
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsStatusFilter, setLogsStatusFilter] = useState("all");
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [newNotifEmail, setNewNotifEmail] = useState("");
  const [savingNotifEmails, setSavingNotifEmails] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [showAdvancedSmtp, setShowAdvancedSmtp] = useState(false);
  const [sendingToAll, setSendingToAll] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const circleInstance = useRef<any>(null);

  // Load all settings
  useEffect(() => {
    (async () => {
      try {
        const [dSnap, bSnap, cSnap, sSnap, aSnap, sgSnap] = await Promise.all([
          getDoc(doc(db, "settings", "delivery")),
          getDoc(doc(db, "settings", "business")),
          getDoc(doc(db, "settings", "checkout")),
          getDoc(doc(db, "settings", "smtp")),
          getDoc(doc(db, "settings", "admins")),
          getDoc(doc(db, "settings", "smsGateway")),
        ]);
        if (dSnap.exists()) setDelivery({ ...DEFAULT_DELIVERY, ...dSnap.data() });
        if (bSnap.exists()) setBusiness({ ...DEFAULT_BUSINESS, ...bSnap.data() });
        if (cSnap.exists()) setCheckout({ ...DEFAULT_CHECKOUT, ...cSnap.data() });
        if (sSnap.exists()) setSmtp({ ...DEFAULT_SMTP, ...sSnap.data() });
        if (sgSnap.exists()) setSmsGateway({ ...DEFAULT_SMS_GATEWAY, ...sgSnap.data() });
        if (aSnap.exists()) {
          const ad = aSnap.data();
          setNotificationEmails(ad.notificationEmails || ad.emails || []);
        }
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

  const saveSmtp_ = async () => {
    if (!smtp.user || !smtp.password) {
      toast.error("Gmail address and App Password are required.");
      return;
    }
    setSavingSmtp(true);
    try {
      await setDoc(doc(db, "settings", "smtp"), smtp, { merge: true });
      toast.success("SMTP settings saved!");
    } catch (e) {
      console.error("[Settings] Save SMTP error:", e);
      toast.error("Failed to save SMTP settings.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const testSmtp_ = async () => {
    if (!smtp.user || !smtp.password) {
      toast.error("Save SMTP settings first before testing.");
      return;
    }
    setTestingSmtp(true);
    try {
      const testFn = httpsCallable(functions, "testSmtpConfig");
      const result = await testFn({ testEmail: smtp.user });
      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        toast.success(data.message || "Test email sent successfully!");
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to send test email.";
      console.error("[Settings] Test SMTP error:", e);
      toast.error(msg);
    } finally {
      setTestingSmtp(false);
    }
  };

  const loadEmailStats = async () => {
    setStatsLoading(true);
    try {
      const fn = httpsCallable(functions, "getEmailStats");
      const result = await fn();
      setEmailStats(result.data as EmailStats);
    } catch (e) {
      console.error("[Settings] Load email stats error:", e);
      toast.error("Failed to load email stats");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadEmailLogs = async (reset = true) => {
    setLogsLoading(true);
    try {
      const fn = httpsCallable(functions, "getEmailLogs");
      const result = await fn({
        statusFilter: logsStatusFilter,
        limit: 25,
        startAfterId: reset ? undefined : emailLogs[emailLogs.length - 1]?.id,
      });
      const data = result.data as { logs: EmailLog[]; hasMore: boolean };
      setEmailLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]));
      setLogsHasMore(data.hasMore);
    } catch (e) {
      console.error("[Settings] Load email logs error:", e);
      toast.error("Failed to load email logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const retryEmail = async (mailId: string) => {
    setRetryingId(mailId);
    try {
      const fn = httpsCallable(functions, "retryFailedEmail");
      await fn({ mailId });
      toast.success("Email queued for retry!");
      loadEmailStats();
      loadEmailLogs();
    } catch (e: any) {
      toast.error(e?.message || "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const saveNotificationEmails = async () => {
    setSavingNotifEmails(true);
    try {
      await setDoc(
        doc(db, "settings", "admins"),
        { notificationEmails },
        { merge: true }
      );
      toast.success("Notification recipients saved!");
    } catch (e) {
      console.error("[Settings] Save notification emails error:", e);
      toast.error("Failed to save notification recipients.");
    } finally {
      setSavingNotifEmails(false);
    }
  };

  const addNotifEmail = () => {
    const email = newNotifEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    if (notificationEmails.includes(email)) {
      toast.error("Email already in the list");
      return;
    }
    setNotificationEmails((prev) => [...prev, email]);
    setNewNotifEmail("");
  };

  const removeNotifEmail = (email: string) => {
    setNotificationEmails((prev) => prev.filter((e) => e !== email));
  };

  const sendTestToRecipient = async () => {
    if (!testRecipient.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setTestingSmtp(true);
    try {
      const fn = httpsCallable(functions, "testSmtpConfig");
      const result = await fn({ testEmail: testRecipient.trim() });
      const data = result.data as { success: boolean; message: string };
      if (data.success) toast.success(data.message);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send test email");
    } finally {
      setTestingSmtp(false);
    }
  };

  const sendTestToAllAdmins = async () => {
    if (notificationEmails.length === 0) {
      toast.error("No notification recipients configured");
      return;
    }
    setSendingToAll(true);
    try {
      const fn = httpsCallable(functions, "testSmtpConfig");
      const result = await fn({ recipients: notificationEmails });
      const data = result.data as { success: boolean; message: string };
      if (data.success) toast.success(data.message);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send test emails");
    } finally {
      setSendingToAll(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
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
            <label className="flex items-center gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 cursor-pointer sm:col-span-3">
              <input
                type="checkbox"
                checked={checkout.requireDeliveryOTP}
                onChange={(e) =>
                  setCheckout((p) => ({
                    ...p,
                    requireDeliveryOTP: e.target.checked,
                  }))
                }
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Require Delivery OTP
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send OTP to customer before marking order as Fulfilled
                </p>
              </div>
            </label>

            {/* OTP Channel Selector — visible when OTP is enabled */}
            {checkout.requireDeliveryOTP && (
              <div className="sm:col-span-3 p-3 rounded-xl border border-amber-100 bg-amber-50/30 space-y-2">
                <label className="text-sm font-medium text-slate-700 block">OTP Delivery Channel</label>
                <select
                  value={checkout.otpChannels || "email"}
                  onChange={(e) =>
                    setCheckout((p) => ({
                      ...p,
                      otpChannels: e.target.value as "email" | "sms" | "both",
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only (Firebase Phone Auth)</option>
                  <option value="both">Both SMS &amp; Email</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  {checkout.otpChannels === "sms"
                    ? "SMS OTP via Firebase Phone Auth (second project). Buyer receives Firebase's auto-generated code."
                    : checkout.otpChannels === "both"
                    ? "Email sends a custom OTP code. SMS sends a separate Firebase-generated code. Either code verifies delivery."
                    : "Custom OTP code sent to customer's email address."}
                </p>
              </div>
            )}
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

      {/* Email Management Center */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Email Management Center</h3>
              <p className="text-sm text-slate-500">
                Gmail credentials, activity monitoring &amp; testing
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          {([
            { key: "config" as const, label: "Configuration", icon: Settings2 },
            { key: "activity" as const, label: "Activity", icon: Activity },
            { key: "test" as const, label: "Test", icon: TestTube2 },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setEmailSubTab(key);
                if (key === "activity" && !emailStats) {
                  loadEmailStats();
                  loadEmailLogs();
                }
              }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                emailSubTab === key
                  ? "border-purple-500 text-purple-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tab Content */}
        <div className="p-6">
          {/* ─── CONFIG TAB ─── */}
          {emailSubTab === "config" && (
            <div className="space-y-6">
              {/* Current Sender Banner */}
              {smtp.user && (
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-purple-800">Connected:</span>{" "}
                    <span className="text-purple-700">{smtp.user}</span>
                    <span className="text-purple-500 ml-2">
                      — Sends as &quot;{smtp.fromName || "KKR Groceries"} &lt;{smtp.user}&gt;&quot;
                    </span>
                  </div>
                </div>
              )}

              {/* SMTP Credentials */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-700 text-sm">SMTP Credentials</h4>
                  <Button onClick={saveSmtp_} disabled={savingSmtp} size="sm">
                    <Save className="w-4 h-4" />
                    {savingSmtp ? "Saving..." : "Save"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">
                      Gmail Address
                    </label>
                    <Input
                      type="email"
                      value={smtp.user}
                      onChange={(e) => setSmtp((p) => ({ ...p, user: e.target.value }))}
                      placeholder="your-email@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">
                      App Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={smtp.password}
                        onChange={(e) => setSmtp((p) => ({ ...p, password: e.target.value }))}
                        placeholder="16-character app password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Generate at{" "}
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">
                        myaccount.google.com → App passwords
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">
                      Sender Name
                    </label>
                    <Input
                      value={smtp.fromName}
                      onChange={(e) => setSmtp((p) => ({ ...p, fromName: e.target.value }))}
                      placeholder="KKR Groceries"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">
                      Preview
                    </label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                      &quot;{smtp.fromName || "KKR Groceries"} &lt;{smtp.user || "email"}&gt;&quot;
                    </div>
                  </div>
                </div>

                {/* Advanced SMTP Toggle */}
                <button
                  onClick={() => setShowAdvancedSmtp((v) => !v)}
                  className="flex items-center gap-2 mt-4 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showAdvancedSmtp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced SMTP Settings
                </button>
                {showAdvancedSmtp && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Host</label>
                      <Input
                        value={smtp.host}
                        onChange={(e) => setSmtp((p) => ({ ...p, host: e.target.value }))}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Port</label>
                      <Input
                        type="number"
                        value={smtp.port}
                        onChange={(e) => setSmtp((p) => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                        placeholder="587"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-slate-400 pb-2">
                        Default: smtp.gmail.com:587 with STARTTLS
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Recipients */}
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" /> Notification Recipients
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      These admins receive order notification emails
                    </p>
                  </div>
                  <Button
                    onClick={saveNotificationEmails}
                    disabled={savingNotifEmails}
                    size="sm"
                    variant="outline"
                  >
                    {savingNotifEmails ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingNotifEmails ? "Saving..." : "Save Recipients"}
                  </Button>
                </div>

                <div className="space-y-2 mb-3">
                  {notificationEmails.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-3">No recipients configured yet.</p>
                  )}
                  {notificationEmails.map((email) => (
                    <div key={email} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {email}
                      </div>
                      <button
                        onClick={() => removeNotifEmail(email)}
                        className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newNotifEmail}
                    onChange={(e) => setNewNotifEmail(e.target.value)}
                    placeholder="Add email address..."
                    onKeyDown={(e) => e.key === "Enter" && addNotifEmail()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addNotifEmail}>
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── ACTIVITY TAB ─── */}
          {emailSubTab === "activity" && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                  <Send className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-blue-700">
                    {statsLoading ? "—" : (emailStats?.sent ?? 0)}
                  </div>
                  <div className="text-xs text-blue-500 font-medium">Total Sent</div>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                  <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-red-700">
                    {statsLoading ? "—" : (emailStats?.errors ?? 0)}
                  </div>
                  <div className="text-xs text-red-500 font-medium">Failed</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
                  <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-amber-700">
                    {statsLoading ? "—" : (emailStats?.pending ?? 0)}
                  </div>
                  <div className="text-xs text-amber-500 font-medium">Pending</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-emerald-700">
                    {statsLoading
                      ? "—"
                      : emailStats && emailStats.total > 0
                        ? `${((emailStats.sent / emailStats.total) * 100).toFixed(1)}%`
                        : "0%"}
                  </div>
                  <div className="text-xs text-emerald-500 font-medium">Success Rate</div>
                </div>
              </div>

              {/* Recent Failures */}
              {emailStats && emailStats.recentFailures.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Recent Failures
                  </h4>
                  <div className="space-y-2">
                    {emailStats.recentFailures.map((f) => (
                      <div key={f.id} className="flex items-start justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="font-medium text-red-800 truncate">{f.subject || "No subject"}</span>
                          </div>
                          <div className="text-xs text-red-600 mt-1 ml-6">
                            → {Array.isArray(f.to) ? f.to.join(", ") : f.to}
                          </div>
                          <div className="text-xs text-red-500 mt-1 ml-6">
                            {f.error} · {f.attempts} attempt{f.attempts !== 1 ? "s" : ""} · {timeAgo(f.createdAt)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryEmail(f.id)}
                          disabled={retryingId === f.id}
                          className="ml-3 flex-shrink-0"
                        >
                          {retryingId === f.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Retry
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mail Log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700 text-sm">Mail Log</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { loadEmailStats(); loadEmailLogs(); }}
                    disabled={logsLoading || statsLoading}
                  >
                    {(logsLoading || statsLoading) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Refresh
                  </Button>
                </div>

                {/* Status Filters */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {[
                    { value: "all", label: "All" },
                    { value: "sent", label: "Sent ✓", color: "text-emerald-600" },
                    { value: "error", label: "Failed ✕", color: "text-red-600" },
                    { value: "pending", label: "Pending", color: "text-amber-600" },
                  ].map((f) => (
                    <button
                      key={f.value}
                      onClick={() => {
                        setLogsStatusFilter(f.value);
                        setTimeout(() => loadEmailLogs(), 0);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        logsStatusFilter === f.value
                          ? "bg-purple-50 border-purple-200 text-purple-700"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Log Table */}
                {logsLoading && emailLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                    <p className="text-sm text-slate-400 mt-2">Loading logs...</p>
                  </div>
                ) : emailLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No emails found</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Date</th>
                            <th className="text-left px-4 py-2.5 font-medium text-slate-500">To</th>
                            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Subject</th>
                            <th className="text-left px-4 py-2.5 font-medium text-slate-500">Status</th>
                            <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {emailLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                                {formatDate(log.createdAt)}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700 max-w-[180px] truncate">
                                {Array.isArray(log.to) ? log.to.join(", ") : log.to}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate">
                                {log.subject || "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                {log.status === "sent" && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Sent
                                  </span>
                                )}
                                {log.status === "error" && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full" title={log.error}>
                                    <XCircle className="w-3 h-3" /> Failed
                                  </span>
                                )}
                                {log.status === "retried" && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                    <RotateCcw className="w-3 h-3" /> Retried
                                  </span>
                                )}
                                {(!log.status || log.status === "pending") && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                    <Clock className="w-3 h-3" /> Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {log.status === "error" && (
                                  <button
                                    onClick={() => retryEmail(log.id)}
                                    disabled={retryingId === log.id}
                                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                                    title="Retry this email"
                                  >
                                    {retryingId === log.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {logsHasMore && (
                      <div className="p-3 border-t border-slate-100 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadEmailLogs(false)}
                          disabled={logsLoading}
                        >
                          {logsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          Load More
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TEST TAB ─── */}
          {emailSubTab === "test" && (
            <div className="space-y-6">
              {/* Current Config Status */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                {smtp.user ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-slate-700">Current config:</span>{" "}
                      <span className="text-slate-600">{smtp.user}</span>
                      <span className="ml-2 text-emerald-600 font-medium">● Connected</span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <div className="text-sm text-amber-700">
                      No SMTP credentials configured. Go to Configuration tab first.
                    </div>
                  </>
                )}
              </div>

              {/* Send Test to Custom Recipient */}
              <div>
                <h4 className="font-semibold text-slate-700 text-sm mb-3">Send Test Email</h4>
                <div className="flex gap-2">
                  <Input
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1"
                  />
                  <Button
                    onClick={sendTestToRecipient}
                    disabled={testingSmtp || !smtp.user || !smtp.password}
                    size="sm"
                  >
                    {testingSmtp && !sendingToAll ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send Test
                  </Button>
                </div>
              </div>

              {/* Send to All Admins */}
              <div className="border-t border-slate-100 pt-6">
                <h4 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Send to All Admin Recipients
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Sends a test email to all notification recipients configured in the Configuration tab.
                </p>

                {notificationEmails.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      {notificationEmails.map((email) => (
                        <div key={email} className="flex items-center gap-2 text-sm text-slate-600 py-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {email}
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={sendTestToAllAdmins}
                      disabled={sendingToAll || !smtp.user || !smtp.password}
                      variant="outline"
                      size="sm"
                    >
                      {sendingToAll ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                      {sendingToAll ? "Sending..." : `Send Test to All (${notificationEmails.length})`}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-3 text-center">
                    No notification recipients configured. Add them in the Configuration tab.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SMS Gateway Settings (MSG91 — Future Use) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  SMS Gateway (MSG91)
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Future Use
                  </span>
                </h3>
                <p className="text-sm text-slate-500">
                  Configure MSG91 API for sending SMS OTP with a custom code (same code as email)
                </p>
              </div>
            </div>
            <Button
              onClick={async () => {
                setSavingSmsGateway(true);
                try {
                  await setDoc(doc(db, "settings", "smsGateway"), smsGateway, { merge: true });
                  toast.success("SMS gateway settings saved!");
                } catch (e) {
                  console.error("[Settings] Save SMS gateway error:", e);
                  toast.error("Failed to save SMS gateway settings.");
                } finally {
                  setSavingSmsGateway(false);
                }
              }}
              disabled={savingSmsGateway}
              size="sm"
            >
              <Save className="w-4 h-4 mr-1" />
              {savingSmsGateway ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={smsGateway.enabled}
              onChange={(e) =>
                setSmsGateway((p) => ({ ...p, enabled: e.target.checked }))
              }
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Enable MSG91 Gateway</span>
              <p className="text-xs text-slate-400 mt-0.5">
                When enabled, delivery OTP will use MSG91 to send SMS with the same code as email
              </p>
            </div>
          </label>

          {/* Config fields (always visible for pre-configuration) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-500 mb-1 block">API Key</label>
              <Input
                type="password"
                value={smsGateway.apiKey}
                onChange={(e) =>
                  setSmsGateway((p) => ({ ...p, apiKey: e.target.value }))
                }
                placeholder="Enter MSG91 API key"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500 mb-1 block">Sender ID (6 chars)</label>
              <Input
                value={smsGateway.senderId}
                onChange={(e) =>
                  setSmsGateway((p) => ({
                    ...p,
                    senderId: e.target.value.slice(0, 6).toUpperCase(),
                  }))
                }
                placeholder="KKRGRO"
                maxLength={6}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-500 mb-1 block">DLT Template ID</label>
              <Input
                value={smsGateway.templateId}
                onChange={(e) =>
                  setSmsGateway((p) => ({ ...p, templateId: e.target.value }))
                }
                placeholder="Enter DLT-registered template ID"
              />
              <p className="text-xs text-slate-400 mt-1">
                DLT registration is mandatory in India for transactional SMS. Template must include variables for OTP code.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs text-blue-600">
              <strong>Note:</strong> MSG91 integration is for future use. Currently, SMS OTP uses Firebase Phone Auth
              from the second project (kkr-groceries-02-otp). When MSG91 is configured and enabled, it will allow sending
              the same OTP code via both SMS and Email.
            </p>
          </div>
        </div>
      </div>

      {/* Store Theme Settings */}
      <ThemeSettingsSection />
    </div>
  );
}
