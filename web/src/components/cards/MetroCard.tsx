"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Bold Metro — material/metro-style tiles.
 * Solid color header band with product name in white, flat white body below.
 */
export const MetroCard = memo(function MetroCard({ product }: { product: Product }) {
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
                className="bg-white border border-slate-200 overflow-hidden flex flex-col h-full hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 0.375rem)" }}
            >
                {/* Color header band */}
                <div
                    className="px-4 py-2.5 flex items-center justify-between gap-2"
                    style={{ background: "var(--color-primary, #059669)" }}
                >
                    <h3 className="font-bold text-white text-sm leading-tight truncate">
                        {product.name}
                    </h3>
                    <div className="flex gap-1 shrink-0">
                        {product.hot && (
                            <span className="flex items-center text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded">
                                <Flame className="w-2.5 h-2.5 mr-0.5" /> HOT
                            </span>
                        )}
                        {product.fresh && (
                            <span className="flex items-center text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded">
                                <LeafyGreen className="w-2.5 h-2.5 mr-0.5" /> FRESH
                            </span>
                        )}
                    </div>
                </div>

              <div className={`flex ${img.containerClass} flex-1`}>
                {/* Image */}
                <div
                    className={`relative bg-slate-50 overflow-hidden group/img shrink-0 ${img.imageClass} ${hasImage ? "cursor-pointer" : ""}`}
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
                            <span className="text-5xl font-bold text-slate-200">{product.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                {/* Content body */}
                <div className="p-3 sm:p-3.5 flex flex-col flex-grow min-w-0">
                    {/* Languages */}
                    <div className="flex gap-2 text-[11px] text-slate-400">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-200">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Price */}
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-lg sm:text-xl font-extrabold text-slate-800">₹{lowestPrice}</span>
                        {hasTierRange && (
                            <span className="text-sm font-semibold text-slate-400">– ₹{highestPrice}</span>
                        )}
                        <span className="text-xs text-slate-500">/{product.unit}</span>
                    </div>

                    {/* Tier chips */}
                    {tiers.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {tiers.map((tier, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded border"
                                    style={{
                                        borderColor: "var(--color-primary, #059669)",
                                        color: "var(--color-primary, #059669)",
                                        background: "var(--color-primary-light, #ecfdf5)",
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
