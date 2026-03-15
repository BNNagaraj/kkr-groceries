"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Premium Compact — Same Premium Wholesale DNA but ~40% shorter.
 *
 * Changes from original Premium:
 * - Image: small fixed square (not aspect-16/9), always horizontal layout
 * - Removed: Product ID line, Quality Checked badge, bottom badges row
 * - Tiers: single-line rows (qty + price inline), tighter padding
 * - Uses shared CartControls (not the taller PremiumCartControls)
 * - Added: active tier highlighting + next-tier nudge
 */

const TIER_LABELS = ["Retail", "Wholesale", "Bulk", "Super Bulk", "Mega"];

export const PremiumCompactCard = memo(function PremiumCompactCard({ product }: { product: Product }) {
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
    const lowestTierPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : basePrice;
    const maxSavingsPercent = basePrice > 0 ? Math.round(((basePrice - lowestTierPrice) / basePrice) * 100) : 0;

    const img = useImageLayout();

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* Always horizontal: image left, content right */}
                <div className={`flex ${img.containerClass}`}>
                    {/* Small fixed image */}
                    <div
                        className={`shrink-0 bg-slate-50 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes={img.imageSizes}
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-70 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                                <span className="text-3xl font-bold text-slate-200">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Savings badge on image */}
                        {maxSavingsPercent > 0 && tiers.length > 1 && (
                            <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                -{maxSavingsPercent}%
                            </div>
                        )}

                        {/* Hot/Fresh badge */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute bottom-1 left-1 flex gap-0.5">
                                {product.hot && <Flame className="w-3.5 h-3.5 text-red-500 drop-shadow-sm" />}
                                {product.fresh && <LeafyGreen className="w-3.5 h-3.5 text-green-500 drop-shadow-sm" />}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-2.5 sm:p-3 flex flex-col min-w-0">
                        {/* Name + price row */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-[15px] font-bold text-slate-800 leading-tight truncate">
                                    {product.name}
                                </h3>
                                <div className="flex gap-1 text-[11px] text-slate-400 mt-0.5 truncate">
                                    <span className="font-telugu">{product.telugu}</span>
                                    <span className="text-slate-200">*</span>
                                    <span>{product.hindi}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-lg font-extrabold text-slate-800 leading-none">
                                    Rs.{effectivePrice}
                                </div>
                                <div className="text-[10px] text-slate-400">/{product.unit}</div>
                            </div>
                        </div>

                        {/* Compact tier table */}
                        {tiers.length > 0 && (
                            <div className="mt-1.5 border border-slate-200 rounded-md overflow-hidden">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;
                                    const label = TIER_LABELS[Math.min(i, TIER_LABELS.length - 1)];

                                    // Progressive green — same Premium DNA
                                    const bgClasses = [
                                        "bg-emerald-50/60",
                                        "bg-emerald-100/70",
                                        "bg-emerald-700 text-white",
                                        "bg-emerald-800 text-white",
                                        "bg-emerald-900 text-white",
                                    ];
                                    const bgClass = bgClasses[Math.min(i, bgClasses.length - 1)];
                                    const isDark = i >= 2;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-2 py-1 ${
                                                i > 0 ? (isDark ? "border-t border-emerald-600/20" : "border-t border-slate-100") : ""
                                            } ${
                                                isActive
                                                    ? `${bgClass} ring-1 ring-inset ${isDark ? "ring-emerald-400/40" : "ring-emerald-500/30"} shadow-sm`
                                                    : isPast
                                                        ? `${bgClass} opacity-50`
                                                        : bgClass
                                            } transition-all duration-200`}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {/* Active indicator */}
                                                {isActive && (
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isDark ? "bg-emerald-300" : "bg-emerald-500"}`} />
                                                )}
                                                <span className={`text-[11px] font-semibold truncate ${isDark ? "text-white" : "text-slate-700"} ${isActive ? "font-bold" : ""}`}>
                                                    {label} · {tier.range}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className={`text-xs font-bold tabular-nums ${isDark ? "text-white" : "text-slate-800"}`}>
                                                    Rs.{tier.price}
                                                </span>
                                                {saving > 0 && (
                                                    <span className={`text-[9px] font-medium ${isDark ? "text-emerald-200" : "text-emerald-600"}`}>
                                                        -Rs.{saving}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Next-tier nudge */}
                        {nudge && qty > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200/50">
                                <TrendingDown className="w-3 h-3 shrink-0" />
                                <span className="font-medium">+{nudge.qtyNeeded} {product.unit}</span>
                                <span className="text-amber-500">→</span>
                                <span className="font-bold">Rs.{nudge.nextPrice}/{product.unit}</span>
                            </div>
                        )}

                        {product.moqRequired !== false && !tiers.length && (
                            <div className="text-[10px] text-slate-400 mt-1">
                                Min: {product.moq} {product.unit}
                            </div>
                        )}

                        {/* Standard CartControls — much more compact than PremiumCartControls */}
                        <div className="mt-auto pt-1.5">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
