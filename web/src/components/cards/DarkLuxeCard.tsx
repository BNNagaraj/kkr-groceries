"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

/**
 * Dark Luxe — premium dark-mode card.
 * Dark slate-900 body, gold/amber accent pricing, cinematic image treatment.
 */
export const DarkLuxeCard = memo(function DarkLuxeCard({ product }: { product: Product }) {
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
                className="bg-slate-900 overflow-hidden flex flex-col h-full shadow-lg shadow-black/20 hover:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* Image with cinematic filter */}
                <div
                    className={`relative aspect-[4/3] w-full bg-slate-800 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                    onClick={() => hasImage && setLightboxOpen(true)}
                >
                    {hasImage ? (
                        <>
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                className="object-cover brightness-90 group-hover/img:brightness-100 transition-all duration-500"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-80 transition-opacity drop-shadow-lg" />
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700">
                            <span className="text-5xl font-bold text-slate-600">{product.name.charAt(0)}</span>
                        </div>
                    )}

                    {/* Badges */}
                    {(product.hot || product.fresh) && (
                        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                            {product.hot && (
                                <span className="inline-flex items-center text-[10px] font-bold bg-red-500/90 text-white px-2 py-0.5 rounded-full shadow-lg">
                                    <Flame className="w-3 h-3 mr-0.5" /> HOT
                                </span>
                            )}
                            {product.fresh && (
                                <span className="inline-flex items-center text-[10px] font-bold bg-emerald-500/90 text-white px-2 py-0.5 rounded-full shadow-lg">
                                    <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                </span>
                            )}
                        </div>
                    )}

                    {/* Bottom gradient fade into dark body */}
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900 to-transparent" />
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4 flex flex-col flex-grow">
                    <h3 className="text-[15px] font-bold text-white leading-tight">
                        {product.name}
                    </h3>
                    <div className="flex gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-telugu">{product.telugu}</span>
                        <span className="text-slate-600">•</span>
                        <span>{product.hindi}</span>
                    </div>

                    {/* Gold price */}
                    <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-extrabold text-amber-400">
                            ₹{lowestPrice}
                        </span>
                        {hasTierRange && (
                            <span className="text-sm font-semibold text-amber-400/50">– ₹{highestPrice}</span>
                        )}
                        <span className="text-xs text-slate-500">/{product.unit}</span>
                    </div>

                    {/* Tier badges with amber accent */}
                    {tiers.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {tiers.map((tier, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] font-semibold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25"
                                >
                                    {tier.range}: ₹{tier.price}
                                </span>
                            ))}
                        </div>
                    )}

                    {product.moqRequired !== false && (
                        <div className="text-[10px] text-slate-500 mt-1.5">
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
