"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Zen Garden — Japanese-inspired minimal design.
 *
 * Visual identity: Cream/warm-stone backgrounds, thin hairline borders,
 * generous whitespace, ink-wash style muted image overlay. Tiers displayed
 * as stacked horizontal "zen stones" with subtle grain texture. Warm gray
 * text with sage green accents.
 */
export const ZenCard = memo(function ZenCard({ product }: { product: Product }) {
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
    const imgW = theme.cardLayout?.imageWidth || 30;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    return (
        <>
            <div
                className="overflow-hidden hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out flex flex-col h-full"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.75rem)",
                    background: "#faf8f5",
                    border: "1px solid #e8e4de",
                }}
            >
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image — muted ink-wash overlay */}
                    <div
                        className={`relative shrink-0 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
                            isHorizontal ? "aspect-auto" : "aspect-[4/3] w-full"
                        }`}
                        style={isHorizontal ? { width: `${imgW}%` } : undefined}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={isHorizontal ? `${imgW}vw` : "100vw"} className="object-cover" style={{ filter: "saturate(0.7) contrast(0.95)" }} unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#faf8f5]/60" />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-4 h-4 text-stone-600 opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(145deg, #f0ece4 0%, #e8e4dc 100%)" }}>
                                <span className="text-3xl font-light text-stone-300" style={{ fontFamily: "serif" }}>{product.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {/* Header — minimal with thin separator */}
                        <div className="px-4 pt-4 pb-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-medium text-stone-800 leading-tight truncate tracking-wide">{product.name}</h3>
                                        {product.hot && <Flame className="w-3 h-3 text-amber-500 shrink-0" />}
                                        {product.fresh && <LeafyGreen className="w-3 h-3 text-sage-500 shrink-0" style={{ color: "#7c8c6e" }} />}
                                    </div>
                                    <div className="text-[10px] text-stone-400 truncate mt-1" style={{ letterSpacing: "0.05em" }}>
                                        <span className="font-telugu">{product.telugu}</span>
                                        {product.hindi && <> · {product.hindi}</>}
                                    </div>
                                    {product.moqRequired !== false && (
                                        <div className="text-[9px] text-stone-400 mt-0.5">Min: {product.moq} {product.unit}</div>
                                    )}
                                </div>

                                {/* Price — clean serif style */}
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-light text-stone-700 leading-none tabular-nums" style={{ fontFamily: "Georgia, serif" }}>
                                        ₹{effectivePrice}
                                    </div>
                                    <div className="text-[9px] text-stone-400 mt-0.5">per {product.unit}</div>
                                </div>
                            </div>

                            {/* Thin separator line */}
                            <div className="h-px mt-3" style={{ background: "linear-gradient(90deg, transparent, #d4cfc7, transparent)" }} />
                        </div>

                        {/* ZEN STONE TIERS — rounded horizontal bars with earthy progression */}
                        {tiers.length > 0 && (
                            <div className="px-4 pb-2 space-y-1.5">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;
                                    const stoneColors = ["#e8e4dc", "#ddd8ce", "#d2cdc2", "#c7c1b5", "#bcb5a8"];
                                    const activeBg = "#7c8c6e";

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-3 py-1.5 transition-all duration-300 ${isPast ? "opacity-35" : ""}`}
                                            style={{
                                                borderRadius: "999px",
                                                background: isActive ? activeBg : stoneColors[Math.min(i, stoneColors.length - 1)],
                                                color: isActive ? "#faf8f5" : "#5c5647",
                                                transform: isActive ? "scale(1.03)" : "scale(1)",
                                                boxShadow: isActive ? "0 2px 8px rgba(124,140,110,0.3)" : "none",
                                            }}
                                        >
                                            <span className="text-[11px] font-medium truncate">
                                                {tier.range} {product.unit}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-xs font-semibold tabular-nums">₹{tier.price}</span>
                                                {saving > 0 && (
                                                    <span className="text-[9px] opacity-60">-₹{saving}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Savings badge */}
                                {maxSavingsPercent > 0 && tiers.length > 1 && !nudge && (
                                    <div className="text-center text-[10px] text-stone-400 pt-0.5">
                                        Save up to {maxSavingsPercent}%
                                    </div>
                                )}

                                {/* Nudge */}
                                {nudge && qty > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full" style={{ background: "#f0ece4", color: "#7c6e5c" }}>
                                        <TrendingDown className="w-3 h-3 shrink-0" />
                                        <span>+{nudge.qtyNeeded} {product.unit} → ₹{nudge.nextPrice}/{product.unit}</span>
                                        <span className="font-semibold ml-auto" style={{ color: "#7c8c6e" }}>save ₹{nudge.savingsPerUnit}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cart */}
                        <div className="px-4 pb-4 mt-auto">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
