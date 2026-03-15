"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, ArrowDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Premium Shelf — Grocery shelf price-tag aesthetic.
 *
 * Image: respects theme settings (imageWidth, imagePosition).
 * Main price as a big "shelf label" block. Tiers shown as descending
 * price tags with a visual "ladder" connector. Active tag pops out.
 * Clean, utilitarian, instantly scannable.
 */
export const PremiumShelfCard = memo(function PremiumShelfCard({ product }: { product: Product }) {
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
    const hasTierRange = basePrice !== lowestPrice;

    const imgPos = theme.cardLayout?.imagePosition || "left";
    const imgW = theme.cardLayout?.imageWidth || 25;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out flex flex-col h-full"
                style={{ borderRadius: "var(--theme-card-radius, 0.5rem)" }}
            >
                {/* Dynamic layout: horizontal or vertical based on theme */}
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image — respects theme settings */}
                    <div
                        className={`relative shrink-0 bg-slate-50 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
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
                                <span className="text-xl font-bold text-slate-300">{product.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {/* Shelf label header — colored band */}
                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-2 flex items-center justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-sm font-bold text-white leading-tight truncate">{product.name}</h3>
                                    {product.hot && <Flame className="w-3 h-3 text-red-300 shrink-0" />}
                                    {product.fresh && <LeafyGreen className="w-3 h-3 text-green-300 shrink-0" />}
                                </div>
                                <div className="text-[10px] text-emerald-200 truncate">
                                    <span className="font-telugu">{product.telugu}</span>
                                    {product.hindi && <> · {product.hindi}</>}
                                </div>
                            </div>

                            {/* Big shelf price */}
                            <div className="bg-white rounded-lg px-2.5 py-1 text-center shrink-0 shadow-sm">
                                <div className="text-lg font-extrabold text-emerald-700 leading-none tabular-nums">
                                    Rs.{effectivePrice}
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium">
                                    {hasTierRange ? `${lowestPrice}-${basePrice}` : "per"} /{product.unit}
                                </div>
                            </div>
                        </div>

                        {/* Price tag ladder */}
                        {tiers.length > 0 && (
                            <div className="px-3 py-2">
                                <div className="flex items-start gap-2">
                                    {/* Vertical connector line */}
                                    <div className="flex flex-col items-center pt-1 shrink-0">
                                        {tiers.map((_, i) => (
                                            <React.Fragment key={i}>
                                                <div className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                                    i === activeIdx
                                                        ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] scale-125"
                                                        : activeIdx >= 0 && i < activeIdx
                                                            ? "bg-slate-300"
                                                            : "bg-slate-200"
                                                }`} />
                                                {i < tiers.length - 1 && (
                                                    <div className={`w-0.5 h-4 ${
                                                        activeIdx >= 0 && i < activeIdx ? "bg-emerald-300" : "bg-slate-200"
                                                    }`} />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    {/* Tag rows */}
                                    <div className="flex-1 space-y-1 min-w-0">
                                        {tiers.map((tier, i) => {
                                            const isActive = i === activeIdx;
                                            const isPast = activeIdx >= 0 && i < activeIdx;
                                            const saving = basePrice - tier.price;

                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex items-center justify-between px-2 py-1 rounded-md transition-all duration-200 ${
                                                        isActive
                                                            ? "bg-emerald-50 border border-emerald-300 shadow-sm"
                                                            : isPast
                                                                ? "bg-slate-50 border border-transparent opacity-40"
                                                                : "bg-slate-50 border border-transparent"
                                                    }`}
                                                >
                                                    <span className={`text-[11px] font-medium ${isActive ? "text-emerald-800 font-bold" : "text-slate-600"}`}>
                                                        {tier.range} {product.unit}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className={`text-xs font-bold tabular-nums ${isActive ? "text-emerald-700" : "text-slate-700"}`}>
                                                            Rs.{tier.price}
                                                        </span>
                                                        {saving > 0 && (
                                                            <span className={`text-[9px] font-medium ${isActive ? "text-emerald-500" : "text-slate-300"}`}>
                                                                <ArrowDown className="w-2 h-2 inline" />{Math.round((saving / basePrice) * 100)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Nudge */}
                                {nudge && qty > 0 && (
                                    <div className="mt-1.5 bg-amber-50 border border-amber-200/50 rounded-md px-2.5 py-1 flex items-center gap-1 text-[10px]">
                                        <span className="text-amber-700 font-medium">+{nudge.qtyNeeded} {product.unit}</span>
                                        <span className="text-amber-400">=</span>
                                        <span className="text-amber-800 font-bold">Rs.{nudge.nextPrice}/{product.unit}</span>
                                        <span className="text-emerald-600 font-bold ml-auto">save Rs.{nudge.savingsPerUnit}</span>
                                    </div>
                                )}

                                {product.moqRequired !== false && !qty && (
                                    <div className="text-[9px] text-slate-400 mt-1">Min order: {product.moq} {product.unit}</div>
                                )}
                            </div>
                        )}

                        {tiers.length === 0 && product.moqRequired !== false && (
                            <div className="px-3 pt-1 text-[10px] text-slate-400">Min: {product.moq} {product.unit}</div>
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
