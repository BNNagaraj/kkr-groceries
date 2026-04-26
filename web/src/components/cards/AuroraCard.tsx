"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Aurora Borealis — Dark mode with flowing northern-lights gradient accents.
 *
 * Visual identity: Deep charcoal (#1a1a2e) background, aurora gradient strips
 * (purple → teal → green) on hover/active states. Glowing tier badges with
 * neon-edged active tier. Frosted dark glass overlays. Premium celestial feel.
 */
export const AuroraCard = memo(function AuroraCard({ product }: { product: Product }) {
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

    const imgPos = theme.cardLayout?.imagePosition || "left";
    const imgW = theme.cardLayout?.imageWidth || 30;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    const AURORA_GRADIENT = "linear-gradient(135deg, #7c3aed 0%, #06b6d4 50%, #10b981 100%)";

    return (
        <>
            <div
                className="overflow-hidden hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out flex flex-col h-full group/card"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.75rem)",
                    background: "#16162a",
                    border: "1px solid #2a2a4a",
                }}
            >
                {/* Aurora gradient glow on top edge */}
                <div className="h-[2px] w-full opacity-60 group-hover/card:opacity-100 transition-opacity" style={{ background: AURORA_GRADIENT }} />

                <div className={`flex ${isHorizontal ? (imgPos === "right" ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    {/* Image */}
                    <div
                        className={`relative shrink-0 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""} ${
                            isHorizontal ? "aspect-auto" : "aspect-[16/9] w-full"
                        }`}
                        style={isHorizontal ? { width: `${imgW}%` } : undefined}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={isHorizontal ? `${imgW}vw` : "100vw"} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#16162a] via-transparent to-transparent opacity-60" />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e1e3a 0%, #2a1e4a 100%)" }}>
                                <span className="text-3xl font-bold" style={{ background: AURORA_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                    {product.name.charAt(0)}
                                </span>
                            </div>
                        )}

                        {/* Savings badge — aurora gradient */}
                        {maxSavingsPercent > 0 && tiers.length > 1 && (
                            <div
                                className="absolute top-2 left-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg"
                                style={{ background: AURORA_GRADIENT }}
                            >
                                -{maxSavingsPercent}%
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="p-3 pb-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-bold text-white/90 leading-tight truncate">{product.name}</h3>
                                        {product.hot && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                                        {product.fresh && <LeafyGreen className="w-3 h-3 text-emerald-400 shrink-0" />}
                                    </div>
                                    <div className="text-[10px] text-white/30 truncate mt-0.5">
                                        <span className="font-telugu">{product.telugu}</span>
                                        {product.hindi && <> · {product.hindi}</>}
                                    </div>
                                    {product.moqRequired !== false && (
                                        <div className="text-[9px] text-white/25 mt-0.5">Min: {product.moq} {product.unit}</div>
                                    )}
                                </div>

                                {/* Price — aurora glow */}
                                <div className="shrink-0 rounded-lg px-2.5 py-1.5 text-center" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
                                    <div
                                        className="text-lg font-extrabold leading-none tabular-nums"
                                        style={{ background: AURORA_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                                    >
                                        ₹{effectivePrice}
                                    </div>
                                    <div className="text-[9px] text-purple-300/60 font-medium">/{product.unit}</div>
                                </div>
                            </div>
                        </div>

                        {/* AURORA TIERS — dark glass bars with gradient active glow */}
                        {tiers.length > 0 && (
                            <div className="px-3 pb-2 space-y-1">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-3 py-1.5 transition-all duration-300 rounded-lg ${isPast ? "opacity-30" : ""}`}
                                            style={{
                                                background: isActive
                                                    ? "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(6,182,212,0.3) 50%, rgba(16,185,129,0.3) 100%)"
                                                    : "rgba(255,255,255,0.04)",
                                                border: isActive ? "1px solid rgba(6,182,212,0.4)" : "1px solid transparent",
                                                boxShadow: isActive ? "0 0 12px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
                                                transform: isActive ? "scale(1.02)" : "scale(1)",
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: "#06b6d4", boxShadow: "0 0 6px #06b6d4" }} />
                                                )}
                                                <span className={`text-[11px] font-medium truncate ${isActive ? "text-cyan-200" : "text-white/50"}`}>
                                                    {tier.range} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className={`text-xs font-bold tabular-nums ${isActive ? "text-white" : "text-white/60"}`}>₹{tier.price}</span>
                                                {saving > 0 && (
                                                    <span className="text-[9px] text-emerald-400/60">-₹{saving}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Nudge */}
                                {nudge && qty > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                        <TrendingDown className="w-3 h-3 text-amber-400/70 shrink-0" />
                                        <span className="text-amber-300/70">+{nudge.qtyNeeded} {product.unit} → ₹{nudge.nextPrice}/{product.unit}</span>
                                        <span className="font-bold text-emerald-400 ml-auto">save ₹{nudge.savingsPerUnit}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cart */}
                        <div className="px-3 pb-3 mt-auto">
                            <CartControls product={product} />
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
