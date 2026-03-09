"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

export const CatalogCard = memo(function CatalogCard({ product }: { product: Product }) {
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
                className="bg-white shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full hover:shadow-md hover:-translate-y-[3px] active:scale-[0.98] transition-all duration-150 ease-out relative"
                style={{ borderRadius: "var(--theme-card-radius, 1rem)" }}
            >
                {/* Badges */}
                {(product.hot || product.fresh) && (
                    <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                        {product.hot && (
                            <span className="inline-flex items-center text-[10px] font-bold bg-red-50/90 backdrop-blur-sm text-red-600 px-2 py-1 rounded-full shadow-sm">
                                <Flame className="w-3 h-3 mr-0.5" /> HOT
                            </span>
                        )}
                        {product.fresh && (
                            <span className="inline-flex items-center text-[10px] font-bold bg-green-50/90 backdrop-blur-sm text-green-600 px-2 py-1 rounded-full shadow-sm">
                                <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                            </span>
                        )}
                    </div>
                )}

                {/* Image */}
                <div
                    className={`relative w-full h-[150px] sm:h-[200px] bg-slate-50 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                    onClick={() => hasImage && setLightboxOpen(true)}
                >
                    {hasImage ? (
                        <>
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-5xl font-bold text-slate-200">
                                {product.name.charAt(0)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4 flex flex-col flex-grow">
                    {/* Name + Languages */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                        {product.name}
                    </h3>
                    <div className="flex gap-2 text-[13px] text-slate-500 mt-0.5">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-300">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Price */}
                    <div className="mt-3">
                        {hasTierRange ? (
                            <div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold text-emerald-700">
                                        ₹{lowestPrice} – ₹{highestPrice}
                                    </span>
                                    <span className="text-sm text-slate-500">/{product.unit}</span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {tiers.map((tier, i) => (
                                        <span
                                            key={i}
                                            className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-100"
                                        >
                                            {tier.range}: ₹{tier.price}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-emerald-700">
                                    ₹{product.price}
                                </span>
                                <span className="text-sm text-slate-500">/{product.unit}</span>
                            </div>
                        )}
                    </div>

                    {/* MOQ */}
                    {product.moqRequired !== false && (
                        <div className="text-[11px] text-slate-400 mt-1.5">
                            Min Order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
                        </div>
                    )}

                    {/* Cart Controls */}
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
