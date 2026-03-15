"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Elegant Minimal — luxury e-commerce feel.
 * Soft shadow, no border, padded image area, frosted glass price badge.
 */
export const ElegantCard = memo(function ElegantCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : product.price;

    return (
        <>
            <div
                className="bg-white shadow-md overflow-hidden flex flex-col h-full hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 1rem)" }}
            >
                {/* Image with internal padding */}
                <div className="p-2.5 sm:p-3 pb-0">
                    <div
                        className={`relative w-full aspect-[4/3] rounded-xl bg-slate-50 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 640px) 100vw, 33vw"
                                    className="object-cover transition-transform duration-500 group-hover/img:scale-110"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                                <span className="text-5xl font-bold text-slate-200">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Frosted glass price badge */}
                        <div className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-md shadow-lg border border-white/50">
                            <span className="text-lg font-extrabold text-slate-800">
                                ₹{lowestPrice}
                            </span>
                            <span className="text-xs text-slate-500 ml-0.5">/{product.unit}</span>
                        </div>

                        {/* Badges */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                                {product.hot && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-white/80 backdrop-blur-sm text-red-600 px-2 py-1 rounded-full shadow-sm">
                                        <Flame className="w-3 h-3 mr-0.5" /> HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-white/80 backdrop-blur-sm text-green-600 px-2 py-1 rounded-full shadow-sm">
                                        <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4 pt-2.5 sm:pt-3 flex flex-col flex-grow">
                    <h3 className="text-[15px] font-bold text-slate-800 leading-tight">
                        {product.name}
                    </h3>
                    <div className="flex gap-2 text-[12px] text-slate-400 mt-0.5">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-200">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Tier pills */}
                    {tiers.length > 1 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {tiers.map((tier, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium"
                                >
                                    {tier.range}: ₹{tier.price}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* MOQ */}
                    {product.moqRequired !== false && (
                        <div className="text-[11px] text-slate-400 mt-2">
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
