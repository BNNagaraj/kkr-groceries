"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product } from "@/contexts/AppContext";
import { Flame, LeafyGreen, ZoomIn } from "lucide-react";

import { formatTiersForDisplay } from "@/lib/pricing";
import { CartControls, ImageLightbox } from "./shared";

export const ClassicCard = memo(function ClassicCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out"
                style={{ borderRadius: "var(--theme-card-radius, 1rem)" }}
            >
                <div className="p-2.5 sm:p-3 flex items-start gap-3 sm:gap-4 flex-grow">
                    <div
                        className={`w-14 h-14 sm:w-[70px] sm:h-[70px] rounded-xl flex-shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden relative group/img ${hasImage ? "cursor-pointer" : ""}`}
                        onClick={() => hasImage && setLightboxOpen(true)}
                        role={hasImage ? "button" : undefined}
                        aria-label={hasImage ? `View ${product.name} image` : undefined}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="70px"
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
                                </div>
                            </>
                        ) : (
                            <span className="text-2xl font-bold text-slate-300">
                                {product.name.charAt(0)}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-bold text-slate-800 text-[15px] leading-tight flex items-center gap-1.5 flex-wrap">
                                    {product.name}
                                    {product.hot && (
                                        <span className="inline-flex items-center text-[10px] font-bold bg-[#fff1f2] text-[#e11d48] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                            <Flame className="w-3 h-3 mr-0.5" /> Hot
                                        </span>
                                    )}
                                    {product.fresh && (
                                        <span className="inline-flex items-center text-[10px] font-bold bg-[#f0fdf4] text-[#16a34a] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                            <LeafyGreen className="w-3 h-3 mr-0.5" /> Fresh
                                        </span>
                                    )}
                                </h3>
                                <div className="flex gap-2 text-[13px] text-slate-500 mt-0.5">
                                    <span className="font-telugu">{product.telugu}</span>
                                    <span className="text-slate-300">•</span>
                                    <span>{product.hindi}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-2.5 flex items-end justify-between">
                            <div>
                                {product.priceTiers && product.priceTiers.length > 0 ? (
                                    <>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-bold text-emerald-700 leading-none">
                                                From ₹{Math.min(...product.priceTiers.map(t => t.price))}
                                            </span>
                                            <span className="text-[13px] text-slate-500 font-medium">
                                                /{product.unit}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                            {formatTiersForDisplay(product.priceTiers).map((tier, i) => (
                                                <span key={i} className="text-[10px] text-slate-500">
                                                    {tier.range}: <span className="font-semibold text-slate-700">₹{tier.price}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-emerald-700 leading-none">
                                            ₹{product.price}
                                        </span>
                                        <span className="text-[13px] text-slate-500 font-medium">
                                            /{product.unit}
                                        </span>
                                    </div>
                                )}
                                {product.moqRequired !== false && (
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        Min Order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

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
