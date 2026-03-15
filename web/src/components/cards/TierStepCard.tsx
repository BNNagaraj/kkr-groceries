"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn, Zap } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, getNextTierNudge, resolveSlabPrice } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Tier Steps — Visual stepped progression from expensive to cheap.
 * Each tier is a "step" with descending prices. Active step is elevated.
 * Visual breadcrumb dots between steps. Compact, conversion-focused.
 */
export const TierStepCard = memo(function TierStepCard({ product }: { product: Product }) {
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

    // Step colors — progress from warm to cool (expensive to cheap)
    const STEP_COLORS = [
        { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-700", activeBg: "bg-slate-700", activeText: "text-white" },
        { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", activeBg: "bg-blue-600", activeText: "text-white" },
        { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", activeBg: "bg-teal-600", activeText: "text-white" },
        { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", activeBg: "bg-emerald-600", activeText: "text-white" },
        { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", activeBg: "bg-green-600", activeText: "text-white" },
    ];

    return (
        <>
            <div
                className="bg-white border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 1rem)" }}
            >
                {/* Product header */}
                <div className="p-3 pb-2 flex items-start gap-3">
                    <div
                        className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image src={product.image} alt={product.name} fill sizes="72px" className="object-cover" unoptimized={!product.image.includes("googleapis.com")} onError={() => setImgError(true)} />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl font-bold text-slate-200">{product.name.charAt(0)}</span></div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-slate-800 text-base leading-tight truncate">{product.name}</h3>
                            {product.hot && <span className="inline-flex items-center text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full"><Flame className="w-2.5 h-2.5 mr-0.5" />HOT</span>}
                            {product.fresh && <span className="inline-flex items-center text-[9px] font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full"><LeafyGreen className="w-2.5 h-2.5 mr-0.5" />FRESH</span>}
                        </div>
                        <div className="flex gap-1.5 text-xs text-slate-400 mt-0.5">
                            <span className="font-telugu truncate">{product.telugu}</span>
                            <span className="text-slate-200">|</span>
                            <span className="truncate">{product.hindi}</span>
                        </div>
                        {/* Price badge */}
                        <div className="mt-1.5 inline-flex items-baseline gap-0.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                            <span className="text-xl font-extrabold text-emerald-700">Rs.{effectivePrice}</span>
                            <span className="text-xs text-emerald-500 font-medium">/{product.unit}</span>
                        </div>
                        {product.moqRequired !== false && (
                            <div className="text-[10px] text-slate-400 mt-0.5">Min: {product.moq} {product.unit}</div>
                        )}
                    </div>
                </div>

                {/* Tier Steps — Visual ladder */}
                {tiers.length > 0 && (
                    <div className="px-3 pb-2">
                        <div className="flex items-stretch gap-0">
                            {tiers.map((tier, i) => {
                                const isActive = i === activeIdx;
                                const isPast = activeIdx >= 0 && i < activeIdx;
                                const isNext = i === activeIdx + 1;
                                const color = STEP_COLORS[Math.min(i, STEP_COLORS.length - 1)];
                                const saving = product.price - tier.price;

                                return (
                                    <React.Fragment key={i}>
                                        {/* Connector dot between steps */}
                                        {i > 0 && (
                                            <div className="flex items-center -mx-0.5 z-10">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    isPast || isActive ? "bg-emerald-400" : "bg-slate-200"
                                                }`} />
                                            </div>
                                        )}
                                        {/* Step block */}
                                        <div
                                            className={`flex-1 rounded-xl p-2 text-center border transition-all duration-300 min-w-0 ${
                                                isActive
                                                    ? `${color.activeBg} ${color.activeText} border-transparent shadow-lg scale-105 z-20`
                                                    : isPast
                                                        ? "bg-slate-50 border-slate-200 opacity-50"
                                                        : isNext
                                                            ? `${color.bg} ${color.border} ring-1 ring-amber-300/50`
                                                            : `${color.bg} ${color.border}`
                                            }`}
                                        >
                                            <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                                                isActive ? "opacity-80" : isPast ? "text-slate-400" : color.text + " opacity-60"
                                            }`}>
                                                {tier.range}
                                            </div>
                                            <div className={`text-sm font-extrabold tabular-nums ${
                                                isActive ? "" : isPast ? "text-slate-400" : color.text
                                            }`}>
                                                Rs.{tier.price}
                                            </div>
                                            {saving > 0 && (
                                                <div className={`text-[8px] font-medium mt-0.5 ${
                                                    isActive ? "opacity-80" : "text-slate-400"
                                                }`}>
                                                    -{Math.round((saving / product.price) * 100)}%
                                                </div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Nudge banner */}
                        {nudge && qty > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50 rounded-lg px-2.5 py-1.5">
                                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="text-[11px] font-bold text-amber-800">
                                    +{nudge.qtyNeeded} {product.unit} more
                                </span>
                                <span className="text-[11px] text-amber-600">
                                    = Rs.{nudge.nextPrice}/{product.unit}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600 ml-auto shrink-0">
                                    Save Rs.{nudge.savingsPerUnit}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Cart */}
                <div className="mt-auto px-3 pb-3">
                    <CartControls product={product} />
                </div>
            </div>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});
