"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Settings, RotateCcw, X, ChevronDown, ChevronUp } from "lucide-react";

// ─── Style Presets ──────────────────────────────────────────────────────────
type PresetKey = "default" | "rich" | "vibrant";
type StyleMode = PresetKey | "custom";

interface Preset {
  label: string;
  icon: string;
  desc: string;
  styles: any[];
}

const PRESETS: Record<PresetKey, Preset> = {
  default: {
    label: "Default",
    icon: "🗺️",
    desc: "Standard Google Maps",
    styles: [],
  },
  rich: {
    label: "Rich",
    icon: "🎨",
    desc: "Deeper, saturated colors",
    styles: [
      { elementType: "geometry", stylers: [{ saturation: 30 }] },
      { featureType: "water", elementType: "geometry", stylers: [{ saturation: 55 }, { lightness: -12 }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ saturation: 35 }, { lightness: -5 }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ saturation: 25 }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ saturation: 20 }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ saturation: 50 }, { lightness: -8 }] },
      { featureType: "landscape.natural", elementType: "geometry", stylers: [{ saturation: 25 }, { lightness: -3 }] },
      { featureType: "transit", elementType: "geometry", stylers: [{ saturation: 15 }] },
    ],
  },
  vibrant: {
    label: "Vibrant",
    icon: "🌈",
    desc: "Bold colored roads & features",
    styles: [
      // Background — warm cream
      { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#FFF8E1" }] },
      { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#EFEBE9" }] },
      { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#D7CCC8" }] },

      // Water — vivid blue
      { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#64B5F6" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1565C0" }] },
      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#BBDEFB" }] },

      // Highways — bold red
      { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#EF5350" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#C62828" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#B71C1C" }] },

      // Arterial roads — orange
      { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#FFA726" }] },
      { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#E65100" }] },
      { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#BF360C" }] },

      // Local roads — light cream/yellow
      { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#FFFDE7" }] },
      { featureType: "road.local", elementType: "geometry.stroke", stylers: [{ color: "#FFF9C4" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },

      // Parks — bright green
      { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#81C784" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#2E7D32" }] },

      // POI — subtle
      { featureType: "poi.business", elementType: "geometry.fill", stylers: [{ color: "#F5F5F5" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#546E7A" }] },

      // Transit — muted gray
      { featureType: "transit", elementType: "geometry", stylers: [{ color: "#E0E0E0" }] },
      { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#5C6BC0" }] },

      // Admin boundaries
      { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#BDBDBD" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#E0E0E0" }] },

      // Labels — crisp dark
      { elementType: "labels.text.fill", stylers: [{ color: "#37474F" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#FFFFFF" }, { weight: 3 }] },
    ],
  },
};

// ─── Advanced Slider Controls ───────────────────────────────────────────────
interface SliderControl {
  label: string;
  icon: string;
  featureType?: string;
  elementType: string;
  prop: "saturation" | "lightness";
  min: number;
  max: number;
  key: string;
}

const SLIDER_CONTROLS: SliderControl[] = [
  { label: "Overall", icon: "🌍", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "geo_sat" },
  { label: "Water S", icon: "💧", featureType: "water", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "water_sat" },
  { label: "Water L", icon: "💧", featureType: "water", elementType: "geometry", prop: "lightness", min: -100, max: 100, key: "water_lit" },
  { label: "Highway S", icon: "🛣️", featureType: "road.highway", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "hwy_sat" },
  { label: "Highway L", icon: "🛣️", featureType: "road.highway", elementType: "geometry", prop: "lightness", min: -100, max: 100, key: "hwy_lit" },
  { label: "Roads", icon: "🛤️", featureType: "road.arterial", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "road_sat" },
  { label: "Parks S", icon: "🌳", featureType: "poi.park", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "park_sat" },
  { label: "Parks L", icon: "🌳", featureType: "poi.park", elementType: "geometry", prop: "lightness", min: -100, max: 100, key: "park_lit" },
  { label: "Land S", icon: "🏔️", featureType: "landscape.natural", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "land_sat" },
  { label: "Land L", icon: "🏔️", featureType: "landscape.natural", elementType: "geometry", prop: "lightness", min: -100, max: 100, key: "land_lit" },
  { label: "Transit", icon: "🚇", featureType: "transit", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "transit_sat" },
  { label: "Building S", icon: "🏢", featureType: "landscape.man_made", elementType: "geometry", prop: "saturation", min: -100, max: 100, key: "bldg_sat" },
  { label: "Building L", icon: "🏢", featureType: "landscape.man_made", elementType: "geometry", prop: "lightness", min: -100, max: 100, key: "bldg_lit" },
];

// ─── Storage ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "kkr-map-style-settings-v2";

interface MapSettings {
  preset: StyleMode;
  mapType: string;
  labels: boolean;
  poi: boolean;
  transit: boolean;
  traffic: boolean;
  sliders: Record<string, number>;
}

function getDefaults(): MapSettings {
  return {
    preset: "vibrant",
    mapType: "roadmap",
    labels: true,
    poi: true,
    transit: true,
    traffic: false,
    sliders: Object.fromEntries(SLIDER_CONTROLS.map(c => [c.key, 0])),
  };
}

// ─── Exported Utilities ─────────────────────────────────────────────────────
export function loadMapSettings(): MapSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...getDefaults(), ...parsed };
    }
  } catch {}
  return getDefaults();
}

function saveSettings(s: MapSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function buildMapStyles(settings: MapSettings): any[] {
  let styles: any[] = [];

  if (settings.preset === "custom") {
    // Build from slider values
    const groups = new Map<string, any[]>();
    SLIDER_CONTROLS.forEach(ctrl => {
      const value = settings.sliders[ctrl.key] ?? 0;
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
  } else {
    const presetKey = settings.preset as PresetKey;
    styles = [...(PRESETS[presetKey]?.styles || [])];
  }

  // Append toggle overrides
  if (!settings.labels) {
    styles.push({ elementType: "labels", stylers: [{ visibility: "off" }] });
  }
  if (!settings.poi) {
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
  const [settings, setSettings] = useState<MapSettings>(getDefaults);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const transitLayerRef = useRef<any>(null);
  const trafficLayerRef = useRef<any>(null);

  useEffect(() => {
    setSettings(loadMapSettings());
  }, []);

  // Apply styles whenever settings or map instance changes
  useEffect(() => {
    if (!mapInstance || !window.google) return;
    try {
      mapInstance.setOptions({ styles: buildMapStyles(settings) });
      if (mapInstance.getMapTypeId && mapInstance.getMapTypeId() !== settings.mapType) {
        mapInstance.setMapTypeId(settings.mapType);
      }

      // Transit Layer (metro, bus, train routes)
      if (!transitLayerRef.current) {
        transitLayerRef.current = new window.google.maps.TransitLayer();
      }
      transitLayerRef.current.setMap(settings.transit ? mapInstance : null);

      // Traffic Layer (live traffic)
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(settings.traffic ? mapInstance : null);
    } catch {
      // Map instance may be stale/destroyed — ignore
    }
  }, [settings, mapInstance]);

  const update = useCallback((partial: Partial<MapSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateSlider = useCallback((key: string, value: number) => {
    setSettings(prev => {
      const next: MapSettings = { ...prev, preset: "custom", sliders: { ...prev.sliders, [key]: value } };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    const d = getDefaults();
    setSettings(d);
    saveSettings(d);
  }, []);

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
        <div className="absolute top-12 left-0 w-[290px] bg-white/[0.97] backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 overflow-hidden">

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

          <div className="max-h-[480px] overflow-y-auto overscroll-contain">

            {/* ── Style Presets ─────────────────────────── */}
            <div className="px-3.5 py-2.5 border-b border-slate-50">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Style</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(PRESETS) as PresetKey[]).map(key => {
                  const p = PRESETS[key];
                  const active = settings.preset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => update({ preset: key })}
                      className={`py-2 px-1 rounded-xl text-center transition-all border ${
                        active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm shadow-emerald-100"
                          : "bg-slate-50/80 text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700"
                      }`}
                    >
                      <div className="text-base mb-0.5">{p.icon}</div>
                      <div className="text-[10px] font-bold">{p.label}</div>
                      <div className="text-[8px] opacity-60 mt-0.5 leading-tight">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
              {/* Custom indicator */}
              {settings.preset === "custom" && (
                <div className="mt-2 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 font-medium text-center">
                  ✏️ Custom — adjusted via Advanced sliders
                </div>
              )}
            </div>

            {/* ── Map Type ──────────────────────────────── */}
            <div className="px-3.5 py-2.5 border-b border-slate-50">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Map Type</div>
              <div className="grid grid-cols-4 gap-1">
                {MAP_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => update({ mapType: t.id })}
                    className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                      settings.mapType === t.id
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

            {/* ── Layers & Toggles ──────────────────────── */}
            <div className="px-3.5 py-2.5 border-b border-slate-50">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Layers</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.transit}
                    onChange={e => update({ transit: e.target.checked })}
                    className="w-3.5 h-3.5 rounded accent-emerald-600"
                  />
                  <span className="text-[11px] font-medium text-slate-600">🚇 Transit</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.traffic}
                    onChange={e => update({ traffic: e.target.checked })}
                    className="w-3.5 h-3.5 rounded accent-emerald-600"
                  />
                  <span className="text-[11px] font-medium text-slate-600">🚗 Traffic</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.labels}
                    onChange={e => update({ labels: e.target.checked })}
                    className="w-3.5 h-3.5 rounded accent-emerald-600"
                  />
                  <span className="text-[11px] font-medium text-slate-600">🏷️ Labels</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.poi}
                    onChange={e => update({ poi: e.target.checked })}
                    className="w-3.5 h-3.5 rounded accent-emerald-600"
                  />
                  <span className="text-[11px] font-medium text-slate-600">📍 POI Icons</span>
                </label>
              </div>
            </div>

            {/* ── Advanced Sliders (collapsible) ────────── */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Advanced</span>
                <span className="text-[8px] text-slate-300 font-medium">(per-feature tuning)</span>
              </div>
              {showAdvanced
                ? <ChevronUp className="w-3 h-3 text-slate-400" />
                : <ChevronDown className="w-3 h-3 text-slate-400" />
              }
            </button>

            {showAdvanced && (
              <div className="border-t border-slate-50">
                {SLIDER_CONTROLS.map(ctrl => (
                  <div key={ctrl.key} className="px-3.5 py-[5px] flex items-center gap-2 hover:bg-slate-50/60 transition-colors">
                    <span className="text-xs w-4 text-center shrink-0">{ctrl.icon}</span>
                    <span className="text-[10px] text-slate-500 font-medium w-[62px] shrink-0 truncate">{ctrl.label}</span>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      value={settings.sliders[ctrl.key] ?? 0}
                      onChange={e => updateSlider(ctrl.key, parseInt(e.target.value))}
                      className="flex-1 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
                        [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white
                        [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white"
                    />
                    <span className="text-[10px] font-mono text-emerald-600 font-bold w-8 text-right shrink-0">
                      {settings.sliders[ctrl.key] ?? 0}
                    </span>
                  </div>
                ))}
                <div className="h-2" />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
