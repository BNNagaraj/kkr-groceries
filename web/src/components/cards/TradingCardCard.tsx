"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check, Star } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * TradingCard — holographic sports/Pokémon card refractor aesthetic.
 *
 * 1.5px holographic conic-gradient border that animates on hover. Stat
 * block table for tier slabs. Foil-shine sweep diagonally across the
 * image on hover. Multilingual rarity tag (uses category as the rarity
 * type — "FRESH HARVEST", "BULK GRADE A", etc).
 *
 * Reads instantly because of the strong border + corner stamps.
 */

const RARITY: Record<string, { label: string; tint: string }> = {
    leafy: { label: "★★★ Fresh Pick", tint: "#22c55e" },
    roots: { label: "★★ Earth Bound", tint: "#a16207" },
    fruit_veg: { label: "★★★ Sun Ripe", tint: "#dc2626" },
    gourds: { label: "★★ Vine Grown", tint: "#16a34a" },
    cruciferous: { label: "★★ Cool Crop", tint: "#65a30d" },
    sweet: { label: "★★★★ Premium", tint: "#c2410c" },
    rice: { label: "★★ Grain", tint: "#a16207" },
    flour: { label: "★★ Mill", tint: "#92400e" },
    pulses: { label: "★★ Legume", tint: "#854d0e" },
    oil: { label: "★★★ Press", tint: "#ca8a04" },
    spices: { label: "★★★★ Rare", tint: "#dc2626" },
    sugar_salt: { label: "★ Pantry", tint: "#475569" },
    milk: { label: "★★★ Daily", tint: "#0284c7" },
    curd: { label: "★★ Fresh", tint: "#0891b2" },
    butter_cream: { label: "★★★★ Premium", tint: "#ca8a04" },
    paneer_cheese: { label: "★★★ Artisan", tint: "#a16207" },
    buttermilk: { label: "★★ Refreshing", tint: "#0e7490" },
};

export const TradingCardCard = memo(function TradingCardCard({ product }: { product: Product }) {
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

    const rarity = RARITY[product.category] || { label: "★ Item", tint: "#64748b" };

    return (
        <>
            <article
                className="relative h-full p-[2px] rounded-[14px] group/card overflow-hidden"
                style={{
                    background: `conic-gradient(from 0deg, #ff48b0, #06b6d4, #facc15, #22c55e, #ff48b0)`,
                    backgroundSize: "200% 200%",
                    animation: "spin-slow 8s linear infinite",
                    fontFamily: "var(--font-outfit), sans-serif",
                }}
            >
                <div
                    className="relative h-full flex flex-col rounded-[12px] overflow-hidden"
                    style={{
                        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                        color: "#f1f5f9",
                    }}
                >
                    {/* Top stat banner */}
                    <div
                        className="px-3 py-1.5 flex items-center justify-between border-b"
                        style={{
                            background: `linear-gradient(90deg, ${rarity.tint}, ${rarity.tint}99)`,
                            borderColor: "rgba(255,255,255,0.15)",
                        }}
                    >
                        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white drop-shadow">
                            {rarity.label}
                        </span>
                        <span className="text-[9px] font-mono text-white/70">
                            #{String(product.id).padStart(3, "0")}/250
                        </span>
                    </div>

                    {/* Image with foil-shine overlay */}
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-full overflow-hidden focus:outline-none"
                        style={{ aspectRatio: "16 / 11", background: "#1e293b" }}
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
                                style={{ filter: "saturate(1.15) contrast(1.05)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-slate-700">
                                {product.name.charAt(0)}
                            </div>
                        )}
                        {/* Holographic sheen — sweeps on hover */}
                        <div
                            className="absolute inset-0 pointer-events-none mix-blend-screen opacity-40 group-hover/card:opacity-70 transition-opacity duration-300"
                            style={{
                                background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.45) 50%, transparent 70%)",
                                transform: "translateX(-30%)",
                                animation: "sheen 3.5s ease-in-out infinite",
                            }}
                        />
                        {/* Inner border */}
                        <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10" />
                    </button>

                    {/* Name + sub */}
                    <div className="px-3 pt-2.5 pb-1">
                        <h3 className="text-[18px] font-bold leading-tight tracking-tight line-clamp-2 break-words" style={{ color: "#f1f5f9" }}>
                            {product.name}
                        </h3>
                        {(product.telugu || product.hindi) && (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                                {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                                {product.telugu && product.hindi && <span className="mx-1.5">·</span>}
                                {product.hindi && <span>{product.hindi}</span>}
                            </div>
                        )}
                    </div>

                    {/* Stat block */}
                    <div className="mx-3 mb-2 rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                        <div className="px-2 py-1 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold">Base</span>
                            <span className="text-[18px] font-bold tabular-nums" style={{ color: rarity.tint, fontFamily: "var(--font-jetbrains), monospace" }}>
                                ₹{effectivePrice}<span className="text-[10px] text-slate-400 ml-1">/{product.unit}</span>
                            </span>
                        </div>
                        {tiers.length > 0 && (
                            <div className="px-2 py-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                {tiers.map((t, i) => {
                                    const isActive = i === activeIdx && qty > 0;
                                    return (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between text-[11px]"
                                            style={{
                                                color: isActive ? rarity.tint : "#cbd5e1",
                                                fontWeight: isActive ? 600 : 400,
                                            }}
                                        >
                                            <span className="flex items-center gap-1">
                                                {isActive && <Star className="w-2.5 h-2.5" fill="currentColor" />}
                                                {!isActive && <span className="w-2.5" />}
                                                <span className="font-mono">{t.range} {product.unit}</span>
                                            </span>
                                            <span className="tabular-nums font-mono">₹{t.price}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Action */}
                    <div className="mt-auto px-3 pb-3">
                        {qty === 0 ? (
                            showQty ? (
                                <TCQty
                                    defaultValue={moq}
                                    unit={product.unit}
                                    tint={rarity.tint}
                                    onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                    onCancel={() => setShowQty(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowQty(true)}
                                    className="w-full h-9 rounded-md text-[12px] font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110"
                                    style={{
                                        background: `linear-gradient(90deg, ${rarity.tint}, ${rarity.tint}cc)`,
                                        color: "#0f172a",
                                        boxShadow: `0 0 0 1px rgba(255,255,255,0.15), 0 4px 12px -4px ${rarity.tint}`,
                                    }}
                                >
                                    + Collect
                                </button>
                            )
                        ) : (
                            <TCCartRow
                                qty={qty}
                                unit={product.unit}
                                tint={rarity.tint}
                                onPlus={() => addToCart(product, 1)}
                                onMinus={() => addToCart(product, -1)}
                                onRemove={() => removeFromCart(product.id)}
                                effectivePrice={effectivePrice}
                            />
                        )}
                    </div>

                    {/* Foil corners */}
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full opacity-60"
                        style={{ background: "conic-gradient(from 0deg, #ff48b0, #06b6d4, #facc15, #ff48b0)" }} />
                </div>

                {/* Local keyframes */}
                <style>{`
                    @keyframes spin-slow {
                        0%   { background-position: 0% 50%; }
                        50%  { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    @keyframes sheen {
                        0%, 100% { transform: translateX(-50%); }
                        50%      { transform: translateX(50%); }
                    }
                `}</style>
            </article>

            <ImageLightbox src={product.image} alt={product.name} telugu={product.telugu} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
        </>
    );
});

function TCQty({ defaultValue, unit, tint, onConfirm, onCancel }: {
    defaultValue: number; unit: string; tint: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", height: 36 }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: "#f1f5f9", fontFamily: "var(--font-jetbrains), monospace", fontSize: 14 }}
                />
                <span className="pr-2 text-[10px] uppercase tracking-wider text-slate-400">{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-9 px-3 text-[11px] font-bold uppercase tracking-wider rounded-md"
                style={{ background: tint, color: "#0f172a" }}>
                <Check className="w-3.5 h-3.5 inline" />
            </button>
        </div>
    );
}

function TCCartRow({ qty, unit, tint, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; tint: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 rounded-md overflow-hidden h-9"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <button onClick={onRemove} className="w-9 h-full flex items-center justify-center text-red-400 hover:bg-red-500/15" aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={onMinus} className="flex-1 h-full text-lg font-bold hover:bg-white/5 text-slate-200">−</button>
                <div className="flex-1 text-center font-bold tabular-nums text-slate-100" style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 13 }}>
                    {qty}<span className="text-[9px] opacity-70 uppercase tracking-wider ml-0.5">{unit}</span>
                </div>
                <button onClick={onPlus} className="flex-1 h-full text-lg font-bold hover:bg-white/5 text-slate-200">+</button>
            </div>
            <div className="text-[10px] mt-1 text-center tabular-nums font-mono" style={{ color: tint }}>
                ₹{effectivePrice}/{unit} · ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
