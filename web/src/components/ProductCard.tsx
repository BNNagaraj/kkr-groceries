"use client";

import { memo } from "react";
import { Product } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ClassicCard } from "./cards/ClassicCard";
import { PremiumCard } from "./cards/PremiumCard";
import { CatalogCard } from "./cards/CatalogCard";
import { ElegantCard } from "./cards/ElegantCard";
import { StorefrontCard } from "./cards/StorefrontCard";
import { MagazineCard } from "./cards/MagazineCard";
import { ListProCard } from "./cards/ListProCard";
import { MetroCard } from "./cards/MetroCard";
import { PolaroidCard } from "./cards/PolaroidCard";
import { GlassCard } from "./cards/GlassCard";
import { DarkLuxeCard } from "./cards/DarkLuxeCard";
import { EditorialCard } from "./cards/EditorialCard";
import { NeonPopCard } from "./cards/NeonPopCard";
import { MandiCard } from "./cards/MandiCard";
import { SlabCard } from "./cards/SlabCard";
import { TierStepCard } from "./cards/TierStepCard";
import { TradeCard } from "./cards/TradeCard";
import { HarvestCard } from "./cards/HarvestCard";
import { PremiumCompactCard } from "./cards/PremiumCompactCard";
import { PremiumMiniCard } from "./cards/PremiumMiniCard";
import { PremiumDenseCard } from "./cards/PremiumDenseCard";

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
    const { theme } = useTheme();

    switch (theme.activeTheme) {
        case "premium":
            return <PremiumCard product={product} />;
        case "catalog":
            return <CatalogCard product={product} />;
        case "elegant":
            return <ElegantCard product={product} />;
        case "storefront":
            return <StorefrontCard product={product} />;
        case "magazine":
            return <MagazineCard product={product} />;
        case "listpro":
            return <ListProCard product={product} />;
        case "metro":
            return <MetroCard product={product} />;
        case "polaroid":
            return <PolaroidCard product={product} />;
        case "glass":
            return <GlassCard product={product} />;
        case "darkluxe":
            return <DarkLuxeCard product={product} />;
        case "editorial":
            return <EditorialCard product={product} />;
        case "neonpop":
            return <NeonPopCard product={product} />;
        case "mandi":
            return <MandiCard product={product} />;
        case "slab":
            return <SlabCard product={product} />;
        case "tierstep":
            return <TierStepCard product={product} />;
        case "trade":
            return <TradeCard product={product} />;
        case "harvest":
            return <HarvestCard product={product} />;
        case "premiumcompact":
            return <PremiumCompactCard product={product} />;
        case "premiummini":
            return <PremiumMiniCard product={product} />;
        case "premiumdense":
            return <PremiumDenseCard product={product} />;
        case "classic":
        default:
            return <ClassicCard product={product} />;
    }
});
