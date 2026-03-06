"use client";

import React, { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Trash2, ZoomIn, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveSlabPrice } from "@/lib/pricing";

/* ─── Inline Quantity Input ─── */

export function InlineQtyInput({
    defaultValue,
    unit,
    onConfirm,
    onCancel,
    variant = "add",
    minQty = 1,
}: {
    defaultValue: number;
    unit: string;
    onConfirm: (qty: number) => void;
    onCancel: () => void;
    variant?: "add" | "edit";
    minQty?: number;
}) {
    const [value, setValue] = useState(String(defaultValue));
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const handleConfirm = () => {
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0) {
            if (num < minQty) {
                setValue(String(minQty));
                setError(`Min: ${minQty}`);
                onConfirm(minQty);
                return;
            }
            onConfirm(num);
        } else {
            onCancel();
        }
    };

    if (variant === "edit") {
        return (
            <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                    if (e.key === "Escape") onCancel();
                }}
                onBlur={handleConfirm}
                className="w-full h-full bg-white text-emerald-700 text-center font-bold text-sm outline-none"
            />
        );
    }

    return (
        <div>
            <div className="flex items-center gap-1.5 h-10">
                <div className="flex-1 flex items-center border-2 border-emerald-600 rounded-xl h-full overflow-hidden">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => { setValue(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirm();
                            if (e.key === "Escape") onCancel();
                        }}
                        className="flex-1 min-w-0 px-3 text-center font-bold text-emerald-700 outline-none bg-emerald-50 h-full"
                    />
                    <span className="text-[11px] text-emerald-600 font-medium pr-2 whitespace-nowrap">{unit}</span>
                </div>
                <button
                    onClick={handleConfirm}
                    className="h-10 px-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1 shrink-0"
                >
                    <Check className="w-4 h-4" /> Add
                </button>
            </div>
            {error && <p className="text-[11px] text-red-500 font-medium mt-1 text-center">{error}</p>}
        </div>
    );
}

/* ─── Cart Controls ─── */

export const CartControls = memo(function CartControls({ product }: { product: Product }) {
    const { cart, addToCart, removeFromCart } = useAppStore();
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;
    const [showInput, setShowInput] = useState(false);
    const [editingQty, setEditingQty] = useState(false);

    const moq = (product.moqRequired !== false && product.moq > 0) ? product.moq : 1;

    if (qty === 0) {
        if (showInput) {
            return (
                <InlineQtyInput
                    defaultValue={moq}
                    unit={product.unit}
                    onConfirm={(val) => {
                        addToCart(product, val);
                        setShowInput(false);
                    }}
                    onCancel={() => setShowInput(false)}
                    variant="add"
                    minQty={moq}
                />
            );
        }

        return (
            <button
                onClick={() => setShowInput(true)}
                className="w-full h-10 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
                Add to Cart
            </button>
        );
    }

    const effectivePrice = product.priceTiers?.length ? resolveSlabPrice(qty, product.price, product.priceTiers) : null;

    return (
        <div>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => removeFromCart(product.id)}
                    className="w-9 h-10 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0"
                    aria-label="Remove from cart"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center bg-emerald-700 text-white rounded-xl h-10 overflow-hidden shadow-sm shadow-emerald-700/20">
                    <button
                        onClick={() => addToCart(product, -1)}
                        className="w-10 h-full flex items-center justify-center text-xl font-medium hover:bg-emerald-800 transition-colors"
                    >
                        −
                    </button>
                    <div
                        className="flex-1 text-center font-bold text-sm bg-emerald-800/20 h-full flex items-center justify-center cursor-pointer hover:bg-emerald-800/40 transition-colors"
                        onClick={() => setEditingQty(true)}
                        title="Click to edit quantity"
                    >
                        {editingQty ? (
                            <InlineQtyInput
                                defaultValue={qty}
                                unit={product.unit}
                                onConfirm={(val) => {
                                    const delta = val - qty;
                                    if (delta !== 0) addToCart(product, delta);
                                    setEditingQty(false);
                                }}
                                onCancel={() => setEditingQty(false)}
                                variant="edit"
                                minQty={moq}
                            />
                        ) : (
                            <>
                                {qty} <span className="text-[11px] font-medium ml-1 text-emerald-100">{product.unit}</span>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => addToCart(product, 1)}
                        className="w-10 h-full flex items-center justify-center text-xl font-medium hover:bg-emerald-800 transition-colors"
                    >
                        +
                    </button>
                </div>
            </div>
            {effectivePrice !== null && (
                <div className="text-[11px] text-emerald-600 font-medium text-center mt-1">
                    Rate: ₹{effectivePrice}/{product.unit} = ₹{(effectivePrice * qty).toLocaleString("en-IN")}
                </div>
            )}
        </div>
    );
});

/* ─── Image Lightbox ─── */

export function ImageLightbox({
    src,
    alt,
    telugu,
    open,
    onClose,
}: {
    src: string;
    alt: string;
    telugu?: string;
    open: boolean;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!open) return;
        document.body.style.overflow = "hidden";
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handleKey);
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative max-w-[90vw] max-h-[80vh] rounded-2xl overflow-hidden bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Image
                        src={src}
                        alt={alt}
                        width={400}
                        height={400}
                        className="object-contain max-h-[70vh]"
                        unoptimized={!src.includes("googleapis.com")}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <h3 className="text-white font-bold text-lg">{alt}</h3>
                        {telugu && <p className="text-white/70 text-sm font-telugu">{telugu}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                        aria-label="Close image"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
