"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Premium Ribbon — Compact with colored RIBBON tabs for each tier.
 *
 * Image: respects theme settings (imageWidth, imagePosition).
 * Tiers shown as ribbon-like colored tabs extending from the left edge.
 * Active ribbon glows and extends further. Elegant, approachable.
 */
export const PremiumRibbonCard = memo(function PremiumRibbonCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const { cart } = useAppStore();
    const { theme } = useTheme();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const basePrice = product.price;
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const nudge = getNextTierNudge(qty, basePrice, product.priceTiers || [], product.unit);
    const effectivePrice = qty > 0 && product.priceTiers?.length
        ? resolveSlabPrice(qty, basePrice, product.priceTiers) : basePrice;
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : basePrice;
    const maxSavingsPercent = basePrice > 0 ? Math.round(((basePrice - lowestPrice) / basePrice) * 100) : 0;

    const imgPos = theme.cardLayout?.imagePosition || "left";
    const imgW = theme.cardLayout?.imageWidth || 25;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    // Ribbon colors — progressive green
    const RIBBON_COLORS = [
        { bg: "bg-emerald-100", text: "text-emerald-800", activeBg: "bg-emerald-600", activeText: "text-white" },
        { bg: "bg-emerald-200", text: "text-emerald-800", activeBg: "bg-emerald-600", activeText: "text-white" },
        { bg: "bg-emerald-300", text: "text-emerald-900", activeBg: "bg-emerald-700", activeText: "text-white" },
        { bg: "bg-emerald-400", text: "text-white", activeBg: "bg-emerald-800", activeText: "text-white" },
        { bg: "bg-emerald-500", text: "text-white", activeBg: "bg-emerald-900", activeText: "text-white" },
    ];

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out flex flex-col h-full"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* Dynamic layout: horizontal or vertical based on theme */}
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image — respects theme settings */}
                    <div
                        className={`relative shrink-0 bg-slate-100 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
                            isHorizontal ? "aspect-auto" : "aspect-[16/9] w-full"
                        }`}
                        style={isHorizontal ? { width: `${imgW}%` } : undefined}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={isHorizontal ? `${imgW}vw` : "100vw"} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold text-slate-300">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Savings badge */}
                        {maxSavingsPercent > 0 && tiers.length > 1 && (
                            <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                -{maxSavingsPercent}%
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {/* Header: name + price */}
                        <div className="flex items-center gap-3 p-3 pb-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">{product.name}</h3>
                                    {product.hot && <Flame className="w-3 h-3 text-red-500 shrink-0" />}
                                    {product.fresh && <LeafyGreen className="w-3 h-3 text-green-500 shrink-0" />}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                    <span className="font-telugu">{product.telugu}</span>
                                    {product.hindi && <> · {product.hindi}</>}
                                </div>
                                {product.moqRequired !== false && (
                                    <div className="text-[9px] text-slate-400 mt-0.5">Min: {product.moq} {product.unit}</div>
                                )}
                            </div>

                            {/* Price block */}
                            <div className="text-right shrink-0">
                                <div className="text-lg font-extrabold text-slate-800 leading-none tabular-nums">
                                    Rs.{effectivePrice}
                                </div>
                                <div className="text-[10px] text-slate-400">/{product.unit}</div>
                            </div>
                        </div>

                        {/* Ribbon tiers — extending from left edge */}
                        {tiers.length > 0 && (
                            <div className="pb-1.5 space-y-0.5">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const color = RIBBON_COLORS[Math.min(i, RIBBON_COLORS.length - 1)];
                                    const saving = basePrice - tier.price;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between pl-3 pr-3 py-1 transition-all duration-300 ${
                                                isActive
                                                    ? `${color.activeBg} ${color.activeText} shadow-sm`
                                                    : isPast
                                                        ? `${color.bg} ${color.text} opacity-40`
                                                        : `${color.bg} ${color.text}`
                                            }`}
                                            style={{
                                                marginLeft: isActive ? 0 : "8px",
                                                borderRadius: "0 6px 6px 0",
                                                marginRight: "12px",
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse shrink-0" />
                                                )}
                                                <span className="text-[11px] font-semibold truncate">
                                                    {tier.range} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-xs font-bold tabular-nums">Rs.{tier.price}</span>
                                                {saving > 0 && (
                                                    <span className={`text-[9px] font-medium ${isActive ? "text-white/70" : "opacity-60"}`}>
                                                        -Rs.{saving}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Nudge */}
                                {nudge && qty > 0 && (
                                    <div className="mx-3 mt-1 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 rounded-md px-2.5 py-1 border border-amber-200/50">
                                        <TrendingDown className="w-3 h-3 shrink-0" />
                                        <span className="font-medium">+{nudge.qtyNeeded} {product.unit}</span>
                                        <span className="text-amber-400">=</span>
                                        <span className="font-bold">Rs.{nudge.nextPrice}/{product.unit}</span>
                                        <span className="text-emerald-600 font-bold ml-auto">save Rs.{nudge.savingsPerUnit}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cart */}
                        <div className="px-3 pb-2.5 mt-auto">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
