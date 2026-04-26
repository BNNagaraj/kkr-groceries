"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Terracotta — Warm Mediterranean pottery aesthetic.
 *
 * Visual identity: Burnt sienna (#c2703e) and cream (#fdf6ee) palette.
 * Arched top on images, warm shadows, clay-textured tier blocks.
 * Earthy, inviting, artisan market feel. Rounded organic shapes.
 */
export const TerracottaCard = memo(function TerracottaCard({ product }: { product: Product }) {
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
                className="overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out flex flex-col h-full"
                style={{
                    borderRadius: "var(--theme-card-radius, 1rem)",
                    background: "#fdf6ee",
                    border: "1px solid #e8d5c0",
                    boxShadow: "0 2px 8px rgba(194,112,62,0.08)",
                }}
            >
                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image — warm toned with arch overlay */}
                    <div
                        className={`relative shrink-0 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
                            isHorizontal ? "aspect-auto" : "aspect-[4/3] w-full"
                        }`}
                        style={isHorizontal ? { width: `${imgW}%` } : undefined}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={isHorizontal ? `${imgW}vw` : "100vw"} className="object-cover" style={{ filter: "saturate(1.1) sepia(0.08)" }} unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                {/* Arch-shaped bottom overlay */}
                                <div className="absolute bottom-0 left-0 right-0 h-4" style={{
                                    background: "#fdf6ee",
                                    borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                                }} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(180deg, #e8d5c0 0%, #f0e0cc 100%)" }}>
                                <span className="text-3xl font-bold text-[#c2703e]/30">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Savings badge */}
                        {maxSavingsPercent > 0 && tiers.length > 1 && (
                            <div className="absolute top-2 left-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md" style={{ background: "#c2703e" }}>
                                -{maxSavingsPercent}%
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="px-4 pt-2 pb-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-bold leading-tight truncate" style={{ color: "#5a3520" }}>{product.name}</h3>
                                        {product.hot && <Flame className="w-3 h-3 text-orange-500 shrink-0" />}
                                        {product.fresh && <LeafyGreen className="w-3 h-3 shrink-0" style={{ color: "#6b8c42" }} />}
                                    </div>
                                    <div className="text-[10px] truncate mt-0.5" style={{ color: "#a0856e" }}>
                                        <span className="font-telugu">{product.telugu}</span>
                                        {product.hindi && <> · {product.hindi}</>}
                                    </div>
                                    {product.moqRequired !== false && (
                                        <div className="text-[9px] mt-0.5" style={{ color: "#b8a08a" }}>Min: {product.moq} {product.unit}</div>
                                    )}
                                </div>

                                {/* Price — terracotta medallion */}
                                <div
                                    className="shrink-0 rounded-full w-14 h-14 flex flex-col items-center justify-center"
                                    style={{
                                        background: "linear-gradient(135deg, #c2703e 0%, #d4854f 100%)",
                                        boxShadow: "0 2px 8px rgba(194,112,62,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                                    }}
                                >
                                    <div className="text-sm font-extrabold text-white leading-none tabular-nums">₹{effectivePrice}</div>
                                    <div className="text-[8px] text-white/60 font-medium">/{product.unit}</div>
                                </div>
                            </div>
                        </div>

                        {/* TERRACOTTA TIERS — clay-colored blocks with warm progression */}
                        {tiers.length > 0 && (
                            <div className="px-4 pb-2 space-y-1">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;
                                    const clayBgs = ["#f5e6d6", "#eddac6", "#e5cdb6", "#ddc0a6", "#d5b396"];

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-3 py-1.5 transition-all duration-300 ${isPast ? "opacity-35" : ""}`}
                                            style={{
                                                borderRadius: "0.5rem",
                                                background: isActive ? "#c2703e" : clayBgs[Math.min(i, clayBgs.length - 1)],
                                                color: isActive ? "#fdf6ee" : "#6b4c34",
                                                transform: isActive ? "scale(1.02)" : "scale(1)",
                                                boxShadow: isActive ? "0 3px 10px rgba(194,112,62,0.25)" : "none",
                                                borderLeft: isActive ? "3px solid #a05a2e" : "3px solid transparent",
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isActive && (
                                                    <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse shrink-0" />
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
                                    <div className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg" style={{ background: "#f5e6d6", color: "#6b4c34", border: "1px dashed #d5b396" }}>
                                        <TrendingDown className="w-3 h-3 shrink-0" style={{ color: "#c2703e" }} />
                                        <span>+{nudge.qtyNeeded} {product.unit} → ₹{nudge.nextPrice}/{product.unit}</span>
                                        <span className="font-bold ml-auto" style={{ color: "#6b8c42" }}>save ₹{nudge.savingsPerUnit}</span>
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
