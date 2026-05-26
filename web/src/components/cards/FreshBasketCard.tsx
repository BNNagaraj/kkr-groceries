"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, ShoppingBasket, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Fresh Basket — Orange-forward theme matching the KKR Groceries logo.
 *
 * The logo is vibrant orange basket with green leaf accent.
 * This theme leads with that warm orange (#F7941D) as the hero colour,
 * using fresh green (#3A9B42) as the supporting accent — the opposite
 * polarity of the kkrbrand theme. Feels like a produce market: warm,
 * inviting, retail-friendly.
 *
 * Design cues from the logo:
 * - Bold orange header band (the basket)
 * - White body with subtle warm tint (clean, readable)
 * - Green accent on active tier & savings badges (the leaf emblem)
 * - Rounded, friendly borders matching the basket curves
 * - Shopping-basket icon motif
 */
export const FreshBasketCard = memo(function FreshBasketCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const { cart } = useAppStore();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const nudge = getNextTierNudge(qty, product.price, product.priceTiers || [], product.unit);
    const effectivePrice = qty > 0 && product.priceTiers?.length
        ? resolveSlabPrice(qty, product.price, product.priceTiers)
        : product.price;

    const img = useImageLayout();

    return (
        <>
            <div
                className="overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{
                    borderRadius: "var(--theme-card-radius, 1rem)",
                    background: "#fffcf8",
                    border: "1px solid #fde3c0",
                    boxShadow: "0 1px 4px rgba(247,148,29,0.10), 0 0 0 0.5px rgba(247,148,29,0.05)",
                }}
            >
                {/* ── Vibrant orange header (the basket band) ── */}
                <div
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                    style={{ background: "linear-gradient(135deg, #F7941D 0%, #E88A15 60%, #D97B0D 100%)" }}
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        <ShoppingBasket className="w-3.5 h-3.5 text-white/70 shrink-0" />
                        <h3 className="font-extrabold text-white text-[15px] leading-tight truncate">
                            {product.name}
                        </h3>
                        {product.hot && (
                            <span className="inline-flex items-center text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full shrink-0">
                                <Flame className="w-2.5 h-2.5 mr-0.5" /> Hot
                            </span>
                        )}
                        {product.fresh && (
                            <span className="inline-flex items-center text-[9px] font-bold bg-[#3A9B42] text-white px-1.5 py-0.5 rounded-full shrink-0">
                                <LeafyGreen className="w-2.5 h-2.5 mr-0.5" /> Fresh
                            </span>
                        )}
                    </div>

                    {/* White price pill — sits inside the orange band for contrast */}
                    <div className="flex items-baseline gap-0.5 shrink-0 bg-white rounded-full px-3 py-1 shadow-md">
                        <span className="text-[10px] font-bold text-[#E07B0D]">₹</span>
                        <span className="text-lg font-black text-[#D06A00] leading-none tabular-nums">{effectivePrice}</span>
                        <span className="text-[10px] text-[#E07B0D]/70 font-medium">/{product.unit}</span>
                    </div>
                </div>

                {/* ── Image + Info row ── */}
                <div className={`flex ${img.containerClass} flex-1`}>
                    <div
                        className={`relative shrink-0 ${img.imageClass} overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        style={{ ...img.imageStyle, background: "#fef7ee" }}
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
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-80 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-green-50">
                                <span className="text-4xl font-black text-orange-200">{product.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* ── Info panel ── */}
                    <div className="flex-1 min-w-0 px-3.5 pt-2.5 pb-1">
                        {/* Telugu + Hindi names */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-orange-900/70 font-medium" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
                                {product.telugu}
                            </span>
                            {product.hindi && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-orange-300" />
                                    <span className="text-xs text-slate-500">{product.hindi}</span>
                                </>
                            )}
                        </div>

                        {product.moqRequired !== false && (
                            <div className="text-[10px] text-slate-400 mt-1">
                                Min order: {product.moq} {product.unit}
                            </div>
                        )}

                        {/* ── Tier pricing list ── */}
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
                                                    ? "shadow-md scale-[1.01]"
                                                    : "border text-slate-600"
                                            }`}
                                            style={
                                                isActive
                                                    ? { background: "#3A9B42", color: "#fff" }
                                                    : { background: "#fef9f2", borderColor: "#fde3c0" }
                                            }
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                                <span className={`text-xs font-semibold ${isActive ? "text-green-100" : "text-slate-500"}`}>
                                                    {tier.range} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-sm font-extrabold tabular-nums ${isActive ? "text-white" : "text-slate-800"}`}>
                                                    ₹{tier.price}
                                                </span>
                                                {saving > 0 && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        isActive ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                                                    }`}>
                                                        <TrendingDown className="w-2 h-2 inline mr-0.5 -mt-px" />{saving}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Next-tier nudge */}
                                {nudge && qty > 0 && (
                                    <div
                                        className="rounded-lg px-2.5 py-1.5 text-center"
                                        style={{ background: "#fef3e2", border: "1px dashed #F7941D" }}
                                    >
                                        <span className="text-[11px] font-bold text-[#D06A00]">
                                            🛒 Add {nudge.qtyNeeded} more
                                        </span>
                                        <span className="text-[11px] text-slate-500 mx-1">→</span>
                                        <span className="text-[11px] font-bold text-[#3A9B42]">
                                            ₹{nudge.nextPrice}/{product.unit}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Cart controls ── */}
                <div className="mt-auto px-3.5 pb-3">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox
                src={product.image}
                alt={product.name}
                telugu={product.telugu}
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
            />
        </>
    );
});
