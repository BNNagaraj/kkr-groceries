"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Polaroid Snap — retro photo-print card.
 * Thick white border like a polaroid photo, slight tilt on hover,
 * price tag pinned to the image corner.
 */
export const PolaroidCard = memo(function PolaroidCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : product.price;

    return (
        <>
            <div
                className="bg-white shadow-lg hover:shadow-xl flex flex-col h-full border border-slate-100 hover:-translate-y-1 hover:rotate-[1.5deg] active:scale-[0.97] transition-all duration-200 ease-out"
                style={{ borderRadius: "2px" }}
            >
                {/* Polaroid-style thick white border around image */}
                <div className="p-2.5 sm:p-3 pb-0">
                    <div
                        className={`relative w-full h-[140px] sm:h-[180px] bg-slate-100 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
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
                                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
                                <span className="text-5xl font-bold text-slate-300">{product.name.charAt(0)}</span>
                            </div>
                        )}

                        {/* Badges */}
                        {(product.hot || product.fresh) && (
                            <div className="absolute top-2 left-2 flex gap-1.5">
                                {product.hot && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm">
                                        <Flame className="w-3 h-3 mr-0.5" /> HOT
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded shadow-sm">
                                        <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Pinned price tag */}
                        <div className="absolute -bottom-1 -right-1 rotate-3 bg-amber-50 border border-amber-200 px-2.5 py-1.5 shadow-md" style={{ borderRadius: "2px" }}>
                            <span className="text-base sm:text-lg font-bold text-slate-800 font-mono">
                                ₹{lowestPrice}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">/{product.unit}</span>
                        </div>
                    </div>
                </div>

                {/* Content — extra bottom padding like a polaroid */}
                <div className="p-2.5 sm:p-3 pt-3 sm:pt-4 pb-2 flex flex-col flex-grow">
                    <h3 className="text-[15px] font-bold text-slate-800 leading-tight">
                        {product.name}
                    </h3>
                    <div className="flex gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-200">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Tier pills */}
                    {tiers.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {tiers.map((tier, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium border border-amber-100 font-mono"
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
