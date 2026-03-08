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
    {
        id: "elegant",
        name: "Elegant Minimal",
        description: "Luxury feel with padded images, frosted glass price badge and soft shadows.",
        defaults: {
            activeTheme: "elegant",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "2xl" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "storefront",
        name: "Bold Storefront",
        description: "Conversion-focused with accent strip, XXL pricing and prominent add-to-cart.",
        defaults: {
            activeTheme: "storefront",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 1, desktop: 2, wide: 3 },
            cardStyle: { borderRadius: "lg" },
            cardLayout: { imageWidth: 30, imagePosition: "left" },
        },
    },
    {
        id: "magazine",
        name: "Magazine",
        description: "Editorial hero images with gradient overlay text, lifestyle showcase feel.",
        defaults: {
            activeTheme: "magazine",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 3 },
            cardStyle: { borderRadius: "xl" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "listpro",
        name: "List Pro",
        description: "Ultra-compact single-row list for power buyers. All info at a glance, fast ordering.",
        defaults: {
            activeTheme: "listpro",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 1, desktop: 1, wide: 1 },
            cardStyle: { borderRadius: "lg" },
            cardLayout: { imageWidth: 20, imagePosition: "left" },
        },
    },
    {
        id: "metro",
        name: "Bold Metro",
        description: "Material-style tiles with bold color header band and flat clean body.",
        defaults: {
            activeTheme: "metro",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "md" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "polaroid",
        name: "Polaroid Snap",
        description: "Retro photo-print cards with thick white borders, slight tilt on hover and pinned price tags.",
        defaults: {
            activeTheme: "polaroid",
            primaryColor: "#059669",
            accentColor: "#f97316",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "sm" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "glass",
        name: "Glassmorphism",
        description: "Modern frosted-glass cards with backdrop blur, translucent layers and subtle glow accents.",
        defaults: {
            activeTheme: "glass",
            primaryColor: "#059669",
            accentColor: "#6366f1",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "2xl" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "darkluxe",
        name: "Dark Luxe",
        description: "Premium dark-mode cards with gold accent pricing, cinematic images and luxury spacing.",
        defaults: {
            activeTheme: "darkluxe",
            primaryColor: "#059669",
            accentColor: "#f59e0b",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 3 },
            cardStyle: { borderRadius: "xl" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "editorial",
        name: "Editorial",
        description: "Vintage newspaper-style cards with serif headings, dashed borders and editorial print feel.",
        defaults: {
            activeTheme: "editorial",
            primaryColor: "#059669",
            accentColor: "#dc2626",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "none" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
    {
        id: "neonpop",
        name: "Neon Pop",
        description: "Vibrant gradient-bordered cards with bold colors, playful badges and energetic hover effects.",
        defaults: {
            activeTheme: "neonpop",
            primaryColor: "#8b5cf6",
            accentColor: "#ec4899",
            grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
            cardStyle: { borderRadius: "2xl" },
            cardLayout: { imageWidth: 35, imagePosition: "top" },
        },
    },
];
