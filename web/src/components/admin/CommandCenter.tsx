"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { db, functions } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { Order, OrderStatus, STATUS_TIMESTAMP_FIELDS } from "@/types/order";
import type { DeliverySettings } from "@/types/settings";
import { DEFAULT_DELIVERY } from "@/types/settings";
import { parseTotal } from "@/lib/helpers";
import { toast } from "sonner";
import type { OnlineUserMarker } from "./c2/OrderMap";

import LiveMetrics from "./c2/LiveMetrics";
import OrderPipeline from "./c2/OrderPipeline";
import ActivityFeed from "./c2/ActivityFeed";
import OrderMap from "./c2/OrderMap";
import MiniCharts from "./c2/MiniCharts";

import {
  Zap,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  LayoutGrid,
  FlaskConical,
  Database,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type C2Theme = "light" | "dark";

type C2LayoutKey = "balanced" | "map-focus" | "pipeline-focus" | "analytics-focus";

interface C2LayoutConfig {
  label: string;
  mapCols: number;
  pipeCols: number;
  feedCols: number;
  chartCols: number;
  bottomHeight: number;
}

interface PresenceDoc {
  uid: string;
  userId?: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  lastSeen: Timestamp | null;
  online?: boolean;
  status?: string;
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isToday(order: Order): boolean {
  const raw = order.timestamp || "";
  if (!raw) return false;
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return raw.startsWith(todayStr);
}

function isYesterday(order: Order): boolean {
  const raw = order.timestamp || "";
  if (!raw) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return raw.startsWith(yStr);
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface CommandCenterProps {
  onNavigateToOrder?: (orderId: string) => void;
}

// ─── Main Command Center ─────────────────────────────────────────────────────
export default function CommandCenter({ onNavigateToOrder }: CommandCenterProps) {
  const { col, mode } = useMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Theme state ──
  const [c2Theme, setC2Theme] = useState<C2Theme>(() =>
    readStorage<C2Theme>("kkr-c2-theme", "light")
  );

  // ── Layout state ──
  const [layoutKey, setLayoutKey] = useState<C2LayoutKey>(() =>
    readStorage<C2LayoutKey>("kkr-c2-layout", "balanced")
  );
  const layout = C2_LAYOUTS[layoutKey] || C2_LAYOUTS.balanced;

  // ── Bottom panel height (custom via drag) ──
  const [bottomHeight, setBottomHeight] = useState<number>(() =>
    readStorage<number>("kkr-c2-bottom-h", layout.bottomHeight)
  );
  const isDraggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  // Sync bottom height when layout preset changes
  useEffect(() => {
    setBottomHeight(layout.bottomHeight);
    writeStorage("kkr-c2-bottom-h", layout.bottomHeight);
  }, [layout.bottomHeight]);

  // ── Real-time order listener ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, col("orders")),
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

  // ── Presence listener ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "presence"),
      (snap) => {
        const now = Date.now();
        const twoMinutesAgo = now - 2 * 60 * 1000;
        const users: PresenceDoc[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as PresenceDoc;
          const lastSeen = data.lastSeen;
          let lastSeenMs = 0;
          if (lastSeen && typeof lastSeen.toMillis === "function") {
            lastSeenMs = lastSeen.toMillis();
          }
          const isMarkedOnline = data.online === true || data.status === "online";
          if (isMarkedOnline && lastSeenMs > twoMinutesAgo) {
            users.push({ ...data, uid: data.uid || data.userId || d.id, lastSeen });
          }
        });
        setOnlineUsers(users);
      },
      (err) => {
        console.warn("[C2] Presence listener error:", err.message);
      }
    );
    return unsub;
  }, []);

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

  // ── Online users with locations (from recent orders) ──
  const onlineUsersWithLocation = useMemo<OnlineUserMarker[]>(() => {
    return onlineUsers.map((u) => {
      // Find most recent order by this user (match by uid, email, or phone)
      const userOrder = orders.find(
        (o) =>
          (o.userId && o.userId === u.uid) ||
          (o.userEmail && u.email && o.userEmail === u.email) ||
          (o.phone && u.phone && o.phone === u.phone)
      );
      return {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        lat: userOrder?.lat,
        lng: userOrder?.lng,
        location: userOrder?.location,
      };
    });
  }, [onlineUsers, orders]);

  // ── Derived data ──
  const todayOrders = useMemo(() => orders.filter(isToday), [orders]);
  const yesterdayOrders = useMemo(() => orders.filter(isYesterday), [orders]);

  const todayRevenue = useMemo(
    () => todayOrders.filter((o) => o.status === "Fulfilled").reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [todayOrders]
  );
  const yesterdayRevenue = useMemo(
    () => yesterdayOrders.filter((o) => o.status === "Fulfilled").reduce((s, o) => s + parseTotal(o.totalValue), 0),
    [yesterdayOrders]
  );
  const activeOrders = useMemo(
    () => todayOrders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected").length,
    [todayOrders]
  );
  const fulfillmentRate = useMemo(() => {
    const total = todayOrders.length;
    if (total === 0) return 0;
    return Math.round((todayOrders.filter((o) => o.status === "Fulfilled").length / total) * 100);
  }, [todayOrders]);
  const avgOrderValue = useMemo(() => {
    const f = todayOrders.filter((o) => o.status === "Fulfilled");
    if (f.length === 0) return 0;
    return Math.round(f.reduce((s, o) => s + parseTotal(o.totalValue), 0) / f.length);
  }, [todayOrders]);

  // ── Status change handler ──
  const handleStatusChange = useCallback(
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
        setBottomHeight(newH);
      };
      const handleUp = () => {
        isDraggingRef.current = false;
        writeStorage("kkr-c2-bottom-h", bottomHeight);
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

  // ── Loading state ──
  if (loading) {
    return (
      <div className={`c2-root ${c2Theme === "dark" ? "c2-dark" : ""} flex items-center justify-center min-h-[600px]`}>
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          </div>
          <div className="text-sm mt-4 font-medium" style={{ color: "var(--c2-text-secondary)" }}>
            Initializing Command Center...
          </div>
          <div className="text-[10px] mt-1" style={{ color: "var(--c2-text-muted)" }}>
            Establishing real-time data links
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
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold tracking-wide" style={{ color: "var(--c2-text)" }}>
              COMMAND CENTER
            </h2>
          </div>
          <span className="text-[10px] font-mono hidden sm:inline" style={{ color: "var(--c2-text-muted)" }}>
            KKR Groceries
          </span>
          {/* Database mode indicator */}
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1"
            style={{
              background: mode === "test" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
              color: mode === "test" ? "#f59e0b" : "#10b981",
              border: `1px solid ${mode === "test" ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
            }}
          >
            {mode === "test" ? <FlaskConical className="w-3 h-3" /> : <Database className="w-3 h-3" />}
            {mode === "test" ? "TEST DB" : "LIVE DB"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[11px] font-semibold text-green-500">LIVE</span>
          </div>

          {/* Layout preset selector */}
          <div className="hidden md:flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" style={{ color: "var(--c2-text-muted)" }} />
            <select
              value={layoutKey}
              onChange={(e) => changeLayout(e.target.value as C2LayoutKey)}
              className="text-[10px] font-medium rounded-md px-2 py-1 outline-none cursor-pointer"
              style={{
                background: "var(--c2-bg-secondary)",
                color: "var(--c2-text-secondary)",
                border: "1px solid var(--c2-border)",
              }}
            >
              {Object.entries(C2_LAYOUTS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--c2-text-muted)" }}
            title={c2Theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {c2Theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--c2-text-muted)" }}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Strip ─────────────────────────────── */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--c2-border-subtle)" }}>
        <LiveMetrics
          todayRevenue={todayRevenue}
          activeOrders={activeOrders}
          onlineUsers={onlineUsers.length}
          fulfillmentRate={fulfillmentRate}
          avgOrderValue={avgOrderValue}
          yesterdayRevenue={yesterdayRevenue}
          theme={c2Theme}
        />
      </div>

      {/* ─── Map Expanded Mode ─────────────────────────────── */}
      {isMapExpanded ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <OrderMap
            orders={orders}
            theme={c2Theme}
            onStatusChange={handleStatusChange}
            onViewFullOrder={onNavigateToOrder}
            deliveryZone={deliveryZone}
            onlineUsers={onlineUsersWithLocation}
            isExpanded={true}
            onToggleExpand={() => setIsMapExpanded(false)}
          />
        </div>
      ) : (
        <>
          {/* ─── Main Content Grid ─────────────────────────────── */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
            {/* Left: Map */}
            <div
              className="overflow-hidden"
              style={{
                gridColumn: `span ${layout.mapCols}`,
                borderRight: "1px solid var(--c2-border-subtle)",
              }}
            >
              <OrderMap
                orders={orders}
                theme={c2Theme}
                onStatusChange={handleStatusChange}
                onViewFullOrder={onNavigateToOrder}
                deliveryZone={deliveryZone}
                onlineUsers={onlineUsersWithLocation}
                isExpanded={false}
                onToggleExpand={() => setIsMapExpanded(true)}
              />
            </div>

            {/* Right: Pipeline */}
            <div className="overflow-hidden" style={{ gridColumn: `span ${layout.pipeCols}` }}>
              <OrderPipeline
                orders={todayOrders}
                onStatusChange={handleStatusChange}
                theme={c2Theme}
              />
            </div>
          </div>

          {/* ─── Drag Handle ──────────────────────────────────── */}
          <div
            onMouseDown={handleDragStart}
            className="c2-drag-handle h-1 shrink-0"
            style={{ borderTop: "1px solid var(--c2-border-subtle)" }}
            title="Drag to resize bottom panel"
          />

          {/* ─── Bottom Panel ──────────────────────────────────── */}
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-0 shrink-0"
            style={{ height: `${bottomHeight}px` }}
          >
            {/* Activity Feed */}
            <div
              className="overflow-hidden"
              style={{
                gridColumn: `span ${layout.feedCols}`,
                borderRight: "1px solid var(--c2-border-subtle)",
              }}
            >
              <ActivityFeed orders={orders} onlineUsers={onlineUsersWithLocation} theme={c2Theme} />
            </div>

            {/* Mini Charts */}
            <div className="overflow-hidden" style={{ gridColumn: `span ${layout.chartCols}` }}>
              <MiniCharts orders={todayOrders} allOrders={orders} theme={c2Theme} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
