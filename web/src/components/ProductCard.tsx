"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import { Product } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ClassicCard } from "./cards/ClassicCard";
import type { ThemeId } from "@/types/settings";

type CardComponent = React.ComponentType<{ product: Product }>;

const loadingFallback = () => (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 animate-pulse h-[420px]" />
);

const cardLoaders: Record<Exclude<ThemeId, "classic">, () => Promise<{ default: CardComponent }>> = {
    premium: () => import("./cards/PremiumCard").then((m) => ({ default: m.PremiumCard })),
    catalog: () => import("./cards/CatalogCard").then((m) => ({ default: m.CatalogCard })),
    elegant: () => import("./cards/ElegantCard").then((m) => ({ default: m.ElegantCard })),
    storefront: () => import("./cards/StorefrontCard").then((m) => ({ default: m.StorefrontCard })),
    magazine: () => import("./cards/MagazineCard").then((m) => ({ default: m.MagazineCard })),
    listpro: () => import("./cards/ListProCard").then((m) => ({ default: m.ListProCard })),
    metro: () => import("./cards/MetroCard").then((m) => ({ default: m.MetroCard })),
    polaroid: () => import("./cards/PolaroidCard").then((m) => ({ default: m.PolaroidCard })),
    glass: () => import("./cards/GlassCard").then((m) => ({ default: m.GlassCard })),
    darkluxe: () => import("./cards/DarkLuxeCard").then((m) => ({ default: m.DarkLuxeCard })),
    editorial: () => import("./cards/EditorialCard").then((m) => ({ default: m.EditorialCard })),
    neonpop: () => import("./cards/NeonPopCard").then((m) => ({ default: m.NeonPopCard })),
    mandi: () => import("./cards/MandiCard").then((m) => ({ default: m.MandiCard })),
    slab: () => import("./cards/SlabCard").then((m) => ({ default: m.SlabCard })),
    tierstep: () => import("./cards/TierStepCard").then((m) => ({ default: m.TierStepCard })),
    trade: () => import("./cards/TradeCard").then((m) => ({ default: m.TradeCard })),
    harvest: () => import("./cards/HarvestCard").then((m) => ({ default: m.HarvestCard })),
    premiumcompact: () => import("./cards/PremiumCompactCard").then((m) => ({ default: m.PremiumCompactCard })),
    premiummini: () => import("./cards/PremiumMiniCard").then((m) => ({ default: m.PremiumMiniCard })),
    premiumdense: () => import("./cards/PremiumDenseCard").then((m) => ({ default: m.PremiumDenseCard })),
    premiumribbon: () => import("./cards/PremiumRibbonCard").then((m) => ({ default: m.PremiumRibbonCard })),
    premiumticket: () => import("./cards/PremiumTicketCard").then((m) => ({ default: m.PremiumTicketCard })),
    premiumshelf: () => import("./cards/PremiumShelfCard").then((m) => ({ default: m.PremiumShelfCard })),
    zen: () => import("./cards/ZenCard").then((m) => ({ default: m.ZenCard })),
    aurora: () => import("./cards/AuroraCard").then((m) => ({ default: m.AuroraCard })),
    terracotta: () => import("./cards/TerracottaCard").then((m) => ({ default: m.TerracottaCard })),
    sapphire: () => import("./cards/SapphireCard").then((m) => ({ default: m.SapphireCard })),
    sakura: () => import("./cards/SakuraCard").then((m) => ({ default: m.SakuraCard })),
    mandichit: () => import("./cards/MandiChitCard").then((m) => ({ default: m.MandiChitCard })),
    bulletin: () => import("./cards/BulletinCard").then((m) => ({ default: m.BulletinCard })),
    produceforward: () => import("./cards/ProduceForwardCard").then((m) => ({ default: m.ProduceForwardCard })),
    chalkboard: () => import("./cards/ChalkboardCard").then((m) => ({ default: m.ChalkboardCard })),
    risograph: () => import("./cards/RisographCard").then((m) => ({ default: m.RisographCard })),
    tradingcard: () => import("./cards/TradingCardCard").then((m) => ({ default: m.TradingCardCard })),
    brutalistslab: () => import("./cards/BrutalistSlabCard").then((m) => ({ default: m.BrutalistSlabCard })),
    bazaarposter: () => import("./cards/BazaarPosterCard").then((m) => ({ default: m.BazaarPosterCard })),
    apothecary: () => import("./cards/ApothecaryCard").then((m) => ({ default: m.ApothecaryCard })),
    postalstamp: () => import("./cards/PostalStampCard").then((m) => ({ default: m.PostalStampCard })),
    memosticky: () => import("./cards/MemoStickyCard").then((m) => ({ default: m.MemoStickyCard })),
    periodicelement: () => import("./cards/PeriodicElementCard").then((m) => ({ default: m.PeriodicElementCard })),
    hairlinemodern: () => import("./cards/HairlineModernCard").then((m) => ({ default: m.HairlineModernCard })),
    freightmanifest: () => import("./cards/FreightManifestCard").then((m) => ({ default: m.FreightManifestCard })),
};

const cardCache = new Map<ThemeId, CardComponent>();

function getCardComponent(themeId: ThemeId): CardComponent {
    if (themeId === "classic") return ClassicCard;
    const cached = cardCache.get(themeId);
    if (cached) return cached;
    const loader = cardLoaders[themeId as Exclude<ThemeId, "classic">];
    if (!loader) return ClassicCard;
    const Component = dynamic(loader, { loading: loadingFallback, ssr: false });
    cardCache.set(themeId, Component);
    return Component;
}

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
    const { theme } = useTheme();
    const Card = getCardComponent(theme.activeTheme);
    return <Card product={product} />;
});
