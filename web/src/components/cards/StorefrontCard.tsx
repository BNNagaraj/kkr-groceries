"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox, useImageLayout } from "./shared";

/**
 * Bold Storefront — conversion-focused card.
 * Accent-colored left border strip, XXL price, prominent CTA.
 */
export const StorefrontCard = memo(function StorefrontCard({ product }: { product: Product }) {
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
                className="bg-white shadow-sm overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{
                    borderRadius: "var(--theme-card-radius, 0.5rem)",
                    borderLeft: "4px solid var(--color-accent, #f97316)",
                }}
            >
                <div className={`flex ${img.containerClass} items-stretch flex-grow`}>
                    {/* Image */}
                    <div
                        className={`shrink-0 bg-slate-50 relative overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
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
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-bold text-slate-200">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Badge overlay */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                                {product.hot && (
                                    <span className="flex items-center text-[8px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                        <Flame className="w-2.5 h-2.5 mr-0.5" /> HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="flex items-center text-[8px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                        <LeafyGreen className="w-2.5 h-2.5 mr-0.5" /> FRESH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-2.5 sm:p-3 flex flex-col min-w-0">
                        <h3 className="font-bold text-slate-800 text-[15px] leading-tight truncate">
                            {product.name}
                        </h3>
                        <div className="flex gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-telugu truncate">{product.telugu}</span>
                            <span className="text-slate-200">•</span>
                            <span className="truncate">{product.hindi}</span>
                        </div>

                        {/* XXL Price */}
                        <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
                            <span className="text-xl sm:text-2xl font-extrabold" style={{ color: "var(--color-primary, #059669)" }}>
                                ₹{lowestPrice}
                            </span>
                            {hasTierRange && (
                                <span className="text-sm font-semibold text-slate-400">– ₹{highestPrice}</span>
                            )}
                            <span className="text-xs text-slate-500 font-medium">/{product.unit}</span>
                        </div>

                        {/* Tier range text */}
                        {tiers.length > 1 && (
                            <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                                {tiers.map((tier, i) => (
                                    <span key={i} className="text-[10px] text-slate-500 font-medium">
                                        {tier.range}: <span className="font-bold text-slate-700">₹{tier.price}</span>
                                    </span>
                                ))}
                            </div>
                        )}

                        {product.moqRequired !== false && (
                            <div className="text-[10px] text-slate-400 mt-1">
                                Min Order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
                            </div>
                        )}
                    </div>
                </div>

                {/* Full-width CTA */}
                <div className="px-3 pb-3">
                    <CartControls product={product} />
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
