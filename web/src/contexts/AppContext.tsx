"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
}

interface CartItem extends Product {
    qty: number;
}

interface AppContextType {
    products: Product[];
    cart: Record<number, CartItem>;
    loadingProducts: boolean;
    addToCart: (product: Product, quantityChanged: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
}

const AppContext = createContext<AppContextType>({
    products: [],
    cart: {},
    loadingProducts: true,
    addToCart: () => { },
    clearCart: () => { },
    getCartTotal: () => 0,
});

export const useAppStore = () => useContext(AppContext);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [cart, setCart] = useState<Record<number, CartItem>>({});

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
                setProducts(prods);
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

            if (newQty <= 0) {
                delete newCart[product.id];
            } else {
                newCart[product.id] = { ...product, qty: newQty };
            }
            return newCart;
        });
    };

    const clearCart = () => setCart({});

    const getCartTotal = () => {
        let total = 0;
        Object.values(cart).forEach((item) => {
            total += item.price * item.qty;
        });
        return total;
    };

    return (
        <AppContext.Provider
            value={{ products, cart, loadingProducts, addToCart, clearCart, getCartTotal }}
        >
            {children}
        </AppContext.Provider>
    );
}
