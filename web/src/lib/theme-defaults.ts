import type { ThemeSettings, ThemeId } from "@/types/settings";

export interface ThemePreset {
    id: ThemeId;
    name: string;
    description: string;
    defaults: ThemeSettings;
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: "classic",
        name: "Classic Compact",
        description: "Small thumbnail, compact info, ideal for quick browsing. Current default.",
        defaults: {
            activeTheme: "classic",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "2xl" },
            cardLayout: { imageWidth: 35, imagePosition: "left" },
        },
    },
    {
        id: "premium",
        name: "Premium Wholesale",
        description: "Detailed horizontal card with volume pricing tiers, savings badges and quality indicators.",
        defaults: {
            activeTheme: "premium",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 1, desktop: 2, wide: 2 },
            cardStyle: { borderRadius: "lg" },
            cardLayout: { imageWidth: 35, imagePosition: "left" },
        },
    },
    {
        id: "catalog",
        name: "Modern Catalog",
        description: "Medium card with large image on top and clean tier summary below.",
        defaults: {
            activeTheme: "catalog",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 3 },
            cardStyle: { borderRadius: "xl" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
];
