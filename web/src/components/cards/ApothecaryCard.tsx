"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * Apothecary — old herbalist / pharmacy label aesthetic.
 *
 * Cream linen card with ornate ruled frame. EB Garamond italic for the
 * Latin-style scientific name; the colloquial product name lives below
 * in small caps. Hatched copper-engraving feel on the photo (sepia +
 * line overlay). "Dispensed in" header. Tier slabs as apothecary
 * dispensary lines.
 */

const LATIN_NAMES: Record<string, string> = {
    Tomato: "Solanum lycopersicum",
    Onion: "Allium cepa",
    Potato: "Solanum tuberosum",
    "Green Chilli": "Capsicum frutescens",
    "Brinjal": "Solanum melongena",
    Cabbage: "Brassica oleracea",
    Cauliflower: "Brassica oleracea var. botrytis",
    Carrot: "Daucus carota",
    Cucumber: "Cucumis sativus",
    Spinach: "Spinacia oleracea",
    Coriander: "Coriandrum sativum",
    Mint: "Mentha",
    Garlic: "Allium sativum",
    Ginger: "Zingiber officinale",
    Lemon: "Citrus limon",
    Beetroot: "Beta vulgaris",
};

function latinFor(name: string): string {
    for (const key in LATIN_NAMES) {
        if (name.toLowerCase().includes(key.toLowerCase())) return LATIN_NAMES[key];
    }
    // fallback — slug from name
    return `Sp. ${name.toLowerCase().replace(/[^a-z]/g, "")}`;
}

export const ApothecaryCard = memo(function ApothecaryCard({ product }: { product: Product }) {
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

    const latinName = latinFor(product.name);

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden"
                style={{
                    background: "#f5ecd6",
                    backgroundImage: `
                        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='l'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.30 0 0 0 0 0.10 0 0 0 0.07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23l)'/%3E%3C/svg%3E"),
                        linear-gradient(180deg, #f8f0dc 0%, #ede2c4 100%)
                    `,
                    color: "#3a2818",
                    fontFamily: "var(--font-eb-garamond), Georgia, serif",
                    border: "1px solid #c9a978",
                    boxShadow: "inset 0 0 0 4px #f5ecd6, inset 0 0 0 5px #8b6f3a, inset 0 0 0 9px #f5ecd6",
                }}
            >
                {/* Inner content with frame padding */}
                <div className="relative flex flex-col h-full p-3 pt-4">
                    {/* Apothecary header — flourishes flanking small-caps */}
                    <div className="flex items-center gap-2 justify-center text-[10px] tracking-[0.3em] uppercase mb-2"
                        style={{ color: "#8b6f3a", fontVariant: "small-caps" }}>
                        <span style={{ fontFamily: "var(--font-eb-garamond), serif", fontStyle: "italic", textTransform: "none", letterSpacing: 0, fontSize: 14 }}>❦</span>
                        <span>Dispensary</span>
                        <span style={{ fontFamily: "var(--font-eb-garamond), serif", fontStyle: "italic", textTransform: "none", letterSpacing: 0, fontSize: 14 }}>❦</span>
                    </div>

                    {/* Hairline rule with central diamond */}
                    <div className="relative h-[5px] mb-2 flex items-center">
                        <div className="flex-1 h-px" style={{ background: "#8b6f3a" }} />
                        <span className="mx-1 text-[10px]" style={{ color: "#8b6f3a" }}>◆</span>
                        <div className="flex-1 h-px" style={{ background: "#8b6f3a" }} />
                    </div>

                    {/* Body — image on right, name on left */}
                    <div className="flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                            {/* Latin scientific name — italic large */}
                            <div
                                className="leading-[1.05] italic line-clamp-2 break-words"
                                style={{
                                    fontSize: "21px",
                                    color: "#3a2818",
                                    fontFamily: "var(--font-eb-garamond), serif",
                                    fontStyle: "italic",
                                    fontWeight: 500,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {latinName}
                            </div>
                            {/* Common name in small caps */}
                            <div
                                className="mt-1 text-[12px] tracking-[0.2em] uppercase font-bold line-clamp-1 break-words"
                                style={{ color: "#5a3e22", fontVariant: "small-caps" }}
                            >
                                {product.name}
                            </div>
                            {(product.telugu || product.hindi) && (
                                <div className="mt-1 text-[11px] italic" style={{ color: "#7a5a30" }}>
                                    {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif", fontStyle: "normal" }}>{product.telugu}</span>}
                                    {product.telugu && product.hindi && <span className="mx-1.5">・</span>}
                                    {product.hindi && <span>{product.hindi}</span>}
                                </div>
                            )}
                        </div>

                        {/* Sepia engraving photo */}
                        <button
                            type="button"
                            onClick={() => hasImage && setLightboxOpen(true)}
                            className="relative w-[64px] h-[64px] shrink-0 overflow-hidden focus:outline-none"
                            style={{
                                background: "#e6d5b0",
                                border: "1px solid #8b6f3a",
                            }}
                        >
                            {hasImage ? (
                                <>
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="64px"
                                        className="object-cover"
                                        unoptimized={!product.image.includes("googleapis.com")}
                                        onError={() => setImgError(true)}
                                        style={{ filter: "sepia(0.85) contrast(1.15) saturate(0.6)" }}
                                    />
                                    {/* Hatching overlay */}
                                    <div
                                        className="absolute inset-0 mix-blend-multiply opacity-30 pointer-events-none"
                                        style={{
                                            backgroundImage: "repeating-linear-gradient(45deg, transparent 0 1px, rgba(58,40,24,0.4) 1px 2px)",
                                        }}
                                    />
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-2xl italic" style={{ color: "#8b6f3a", fontFamily: "var(--font-eb-garamond), serif" }}>
                                    {product.name.charAt(0)}
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Price — single line of refined italic figure */}
                    <div className="mt-3 pt-2" style={{ borderTop: "1px solid #c9a978" }}>
                        <div className="flex items-baseline justify-between">
                            <div className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "#8b6f3a", fontVariant: "small-caps" }}>
                                Apothec. price
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span
                                    className="text-[26px] leading-none italic tabular-nums"
                                    style={{ color: "#3a2818", fontFamily: "var(--font-eb-garamond), serif", fontStyle: "italic", fontWeight: 500 }}
                                >
                                    ₹{effectivePrice}
                                </span>
                                <span className="text-[11px] italic" style={{ color: "#7a5a30" }}>
                                    per {product.unit}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tier ledger — old prescription lines */}
                    {tiers.length > 0 && (
                        <div className="mt-2 space-y-[1px]">
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-baseline gap-2 text-[12px] py-0.5 italic"
                                        style={{
                                            color: isActive ? "#3a2818" : "#7a5a30",
                                            fontWeight: isActive ? 700 : 500,
                                            fontFamily: "var(--font-eb-garamond), serif",
                                        }}
                                    >
                                        <span className="w-3 text-[10px] not-italic" style={{ color: "#8b6f3a" }}>
                                            {isActive ? "℞" : "·"}
                                        </span>
                                        <span className="flex-1">
                                            <span className="tabular-nums">{t.range}</span> {product.unit}
                                        </span>
                                        <span className="tabular-nums">@ ₹{t.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Action — old-pharmacy stamped button */}
                    <div className="mt-auto pt-3">
                        {qty === 0 ? (
                            showQty ? (
                                <ApotQty
                                    defaultValue={moq}
                                    unit={product.unit}
                                    onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                    onCancel={() => setShowQty(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowQty(true)}
                                    className="w-full transition-all hover:bg-[#3a2818] hover:text-[#f5ecd6] focus:outline-none"
                                    style={{
                                        background: "transparent",
                                        color: "#3a2818",
                                        border: "1.5px solid #3a2818",
                                        padding: "8px 12px",
                                        fontFamily: "var(--font-eb-garamond), serif",
                                        fontSize: 14,
                                        fontStyle: "italic",
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    ◆ Dispense ◆
                                </button>
                            )
                        ) : (
                            <ApotCartRow
                                qty={qty}
                                unit={product.unit}
                                onPlus={() => addToCart(product, 1)}
                                onMinus={() => addToCart(product, -1)}
                                onRemove={() => removeFromCart(product.id)}
                                effectivePrice={effectivePrice}
                            />
                        )}
                    </div>
                </div>
            </article>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});

function ApotQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{
                background: "#f8f0dc", border: "1.5px solid #3a2818", height: 38,
            }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-semibold tabular-nums outline-none italic"
                    style={{ background: "transparent", color: "#3a2818", fontFamily: "var(--font-eb-garamond), serif", fontSize: 16 }}
                />
                <span className="pr-2 text-[10px] tracking-wider italic" style={{ color: "#8b6f3a" }}>per {unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-[38px] px-3 text-[12px] italic uppercase tracking-wider"
                style={{ background: "#3a2818", color: "#f5ecd6", fontFamily: "var(--font-eb-garamond), serif" }}>
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function ApotCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-[38px] w-[38px] flex items-center justify-center"
                    style={{ background: "#f8f0dc", border: "1.5px solid #8b3a3a", color: "#8b3a3a" }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: "#3a2818", color: "#f5ecd6", border: "1.5px solid #3a2818", height: 38,
                }}>
                    <button onClick={onMinus} className="w-10 h-full text-lg font-bold">−</button>
                    <div className="flex-1 text-center font-semibold tabular-nums italic" style={{ fontFamily: "var(--font-eb-garamond), serif", fontSize: 15 }}>
                        {qty} <span className="text-[10px] not-italic uppercase tracking-wider opacity-70 ml-0.5">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-10 h-full text-lg font-bold">+</button>
                </div>
            </div>
            <div className="text-[10px] mt-1 text-center italic tabular-nums" style={{ color: "#8b6f3a" }}>
                ₹{effectivePrice} × {qty} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
