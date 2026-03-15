"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Editorial — vintage newspaper-style card.
 * Serif headings, dashed border, dotted separators, old-press editorial feel.
 */
export const EditorialCard = memo(function EditorialCard({ product }: { product: Product }) {
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
                className="bg-[#faf9f6] border-2 border-dashed border-slate-300 overflow-hidden flex flex-col h-full hover:border-slate-400 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
            >
                {/* Category label — small caps */}
                <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                    <span className="text-[9px] sm:text-[10px] font-bold text-red-600 uppercase tracking-[0.2em]">
                        FRESH PRODUCE
                    </span>
                </div>

                {/* Image */}
                <div className="px-3 sm:px-4 pt-2">
                    <div
                        className={`relative ${img.isHorizontal ? "h-full" : "aspect-[4/3] w-full"} bg-slate-100 overflow-hidden grayscale-[15%] group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes={img.imageSizes}
                                    className="object-cover group-hover/img:grayscale-0 transition-all duration-500"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-5xl font-serif font-bold text-slate-200">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Badges */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-2 right-2 flex gap-1.5">
                                {product.hot && (
                                    <span className="text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 uppercase tracking-wider">
                                        HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="text-[9px] font-bold bg-green-700 text-white px-1.5 py-0.5 uppercase tracking-wider">
                                        FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4 pt-2.5 sm:pt-3 flex flex-col flex-grow">
                    {/* Dotted separator */}
                    <div className="border-b border-dotted border-slate-300 pb-2 mb-2">
                        <h3 className="text-lg sm:text-xl font-serif font-bold text-slate-900 leading-tight">
                            {product.name}
                        </h3>
                        <div className="flex gap-2 text-[11px] text-slate-400 mt-0.5 italic">
                            <span className="font-telugu">{product.telugu}</span>
                            <span>·</span>
                            <span>{product.hindi}</span>
                        </div>
                    </div>

                    {/* Price as editorial headline */}
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-serif font-black text-slate-900">
                            ₹{lowestPrice}
                        </span>
                        {hasTierRange && (
                            <span className="text-sm font-serif text-slate-400">– ₹{highestPrice}</span>
                        )}
                        <span className="text-xs text-slate-500 italic">per {product.unit}</span>
                    </div>

                    {/* Tier info */}
                    {tiers.length > 1 && (
                        <div className="mt-2 border-t border-dotted border-slate-300 pt-2">
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {tiers.map((tier, i) => (
                                    <span key={i} className="text-[10px] text-slate-600 font-medium">
                                        {tier.range}: <span className="font-bold text-slate-800">₹{tier.price}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {product.moqRequired !== false && (
                        <div className="text-[10px] text-slate-400 mt-1.5 italic">
                            Minimum order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
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
