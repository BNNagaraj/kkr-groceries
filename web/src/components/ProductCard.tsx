"use client";

import { memo } from "react";
import { Product } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ClassicCard } from "./cards/ClassicCard";
import { PremiumCard } from "./cards/PremiumCard";
import { CatalogCard } from "./cards/CatalogCard";

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
    const { theme } = useTheme();

    switch (theme.activeTheme) {
        case "premium":
            return <PremiumCard product={product} />;
        case "catalog":
            return <CatalogCard product={product} />;
        case "classic":
        default:
            return <ClassicCard product={product} />;
    }
});
