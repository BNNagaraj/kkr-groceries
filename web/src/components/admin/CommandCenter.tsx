"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { db, functions } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { usePresenceData } from "@/contexts/PresenceContext";
import type { PresenceDoc } from "@/contexts/PresenceContext";
import { Order, OrderStatus, STATUS_TIMESTAMP_FIELDS } from "@/types/order";
import type { DeliverySettings, Store } from "@/types/settings";
import { DEFAULT_DELIVERY } from "@/types/settings";
import { parseTotal, exportOrdersToCSV } from "@/lib/helpers";
import { normalizeIndianPhone } from "@/lib/validation";
import { toast } from "sonner";
import { useDeliveryOTP } from "@/hooks/useDeliveryOTP";
import type { OnlineUserMarker } from "./c2/OrderMap";

import LiveMetrics from "./c2/LiveMetrics";
import OrderSearch from "./c2/OrderSearch";
import StoreFilter from "./c2/StoreFilter";

// Heavy components — lazy-loaded to reduce initial compile/bundle
const OrderPipeline = dynamic(() => import("./c2/OrderPipeline"), { ssr: false });
const ActivityFeed = dynamic(() => import("./c2/ActivityFeed"), { ssr: false });
const OrderMap = dynamic(() => import("./c2/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center" style={{ minHeight: 400 }}>
      <span className="text-slate-400 text-sm">Loading Map...</span>
    </div>
  ),
});
const MiniCharts = dynamic(() => import("./c2/MiniCharts"), { ssr: false });
const StoreAnalytics = dynamic(() => import("./c2/StoreAnalytics"), { ssr: false });
const AssignDeliveryDialog = dynamic(() => import("./AssignDeliveryDialog"), { ssr: false });

import {
  Zap,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  LayoutGrid,
  FlaskConical,
  Database,
  Volume2,
  VolumeX,
  Search,
  Download,
  X,
  Warehouse,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type C2Theme = "light" | "dark";
export type C2DateRange = "today" | "yesterday" | "7days" | "all";

type C2LayoutKey = "balanced" | "map-focus" | "pipeline-focus" | "analytics-focus";

interface C2LayoutConfig {
  label: string;
  mapCols: number;
  pipeCols: number;
  feedCols: number;
  chartCols: number;
  bottomHeight: number;
}

// PresenceDoc is imported from @/contexts/PresenceContext

// ─── Date Range Options ──────────────────────────────────────────────────────
const C2_DATE_RANGES: { key: C2DateRange; label: string; shortLabel: string }[] = [
  { key: "today", label: "Today", shortLabel: "Today" },
  { key: "yesterday", label: "Yesterday", shortLabel: "Yest" },
  { key: "7days", label: "7 Days", shortLabel: "7D" },
  { key: "all", label: "All Time", shortLabel: "All" },
];

// ─── Layout Presets ──────────────────────────────────────────────────────────
const C2_LAYOUTS: Record<C2LayoutKey, C2LayoutConfig> = {
  balanced: { label: "Balanced", mapCols: 7, pipeCols: 5, feedCols: 7, chartCols: 5, bottomHeight: 320 },
  "map-focus": { label: "Map Focus", mapCols: 9, pipeCols: 3, feedCols: 8, chartCols: 4, bottomHeight: 240 },
  "pipeline-focus": { label: "Pipeline Focus", mapCols: 4, pipeCols: 8, feedCols: 5, chartCols: 7, bottomHeight: 300 },
  "analytics-focus": { label: "Analytics Focus", mapCols: 6, pipeCols: 6, feedCols: 4, chartCols: 8, bottomHeight: 420 },
};

// ─── localStorage Helpers (SSR-safe) ─────────────────────────────────────────
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ─── Date Helpers ────────────────────────────────────────────────────────────
function getDateStr(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Extract a comparable YYYY-MM-DD string from an order using createdAt (Firestore Timestamp) first, falling back to timestamp string */
function getOrderDateKey(order: Order): string {
  // Prefer createdAt (Firestore Timestamp) — reliable and timezone-consistent
  if (order.createdAt?.toDate) {
    const d = order.createdAt.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // Fallback: parse the timestamp string (format: "D/M/YYYY, ..." or "DD/MM/YYYY, ...")
  const raw = order.timestamp || "";
  if (!raw) return "";
  try {
    const datePart = raw.split(",")[0].trim();
    const parts = datePart.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  } catch {}
  return "";
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isToday(order: Order): boolean {
  return getOrderDateKey(order) === dateKey(new Date());
}

function isYesterday(order: Order): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getOrderDateKey(order) === dateKey(yesterday);
}

function isWithin7Days(order: Order): boolean {
  const orderKey = getOrderDateKey(order);
  if (!orderKey) return false;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (orderKey === dateKey(d)) return true;
  }
  return false;
}

// ─── Sound Chime (Web Audio API) ─────────────────────────────────────────────
function playNewOrderChime(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    // Two-tone chime: C5 then E5
    [523, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });
  } catch (e) {
    console.warn("[C2] Audio chime failed:", e);
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface CommandCenterProps {
  onNavigateToOrder?: (orderId: string) => void;
}

// ─── Main Command Center ─────────────────────────────────────────────────────
export default function CommandCenter({ onNavigateToOrder }: CommandCenterProps) {
  const { col, mode } = useMode();
  const { presenceList } = usePresenceData();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [stores, setStores] = useState<Store[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derive online users from shared presence context ──
  const onlineUsers = useMemo(() => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    return presenceList.filter((p) => {
      const isMarkedOnline = p.online === true || p.status === "online";
      if (!isMarkedOnline) return false;
      const lastSeenMs = p.lastSeen && typeof p.lastSeen.toMillis === "function"
        ? p.lastSeen.toMillis()
        : 0;
      return lastSeenMs > twoMinutesAgo;
    });
  }, [presenceList]);

  // ── Theme state ──
  const [c2Theme, setC2Theme] = useState<C2Theme>(() =>
    readStorage<C2Theme>("kkr-c2-theme", "light")
  );

  // ── Layout state ──
  const [layoutKey, setLayoutKey] = useState<C2LayoutKey>(() =>
    readStorage<C2LayoutKey>("kkr-c2-layout", "balanced")
  );
  const layout = C2_LAYOUTS[layoutKey] || C2_LAYOUTS.balanced;

  // ── Bottom panel height ──
  const [bottomHeight, setBottomHeight] = useState<number>(() =>
    readStorage<number>("kkr-c2-bottom-h", layout.bottomHeight)
  );
  const isDraggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const latestBottomH = useRef(bottomHeight);

  // ── Feature 1: Date range ──
  const [dateRange, setDateRange] = useState<C2DateRange>("today");

  // ── Store filter (empty = all stores) ──
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  // ── Feature 2: Mute state ──
  const [isMuted, setIsMuted] = useState<boolean>(() =>
    readStorage<boolean>("kkr-c2-muted", false)
  );
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // ── Feature 6: Search ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [metricDetail, setMetricDetail] = useState<string | null>(null);

  // ── OTP on Fulfill ── owned by useDeliveryOTP hook (settings, send, verify, recaptcha lifecycle).
  const otpFulfillRef = useRef<((orderId: string) => Promise<void>) | null>(null);
  const otp = useDeliveryOTP({
    recaptchaContainerId: "c2-otp-recaptcha-container",
    onVerified: async (orderId) => {
      await otpFulfillRef.current?.(orderId);
    },
    logPrefix: "[C2 OTP]",
  });

  // ── Assign Delivery Dialog ──
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignDialogOrder, setAssignDialogOrder] = useState<Order | null>(null);
  // After assignment (or skip), call this to proceed with the original status change
  const pendingAssignCallbackRef = useRef<(() => void) | null>(null);

  // Sync bottom height when layout preset changes
  useEffect(() => {
    setBottomHeight(layout.bottomHeight);
    writeStorage("kkr-c2-bottom-h", layout.bottomHeight);
  }, [layout.bottomHeight]);

  // ── Real-time order listener (last 30 days) ──
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const unsub = onSnapshot(
      query(
        collection(db, col("orders")),
        where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo))
      ),
      (snap) => {
        const data: Order[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Order[];
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.warn("[C2] Orders listener error:", err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [col]);

  // Presence data is now provided by PresenceContext (shared listener)

  // ── Load delivery zone settings ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "delivery"));
        if (snap.exists()) {
          const data = snap.data() as DeliverySettings;
          setDeliveryZone({ ...DEFAULT_DELIVERY, ...data });
        }
      } catch (e) {
        console.warn("[C2] Failed to load delivery zone:", e);
      }
    })();
  }, []);

  // ── Load stores for map ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, col("stores")),
      (snap) => {
        setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store)).filter((s) => s.isActive));
      },
      (err) => console.warn("[C2] Stores listener error:", err.message)
    );
    return unsub;
  }, [col]);

  // ── Feature 2: New order sound detection ──
  useEffect(() => {
    if (orders.length === 0) return;

    if (isInitialLoadRef.current) {
      // First load — just populate the set, don't play sound
      isInitialLoadRef.current = false;
      prevOrderIdsRef.current = new Set(orders.map((o) => o.id));
      return;
    }

    const currentIds = new Set(orders.map((o) => o.id));
    const newPendingOrders = orders.filter(
      (o) => !prevOrderIdsRef.current.has(o.id) && (o.status === "Pending" || !o.status)
    );

    if (newPendingOrders.length > 0 && !isMuted) {
      playNewOrderChime(audioCtxRef);
    }

    prevOrderIdsRef.current = currentIds;
  }, [orders, isMuted]);

  // ── Online users with locations ──
  const onlineUsersWithLocation = useMemo<OnlineUserMarker[]>(() => {
    const sorted = [...orders].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    return onlineUsers.map((u) => {
      const uPhone = normalizeIndianPhone(u.phone || "");
      const userOrder = sorted.find((o) => {
        if (!o.lat && !o.lng && !o.location) return false;
        if (o.userId && o.userId === u.uid) return true;
        if (o.userEmail && u.email && o.userEmail.toLowerCase() === u.email.toLowerCase()) return true;
        if (uPhone && uPhone.length === 10) {
          const oPhone = normalizeIndianPhone(o.phone || "");
          if (oPhone === uPhone) return true;
        }
        return false;
      });

      // For delivery boys, find their currently assigned order
      const isDeliveryBoy = !!u.isDelivery;
      let assignedOrder: Order | undefined;
      if (isDeliveryBoy) {
        assignedOrder = sorted.find(
          (o) => o.assignedTo === u.uid && (o.status === "Accepted" || o.status === "Shipped")
        );
      }

      return {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        lat: userOrder?.lat,
        lng: userOrder?.lng,
        location: userOrder?.location,
        isDelivery: isDeliveryBoy,
        gpsLat: u.lat,   // GPS from presence doc
        gpsLng: u.lng,   // GPS from presence doc
        assignedOrderId: assignedOrder?.id,
        assignedOrderCustomer: assignedOrder?.customerName,
        assignedOrderStatus: assignedOrder?.status,
      };
    });
  }, [onlineUsers, orders]);

  // ── Feature 1: Filtered orders by date range ──
  const todayOrders = useMemo(() => orders.filter(isToday), [orders]);
  const yesterdayOrders = useMemo(() => orders.filter(isYesterday), [orders]);

  const filteredOrders = useMemo(() => {
    let result: Order[];
    switch (dateRange) {
      case "today":
        result = todayOrders;
        break;
      case "yesterday":
        result = yesterdayOrders;
        break;
      case "7days":
        result = orders.filter(isWithin7Days);
        break;
      case "all":
        result = orders;
        break;
      default:
        result = todayOrders;
    }
    // Apply store filter
    if (selectedStoreIds.length > 0) {
      result = result.filter((o) => o.assignedStoreId && selectedStoreIds.includes(o.assignedStoreId));
    }
    return result;
  }, [dateRange, orders, todayOrders, yesterdayOrders, selectedStoreIds]);

  // ── KPIs (from filteredOrders) ──
  const displayRevenue = useMemo(
    () => filteredOrders.filter((o) => o.status === "Fulfilled").reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [filteredOrders]
  );
  const yesterdayRevenue = useMemo(
    () => yesterdayOrders.filter((o) => o.status === "Fulfilled").reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [yesterdayOrders]
  );
  const activeOrders = useMemo(
    () => filteredOrders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected").length,
    [filteredOrders]
  );
  const fulfillmentRate = useMemo(() => {
    const total = filteredOrders.length;
    if (total === 0) return 0;
    return Math.round((filteredOrders.filter((o) => o.status === "Fulfilled").length / total) * 100);
  }, [filteredOrders]);
  const avgOrderValue = useMemo(() => {
    const f = filteredOrders.filter((o) => o.status === "Fulfilled");
    if (f.length === 0) return 0;
    return Math.round(f.reduce((s, o) => s + parseTotal(o.totalValue), 0) / f.length);
  }, [filteredOrders]);

  // ── Feature 3: Pending revenue (from filteredOrders) ──
  const pendingRevenue = useMemo(
    () =>
      filteredOrders
        .filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected")
        .reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [filteredOrders]
  );

  // ── Revenue label (dynamic based on date range) ──
  const revenueLabel = useMemo(() => {
    switch (dateRange) {
      case "today": return "Today's Revenue";
      case "yesterday": return "Yesterday's Revenue";
      case "7days": return "7-Day Revenue";
      case "all": return "Total Revenue";
      default: return "Revenue";
    }
  }, [dateRange]);

  // ── Core status writer (no interception) ──
  const doStatusChange = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      try {
        const updates: Record<string, unknown> = {
          status: newStatus,
          updatedAt: serverTimestamp(),
        };
        const timestampField = STATUS_TIMESTAMP_FIELDS[newStatus];
        if (timestampField) updates[timestampField] = serverTimestamp();

        await updateDoc(doc(db, col("orders"), orderId), updates);
        toast.success(`Order ${newStatus.toLowerCase()} successfully.`);

        try {
          const notifyFn = httpsCallable(functions, "notifyOrderStatusChange");
          notifyFn({ orderId, newStatus, collectionName: col("orders") }).catch(() => {});
        } catch {}
      } catch (err: any) {
        console.error("[C2] Status change failed:", err);
        toast.error(`Failed to update order: ${err.message}`);
      }
    },
    [col]
  );

  // Wire OTP hook's onVerified callback to doStatusChange. Re-binds each render
  // so the hook always sees the freshest closure without re-initializing.
  otpFulfillRef.current = (orderId: string) => doStatusChange(orderId, "Fulfilled");

  // ── Status change handler (intercepts Accepted/Shipped for delivery assignment) ──
  const handleStatusChange = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      // Intercept "Accepted" and "Shipped" to offer delivery assignment
      if (newStatus === "Accepted" || newStatus === "Shipped") {
        const order = filteredOrders.find((o) => o.id === orderId) || null;
        if (order) {
          setAssignDialogOrder(order);
          setAssignDialogOpen(true);
          // Store callback to fire after assignment dialog closes
          pendingAssignCallbackRef.current = () => doStatusChange(orderId, newStatus);
          return;
        }
      }
      await doStatusChange(orderId, newStatus);
    },
    [doStatusChange, filteredOrders]
  );

  // ── Feature 7: Bulk status change ──
  const handleBulkStatusChange = useCallback(
    async (orderIds: string[], newStatus: OrderStatus) => {
      try {
        await Promise.all(
          orderIds.map(async (orderId) => {
            const updates: Record<string, unknown> = {
              status: newStatus,
              updatedAt: serverTimestamp(),
            };
            const timestampField = STATUS_TIMESTAMP_FIELDS[newStatus];
            if (timestampField) updates[timestampField] = serverTimestamp();
            await updateDoc(doc(db, col("orders"), orderId), updates);

            try {
              const notifyFn = httpsCallable(functions, "notifyOrderStatusChange");
              notifyFn({ orderId, newStatus, collectionName: col("orders") }).catch(() => {});
            } catch {}
          })
        );
        toast.success(`${orderIds.length} order(s) updated to ${newStatus}.`);
      } catch (err: any) {
        console.error("[C2] Bulk status change failed:", err);
        toast.error(`Failed to update orders: ${err.message}`);
      }
    },
    [col]
  );

  // ── OTP Fulfill intercept ──
  const handleFulfillClick = useCallback(
    (order: Order) => {
      const hasAnyContact = !!(order.userEmail || order.phone || order.userId);
      if (otp.required && hasAnyContact) {
        otp.openDialog(order);
      } else {
        doStatusChange(order.id, "Fulfilled");
      }
    },
    [otp, doStatusChange]
  );

  // ── Fullscreen toggle ──
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Drag resize for bottom panel ──
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      dragStartY.current = e.clientY;
      dragStartH.current = bottomHeight;
      e.preventDefault();

      const handleMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = dragStartY.current - ev.clientY;
        const newH = Math.max(160, Math.min(600, dragStartH.current + delta));
        latestBottomH.current = newH;
        setBottomHeight(newH);
      };
      const handleUp = () => {
        isDraggingRef.current = false;
        writeStorage("kkr-c2-bottom-h", latestBottomH.current);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [bottomHeight]
  );

  // ── Theme toggle ──
  const toggleTheme = () => {
    const next: C2Theme = c2Theme === "dark" ? "light" : "dark";
    setC2Theme(next);
    writeStorage("kkr-c2-theme", next);
  };

  // ── Layout change ──
  const changeLayout = (key: C2LayoutKey) => {
    setLayoutKey(key);
    writeStorage("kkr-c2-layout", key);
  };

  // ── Feature 2: Mute toggle ──
  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      writeStorage("kkr-c2-muted", next);
      return next;
    });
  };

  // ── Feature 5: Export ──
  const handleExport = () => {
    if (filteredOrders.length === 0) {
      toast.error("No orders to export.");
      return;
    }
    exportOrdersToCSV(filteredOrders);
    toast.success(`Exported ${filteredOrders.length} orders to CSV.`);
  };

  // ── Feature 8: Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl+K / Cmd+K — always works (even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((p) => !p);
        return;
      }

      if (isInput) return;

      // M — toggle mute
      if (e.key === "m" || e.key === "M") {
        toggleMute();
        return;
      }

      // 1-4 — switch date range
      const rangeIndex = parseInt(e.key) - 1;
      if (rangeIndex >= 0 && rangeIndex < C2_DATE_RANGES.length) {
        setDateRange(C2_DATE_RANGES[rangeIndex].key);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className={`c2-root ${c2Theme === "dark" ? "c2-dark" : ""} flex items-center justify-center min-h-[600px]`}>
        <div className="text-center">
          <div className="relative inline-flex mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="text-sm font-bold tracking-wide" style={{ color: "var(--c2-text)" }}>
            Command Center
          </div>
          <div className="text-[10px] mt-1 font-medium" style={{ color: "var(--c2-text-muted)" }}>
            Establishing real-time data links...
          </div>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--c2-text-muted)", animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`c2-root ${c2Theme === "dark" ? "c2-dark" : ""} min-h-[calc(100vh-120px)] flex flex-col`}
    >
      {/* ─── C2 Header ───────────────────────────────────────── */}
      <div
        className="c2-header flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        {/* ── Left: Identity + Status ── */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-xs sm:text-sm font-bold tracking-wider leading-none" style={{ color: "var(--c2-text)", letterSpacing: "0.08em" }}>
                COMMAND CENTER
              </h2>
              <span className="text-[9px] font-medium leading-none" style={{ color: "var(--c2-text-muted)" }}>
                KKR Groceries
              </span>
            </div>
            <h2 className="sm:hidden text-xs font-bold tracking-wider" style={{ color: "var(--c2-text)", letterSpacing: "0.06em" }}>
              C2
            </h2>
          </div>

          {/* Database mode badge */}
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-md hidden sm:inline-flex items-center gap-1"
            style={{
              background: mode === "test" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.08)",
              color: mode === "test" ? "#d97706" : "#059669",
              border: `1px solid ${mode === "test" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
            }}
          >
            {mode === "test" ? <FlaskConical className="w-3 h-3" /> : <Database className="w-3 h-3" />}
            {mode === "test" ? "TEST" : "LIVE"}
          </span>

          {/* LIVE pulse indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-emerald-500 hidden sm:inline tracking-wider">LIVE</span>
          </div>
        </div>

        {/* ── Right: Controls ── */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* ── Control Group 1: Data Filters ── */}
          {stores.length > 0 && (
            <StoreFilter
              stores={stores}
              selectedStoreIds={selectedStoreIds}
              onSelectionChange={setSelectedStoreIds}
            />
          )}

          {/* Date range — segmented control on md+ */}
          <div className="hidden md:flex items-center rounded-lg p-0.5" style={{ background: "var(--c2-bg-secondary)", border: "1px solid var(--c2-border-subtle)" }}>
            {C2_DATE_RANGES.map((range, i) => (
              <button
                key={range.key}
                onClick={() => setDateRange(range.key)}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all"
                style={{
                  background: dateRange === range.key ? "var(--c2-bg-card)" : "transparent",
                  color: dateRange === range.key ? "var(--c2-text)" : "var(--c2-text-muted)",
                  boxShadow: dateRange === range.key ? "var(--c2-card-shadow)" : "none",
                }}
                title={`${range.label} (${i + 1})`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as C2DateRange)}
            className="md:hidden text-[10px] font-medium rounded-md px-2 py-1 outline-none cursor-pointer"
            style={{
              background: "var(--c2-bg-secondary)",
              color: "var(--c2-text-secondary)",
              border: "1px solid var(--c2-border)",
            }}
          >
            {C2_DATE_RANGES.map((range) => (
              <option key={range.key} value={range.key}>
                {range.shortLabel}
              </option>
            ))}
          </select>

          <div className="c2-divider-v hidden sm:block" />

          {/* ── Control Group 2: Actions ── */}
          <button
            onClick={() => setSearchOpen(true)}
            className="c2-ctrl-btn flex items-center gap-1"
            title="Search orders (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <kbd
              className="hidden lg:inline text-[9px] px-1 py-0.5 rounded font-mono"
              style={{
                background: "var(--c2-bg-secondary)",
                border: "1px solid var(--c2-border-subtle)",
                color: "var(--c2-text-muted)",
              }}
            >
              {"\u2318"}K
            </kbd>
          </button>

          <button onClick={handleExport} className="c2-ctrl-btn" title="Export orders to CSV">
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={toggleMute}
            className="c2-ctrl-btn"
            style={{ color: isMuted ? "var(--c2-text-muted)" : "#059669" }}
            title={isMuted ? "Unmute notifications (M)" : "Mute notifications (M)"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="c2-divider-v hidden md:block" />

          {/* ── Control Group 3: View Settings ── */}
          <div className="hidden md:flex items-center gap-0.5">
            <LayoutGrid className="w-3.5 h-3.5 ml-0.5" style={{ color: "var(--c2-text-muted)" }} />
            <select
              value={layoutKey}
              onChange={(e) => changeLayout(e.target.value as C2LayoutKey)}
              className="text-[10px] font-medium rounded-md px-1.5 py-1 outline-none cursor-pointer"
              style={{
                background: "transparent",
                color: "var(--c2-text-secondary)",
                border: "none",
              }}
            >
              {Object.entries(C2_LAYOUTS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <button onClick={toggleTheme} className="c2-ctrl-btn" title={c2Theme === "dark" ? "Light mode" : "Dark mode"}>
            {c2Theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button onClick={toggleFullscreen} className="c2-ctrl-btn" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Strip ─────────────────────────────── */}
      <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--c2-border-subtle)", background: "var(--c2-bg)" }}>
        <LiveMetrics
          todayRevenue={displayRevenue}
          activeOrders={activeOrders}
          onlineUsers={onlineUsers.length}
          fulfillmentRate={fulfillmentRate}
          avgOrderValue={avgOrderValue}
          pendingRevenue={pendingRevenue}
          yesterdayRevenue={dateRange === "today" ? yesterdayRevenue : undefined}
          revenueLabel={revenueLabel}
          theme={c2Theme}
          onCardClick={(metric) => setMetricDetail(metricDetail === metric ? null : metric)}
        />
      </div>

      {/* ─── Metric Detail Panel ─────────────────────────────── */}
      {metricDetail && (
        <div className="px-4 py-2.5 shrink-0 overflow-hidden" style={{ borderBottom: "1px solid var(--c2-border)", background: "var(--c2-bg-secondary)", maxHeight: 200 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--c2-text-muted)" }}>
              {metricDetail === "revenue" && "Fulfilled Orders (Revenue)"}
              {metricDetail === "active" && "Active Orders"}
              {metricDetail === "users" && "Online Users"}
              {metricDetail === "fulfillment" && "Fulfillment Breakdown"}
              {metricDetail === "aov" && "Fulfilled Order Values"}
              {metricDetail === "pending" && "Pending Revenue Orders"}
            </span>
            <button onClick={() => setMetricDetail(null)} className="p-0.5 rounded hover:opacity-70">
              <X className="w-3.5 h-3.5" style={{ color: "var(--c2-text-muted)" }} />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[140px] no-scrollbar">
            {(metricDetail === "revenue" || metricDetail === "aov") && (() => {
              const fulfilled = filteredOrders.filter((o) => o.status === "Fulfilled");
              return fulfilled.length === 0 ? (
                <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No fulfilled orders</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead><tr style={{ color: "var(--c2-text-muted)" }}><th className="text-left py-1 font-semibold">Customer</th><th className="text-left py-1 font-semibold">Items</th><th className="text-right py-1 font-semibold">Value</th></tr></thead>
                  <tbody>{fulfilled.sort((a, b) => parseTotal(b.totalValue) - parseTotal(a.totalValue)).map((o) => (
                    <tr key={o.id} className="cursor-pointer hover:brightness-110" style={{ borderTop: "1px solid var(--c2-border-subtle)" }}
                      onClick={() => { setSelectedOrderId(o.id); onNavigateToOrder?.(o.id); }}>
                      <td className="py-1" style={{ color: "var(--c2-text)" }}>{o.customerName || "Customer"}</td>
                      <td className="py-1" style={{ color: "var(--c2-text-muted)" }}>{o.cart?.length || 0}</td>
                      <td className="py-1 text-right font-semibold" style={{ color: "#10b981" }}>₹{parseTotal(o.totalValue).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              );
            })()}
            {metricDetail === "active" && (() => {
              const active = filteredOrders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected");
              return active.length === 0 ? (
                <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No active orders</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead><tr style={{ color: "var(--c2-text-muted)" }}><th className="text-left py-1 font-semibold">Customer</th><th className="text-left py-1 font-semibold">Status</th><th className="text-right py-1 font-semibold">Value</th></tr></thead>
                  <tbody>{active.map((o) => (
                    <tr key={o.id} className="cursor-pointer hover:brightness-110" style={{ borderTop: "1px solid var(--c2-border-subtle)" }}
                      onClick={() => setSelectedOrderId(o.id)}>
                      <td className="py-1" style={{ color: "var(--c2-text)" }}>{o.customerName || "Customer"}</td>
                      <td className="py-1"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6"}20`, color: o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6" }}>{o.status}</span></td>
                      <td className="py-1 text-right font-semibold" style={{ color: "var(--c2-text)" }}>₹{parseTotal(o.totalValue).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              );
            })()}
            {metricDetail === "users" && (
              onlineUsers.length === 0 ? (
                <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No users online</div>
              ) : (
                <div className="space-y-1">
                  {onlineUsers.map((u) => (
                    <div key={u.uid} className="flex items-center gap-2 py-1" style={{ borderTop: "1px solid var(--c2-border-subtle)" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-[10px] font-medium truncate" style={{ color: "var(--c2-text)" }}>{u.displayName || u.email || "User"}</span>
                    </div>
                  ))}
                </div>
              )
            )}
            {metricDetail === "fulfillment" && (() => {
              const total = filteredOrders.length;
              const statuses = [
                { label: "Fulfilled", count: filteredOrders.filter((o) => o.status === "Fulfilled").length, color: "#10b981" },
                { label: "Shipped", count: filteredOrders.filter((o) => o.status === "Shipped").length, color: "#8b5cf6" },
                { label: "Accepted", count: filteredOrders.filter((o) => o.status === "Accepted").length, color: "#3b82f6" },
                { label: "Pending", count: filteredOrders.filter((o) => o.status === "Pending").length, color: "#f59e0b" },
                { label: "Rejected", count: filteredOrders.filter((o) => o.status === "Rejected").length, color: "#ef4444" },
              ];
              return (
                <div className="space-y-1.5">
                  {statuses.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[10px] flex-1" style={{ color: "var(--c2-text-secondary)" }}>{s.label}</span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--c2-text)" }}>{s.count}</span>
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c2-bg-secondary)" }}>
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%`, background: s.color }} />
                      </div>
                      <span className="text-[9px] w-8 text-right" style={{ color: "var(--c2-text-muted)" }}>{total > 0 ? Math.round((s.count / total) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {metricDetail === "pending" && (() => {
              const pending = filteredOrders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected");
              return pending.length === 0 ? (
                <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No pending revenue</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead><tr style={{ color: "var(--c2-text-muted)" }}><th className="text-left py-1 font-semibold">Customer</th><th className="text-left py-1 font-semibold">Status</th><th className="text-right py-1 font-semibold">Value</th></tr></thead>
                  <tbody>{pending.map((o) => (
                    <tr key={o.id} style={{ borderTop: "1px solid var(--c2-border-subtle)" }}>
                      <td className="py-1" style={{ color: "var(--c2-text)" }}>{o.customerName || "Customer"}</td>
                      <td className="py-1"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6"}20`, color: o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6" }}>{o.status}</span></td>
                      <td className="py-1 text-right font-semibold" style={{ color: "#f97316" }}>₹{parseTotal(o.totalValue).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Map Expanded Mode ─────────────────────────────── */}
      {isMapExpanded ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <OrderMap
            orders={filteredOrders}
            theme={c2Theme}
            onStatusChange={handleStatusChange}
            onViewFullOrder={onNavigateToOrder}
            deliveryZone={deliveryZone}
            onlineUsers={onlineUsersWithLocation}
            stores={stores}
            isExpanded={true}
            onToggleExpand={() => setIsMapExpanded(false)}
            highlightOrderId={selectedOrderId}
          />
        </div>
      ) : (
        <>
          {/* ─── Main Content Grid ─────────────────────────────── */}
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
            {/* Left: Map */}
            <div
              className="overflow-hidden min-h-[300px] lg:min-h-0 lg:border-r"
              style={{
                gridColumn: `span ${layout.mapCols}`,
                borderColor: "var(--c2-border-subtle)",
              }}
            >
              <OrderMap
                orders={filteredOrders}
                theme={c2Theme}
                onStatusChange={handleStatusChange}
                onViewFullOrder={onNavigateToOrder}
                deliveryZone={deliveryZone}
                onlineUsers={onlineUsersWithLocation}
                stores={stores}
                isExpanded={false}
                onToggleExpand={() => setIsMapExpanded(true)}
                highlightOrderId={selectedOrderId}
              />
            </div>

            {/* Right: Pipeline */}
            <div className="overflow-hidden min-h-[300px] lg:min-h-0" style={{ gridColumn: `span ${layout.pipeCols}` }}>
              <OrderPipeline
                orders={filteredOrders}
                onStatusChange={handleStatusChange}
                onBulkStatusChange={handleBulkStatusChange}
                onFulfillClick={handleFulfillClick}
                theme={c2Theme}
                onOrderSelect={(id) => setSelectedOrderId(id)}
              />
            </div>
          </div>

          {/* ─── Drag Handle ──────────────────────────────────── */}
          <div
            onMouseDown={handleDragStart}
            className="c2-drag-handle h-2 shrink-0"
            style={{ borderTop: "1px solid var(--c2-border)", background: "var(--c2-bg)" }}
            title="Drag to resize bottom panel"
          />

          {/* ─── Bottom Panel ──────────────────────────────────── */}
          <div
            className="flex flex-col lg:grid lg:grid-cols-12 gap-0 shrink-0"
            style={{ height: `${bottomHeight}px` }}
          >
            {/* Activity Feed */}
            <div
              className="overflow-hidden lg:border-r"
              style={{
                gridColumn: `span ${layout.feedCols}`,
                borderColor: "var(--c2-border-subtle)",
              }}
            >
              <ActivityFeed orders={orders} onlineUsers={onlineUsersWithLocation} theme={c2Theme} />
            </div>

            {/* Mini Charts + Store Analytics */}
            <div className="overflow-hidden flex flex-col lg:flex-row" style={{ gridColumn: `span ${layout.chartCols}` }}>
              <div className={`overflow-hidden ${stores.length > 0 ? "lg:w-1/2 lg:border-r" : "w-full"}`} style={{ borderColor: "var(--c2-border-subtle)" }}>
                <MiniCharts orders={filteredOrders} allOrders={orders} theme={c2Theme} dateRange={dateRange} />
              </div>
              {stores.length > 0 && (
                <div className="overflow-hidden lg:w-1/2">
                  <StoreAnalytics orders={filteredOrders} stores={stores} theme={c2Theme} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Feature 6: Search Overlay ─────────────────────── */}
      <OrderSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        orders={orders}
        onSelectOrder={onNavigateToOrder}
      />

      {/* ─── OTP Fulfill Dialog ─────────────────────────────── */}
      {otp.dialogOrder && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-[scaleIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Delivery OTP Verification</h3>
              <button
                onClick={otp.closeDialog}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Customer info with channel display */}
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1.5">
              <p><strong>{otp.dialogOrder.customerName}</strong></p>
              {otp.dialogOrder.phone && <p className="text-xs text-slate-500">📱 {otp.dialogOrder.phone}</p>}
              {otp.dialogOrder.userEmail && <p className="text-xs text-slate-500">📧 {otp.dialogOrder.userEmail}</p>}
              <p className="text-xs text-slate-400 pt-1 border-t border-slate-200">
                Channel: <span className="font-semibold uppercase tracking-wider">
                  {[otp.channels.email && "Email", otp.channels.sms && "SMS", otp.channels.app && "App"]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </p>
            </div>

            {(() => {
              const wantEmail = otp.channels.email;
              const wantSms = otp.channels.sms;
              const wantApp = otp.channels.app;
              const hasEmail = !!otp.dialogOrder!.userEmail;
              const hasPhone = !!otp.dialogOrder!.phone;
              const hasApp = !!otp.dialogOrder!.userId;
              const canSend = (wantEmail && hasEmail) || (wantSms && hasPhone) || (wantApp && hasApp);
              const enabledCount = (wantEmail ? 1 : 0) + (wantSms ? 1 : 0) + (wantApp ? 1 : 0);

              const channelParts: string[] = [];
              if (wantSms && hasPhone) channelParts.push("SMS");
              if (wantEmail && hasEmail) channelParts.push("Email");
              if (wantApp && hasApp) channelParts.push("App");
              const channelLabel = channelParts.length > 0 ? channelParts.join(" & ") : "N/A";

              return !otp.sent ? (
                <div className="space-y-3">
                  <button
                    onClick={otp.send}
                    disabled={otp.sending || !canSend}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {otp.sending ? "Sending OTP..." : `Send OTP via ${channelLabel}`}
                  </button>
                  {!canSend && (
                    <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-2">
                      No contact info for selected channel{enabledCount > 1 ? "s" : ""}.
                      {!hasPhone && wantSms && <span className="block text-xs mt-0.5">Phone number missing.</span>}
                      {!hasEmail && wantEmail && <span className="block text-xs mt-0.5">Email missing.</span>}
                      {!hasApp && wantApp && <span className="block text-xs mt-0.5">Buyer not signed in (no app account on this order).</span>}
                      <button
                        className="mt-2 w-full py-1.5 text-xs border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
                        onClick={() => {
                          doStatusChange(otp.dialogOrder!.id, "Fulfilled");
                          otp.closeDialog();
                        }}
                      >
                        Fulfill Without OTP
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    {otp.smsSent && (
                      <p className="text-sm text-emerald-600 font-medium">✓ SMS sent to {otp.dialogOrder!.phone}</p>
                    )}
                    {otp.emailSent && (
                      <p className="text-sm text-emerald-600 font-medium">✓ Email sent to {otp.dialogOrder!.userEmail}</p>
                    )}
                    {otp.appSent && (
                      <p className="text-sm text-emerald-600 font-medium">✓ App banner active for buyer</p>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp.code}
                    onChange={(e) => otp.setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono border-2 border-slate-200 rounded-xl py-3 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={otp.verify}
                    disabled={otp.verifying || otp.code.length < 4}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {otp.verifying ? "Verifying..." : "Verify & Fulfill"}
                  </button>
                  <button
                    onClick={otp.send}
                    disabled={otp.sending}
                    className="w-full py-2 text-sm text-slate-500 hover:text-slate-700"
                  >
                    Resend OTP
                  </button>
                </div>
              );
            })()}

            {otp.error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2 whitespace-pre-line">{otp.error}</div>
            )}
          </div>
        </div>
      )}
      {/* ─── Assign Delivery Dialog ─────────────────────── */}
      <AssignDeliveryDialog
        open={assignDialogOpen}
        order={assignDialogOrder}
        onClose={() => {
          setAssignDialogOpen(false);
          setAssignDialogOrder(null);
          pendingAssignCallbackRef.current = null;
        }}
        onAssigned={() => {
          setAssignDialogOpen(false);
          setAssignDialogOrder(null);
          // Proceed with the original status change
          if (pendingAssignCallbackRef.current) {
            pendingAssignCallbackRef.current();
            pendingAssignCallbackRef.current = null;
          }
        }}
      />

      {/* Hidden reCAPTCHA container for SMS OTP */}
      <div id="c2-otp-recaptcha-container" />
    </div>
  );
}
