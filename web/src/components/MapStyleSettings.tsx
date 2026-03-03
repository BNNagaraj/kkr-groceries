"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Settings, RotateCcw, X } from "lucide-react";

// ─── Style Control Definitions ──────────────────────────────────────────────
interface StyleControl {
  label: string;
  icon: string;
  featureType?: string;
  elementType: string;
  prop: "saturation" | "lightness";
  min: number;
  max: number;
  default: number;
  key: string;
}

const STYLE_CONTROLS: StyleControl[] = [
  { label: "Overall", icon: "🌍", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 25, key: "geo_sat" },
  { label: "Water S", icon: "💧", featureType: "water", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 50, key: "water_sat" },
  { label: "Water L", icon: "💧", featureType: "water", elementType: "geometry", prop: "lightness", min: -100, max: 100, default: -10, key: "water_lit" },
  { label: "Highway S", icon: "🛣️", featureType: "road.highway", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 30, key: "hwy_sat" },
  { label: "Highway L", icon: "🛣️", featureType: "road.highway", elementType: "geometry", prop: "lightness", min: -100, max: 100, default: -5, key: "hwy_lit" },
  { label: "Roads", icon: "🛤️", featureType: "road.arterial", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 15, key: "road_sat" },
  { label: "Parks S", icon: "🌳", featureType: "poi.park", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 45, key: "park_sat" },
  { label: "Parks L", icon: "🌳", featureType: "poi.park", elementType: "geometry", prop: "lightness", min: -100, max: 100, default: -8, key: "park_lit" },
  { label: "Land S", icon: "🏔️", featureType: "landscape.natural", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 20, key: "land_sat" },
  { label: "Land L", icon: "🏔️", featureType: "landscape.natural", elementType: "geometry", prop: "lightness", min: -100, max: 100, default: -3, key: "land_lit" },
  { label: "Transit", icon: "🚇", featureType: "transit", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 15, key: "transit_sat" },
  { label: "Building S", icon: "🏢", featureType: "landscape.man_made", elementType: "geometry", prop: "saturation", min: -100, max: 100, default: 0, key: "bldg_sat" },
  { label: "Building L", icon: "🏢", featureType: "landscape.man_made", elementType: "geometry", prop: "lightness", min: -100, max: 100, default: 0, key: "bldg_lit" },
];

const STORAGE_KEY = "kkr-map-style-settings";

type SettingsState = Record<string, number>;

function getDefaults(): SettingsState {
  const d: SettingsState = {};
  STYLE_CONTROLS.forEach(c => { d[c.key] = c.default; });
  d["labels"] = 1;
  d["poi"] = 1;
  return d;
}

// ─── Exported Utilities (used by map components on init) ────────────────────
export function loadMapSettings(): SettingsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...getDefaults(), ...JSON.parse(stored) };
  } catch {}
  return getDefaults();
}

export function buildMapStyles(settings: SettingsState): any[] {
  const styles: any[] = [];

  // Group controls by featureType+elementType to combine stylers
  const groups = new Map<string, any[]>();
  STYLE_CONTROLS.forEach(ctrl => {
    const value = settings[ctrl.key] ?? ctrl.default;
    if (value === 0) return;
    const gk = `${ctrl.featureType || "__global__"}|${ctrl.elementType}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk)!.push({ [ctrl.prop]: value });
  });

  groups.forEach((stylers, gk) => {
    const [ft, et] = gk.split("|");
    const entry: any = { elementType: et, stylers };
    if (ft !== "__global__") entry.featureType = ft;
    styles.push(entry);
  });

  // Labels visibility
  if (settings["labels"] === 0) {
    styles.push({ elementType: "labels", stylers: [{ visibility: "off" }] });
  }
  // POI icons visibility
  if (settings["poi"] === 0) {
    styles.push({ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] });
  }

  return styles;
}

// ─── Map Type Options ───────────────────────────────────────────────────────
const MAP_TYPES = [
  { id: "roadmap", label: "Road", icon: "🗺️" },
  { id: "satellite", label: "Satellite", icon: "🛰️" },
  { id: "terrain", label: "Terrain", icon: "⛰️" },
  { id: "hybrid", label: "Hybrid", icon: "🌐" },
];

// ─── Component ──────────────────────────────────────────────────────────────
interface Props {
  mapInstance: any;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export default function MapStyleSettings({ mapInstance, position = "top-left" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(getDefaults);
  const [mapType, setMapType] = useState("roadmap");

  // Load saved settings on mount
  useEffect(() => {
    setSettings(loadMapSettings());
  }, []);

  // Apply styles whenever settings or map instance changes
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.setOptions({ styles: buildMapStyles(settings) });
  }, [settings, mapInstance]);

  const updateSetting = useCallback((key: string, value: number) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleMapType = useCallback((typeId: string) => {
    setMapType(typeId);
    if (mapInstance) mapInstance.setMapTypeId(typeId);
  }, [mapInstance]);

  const resetDefaults = useCallback(() => {
    const d = getDefaults();
    setSettings(d);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
    setMapType("roadmap");
    if (mapInstance) mapInstance.setMapTypeId("roadmap");
  }, [mapInstance]);

  const posClasses: Record<string, string> = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-14",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-14",
  };

  return (
    <div className={`absolute ${posClasses[position]} z-20`}>
      {/* ── Gear Toggle ────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border transition-all duration-200 ${
          isOpen
            ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30"
            : "bg-white/95 backdrop-blur-sm text-slate-500 border-white/60 hover:border-emerald-300 hover:text-emerald-600 hover:shadow-xl"
        }`}
        title="Map Style Settings"
      >
        <Settings className={`w-[18px] h-[18px] transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {/* ── Settings Panel ─────────────────────────────── */}
      {isOpen && (
        <div className="absolute top-12 left-0 w-[280px] bg-white/[0.97] backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎨</span>
              <span className="font-bold text-slate-800 text-[11px] tracking-wide uppercase">Map Settings</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={resetDefaults}
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                title="Reset to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto overscroll-contain">

            {/* ── Map Type ──────────────────────────────── */}
            <div className="px-3.5 py-2.5 border-b border-slate-50">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Map Type</div>
              <div className="grid grid-cols-4 gap-1">
                {MAP_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleMapType(t.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                      mapType === t.id
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm"
                        : "bg-slate-50 text-slate-500 border border-transparent hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    <div className="text-sm mb-0.5">{t.icon}</div>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Toggles ──────────────────────────────── */}
            <div className="px-3.5 py-2.5 border-b border-slate-50 flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings["labels"] !== 0}
                  onChange={e => updateSetting("labels", e.target.checked ? 1 : 0)}
                  className="w-3.5 h-3.5 rounded accent-emerald-600"
                />
                <span className="text-[11px] font-medium text-slate-600">Labels</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings["poi"] !== 0}
                  onChange={e => updateSetting("poi", e.target.checked ? 1 : 0)}
                  className="w-3.5 h-3.5 rounded accent-emerald-600"
                />
                <span className="text-[11px] font-medium text-slate-600">POI Icons</span>
              </label>
            </div>

            {/* ── Color Depth Sliders ──────────────────── */}
            <div className="px-3.5 pt-2.5 pb-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Color Depth</div>
            </div>

            {STYLE_CONTROLS.map(ctrl => (
              <div key={ctrl.key} className="px-3.5 py-[5px] flex items-center gap-2 hover:bg-slate-50/60 transition-colors">
                <span className="text-xs w-4 text-center shrink-0">{ctrl.icon}</span>
                <span className="text-[10px] text-slate-500 font-medium w-[62px] shrink-0 truncate">{ctrl.label}</span>
                <input
                  type="range"
                  min={ctrl.min}
                  max={ctrl.max}
                  value={settings[ctrl.key] ?? ctrl.default}
                  onChange={e => updateSetting(ctrl.key, parseInt(e.target.value))}
                  className="flex-1 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
                    [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white
                    [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white"
                />
                <span className="text-[10px] font-mono text-emerald-600 font-bold w-8 text-right shrink-0">
                  {settings[ctrl.key] ?? ctrl.default}
                </span>
              </div>
            ))}

            <div className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
}
