"use client";

import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Palette, Save, ImageIcon, LayoutPanelLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ThemeSettings, ThemeId, ImagePosition } from "@/types/settings";
import { DEFAULT_THEME } from "@/types/settings";
import { THEME_PRESETS } from "@/lib/theme-defaults";
import { ThemePreviewCard } from "./ThemePreviewCard";

const BREAKPOINT_LABELS: { key: keyof ThemeSettings["grid"]; label: string }[] = [
    { key: "mobile", label: "Mobile" },
    { key: "tablet", label: "Tablet" },
    { key: "desktop", label: "Desktop" },
    { key: "wide", label: "Wide" },
];

const RADIUS_OPTIONS: { value: ThemeSettings["cardStyle"]["borderRadius"]; label: string }[] = [
    { value: "none", label: "Square" },
    { value: "sm", label: "sm" },
    { value: "md", label: "md" },
    { value: "lg", label: "lg" },
    { value: "xl", label: "xl" },
    { value: "2xl", label: "2xl" },
    { value: "3xl", label: "3xl" },
];

const IMAGE_WIDTH_OPTIONS = [
    { value: 20, label: "20%", desc: "Tiny" },
    { value: 25, label: "25%", desc: "Small" },
    { value: 30, label: "30%", desc: "Compact" },
    { value: 35, label: "35%", desc: "Balanced" },
    { value: 40, label: "40%", desc: "Medium" },
    { value: 45, label: "45%", desc: "Large" },
    { value: 50, label: "50%", desc: "Half" },
];

const IMAGE_POSITION_OPTIONS: { value: ImagePosition; label: string; icon: string }[] = [
    { value: "left", label: "Image Left", icon: "◧" },
    { value: "right", label: "Image Right", icon: "◨" },
    { value: "top", label: "Image Top", icon: "⬒" },
];

export default function ThemeSettingsSection() {
    const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Load current theme on mount
    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, "settings", "theme"));
                if (snap.exists()) {
                    const data = snap.data();
                    setTheme({
                        activeTheme: data.activeTheme || DEFAULT_THEME.activeTheme,
                        primaryColor: data.primaryColor || DEFAULT_THEME.primaryColor,
                        accentColor: data.accentColor || DEFAULT_THEME.accentColor,
                        grid: { ...DEFAULT_THEME.grid, ...(data.grid || {}) },
                        cardStyle: { ...DEFAULT_THEME.cardStyle, ...(data.cardStyle || {}) },
                        cardLayout: { ...DEFAULT_THEME.cardLayout, ...(data.cardLayout || {}) },
                    });
                }
            } catch (e) {
                console.warn("[ThemeSettings] Failed to load:", e);
            } finally {
                setLoaded(true);
            }
        };
        load();
    }, []);

    const handleSelectTheme = (id: ThemeId) => {
        const preset = THEME_PRESETS.find(p => p.id === id);
        if (!preset) return;
        setTheme(prev => ({
            ...prev,
            activeTheme: id,
            grid: preset.defaults.grid,
            cardStyle: preset.defaults.cardStyle,
            cardLayout: preset.defaults.cardLayout,
        }));
    };

    const saveTheme = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "theme"), theme, { merge: true });
            toast.success("Theme settings saved!");
        } catch (e) {
            console.error("[Settings] Save theme error:", e);
            toast.error("Failed to save theme settings.");
        } finally {
            setSaving(false);
        }
    };

    if (!loaded) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                            <Palette className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Store Theme</h3>
                            <p className="text-sm text-slate-500">Choose a layout and customize colors</p>
                        </div>
                    </div>
                    <Button onClick={saveTheme} disabled={saving} size="sm">
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Theme Selection */}
                <div>
                    <label className="text-sm font-semibold text-slate-700 mb-3 block">Choose Theme</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {THEME_PRESETS.map(preset => (
                            <ThemePreviewCard
                                key={preset.id}
                                preset={preset}
                                isActive={theme.activeTheme === preset.id}
                                onClick={() => handleSelectTheme(preset.id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Card Layout (Image & Content) */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <LayoutPanelLeft className="w-4 h-4 text-slate-500" />
                        <label className="text-sm font-semibold text-slate-700">Card Layout</label>
                    </div>

                    {/* Image Position */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-500 mb-2 block">Image Position</label>
                        <div className="flex flex-wrap gap-2">
                            {IMAGE_POSITION_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setTheme(p => ({
                                        ...p,
                                        cardLayout: { ...p.cardLayout, imagePosition: opt.value },
                                    }))}
                                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                                        theme.cardLayout.imagePosition === opt.value
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    <span className="text-lg">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Image Width Slider (only for left/right position) */}
                    {theme.cardLayout.imagePosition !== "top" && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                <label className="text-xs text-slate-500">
                                    Image Size: <span className="font-bold text-slate-700">{theme.cardLayout.imageWidth}%</span>
                                    <span className="text-slate-400 ml-1">
                                        (Content: {100 - theme.cardLayout.imageWidth}%)
                                    </span>
                                </label>
                            </div>

                            {/* Visual slider */}
                            <div className="mb-3">
                                <input
                                    type="range"
                                    min={20}
                                    max={50}
                                    step={5}
                                    value={theme.cardLayout.imageWidth}
                                    onChange={(e) => setTheme(p => ({
                                        ...p,
                                        cardLayout: { ...p.cardLayout, imageWidth: parseInt(e.target.value) },
                                    }))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
                                    <span>20%</span>
                                    <span>35%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            {/* Quick preset buttons */}
                            <div className="flex flex-wrap gap-1.5">
                                {IMAGE_WIDTH_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setTheme(p => ({
                                            ...p,
                                            cardLayout: { ...p.cardLayout, imageWidth: opt.value },
                                        }))}
                                        className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                                            theme.cardLayout.imageWidth === opt.value
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                        }`}
                                    >
                                        {opt.label}
                                        <span className="text-[10px] ml-0.5 opacity-60">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Live preview bar */}
                            <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden h-12 flex">
                                <div
                                    className="bg-emerald-100 flex items-center justify-center text-[10px] font-medium text-emerald-700 border-r border-slate-200 transition-all duration-300"
                                    style={{ width: `${theme.cardLayout.imageWidth}%` }}
                                >
                                    Image {theme.cardLayout.imageWidth}%
                                </div>
                                <div className="flex-1 bg-white flex items-center justify-center text-[10px] font-medium text-slate-500 transition-all duration-300">
                                    Content {100 - theme.cardLayout.imageWidth}%
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Colors */}
                <div>
                    <label className="text-sm font-semibold text-slate-700 mb-3 block">Colors</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm text-slate-500 mb-1.5 block">Primary Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={theme.primaryColor}
                                    onChange={(e) => setTheme(p => ({ ...p, primaryColor: e.target.value }))}
                                    className="w-11 h-11 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                                />
                                <Input
                                    value={theme.primaryColor}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setTheme(p => ({ ...p, primaryColor: v }));
                                    }}
                                    className="font-mono uppercase w-28"
                                    maxLength={7}
                                />
                                <div
                                    className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                                    style={{ backgroundColor: theme.primaryColor }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-slate-500 mb-1.5 block">Accent Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={theme.accentColor}
                                    onChange={(e) => setTheme(p => ({ ...p, accentColor: e.target.value }))}
                                    className="w-11 h-11 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                                />
                                <Input
                                    value={theme.accentColor}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setTheme(p => ({ ...p, accentColor: v }));
                                    }}
                                    className="font-mono uppercase w-28"
                                    maxLength={7}
                                />
                                <div
                                    className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                                    style={{ backgroundColor: theme.accentColor }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid Columns */}
                <div>
                    <label className="text-sm font-semibold text-slate-700 mb-3 block">Grid Columns</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {BREAKPOINT_LABELS.map(bp => (
                            <div key={bp.key}>
                                <label className="text-xs text-slate-500 mb-1 block">{bp.label}</label>
                                <select
                                    value={theme.grid[bp.key]}
                                    onChange={(e) => setTheme(p => ({
                                        ...p,
                                        grid: { ...p.grid, [bp.key]: parseInt(e.target.value) },
                                    }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <option key={n} value={n}>
                                            {n} column{n > 1 ? "s" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Border Radius */}
                <div>
                    <label className="text-sm font-semibold text-slate-700 mb-3 block">Card Border Radius</label>
                    <div className="flex flex-wrap gap-2">
                        {RADIUS_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(p => ({
                                    ...p,
                                    cardStyle: { ...p.cardStyle, borderRadius: opt.value },
                                }))}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                                    theme.cardStyle.borderRadius === opt.value
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
