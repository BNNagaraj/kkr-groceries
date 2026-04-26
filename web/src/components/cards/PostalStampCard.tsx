"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * PostalStamp — vintage postage stamp aesthetic.
 *
 * Full-perimeter perforated edge (CSS radial-gradient mask), denomination
 * block in the upper-right corner showing the unit-price, "INDIA POST"
 * country marking along the left edge, faux postmark cancellation circles
 * angled diagonally across the photograph. Sienna/sage paper palette.
 */

const STAMP_PAPER = "#f3ead4";
const STAMP_INK = "#3d2817";
const STAMP_ACCENT = "#7a3015";

export const PostalStampCard = memo(function PostalStampCard({ product }: { product: Product }) {
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

    const today = new Date();
    const postmarkDate = today.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();

    return (
        <>
            <article
                className="relative flex flex-col h-full"
                style={{
                    background: STAMP_PAPER,
                    backgroundImage: `
                        radial-gradient(circle at 0 0, transparent 4px, ${STAMP_PAPER} 4px),
                        url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence baseFrequency='0.7' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.3 0 0 0 0 0.15 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E")
                    `,
                    boxShadow: "0 2px 8px -2px rgba(60,40,20,0.18)",
                    fontFamily: "var(--font-jetbrains), monospace",
                    color: STAMP_INK,
                    // Perforated edge — radial-gradient mask producing 6px-spaced "teeth"
                    WebkitMask: `radial-gradient(circle 4px at 0% 50%, transparent 4px, #000 4px) 0 0 / 12px 12px,
                                 radial-gradient(circle 4px at 100% 50%, transparent 4px, #000 4px) 0 0 / 12px 12px,
                                 radial-gradient(circle 4px at 50% 0%, transparent 4px, #000 4px) 0 0 / 12px 12px,
                                 radial-gradient(circle 4px at 50% 100%, transparent 4px, #000 4px) 0 0 / 12px 12px`,
                    WebkitMaskComposite: "source-over",
                    padding: "12px 14px 8px",
                    border: `2px dashed ${STAMP_INK}33`,
                }}
            >
                {/* Inner stamp frame */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        inset: 8,
                        border: `1px solid ${STAMP_INK}80`,
                    }}
                />

                {/* Denomination block — top-right */}
                <div
                    className="absolute top-3 right-3 px-2 py-0.5 rounded-sm flex items-baseline gap-1"
                    style={{ background: STAMP_INK, color: STAMP_PAPER, zIndex: 2 }}
                >
                    <span className="text-[16px] font-bold tabular-nums leading-none">₹{effectivePrice}</span>
                    <span className="text-[8px] uppercase tracking-wider opacity-80">/{product.unit}</span>
                </div>

                {/* Country marking — top-left small caps */}
                <div className="text-[9px] uppercase tracking-[0.3em] font-bold mb-1.5" style={{ color: STAMP_INK }}>
                    Bharat · India · Post
                </div>

                {/* Centered photo with postmark */}
                <button
                    type="button"
                    onClick={() => hasImage && setLightboxOpen(true)}
                    className="relative w-full focus:outline-none mb-2"
                    style={{ aspectRatio: "16 / 10", background: "#ddd0aa", border: `1.5px solid ${STAMP_INK}` }}
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
                            style={{ filter: "sepia(0.45) saturate(0.85) contrast(1.1)" }}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold" style={{ color: STAMP_INK }}>
                            {product.name.charAt(0)}
                        </div>
                    )}

                    {/* Postmark — diagonal double circles + date */}
                    <div
                        className="absolute pointer-events-none flex items-center justify-center"
                        style={{
                            top: "50%",
                            left: "20%",
                            width: 70,
                            height: 70,
                            transform: "translate(-50%, -50%) rotate(-22deg)",
                        }}
                    >
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{ border: `2px solid ${STAMP_ACCENT}`, opacity: 0.55 }}
                        />
                        <div
                            className="absolute rounded-full"
                            style={{ inset: 7, border: `1px solid ${STAMP_ACCENT}`, opacity: 0.55 }}
                        />
                        <div className="text-center" style={{ color: STAMP_ACCENT, opacity: 0.7 }}>
                            <div className="text-[8px] uppercase tracking-wider font-bold leading-none">HYD GPO</div>
                            <div className="text-[10px] font-bold tabular-nums leading-tight mt-0.5">{postmarkDate}</div>
                        </div>
                    </div>
                </button>

                {/* Name + multilingual */}
                <div className="text-center mb-1.5">
                    <h3
                        className="text-[15px] font-bold uppercase tracking-[0.06em] leading-tight"
                        style={{ color: STAMP_INK, fontFamily: "var(--font-jetbrains), monospace" }}
                    >
                        {product.name}
                    </h3>
                    {(product.telugu || product.hindi) && (
                        <div className="text-[10px] mt-0.5" style={{ color: STAMP_ACCENT }}>
                            {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                            {product.telugu && product.hindi && <span className="mx-1">·</span>}
                            {product.hindi && <span style={{ fontFamily: "var(--font-kalam), cursive" }}>{product.hindi}</span>}
                        </div>
                    )}
                </div>

                {/* Tier strip — postal-rate table */}
                {tiers.length > 0 && (
                    <div className="text-[10px] mb-1.5" style={{ borderTop: `1px dashed ${STAMP_INK}66`, borderBottom: `1px dashed ${STAMP_INK}66`, paddingTop: 3, paddingBottom: 3 }}>
                        {tiers.map((t, i) => {
                            const isActive = i === activeIdx && qty > 0;
                            return (
                                <div
                                    key={i}
                                    className="flex items-baseline justify-between"
                                    style={{
                                        color: isActive ? STAMP_ACCENT : STAMP_INK,
                                        fontWeight: isActive ? 700 : 400,
                                    }}
                                >
                                    <span>{isActive ? "▸ " : "  "}{t.range} {product.unit}</span>
                                    <span className="tabular-nums">₹{t.price}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Action */}
                <div className="mt-auto">
                    {qty === 0 ? (
                        showQty ? (
                            <PostQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full text-[11px] font-bold uppercase tracking-[0.22em] transition-colors hover:bg-[#3d2817] hover:text-[#f3ead4]"
                                style={{
                                    background: "transparent",
                                    color: STAMP_INK,
                                    border: `1.5px solid ${STAMP_INK}`,
                                    padding: "7px 8px",
                                    fontFamily: "var(--font-jetbrains), monospace",
                                }}
                            >
                                ✉ Post Order
                            </button>
                        )
                    ) : (
                        <PostCartRow
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

function PostQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{ background: STAMP_PAPER, border: `1.5px solid ${STAMP_INK}`, height: 34 }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: STAMP_INK, fontFamily: "var(--font-jetbrains), monospace", fontSize: 14 }}
                />
                <span className="pr-2 text-[9px] uppercase tracking-wider" style={{ color: STAMP_ACCENT }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-[34px] px-3 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: STAMP_INK, color: STAMP_PAPER, fontFamily: "var(--font-jetbrains), monospace" }}>
                <Check className="w-3.5 h-3.5 inline" />
            </button>
        </div>
    );
}

function PostCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-[34px] w-[34px] flex items-center justify-center"
                    style={{ background: STAMP_PAPER, border: `1.5px solid ${STAMP_ACCENT}`, color: STAMP_ACCENT }} aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: STAMP_INK, color: STAMP_PAPER, height: 34,
                }}>
                    <button onClick={onMinus} className="w-9 h-full text-lg font-bold">−</button>
                    <div className="flex-1 text-center font-bold tabular-nums" style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 13 }}>
                        {qty}<span className="text-[9px] opacity-70 ml-0.5 uppercase">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-9 h-full text-lg font-bold">+</button>
                </div>
            </div>
            <div className="text-[9px] mt-1 text-center tabular-nums uppercase tracking-wider" style={{ color: STAMP_ACCENT, fontFamily: "var(--font-jetbrains), monospace" }}>
                ₹{effectivePrice}/{unit} · ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
