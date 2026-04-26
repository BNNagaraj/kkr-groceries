"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * Risograph — limited-palette overprint zine aesthetic.
 *
 * Two-ink risograph print look: Federal Blue (#1d4e89) and Fluorescent
 * Pink (#ff48b0) on cream paper. Halftone dot patterns fill solid areas.
 * Each colour layer is offset by 1-2px from the other to fake the
 * misregistration of a real two-pass print. The product photo gets a
 * heavy duotone treatment in the same two inks. Heavy Space Grotesk
 * headlines.
 */

const RISO_BLUE = "#1d4e89";
const RISO_PINK = "#ff48b0";
const RISO_PAPER = "#f5efe0";

const halftoneSvg = (color: string, opacity: number) =>
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Ccircle cx='3' cy='3' r='1' fill='${encodeURIComponent(color)}' fill-opacity='${opacity}'/%3E%3C/svg%3E`;

export const RisographCard = memo(function RisographCard({ product }: { product: Product }) {
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

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 group/card"
                style={{
                    background: RISO_PAPER,
                    backgroundImage: `
                        url("${halftoneSvg("#3a2d1c", 0.18)}"),
                        radial-gradient(ellipse at 30% 0%, #f8f3e6 0%, ${RISO_PAPER} 60%)
                    `,
                    border: `2px solid ${RISO_BLUE}`,
                    boxShadow: `4px 4px 0 ${RISO_PINK}`,
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    color: RISO_BLUE,
                }}
            >
                {/* Header — split-color label */}
                <div className="flex items-stretch border-b-2" style={{ borderColor: RISO_BLUE }}>
                    <div
                        className="px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
                        style={{
                            background: RISO_BLUE,
                            color: RISO_PAPER,
                            fontFamily: "var(--font-space-grotesk), sans-serif",
                        }}
                    >
                        Issue {String(product.id).padStart(3, "0")}
                    </div>
                    <div
                        className="flex-1 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-right"
                        style={{
                            color: RISO_PINK,
                            fontFamily: "var(--font-space-grotesk), sans-serif",
                            textShadow: `1px 0 0 ${RISO_BLUE}33`,
                        }}
                    >
                        Riso · 2-COLOUR
                    </div>
                </div>

                {/* Body */}
                <div className="flex gap-3 px-3 pt-3">
                    {/* Duotone photo with halftone overlay */}
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-[80px] h-[80px] shrink-0 overflow-hidden focus:outline-none"
                        style={{
                            background: RISO_PINK,
                            border: `2px solid ${RISO_BLUE}`,
                        }}
                    >
                        {hasImage ? (
                            <>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="80px"
                                    className="object-cover mix-blend-multiply"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                    style={{ filter: "grayscale(1) contrast(1.4)" }}
                                />
                                {/* Halftone overlay */}
                                <div
                                    className="absolute inset-0 mix-blend-overlay"
                                    style={{
                                        backgroundImage: `url("${halftoneSvg(RISO_BLUE, 0.65)}")`,
                                        backgroundSize: "4px 4px",
                                    }}
                                />
                                {/* Pink misregistration shift */}
                                <div
                                    className="absolute inset-0 transition-transform duration-300 group-hover/card:translate-x-[2px]"
                                    style={{
                                        background: RISO_PINK,
                                        mixBlendMode: "screen",
                                        opacity: 0.15,
                                    }}
                                />
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold" style={{ color: RISO_BLUE, fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </button>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                        <h3
                            className="leading-[0.95] uppercase tracking-tight"
                            style={{
                                fontSize: "20px",
                                fontWeight: 700,
                                color: RISO_BLUE,
                                fontFamily: "var(--font-space-grotesk), sans-serif",
                            }}
                        >
                            {product.name}
                        </h3>
                        {(product.telugu || product.hindi) && (
                            <div className="mt-1 text-[12px] font-medium" style={{ color: RISO_PINK }}>
                                {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                                {product.telugu && product.hindi && <span className="mx-1.5" style={{ color: RISO_BLUE }}>///</span>}
                                {product.hindi && <span>{product.hindi}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Price block — pink-fill with offset blue ghost */}
                <div className="px-3 pt-3 pb-2">
                    <div className="relative inline-block">
                        <span
                            className="absolute -top-[2px] -left-[2px] text-[40px] leading-none font-bold tabular-nums select-none"
                            style={{
                                color: RISO_PINK,
                                fontFamily: "var(--font-space-grotesk), sans-serif",
                                opacity: 0.95,
                            }}
                            aria-hidden="true"
                        >
                            ₹{effectivePrice}
                        </span>
                        <span
                            className="relative text-[40px] leading-none font-bold tabular-nums"
                            style={{
                                color: RISO_BLUE,
                                fontFamily: "var(--font-space-grotesk), sans-serif",
                            }}
                        >
                            ₹{effectivePrice}
                        </span>
                        <span
                            className="ml-2 text-[11px] uppercase tracking-[0.2em] font-bold"
                            style={{ color: RISO_BLUE }}
                        >
                            /{product.unit}
                        </span>
                    </div>
                </div>

                {/* Tier strip — boxed cells */}
                {tiers.length > 0 && (
                    <div className="px-3 pb-3">
                        <div
                            className="grid gap-0"
                            style={{
                                gridTemplateColumns: `repeat(${tiers.length}, 1fr)`,
                                border: `2px solid ${RISO_BLUE}`,
                            }}
                        >
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="px-1.5 py-1.5 text-center"
                                        style={{
                                            background: isActive ? RISO_PINK : "transparent",
                                            color: isActive ? RISO_PAPER : RISO_BLUE,
                                            borderRight: i < tiers.length - 1 ? `2px solid ${RISO_BLUE}` : "none",
                                            backgroundImage: isActive ? `url("${halftoneSvg(RISO_PAPER, 0.15)}")` : "none",
                                        }}
                                    >
                                        <div
                                            className="text-[9px] font-bold uppercase tracking-wider opacity-70"
                                            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                                        >
                                            {t.range}
                                        </div>
                                        <div className="text-[14px] font-bold tabular-nums">
                                            ₹{t.price}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Action */}
                <div className="mt-auto p-3 pt-0">
                    {qty === 0 ? (
                        showQty ? (
                            <RisoQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full transition-transform active:translate-y-px focus:outline-none"
                                style={{
                                    background: RISO_BLUE,
                                    color: RISO_PAPER,
                                    border: `2px solid ${RISO_BLUE}`,
                                    fontFamily: "var(--font-space-grotesk), sans-serif",
                                    fontWeight: 700,
                                    fontSize: 13,
                                    letterSpacing: "0.18em",
                                    padding: "10px 8px",
                                    textTransform: "uppercase",
                                    boxShadow: `3px 3px 0 ${RISO_PINK}`,
                                }}
                            >
                                Add → Issue
                            </button>
                        )
                    ) : (
                        <RisoCartRow
                            qty={qty}
                            unit={product.unit}
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

function RisoQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{ background: RISO_PAPER, border: `2px solid ${RISO_BLUE}`, height: 40 }}>
                <input
                    autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: RISO_BLUE, fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: 16 }}
                />
                <span className="pr-2 text-[10px] uppercase tracking-wider" style={{ color: RISO_BLUE }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-10 px-3 text-[12px] font-bold uppercase tracking-wider"
                style={{ background: RISO_BLUE, color: RISO_PAPER, fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function RisoCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-10 w-10 flex items-center justify-center"
                    style={{ background: RISO_PAPER, border: `2px solid ${RISO_PINK}`, color: RISO_PINK }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: RISO_BLUE, color: RISO_PAPER, border: `2px solid ${RISO_BLUE}`, height: 40,
                }}>
                    <button onClick={onMinus} className="w-10 h-full text-xl font-bold">−</button>
                    <div className="flex-1 text-center font-bold tabular-nums" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                        {qty}<span className="text-[10px] opacity-70 uppercase tracking-wider ml-1">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-10 h-full text-xl font-bold">+</button>
                </div>
            </div>
            <div className="text-[10px] mt-1 text-center tabular-nums uppercase tracking-wider"
                style={{ color: RISO_BLUE, fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                ₹{effectivePrice}/{unit} · ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
