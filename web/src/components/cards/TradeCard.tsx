"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, ArrowDown } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Trade Pro — Financial trading terminal aesthetic.
 * Monospace prices, ticker-tape tier display, trade ticket summary.
 * Active tier has pulsing green indicator like a live trade.
 */
export const TradeCard = memo(function TradeCard({ product }: { product: Product }) {
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
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : product.price;
    const maxDiscount = product.price > 0 ? Math.round(((product.price - lowestPrice) / product.price) * 100) : 0;

    const img = useImageLayout();

    return (
        <>
            <div
                className="overflow-hidden flex flex-col h-full hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.5rem)",
                    background: "#fafbfc",
                    border: "1px solid #e2e5ea",
                }}
            >
                {/* Ticker header bar */}
                <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-100 truncate" style={{ fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
                            {product.name.toUpperCase().replace(/\s+/g, "_")}
                        </span>
                        {product.hot && <Flame className="w-3 h-3 text-red-400 shrink-0" />}
                        {product.fresh && <LeafyGreen className="w-3 h-3 text-green-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {maxDiscount > 0 && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded" style={{ fontFamily: "monospace" }}>
                                <ArrowDown className="w-2.5 h-2.5 inline" />{maxDiscount}%
                            </span>
                        )}
                        <span className="text-[10px] text-slate-400" style={{ fontFamily: "monospace" }}>{product.unit.toUpperCase()}</span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex items-start gap-3 p-3 pb-2">
                    {/* Image */}
                    <div
                        className={`rounded-lg shrink-0 bg-slate-100 border border-slate-200 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes={img.imageSizes} className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold text-slate-200">{product.name.charAt(0)}</span></div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-[15px] leading-tight truncate">{product.name}</h3>
                        <div className="flex gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-telugu truncate">{product.telugu}</span>
                            <span className="text-slate-200">|</span>
                            <span className="truncate">{product.hindi}</span>
                        </div>
                        {product.moqRequired !== false && (
                            <div className="text-[9px] text-slate-400 mt-0.5" style={{ fontFamily: "monospace" }}>LOT: {product.moq} {product.unit}</div>
                        )}
                    </div>

                    {/* Live Price */}
                    <div className="text-right shrink-0">
                        <div className="text-xl font-extrabold text-slate-800 tabular-nums" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                            Rs.{effectivePrice}
                        </div>
                        <div className="text-[10px] text-slate-400" style={{ fontFamily: "monospace" }}>/{product.unit}</div>
                        {qty > 0 && (
                            <div className="text-[10px] font-bold text-emerald-600 mt-0.5" style={{ fontFamily: "monospace" }}>
                                = Rs.{(effectivePrice * qty).toLocaleString("en-IN")}
                            </div>
                        )}
                    </div>
                </div>

                {/* Price Bands — Trading-style tier display */}
                {tiers.length > 0 && (
                    <div className="mx-3 mb-2">
                        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                            {/* Band header */}
                            <div className="grid grid-cols-[auto_1fr_auto] items-center px-2 py-1 bg-slate-100 border-b border-slate-200">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider w-5" style={{ fontFamily: "monospace" }}>ST</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider" style={{ fontFamily: "monospace" }}>QTY BAND</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-right" style={{ fontFamily: "monospace" }}>RATE</span>
                            </div>
                            {tiers.map((tier, i) => {
                                const isActive = i === activeIdx;
                                const isPast = activeIdx >= 0 && i < activeIdx;

                                return (
                                    <div
                                        key={i}
                                        className={`grid grid-cols-[auto_1fr_auto] items-center px-2 py-1.5 border-b border-slate-100 last:border-0 transition-all duration-200 ${
                                            isActive
                                                ? "bg-emerald-50/80"
                                                : isPast
                                                    ? "opacity-40"
                                                    : ""
                                        }`}
                                    >
                                        {/* Status indicator */}
                                        <div className="w-5 flex justify-center">
                                            {isActive ? (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
                                            ) : isPast ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                            ) : (
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                            )}
                                        </div>

                                        <span className={`text-xs tabular-nums ${isActive ? "text-emerald-800 font-bold" : "text-slate-600 font-medium"}`}
                                            style={{ fontFamily: "'SF Mono', monospace" }}>
                                            {tier.range} {product.unit}
                                        </span>

                                        <div className="text-right flex items-center gap-1.5 justify-end">
                                            <span className={`text-sm tabular-nums ${isActive ? "text-emerald-700 font-extrabold" : "text-slate-700 font-bold"}`}
                                                style={{ fontFamily: "'SF Mono', monospace" }}>
                                                Rs.{tier.price}
                                            </span>
                                            {product.price > tier.price && (
                                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                                }`} style={{ fontFamily: "monospace" }}>
                                                    -{Math.round(((product.price - tier.price) / product.price) * 100)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Next-tier nudge */}
                        {nudge && qty > 0 && (
                            <div className="mt-1.5 flex items-center justify-between bg-amber-50 border border-amber-200/50 rounded-lg px-2.5 py-1.5">
                                <span className="text-[10px] font-bold text-amber-700" style={{ fontFamily: "monospace" }}>
                                    UPGRADE: +{nudge.qtyNeeded} {product.unit}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600" style={{ fontFamily: "monospace" }}>
                                    Rs.{nudge.nextPrice}/{product.unit} (SAVE Rs.{nudge.savingsPerUnit})
                                </span>
                            </div>
                        )}

                        {/* Trade ticket summary when in cart */}
                        {qty > 0 && (
                            <div className="mt-1.5 bg-slate-800 rounded-lg px-2.5 py-2 text-[10px]" style={{ fontFamily: "'SF Mono', monospace" }}>
                                <div className="flex justify-between text-slate-400">
                                    <span>QTY</span><span className="text-slate-200 font-bold">{qty} {product.unit}</span>
                                </div>
                                <div className="flex justify-between text-slate-400 mt-0.5">
                                    <span>RATE</span><span className="text-emerald-400 font-bold">Rs.{effectivePrice}/{product.unit}</span>
                                </div>
                                <div className="flex justify-between text-slate-400 mt-0.5 pt-1 border-t border-slate-700">
                                    <span>TOTAL</span><span className="text-white font-bold">Rs.{(effectivePrice * qty).toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Cart Controls */}
                <div className="mt-auto px-3 pb-3">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
