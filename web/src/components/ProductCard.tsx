"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import { Product, useAppStore } from "@/contexts/AppContext";
import { Flame, LeafyGreen } from "lucide-react";
import { motion } from "framer-motion";

// Independent component that uses Context, preventing the parent ProductCard from re-rendering
const CartControls = memo(function CartControls({ product }: { product: Product }) {
    const { cart, addToCart } = useAppStore();
    const cartItem = cart[product.id];
    const qty = cartItem ? cartItem.qty : 0;

    if (qty === 0) {
        return (
            <button
                onClick={() => addToCart(product, product.moq)}
                className="w-full h-10 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
                Add to Cart
            </button>
        );
    }

    return (
        <div className="flex items-center bg-emerald-700 text-white rounded-xl h-10 overflow-hidden shadow-sm shadow-emerald-700/20">
            <button
                onClick={() => addToCart(product, -1)}
                className="w-12 h-full flex items-center justify-center text-xl font-medium hover:bg-emerald-800 transition-colors"
            >
                −
            </button>
            <div className="flex-1 text-center font-bold text-sm bg-emerald-800/20 h-full flex items-center justify-center">
                {qty} <span className="text-[11px] font-medium ml-1 text-emerald-100">{product.unit}</span>
            </div>
            <button
                onClick={() => addToCart(product, 1)}
                className="w-12 h-full flex items-center justify-center text-xl font-medium hover:bg-emerald-800 transition-colors"
            >
                +
            </button>
        </div>
    );
});

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
    const [imgError, setImgError] = useState(false);

    return (
        <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow"
        >
            <div className="p-3 flex items-start gap-4 flex-grow">
                <div className="w-[70px] h-[70px] rounded-xl flex-shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden relative">
                    {product.image && !imgError ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="70px"
                            className="object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <span className="text-2xl font-bold text-slate-300">
                            {product.name.charAt(0)}
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="font-bold text-slate-800 text-[15px] leading-tight flex items-center gap-1.5 flex-wrap">
                                {product.name}
                                {product.hot && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-[#fff1f2] text-[#e11d48] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        <Flame className="w-3 h-3 mr-0.5" /> Hot
                                    </span>
                                )}
                                {product.fresh && (
                                    <span className="inline-flex items-center text-[10px] font-bold bg-[#f0fdf4] text-[#16a34a] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        <LeafyGreen className="w-3 h-3 mr-0.5" /> Fresh
                                    </span>
                                )}
                            </h3>
                            <div className="flex gap-2 text-[13px] text-slate-500 mt-0.5">
                                <span className="font-telugu">{product.telugu}</span>
                                <span className="text-slate-300">•</span>
                                <span>{product.hindi}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2.5 flex items-end justify-between">
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-emerald-700 leading-none">
                                    ₹{product.price}
                                </span>
                                <span className="text-[13px] text-slate-500 font-medium">
                                    /{product.unit}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                                Min Order: {product.moq} {product.moq > 1 ? product.unit + "s" : product.unit}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-3 pb-3">
                <CartControls product={product} />
            </div>
        </motion.div>
    );
});
