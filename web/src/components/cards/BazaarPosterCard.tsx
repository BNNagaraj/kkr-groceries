"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * BazaarPoster — hand-painted Indian shopfront sign aesthetic.
 *
 * Saturated marigold yellow + tomato red + leaf green palette. Scalloped
 * banner header with decorative star ornaments. DM Serif Display name in
 * bold italic, painted-sign price tag. Multi-script crowded gloriously.
 * Inspired by old cinema posters and street vendor boards across South
 * India.
 */

// Per-category color signal (echoes regional sign-painter palettes)
const ACCENT_BY_CATEGORY: Record<string, { primary: string; deep: string }> = {
    leafy:        { primary: "#16a34a", deep: "#14532d" },
    roots:        { primary: "#a16207", deep: "#451a03" },
    fruit_veg:    { primary: "#dc2626", deep: "#7f1d1d" },
    gourds:       { primary: "#15803d", deep: "#14532d" },
    cruciferous:  { primary: "#65a30d", deep: "#1a2e05" },
    sweet:        { primary: "#ea580c", deep: "#7c2d12" },
    rice:         { primary: "#a16207", deep: "#451a03" },
    flour:        { primary: "#92400e", deep: "#451a03" },
    pulses:       { primary: "#854d0e", deep: "#451a03" },
    oil:          { primary: "#ca8a04", deep: "#713f12" },
    spices:       { primary: "#dc2626", deep: "#7f1d1d" },
    sugar_salt:   { primary: "#475569", deep: "#1e293b" },
    milk:         { primary: "#0284c7", deep: "#0c4a6e" },
    curd:         { primary: "#0891b2", deep: "#164e63" },
    butter_cream: { primary: "#ca8a04", deep: "#713f12" },
    paneer_cheese:{ primary: "#a16207", deep: "#451a03" },
    buttermilk:   { primary: "#0e7490", deep: "#164e63" },
};

const DEFAULT_ACCENT = { primary: "#dc2626", deep: "#7f1d1d" };

export const BazaarPosterCard = memo(function BazaarPosterCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [showQty, setShowQty] = useState(false);
    const { cart, addToCart, removeFromCart } = useAppStore();
    const hasImage = !!product.image && !imgError;

    const tiers = product.priceTiers?.length ? formatTiersForDisplay(product.priceTiers) : [];
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const activeIdx = getActiveTierIndex(qty, product.priceTiers || []);
    const effectivePrice = qty > 0 && product.priceTiers?.length
        ? resolveSlabPrice(qty, product.price, product.priceTiers)
        : product.price;
    const moq = (product.moqRequired !== false && product.moq > 0) ? product.moq : 1;

    const accent = ACCENT_BY_CATEGORY[product.category] || DEFAULT_ACCENT;
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map((t) => t.price)) : product.price;
    const maxSavings = product.price > 0 ? Math.round(((product.price - lowestPrice) / product.price) * 100) : 0;

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden"
                style={{
                    background: "#fef3c7",
                    backgroundImage: `repeating-linear-gradient(45deg, transparent 0 12px, rgba(220,38,38,0.04) 12px 14px)`,
                    border: `3px solid ${accent.deep}`,
                    boxShadow: `4px 4px 0 ${accent.primary}, 4px 4px 0 4px ${accent.deep}`,
                    fontFamily: "var(--font-dm-serif), serif",
                }}
            >
                {/* Scalloped top banner */}
                <div
                    className="relative px-3 pt-2 pb-3"
                    style={{
                        background: accent.primary,
                        color: "#fef3c7",
                        clipPath: "polygon(0 0, 100% 0, 100% 100%, 95% 90%, 90% 100%, 85% 90%, 80% 100%, 75% 90%, 70% 100%, 65% 90%, 60% 100%, 55% 90%, 50% 100%, 45% 90%, 40% 100%, 35% 90%, 30% 100%, 25% 90%, 20% 100%, 15% 90%, 10% 100%, 5% 90%, 0 100%)",
                    }}
                >
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px]" style={{ opacity: 0.9 }}>★</span>
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                            Fresh Today
                        </span>
                        <span className="text-[10px]" style={{ opacity: 0.9 }}>★</span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex gap-3 px-3 pt-1">
                    {/* Image with rounded-painted-frame */}
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-[80px] h-[80px] shrink-0 overflow-hidden focus:outline-none rounded-full"
                        style={{
                            background: accent.deep,
                            border: `3px solid ${accent.deep}`,
                            boxShadow: `inset 0 0 0 2px #fef3c7`,
                        }}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="80px"
                                className="object-cover rounded-full"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                                style={{ filter: "saturate(1.3) contrast(1.1)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold" style={{ color: "#fef3c7" }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </button>

                    {/* Name, hugely centered, italic display */}
                    <div className="flex-1 min-w-0 self-center text-center pr-2">
                        <h3
                            className="leading-[0.95] italic uppercase tracking-tight"
                            style={{
                                fontSize: "24px",
                                color: accent.deep,
                                fontFamily: "var(--font-dm-serif), serif",
                                fontStyle: "italic",
                                textShadow: `2px 2px 0 ${accent.primary}33`,
                            }}
                        >
                            {product.name}
                        </h3>
                    </div>
                </div>

                {/* Multilingual block — crowded together with separators */}
                {(product.telugu || product.hindi) && (
                    <div className="px-3 pt-1 pb-1 text-center text-[13px]"
                        style={{ color: accent.deep, fontFamily: "var(--font-outfit), sans-serif" }}>
                        {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                        {product.telugu && product.hindi && <span className="mx-2 opacity-60">●</span>}
                        {product.hindi && <span style={{ fontFamily: "var(--font-kalam), cursive" }}>{product.hindi}</span>}
                    </div>
                )}

                {/* Painted-sign price tag */}
                <div className="px-3 py-2 flex items-center justify-center">
                    <div
                        className="relative px-4 py-2 inline-flex items-baseline gap-1"
                        style={{
                            background: "#fef3c7",
                            border: `3px dashed ${accent.deep}`,
                            transform: "rotate(-2deg)",
                        }}
                    >
                        <span
                            className="text-[36px] leading-none italic tabular-nums"
                            style={{
                                color: accent.deep,
                                fontFamily: "var(--font-dm-serif), serif",
                                fontStyle: "italic",
                                fontWeight: 400,
                            }}
                        >
                            ₹{effectivePrice}
                        </span>
                        <span className="text-[12px] uppercase tracking-wider font-bold"
                            style={{ color: accent.primary, fontFamily: "var(--font-outfit), sans-serif" }}>
                            /{product.unit}
                        </span>
                        {maxSavings > 0 && (
                            <span
                                className="absolute -top-2 -right-3 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                style={{
                                    background: accent.primary,
                                    color: "#fef3c7",
                                    transform: "rotate(8deg)",
                                    fontFamily: "var(--font-outfit), sans-serif",
                                    boxShadow: `1px 1px 0 ${accent.deep}`,
                                }}
                            >
                                {maxSavings}% OFF!
                            </span>
                        )}
                    </div>
                </div>

                {/* Tier strip */}
                {tiers.length > 0 && (
                    <div className="px-3 pb-2 flex flex-wrap justify-center gap-1.5">
                        {tiers.map((t, i) => {
                            const isActive = i === activeIdx && qty > 0;
                            return (
                                <div
                                    key={i}
                                    className="px-2 py-0.5 text-[11px] font-bold rounded-full"
                                    style={{
                                        background: isActive ? accent.primary : "transparent",
                                        color: isActive ? "#fef3c7" : accent.deep,
                                        border: `2px solid ${accent.deep}`,
                                        fontFamily: "var(--font-outfit), sans-serif",
                                    }}
                                >
                                    {t.range} {product.unit} = ₹{t.price}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Action */}
                <div className="mt-auto p-3 pt-1">
                    {qty === 0 ? (
                        showQty ? (
                            <BazaarQty
                                defaultValue={moq}
                                unit={product.unit}
                                accent={accent}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full text-[16px] uppercase tracking-[0.18em] font-bold transition-transform active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                style={{
                                    background: accent.deep,
                                    color: "#fef3c7",
                                    border: `2px solid ${accent.primary}`,
                                    padding: "10px 12px",
                                    fontFamily: "var(--font-outfit), sans-serif",
                                    boxShadow: `3px 3px 0 ${accent.primary}`,
                                }}
                            >
                                ★ Order Now ★
                            </button>
                        )
                    ) : (
                        <BazaarCartRow
                            qty={qty}
                            unit={product.unit}
                            accent={accent}
                            onPlus={() => addToCart(product, 1)}
                            onMinus={() => addToCart(product, -1)}
                            onRemove={() => removeFromCart(product.id)}
                            effectivePrice={effectivePrice}
                        />
                    )}
                </div>
            </article>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});

function BazaarQty({ defaultValue, unit, accent, onConfirm, onCancel }: {
    defaultValue: number; unit: string; accent: { primary: string; deep: string };
    onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{
                background: "#fef3c7", border: `2px solid ${accent.deep}`, height: 40,
            }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none italic"
                    style={{ background: "transparent", color: accent.deep, fontFamily: "var(--font-dm-serif), serif", fontSize: 18 }}
                />
                <span className="pr-2 text-[10px] uppercase tracking-wider font-bold" style={{ color: accent.primary, fontFamily: "var(--font-outfit), sans-serif" }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-10 px-3 text-[12px] font-bold uppercase tracking-wider"
                style={{ background: accent.primary, color: "#fef3c7", border: `2px solid ${accent.deep}`, fontFamily: "var(--font-outfit), sans-serif" }}>
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function BazaarCartRow({ qty, unit, accent, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; accent: { primary: string; deep: string };
    onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-10 w-10 flex items-center justify-center"
                    style={{ background: "#fef3c7", border: `2px solid ${accent.primary}`, color: accent.primary }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: accent.deep, color: "#fef3c7", border: `2px solid ${accent.primary}`, height: 40,
                }}>
                    <button onClick={onMinus} className="w-10 h-full text-xl font-bold">−</button>
                    <div className="flex-1 text-center font-bold tabular-nums" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                        {qty} <span className="text-[10px] opacity-80 uppercase tracking-wider ml-0.5">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-10 h-full text-xl font-bold">+</button>
                </div>
            </div>
            <div className="text-[10px] mt-1 text-center tabular-nums font-bold uppercase tracking-wider"
                style={{ color: accent.deep, fontFamily: "var(--font-outfit), sans-serif" }}>
                ₹{effectivePrice}/{unit} · TOTAL ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
