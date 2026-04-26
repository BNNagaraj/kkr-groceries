"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, Check } from "lucide-react";
import { formatTiersForDisplay, getActiveTierIndex, resolveSlabPrice } from "@/lib/pricing";
import { ImageLightbox } from "./shared";

/**
 * PeriodicElement — atomic cell from a chemistry chart.
 *
 * Each product becomes a periodic-table-style square: big atomic number
 * (the SKU id) in the upper-left, big two-letter symbol (initials) center
 * stage, full common name beneath the symbol, "atomic mass" (the price)
 * at the bottom. Sub-grid of "isotope rates" for tier slabs. Disciplined,
 * scientific, instantly scannable.
 */

const CATEGORY_GROUP: Record<string, { abbr: string; tint: string; label: string }> = {
    leafy:        { abbr: "Lf", tint: "#16a34a", label: "Leafy"      },
    roots:        { abbr: "Rt", tint: "#a16207", label: "Root"       },
    fruit_veg:    { abbr: "Fr", tint: "#dc2626", label: "Fruit"      },
    gourds:       { abbr: "Gd", tint: "#15803d", label: "Gourd"      },
    cruciferous:  { abbr: "Cr", tint: "#65a30d", label: "Crucifer"   },
    sweet:        { abbr: "Sw", tint: "#ea580c", label: "Sweet"      },
    rice:         { abbr: "Ri", tint: "#a16207", label: "Rice"       },
    flour:        { abbr: "Fl", tint: "#92400e", label: "Flour"      },
    pulses:       { abbr: "Pu", tint: "#854d0e", label: "Pulse"      },
    oil:          { abbr: "Oi", tint: "#ca8a04", label: "Oil"        },
    spices:       { abbr: "Sp", tint: "#dc2626", label: "Spice"      },
    sugar_salt:   { abbr: "SS", tint: "#475569", label: "Pantry"     },
    milk:         { abbr: "Mk", tint: "#0284c7", label: "Milk"       },
    curd:         { abbr: "Cu", tint: "#0891b2", label: "Curd"       },
    butter_cream: { abbr: "Bu", tint: "#ca8a04", label: "Butter"     },
    paneer_cheese:{ abbr: "Pn", tint: "#a16207", label: "Paneer"     },
    buttermilk:   { abbr: "Bm", tint: "#0e7490", label: "Buttermilk" },
};

function symbolFor(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z]/g, "");
    if (cleaned.length === 0) return "?";
    if (cleaned.length === 1) return cleaned.toUpperCase();
    return cleaned[0].toUpperCase() + cleaned[1].toLowerCase();
}

export const PeriodicElementCard = memo(function PeriodicElementCard({ product }: { product: Product }) {
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

    const grp = CATEGORY_GROUP[product.category] || { abbr: "Vg", tint: "#475569", label: "Item" };
    const symbol = symbolFor(product.name);

    return (
        <>
            <article
                className="relative flex flex-col h-full overflow-hidden transition-transform duration-150 hover:-translate-y-0.5"
                style={{
                    background: "#fafaf7",
                    border: `2px solid ${grp.tint}`,
                    color: "#0a0a0a",
                    fontFamily: "var(--font-jetbrains), monospace",
                    boxShadow: `4px 4px 0 -1px ${grp.tint}33`,
                }}
            >
                {/* Top corner data — atomic number + group abbr */}
                <div className="flex items-start justify-between p-2.5 pb-0">
                    <div className="leading-none">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">
                            no.
                        </div>
                        <div className="text-[20px] font-bold tabular-nums leading-none mt-0.5">
                            {product.id}
                        </div>
                    </div>
                    <div
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm"
                        style={{ background: grp.tint, color: "#fafaf7" }}
                    >
                        {grp.abbr} · {grp.label}
                    </div>
                </div>

                {/* Center — big symbol + photo flanking */}
                <div className="flex items-center gap-3 px-3 pt-1">
                    <div className="flex-1">
                        <div
                            className="leading-[0.85] font-bold tabular-nums"
                            style={{
                                fontSize: "60px",
                                color: grp.tint,
                                fontFamily: "var(--font-jetbrains), monospace",
                                letterSpacing: "-0.04em",
                            }}
                        >
                            {symbol}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => hasImage && setLightboxOpen(true)}
                        className="relative w-[60px] h-[60px] shrink-0 overflow-hidden focus:outline-none rounded-sm"
                        style={{ background: "#e5e5e0", border: `1px solid ${grp.tint}` }}
                    >
                        {hasImage ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="60px"
                                className="object-cover"
                                unoptimized={!product.image.includes("googleapis.com")}
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ color: grp.tint }}>
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </button>
                </div>

                {/* Element name */}
                <div className="px-3 pt-2">
                    <h3
                        className="text-[15px] font-bold uppercase tracking-tight leading-tight line-clamp-2 break-words"
                        style={{ color: "#0a0a0a", fontFamily: "var(--font-jetbrains), monospace" }}
                    >
                        {product.name}
                    </h3>
                    {(product.telugu || product.hindi) && (
                        <div className="mt-1 text-[10px] opacity-60">
                            {product.telugu && <span style={{ fontFamily: "var(--font-noto-telugu), sans-serif" }}>{product.telugu}</span>}
                            {product.telugu && product.hindi && <span className="mx-1">/</span>}
                            {product.hindi && <span>{product.hindi}</span>}
                        </div>
                    )}
                </div>

                {/* "Atomic mass" — the price */}
                <div className="px-3 pt-2 pb-2">
                    <div className="text-[9px] uppercase tracking-[0.25em] opacity-50 leading-none">
                        Mass · ₹/{product.unit}
                    </div>
                    <div className="text-[24px] leading-none font-bold tabular-nums mt-1" style={{ color: grp.tint }}>
                        {effectivePrice.toFixed(2)}
                    </div>
                </div>

                {/* Isotope (tier) sub-grid */}
                {tiers.length > 0 && (
                    <div className="mx-3 mb-2 grid grid-cols-2 gap-px" style={{ background: `${grp.tint}33`, padding: 1 }}>
                        {tiers.map((t, i) => {
                            const isActive = i === activeIdx && qty > 0;
                            return (
                                <div
                                    key={i}
                                    className="px-1.5 py-1 text-[10px]"
                                    style={{
                                        background: isActive ? grp.tint : "#fafaf7",
                                        color: isActive ? "#fafaf7" : "#0a0a0a",
                                        fontWeight: isActive ? 700 : 400,
                                    }}
                                >
                                    <div className="opacity-70 uppercase tracking-wider text-[8px]">{t.range}</div>
                                    <div className="tabular-nums font-bold">₹{t.price}</div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Action */}
                <div className="mt-auto p-2 pt-0">
                    {qty === 0 ? (
                        showQty ? (
                            <PeriQty
                                defaultValue={moq}
                                unit={product.unit}
                                tint={grp.tint}
                                onConfirm={(v) => { addToCart(product, v); setShowQty(false); }}
                                onCancel={() => setShowQty(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowQty(true)}
                                className="w-full text-[11px] font-bold uppercase tracking-[0.22em] transition-colors hover:brightness-95"
                                style={{
                                    background: grp.tint,
                                    color: "#fafaf7",
                                    padding: "8px 6px",
                                    fontFamily: "var(--font-jetbrains), monospace",
                                }}
                            >
                                + Bond
                            </button>
                        )
                    ) : (
                        <PeriCartRow
                            qty={qty}
                            unit={product.unit}
                            tint={grp.tint}
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

function PeriQty({ defaultValue, unit, tint, onConfirm, onCancel }: {
    defaultValue: number; unit: string; tint: string; onConfirm: (qty: number) => void; onCancel: () => void;
}) {
    const [value, setValue] = useState(String(defaultValue));
    return (
        <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center" style={{ background: "#fafaf7", border: `1px solid ${tint}`, height: 34 }}>
                <input autoFocus type="text" inputMode="decimal" value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }
                        if (e.key === "Escape") onCancel();
                    }}
                    className="flex-1 min-w-0 px-2 text-center font-bold tabular-nums outline-none"
                    style={{ background: "transparent", color: "#0a0a0a", fontFamily: "var(--font-jetbrains), monospace", fontSize: 13 }}
                />
                <span className="pr-1.5 text-[9px] uppercase tracking-wider opacity-60">{unit}</span>
            </div>
            <button onClick={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) onConfirm(n); }}
                className="h-[34px] px-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: tint, color: "#fafaf7", fontFamily: "var(--font-jetbrains), monospace" }}>
                <Check className="w-3.5 h-3.5 inline" />
            </button>
        </div>
    );
}

function PeriCartRow({ qty, unit, tint, onPlus, onMinus, onRemove, effectivePrice }: {
    qty: number; unit: string; tint: string; onPlus: () => void; onMinus: () => void; onRemove: () => void; effectivePrice: number;
}) {
    return (
        <div>
            <div className="flex items-center gap-1">
                <button onClick={onRemove} className="h-[34px] w-[34px] flex items-center justify-center"
                    style={{ background: "#fafaf7", border: `1px solid #b91c1c`, color: "#b91c1c" }} aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-center" style={{
                    background: tint, color: "#fafaf7", height: 34,
                }}>
                    <button onClick={onMinus} className="w-9 h-full text-lg font-bold">−</button>
                    <div className="flex-1 text-center font-bold tabular-nums" style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 13 }}>
                        {qty}<span className="text-[9px] opacity-70 uppercase ml-0.5">{unit}</span>
                    </div>
                    <button onClick={onPlus} className="w-9 h-full text-lg font-bold">+</button>
                </div>
            </div>
            <div className="text-[9px] mt-1 text-center tabular-nums uppercase tracking-wider"
                style={{ color: tint, fontFamily: "var(--font-jetbrains), monospace" }}>
                ₹{effectivePrice}/{unit} · ₹{(effectivePrice * qty).toLocaleString("en-IN")}
            </div>
        </div>
    );
}
