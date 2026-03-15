"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, ArrowRight } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Premium Dense — Information-dense 2-column tier grid.
 *
 * Fixed horizontal layout. Tiers displayed in a 2-column mini grid
 * instead of vertical list. Active tier has a green glow ring.
 * Everything is on a strict vertical budget — ~50% shorter than Premium.
 * MOQ, languages, and total calc all inline.
 */
export const PremiumDenseCard = memo(function PremiumDenseCard({ product }: { product: Product }) {
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
    const hasTierRange = basePrice !== lowestPrice;

    const img = useImageLayout();

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                <div className={`flex ${img.containerClass}`}>
                    {/* Image — compact fixed width */}
                    <div
                        className={`shrink-0 bg-slate-50 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={img.imageSizes} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-70 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                                <span className="text-4xl font-bold text-slate-200">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Overlay badges */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                                {product.hot && (
                                    <span className="flex items-center text-[7px] font-bold bg-red-500 text-white px-1 py-0.5 rounded shadow-sm">
                                        <Flame className="w-2 h-2 mr-0.5" />HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="flex items-center text-[7px] font-bold bg-green-500 text-white px-1 py-0.5 rounded shadow-sm">
                                        <LeafyGreen className="w-2 h-2 mr-0.5" />FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right content */}
                    <div className="flex-1 p-2.5 flex flex-col min-w-0">
                        {/* Row 1: Name + Price */}
                        <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">{product.name}</h3>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate">
                                    <span className="font-telugu">{product.telugu}</span>
                                    <span className="text-slate-200">*</span>
                                    <span>{product.hindi}</span>
                                    {product.moqRequired !== false && (
                                        <>
                                            <span className="text-slate-200">*</span>
                                            <span>MOQ {product.moq}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-right shrink-0 pl-1">
                                {hasTierRange ? (
                                    <>
                                        <div className="text-lg font-extrabold text-emerald-700 leading-none tabular-nums">
                                            Rs.{effectivePrice}
                                        </div>
                                        <div className="text-[9px] text-slate-400">
                                            {qty > 0 ? `@ ${qty} ${product.unit}` : `Rs.${lowestPrice}-${basePrice}`}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-lg font-extrabold text-slate-800 leading-none tabular-nums">
                                            Rs.{basePrice}
                                        </div>
                                        <div className="text-[9px] text-slate-400">/{product.unit}</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Row 2: 2-column tier grid */}
                        {tiers.length > 0 && (
                            <div className="mt-1.5 grid grid-cols-2 gap-1">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-2 py-1 rounded-md transition-all duration-200 ${
                                                isActive
                                                    ? "bg-emerald-50 ring-1.5 ring-emerald-500/40 shadow-sm"
                                                    : isPast
                                                        ? "bg-slate-50 opacity-40"
                                                        : "bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-1 min-w-0">
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                                )}
                                                <span className={`text-[10px] font-medium truncate ${isActive ? "text-emerald-800" : "text-slate-500"}`}>
                                                    {tier.range}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className={`text-[11px] font-bold tabular-nums ${isActive ? "text-emerald-700" : "text-slate-700"}`}>
                                                    Rs.{tier.price}
                                                </span>
                                                {saving > 0 && (
                                                    <span className={`text-[8px] font-bold ${isActive ? "text-emerald-500" : "text-slate-300"}`}>
                                                        -{Math.round((saving / basePrice) * 100)}%
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
                            <div className="mt-1 flex items-center gap-1 text-[9px]">
                                <ArrowRight className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                <span className="text-amber-700 font-medium">
                                    +{nudge.qtyNeeded} {product.unit}
                                </span>
                                <span className="text-amber-500">=</span>
                                <span className="text-amber-800 font-bold">
                                    Rs.{nudge.nextPrice}/{product.unit}
                                </span>
                                <span className="text-emerald-600 font-bold ml-auto">
                                    save Rs.{nudge.savingsPerUnit}
                                </span>
                            </div>
                        )}

                        {/* Order total when in cart */}
                        {qty > 0 && (
                            <div className="mt-1 flex items-center justify-between text-[10px] bg-emerald-50 rounded px-2 py-0.5">
                                <span className="text-emerald-600 font-medium">{qty} {product.unit} in cart</span>
                                <span className="text-emerald-700 font-bold tabular-nums">
                                    = Rs.{(effectivePrice * qty).toLocaleString("en-IN")}
                                </span>
                            </div>
                        )}

                        {/* Cart */}
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
