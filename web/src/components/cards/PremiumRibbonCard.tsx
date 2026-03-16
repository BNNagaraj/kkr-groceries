"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, ArrowRight } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Premium Ribbon — "OrchardSage" redesign.
 *
 * Clean, clutter-free wholesale card. Muted sage-green accent, structured
 * tier block with left-border highlight on the active slab, generous whitespace.
 * Designed for scannability — price + name dominate, tiers are elegant & compact.
 *
 * Signature: "Structured Tier Block" — thin left-accent line on active tier,
 * small ACTIVE pill, sage-green nudge bar. No ribbons, no visual noise.
 */

/* ─── Palette (OrchardSage) ─── */
const C = {
    sage:      "#569C7E",
    sageDark:  "#427B63",
    sageLight: "#ECF8F3",
    text1:     "#1A202C",
    text2:     "#4A5568",
    muted:     "#718096",
    border:    "#E5E7EB",
    bg:        "#FFFFFF",
    hot:       "#EF4444",
} as const;

export const PremiumRibbonCard = memo(function PremiumRibbonCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const { cart } = useAppStore();
    const img = useImageLayout();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const basePrice = product.price;
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const nudge = getNextTierNudge(qty, basePrice, product.priceTiers || [], product.unit);
    const effectivePrice = qty > 0 && product.priceTiers?.length
        ? resolveSlabPrice(qty, basePrice, product.priceTiers) : basePrice;

    return (
        <>
            <div
                className="bg-white overflow-hidden flex flex-col h-full transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.75rem)",
                    border: `1px solid ${C.border}`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
            >
                {/* Image + Content wrapper — respects theme layout */}
                <div className={`flex ${img.containerClass} flex-1`}>

                    {/* ── Image ── */}
                    <div
                        className={`relative shrink-0 overflow-hidden group/img ${img.imageClass} ${hasImage ? "cursor-pointer" : ""}`}
                        style={{
                            ...img.imageStyle,
                            backgroundColor: "#f7faf9",
                        }}
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
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f0faf5 0%, #e8f4ee 100%)" }}>
                                <span className="text-3xl font-semibold" style={{ color: "#c6ddd2" }}>{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Badges — top-right, small & clean */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                                {product.hot && (
                                    <span className="inline-flex items-center text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: C.hot }}>
                                        <Flame className="w-2.5 h-2.5 mr-0.5" />HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="inline-flex items-center text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: C.sage }}>
                                        <LeafyGreen className="w-2.5 h-2.5 mr-0.5" />FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-5">

                        {/* Product name */}
                        <h3 className="text-base sm:text-lg font-semibold leading-tight truncate" style={{ color: C.text1 }}>
                            {product.name}
                        </h3>

                        {/* Telugu / Hindi */}
                        <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: C.muted }}>
                            <span className="font-telugu">{product.telugu}</span>
                            {product.hindi && <span> · {product.hindi}</span>}
                        </p>

                        {/* Price + MOQ row */}
                        <div className="flex items-baseline justify-between mt-3">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: C.text1 }}>
                                    Rs.{effectivePrice}
                                </span>
                                <span className="text-sm" style={{ color: C.text2 }}>/{product.unit}</span>
                            </div>
                            {product.moqRequired !== false && (
                                <span className="text-xs" style={{ color: C.muted }}>
                                    MOQ: {product.moq} {product.unit}
                                </span>
                            )}
                        </div>

                        {/* ── Structured Tier Block ── */}
                        {tiers.length > 0 && (
                            <div className="mt-3 pt-3 flex flex-col gap-1" style={{ borderTop: `1px solid ${C.border}` }}>
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;

                                    return (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all duration-200"
                                            style={{
                                                backgroundColor: isActive ? C.sageLight : "transparent",
                                                borderLeft: isActive ? `2px solid ${C.sage}` : "2px solid transparent",
                                                opacity: isPast ? 0.45 : 1,
                                                paddingLeft: isActive ? "8px" : "10px",
                                            }}
                                        >
                                            <span className="text-sm" style={{ color: C.text2 }}>
                                                {tier.range} {product.unit}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm sm:text-base font-semibold tabular-nums" style={{ color: C.text1 }}>
                                                    Rs.{tier.price}
                                                </span>
                                                {isActive && (
                                                    <span
                                                        className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded-full"
                                                        style={{ backgroundColor: C.sage }}
                                                    >
                                                        ACTIVE
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Next-tier nudge */}
                                {nudge && qty > 0 && (
                                    <div
                                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm font-medium mt-0.5"
                                        style={{ backgroundColor: C.sageLight, color: C.sage }}
                                    >
                                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                            Add {nudge.qtyNeeded} {product.unit} for <strong>Rs.{nudge.nextPrice}/{product.unit}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cart */}
                        <div className="mt-auto pt-3">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
