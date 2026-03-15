"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Neon Pop — vibrant gradient-bordered card.
 * Animated gradient border wrapper with inner white card,
 * bold oversized price, playful badges, energetic hover.
 */
export const NeonPopCard = memo(function NeonPopCard({ product }: { product: Product }) {
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
            {/* Gradient border wrapper */}
            <div
                className="p-[2px] h-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 hover:from-cyan-500 hover:via-pink-500 hover:to-purple-500 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                style={{ borderRadius: "var(--theme-card-radius, 1rem)" }}
            >
                <div
                    className="bg-white h-full flex flex-col overflow-hidden"
                    style={{ borderRadius: "calc(var(--theme-card-radius, 1rem) - 2px)" }}
                >
                    {/* Image */}
                    <div className={`flex ${img.containerClass} flex-1`}><div
                        className={`relative bg-gradient-to-br from-purple-50 to-pink-50 shrink-0 ${img.imageClass} overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        style={img.imageStyle}
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
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-5xl font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                                    {product.name.charAt(0)}
                                </span>
                            </div>
                        )}

                        {/* Neon badges */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-2 left-2 flex gap-1.5">
                                {product.hot && (
                                    <span className="inline-flex items-center text-[10px] font-black bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-red-500/30">
                                        <Flame className="w-3 h-3 mr-0.5" /> HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="inline-flex items-center text-[10px] font-black bg-gradient-to-r from-green-400 to-emerald-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-green-500/30">
                                        <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-4 flex flex-col flex-grow min-w-0">
                        <h3 className="text-[15px] font-black text-slate-900 leading-tight">
                            {product.name}
                        </h3>
                        <div className="flex gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-telugu">{product.telugu}</span>
                            <span className="text-slate-200">•</span>
                            <span>{product.hindi}</span>
                        </div>

                        {/* Bold gradient price */}
                        <div className="mt-2.5 flex items-baseline gap-1.5">
                            <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                ₹{lowestPrice}
                            </span>
                            {hasTierRange && (
                                <span className="text-sm font-bold text-slate-300">– ₹{highestPrice}</span>
                            )}
                            <span className="text-xs text-slate-400 font-bold">/{product.unit}</span>
                        </div>

                        {/* Neon tier chips */}
                        {tiers.length > 1 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {tiers.map((tier, i) => {
                                    const colors = [
                                        "bg-pink-50 text-pink-600 border-pink-200",
                                        "bg-purple-50 text-purple-600 border-purple-200",
                                        "bg-cyan-50 text-cyan-600 border-cyan-200",
                                        "bg-violet-50 text-violet-600 border-violet-200",
                                    ];
                                    return (
                                        <span
                                            key={i}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[i % colors.length]}`}
                                        >
                                            {tier.range}: ₹{tier.price}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {product.moqRequired !== false && (
                            <div className="text-[10px] text-slate-400 mt-1.5 font-bold">
                                Min Order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
                            </div>
                        )}

                        <div className="mt-auto pt-3">
                            <CartControls product={product} />
                        </div>
                    </div>
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
