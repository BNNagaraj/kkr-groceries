"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, Zap } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Premium Mini — Ultra-compact variant with tier PILLS instead of rows.
 *
 * Everything in ~2-3 rows of height. Tiers shown as small horizontal pills
 * that light up when active. No wasted vertical space.
 * Perfect for 2-column mobile grids.
 */
export const PremiumMiniCard = memo(function PremiumMiniCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const { cart } = useAppStore();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const basePrice = product.price;
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const nudge = getNextTierNudge(qty, basePrice, product.priceTiers || [], product.unit);
    const effectivePrice = qty > 0 && product.priceTiers?.length
        ? resolveSlabPrice(qty, basePrice, product.priceTiers)
        : basePrice;
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : basePrice;
    const maxSavingsPercent = basePrice > 0 ? Math.round(((basePrice - lowestPrice) / basePrice) * 100) : 0;

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out flex flex-col h-full"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* Top: image + name + price in one tight row */}
                <div className="flex items-center gap-2.5 p-2.5">
                    {/* Tiny image */}
                    <div
                        className={`w-12 h-12 rounded-lg shrink-0 bg-slate-50 border border-slate-100 relative overflow-hidden ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-slate-200">{product.name.charAt(0)}</span>
                            </div>
                        )}
                        {maxSavingsPercent > 0 && (
                            <div className="absolute -top-0.5 -right-0.5 bg-emerald-600 text-white text-[7px] font-bold px-1 py-0.5 rounded-bl-md rounded-tr-md leading-none">
                                -{maxSavingsPercent}%
                            </div>
                        )}
                    </div>

                    {/* Name block */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                            <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">{product.name}</h3>
                            {product.hot && <Flame className="w-3 h-3 text-red-500 shrink-0" />}
                            {product.fresh && <LeafyGreen className="w-3 h-3 text-green-500 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            <span className="font-telugu">{product.telugu}</span>
                            {product.hindi && <> · {product.hindi}</>}
                        </div>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-emerald-700 leading-none tabular-nums">
                            Rs.{effectivePrice}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">/{product.unit}</div>
                    </div>
                </div>

                {/* Tier Pills — the compact magic */}
                {tiers.length > 0 && (
                    <div className="px-2.5 pb-1.5">
                        <div className="flex gap-1 flex-wrap">
                            {tiers.map((tier, i) => {
                                const isActive = i === activeIdx;
                                const isPast = activeIdx >= 0 && i < activeIdx;

                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all duration-200 ${
                                            isActive
                                                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 scale-105"
                                                : isPast
                                                    ? "bg-slate-100 text-slate-400"
                                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                                        }`}
                                    >
                                        {isActive && (
                                            <span className="w-1 h-1 rounded-full bg-white animate-pulse shrink-0" />
                                        )}
                                        <span className="font-medium whitespace-nowrap">{tier.range}</span>
                                        <span className="font-bold tabular-nums whitespace-nowrap">Rs.{tier.price}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Nudge — super compact */}
                        {nudge && qty > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-700">
                                <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                <span>+{nudge.qtyNeeded} more = <strong>Rs.{nudge.nextPrice}</strong> (save Rs.{nudge.savingsPerUnit})</span>
                            </div>
                        )}
                    </div>
                )}

                {product.moqRequired !== false && !tiers.length && (
                    <div className="px-2.5 text-[10px] text-slate-400">Min: {product.moq} {product.unit}</div>
                )}

                {/* Cart Controls */}
                <div className="mt-auto px-2.5 pb-2.5">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
