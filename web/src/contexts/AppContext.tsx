"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveSlabPrice } from "@/lib/pricing";

export interface PriceTier {
    minQty: number;
    maxQty: number; // 0 = unlimited
    price: number;
}

export type ProductTier = "standard" | "economy";

export interface Product {
    id: number;
    name: string;
    telugu: string;
    hindi: string;
    price: number;
    unit: string;
    moq: number;
    category: string;
    image: string;
    isHidden?: boolean;
    hot?: boolean;
    fresh?: boolean;
    moqRequired?: boolean;
    priceTiers?: PriceTier[];
    sortOrder?: number;
    /** Product quality tier: "standard" (default/retail) or "economy" (HORECA only) */
    tier?: ProductTier;
    /** For economy (Restaurant/Hotel) copies: the id of the Regular product this was duplicated from. Used to keep the copy operation idempotent. */
    sourceId?: number;
}

interface CartItem extends Product {
    qty: number;
}

interface AppContextType {
    products: Product[];
    /** All products unfiltered — used by admin pages */
    allProducts: Product[];
    cart: Record<number, CartItem>;
    loadingProducts: boolean;
    addToCart: (product: Product, quantityChanged: number) => void;
    removeFromCart: (productId: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
    /** Current active tier for product display */
    activeTier: ProductTier;
    setActiveTier: (tier: ProductTier) => void;
}

const AppContext = createContext<AppContextType>({
    products: [],
    allProducts: [],
    cart: {},
    loadingProducts: true,
    addToCart: () => { },
    removeFromCart: () => { },
    clearCart: () => { },
    getCartTotal: () => 0,
    activeTier: "standard",
    setActiveTier: () => { },
});

export const useAppStore = () => useContext(AppContext);

const CART_STORAGE_KEY = "kkr-cart";

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [cart, setCart] = useState<Record<number, CartItem>>({});
    const [activeTier, setActiveTier] = useState<ProductTier>("standard");
    const cartLoaded = useRef(false);

    // Filter products by the active tier (default: "standard")
    // Products without a tier field are treated as "standard"
    const products = allProducts.filter((p) =>
        (p.tier || "standard") === activeTier
    );

    // Hydrate cart from localStorage after mount (avoids SSR mismatch)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(CART_STORAGE_KEY);
            if (stored) {
                setCart(JSON.parse(stored));
            }
        } catch {
            // localStorage unavailable
        }
        cartLoaded.current = true;
    }, []);

    // Persist cart to localStorage (skip until initial load completes)
    useEffect(() => {
        if (!cartLoaded.current) return;
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch {
            // localStorage full or unavailable
        }
    }, [cart]);

    useEffect(() => {
        // Listen to Firebase Products
        const q = query(collection(db, "products"), orderBy("id", "asc"));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const prods = snapshot.docs.map(
                    (doc) =>
                    ({
                        id: Number(doc.id),
                        ...doc.data(),
                    } as Product)
                );
                // Sort by custom sortOrder first, then fall back to id
                prods.sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
                setAllProducts(prods);
                setLoadingProducts(false);
            },
            (error) => {
                console.error("Failed to load products:", error);
                setLoadingProducts(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const addToCart = (product: Product, change: number) => {
        setCart((prev) => {
            const newCart = { ...prev };
            const currentQty = newCart[product.id]?.qty || 0;
            const newQty = currentQty + change;
            const moq = (product.moqRequired !== false && product.moq > 0) ? product.moq : 1;

            if (newQty <= 0) {
                delete newCart[product.id];
            } else if (newQty < moq) {
                // Below MOQ — remove from cart (user must add at least MOQ)
                delete newCart[product.id];
            } else {
                newCart[product.id] = { ...product, qty: newQty };
            }
            return newCart;
        });
    };

    const removeFromCart = (productId: number) => {
        setCart((prev) => {
            const newCart = { ...prev };
            delete newCart[productId];
            return newCart;
        });
    };

    const clearCart = () => {
        setCart({});
        try { localStorage.removeItem(CART_STORAGE_KEY); } catch { /* ignore */ }
    };

    const getCartTotal = () => {
        let total = 0;
        Object.values(cart).forEach((item) => {
            const effectivePrice = resolveSlabPrice(item.qty, item.price, item.priceTiers);
            total += effectivePrice * item.qty;
        });
        return total;
    };

    return (
        <AppContext.Provider
            value={{ products, allProducts, cart, loadingProducts, addToCart, removeFromCart, clearCart, getCartTotal, activeTier, setActiveTier }}
        >
            {children}
        </AppContext.Provider>
    );
}
