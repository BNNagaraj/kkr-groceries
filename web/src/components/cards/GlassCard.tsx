"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Glassmorphism — modern frosted-glass card.
 * Translucent card body with backdrop-blur, subtle border glow,
 * layered depth with rounded image.
 */
export const GlassCard = memo(function GlassCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : product.price;
    const highestPrice = tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : product.price;
    const hasTierRange = lowestPrice !== highestPrice;

    const img = useImageLayout();

    return (
        <>
            <div
                className="relative overflow-hidden flex flex-col h-full hover:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.15),0_0_20px_rgba(99,102,241,0.1)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out"
                style={{
                    borderRadius: "var(--theme-card-radius, 1rem)",
                    background: "rgba(255,255,255,0.45)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.5)",
                    boxShadow: "0 8px 32px -4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
            >
                {/* Image */}
                <div className={`flex ${img.containerClass} flex-1`}><div className={`${img.isHorizontal ? "" : "p-2.5 sm:p-3 pb-0"} shrink-0`} style={img.isHorizontal ? { width: `${img.imgW}%` } : undefined}>
                    <div
                        className={`relative ${img.isHorizontal ? "h-full" : "aspect-[4/3] w-full"} rounded-xl sm:rounded-2xl bg-white/30 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
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
                                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/40 to-white/20">
                                <span className="text-5xl font-bold text-white/40">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Badges */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-2 left-2 flex gap-1.5">
                                {product.hot && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-red-500/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-full shadow-sm">
                                        <Flame className="w-3 h-3 mr-0.5" /> HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-green-500/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-full shadow-sm">
                                        <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                </div><div className="p-3 sm:p-4 pt-2.5 sm:pt-3 flex flex-col flex-grow min-w-0">
                    <h3 className="text-[15px] font-bold text-slate-800 leading-tight">
                        {product.name}
                    </h3>
                    <div className="flex gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-300">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Price pill with glow */}
                    <div className="mt-2.5 flex items-baseline gap-1.5">
                        <span
                            className="inline-flex items-baseline gap-0.5 px-3 py-1 rounded-full text-white font-extrabold text-base sm:text-lg"
                            style={{
                                background: "var(--color-primary, #059669)",
                                boxShadow: "0 4px 15px rgba(5,150,105,0.25)",
                            }}
                        >
                            ₹{lowestPrice}
                            <span className="text-[11px] text-white/70 font-medium">/{product.unit}</span>
                        </span>
                        {hasTierRange && (
                            <span className="text-sm text-slate-400 font-medium">– ₹{highestPrice}</span>
                        )}
                    </div>

                    {/* Tier chips with glass effect */}
                    {tiers.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {tiers.map((tier, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-600"
                                    style={{
                                        background: "rgba(255,255,255,0.5)",
                                        border: "1px solid rgba(255,255,255,0.6)",
                                    }}
                                >
                                    {tier.range}: ₹{tier.price}
                                </span>
                            ))}
                        </div>
                    )}

                    {product.moqRequired !== false && (
                        <div className="text-[10px] text-slate-400 mt-1.5">
                            Min Order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
                        </div>
                    )}

                    <div className="mt-auto pt-3">
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
