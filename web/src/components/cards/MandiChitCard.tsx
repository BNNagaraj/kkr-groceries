"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * Mandi Chit — auction-yard ticket aesthetic.
 *
 * Off-white paper card with subtle grain. Off-register ink-stamp in the
 * corner stamps the category. Typewriter face for the product name pairs
 * with Telugu/Hindi underneath. Massive monospace price like a typewriter
 * receipt. Tier rows render as ledger lines with hand-drawn tick marks for
 * the active slab. Bottom edge perforates and the action button reads
 * "Weigh / Add" in three scripts.
 *
 * Optimised for the wholesale buyer who scans 80 SKUs at 6am: the price is
 * the thing that has to be readable from across the screen.
 */

const CATEGORY_STAMP: Record<string, { en: string; te: string }> = {
  leafy: { en: "LEAFY", te: "ఆకుకూరలు" },
  roots: { en: "ROOTS", te: "దుంపలు" },
  fruit_veg: { en: "FRUIT VEG", te: "పండు కూర" },
  gourds: { en: "GOURDS", te: "కాయగూర" },
  cruciferous: { en: "OTHERS", te: "ఇతర" },
  sweet: { en: "SWEET", te: "తీపి" },
  rice: { en: "RICE", te: "బియ్యం" },
  flour: { en: "FLOUR", te: "పిండి" },
  pulses: { en: "PULSES", te: "పప్పు" },
  oil: { en: "OIL", te: "నూనె" },
  spices: { en: "SPICES", te: "మసాలా" },
  sugar_salt: { en: "SUGAR · SALT", te: "చక్కెర · ఉప్పు" },
  milk: { en: "MILK", te: "పాలు" },
  curd: { en: "CURD", te: "పెరుగు" },
  butter_cream: { en: "BUTTER", te: "వెన్న" },
  paneer_cheese: { en: "PANEER", te: "పనీర్" },
  buttermilk: { en: "MOR", te: "మజ్జిగ" },
};

export const MandiChitCard = memo(function MandiChitCard({ product }: { product: Product }) {
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

    const stamp = CATEGORY_STAMP[product.category] || { en: "ITEM", te: "" };
    const lowestPrice = tiers.length > 0 ? Math.min(...tiers.map((t) => t.price)) : product.price;
    const maxSavings = product.price > 0 ? Math.round(((product.price - lowestPrice) / product.price) * 100) : 0;

    return (
        <>
            <article
                className="relative flex flex-col h-full transition-transform duration-150 ease-out hover:-translate-y-0.5"
                style={{
                    fontFamily: "var(--font-special-elite), 'Special Elite', monospace",
                    color: "#1a1612",
                }}
            >
                {/* Paper card — warm off-white with grain texture via SVG noise */}
                <div
                    className="relative flex-1 flex flex-col"
                    style={{
                        background: "#f7f1e3",
                        backgroundImage: `
                            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.32 0 0 0 0 0.18 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
                            linear-gradient(180deg, #faf4e6 0%, #f3ecd9 100%)
                        `,
                        boxShadow:
                            "0 1px 0 rgba(180,150,90,0.25), 0 4px 12px -4px rgba(50,30,10,0.12), inset 0 0 0 1px rgba(120,90,40,0.12)",
                        clipPath:
                            "polygon(0 0, 100% 0, 100% calc(100% - 12px), 98% 100%, 96% calc(100% - 12px), 94% 100%, 92% calc(100% - 12px), 90% 100%, 88% calc(100% - 12px), 86% 100%, 84% calc(100% - 12px), 82% 100%, 80% calc(100% - 12px), 78% 100%, 76% calc(100% - 12px), 74% 100%, 72% calc(100% - 12px), 70% 100%, 68% calc(100% - 12px), 66% 100%, 64% calc(100% - 12px), 62% 100%, 60% calc(100% - 12px), 58% 100%, 56% calc(100% - 12px), 54% 100%, 52% calc(100% - 12px), 50% 100%, 48% calc(100% - 12px), 46% 100%, 44% calc(100% - 12px), 42% 100%, 40% calc(100% - 12px), 38% 100%, 36% calc(100% - 12px), 34% 100%, 32% calc(100% - 12px), 30% 100%, 28% calc(100% - 12px), 26% 100%, 24% calc(100% - 12px), 22% 100%, 20% calc(100% - 12px), 18% 100%, 16% calc(100% - 12px), 14% 100%, 12% calc(100% - 12px), 10% 100%, 8% calc(100% - 12px), 6% 100%, 4% calc(100% - 12px), 2% 100%, 0 calc(100% - 12px))",
                    }}
                >
                    {/* Header rule */}
                    <div className="px-4 pt-3 pb-1.5 flex items-baseline justify-between border-b-2 border-dashed" style={{ borderColor: "rgba(80,55,20,0.35)" }}>
                        <span className="text-[10px] tracking-[0.25em] font-bold" style={{ color: "#7a5a20" }}>
                            KKR · MANDI
                        </span>
                        <span className="text-[10px] tracking-wider" style={{ color: "#7a5a20" }}>
                            #{String(product.id).padStart(4, "0")}
                        </span>
                    </div>

                    {/* Off-register ink-stamp in upper-right */}
                    <div
                        className="absolute top-9 right-3 select-none pointer-events-none"
                        style={{
                            transform: "rotate(-7deg)",
                            opacity: 0.62,
                        }}
                    >
                        <div
                            className="border-2 px-2 py-0.5 rounded-sm"
                            style={{
                                borderColor: "#a83b1a",
                                color: "#a83b1a",
                                fontFamily: "var(--font-special-elite), monospace",
                                fontSize: "10px",
                                letterSpacing: "0.15em",
                                lineHeight: 1.2,
                                boxShadow: "inset 0 0 0 1px rgba(168,59,26,0.3)",
                            }}
                        >
                            <div className="font-bold">{stamp.en}</div>
                            {stamp.te && (
                                <div
                                    className="text-[8px] -mt-0.5"
                                    style={{ fontFamily: "var(--font-noto-telugu)" }}
                                >
                                    {stamp.te}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex gap-3 px-4 pt-3 pb-2">
                        {/* Image — small black-bordered photograph */}
                        <button
                            type="button"
                            onClick={() => hasImage && setLightboxOpen(true)}
                            className="relative w-[68px] h-[68px] shrink-0 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                            style={{
                                background: "#e8dfc4",
                                border: "2px solid #1a1612",
                                boxShadow: "2px 2px 0 rgba(120,90,40,0.4)",
                            }}
                            aria-label={hasImage ? `View ${product.name}` : product.name}
                        >
                            {hasImage ? (
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="68px"
                                    className="object-cover"
                                    unoptimized={!product.image.includes("googleapis.com")}
                                    onError={() => setImgError(true)}
                                    style={{ filter: "contrast(1.05) saturate(0.92)" }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ color: "#7a5a20" }}>
                                    {product.name.charAt(0)}
                                </div>
                            )}
                        </button>

                        {/* Name block */}
                        <div className="flex-1 min-w-0 pt-0.5 pr-16">
                            <h3
                                className="font-bold text-[16px] leading-[1.15] uppercase tracking-wide line-clamp-2 break-words"
                                style={{ color: "#1a1612", letterSpacing: "0.04em" }}
                            >
                                {product.name}
                            </h3>
                            <div className="mt-0.5 leading-tight">
                                {product.telugu && (
                                    <span
                                        className="text-[12px]"
                                        style={{
                                            fontFamily: "var(--font-noto-telugu)",
                                            color: "#5a4220",
                                        }}
                                    >
                                        {product.telugu}
                                    </span>
                                )}
                                {product.telugu && product.hindi && (
                                    <span className="text-[10px] mx-1" style={{ color: "#7a5a20" }}>·</span>
                                )}
                                {product.hindi && (
                                    <span className="text-[11px] italic" style={{ color: "#5a4220" }}>
                                        {product.hindi}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Big monospace price — the headline of the chit */}
                    <div className="px-4 pt-1 pb-2 flex items-end gap-2 border-t border-dashed" style={{ borderColor: "rgba(80,55,20,0.25)" }}>
                        <div
                            className="text-[42px] leading-none font-bold tabular-nums"
                            style={{
                                fontFamily: "var(--font-jetbrains), monospace",
                                color: "#1a1612",
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            ₹{effectivePrice}
                        </div>
                        <div
                            className="pb-1 text-[11px] uppercase tracking-[0.15em]"
                            style={{ color: "#5a4220" }}
                        >
                            per {product.unit}
                        </div>
                        {maxSavings > 0 && (
                            <div className="ml-auto pb-1.5">
                                <span
                                    className="inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider rotate-2"
                                    style={{
                                        background: "#a83b1a",
                                        color: "#fbf6e8",
                                        boxShadow: "1px 1px 0 rgba(0,0,0,0.2)",
                                    }}
                                >
                                    SAVE {maxSavings}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Tier ledger */}
                    {tiers.length > 0 && (
                        <div className="px-4 pb-2">
                            <div className="text-[9px] tracking-[0.25em] mb-1 font-bold" style={{ color: "#7a5a20" }}>
                                BULK SLABS
                            </div>
                            <div className="space-y-[2px]">
                                {tiers.map((t, i) => {
                                    const isActive = i === activeIdx && qty > 0;
                                    return (
                                        <div
                                            key={i}
                                            className="flex items-baseline gap-2 text-[12px] tabular-nums"
                                            style={{
                                                fontFamily: "var(--font-jetbrains), monospace",
                                                color: isActive ? "#1a1612" : "#5a4220",
                                            }}
                                        >
                                            <span className="w-3 text-center">
                                                {isActive ? (
                                                    <span style={{ color: "#a83b1a", fontWeight: 700, fontSize: "13px" }}>✓</span>
                                                ) : (
                                                    <span style={{ color: "#a89a70" }}>·</span>
                                                )}
                                            </span>
                                            <span className="w-16 shrink-0">{t.range} {product.unit}</span>
                                            <span
                                                className="flex-1 self-end mb-[3px]"
                                                style={{
                                                    borderBottom: "1px dotted #b8a060",
                                                    minHeight: "1px",
                                                }}
                                            />
                                            <span className={isActive ? "font-bold" : ""}>₹{t.price}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action — large, full-width, three-script */}
                    <div className="mt-auto px-4 pb-4 pt-1">
                        {qty === 0 ? (
                            showQty ? (
                                <QtyInput
                                    defaultValue={moq}
                                    unit={product.unit}
                                    onConfirm={(val) => {
                                        addToCart(product, val);
                                        setShowQty(false);
                                    }}
                                    onCancel={() => setShowQty(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowQty(true)}
                                    className="w-full transition-transform duration-100 ease-out active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                                    style={{
                                        background: "#1a1612",
                                        color: "#fbf6e8",
                                        border: "2px solid #1a1612",
                                        boxShadow: "3px 3px 0 #a83b1a",
                                        padding: "10px 8px",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    <div className="text-[14px] font-bold uppercase">Weigh &amp; Add</div>
                                    <div
                                        className="text-[10px] opacity-75 mt-0.5"
                                        style={{ fontFamily: "var(--font-noto-telugu)" }}
                                    >
                                        తూకం వేయండి · तौलें
                                    </div>
                                </button>
                            )
                        ) : (
                            <CartRow
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

/* ── Inline qty input styled to match the chit ── */
function QtyInput({
    defaultValue,
    unit,
    onConfirm,
    onCancel,
}: {
    defaultValue: number;
    unit: string;
    onConfirm: (qty: number) => void;
    onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1.5">
            <div
                className="flex-1 flex items-center"
                style={{
                    background: "#fbf6e8",
                    border: "2px solid #1a1612",
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
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none"
                    style={{
                        background: "transparent",
                        color: "#1a1612",
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "16px",
                    }}
                />
                <span className="pr-2 text-[11px] uppercase tracking-wider" style={{ color: "#5a4220" }}>{unit}</span>
            </div>
            <button
                onClick={() => {
                    const n = parseFloat(value);
                    if (!isNaN(n) && n > 0) onConfirm(n);
                }}
                className="h-10 px-3 font-bold uppercase text-[12px] tracking-wider"
                style={{
                    background: "#1a1612",
                    color: "#fbf6e8",
                    boxShadow: "2px 2px 0 #a83b1a",
                }}
            >
                <Check className="w-4 h-4 inline" /> Add
            </button>
        </div>
    );
}

/* ── Cart-active row, kept consistent with the chit aesthetic ── */
function CartRow({
    qty,
    unit,
    onPlus,
    onMinus,
    onRemove,
    effectivePrice,
}: {
    qty: number;
    unit: string;
    onPlus: () => void;
    onMinus: () => void;
    onRemove: () => void;
    effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={onRemove}
                    className="h-10 w-10 flex items-center justify-center"
                    style={{
                        background: "#fbf6e8",
                        border: "2px solid #a83b1a",
                        color: "#a83b1a",
                    }}
                    aria-label="Remove"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <div
                    className="flex-1 flex items-center"
                    style={{
                        background: "#1a1612",
                        color: "#fbf6e8",
                        border: "2px solid #1a1612",
                        height: 40,
                    }}
                >
                    <button
                        onClick={onMinus}
                        className="w-10 h-full text-xl font-bold hover:bg-[#2a2218]"
                    >
                        −
                    </button>
                    <div
                        className="flex-1 text-center font-bold tabular-nums"
                        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
                    >
                        {qty} <span className="text-[10px] opacity-70 uppercase tracking-wider ml-1">{unit}</span>
                    </div>
                    <button
                        onClick={onPlus}
                        className="w-10 h-full text-xl font-bold hover:bg-[#2a2218]"
                    >
                        +
                    </button>
                </div>
            </div>
            <div
                className="text-[10px] mt-1 text-center tabular-nums"
                style={{ color: "#5a4220", fontFamily: "var(--font-jetbrains), monospace" }}
            >
                ₹{effectivePrice}/{unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
