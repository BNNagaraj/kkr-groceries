"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen, CheckCircle2, Truck, ZoomIn, ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { formatTiersForDisplay } from "@/lib/pricing";
import { resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox, InlineQtyInput } from "./shared";
import { useTheme } from "@/contexts/ThemeContext";

/* ─── Tier labels & progressive backgrounds matching the mockup ─── */
const TIER_LABELS = ["Retail", "Wholesale", "Bulk", "Super Bulk", "Mega"];

/* ─── Premium Cart Controls (matches the mockup layout) ─── */
const PremiumCartControls = memo(function PremiumCartControls({ product }: { product: Product }) {
    const { cart, addToCart, removeFromCart } = useAppStore();
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const [showInput, setShowInput] = useState(false);
    const [editingQty, setEditingQty] = useState(false);

    const moq = (product.moqRequired !== false && product.moq > 0) ? product.moq : 1;

    // If user tapped "Add to Cart" and needs to enter qty via inline input
    if (qty === 0 && showInput) {
        return (
            <InlineQtyInput
                defaultValue={moq}
                unit={product.unit}
                onConfirm={(val) => { addToCart(product, val); setShowInput(false); }}
                onCancel={() => setShowInput(false)}
                variant="add"
                minQty={moq}
            />
        );
    }

    // Not yet in cart — show the Current Qty display + Add to Cart button
    if (qty === 0) {
        return (
            <div className="flex items-center gap-2">
                {/* Current Qty indicator */}
                <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Current Qty</span>
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <button className="w-7 h-8 flex items-center justify-center text-slate-300 cursor-default">
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 h-8 flex items-center justify-center text-sm font-bold text-slate-800 border-x border-slate-200">0</span>
                        <button className="w-7 h-8 flex items-center justify-center text-slate-300 cursor-default">
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                </div>
                {/* Add to Cart button */}
                <button
                    onClick={() => setShowInput(true)}
                    className="flex-1 h-9 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm shadow-sm shadow-emerald-600/20"
                >
                    <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                </button>
            </div>
        );
    }

    // Already in cart — show stepper + rate
    const effectivePrice = product.priceTiers?.length ? resolveSlabPrice(qty, product.price, product.priceTiers) : null;

    return (
        <div>
            <div className="flex items-center gap-2">
                {/* Current Qty with stepper */}
                <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">Current Qty</span>
                    <div className="flex items-center border-2 border-emerald-600 rounded-lg overflow-hidden bg-white">
                        <button
                            onClick={() => addToCart(product, -1)}
                            className="w-7 h-8 flex items-center justify-center text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <div
                            onClick={() => setEditingQty(true)}
                            className="w-10 h-8 flex items-center justify-center text-sm font-bold text-emerald-700 bg-emerald-50 border-x-2 border-emerald-600 cursor-pointer"
                            title="Click to edit quantity"
                        >
                            {editingQty ? (
                                <InlineQtyInput
                                    defaultValue={qty}
                                    unit={product.unit}
                                    onConfirm={(val) => {
                                        const delta = val - qty;
                                        if (delta !== 0) addToCart(product, delta);
                                        setEditingQty(false);
                                    }}
                                    onCancel={() => setEditingQty(false)}
                                    variant="edit"
                                    minQty={moq}
                                />
                            ) : qty}
                        </div>
                        <button
                            onClick={() => addToCart(product, 1)}
                            className="w-7 h-8 flex items-center justify-center text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                </div>
                {/* Remove + In Cart indicator */}
                <div className="flex-1 flex items-center gap-1.5">
                    <button
                        onClick={() => removeFromCart(product.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0"
                        aria-label="Remove from cart"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 h-9 bg-emerald-600 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-sm shadow-emerald-600/20">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {qty} {product.unit} in Cart
                    </div>
                </div>
            </div>
            {effectivePrice !== null && (
                <div className="text-[10px] text-emerald-600 font-medium text-right mt-1">
                    Rate: ₹{effectivePrice}/{product.unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
                </div>
            )}
        </div>
    );
});

/* ─── Premium Card ─── */

export const PremiumCard = memo(function PremiumCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const hasImage = !!product.image && !imgError;
    const { theme } = useTheme();

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const basePrice = product.price;
    const lowestTierPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : basePrice;
    const maxSavingsPercent = basePrice > 0 ? Math.round(((basePrice - lowestTierPrice) / basePrice) * 100) : 0;

    const imgPos = theme.cardLayout?.imagePosition || "left";
    const imgW = theme.cardLayout?.imageWidth || 35;
    const isHorizontal = imgPos === "left" || imgPos === "right";

    return (
        <>
            <div
                className="bg-white shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow relative"
                style={{ borderRadius: "var(--theme-card-radius, 0.75rem)" }}
            >
                {/* ── Dynamic layout: horizontal (left/right) or vertical (top) ── */}
                <div className={`flex ${isHorizontal ? "flex-row" : "flex-col"} min-h-[240px]`}
                     style={isHorizontal ? { flexDirection: imgPos === "right" ? "row-reverse" : "row" } : undefined}>

                    {/* ── Image Section ── */}
                    <div
                        className={`relative shrink-0 bg-slate-50 overflow-hidden group/img ${hasImage ? "cursor-pointer" : ""}`}
                        style={isHorizontal
                            ? { width: `${imgW}%` }
                            : { width: "100%", height: "200px" }
                        }
                        onClick={() => hasImage && setLightboxOpen(true)}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes={isHorizontal ? `${imgW}vw` : "100vw"}
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-70 transition-opacity drop-shadow-lg" />
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                                <span className="text-5xl font-bold text-slate-200">
                                    {product.name.charAt(0)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── Details Section (right ~58%) ── */}
                    <div className="flex-1 p-3 sm:p-4 flex flex-col min-w-0">

                        {/* Product Name + HOT/FRESH badge row */}
                        <div className="flex items-start justify-between gap-1">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight line-clamp-1">
                                {product.name}
                            </h3>
                            {(product.hot || product.fresh) && (
                                <div className="flex gap-1 shrink-0">
                                    {product.hot && (
                                        <span className="inline-flex items-center text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">
                                            <Flame className="w-3 h-3 mr-0.5" /> HOT
                                        </span>
                                    )}
                                    {product.fresh && (
                                        <span className="inline-flex items-center text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-100">
                                            <LeafyGreen className="w-3 h-3 mr-0.5" /> FRESH
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Telugu + Hindi names */}
                        <div className="flex gap-1 text-xs text-slate-500 mt-0.5 line-clamp-1">
                            <span className="font-telugu">{product.telugu}</span>
                            <span className="text-slate-300">·</span>
                            <span>{product.hindi}</span>
                        </div>

                        {/* Product ID line */}
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            Product ID · {product.id}
                        </div>

                        {/* Quality Checked badge */}
                        <div className="flex items-center gap-1 mt-1">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Quality Checked
                            </span>
                        </div>

                        {/* Base Price */}
                        <div className="mt-1 flex items-baseline gap-0.5">
                            <span className="text-xl sm:text-2xl font-extrabold text-slate-800">₹{basePrice}</span>
                            <span className="text-sm text-slate-500 font-medium">/{product.unit}</span>
                        </div>

                        {/* Volume Pricing Slab */}
                        {tiers.length > 0 && (
                            <div className="mt-2 border border-slate-300 rounded-lg overflow-hidden">
                                {/* Header */}
                                <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
                                    <h4 className="text-[11px] font-bold text-slate-700">Volume Pricing Slab</h4>
                                </div>
                                {/* Tier rows */}
                                <div>
                                    {tiers.map((tier, i) => {
                                        const label = TIER_LABELS[Math.min(i, TIER_LABELS.length - 1)];
                                        const saving = basePrice - tier.price;
                                        const isLast = i === tiers.length - 1 && tiers.length > 1;

                                        // Progressive green backgrounds matching the mockup
                                        const bgClasses = [
                                            "bg-emerald-50/70",      // Tier 1 - lightest
                                            "bg-emerald-100/80",     // Tier 2 - medium
                                            "bg-emerald-700 text-white", // Tier 3 - darkest
                                            "bg-emerald-800 text-white", // Tier 4
                                            "bg-emerald-900 text-white", // Tier 5
                                        ];
                                        const bgClass = bgClasses[Math.min(i, bgClasses.length - 1)];
                                        const isDark = i >= 2;
                                        const borderClass = i > 0 ? (isDark ? "border-t border-emerald-600/30" : "border-t border-slate-200") : "";

                                        return (
                                            <div
                                                key={i}
                                                className={`px-2.5 py-2 flex items-start justify-between gap-1 ${bgClass} ${borderClass}`}
                                            >
                                                <div className="flex items-start gap-1.5 min-w-0">
                                                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? "text-emerald-200" : "text-emerald-500"}`} />
                                                    <div className="min-w-0">
                                                        <div className={`text-xs font-bold leading-tight ${isDark ? "text-white" : "text-slate-800"}`}>
                                                            Tier {i + 1} ({label})
                                                        </div>
                                                        <div className={`text-[10px] leading-tight ${isDark ? "text-emerald-200" : "text-slate-500"}`}>
                                                            Qty {tier.range} {product.unit}s
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
                                                        ₹{tier.price}
                                                    </span>
                                                    <span className={`text-[10px] ${isDark ? "text-emerald-200" : "text-slate-500"}`}>
                                                        /{product.unit}
                                                    </span>
                                                    {saving > 0 && (
                                                        <div className={`text-[9px] font-medium leading-tight mt-0.5 ${isDark ? "text-emerald-200 italic" : "text-emerald-600 italic"}`}>
                                                            Save ₹{saving}/{product.unit}
                                                            {isLast && (
                                                                <span className="font-bold not-italic"> · Best Value</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Cart Controls */}
                        <div className="mt-auto pt-2">
                            <PremiumCartControls product={product} />
                        </div>

                        {/* Bottom info badges */}
                        <div className="flex flex-wrap items-center justify-between gap-1 mt-2">
                            {maxSavingsPercent > 0 && tiers.length > 1 && (
                                <span className="text-[9px] sm:text-[10px] font-medium text-emerald-600">
                                    Save up to {maxSavingsPercent}% on Bulk Orders
                                </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium text-slate-500 ml-auto">
                                <Truck className="w-3 h-3" /> Next Day Delivery
                            </span>
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
