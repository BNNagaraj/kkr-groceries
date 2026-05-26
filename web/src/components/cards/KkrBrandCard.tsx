"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, Tag } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * KKR Brand — Official KKR Groceries theme.
 * Deep green (#064e3b) header band, vibrant orange (#f7941d) price highlights,
 * white card body. Matches the brand logo: green basket + orange background.
 * Clean, professional wholesale look with bold tier pricing.
 */
export const KkrBrandCard = memo(function KkrBrandCard({ product }: { product: Product }) {
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

    const img = useImageLayout();

    return (
        <>
            <div
                className="overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out bg-white"
                style={{
                    borderRadius: "var(--theme-card-radius, 1rem)",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(6,78,59,0.08)",
                }}
            >
                {/* Green brand header strip */}
                <div className="px-3.5 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)" }}>
                    <h3 className="font-bold text-white text-[15px] leading-tight truncate flex items-center gap-1.5">
                        {product.name}
                        {product.hot && (
                            <span className="inline-flex items-center text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                                <Flame className="w-2.5 h-2.5 mr-0.5" /> Hot
                            </span>
                        )}
                        {product.fresh && (
                            <span className="inline-flex items-center text-[9px] font-bold bg-emerald-400 text-white px-1.5 py-0.5 rounded-full">
                                <LeafyGreen className="w-2.5 h-2.5 mr-0.5" /> Fresh
                            </span>
                        )}
                    </h3>
                    {/* Orange price badge */}
                    <div className="flex items-baseline gap-0.5 shrink-0 ml-2 bg-[#f7941d] rounded-lg px-2.5 py-1 shadow-sm">
                        <span className="text-xs font-bold text-white/80">Rs.</span>
                        <span className="text-lg font-extrabold text-white leading-none">{effectivePrice}</span>
                        <span className="text-[10px] text-white/70 font-medium">/{product.unit}</span>
                    </div>
                </div>

                {/* Image + Info row */}
                <div className={`flex ${img.containerClass} flex-1`}>
                    <div
                        className={`relative bg-emerald-50/30 shrink-0 ${img.imageClass} overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        style={img.imageStyle}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={img.imageSizes} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-80 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-orange-50">
                                <span className="text-4xl font-extrabold text-emerald-200">{product.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Info panel */}
                    <div className="flex-1 min-w-0 px-3.5 pt-2.5 pb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-emerald-800/70 font-medium" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
                                {product.telugu}
                            </span>
                            {product.hindi && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="text-xs text-slate-500">{product.hindi}</span>
                                </>
                            )}
                        </div>

                        {product.moqRequired !== false && (
                            <div className="text-[10px] text-slate-400 mt-1">
                                Min order: {product.moq} {product.unit}
                            </div>
                        )}

                        {/* Tier pricing */}
                        {tiers.length > 0 && (
                            <div className="mt-2.5 space-y-1">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const saving = Math.round(((product.price - tier.price) / product.price) * 100);
                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all duration-200 ${
                                                isActive
                                                    ? "bg-[#064e3b] text-white shadow-md scale-[1.01]"
                                                    : "bg-slate-50 border border-slate-100 text-slate-600"
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#f7941d] animate-pulse" />}
                                                <span className={`text-xs font-semibold ${isActive ? "text-emerald-100" : "text-slate-500"}`}>
                                                    {tier.range} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-sm font-extrabold tabular-nums ${isActive ? "text-white" : "text-slate-800"}`}>
                                                    Rs.{tier.price}
                                                </span>
                                                {saving > 0 && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        isActive ? "bg-[#f7941d] text-white" : "bg-orange-100 text-orange-600"
                                                    }`}>
                                                        {saving}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {nudge && qty > 0 && (
                                    <div className="bg-orange-50 border border-orange-200/60 rounded-lg px-2.5 py-1.5 text-center">
                                        <span className="text-[11px] font-bold text-[#064e3b]">
                                            Add {nudge.qtyNeeded} more
                                        </span>
                                        <span className="text-[11px] text-slate-500 mx-1">to get</span>
                                        <span className="text-[11px] font-bold text-[#f7941d]">
                                            Rs.{nudge.nextPrice}/{product.unit}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart controls */}
                <div className="mt-auto px-3.5 pb-3">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
