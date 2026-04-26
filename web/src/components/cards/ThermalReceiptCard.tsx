"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox, useCardOrientation } from "./shared";

/**
 * Thermal Receipt — 58mm POS roll mimicry.
 *
 * Off-white thermal paper with subtle warm-grey edge fade, monospaced
 * everything (JetBrains Mono), dashed cut lines, dot-leader rate rows
 * and a CSS-only barcode footer. A red "RETAIN FOR DISPATCH" stamp
 * angles across the photo. Brutally legible — built for buyers placing
 * 80-SKU orders at 6am who want zero decoration in the way of the
 * tier prices.
 */
export const ThermalReceiptCard = memo(function ThermalReceiptCard({ product }: { product: Product }) {
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
    const orient = useCardOrientation();

    const sku = String(product.id).slice(-6).padStart(6, "0").toUpperCase();
    const dotLeader = (left: string, right: string, width = 28) => {
        const dots = Math.max(2, width - left.length - right.length);
        return `${left}${".".repeat(dots)}${right}`;
    };

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden"
                style={{
                    background: "#fafaf6",
                    backgroundImage: `
                        linear-gradient(180deg, #f3f0e8 0%, #fafaf6 6%, #fafaf6 94%, #f3f0e8 100%),
                        repeating-linear-gradient(0deg, transparent 0 3px, rgba(60,40,20,0.012) 3px 4px)
                    `,
                    color: "#1a1a1a",
                    fontFamily: "var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(60,40,20,0.06)",
                }}
            >
                {/* Header — store + cut line */}
                <div className="px-3 pt-2.5 pb-1 text-center">
                    <div className="text-[10px] tracking-[0.4em] font-bold leading-tight" style={{ color: "#1a1a1a" }}>
                        ** KKR GROCERIES **
                    </div>
                    <div className="text-[8px] tracking-[0.3em] mt-0.5" style={{ color: "#5a554c" }}>
                        WHOLESALE · HYDERABAD
                    </div>
                </div>
                <div
                    className="mx-3"
                    style={{
                        height: 0,
                        borderTop: "1px dashed #5a554c",
                        position: "relative",
                    }}
                >
                    <span
                        className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 text-[8px]"
                        style={{ background: "#fafaf6", color: "#5a554c" }}
                    >
                        ✂ — — — —
                    </span>
                </div>

                {/* SKU + Unit meta */}
                <div className="px-3 pt-2 pb-1 flex items-baseline justify-between text-[10px]" style={{ color: "#1a1a1a" }}>
                    <span>SKU: {sku}</span>
                    <span>UNIT: {product.unit.toUpperCase()}</span>
                </div>

                {/* Body — image with diagonal stamp */}
                <div className={`flex px-3 pt-1 pb-2 ${orient.isHorizontal ? (orient.isReversed ? "flex-row-reverse" : "flex-row") : "flex-col"} gap-2`}>
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative shrink-0 overflow-hidden focus:outline-none"
                        style={{
                            width: orient.isHorizontal ? `${orient.imageWidth}%` : "100%",
                            aspectRatio: orient.isHorizontal ? "1 / 1" : "16 / 10",
                            background: "#e8e4dc",
                            border: "1px solid #1a1a1a",
                        }}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                                style={{ filter: "grayscale(0.85) contrast(1.2)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold" style={{ color: "#5a554c" }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                        {/* RETAIN FOR DISPATCH stamp */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <span
                                className="px-2 py-1 text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap"
                                style={{
                                    color: "#b91c1c",
                                    border: "2px solid #b91c1c",
                                    transform: "rotate(-14deg)",
                                    background: "rgba(250,250,246,0.55)",
                                    fontFamily: "var(--font-jetbrains), monospace",
                                    opacity: 0.88,
                                }}
                            >
                                RETAIN · DISPATCH
                            </span>
                        </div>
                    </button>

                    {/* Item description block */}
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[14px] font-bold uppercase leading-tight break-words line-clamp-2 tracking-wide"
                            style={{ color: "#1a1a1a", fontFamily: "var(--font-jetbrains), monospace" }}
                        >
                            {product.name}
                        </div>
                        {(product.telugu || product.hindi) && (
                            <div className="text-[10px] mt-1" style={{ color: "#5a554c" }}>
                                {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                                {product.telugu && product.hindi && <span className="mx-1">/</span>}
                                {product.hindi && <span>{product.hindi}</span>}
                            </div>
                        )}
                        <div className="mt-2 text-[10px]" style={{ color: "#1a1a1a" }}>
                            {dotLeader("BASE", `Rs.${product.price}/${product.unit}`, 24)}
                        </div>
                    </div>
                </div>

                {/* Tier rate table */}
                {tiers.length > 0 && (
                    <div className="px-3 pb-2">
                        <div
                            className="text-[9px] tracking-[0.3em] font-bold uppercase pb-1"
                            style={{ color: "#1a1a1a", borderBottom: "1px solid #1a1a1a" }}
                        >
                            ── BULK RATE TABLE ──
                        </div>
                        <div className="pt-1 space-y-0">
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="text-[11px] flex items-baseline justify-between leading-tight tabular-nums"
                                        style={{
                                            color: isActive ? "#000000" : "#3a3a3a",
                                            fontWeight: isActive ? 700 : 400,
                                            background: isActive ? "#1a1a1a" : "transparent",
                                            ...(isActive ? { color: "#fafaf6", padding: "1px 4px", margin: "1px -4px" } : {}),
                                        }}
                                    >
                                        <span>
                                            {isActive ? ">" : " "} {t.range.padEnd(10, " ")} {product.unit}
                                        </span>
                                        <span>Rs.{t.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Subtotal block */}
                <div className="px-3 pb-1.5">
                    <div className="border-t-2 border-double pt-1" style={{ borderColor: "#1a1a1a" }}>
                        <div className="flex items-baseline justify-between text-[12px] font-bold tabular-nums" style={{ color: "#1a1a1a" }}>
                            <span className="uppercase tracking-wider">RATE NOW</span>
                            <span>Rs.{effectivePrice}/{product.unit}</span>
                        </div>
                        {qty > 0 && (
                            <div className="flex items-baseline justify-between text-[11px] tabular-nums mt-0.5" style={{ color: "#1a1a1a" }}>
                                <span className="uppercase tracking-wider">QTY x {qty}</span>
                                <span className="font-bold">Rs.{(effectivePrice * qty).toLocaleString("en-IN")}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Barcode strip */}
                <div className="px-3 pb-1 flex items-end gap-px h-5 mt-auto">
                    {Array.from({ length: 60 }).map((_, j) => {
                        const seed = (Number(product.id) || 1) * 13 + j * 7;
                        const w = (seed % 4) === 0 ? 2 : 1;
                        const black = (seed % 5) !== 0;
                        return (
                            <span
                                key={j}
                                style={{
                                    width: w,
                                    height: "100%",
                                    background: black ? "#1a1a1a" : "transparent",
                                    flexShrink: 0,
                                }}
                            />
                        );
                    })}
                </div>
                <div className="text-center text-[8px] tracking-[0.3em] pb-1" style={{ color: "#5a554c" }}>
                    {sku} · KKR · {product.unit.toUpperCase()}
                </div>

                {/* Perforated bottom + action */}
                <div
                    className="mx-3"
                    style={{ borderTop: "1px dashed #5a554c", height: 0, position: "relative" }}
                >
                    <span
                        className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 text-[8px]"
                        style={{ background: "#fafaf6", color: "#5a554c" }}
                    >
                        — — TEAR — —
                    </span>
                </div>

                <div className="px-3 pt-2 pb-3">
                    {qty === 0 ? (
                        showQty ? (
                            <TRQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full text-[12px] uppercase tracking-[0.25em] font-bold transition-colors hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                style={{
                                    background: "#1a1a1a",
                                    color: "#fafaf6",
                                    padding: "10px 12px",
                                    fontFamily: "var(--font-jetbrains), monospace",
                                    border: "1px solid #1a1a1a",
                                }}
                            >
                                [ ENTER QTY ]
                            </button>
                        )
                    ) : (
                        <TRCartRow
                            qty={qty}
                            unit={product.unit}
                            onPlus={() => addToCart(product, 1)}
                            onMinus={() => addToCart(product, -1)}
                            onRemove={() => removeFromCart(product.id)}
                        />
                    )}
                </div>
            </article>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});

function TRQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-stretch h-[40px]" style={{ border: "1px solid #1a1a1a" }}>
            <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => {
                    if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                    if (e.key === "Escape") onCancel();
                }}
                className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                style={{
                    background: "#fafaf6",
                    color: "#1a1a1a",
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 16,
                    borderRight: "1px solid #1a1a1a",
                }}
            />
            <span className="px-2 flex items-center text-[10px] uppercase" style={{ background: "#fafaf6", color: "#5a554c" }}>
                {unit}
            </span>
            <button
                onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="px-4 text-[12px] font-bold uppercase tracking-wider"
                style={{ background: "#1a1a1a", color: "#fafaf6", fontFamily: "var(--font-jetbrains), monospace" }}
            >
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function TRCartRow({ qty, unit, onPlus, onMinus, onRemove }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void;
}) {
    return (
        <div className="flex items-stretch h-[40px]" style={{ border: "1px solid #1a1a1a" }}>
            <button
                onClick={onRemove}
                className="w-10 flex items-center justify-center"
                style={{ background: "#fafaf6", color: "#b91c1c", borderRight: "1px solid #1a1a1a" }}
                aria-label="Remove"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={onMinus}
                className="w-10 text-lg font-bold"
                style={{ background: "#fafaf6", color: "#1a1a1a", borderRight: "1px solid #1a1a1a", fontFamily: "var(--font-jetbrains), monospace" }}
            >
                −
            </button>
            <div
                className="flex-1 flex items-center justify-center text-[14px] font-bold tabular-nums"
                style={{ background: "#1a1a1a", color: "#fafaf6", fontFamily: "var(--font-jetbrains), monospace" }}
            >
                {qty} <span className="text-[10px] ml-1 opacity-70 uppercase">{unit}</span>
            </div>
            <button
                onClick={onPlus}
                className="w-10 text-lg font-bold"
                style={{ background: "#fafaf6", color: "#1a1a1a", borderLeft: "1px solid #1a1a1a", fontFamily: "var(--font-jetbrains), monospace" }}
            >
                +
            </button>
        </div>
    );
}
