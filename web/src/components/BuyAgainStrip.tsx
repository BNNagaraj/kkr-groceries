"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { useAppStore, Product } from "@/contexts/AppContext";
import { RotateCcw, Plus, ShoppingBasket, Check } from "lucide-react";
import { toast } from "sonner";

interface RawItem {
  id?: string;
  name: string;
  qty: number;
}

interface ReorderItem {
  product: Product;
  qty: number;
}

/**
 * "Buy again" — surfaces the items from the buyer's most recent order for
 * one-tap re-adding. Repeat purchasing is the core wholesale behaviour, so this
 * removes the need to re-browse and re-add the same basket each time. Hidden
 * when signed out or when there's no reorderable history.
 */
export function BuyAgainStrip() {
  const { currentUser } = useAuth();
  const { col } = useMode();
  const { products, cart, addToCart } = useAppStore();
  const [rawCart, setRawCart] = useState<RawItem[] | null>(null);

  // Fetch the buyer's most recent order once (per user/mode).
  useEffect(() => {
    if (!currentUser) {
      setRawCart(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let items: RawItem[] = [];
        try {
          // Uses the existing composite index (userId ASC, createdAt DESC).
          const qy = query(
            collection(db, col("orders")),
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const snap = await getDocs(qy);
          if (!snap.empty) items = (snap.docs[0].data().cart as RawItem[]) || [];
        } catch {
          // Fallback if the index is unavailable — sort client-side.
          const snap = await getDocs(
            query(collection(db, col("orders")), where("userId", "==", currentUser.uid))
          );
          const docs = snap.docs.map((d) => d.data());
          docs.sort(
            (a, b) =>
              ((b.createdAt as { toMillis?: () => number })?.toMillis?.() || 0) -
              ((a.createdAt as { toMillis?: () => number })?.toMillis?.() || 0)
          );
          items = (docs[0]?.cart as RawItem[]) || [];
        }
        if (!cancelled) setRawCart(items);
      } catch {
        if (!cancelled) setRawCart([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, col]);

  // Map the past order back to current, still-listed products (for live pricing).
  const items = useMemo<ReorderItem[]>(() => {
    if (!rawCart || rawCart.length === 0) return [];
    const mapped: ReorderItem[] = [];
    for (const it of rawCart) {
      const p =
        products.find((pr) => String(pr.id) === String(it.id)) ||
        products.find((pr) => pr.name === it.name);
      if (p && !p.isHidden) mapped.push({ product: p, qty: it.qty || p.moq || 1 });
    }
    return mapped;
  }, [rawCart, products]);

  if (!currentUser || items.length === 0) return null;

  const addAll = () => {
    let added = 0;
    for (const { product, qty } of items) {
      if (!cart[product.id]) {
        addToCart(product, qty);
        added += 1;
      }
    }
    toast.success(added > 0 ? `Added ${added} item${added !== 1 ? "s" : ""} to cart.` : "All items already in your cart.");
  };

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--color-primary-dark)" }}>
          <RotateCcw className="w-4 h-4" /> Buy again
          <span className="text-xs font-normal text-slate-400">· from your last order</span>
        </h2>
        <button
          onClick={addAll}
          className="text-xs font-bold text-white rounded-full px-3 py-1.5 transition-all hover:brightness-110 active:scale-95"
          style={{ background: "var(--color-accent, #3A9B42)" }}
        >
          Add all
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
        {items.map(({ product, qty }) => {
          const inCart = !!cart[product.id];
          return (
            <div key={product.id} className="shrink-0 w-28 bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
              <div className="w-full h-16 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden mb-1.5">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={96}
                    height={64}
                    className="object-contain w-full h-full"
                    unoptimized={!product.image.includes("googleapis.com")}
                  />
                ) : (
                  <ShoppingBasket className="w-6 h-6 text-slate-300" />
                )}
              </div>
              <div className="text-[11px] font-semibold text-slate-700 truncate" title={product.name}>
                {product.name}
              </div>
              <div className="text-[10px] text-slate-400 mb-1.5">
                ₹{product.price}/{product.unit}
              </div>
              <button
                onClick={() => addToCart(product, qty)}
                disabled={inCart}
                className="w-full text-[11px] font-bold rounded-lg py-1 flex items-center justify-center gap-1 transition-all disabled:cursor-default"
                style={inCart ? { background: "#e2e8f0", color: "#475569" } : { background: "var(--color-accent, #3A9B42)", color: "white" }}
              >
                {inCart ? (
                  <>
                    <Check className="w-3 h-3" /> In cart
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" /> Add
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
