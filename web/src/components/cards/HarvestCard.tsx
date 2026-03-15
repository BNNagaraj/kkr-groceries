"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, Tag } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Harvest — Warm, earthy, organic produce aesthetic.
 * Cream/amber tones, soft rounded shapes, tiers as stacked ribbon tags.
 * Active tier tag is larger/accented. Approachable for small wholesale buyers.
 */
export const HarvestCard = memo(function HarvestCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const { cart } = useAppStore();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const nudge = getNextTierNudge(qty, product.price, product.priceTiers || [], product.unit);
    const effectivePrice = qty > 0 && product.priceTiers?.length ? resolveSlabPrice(qty, product.price, product.priceTiers) : product.price;

    // Warm tag colors
    const TAG_COLORS = [
        { bg: "bg-amber-100/80", border: "border-amber-300/60", text: "text-amber-800", price: "text-amber-900", activeBg: "bg-amber-500", activeText: "text-white" },
        { bg: "bg-orange-100/60", border: "border-orange-300/50", text: "text-orange-800", price: "text-orange-900", activeBg: "bg-orange-500", activeText: "text-white" },
        { bg: "bg-emerald-100/60", border: "border-emerald-300/50", text: "text-emerald-800", price: "text-emerald-900", activeBg: "bg-emerald-600", activeText: "text-white" },
        { bg: "bg-teal-100/60", border: "border-teal-300/50", text: "text-teal-800", price: "text-teal-900", activeBg: "bg-teal-600", activeText: "text-white" },
        { bg: "bg-green-100/60", border: "border-green-300/50", text: "text-green-800", price: "text-green-900", activeBg: "bg-green-600", activeText: "text-white" },
    ];

    return (
        <>
            <div
                className="overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{
                    borderRadius: "var(--theme-card-radius, 1.25rem)",
                    background: "linear-gradient(175deg, #fffbf0 0%, #fff8e8 40%, #fefce8 100%)",
                    border: "1px solid rgba(217, 179, 101, 0.25)",
                }}
            >
                {/* Hero image area */}
                <div
                    className={`relative aspect-[2/1] w-full bg-amber-50 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                    onClick={() => hasImage && setLightboxOpen(true)}
                >
                    {hasImage ? (
                        <>
                            <Image src={product.image} alt={product.name} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-70 transition-opacity drop-shadow-lg" />
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                            <span className="text-5xl font-bold text-amber-200">{product.name.charAt(0)}</span>
                        </div>
                    )}

                    {/* Floating price badge */}
                    <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg border border-amber-200/50">
                        <span className="text-lg font-extrabold text-amber-900">Rs.{effectivePrice}</span>
                        <span className="text-xs text-amber-600 font-medium ml-0.5">/{product.unit}</span>
                    </div>

                    {/* Badges */}
                    {(product.hot || product.fresh) && (
                        <div className="absolute top-2 left-2 flex gap-1.5">
                            {product.hot && (
                                <span className="flex items-center text-[9px] font-bold bg-red-500/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-full shadow-sm">
                                    <Flame className="w-3 h-3 mr-0.5" /> Hot
                                </span>
                            )}
                            {product.fresh && (
                                <span className="flex items-center text-[9px] font-bold bg-green-500/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-full shadow-sm">
                                    <LeafyGreen className="w-3 h-3 mr-0.5" /> Fresh
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Name section */}
                <div className="px-3.5 pt-3 pb-1">
                    <h3 className="font-bold text-amber-950 text-base leading-tight" style={{ fontFamily: "'Georgia', 'Noto Serif', serif" }}>
                        {product.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-amber-700/80 font-medium" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
                            {product.telugu}
                        </span>
                        {product.hindi && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-amber-300" />
                                <span className="text-xs text-amber-600/60">{product.hindi}</span>
                            </>
                        )}
                    </div>
                    {product.moqRequired !== false && (
                        <div className="text-[10px] text-amber-600/50 mt-0.5">Min order: {product.moq} {product.unit}</div>
                    )}
                </div>

                {/* Tier Tags — Stacked ribbon tags */}
                {tiers.length > 0 && (
                    <div className="px-3.5 py-2 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Tag className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Bulk Pricing</span>
                        </div>

                        {tiers.map((tier, i) => {
                            const isActive = i === activeIdx;
                            const isPast = activeIdx >= 0 && i < activeIdx;
                            const color = TAG_COLORS[Math.min(i, TAG_COLORS.length - 1)];
                            const saving = product.price - tier.price;

                            return (
                                <div
                                    key={i}
                                    className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-300 ${
                                        isActive
                                            ? `${color.activeBg} border-transparent shadow-md scale-[1.02]`
                                            : isPast
                                                ? "bg-amber-50/50 border-amber-200/30 opacity-40"
                                                : `${color.bg} ${color.border}`
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isActive && (
                                            <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse shrink-0" />
                                        )}
                                        <div>
                                            <div className={`text-xs font-bold ${isActive ? color.activeText : color.text}`}>
                                                {tier.range} {product.unit}
                                            </div>
                                            {saving > 0 && (
                                                <div className={`text-[9px] font-medium ${isActive ? "text-white/70" : "text-amber-500/70"}`}>
                                                    Save Rs.{saving}/{product.unit}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-sm font-extrabold tabular-nums ${isActive ? color.activeText : color.price}`}>
                                        Rs.{tier.price}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Nudge */}
                        {nudge && qty > 0 && (
                            <div className="bg-emerald-50/80 border border-emerald-200/50 rounded-xl px-3 py-2 text-center">
                                <span className="text-[11px] font-bold text-emerald-800">
                                    Add {nudge.qtyNeeded} more {product.unit}
                                </span>
                                <span className="text-[11px] text-emerald-600 mx-1">to get</span>
                                <span className="text-[11px] font-bold text-emerald-700">
                                    Rs.{nudge.nextPrice}/{product.unit}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Cart */}
                <div className="mt-auto px-3.5 pb-3.5">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
