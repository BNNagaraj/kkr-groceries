"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, Zap } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Premium Ticket — Receipt/ticket stub aesthetic.
 *
 * Image: respects theme settings (imageWidth, imagePosition).
 * Dashed divider between info and tiers (like a tear-off receipt).
 * Tiers as a mini receipt-style line items. Compact and unique.
 */
export const PremiumTicketCard = memo(function PremiumTicketCard({ product }: { product: Product }) {
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

    const imgPos = theme.cardLayout?.imagePosition || "left";
    const imgW = theme.cardLayout?.imageWidth || 25;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    return (
        <>
            <div
                className="overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out flex flex-col h-full"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.75rem)",
                    background: "#fefefe",
                    border: "1px solid #e8e5e0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
            >
                {/* Dynamic layout: horizontal or vertical based on theme */}
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image — respects theme settings */}
                    <div
                        className={`relative shrink-0 bg-stone-100 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
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
                                <span className="text-lg font-bold text-stone-300">{product.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {/* Top section: product info */}
                        <div className="flex items-center gap-2.5 p-3 pb-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="text-sm font-bold text-stone-800 leading-tight truncate">{product.name}</h3>
                                    {product.hot && <Flame className="w-3 h-3 text-red-500 shrink-0" />}
                                    {product.fresh && <LeafyGreen className="w-3 h-3 text-green-500 shrink-0" />}
                                </div>
                                <div className="text-[10px] text-stone-400 truncate mt-0.5">
                                    <span className="font-telugu">{product.telugu}</span>
                                    {product.hindi && <> · {product.hindi}</>}
                                    {product.moqRequired !== false && <> · Min {product.moq} {product.unit}</>}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <div className="text-lg font-extrabold text-stone-800 leading-none tabular-nums">
                                    Rs.{effectivePrice}
                                </div>
                                <div className="text-[10px] text-stone-400">per {product.unit}</div>
                            </div>
                        </div>

                        {/* Dashed tear-off divider */}
                        {tiers.length > 0 && (
                            <>
                                <div className="mx-2 border-t-2 border-dashed border-stone-200 relative">
                                    {/* Notch holes */}
                                    <div className="absolute -left-2 -top-[5px] w-2.5 h-2.5 rounded-full bg-[var(--theme-page-bg,#f8faf9)]" />
                                    <div className="absolute -right-2 -top-[5px] w-2.5 h-2.5 rounded-full bg-[var(--theme-page-bg,#f8faf9)]" />
                                </div>

                                {/* Receipt-style tier lines */}
                                <div className="px-3 py-1.5">
                                    <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-1">
                                        Price Slabs
                                    </div>
                                    {tiers.map((tier, i) => {
                                        const isActive = i === activeIdx;
                                        const isPast = activeIdx >= 0 && i < activeIdx;
                                        const saving = basePrice - tier.price;

                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center justify-between py-0.5 transition-all duration-200 ${
                                                    isActive
                                                        ? "font-bold"
                                                        : isPast
                                                            ? "opacity-35"
                                                            : ""
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {isActive ? (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                                    ) : (
                                                        <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
                                                    )}
                                                    <span className={`text-[11px] ${isActive ? "text-emerald-700" : "text-stone-600"}`}>
                                                        {tier.range} {product.unit}
                                                    </span>
                                                    {/* Dot leader */}
                                                    <span className="flex-1 border-b border-dotted border-stone-200 min-w-4 mx-1" />
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className={`text-xs tabular-nums ${isActive ? "text-emerald-700 font-extrabold" : "text-stone-700 font-bold"}`}>
                                                        Rs.{tier.price}
                                                    </span>
                                                    {saving > 0 && (
                                                        <span className={`text-[8px] font-medium ${isActive ? "text-emerald-500" : "text-stone-300"}`}>
                                                            (-{Math.round((saving / basePrice) * 100)}%)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Nudge */}
                                    {nudge && qty > 0 && (
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] bg-amber-50 rounded px-2 py-1 border border-amber-200/40">
                                            <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                                            <span className="text-amber-700">+{nudge.qtyNeeded} more = <strong>Rs.{nudge.nextPrice}</strong></span>
                                            <span className="text-emerald-600 font-bold ml-auto">save Rs.{nudge.savingsPerUnit}</span>
                                        </div>
                                    )}

                                    {/* Order total */}
                                    {qty > 0 && (
                                        <div className="mt-1 pt-1 border-t border-stone-200 flex items-center justify-between text-[11px]">
                                            <span className="text-stone-500">{qty} {product.unit} @ Rs.{effectivePrice}</span>
                                            <span className="font-extrabold text-stone-800 tabular-nums">
                                                = Rs.{(effectivePrice * qty).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Cart */}
                        <div className="mt-auto px-3 pb-2.5">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
