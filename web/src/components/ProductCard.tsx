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
        case "classic":
        default:
            return <ClassicCard product={product} />;
    }
});
