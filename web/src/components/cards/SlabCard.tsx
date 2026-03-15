"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown, ChevronRight } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Smart Slab — Clean minimal design where tiers ARE the hero.
 * Active tier row highlighted with emerald glow + progress bar to next tier.
 * Tiers prominent, image secondary. Built for wholesale buyers who think in slabs.
 */
export const SlabCard = memo(function SlabCard({ product }: { product: Product }) {
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

    // Progress toward next tier
    const progressToNext = (() => {
        if (!nudge || activeIdx < 0) return 0;
        const activeTier = tiers[activeIdx];
        if (!activeTier) return 0;
        const rangeStart = activeTier.minQty;
        const rangeEnd = activeTier.maxQty === 0 ? activeTier.minQty + 100 : activeTier.maxQty;
        const rangeSize = rangeEnd - rangeStart;
        if (rangeSize <= 0) return 0;
        return Math.min(100, Math.round(((qty - rangeStart) / rangeSize) * 100));
    })();

    const img = useImageLayout();

    return (
        <>
            <div
                className="bg-white border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* Compact header: image + name + base price */}
                <div className="flex items-center gap-3 p-3 pb-2">
                    <div
                        className={`rounded-xl shrink-0 bg-slate-50 border border-slate-100 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={img.imageSizes} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold text-slate-200">{product.name.charAt(0)}</span></div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-800 text-[15px] leading-tight truncate">{product.name}</h3>
                            {product.hot && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            {product.fresh && <LeafyGreen className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        </div>
                        <div className="flex gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-telugu truncate">{product.telugu}</span>
                            <span className="text-slate-200">*</span>
                            <span className="truncate">{product.hindi}</span>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-lg font-extrabold text-slate-800">
                            Rs.{effectivePrice}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">/{product.unit}</div>
                    </div>
                </div>

                {/* Slab Table — THE HERO */}
                {tiers.length > 0 ? (
                    <div className="mx-3 mb-2">
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                            {/* Slab header */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty Range</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Rate</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-14">Save</span>
                            </div>

                            {/* Slab rows */}
                            {tiers.map((tier, i) => {
                                const isActive = i === activeIdx;
                                const isNext = i === activeIdx + 1;
                                const saving = product.price - tier.price;

                                return (
                                    <div
                                        key={i}
                                        className={`grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-2 border-b border-slate-100 last:border-0 transition-all duration-300 ${
                                            isActive
                                                ? "bg-emerald-50 border-l-[3px] border-l-emerald-500 pl-2.5"
                                                : isNext
                                                    ? "bg-amber-50/50"
                                                    : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {isActive && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                            )}
                                            {isNext && !isActive && (
                                                <ChevronRight className="w-3 h-3 text-amber-500 shrink-0" />
                                            )}
                                            <span className={`text-xs font-medium ${isActive ? "text-emerald-800 font-bold" : "text-slate-600"}`}>
                                                {tier.range} {product.unit}
                                            </span>
                                        </div>
                                        <span className={`text-sm tabular-nums text-right ${
                                            isActive ? "text-emerald-700 font-extrabold" : "text-slate-700 font-bold"
                                        }`}>
                                            Rs.{tier.price}
                                        </span>
                                        <span className={`text-[11px] font-medium text-right w-14 tabular-nums ${
                                            saving > 0 ? (isActive ? "text-emerald-600" : "text-slate-400") : "text-slate-300"
                                        }`}>
                                            {saving > 0 ? `-Rs.${saving}` : "--"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Next tier nudge with progress bar */}
                        {nudge && qty > 0 && (
                            <div className="mt-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-2.5">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                                        <TrendingDown className="w-3 h-3" /> Next Slab
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-600">
                                        +{nudge.qtyNeeded} {product.unit} = Rs.{nudge.nextPrice}/{product.unit}
                                    </span>
                                </div>
                                {/* Progress bar */}
                                <div className="h-1.5 bg-amber-200/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progressToNext}%` }}
                                    />
                                </div>
                                <div className="text-[9px] text-amber-600/80 mt-1 text-center font-medium">
                                    Save Rs.{nudge.savingsPerUnit} per {product.unit} on entire order
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* No tiers — show MOQ */
                    product.moqRequired !== false && (
                        <div className="mx-3 mb-2 text-[11px] text-slate-400">
                            Min Order: {product.moq} {product.unit}
                        </div>
                    )
                )}

                {/* Cart Controls */}
                <div className="mt-auto px-3 pb-3">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
