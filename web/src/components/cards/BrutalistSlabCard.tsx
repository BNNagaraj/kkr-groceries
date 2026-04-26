"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * BrutalistSlab — concrete monolith. Severe, monumental, zero decoration.
 *
 * Heavy concrete-grey card, no rounding. Single Bebas Neue full-width
 * uppercase headline. One thick black rule. Massive bottom price block in
 * solid black. No shadows, no gradients beyond a faint concrete texture.
 * Aggressively functional — for the buyer who just wants the price now.
 */
export const BrutalistSlabCard = memo(function BrutalistSlabCard({ product }: { product: Product }) {
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
                className="relative flex flex-col h-full overflow-hidden"
                style={{
                    background: "#c8c2b6",
                    backgroundImage: `
                        url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E"),
                        linear-gradient(180deg, #d3cdc1 0%, #b8b1a3 100%)
                    `,
                    color: "#0a0a0a",
                    fontFamily: "var(--font-bebas), 'Bebas Neue', sans-serif",
                }}
            >
                {/* Tiny meta strip — date + sku */}
                <div className="px-3 py-1.5 flex items-baseline justify-between"
                    style={{ background: "#0a0a0a", color: "#c8c2b6" }}>
                    <span className="text-[10px] tracking-[0.3em] font-bold" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                        SKU.{String(product.id).padStart(4, "0")}
                    </span>
                    <span className="text-[10px] tracking-[0.3em]" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                        UNIT/{product.unit.toUpperCase()}
                    </span>
                </div>

                {/* Body — image left, headline right */}
                <div className="flex">
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-[35%] shrink-0 overflow-hidden focus:outline-none"
                        style={{ aspectRatio: "1 / 1", background: "#0a0a0a" }}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 35vw, 15vw"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                                style={{ filter: "grayscale(0.4) contrast(1.15)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-stone-700">
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </button>

                    <div className="flex-1 px-3 py-2 flex flex-col justify-between">
                        <h3
                            className="leading-[0.85] uppercase break-words"
                            style={{
                                fontSize: "32px",
                                color: "#0a0a0a",
                                fontFamily: "var(--font-bebas), sans-serif",
                                letterSpacing: "0.01em",
                            }}
                        >
                            {product.name}
                        </h3>
                        {(product.telugu || product.hindi) && (
                            <div className="text-[12px] mt-1 uppercase tracking-wider"
                                style={{ color: "#3a3a3a", fontFamily: "var(--font-jetbrains), monospace" }}>
                                {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif", textTransform: "none", letterSpacing: 0 }}>{product.telugu}</span>}
                                {product.telugu && product.hindi && <span className="mx-1.5">/</span>}
                                {product.hindi && <span>{product.hindi}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Thick rule */}
                <div style={{ height: 4, background: "#0a0a0a" }} />

                {/* Tier ledger — monospaced rows */}
                {tiers.length > 0 && (
                    <div className="px-3 py-2" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                        {tiers.map((t, i) => {
                            const isActive = i === activeIdx && qty > 0;
                            return (
                                <div
                                    key={i}
                                    className="flex items-baseline justify-between text-[12px] py-0.5"
                                    style={{
                                        color: isActive ? "#0a0a0a" : "#3a3a3a",
                                        fontWeight: isActive ? 700 : 400,
                                    }}
                                >
                                    <span className="uppercase tracking-wider">
                                        {isActive ? "▶ " : "  "}{t.range} {product.unit}
                                    </span>
                                    <span className="tabular-nums">₹{t.price}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MASSIVE PRICE BLOCK */}
                <div
                    className="mt-auto px-3 py-2 flex items-baseline justify-between"
                    style={{ background: "#0a0a0a", color: "#c8c2b6" }}
                >
                    <span
                        className="text-[42px] leading-none font-normal tabular-nums"
                        style={{ fontFamily: "var(--font-bebas), sans-serif", letterSpacing: "-0.02em" }}
                    >
                        ₹{effectivePrice}
                    </span>
                    <span
                        className="text-[12px] uppercase tracking-[0.25em]"
                        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
                    >
                        per {product.unit}
                    </span>
                </div>

                {/* Action — full-width slab button */}
                <div>
                    {qty === 0 ? (
                        showQty ? (
                            <BrutQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full text-[18px] uppercase tracking-[0.2em] transition-colors hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                style={{
                                    background: "#1a1a1a",
                                    color: "#c8c2b6",
                                    padding: "12px 12px",
                                    fontFamily: "var(--font-bebas), sans-serif",
                                    borderTop: "1px solid #3a3a3a",
                                }}
                            >
                                Order →
                            </button>
                        )
                    ) : (
                        <BrutCartRow
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

function BrutQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-stretch h-[44px]">
            <input autoFocus type="text" inputMode="decimal" value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => {
                    if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                    if (e.key === "Escape") onCancel();
                }}
                className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                style={{ background: "#1a1a1a", color: "#c8c2b6", fontFamily: "var(--font-bebas), sans-serif", fontSize: 22 }}
            />
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="px-5 text-[16px] font-bold uppercase tracking-wider"
                style={{ background: "#c8c2b6", color: "#0a0a0a", fontFamily: "var(--font-bebas), sans-serif" }}>
                <Check className="w-5 h-5 inline" />
            </button>
        </div>
    );
}

function BrutCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-stretch h-[44px]">
                <button onClick={onRemove} className="w-12 flex items-center justify-center"
                    style={{ background: "#7f1d1d", color: "#c8c2b6" }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={onMinus} className="w-12 text-2xl font-bold" style={{ background: "#1a1a1a", color: "#c8c2b6" }}>−</button>
                <div className="flex-1 flex items-center justify-center text-[20px] font-bold tabular-nums"
                    style={{ background: "#0a0a0a", color: "#c8c2b6", fontFamily: "var(--font-bebas), sans-serif" }}>
                    {qty}<span className="text-[12px] ml-1 tracking-wider opacity-70">{unit.toUpperCase()}</span>
                </div>
                <button onClick={onPlus} className="w-12 text-2xl font-bold" style={{ background: "#1a1a1a", color: "#c8c2b6" }}>+</button>
            </div>
            <div className="text-[10px] py-1 text-center tabular-nums uppercase tracking-[0.3em]"
                style={{ background: "#0a0a0a", color: "#a8a294", fontFamily: "var(--font-jetbrains), monospace" }}>
                ₹{effectivePrice}/{unit} · ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
