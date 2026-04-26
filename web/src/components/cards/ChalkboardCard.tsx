"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * Chalkboard — restaurant slate menu aesthetic.
 *
 * Black slate background with subtle texture. Caveat handwritten name in
 * white chalk; pricing as a chalked circle with a hand-drawn arrow nudge;
 * tier rows separated by hash-mark divider strokes. Eraser smudges in two
 * corners. Total commitment to the bistro-chalkboard motif.
 */
export const ChalkboardCard = memo(function ChalkboardCard({ product }: { product: Product }) {
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
    const maxSavings = product.price > 0 ? Math.round(((product.price - lowestPrice) / product.price) * 100) : 0;

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 rounded-md"
                style={{
                    background: "#1c1f1c",
                    backgroundImage: `
                        url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.85 0 0 0 0 0.88 0 0 0 0 0.85 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E"),
                        radial-gradient(ellipse at top left, #232723 0%, #161916 100%)
                    `,
                    border: "8px solid #5e3a1f",
                    borderImage: "linear-gradient(135deg, #6b4422 0%, #4a2d18 50%, #6b4422 100%) 1",
                    boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)",
                    color: "#f5f1e8",
                    fontFamily: "var(--font-caveat), cursive",
                }}
            >
                {/* Eraser smudges (top-right + bottom-left) */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: 8, right: 12, width: 60, height: 28,
                        background: "radial-gradient(ellipse, rgba(245,241,232,0.07) 0%, transparent 70%)",
                        transform: "rotate(15deg)",
                        filter: "blur(2px)",
                    }}
                />
                <div
                    className="absolute pointer-events-none"
                    style={{
                        bottom: 60, left: 8, width: 70, height: 22,
                        background: "radial-gradient(ellipse, rgba(245,241,232,0.06) 0%, transparent 70%)",
                        transform: "rotate(-8deg)",
                        filter: "blur(2px)",
                    }}
                />

                {/* "TODAY'S SPECIAL" hand-chalked banner */}
                <div className="px-4 pt-3 flex items-center justify-between">
                    <span
                        className="text-[12px] uppercase tracking-[0.3em] opacity-70"
                        style={{ color: "#ffd166", fontFamily: "var(--font-caveat), cursive" }}
                    >
                        Today&apos;s Rate
                    </span>
                    {maxSavings > 0 && (
                        <span
                            className="text-[14px]"
                            style={{
                                color: "#ff6b6b",
                                transform: "rotate(-4deg)",
                                fontFamily: "var(--font-caveat), cursive",
                                textShadow: "0 0 1px rgba(255,107,107,0.4)",
                            }}
                        >
                            save {maxSavings}%!
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="flex gap-3 px-4 pt-2">
                    {/* Image — small framed photo */}
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-[72px] h-[72px] shrink-0 rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]"
                        style={{
                            background: "#2a2d2a",
                            border: "2px solid #f5f1e8",
                            boxShadow: "0 2px 0 rgba(0,0,0,0.3)",
                        }}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="72px"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                                style={{ filter: "brightness(0.95) saturate(1.1)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ color: "#f5f1e8", fontFamily: "var(--font-caveat), cursive" }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </button>

                    {/* Name + multilingual */}
                    <div className="flex-1 min-w-0">
                        <h3
                            className="leading-[1] line-clamp-2 break-words"
                            style={{
                                fontSize: "26px",
                                color: "#f5f1e8",
                                fontFamily: "var(--font-caveat), cursive",
                                fontWeight: 700,
                                letterSpacing: "0.01em",
                                textShadow: "0 1px 0 rgba(0,0,0,0.3)",
                            }}
                        >
                            {product.name}
                        </h3>
                        {(product.telugu || product.hindi) && (
                            <div
                                className="mt-0.5 text-[14px] opacity-70"
                                style={{ color: "#ffd166" }}
                            >
                                {product.telugu && (
                                    <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>
                                )}
                                {product.telugu && product.hindi && <span className="mx-1.5 opacity-60">·</span>}
                                {product.hindi && <span style={{ fontFamily: "var(--font-kalam), cursive" }}>{product.hindi}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chalked price circle + arrow */}
                <div className="px-4 pt-3 pb-2 flex items-end gap-2">
                    <div className="relative">
                        <svg
                            width="78"
                            height="78"
                            viewBox="0 0 78 78"
                            className="absolute -top-1 -left-1"
                            style={{ pointerEvents: "none" }}
                        >
                            <ellipse
                                cx="39"
                                cy="39"
                                rx="35"
                                ry="32"
                                fill="none"
                                stroke="#f5f1e8"
                                strokeWidth="2"
                                strokeDasharray="3,2"
                                strokeLinecap="round"
                                opacity="0.85"
                                transform="rotate(-3 39 39)"
                            />
                        </svg>
                        <div
                            className="relative w-[68px] h-[68px] flex flex-col items-center justify-center"
                            style={{ fontFamily: "var(--font-caveat), cursive" }}
                        >
                            <span className="text-[28px] leading-none font-bold" style={{ color: "#f5f1e8" }}>
                                ₹{effectivePrice}
                            </span>
                            <span className="text-[11px] opacity-70 -mt-0.5" style={{ color: "#ffd166" }}>
                                /{product.unit}
                            </span>
                        </div>
                    </div>

                    {/* Hand-drawn arrow + nudge */}
                    {tiers.length > 0 && (
                        <div className="flex-1 pb-1">
                            <svg width="100%" height="20" viewBox="0 0 80 20" preserveAspectRatio="none">
                                <path
                                    d="M2 10 Q 30 2, 60 10 L 55 6 M60 10 L55 14"
                                    fill="none"
                                    stroke="#ffd166"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity="0.85"
                                />
                            </svg>
                            <div
                                className="text-[14px] -mt-0.5"
                                style={{ color: "#ffd166", fontFamily: "var(--font-caveat), cursive" }}
                            >
                                more = less!
                            </div>
                        </div>
                    )}
                </div>

                {/* Hash-mark tier rows */}
                {tiers.length > 0 && (
                    <div className="px-4 pb-2">
                        {tiers.map((t, i) => {
                            const isActive = i === activeIdx && qty > 0;
                            return (
                                <div
                                    key={i}
                                    className="flex items-baseline gap-2 py-1"
                                    style={{
                                        borderTop: i === 0 ? "none" : "1px dashed rgba(245,241,232,0.18)",
                                        fontFamily: "var(--font-caveat), cursive",
                                        color: isActive ? "#ffd166" : "rgba(245,241,232,0.75)",
                                    }}
                                >
                                    <span className="w-3 text-center text-[15px]">
                                        {isActive ? "✓" : ""}
                                    </span>
                                    <span className="text-[15px] flex-1">{t.range} {product.unit}</span>
                                    <span className="text-[16px] font-bold">₹{t.price}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Action — hand-drawn boxed CTA */}
                <div className="mt-auto px-4 pb-4 pt-1">
                    {qty === 0 ? (
                        showQty ? (
                            <ChalkQty
                                defaultValue={moq}
                                unit={product.unit}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="relative w-full transition-transform active:scale-[0.98] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#ffd166]"
                                style={{
                                    fontFamily: "var(--font-caveat), cursive",
                                    color: "#1c1f1c",
                                    background: "#ffd166",
                                    padding: "8px 12px",
                                    fontSize: "20px",
                                    fontWeight: 700,
                                    border: "2px solid #f5f1e8",
                                    borderRadius: "4px",
                                    boxShadow: "3px 3px 0 #f5f1e8",
                                }}
                            >
                                Order it →
                            </button>
                        )
                    ) : (
                        <ChalkCartRow
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

function ChalkQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{
                background: "#f5f1e8", border: "2px solid #f5f1e8", borderRadius: 4, height: 40,
            }}>
                <input
                    autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: "#1c1f1c", fontFamily: "var(--font-caveat), cursive", fontSize: "20px" }}
                />
                <span className="pr-2 text-[14px]" style={{ color: "#1c1f1c", fontFamily: "var(--font-caveat), cursive" }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-10 px-3 font-bold text-[16px]"
                style={{ background: "#ffd166", color: "#1c1f1c", border: "2px solid #f5f1e8", borderRadius: 4, fontFamily: "var(--font-caveat), cursive" }}>
                <Check className="w-4 h-4 inline" />
            </button>
        </div>
    );
}

function ChalkCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-10 w-10 flex items-center justify-center"
                    style={{ background: "rgba(255,107,107,0.15)", border: "2px solid #ff6b6b", color: "#ff6b6b", borderRadius: 4 }} aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: "#ffd166", color: "#1c1f1c", border: "2px solid #f5f1e8", borderRadius: 4, height: 40,
                    fontFamily: "var(--font-caveat), cursive",
                }}>
                    <button onClick={onMinus} className="w-10 h-full text-2xl font-bold">−</button>
                    <div className="flex-1 text-center text-[20px] font-bold">{qty}<span className="text-[14px] ml-1 opacity-70">{unit}</span></div>
                    <button onClick={onPlus} className="w-10 h-full text-2xl font-bold">+</button>
                </div>
            </div>
            <div className="text-[14px] mt-1 text-center" style={{ color: "#ffd166", fontFamily: "var(--font-caveat), cursive" }}>
                ₹{effectivePrice}/{unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
