"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Mandi Board — Inspired by Indian wholesale mandi rate boards.
 * Dark green background, LED-style monospace prices, glowing active tier strip.
 * Telugu/Hindi names prominent. Feels like walking into Bowenpally mandi.
 */
export const MandiCard = memo(function MandiCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const { cart } = useAppStore();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const nudge = getNextTierNudge(qty, product.price, product.priceTiers || [], product.unit);

    return (
        <>
            <div
                className="overflow-hidden flex flex-col h-full hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.5rem)",
                    background: "linear-gradient(145deg, #0a2e1a 0%, #0d3b22 50%, #0a2e1a 100%)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
            >
                {/* Header: Image + Name */}
                <div className="flex items-center gap-3 p-3 border-b border-emerald-900/60">
                    {/* Image */}
                    <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg shrink-0 bg-black/30 border border-emerald-800/50 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="64px"
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold text-emerald-700/50">{product.name.charAt(0)}</span>
                            </div>
                        )}
                        {/* Badges */}
                        {product.hot && (
                            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                <Flame className="w-2.5 h-2.5 text-white" />
                            </span>
                        )}
                    </div>

                    {/* Name block */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-emerald-50 text-[15px] leading-tight truncate tracking-wide"
                            style={{ fontFamily: "'Courier New', Consolas, monospace" }}>
                            {product.name.toUpperCase()}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-amber-300/90 font-medium truncate" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
                                {product.telugu}
                            </span>
                            {product.hindi && (
                                <>
                                    <span className="text-emerald-700">|</span>
                                    <span className="text-xs text-emerald-400/70 truncate">{product.hindi}</span>
                                </>
                            )}
                        </div>
                        {product.moqRequired !== false && (
                            <div className="text-[10px] text-emerald-600/70 mt-0.5 tracking-wider"
                                style={{ fontFamily: "'Courier New', monospace" }}>
                                MOQ: {product.moq} {product.unit}
                            </div>
                        )}
                        {product.fresh && (
                            <span className="inline-flex items-center text-[9px] font-bold text-green-300 mt-0.5 gap-0.5">
                                <LeafyGreen className="w-3 h-3" /> FRESH TODAY
                            </span>
                        )}
                    </div>

                    {/* Big Price (no tiers = show base) */}
                    {tiers.length === 0 && (
                        <div className="text-right shrink-0">
                            <div className="text-2xl font-extrabold text-emerald-300 tracking-tight"
                                style={{ fontFamily: "'Courier New', Consolas, monospace", textShadow: "0 0 12px rgba(16, 185, 129, 0.4)" }}>
                                Rs.{product.price}
                            </div>
                            <div className="text-[10px] text-emerald-500/80 tracking-wider">PER {product.unit.toUpperCase()}</div>
                        </div>
                    )}
                </div>

                {/* Tier Rate Board — the hero element */}
                {tiers.length > 0 && (
                    <div className="px-2 py-1.5">
                        {/* Board header */}
                        <div className="flex items-center justify-between px-2 py-1 mb-1">
                            <span className="text-[9px] font-bold text-emerald-600/80 tracking-[0.2em] uppercase"
                                style={{ fontFamily: "'Courier New', monospace" }}>
                                RATE BOARD
                            </span>
                            <span className="text-[9px] text-emerald-600/60 tracking-wider"
                                style={{ fontFamily: "'Courier New', monospace" }}>
                                Rs. / {product.unit}
                            </span>
                        </div>

                        {/* Tier strips */}
                        <div className="space-y-1">
                            {tiers.map((tier, i) => {
                                const isActive = i === activeIdx;
                                const isPast = activeIdx >= 0 && i < activeIdx;

                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all duration-300 ${
                                            isActive
                                                ? "bg-emerald-500/25 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                                                : isPast
                                                    ? "bg-emerald-950/50 border border-emerald-900/30 opacity-50"
                                                    : "bg-black/20 border border-emerald-900/20"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {/* Active dot */}
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                                                isActive
                                                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse"
                                                    : isPast
                                                        ? "bg-emerald-800"
                                                        : "bg-emerald-900/50"
                                            }`} />
                                            <span className={`text-xs tracking-wider ${
                                                isActive ? "text-emerald-200 font-bold" : isPast ? "text-emerald-700" : "text-emerald-500/70"
                                            }`} style={{ fontFamily: "'Courier New', monospace" }}>
                                                {tier.range} {product.unit}
                                            </span>
                                        </div>
                                        <span className={`text-sm tracking-tight tabular-nums ${
                                            isActive
                                                ? "text-emerald-300 font-extrabold"
                                                : isPast
                                                    ? "text-emerald-700 font-bold"
                                                    : "text-emerald-400/80 font-bold"
                                        }`} style={{
                                            fontFamily: "'Courier New', Consolas, monospace",
                                            ...(isActive ? { textShadow: "0 0 8px rgba(16, 185, 129, 0.5)" } : {}),
                                        }}>
                                            Rs.{tier.price}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Next tier nudge */}
                        {nudge && (
                            <div className="mt-1.5 px-2 py-1.5 rounded-md bg-amber-900/20 border border-amber-700/20">
                                <div className="text-[10px] text-amber-300/90 font-medium tracking-wide"
                                    style={{ fontFamily: "'Courier New', monospace" }}>
                                    +{nudge.qtyNeeded} {product.unit} = Rs.{nudge.nextPrice}/{product.unit} (SAVE Rs.{nudge.savingsPerUnit})
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Cart Controls */}
                <div className="mt-auto p-2.5 pt-1">
                    <div className="[&_button]:border-emerald-700/50 [&_.bg-emerald-50]:bg-emerald-900/30 [&_.text-emerald-700]:text-emerald-300 [&_.bg-emerald-700]:bg-emerald-600 [&_.text-emerald-600]:text-emerald-400 [&_.text-emerald-100]:text-emerald-200">
                        <CartControls product={product} />
                    </div>
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
