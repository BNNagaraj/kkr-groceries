"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox, useCardOrientation } from "./shared";

/**
 * HairlineModern — refined sans, single hairline border, generous whitespace.
 *
 * Pure white. One 1px slate-200 outline. IBM Plex Sans throughout. Light
 * weight for the name, medium for the price; everything aligned to a
 * single optical baseline. No shadows, no gradients, no decoration. The
 * antithesis of MandiChit. Restraint to a fault.
 */
export const HairlineModernCard = memo(function HairlineModernCard({ product }: { product: Product }) {
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
                className={`relative flex h-full transition-colors duration-200 hover:border-slate-300 ${orient.flexClass}`}
                style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    color: "#0f172a",
                    fontFamily: "var(--font-ibm-plex), system-ui, sans-serif",
                }}
            >
                {/* Image — square, no border, just sits */}
                <button
                    type="button"
                    onClick={() => hasImage && setLightboxOpen(true)}
                    className="relative w-full overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    style={{ aspectRatio: orient.isHorizontal ? undefined : "5 / 4", background: "#f8fafc", ...(orient.imageWrapStyle || {}) }}
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
                            style={{ filter: "saturate(0.95)" }}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-4xl font-light" style={{ color: "#cbd5e1" }}>
                            {product.name.charAt(0)}
                        </div>
                    )}
                </button>

                {/* Content — generous spacing, single column */}
                <div className="flex flex-col flex-1 px-5 pt-4 pb-5" style={orient.contentWrapStyle}>
                    <h3
                        className="text-[18px] leading-[1.15] tracking-tight line-clamp-2 break-words"
                        style={{
                            color: "#0f172a",
                            fontWeight: 400,
                            fontFamily: "var(--font-ibm-plex), system-ui",
                        }}
                    >
                        {product.name}
                    </h3>
                    {(product.telugu || product.hindi) && (
                        <div className="mt-1 text-[12px]" style={{ color: "#64748b", fontWeight: 300 }}>
                            {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                            {product.telugu && product.hindi && <span className="mx-1.5" style={{ color: "#cbd5e1" }}>·</span>}
                            {product.hindi && <span>{product.hindi}</span>}
                        </div>
                    )}

                    {/* Price — single confident size, baseline aligned */}
                    <div className="mt-5 flex items-baseline gap-1">
                        <span
                            className="text-[28px] leading-none tabular-nums"
                            style={{
                                color: "#0f172a",
                                fontWeight: 500,
                                fontFamily: "var(--font-ibm-plex), system-ui",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            ₹{effectivePrice}
                        </span>
                        <span className="text-[12px]" style={{ color: "#94a3b8", fontWeight: 300 }}>
                            per {product.unit}
                        </span>
                    </div>

                    {/* Tier slabs — minimal disclosure list */}
                    {tiers.length > 0 && (
                        <div className="mt-4 pt-4 space-y-1" style={{ borderTop: "1px solid #f1f5f9" }}>
                            {tiers.map((t, i) => {
                                const isActive = i === activeIdx && qty > 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-baseline justify-between text-[12px]"
                                        style={{
                                            color: isActive ? "#0f172a" : "#64748b",
                                            fontWeight: isActive ? 500 : 300,
                                        }}
                                    >
                                        <span>{t.range} {product.unit}</span>
                                        <span className="tabular-nums">₹{t.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Action — text-button on left, no chrome */}
                    <div className="mt-auto pt-5">
                        {qty === 0 ? (
                            showQty ? (
                                <HMQty
                                    defaultValue={moq}
                                    unit={product.unit}
                                    onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                    onCancel={() => setShowQty(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowQty(true)}
                                    className="group/btn inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:text-emerald-700 focus:outline-none focus-visible:underline"
                                    style={{
                                        color: "#0f172a",
                                        fontFamily: "var(--font-ibm-plex), system-ui",
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    Add to order
                                    <span className="transition-transform group-hover/btn:translate-x-0.5">→</span>
                                </button>
                            )
                        ) : (
                            <HMCartRow
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

function HMQty({ defaultValue, unit, onConfirm, onCancel }: {
    defaultValue: number; unit: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center" style={{ background: "#fff", border: "1px solid #cbd5e1", height: 34 }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-medium tabular-nums outline-none"
                    style={{ background: "transparent", color: "#0f172a", fontFamily: "var(--font-ibm-plex), system-ui", fontSize: 14 }}
                />
                <span className="pr-2 text-[10px]" style={{ color: "#94a3b8" }}>{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-[34px] px-3 text-[12px] font-medium"
                style={{ background: "#0f172a", color: "#ffffff", fontFamily: "var(--font-ibm-plex), system-ui" }}>
                <Check className="w-3.5 h-3.5 inline" />
            </button>
        </div>
    );
}

function HMCartRow({ qty, unit, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button onClick={onRemove} className="h-[34px] w-[34px] flex items-center justify-center"
                    style={{ background: "#fff", border: "1px solid #fca5a5", color: "#dc2626" }} aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-center" style={{ background: "#0f172a", color: "#fff", height: 34 }}>
                    <button onClick={onMinus} className="w-9 h-full text-lg font-light hover:bg-slate-800">−</button>
                    <div className="flex-1 text-center font-medium tabular-nums" style={{ fontFamily: "var(--font-ibm-plex), system-ui", fontSize: 13 }}>
                        {qty}<span className="text-[10px] opacity-70 ml-1">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-9 h-full text-lg font-light hover:bg-slate-800">+</button>
                </div>
            </div>
            <div className="text-[10px] mt-1.5 tabular-nums" style={{ color: "#64748b", fontFamily: "var(--font-ibm-plex), system-ui" }}>
                ₹{effectivePrice}/{unit} · subtotal ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
