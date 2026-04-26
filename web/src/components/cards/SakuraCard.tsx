"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Sakura Bloom — Cherry blossom inspired, soft and elegant.
 *
 * Visual identity: Soft pink (#fce7f3) and white palette with rose (#e11d48)
 * accent highlights. Petal-shaped tier badges with gentle gradients.
 * Light, airy, delicate. Subtle flower motifs in empty states.
 */
export const SakuraCard = memo(function SakuraCard({ product }: { product: Product }) {
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
    const maxSavingsPercent = basePrice > 0 ? Math.round(((basePrice - lowestPrice) / basePrice) * 100) : 0;

    const imgPos = theme.cardLayout?.imagePosition || "top";
    const imgW = theme.cardLayout?.imageWidth || 35;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    return (
        <>
            <div
                className="overflow-hidden hover:shadow-lg hover:shadow-pink-200/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out flex flex-col h-full"
                style={{
                    borderRadius: "var(--theme-card-radius, 1rem)",
                    background: "linear-gradient(180deg, #fff5f8 0%, #ffffff 100%)",
                    border: "1px solid #fce7f3",
                    boxShadow: "0 1px 4px rgba(225,29,72,0.06)",
                }}
            >
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image with soft pink overlay */}
                    <div
                        className={`relative shrink-0 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
                            isHorizontal ? "aspect-auto" : "aspect-[4/3] w-full"
                        }`}
                        style={isHorizontal ? { width: `${imgW}%` } : undefined}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={isHorizontal ? `${imgW}vw` : "100vw"} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-gradient-to-b from-pink-100/20 via-transparent to-white/30" />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)" }}>
                                {/* Petal motif */}
                                <div className="relative">
                                    <span className="text-3xl font-light text-pink-200">{product.name.charAt(0)}</span>
                                    <div className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-pink-200/60" />
                                    <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full bg-pink-300/40" />
                                </div>
                            </div>
                        )}

                        {/* Savings — petal badge */}
                        {maxSavingsPercent > 0 && tiers.length > 1 && (
                            <div
                                className="absolute top-2 left-2 text-white text-[9px] font-bold px-2.5 py-0.5 shadow-md"
                                style={{
                                    background: "linear-gradient(135deg, #ec4899 0%, #e11d48 100%)",
                                    borderRadius: "12px 12px 12px 4px",
                                }}
                            >
                                -{maxSavingsPercent}%
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="px-4 pt-3 pb-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-semibold leading-tight truncate" style={{ color: "#4a1942" }}>{product.name}</h3>
                                        {product.hot && <Flame className="w-3 h-3 text-rose-400 shrink-0" />}
                                        {product.fresh && <LeafyGreen className="w-3 h-3 text-emerald-400 shrink-0" />}
                                    </div>
                                    <div className="text-[10px] truncate mt-0.5" style={{ color: "#c084a8" }}>
                                        <span className="font-telugu">{product.telugu}</span>
                                        {product.hindi && <> · {product.hindi}</>}
                                    </div>
                                    {product.moqRequired !== false && (
                                        <div className="text-[9px] mt-0.5" style={{ color: "#d4a8c8" }}>Min: {product.moq} {product.unit}</div>
                                    )}
                                </div>

                                {/* Price — rose accent */}
                                <div
                                    className="shrink-0 rounded-xl px-3 py-1.5 text-center"
                                    style={{
                                        background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                                        border: "1px solid #fbcfe8",
                                    }}
                                >
                                    <div className="text-lg font-extrabold leading-none tabular-nums" style={{ color: "#be185d" }}>
                                        ₹{effectivePrice}
                                    </div>
                                    <div className="text-[9px] font-medium" style={{ color: "#ec4899" }}>/{product.unit}</div>
                                </div>
                            </div>
                        </div>

                        {/* SAKURA TIERS — petal-shaped soft pink progression */}
                        {tiers.length > 0 && (
                            <div className="px-4 pb-2 space-y-1">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;
                                    const petalBgs = ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6"];
                                    const petalTexts = ["#9d174d", "#9d174d", "#831843", "#831843", "#ffffff"];

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-3 py-1.5 transition-all duration-300 ${isPast ? "opacity-35" : ""}`}
                                            style={{
                                                borderRadius: "16px 16px 16px 6px",
                                                background: isActive
                                                    ? "linear-gradient(135deg, #ec4899 0%, #e11d48 100%)"
                                                    : petalBgs[Math.min(i, petalBgs.length - 1)],
                                                color: isActive ? "#ffffff" : petalTexts[Math.min(i, petalTexts.length - 1)],
                                                transform: isActive ? "scale(1.03)" : "scale(1)",
                                                boxShadow: isActive ? "0 3px 12px rgba(236,72,153,0.3)" : "none",
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isActive && (
                                                    <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse shrink-0" />
                                                )}
                                                <span className="text-[11px] font-semibold truncate">
                                                    {tier.range} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-xs font-bold tabular-nums">₹{tier.price}</span>
                                                {saving > 0 && (
                                                    <span className={`text-[9px] ${isActive ? "text-white/60" : "opacity-50"}`}>-₹{saving}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Nudge */}
                                {nudge && qty > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-3 py-1.5" style={{ borderRadius: "12px 12px 12px 4px", background: "#fdf2f8", color: "#9d174d", border: "1px solid #fce7f3" }}>
                                        <TrendingDown className="w-3 h-3 shrink-0" style={{ color: "#ec4899" }} />
                                        <span>+{nudge.qtyNeeded} {product.unit} → ₹{nudge.nextPrice}/{product.unit}</span>
                                        <span className="font-bold ml-auto" style={{ color: "#059669" }}>save ₹{nudge.savingsPerUnit}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cart */}
                        <div className="px-4 pb-3 mt-auto">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
