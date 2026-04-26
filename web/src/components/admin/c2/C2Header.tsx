"use client";

import {
  Database,
  Download,
  FlaskConical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Moon,
  Search,
  Sun,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import StoreFilter from "./StoreFilter";
import type { Store } from "@/types/settings";
import type { C2Theme, C2DateRange } from "../CommandCenter";

type C2LayoutKey = "balanced" | "map-focus" | "pipeline-focus" | "analytics-focus";

interface C2HeaderProps {
  mode: string;
  stores: Store[];
  selectedStoreIds: string[];
  setSelectedStoreIds: (ids: string[]) => void;

  dateRange: C2DateRange;
  setDateRange: (r: C2DateRange) => void;
  dateRanges: { key: C2DateRange; label: string; shortLabel: string }[];

  layoutKey: C2LayoutKey;
  layouts: Record<C2LayoutKey, { label: string }>;
  changeLayout: (k: C2LayoutKey) => void;

  c2Theme: C2Theme;
  toggleTheme: () => void;

  isMuted: boolean;
  toggleMute: () => void;

  isFullscreen: boolean;
  toggleFullscreen: () => void;

  onSearch: () => void;
  onExport: () => void;
}

export function C2Header({
  mode,
  stores,
  selectedStoreIds,
  setSelectedStoreIds,
  dateRange,
  setDateRange,
  dateRanges,
  layoutKey,
  layouts,
  changeLayout,
  c2Theme,
  toggleTheme,
  isMuted,
  toggleMute,
  isFullscreen,
  toggleFullscreen,
  onSearch,
  onExport,
}: C2HeaderProps) {
  return (
    <div
      className="c2-header flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 shrink-0"
      style={{ borderBottom: "1px solid var(--c2-border)" }}
    >
      {/* ── Left: Identity + Status ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h2
              className="text-xs sm:text-sm font-bold tracking-wider leading-none"
              style={{ color: "var(--c2-text)", letterSpacing: "0.08em" }}
            >
              COMMAND CENTER
            </h2>
            <span className="text-[9px] font-medium leading-none" style={{ color: "var(--c2-text-muted)" }}>
              KKR Groceries
            </span>
          </div>
          <h2
            className="sm:hidden text-xs font-bold tracking-wider"
            style={{ color: "var(--c2-text)", letterSpacing: "0.06em" }}
          >
            C2
          </h2>
        </div>

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
        {stores.length > 0 && (
          <StoreFilter
            stores={stores}
            selectedStoreIds={selectedStoreIds}
            onSelectionChange={setSelectedStoreIds}
          />
        )}

        <div
          className="hidden md:flex items-center rounded-lg p-0.5"
          style={{ background: "var(--c2-bg-secondary)", border: "1px solid var(--c2-border-subtle)" }}
        >
          {dateRanges.map((range, i) => (
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
          {dateRanges.map((range) => (
            <option key={range.key} value={range.key}>
              {range.shortLabel}
            </option>
          ))}
        </select>

        <div className="c2-divider-v hidden sm:block" />

        <button onClick={onSearch} className="c2-ctrl-btn flex items-center gap-1" title="Search orders (Ctrl+K)">
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

        <button onClick={onExport} className="c2-ctrl-btn" title="Export orders to CSV">
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
            {Object.entries(layouts).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={toggleTheme}
          className="c2-ctrl-btn"
          title={c2Theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {c2Theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleFullscreen}
          className="c2-ctrl-btn"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
