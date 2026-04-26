"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { useCardOrientation } from "./shared";

/**
 * Produce Forward — the food is the design.
 *
 * Dramatic full-bleed image fills the upper 65% of the card. A single
 * blurred legibility band hosts the name + price overlay at the bottom.
 * Tier slabs slide up on tap as a discreet sheet — the card breathes by
 * default; reveals density only when asked. Cormorant Garamond carries the
 * product name with a refined italic price beside it.
 *
 * Closer to a Whole Foods quarterly than a B2B catalog tile.
 */

// Per-category accent — used for the bottom band tint and the action.
const CATEGORY_ACCENT: Record<string, { tint: string; deep: string; ink: string }> = {
    leafy:         { tint: "#0f3a2c", deep: "#072017", ink: "#f1f4ee" },
    roots:         { tint: "#3a2614", deep: "#1f130a", ink: "#f4eee5" },
    fruit_veg:     { tint: "#3a1414", deep: "#1f0a0a", ink: "#f4ebe8" },
    gourds:        { tint: "#1f3614", deep: "#0d1d09", ink: "#eef3ea" },
    cruciferous:   { tint: "#2a3614", deep: "#161d09", ink: "#f0f3e8" },
    sweet:         { tint: "#3a1f0a", deep: "#1f0f04", ink: "#f4ede0" },
    rice:          { tint: "#2e2814", deep: "#1c180a", ink: "#f3eddb" },
    flour:         { tint: "#2e2218", deep: "#1c140d", ink: "#f3ebde" },
    pulses:        { tint: "#36241a", deep: "#1d130c", ink: "#f3ebdf" },
    oil:           { tint: "#3a2e0a", deep: "#1f1804", ink: "#f4eed6" },
    spices:        { tint: "#3a1408", deep: "#1f0a04", ink: "#f4e8e1" },
    sugar_salt:    { tint: "#2e2e36", deep: "#16161d", ink: "#f0f0f3" },
    milk:          { tint: "#2a3140", deep: "#141822", ink: "#eef1f5" },
    curd:          { tint: "#36322e", deep: "#1d1b18", ink: "#f3f0ed" },
    butter_cream:  { tint: "#3a2e14", deep: "#1f180a", ink: "#f4ecdb" },
    paneer_cheese: { tint: "#3a2e1a", deep: "#1f180e", ink: "#f4ecdc" },
    buttermilk:    { tint: "#2e3236", deep: "#16181c", ink: "#eff1f3" },
};

const DEFAULT_ACCENT = { tint: "#1f1d18", deep: "#100f0c", ink: "#f1ede5" };

export const ProduceForwardCard = memo(function ProduceForwardCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);
    const [tiersOpen, setTiersOpen] = useState(false);
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

    const accent = CATEGORY_ACCENT[product.category] || DEFAULT_ACCENT;

    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map((t) => t.price)) : product.price;
    const maxSavings = product.price > 0 ? Math.round(((product.price - lowestPrice) / product.price) * 100) : 0;
    const orient = useCardOrientation();

    return (
        <article
            className={`relative flex h-full overflow-hidden rounded-[20px] group/card transition-all duration-300 ease-out ${orient.flexClass}`}
            style={{
                background: accent.deep,
                color: accent.ink,
                boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 28px -12px ${accent.deep}`,
                fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
                minHeight: 360,
            }}
        >
            {/* Full-bleed image — fills upper 65% */}
            <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: orient.isHorizontal ? undefined : "4 / 3", background: accent.tint, ...(orient.imageWrapStyle || {}) }}
            >
                {hasImage ? (
                    <>
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 ease-out group-hover/card:scale-[1.03]"
                            unoptimized={!product.image.includes("googleapis.com")}
                            onError={() => setImgError(true)}
                            style={{ filter: "saturate(1.05) contrast(1.04)" }}
                        />
                        {/* Subtle vignette for legibility */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: `linear-gradient(180deg, ${accent.deep}00 0%, ${accent.deep}00 45%, ${accent.deep}cc 92%, ${accent.deep} 100%)`,
                            }}
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span
                            className="text-7xl italic opacity-30"
                            style={{ color: accent.ink, fontFamily: "var(--font-cormorant), serif" }}
                        >
                            {product.name.charAt(0)}
                        </span>
                    </div>
                )}

                {/* Subtle "Save N%" mark — top-left, refined */}
                {maxSavings > 0 && (
                    <div
                        className="absolute top-3 left-3 px-2 py-0.5 rounded-full backdrop-blur-md"
                        style={{
                            background: "rgba(0,0,0,0.32)",
                            border: "1px solid rgba(255,255,255,0.18)",
                        }}
                    >
                        <span
                            className="text-[10px] tracking-[0.18em] uppercase font-medium"
                            style={{ color: accent.ink, fontFamily: "var(--font-outfit), system-ui" }}
                        >
                            Save {maxSavings}%
                        </span>
                    </div>
                )}
            </div>

            {/* Content band */}
            <div className="px-4 pt-3 pb-4 flex-1 flex flex-col" style={orient.contentWrapStyle}>
                {/* Name + price as a typographic pair */}
                <div className="flex items-baseline gap-3">
                    <h3
                        className="flex-1 min-w-0 leading-[0.95] tracking-[-0.01em] line-clamp-2 break-words"
                        style={{
                            color: accent.ink,
                            fontFamily: "var(--font-cormorant), serif",
                            fontWeight: 500,
                            fontSize: "26px",
                        }}
                    >
                        {product.name}
                    </h3>
                    <div className="flex items-baseline shrink-0">
                        <span
                            className="text-[28px] leading-none italic tabular-nums"
                            style={{
                                color: accent.ink,
                                fontFamily: "var(--font-cormorant), serif",
                                fontWeight: 600,
                                fontStyle: "italic",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            ₹{effectivePrice}
                        </span>
                        <span
                            className="ml-0.5 text-[10px] uppercase tracking-[0.15em] opacity-60"
                            style={{ fontFamily: "var(--font-outfit), system-ui", color: accent.ink }}
                        >
                            /{product.unit}
                        </span>
                    </div>
                </div>

                {/* Multilingual subtitle */}
                {(product.telugu || product.hindi) && (
                    <div
                        className="mt-1 text-[12px] opacity-65"
                        style={{ color: accent.ink }}
                    >
                        {product.telugu && (
                            <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>
                        )}
                        {product.telugu && product.hindi && <span className="mx-1.5 opacity-50">·</span>}
                        {product.hindi && <span style={{ fontFamily: "var(--font-outfit), sans-serif" }}>{product.hindi}</span>}
                    </div>
                )}

                {/* Tier disclosure — slides reveal */}
                {tiers.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setTiersOpen((s) => !s)}
                        className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] opacity-70 hover:opacity-100 transition-opacity self-start"
                        style={{ color: accent.ink, fontFamily: "var(--font-outfit), system-ui" }}
                        aria-expanded={tiersOpen}
                    >
                        <span>{tiersOpen ? "Hide slabs" : `${tiers.length} bulk slabs`}</span>
                        {tiersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}

                <div
                    className="overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out"
                    style={{
                        maxHeight: tiersOpen ? 240 : 0,
                        opacity: tiersOpen ? 1 : 0,
                        marginTop: tiersOpen ? 8 : 0,
                    }}
                >
                    <div
                        className="rounded-lg p-2.5 space-y-1"
                        style={{
                            background: accent.tint,
                            border: `1px solid ${accent.ink}1f`,
                        }}
                    >
                        {tiers.map((t, i) => {
                            const isActive = i === activeIdx && qty > 0;
                            return (
                                <div
                                    key={i}
                                    className="flex items-baseline justify-between text-[12px]"
                                    style={{
                                        color: isActive ? accent.ink : `${accent.ink}b3`,
                                        fontWeight: isActive ? 600 : 400,
                                    }}
                                >
                                    <span style={{ fontFamily: "var(--font-outfit), system-ui" }}>{t.range} {product.unit}</span>
                                    <span
                                        className="tabular-nums italic"
                                        style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: isActive ? 600 : 500 }}
                                    >
                                        ₹{t.price}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Action — minimal hairline button, inverts when in cart */}
                <div className="mt-auto pt-4">
                    {qty === 0 ? (
                        showQty ? (
                            <ProduceQty
                                defaultValue={moq}
                                unit={product.unit}
                                accent={accent}
                                onConfirm={(v) => {
                                    addToCart(product, v);
                                    setShowQty(false);
                                }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full h-10 rounded-full text-[12px] uppercase tracking-[0.2em] font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                style={{
                                    background: accent.ink,
                                    color: accent.deep,
                                    fontFamily: "var(--font-outfit), system-ui",
                                }}
                            >
                                Add to order
                            </button>
                        )
                    ) : (
                        <ProduceCartRow
                            qty={qty}
                            unit={product.unit}
                            accent={accent}
                            onPlus={() => addToCart(product, 1)}
                            onMinus={() => addToCart(product, -1)}
                            onRemove={() => removeFromCart(product.id)}
                            effectivePrice={effectivePrice}
                        />
                    )}
                </div>
            </div>
        </article>
    );
});

function ProduceQty({
    defaultValue,
    unit,
    accent,
    onConfirm,
    onCancel,
}: {
    defaultValue: number;
    unit: string;
    accent: { tint: string; deep: string; ink: string };
    onConfirm: (qty: number) => void;
    onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div
                className="flex-1 flex items-center rounded-full overflow-hidden"
                style={{
                    background: accent.tint,
                    border: `1px solid ${accent.ink}33`,
                    height: 40,
                }}
            >
                <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            const n = parseFloat(value);
                            if (!isNaN(n) && n > 0) onConfirm(n);
                        }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-4 text-center font-semibold tabular-nums italic outline-none"
                    style={{
                        background: "transparent",
                        color: accent.ink,
                        fontFamily: "var(--font-cormorant), serif",
                        fontSize: "16px",
                    }}
                />
                <span
                    className="pr-3 text-[10px] uppercase tracking-wider opacity-70"
                    style={{ color: accent.ink, fontFamily: "var(--font-outfit), system-ui" }}
                >
                    {unit}
                </span>
            </div>
            <button
                onClick={() => {
                    const n = parseFloat(value);
                    if (!isNaN(n) && n > 0) onConfirm(n);
                }}
                className="h-10 px-4 rounded-full text-[11px] uppercase tracking-[0.18em] font-semibold"
                style={{
                    background: accent.ink,
                    color: accent.deep,
                    fontFamily: "var(--font-outfit), system-ui",
                }}
            >
                <Check className="w-3.5 h-3.5 inline" />
            </button>
        </div>
    );
}

function ProduceCartRow({
    qty,
    unit,
    accent,
    onPlus,
    onMinus,
    onRemove,
    effectivePrice,
}: {
    qty: number;
    unit: string;
    accent: { tint: string; deep: string; ink: string };
    onPlus: () => void;
    onMinus: () => void;
    onRemove: () => void;
    effectivePrice: number;
}) {
    return (
        <div>
            <div
                className="flex items-center rounded-full overflow-hidden h-10"
                style={{
                    background: accent.ink,
                    color: accent.deep,
                }}
            >
                <button
                    onClick={onRemove}
                    className="w-10 h-full flex items-center justify-center hover:bg-black/10"
                    aria-label="Remove"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={onMinus} className="flex-1 h-full text-lg font-bold hover:bg-black/10">−</button>
                <div
                    className="flex-1 text-center font-semibold tabular-nums italic"
                    style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "15px" }}
                >
                    {qty}{" "}
                    <span
                        className="text-[10px] not-italic uppercase tracking-wider opacity-60 ml-0.5"
                        style={{ fontFamily: "var(--font-outfit), system-ui" }}
                    >
                        {unit}
                    </span>
                </div>
                <button onClick={onPlus} className="flex-1 h-full text-lg font-bold hover:bg-black/10">+</button>
            </div>
            <div
                className="text-[10px] mt-1.5 text-center tabular-nums italic opacity-65"
                style={{ color: accent.ink, fontFamily: "var(--font-cormorant), serif" }}
            >
                ₹{effectivePrice}/{unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
