"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen } from "lucide-react";
import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * List Pro — ultra-compact single-row card for power buyers.
 * Everything in one line: image, name, tiers, cart controls.
 */
export const ListProCard = memo(function ListProCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : product.price;

    return (
        <>
            <div className="bg-white border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5">
                    {/* Top row on mobile: image + name + price */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                        {/* Image */}
                        <div
                            className={`w-10 h-10 sm:w-[52px] sm:h-[52px] rounded-lg shrink-0 bg-slate-50 border border-slate-100 relative overflow-hidden ${hasImage ? "cursor-pointer" : ""}`}
                            onClick={() => hasImage && setLightboxOpen(true)}
                        >
                            {hasImage ? (
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="52px"
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-bold text-slate-200">{product.name.charAt(0)}</span>
                                </div>
                            )}
                        </div>

                        {/* Name + badges + languages */}
                        <div className="min-w-0 flex-1 sm:w-[160px] sm:flex-none">
                            <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-slate-800 text-[13px] sm:text-sm leading-tight truncate">
                                    {product.name}
                                </h3>
                                {product.hot && (
                                    <Flame className="w-3 h-3 text-red-500 shrink-0" />
                                )}
                                {product.fresh && (
                                    <LeafyGreen className="w-3 h-3 text-green-500 shrink-0" />
                                )}
                            </div>
                            <div className="flex gap-1.5 text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                                <span className="font-telugu">{product.telugu}</span>
                                <span className="text-slate-200">•</span>
                                <span>{product.hindi}</span>
                            </div>
                        </div>

                        {/* Price + tiers inline */}
                        <div className="flex items-center gap-2 shrink-0 sm:flex-1 sm:min-w-0">
                            <span className="text-sm sm:text-base font-extrabold shrink-0" style={{ color: "var(--color-primary, #059669)" }}>
                                ₹{lowestPrice}
                                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">/{product.unit}</span>
                            </span>
                            {tiers.length > 1 && (
                                <div className="hidden sm:flex flex-wrap gap-1 min-w-0">
                                    {tiers.map((tier, i) => (
                                        <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                                            {tier.range}: ₹{tier.price}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart controls - full width on mobile, fixed width on sm+ */}
                    <div className="w-full sm:w-[180px] sm:shrink-0">
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
