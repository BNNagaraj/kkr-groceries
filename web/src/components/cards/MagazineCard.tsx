"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Magazine — editorial hero-image card.
 * Full-bleed image with dark gradient overlay, name + price float on overlay.
 */
export const MagazineCard = memo(function MagazineCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : product.price;
    const highestPrice = tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : product.price;
    const hasTierRange = lowestPrice !== highestPrice;

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* Hero image with gradient overlay */}
                <div
                    className={`relative w-full aspect-[3/2] bg-slate-900 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                    onClick={() => hasImage && setLightboxOpen(true)}
                >
                    {hasImage ? (
                        <>
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                className="object-cover transition-transform duration-700 group-hover/img:scale-105"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover/img:opacity-80 transition-opacity drop-shadow-lg" />
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700">
                            <span className="text-6xl font-bold text-slate-600">{product.name.charAt(0)}</span>
                        </div>
                    )}

                    {/* Dark gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 sm:pt-16 pb-2.5 sm:pb-3 px-3 sm:px-4">
                        <h3 className="text-base sm:text-lg font-bold text-white leading-tight drop-shadow-sm">
                            {product.name}
                        </h3>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-extrabold text-white drop-shadow-sm">
                                ₹{lowestPrice}
                            </span>
                            {hasTierRange && (
                                <span className="text-sm font-semibold text-white/70">– ₹{highestPrice}</span>
                            )}
                            <span className="text-xs text-white/60">/{product.unit}</span>
                        </div>
                    </div>

                    {/* Badges */}
                    {(product.hot || product.fresh) && (
                        <div className="absolute top-3 right-3 flex gap-1.5">
                            {product.hot && (
                                <span className="inline-flex items-center text-[10px] font-bold bg-red-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full shadow-lg">
                                    <Flame className="w-3 h-3 mr-0.5" /> HOT
                                </span>
                            )}
                            {product.fresh && (
                                <span className="inline-flex items-center text-[10px] font-bold bg-green-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full shadow-lg">
                                    <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Content below image */}
                <div className="p-3 sm:p-4 flex flex-col flex-grow">
                    <div className="flex gap-2 text-[11px] sm:text-[12px] text-slate-500">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-300">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Tier pills */}
                    {tiers.length > 1 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {tiers.map((tier, i) => (
                                <span
                                    key={i}
                                    className="text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium border border-emerald-100"
                                >
                                    {tier.range}: ₹{tier.price}
                                </span>
                            ))}
                        </div>
                    )}

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
