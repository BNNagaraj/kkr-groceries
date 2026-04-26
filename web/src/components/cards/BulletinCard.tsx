"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * Bulletin — broadsheet editorial aesthetic.
 *
 * The card reads like a single column from a wholesale daily price bulletin:
 * Fraunces serif headline, hairline ruled separators, prices set in italic
 * tabular figures, a small wire-photo crop in the upper right corner.
 * Discount badge becomes a circular "Save" stamp angled diagonally.
 *
 * Slow, intentional, premium without being glossy. The card respects the
 * reader's attention.
 */
export const BulletinCard = memo(function BulletinCard({ product }: { product: Product }) {
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
    const maxSavings = product.price - lowestPrice;

    const today = new Date();
    const dateStr = today.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    return (
        <>
            <article
                className="relative flex flex-col h-full group/card transition-all duration-200 ease-out"
                style={{
                    background: "#fbfaf6",
                    color: "#1c1a17",
                    borderTop: "3px solid #1c1a17",
                    borderBottom: "1px solid #d8d2c2",
                    borderLeft: "1px solid #d8d2c2",
                    borderRight: "1px solid #d8d2c2",
                    boxShadow: "0 1px 0 rgba(28,26,23,0.04)",
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                }}
            >
                {/* Masthead — date + section + edition number */}
                <header
                    className="flex items-baseline justify-between px-4 pt-3 pb-1.5 text-[10px] tracking-[0.2em] uppercase"
                    style={{ color: "#7a7468", fontFamily: "var(--font-outfit), system-ui" }}
                >
                    <span>The Daily Rate</span>
                    <span>{dateStr}</span>
                </header>

                {/* Hairline rule — newspaper top-rule */}
                <div className="mx-4 border-t" style={{ borderColor: "#1c1a17" }} />
                <div className="mx-4 mt-[2px] border-t" style={{ borderColor: "#1c1a17" }} />

                {/* Headline + small wire photo */}
                <div className="flex gap-3 px-4 pt-3 pb-2">
                    <div className="flex-1 min-w-0">
                        <h3
                            className="font-bold leading-[1.05] tracking-[-0.01em] line-clamp-2 break-words"
                            style={{
                                fontSize: "22px",
                                color: "#1c1a17",
                                fontWeight: 700,
                                fontFamily: "var(--font-fraunces), serif",
                                fontVariationSettings: '"opsz" 144, "SOFT" 0',
                            }}
                        >
                            {product.name}
                        </h3>
                        {(product.telugu || product.hindi) && (
                            <div className="mt-1 text-[12px] italic" style={{ color: "#5a564c" }}>
                                {product.telugu && (
                                    <span style={{ fontFamily: "var(--font-noto-telugu)", fontStyle: "normal" }}>
                                        {product.telugu}
                                    </span>
                                )}
                                {product.telugu && product.hindi && (
                                    <span className="mx-1.5" style={{ color: "#a8a094" }}>—</span>
                                )}
                                {product.hindi && <span>{product.hindi}</span>}
                            </div>
                        )}
                    </div>

                    {/* Wire photo — upper right, sepia-leaning */}
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-[68px] h-[68px] shrink-0 overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-700"
                        style={{
                            background: "#ebe6d6",
                            border: "1px solid #1c1a17",
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
                                style={{ filter: "contrast(1.08) saturate(0.7) sepia(0.06)" }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ color: "#a8a094", fontFamily: "var(--font-fraunces), serif" }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </button>
                </div>

                {/* Hairline */}
                <div className="mx-4 border-t" style={{ borderColor: "#d8d2c2" }} />

                {/* Two-column body — Today's Rate / Bulk Slabs */}
                <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] gap-3 items-start relative">
                    {/* Vertical rule */}
                    <div
                        className="absolute top-3 bottom-3 w-px"
                        style={{ left: "calc(50% - 0.5px)", background: "#d8d2c2" }}
                    />

                    {/* Left column — Today's Rate */}
                    <div className="pr-1">
                        <div
                            className="text-[9px] tracking-[0.25em] uppercase mb-1"
                            style={{ color: "#7a7468", fontFamily: "var(--font-outfit), system-ui" }}
                        >
                            Today&apos;s Rate
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span
                                className="text-[34px] leading-none italic tabular-nums"
                                style={{
                                    color: "#1c1a17",
                                    fontFamily: "var(--font-fraunces), serif",
                                    fontWeight: 500,
                                    fontStyle: "italic",
                                    fontVariationSettings: '"opsz" 144',
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                ₹{effectivePrice}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider" style={{ color: "#7a7468", fontFamily: "var(--font-outfit), sans-serif" }}>
                                /{product.unit}
                            </span>
                        </div>
                    </div>

                    <div />

                    {/* Right column — Bulk Slabs */}
                    <div className="pl-1">
                        <div
                            className="text-[9px] tracking-[0.25em] uppercase mb-1"
                            style={{ color: "#7a7468", fontFamily: "var(--font-outfit), system-ui" }}
                        >
                            Bulk Slabs
                        </div>
                        {tiers.length > 0 ? (
                            <div className="space-y-0.5">
                                {tiers.map((t, i) => {
                                    const isActive = i === activeIdx && qty > 0;
                                    return (
                                        <div
                                            key={i}
                                            className="flex items-baseline justify-between gap-2 text-[12px]"
                                            style={{
                                                color: isActive ? "#1c1a17" : "#5a564c",
                                                fontWeight: isActive ? 700 : 400,
                                            }}
                                        >
                                            <span style={{ fontFamily: "var(--font-outfit), system-ui" }}>{t.range} {product.unit}</span>
                                            <span
                                                className="tabular-nums italic"
                                                style={{ fontFamily: "var(--font-fraunces), serif" }}
                                            >
                                                ₹{t.price}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-[11px] italic" style={{ color: "#a8a094" }}>
                                Single rate
                            </div>
                        )}
                    </div>
                </div>

                {/* Diagonal "Save" stamp — overlaid bottom-right */}
                {maxSavings > 0 && (
                    <div
                        className="absolute select-none pointer-events-none"
                        style={{
                            bottom: 76,
                            right: 8,
                            transform: "rotate(-12deg)",
                        }}
                    >
                        <div
                            className="rounded-full flex flex-col items-center justify-center"
                            style={{
                                width: 56,
                                height: 56,
                                border: "2px solid #b22222",
                                color: "#b22222",
                                background: "rgba(251,250,246,0.85)",
                                boxShadow: "inset 0 0 0 1px rgba(178,34,34,0.4)",
                                fontFamily: "var(--font-fraunces), serif",
                            }}
                        >
                            <span className="text-[8px] uppercase tracking-[0.2em] font-bold leading-none">Save</span>
                            <span className="text-[15px] font-bold leading-none mt-0.5 italic tabular-nums">
                                ₹{maxSavings}
                            </span>
                        </div>
                    </div>
                )}

                {/* Footer rule + action */}
                <div className="mt-auto">
                    <div className="mx-4 border-t" style={{ borderColor: "#d8d2c2" }} />
                    <div className="px-4 py-3">
                        {qty === 0 ? (
                            showQty ? (
                                <BulletinQty
                                    defaultValue={moq}
                                    unit={product.unit}
                                    onConfirm={(v) => {
                                        addToCart(product, v);
                                        setShowQty(false);
                                    }}
                                    onCancel={() => setShowQty(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowQty(true)}
                                    className="w-full flex items-center justify-between text-[13px] font-semibold py-1.5 px-2 -mx-2 transition-colors hover:bg-stone-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-700"
                                    style={{
                                        color: "#1c1a17",
                                        fontFamily: "var(--font-outfit), system-ui",
                                        letterSpacing: "0.05em",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    <span>Order →</span>
                                    <span
                                        className="text-[10px] italic font-normal"
                                        style={{
                                            fontFamily: "var(--font-fraunces), serif",
                                            color: "#7a7468",
                                            textTransform: "none",
                                            letterSpacing: 0,
                                        }}
                                    >
                                        from {moq} {product.unit}
                                    </span>
                                </button>
                            )
                        ) : (
                            <BulletinCartRow
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

function BulletinQty({
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
                    background: "#fbfaf6",
                    border: "1px solid #1c1a17",
                    height: 36,
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
                    className="flex-1 min-w-0 px-3 text-center font-bold tabular-nums outline-none italic"
                    style={{
                        background: "transparent",
                        color: "#1c1a17",
                        fontFamily: "var(--font-fraunces), serif",
                        fontSize: "16px",
                    }}
                />
                <span
                    className="pr-2 text-[10px] uppercase tracking-wider"
                    style={{ color: "#7a7468", fontFamily: "var(--font-outfit), sans-serif" }}
                >
                    {unit}
                </span>
            </div>
            <button
                onClick={() => {
                    const n = parseFloat(value);
                    if (!isNaN(n) && n > 0) onConfirm(n);
                }}
                className="h-9 px-3 text-[12px] font-semibold uppercase tracking-wider"
                style={{
                    background: "#1c1a17",
                    color: "#fbfaf6",
                    fontFamily: "var(--font-outfit), sans-serif",
                }}
            >
                <Check className="w-3.5 h-3.5 inline mr-1" /> Confirm
            </button>
        </div>
    );
}

function BulletinCartRow({
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
                    className="h-9 w-9 flex items-center justify-center"
                    style={{
                        background: "#fbfaf6",
                        border: "1px solid #b22222",
                        color: "#b22222",
                    }}
                    aria-label="Remove"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div
                    className="flex-1 flex items-center"
                    style={{
                        background: "#1c1a17",
                        color: "#fbfaf6",
                        height: 36,
                    }}
                >
                    <button onClick={onMinus} className="w-9 h-full text-lg font-bold hover:bg-stone-800">
                        −
                    </button>
                    <div
                        className="flex-1 text-center font-bold tabular-nums italic"
                        style={{ fontFamily: "var(--font-fraunces), serif" }}
                    >
                        {qty}{" "}
                        <span
                            className="text-[10px] opacity-70 ml-0.5 uppercase not-italic tracking-wider"
                            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                        >
                            {unit}
                        </span>
                    </div>
                    <button onClick={onPlus} className="w-9 h-full text-lg font-bold hover:bg-stone-800">
                        +
                    </button>
                </div>
            </div>
            <div
                className="text-[10px] mt-1 text-center tabular-nums italic"
                style={{ color: "#5a564c", fontFamily: "var(--font-fraunces), serif" }}
            >
                ₹{effectivePrice}/{unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
