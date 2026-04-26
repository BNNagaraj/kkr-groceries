"use client";

import { useEffect, useRef, useState } from "react";
import {
  Database,
  Download,
  FlaskConical,
  Maximize2,
  Minimize2,
  MoreHorizontal,
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

interface C2HeaderProps {
  mode: string;
  stores: Store[];
  selectedStoreIds: string[];
  setSelectedStoreIds: (ids: string[]) => void;

  dateRange: C2DateRange;
  setDateRange: (r: C2DateRange) => void;
  dateRanges: { key: C2DateRange; label: string; shortLabel: string }[];

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
  c2Theme,
  toggleTheme,
  isMuted,
  toggleMute,
  isFullscreen,
  toggleFullscreen,
  onSearch,
  onExport,
}: C2HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const isTest = mode === "test";

  return (
    <div
      className="c2-header flex items-center justify-between px-3 sm:px-5 py-2 shrink-0 gap-2"
      style={{ borderBottom: "1px solid var(--c2-border)" }}
    >
      {/* ── Left: compact identity ── */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
        >
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0"
          style={{
            background: isTest ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.08)",
            color: isTest ? "#d97706" : "#059669",
            border: `1px solid ${isTest ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
          }}
        >
          {isTest ? <FlaskConical className="w-3 h-3" /> : <Database className="w-3 h-3" />}
          {isTest ? "TEST" : "LIVE"}
        </span>
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {stores.length > 0 && (
          <StoreFilter
            stores={stores}
            selectedStoreIds={selectedStoreIds}
            onSelectionChange={setSelectedStoreIds}
          />
        )}

        {/* Date range — pill group on md+, native select on mobile */}
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

        {/* Overflow menu — secondary controls */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="c2-ctrl-btn"
            title="More"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-44 rounded-lg overflow-hidden z-50"
              style={{
                background: "var(--c2-bg-card)",
                border: "1px solid var(--c2-border)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
              }}
            >
              <MenuItem
                icon={isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                label={isMuted ? "Unmute alerts" : "Mute alerts"}
                shortcut="M"
                onClick={() => { toggleMute(); setMenuOpen(false); }}
                accent={isMuted ? undefined : "#059669"}
              />
              <MenuItem
                icon={<Download className="w-3.5 h-3.5" />}
                label="Export CSV"
                onClick={() => { onExport(); setMenuOpen(false); }}
              />
              <MenuItem
                icon={c2Theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                label={c2Theme === "dark" ? "Light mode" : "Dark mode"}
                onClick={() => { toggleTheme(); setMenuOpen(false); }}
              />
              <MenuItem
                icon={isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                onClick={() => { toggleFullscreen(); setMenuOpen(false); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      style={{ color: accent || "var(--c2-text)" }}
    >
      <span className="flex items-center gap-2">
        <span style={{ color: accent || "var(--c2-text-muted)" }}>{icon}</span>
        {label}
      </span>
      {shortcut && (
        <kbd
          className="text-[9px] px-1 py-0.5 rounded font-mono"
          style={{
            background: "var(--c2-bg-secondary)",
            border: "1px solid var(--c2-border-subtle)",
            color: "var(--c2-text-muted)",
          }}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
