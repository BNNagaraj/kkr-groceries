"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * MemoSticky — yellow sticky note pinned to the wall.
 *
 * Saturated post-it yellow with a faint paper grain. The card sits with
 * a subtle -1 to +1deg tilt (deterministic per product id), curl shadow
 * in the bottom-right corner, blue-pen Kalam handwriting for everything,
 * and a yellow-highlighter stripe drawn through the price. A fast,
 * personal, kanban-feel card.
 */

const STICKY_YELLOW = "#fff48d";
const STICKY_DEEP = "#ffe356";
const PEN_BLUE = "#0b3a7a";
const HIGHLIGHT_YELLOW = "#ffe356";

export const MemoStickyCard = memo(function MemoStickyCard({ product }: { product: Product }) {
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

    // Deterministic small rotation per product (so the wall of cards has variety but stays stable)
    const tilt = ((product.id % 5) - 2) * 0.6; // -1.2 .. 1.2 deg

    return (
        <>
            <article
                className="relative flex flex-col h-full transition-transform duration-150 hover:-translate-y-1"
                style={{
                    background: STICKY_YELLOW,
                    backgroundImage: `
                        linear-gradient(180deg, ${STICKY_DEEP}00 0%, ${STICKY_DEEP}40 100%),
                        url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='m'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)'/%3E%3C/svg%3E")
                    `,
                    color: PEN_BLUE,
                    fontFamily: "var(--font-kalam), 'Kalam', cursive",
                    transform: `rotate(${tilt}deg)`,
                    boxShadow: "2px 4px 8px -2px rgba(60,40,0,0.25), -1px 0 2px rgba(60,40,0,0.08)",
                    // Curl shadow in the bottom-right corner via a clip-path lift
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%)",
                }}
            >
                {/* Curl shadow accent */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        bottom: 0,
                        right: 0,
                        width: 24,
                        height: 24,
                        background: `linear-gradient(135deg, transparent 50%, rgba(60,40,0,0.18) 50%)`,
                    }}
                />

                {/* Tape strip — top-center */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: -6,
                        left: "50%",
                        transform: `translateX(-50%) rotate(${-tilt * 1.5}deg)`,
                        width: 60,
                        height: 16,
                        background: "rgba(255,255,255,0.55)",
                        boxShadow: "0 1px 2px rgba(60,40,0,0.15)",
                    }}
                />

                <div className="px-3.5 pt-4 pb-3 flex flex-col h-full">
                    {/* Header line — small underlined date-ish thing */}
                    <div
                        className="text-[12px] mb-1 self-start"
                        style={{
                            color: PEN_BLUE,
                            fontFamily: "var(--font-kalam), cursive",
                            opacity: 0.7,
                            borderBottom: `1px solid ${PEN_BLUE}55`,
                        }}
                    >
                        for cart →
                    </div>

                    {/* Body */}
                    <div className="flex gap-3 mt-1">
                        <button
                            type="button"
                            onClick={() => hasImage && setLightboxOpen(true)}
                            className="relative w-[64px] h-[64px] shrink-0 overflow-hidden focus:outline-none rounded-sm"
                            style={{
                                background: "rgba(11,58,122,0.08)",
                                border: `2px solid ${PEN_BLUE}`,
                                transform: `rotate(${-tilt * 0.5}deg)`,
                            }}
                        >
                            {hasImage ? (
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="64px"
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                    style={{ filter: "saturate(1.05)" }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold" style={{ color: PEN_BLUE, fontFamily: "var(--font-kalam), cursive" }}>
                                    {product.name.charAt(0)}
                                </div>
                            )}
                        </button>

                        <div className="flex-1 min-w-0">
                            <h3
                                className="leading-[1] truncate"
                                style={{
                                    fontSize: "22px",
                                    color: PEN_BLUE,
                                    fontFamily: "var(--font-kalam), cursive",
                                    fontWeight: 700,
                                }}
                            >
                                {product.name}
                            </h3>
                            {(product.telugu || product.hindi) && (
                                <div className="mt-0.5 text-[12px]" style={{ color: PEN_BLUE, opacity: 0.75 }}>
                                    {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                                    {product.telugu && product.hindi && <span className="mx-1">·</span>}
                                    {product.hindi && <span>{product.hindi}</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Price with highlighter stripe behind it */}
                    <div className="mt-3 self-start relative inline-flex items-baseline">
                        <span
                            className="absolute inset-0 -inset-x-1.5 -inset-y-1"
                            style={{
                                background: HIGHLIGHT_YELLOW,
                                transform: "skewX(-6deg)",
                                filter: "blur(1px) brightness(0.92)",
                                opacity: 0.85,
                                zIndex: 0,
                            }}
                            aria-hidden="true"
                        />
                        <span
                            className="relative text-[26px] leading-none font-bold tabular-nums"
                            style={{ color: PEN_BLUE, fontFamily: "var(--font-kalam), cursive", zIndex: 1 }}
                        >
                            ₹{effectivePrice}
                        </span>
                        <span className="relative ml-1 text-[13px]" style={{ color: PEN_BLUE, zIndex: 1 }}>
                            /{product.unit}
                        </span>
                    </div>

                    {/* Tier checklist — pen-checked */}
                    {tiers.length > 0 && (
                        <div className="mt-3 space-y-0.5">
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-baseline gap-2 text-[13px]"
                                        style={{
                                            color: PEN_BLUE,
                                            opacity: isActive ? 1 : 0.7,
                                            fontWeight: isActive ? 700 : 400,
                                        }}
                                    >
                                        <span className="w-3 inline-block">
                                            {isActive ? "✓" : "□"}
                                        </span>
                                        <span className="flex-1">{t.range} {product.unit}</span>
                                        <span className="tabular-nums">₹{t.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Action — pen-drawn box CTA */}
                    <div className="mt-auto pt-3">
                        {qty === 0 ? (
                            showQty ? (
                                <StickyQty
                                    defaultValue={moq}
                                    unit={product.unit}
                                    onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                    onCancel={() => setShowQty(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowQty(true)}
                                    className="relative w-full transition-transform active:translate-y-px focus:outline-none"
                                    style={{
                                        background: "transparent",
                                        color: PEN_BLUE,
                                        border: `2.5px solid ${PEN_BLUE}`,
                                        padding: "8px 12px",
                                        fontFamily: "var(--font-kalam), cursive",
                                        fontSize: 17,
                                        fontWeight: 700,
                                        borderRadius: "10px 4px 14px 6px",
                                    }}
                                >
                                    add this →
                                </button>
                            )
                        ) : (
                            <StickyCartRow
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

function StickyQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{
                background: "rgba(255,255,255,0.55)", border: `2.5px solid ${PEN_BLUE}`, height: 38, borderRadius: "10px 4px 14px 6px",
            }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: PEN_BLUE, fontFamily: "var(--font-kalam), cursive", fontSize: 18 }}
                />
                <span className="pr-2 text-[13px]" style={{ color: PEN_BLUE, opacity: 0.7 }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-[38px] px-3 font-bold text-[14px]"
                style={{ background: PEN_BLUE, color: STICKY_YELLOW, borderRadius: "10px 4px 14px 6px", fontFamily: "var(--font-kalam), cursive" }}>
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function StickyCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-[38px] w-[38px] flex items-center justify-center"
                    style={{ background: "rgba(176,49,49,0.15)", border: `2.5px solid #b03131`, color: "#b03131", borderRadius: "10px 4px 14px 6px" }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: PEN_BLUE, color: STICKY_YELLOW, height: 38, borderRadius: "10px 4px 14px 6px",
                    fontFamily: "var(--font-kalam), cursive",
                }}>
                    <button onClick={onMinus} className="w-9 h-full text-2xl font-bold">−</button>
                    <div className="flex-1 text-center font-bold tabular-nums text-[18px]">
                        {qty}<span className="text-[12px] ml-1 opacity-80">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-9 h-full text-2xl font-bold">+</button>
                </div>
            </div>
            <div className="text-[13px] mt-1 text-center tabular-nums" style={{ color: PEN_BLUE, opacity: 0.8, fontFamily: "var(--font-kalam), cursive" }}>
                ₹{effectivePrice}/{unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
