"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, Zap } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Premium Ticket — WARM STONE/SEPIA receipt-stub aesthetic.
 *
 * Visual identity: Warm parchment tones, dashed tear-off line with notch holes,
 * monospace-style receipt line items with dot-leaders, running total at bottom.
 * Completely different from Ribbon (blue/indigo) and Shelf (emerald band).
 *
 * Image: respects theme settings (imageWidth, imagePosition).
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
                    background: "linear-gradient(135deg, #fdfcf9 0%, #f9f6f0 100%)",
                    border: "1px solid #e8e0d4",
                    boxShadow: "0 1px 4px rgba(120,100,70,0.08)",
                }}
            >
                {/* Dynamic layout based on theme settings */}
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image — respects theme settings */}
                    <div
                        className={`relative shrink-0 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
                            isHorizontal ? "aspect-auto" : "aspect-[16/9] w-full"
                        }`}
                        style={{
                            ...(isHorizontal ? { width: `${imgW}%` } : {}),
                            background: "#f0ebe3",
                        }}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={isHorizontal ? `${imgW}vw` : "100vw"} className="object-cover sepia-[.15]" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold text-amber-200/60">{product.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {/* Receipt header — store name style */}
                        <div className="px-3 pt-3 pb-1.5 text-center border-b border-dashed border-amber-300/40">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 text-left">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-bold text-amber-900 leading-tight truncate" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                                            {product.name}
                                        </h3>
                                        {product.hot && <Flame className="w-3 h-3 text-red-500 shrink-0" />}
                                        {product.fresh && <LeafyGreen className="w-3 h-3 text-green-600 shrink-0" />}
                                    </div>
                                    <div className="text-[10px] text-amber-600/60 truncate mt-0.5">
                                        <span className="font-telugu">{product.telugu}</span>
                                        {product.hindi && <> · {product.hindi}</>}
                                        {product.moqRequired !== false && <> · Min {product.moq} {product.unit}</>}
                                    </div>
                                </div>
                                {/* Price — receipt style large */}
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-extrabold text-amber-900 leading-none tabular-nums" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                                        Rs.{effectivePrice}
                                    </div>
                                    <div className="text-[9px] text-amber-500">per {product.unit}</div>
                                </div>
                            </div>
                        </div>

                        {/* Tear-off divider with notch holes */}
                        {tiers.length > 0 && (
                            <>
                                <div className="mx-0 my-0.5 border-t-2 border-dashed border-amber-300/50 relative">
                                    <div className="absolute -left-1.5 -top-[5px] w-2.5 h-2.5 rounded-full" style={{ background: "var(--theme-page-bg, #f8faf9)" }} />
                                    <div className="absolute -right-1.5 -top-[5px] w-2.5 h-2.5 rounded-full" style={{ background: "var(--theme-page-bg, #f8faf9)" }} />
                                </div>

                                {/* Receipt-style tier lines with dot leaders */}
                                <div className="px-3 py-1.5">
                                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-[0.2em] mb-1" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                                        --- Price Slabs ---
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
                                                        ? "font-bold bg-amber-100/60 -mx-1.5 px-1.5 rounded"
                                                        : isPast
                                                            ? "opacity-30"
                                                            : ""
                                                }`}
                                                style={{ fontFamily: "'Courier New', Courier, monospace" }}
                                            >
                                                <div className="flex items-center gap-1 min-w-0">
                                                    {isActive ? (
                                                        <span className="text-amber-600 shrink-0">*</span>
                                                    ) : (
                                                        <span className="text-amber-300 shrink-0">-</span>
                                                    )}
                                                    <span className={`text-[11px] ${isActive ? "text-amber-800" : "text-amber-700/70"}`}>
                                                        {tier.range} {product.unit}
                                                    </span>
                                                    <span className="flex-1 border-b border-dotted border-amber-300/60 min-w-3 mx-0.5" />
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className={`text-xs tabular-nums ${isActive ? "text-amber-900 font-extrabold" : "text-amber-700 font-bold"}`}>
                                                        Rs.{tier.price}
                                                    </span>
                                                    {saving > 0 && (
                                                        <span className={`text-[8px] font-medium ${isActive ? "text-green-600" : "text-amber-400"}`}>
                                                            (-{Math.round((saving / basePrice) * 100)}%)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Nudge */}
                                    {nudge && qty > 0 && (
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] bg-orange-50 rounded px-2 py-1 border border-orange-200/40">
                                            <Zap className="w-3 h-3 text-orange-500 shrink-0" />
                                            <span className="text-orange-700">+{nudge.qtyNeeded} more = <strong>Rs.{nudge.nextPrice}</strong></span>
                                            <span className="text-green-600 font-bold ml-auto">save Rs.{nudge.savingsPerUnit}</span>
                                        </div>
                                    )}

                                    {/* Running total — receipt style */}
                                    {qty > 0 && (
                                        <div className="mt-1.5 pt-1.5 border-t-2 border-double border-amber-300/50 flex items-center justify-between text-[11px]" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                                            <span className="text-amber-600">{qty} x Rs.{effectivePrice}</span>
                                            <span className="font-extrabold text-amber-900 tabular-nums text-sm">
                                                TOTAL Rs.{(effectivePrice * qty).toLocaleString("en-IN")}
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
