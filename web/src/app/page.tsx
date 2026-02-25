"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { useAppStore } from "@/contexts/AppContext";
import { Search } from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "daily", label: "Daily Needs" },
  { id: "rotate", label: "Rotational" },
  { id: "regional", label: "Regional" },
];

export default function Home() {
  const { products, loadingProducts } = useAppStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter((p) => {
    if (p.isHidden) return false;

    // Category Filter
    if (activeCategory !== "all" && p.category !== activeCategory) {
      return false;
    }

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        p.name.toLowerCase().includes(q) ||
        p.telugu.includes(q) ||
        p.hindi.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen pb-20">
      <Header onOpenCart={() => setCartOpen(true)} />

      <main className="max-w-[1400px] mx-auto px-4 mt-[90px]">
        {/* Market Status Banner */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div>
            <div className="text-emerald-800 font-bold mb-1 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Live APMC Prices Active
            </div>
            <div className="text-emerald-700/80 text-sm font-medium">Bowenpally Market Yard rates synced today at 06:00 AM</div>
          </div>
          <p className="text-xs bg-white text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-100 font-bold shadow-sm whitespace-nowrap">
            Minimum Order Value: ₹500
          </p>
        </div>

        {/* Controls: Search and Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vegetables in English/Telugu/Hindi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto w-full pb-2 no-scrollbar scroll-smooth">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all ${activeCategory === cat.id
                    ? "bg-[#064e3b] text-white shadow-md shadow-emerald-900/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {loadingProducts ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#064e3b] mb-4"></div>
            Loading APMC Prices...
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No vegetables found</h3>
            <p className="text-slate-500">Try adjusting your search or category filter.</p>
          </div>
        )}
      </main>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
