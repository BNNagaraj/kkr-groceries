"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, TrendingDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Sapphire Night — Deep navy dark theme with silver/platinum accents.
 *
 * Visual identity: Rich navy (#0f172a) with silver metallic pricing,
 * sapphire blue (#1e40af) highlights on active tiers. Diamond-cut
 * angular accents. Luxury jewelry-store aesthetic. Elegant typography.
 */
export const SapphireCard = memo(function SapphireCard({ product }: { product: Product }) {
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
    const imgW = theme.cardLayout?.imageWidth || 28;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    return (
        <>
            <div
                className="overflow-hidden hover:shadow-xl hover:shadow-blue-900/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out flex flex-col h-full"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.75rem)",
                    background: "linear-gradient(180deg, #0f172a 0%, #131b30 100%)",
                    border: "1px solid #1e293b",
                }}
            >
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
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent opacity-70" />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
                                <span className="text-3xl font-light" style={{ color: "#94a3b8" }}>{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Savings badge — silver */}
                        {maxSavingsPercent > 0 && tiers.length > 1 && (
                            <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg" style={{ background: "linear-gradient(135deg, #c0c0c0, #e8e8e8)", color: "#0f172a" }}>
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
                                        <h3 className="text-sm font-semibold leading-tight truncate" style={{ color: "#e2e8f0", letterSpacing: "0.03em" }}>{product.name}</h3>
                                        {product.hot && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                                        {product.fresh && <LeafyGreen className="w-3 h-3 text-emerald-400 shrink-0" />}
                                    </div>
                                    <div className="text-[10px] truncate mt-0.5" style={{ color: "#475569" }}>
                                        <span className="font-telugu">{product.telugu}</span>
                                        {product.hindi && <> · {product.hindi}</>}
                                    </div>
                                    {product.moqRequired !== false && (
                                        <div className="text-[9px] mt-0.5" style={{ color: "#334155" }}>Min: {product.moq} {product.unit}</div>
                                    )}
                                </div>

                                {/* Price — silver/platinum metallic */}
                                <div className="shrink-0 text-right">
                                    <div
                                        className="text-xl font-bold leading-none tabular-nums"
                                        style={{
                                            background: "linear-gradient(180deg, #f1f5f9 0%, #94a3b8 100%)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        ₹{effectivePrice}
                                    </div>
                                    <div className="text-[9px] font-medium" style={{ color: "#475569" }}>/{product.unit}</div>
                                </div>
                            </div>

                            {/* Thin sapphire divider */}
                            <div className="h-px mt-2" style={{ background: "linear-gradient(90deg, transparent, #1e40af, transparent)" }} />
                        </div>

                        {/* SAPPHIRE TIERS — angular dark bars with blue active glow */}
                        {tiers.length > 0 && (
                            <div className="px-3 pb-2 space-y-1">
                                {tiers.map((tier, i) => {
                                    const isActive = i === activeIdx;
                                    const isPast = activeIdx >= 0 && i < activeIdx;
                                    const saving = basePrice - tier.price;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-3 py-1.5 transition-all duration-300 ${isPast ? "opacity-30" : ""}`}
                                            style={{
                                                borderRadius: "0.375rem",
                                                background: isActive
                                                    ? "linear-gradient(90deg, #1e3a8a 0%, #1e40af 100%)"
                                                    : "rgba(30,41,59,0.5)",
                                                border: isActive ? "1px solid #3b82f6" : "1px solid rgba(51,65,85,0.3)",
                                                boxShadow: isActive ? "0 0 15px rgba(30,64,175,0.3)" : "none",
                                                transform: isActive ? "scale(1.02)" : "scale(1)",
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse shrink-0" style={{ boxShadow: "0 0 4px #3b82f6" }} />
                                                )}
                                                <span className={`text-[11px] font-medium truncate ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                                                    {tier.range} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className={`text-xs font-bold tabular-nums ${isActive ? "text-white" : "text-slate-300"}`}>₹{tier.price}</span>
                                                {saving > 0 && (
                                                    <span className={`text-[9px] ${isActive ? "text-blue-200/60" : "text-slate-500"}`}>-₹{saving}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Nudge */}
                                {nudge && qty > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-md" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                                        <TrendingDown className="w-3 h-3 text-amber-400/60 shrink-0" />
                                        <span className="text-amber-300/60">+{nudge.qtyNeeded} {product.unit} → ₹{nudge.nextPrice}/{product.unit}</span>
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
