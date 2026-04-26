"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * Freight Manifest — industrial shipping-label aesthetic.
 *
 * Designed in collaboration with Gemini (nano-banana). Off-white paperboard
 * with ink-charcoal type, burnt-orange safety accents, and an industrial
 * label vocabulary: a numeric MANIFEST # bar at the top, corner brackets
 * around the photo, weight-band tier slabs labeled like a freight rate
 * chart, and a barcode strip that doubles as a subtle texture cue at the
 * card's base. Built for buyers who value transparency and dispatch
 * reliability over decorative flourish.
 *
 * Typography: Oswald condensed for stamped industrial display, IBM Plex
 * Sans for body, JetBrains Mono for serial numbers.
 */

const PAPER = "#f8f6f1";
const INK = "#2a2f36";
const ACCENT = "#c84c00";
const MUTED = "#7a828c";
const SUCCESS = "#3f924d";

export const FreightManifestCard = memo(function FreightManifestCard({ product }: { product: Product }) {
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

    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map((t) => t.price)) : product.price;
    const maxSavingsPct = product.price > 0 ? Math.round(((product.price - lowestPrice) / product.price) * 100) : 0;

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden transition-shadow duration-150 hover:shadow-md"
                style={{
                    background: PAPER,
                    color: INK,
                    border: `1px solid ${INK}`,
                    borderRadius: 8,
                    fontFamily: "var(--font-ibm-plex), system-ui, sans-serif",
                }}
            >
                {/* MANIFEST # bar — black ink stripe at top */}
                <div
                    className="flex items-center justify-between px-3 py-1"
                    style={{ background: INK, color: PAPER }}
                >
                    <span
                        className="text-[10px] tracking-[0.25em] font-bold uppercase"
                        style={{ fontFamily: "var(--font-oswald), sans-serif" }}
                    >
                        Manifest
                    </span>
                    <span
                        className="text-[10px] tabular-nums tracking-wider"
                        style={{ fontFamily: "var(--font-jetbrains), monospace", opacity: 0.85 }}
                    >
                        #{String(product.id).padStart(5, "0")} · LOT-{String((product.id * 7) % 100).padStart(2, "0")}
                    </span>
                </div>

                {/* PHOTO with industrial corner brackets */}
                <div className="relative px-3 pt-3">
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                        style={{
                            aspectRatio: "16 / 10",
                            background: "#e8e4dd",
                            border: `1px solid ${MUTED}`,
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
                                style={{ filter: "saturate(0.97)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold" style={{ color: MUTED, fontFamily: "var(--font-oswald), sans-serif" }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                        {/* Corner brackets */}
                        {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                            const sty: React.CSSProperties = { position: "absolute", width: 12, height: 12, borderColor: INK };
                            if (corner === "tl") { sty.top = 4; sty.left = 4; sty.borderTop = `2px solid ${INK}`; sty.borderLeft = `2px solid ${INK}`; }
                            if (corner === "tr") { sty.top = 4; sty.right = 4; sty.borderTop = `2px solid ${INK}`; sty.borderRight = `2px solid ${INK}`; }
                            if (corner === "bl") { sty.bottom = 4; sty.left = 4; sty.borderBottom = `2px solid ${INK}`; sty.borderLeft = `2px solid ${INK}`; }
                            if (corner === "br") { sty.bottom = 4; sty.right = 4; sty.borderBottom = `2px solid ${INK}`; sty.borderRight = `2px solid ${INK}`; }
                            return <span key={corner} style={sty} aria-hidden />;
                        })}
                        {/* Diagonal "QC PASSED" stamp top-left of image when there's a savings */}
                        {maxSavingsPct > 0 && (
                            <div
                                className="absolute pointer-events-none select-none"
                                style={{
                                    top: 14,
                                    left: -18,
                                    transform: "rotate(-18deg)",
                                    border: `1.5px solid ${ACCENT}`,
                                    color: ACCENT,
                                    background: `${PAPER}cc`,
                                    padding: "2px 22px",
                                    fontFamily: "var(--font-oswald), sans-serif",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    boxShadow: `inset 0 0 0 1px ${ACCENT}33`,
                                }}
                            >
                                Save {maxSavingsPct}%
                            </div>
                        )}
                    </button>
                </div>

                {/* PRODUCT NAME */}
                <div className="px-3 pt-3">
                    <h3
                        className="leading-[1.0] line-clamp-2 break-words"
                        style={{
                            fontFamily: "var(--font-oswald), sans-serif",
                            fontSize: 24,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: INK,
                        }}
                    >
                        {product.name}
                    </h3>
                    {(product.telugu || product.hindi) && (
                        <div className="mt-1 text-[12px]" style={{ color: MUTED }}>
                            {product.telugu && (
                                <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>
                            )}
                            {product.telugu && product.hindi && (
                                <span className="mx-1.5" style={{ color: `${MUTED}99` }}>·</span>
                            )}
                            {product.hindi && <span>{product.hindi}</span>}
                        </div>
                    )}
                </div>

                {/* PRICE STRIP — ink black band with burnt-orange separator */}
                <div className="mx-3 mt-3 grid grid-cols-[auto_1fr]" style={{ border: `1px solid ${INK}` }}>
                    <div
                        className="flex items-center justify-center px-3 py-2"
                        style={{ background: INK, color: PAPER }}
                    >
                        <span
                            className="text-[9px] tracking-[0.25em] uppercase font-bold"
                            style={{ fontFamily: "var(--font-oswald), sans-serif" }}
                        >
                            Rate
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between px-3 py-1.5" style={{ background: PAPER }}>
                        <span
                            className="leading-none tabular-nums"
                            style={{
                                fontFamily: "var(--font-oswald), sans-serif",
                                fontSize: 30,
                                fontWeight: 700,
                                color: INK,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            ₹{effectivePrice}
                        </span>
                        <span
                            className="text-[10px] tracking-[0.18em] uppercase font-medium"
                            style={{ color: MUTED, fontFamily: "var(--font-oswald), sans-serif" }}
                        >
                            per {product.unit}
                        </span>
                    </div>
                </div>

                {/* WEIGHT BAND TIERS — looks like a freight rate chart */}
                {tiers.length > 0 && (
                    <div className="mx-3 mt-2">
                        <div
                            className="text-[9px] tracking-[0.25em] uppercase font-bold mb-1"
                            style={{ color: MUTED, fontFamily: "var(--font-oswald), sans-serif" }}
                        >
                            Weight Bands
                        </div>
                        <div style={{ border: `1px solid ${MUTED}66` }}>
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between px-2 py-1 text-[12px] tabular-nums"
                                        style={{
                                            background: isActive ? `${ACCENT}14` : "transparent",
                                            color: isActive ? INK : MUTED,
                                            fontWeight: isActive ? 700 : 500,
                                            borderBottom: i < tiers.length - 1 ? `1px solid ${MUTED}33` : "none",
                                            borderLeft: isActive ? `3px solid ${ACCENT}` : "3px solid transparent",
                                        }}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            {isActive ? (
                                                <Check className="w-3 h-3" style={{ color: ACCENT }} />
                                            ) : (
                                                <span className="w-3 inline-block" />
                                            )}
                                            <span style={{ fontFamily: "var(--font-jetbrains), monospace" }}>{t.range} {product.unit}</span>
                                        </span>
                                        <span style={{ fontFamily: "var(--font-jetbrains), monospace", color: isActive ? INK : MUTED }}>
                                            ₹{t.price}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* BARCODE strip — purely decorative, suggests dispatch readiness */}
                <div className="mx-3 mt-3 flex items-center gap-px" aria-hidden style={{ height: 16 }}>
                    {Array.from({ length: 38 }).map((_, i) => {
                        // deterministic pseudo-random pattern based on product.id
                        const seed = (product.id * 31 + i * 7) % 5;
                        const w = seed === 0 ? 1 : seed === 1 ? 1 : seed === 2 ? 2 : seed === 3 ? 3 : 1;
                        const black = ((product.id + i) % 3) !== 0;
                        return (
                            <span
                                key={i}
                                style={{
                                    width: w,
                                    height: "100%",
                                    background: black ? INK : "transparent",
                                    flexShrink: 0,
                                }}
                            />
                        );
                    })}
                </div>
                <div
                    className="mx-3 mt-1 mb-3 text-[9px] tracking-[0.4em] uppercase font-medium"
                    style={{ color: MUTED, fontFamily: "var(--font-jetbrains), monospace" }}
                >
                    KKR · HYD · {String(product.id).padStart(5, "0")}
                </div>

                {/* ACTION */}
                <div className="px-3 pb-3 mt-auto">
                    {qty === 0 ? (
                        showQty ? (
                            <FMQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full transition-colors hover:bg-[#a83e00] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                                style={{
                                    background: ACCENT,
                                    color: PAPER,
                                    padding: "10px 12px",
                                    fontFamily: "var(--font-oswald), sans-serif",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    border: `1px solid ${INK}`,
                                }}
                            >
                                Dispatch &rarr;
                            </button>
                        )
                    ) : (
                        <FMCartRow
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

function FMQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{ background: PAPER, border: `1px solid ${INK}`, height: 38 }}>
                <input
                    autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: INK, fontFamily: "var(--font-oswald), sans-serif", fontSize: 18 }}
                />
                <span className="pr-2 text-[10px] uppercase tracking-wider" style={{ color: MUTED, fontFamily: "var(--font-oswald), sans-serif" }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-[38px] px-3 text-[12px] font-bold uppercase tracking-wider"
                style={{ background: ACCENT, color: PAPER, border: `1px solid ${INK}`, fontFamily: "var(--font-oswald), sans-serif" }}>
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function FMCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-[38px] w-[38px] flex items-center justify-center"
                    style={{ background: PAPER, border: `1px solid ${ACCENT}`, color: ACCENT }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: SUCCESS, color: PAPER, border: `1px solid ${INK}`, height: 38,
                }}>
                    <button onClick={onMinus} className="w-10 h-full text-xl font-bold hover:bg-emerald-700">−</button>
                    <div className="flex-1 text-center font-bold tabular-nums" style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 16 }}>
                        {qty}<span className="text-[10px] opacity-80 ml-1 uppercase tracking-wider">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-10 h-full text-xl font-bold hover:bg-emerald-700">+</button>
                </div>
            </div>
            <div className="text-[10px] mt-1 text-center tabular-nums uppercase tracking-wider"
                style={{ color: MUTED, fontFamily: "var(--font-jetbrains), monospace" }}>
                ₹{effectivePrice}/{unit} · subtotal ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
