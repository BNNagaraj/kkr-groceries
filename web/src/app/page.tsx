"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { useAppStore } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Search } from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "leafy", label: "Leafy & Herbs" },
  { id: "roots", label: "Roots, Tubers & Bulbs" },
  { id: "fruit_veg", label: "Fruit Vegetables" },
  { id: "gourds", label: "Gourds & Beans" },
  { id: "cruciferous", label: "Cruciferous & Others" },
  { id: "sweet", label: "Sweet Fruits" },
];

export default function Home() {
  const { products, loadingProducts } = useAppStore();
  const { theme } = useTheme();
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

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 mt-[90px]">
        {/* Controls: Search and Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="search"
              aria-label="Search vegetables"
              placeholder="Search vegetables in English/Telugu/Hindi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto w-full pb-2 no-scrollbar scroll-smooth" role="tablist" aria-label="Product categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={activeCategory === cat.id}
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
          <div
            className="theme-grid"
            style={{
              "--grid-cols": theme.grid.mobile,
              "--grid-cols-sm": theme.grid.tablet,
              "--grid-cols-lg": theme.grid.desktop,
              "--grid-cols-xl": theme.grid.wide,
            } as React.CSSProperties}
          >
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

      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
