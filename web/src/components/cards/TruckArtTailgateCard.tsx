"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox, useCardOrientation } from "./shared";

/**
 * TruckArt Tailgate — Indian lorry-back panel.
 *
 * Saturated marigold + tomato-red + cobalt-blue. Hand-painted scalloped
 * frame with chevron "Horn OK Please" header. Circular mirror-medallion
 * holds the price like a hub-cap. Tri-script everywhere. Tier rates sit
 * inside a dashed yellow ledger panel. Tailgate-style striped CTA.
 *
 * Locally rooted, unmistakably Indian, deliberately maximalist — the
 * cultural counterpart to the otherwise Western print-history themes.
 */
export const TruckArtTailgateCard = memo(function TruckArtTailgateCard({ product }: { product: Product }) {
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

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden"
                style={{
                    background: "#fbbf24",
                    backgroundImage: `
                        radial-gradient(circle at 12% 88%, rgba(220,38,38,0.18) 0%, transparent 35%),
                        radial-gradient(circle at 88% 18%, rgba(30,64,175,0.18) 0%, transparent 35%),
                        repeating-linear-gradient(45deg, transparent 0 14px, rgba(124,45,18,0.06) 14px 15px)
                    `,
                    border: "3px solid #7f1d1d",
                    boxShadow: "inset 0 0 0 2px #fbbf24, inset 0 0 0 5px #1e40af, 4px 4px 0 #7f1d1d",
                    color: "#1c0a06",
                    fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                }}
            >
                {/* HORN OK PLEASE chevron header */}
                <div
                    className="relative h-7 flex items-center justify-center overflow-hidden"
                    style={{
                        background: "#dc2626",
                        backgroundImage: `repeating-linear-gradient(90deg, #dc2626 0 14px, #fbbf24 14px 28px, #1e40af 28px 42px, #fbbf24 42px 56px)`,
                        borderBottom: "2px solid #7f1d1d",
                    }}
                >
                    <span
                        className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.3em]"
                        style={{
                            background: "#fef3c7",
                            color: "#7f1d1d",
                            border: "1.5px solid #7f1d1d",
                            fontFamily: "var(--font-dm-serif), serif",
                            letterSpacing: "0.18em",
                        }}
                    >
                        ★ HORN · OK · PLEASE ★
                    </span>
                </div>

                {/* Body — image with mirror medallion price overlay */}
                <div className={`flex flex-1 ${orient.isHorizontal ? (orient.isReversed ? "flex-row-reverse" : "flex-row") : "flex-col"}`}>
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative shrink-0 overflow-hidden focus:outline-none"
                        style={{
                            width: orient.isHorizontal ? `${orient.imageWidth}%` : "100%",
                            aspectRatio: orient.isHorizontal ? "1 / 1" : "16 / 10",
                            background: "#1e40af",
                            border: "2px solid #7f1d1d",
                            margin: 8,
                            borderRadius: 4,
                        }}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 60vw, 30vw"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                                style={{ filter: "saturate(1.2) contrast(1.05)" }}
                            />
                        ) : (
                            <div
                                className="absolute inset-0 flex items-center justify-center text-6xl"
                                style={{ color: "#fbbf24", fontFamily: "var(--font-dm-serif), serif" }}
                            >
                                {product.name.charAt(0)}
                            </div>
                        )}
                        {/* Mirror medallion — circular price hub */}
                        <div
                            className="absolute -top-1 -right-1 flex flex-col items-center justify-center"
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "radial-gradient(circle at 30% 30%, #fef3c7, #fbbf24 60%, #b45309)",
                                border: "2.5px solid #7f1d1d",
                                boxShadow: "0 0 0 2px #fbbf24, 0 0 0 4px #1e40af, 1px 2px 4px rgba(0,0,0,0.3)",
                                transform: "rotate(-6deg)",
                            }}
                        >
                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#7f1d1d", fontFamily: "var(--font-dm-serif), serif" }}>
                                Rate
                            </span>
                            <span
                                className="text-[20px] leading-none tabular-nums"
                                style={{ color: "#7f1d1d", fontFamily: "var(--font-dm-serif), serif", fontWeight: 700 }}
                            >
                                ₹{effectivePrice}
                            </span>
                            <span className="text-[8px] font-bold uppercase" style={{ color: "#7f1d1d" }}>
                                /{product.unit}
                            </span>
                        </div>
                    </button>

                    {/* Name + multi-script panel */}
                    <div className="flex-1 px-3 pt-2 pb-1 flex flex-col">
                        <h3
                            className="text-[20px] leading-[1.05] italic line-clamp-2 break-words"
                            style={{
                                color: "#7f1d1d",
                                fontFamily: "var(--font-dm-serif), serif",
                                textShadow: "1px 1px 0 #fbbf24",
                            }}
                        >
                            {product.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-baseline gap-1">
                            {product.telugu && (
                                <span
                                    className="text-[13px]"
                                    style={{
                                        color: "#1e40af",
                                        fontFamily: "var(--font-noto-telugu), sans-serif",
                                    }}
                                >
                                    {product.telugu}
                                </span>
                            )}
                            {product.hindi && (
                                <>
                                    {product.telugu && <span style={{ color: "#7f1d1d" }}>·</span>}
                                    <span
                                        className="text-[13px]"
                                        style={{
                                            color: "#15803d",
                                            fontFamily: "var(--font-kalam), 'Kalam', cursive",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {product.hindi}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tier ledger — dashed yellow panel */}
                {tiers.length > 0 && (
                    <div
                        className="mx-2 mb-2 px-2 py-1.5"
                        style={{
                            background: "#fef3c7",
                            border: "1.5px dashed #7f1d1d",
                            color: "#1c0a06",
                        }}
                    >
                        <div
                            className="text-[9px] uppercase tracking-[0.25em] font-bold mb-1 text-center"
                            style={{ color: "#7f1d1d", fontFamily: "var(--font-dm-serif), serif" }}
                        >
                            ── Bulk Rates ──
                        </div>
                        <div className="space-y-0.5">
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-baseline justify-between text-[12px]"
                                        style={{
                                            color: isActive ? "#dc2626" : "#7f1d1d",
                                            fontWeight: isActive ? 700 : 500,
                                            fontFamily: "var(--font-dm-serif), serif",
                                        }}
                                    >
                                        <span className="italic">
                                            {isActive ? "▸ " : "  "}{t.range} {product.unit}
                                        </span>
                                        <span className="tabular-nums">₹{t.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tailgate-striped CTA */}
                <div style={{ borderTop: "2px solid #7f1d1d" }}>
                    {qty === 0 ? (
                        showQty ? (
                            <TAQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full text-[16px] uppercase tracking-[0.18em] font-bold transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                                style={{
                                    background: "#1e40af",
                                    backgroundImage: `repeating-linear-gradient(90deg, #1e40af 0 18px, #15803d 18px 36px)`,
                                    color: "#fef3c7",
                                    padding: "10px 12px",
                                    fontFamily: "var(--font-dm-serif), serif",
                                    textShadow: "1px 1px 0 #1c0a06",
                                    letterSpacing: "0.16em",
                                }}
                            >
                                ★ Add to Cart ★
                            </button>
                        )
                    ) : (
                        <TACartRow
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

function TAQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-stretch h-[44px]">
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
                    background: "#fef3c7",
                    color: "#7f1d1d",
                    fontFamily: "var(--font-dm-serif), serif",
                    fontSize: 22,
                    borderRight: "2px solid #7f1d1d",
                }}
            />
            <button
                onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="px-5 text-[16px] font-bold uppercase"
                style={{ background: "#15803d", color: "#fef3c7", fontFamily: "var(--font-dm-serif), serif" }}
            >
                <Check className="w-5 h-5 inline" />
            </button>
        </div>
    );
}

function TACartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-stretch h-[44px]">
                <button
                    onClick={onRemove}
                    className="w-12 flex items-center justify-center"
                    style={{ background: "#7f1d1d", color: "#fef3c7" }}
                    aria-label="Remove"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <button
                    onClick={onMinus}
                    className="w-12 text-2xl font-bold"
                    style={{ background: "#1e40af", color: "#fef3c7", fontFamily: "var(--font-dm-serif), serif" }}
                >
                    −
                </button>
                <div
                    className="flex-1 flex items-center justify-center text-[20px] font-bold tabular-nums"
                    style={{ background: "#fef3c7", color: "#7f1d1d", fontFamily: "var(--font-dm-serif), serif" }}
                >
                    {qty}<span className="text-[12px] ml-1 italic">{unit}</span>
                </div>
                <button
                    onClick={onPlus}
                    className="w-12 text-2xl font-bold"
                    style={{ background: "#15803d", color: "#fef3c7", fontFamily: "var(--font-dm-serif), serif" }}
                >
                    +
                </button>
            </div>
            <div
                className="text-[10px] py-1 text-center tabular-nums uppercase tracking-[0.25em] font-bold"
                style={{ background: "#7f1d1d", color: "#fef3c7", fontFamily: "var(--font-dm-serif), serif" }}
            >
                ★ ₹{effectivePrice}/{unit} · ₹{(effectivePrice * qty).toLocaleString("en-IN")} ★
            </div>
        </div>
    );
}
