"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ThemeSettings } from "@/types/settings";
import { DEFAULT_THEME } from "@/types/settings";

interface ThemeContextType {
    theme: ThemeSettings;
    loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: DEFAULT_THEME,
    loading: true,
});

export const useTheme = () => useContext(ThemeContext);

/* ─── Color Helpers ─── */

function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
    const sN = s / 100;
    const lN = l / 100;
    const a = sN * Math.min(lN, 1 - lN);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function deriveDarkShade(hex: string): string {
    try {
        const { h, s, l } = hexToHSL(hex);
        return hslToHex(h, Math.min(s + 10, 100), Math.max(l - 25, 10));
    } catch { return "#064e3b"; }
}

function deriveLightShade(hex: string): string {
    try {
        const { h, s } = hexToHSL(hex);
        return hslToHex(h, Math.min(s, 40), 95);
    } catch { return "#ecfdf5"; }
}

/* ─── Radius Map ─── */

const RADIUS_MAP: Record<string, string> = {
    none: "0px",
    sm: "0.125rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
};

/* ─── Provider ─── */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
    const [loading, setLoading] = useState(true);

    // Load theme from Firestore (real-time)
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, "settings", "theme"),
            (snap) => {
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
                setLoading(false);
            },
            (err) => {
                console.warn("[ThemeContext] Failed to load theme:", err.message);
                setLoading(false);
            }
        );
        return unsub;
    }, []);

    // Apply CSS custom properties whenever theme changes
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--color-primary", theme.primaryColor);
        root.style.setProperty("--color-primary-dark", deriveDarkShade(theme.primaryColor));
        root.style.setProperty("--color-primary-light", deriveLightShade(theme.primaryColor));
        root.style.setProperty("--color-accent", theme.accentColor);
        root.style.setProperty("--color-ring", theme.primaryColor);
        root.style.setProperty("--theme-card-radius", RADIUS_MAP[theme.cardStyle.borderRadius] || "1rem");

        // Page-level theme effects — subtle background tint per theme
        const PAGE_BG: Record<string, string> = {
            classic: "#f8faf9",
            premium: "#f7f9f8",
            catalog: "#f8faf9",
            elegant: "#fafafa",
            storefront: "#f9fafb",
            magazine: "#f8f8f8",
            listpro: "#fafbfc",
            metro: "#f5f7f9",
            polaroid: "#faf9f7",
            glass: "#f0f4ff",
            darkluxe: "#111318",
            editorial: "#faf9f6",
            neonpop: "#faf8ff",
            mandi: "#0a1f14",
            slab: "#f8faf9",
            tierstep: "#f9fafb",
            trade: "#f5f7fa",
            harvest: "#fffbf0",
        };
        const bg = PAGE_BG[theme.activeTheme] || "#f8faf9";
        root.style.setProperty("--theme-page-bg", bg);

        // Set body class for dark themes
        if (theme.activeTheme === "darkluxe" || theme.activeTheme === "mandi") {
            document.body.classList.add("theme-dark-page");
        } else {
            document.body.classList.remove("theme-dark-page");
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, loading }}>
            {children}
        </ThemeContext.Provider>
    );
}
