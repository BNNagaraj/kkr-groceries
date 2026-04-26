"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { useAppStore } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Search } from "lucide-react";
import { CATEGORY_GROUPS, getGroupForCategory } from "@/lib/constants";

const CartDrawer = dynamic(() => import("@/components/CartDrawer").then(m => m.CartDrawer), {
  ssr: false,
});

const GROUP_TABS = [
  { id: "all", label: "All" },
  ...CATEGORY_GROUPS.map((g) => ({ id: g.id, label: g.label })),
];

export default function Home() {
  const { products, loadingProducts } = useAppStore();
  const { theme } = useTheme();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("vegetables");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sub-categories shown beneath the active group tab
  const subCategories = useMemo(() => {
    if (activeGroup === "all") {
      return [{ id: "all", label: "All Items" }];
    }
    const group = CATEGORY_GROUPS.find((g) => g.id === activeGroup);
    if (!group) return [{ id: "all", label: "All Items" }];
    return [{ id: "all", label: `All ${group.label}` }, ...group.categories];
  }, [activeGroup]);

  const handleGroupChange = (groupId: string) => {
    setActiveGroup(groupId);
    // Reset sub-category when switching groups so the user sees everything in the group
    setActiveCategory("all");
  };

  const filteredProducts = products.filter((p) => {
    if (p.isHidden) return false;

    // Group filter (top tab)
    if (activeGroup !== "all" && getGroupForCategory(p.category) !== activeGroup) {
      return false;
    }

    // Sub-category filter (chip under the group)
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
        {/* Controls: Search, Group Tabs, Sub-category Chips */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative w-full md:w-96 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search in English/Telugu/Hindi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>

            {/* Top-level group tabs */}
            <div
              className="flex gap-2 overflow-x-auto w-full pb-1 no-scrollbar scroll-smooth scroll-fade-right"
              role="tablist"
              aria-label="Product groups"
            >
              {GROUP_TABS.map((g) => (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={activeGroup === g.id}
                  onClick={() => handleGroupChange(g.id)}
                  className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    activeGroup === g.id
                      ? "bg-[#064e3b] text-white shadow-md shadow-emerald-900/20"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-category chips — only when a specific group is active */}
          {activeGroup !== "all" && subCategories.length > 1 && (
            <div
              className="flex gap-2 overflow-x-auto w-full pb-1 no-scrollbar scroll-smooth scroll-fade-right"
              role="tablist"
              aria-label="Sub-categories"
            >
              {subCategories.map((cat) => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        {loadingProducts ? (
          <div
            className="theme-grid"
            style={{
              "--grid-cols": theme.grid.mobile,
              "--grid-cols-sm": theme.grid.tablet,
              "--grid-cols-lg": theme.grid.desktop,
              "--grid-cols-xl": theme.grid.wide,
            } as React.CSSProperties}
            aria-busy="true"
            aria-label="Loading products"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm"
              >
                <div className="flex">
                  <div className="w-32 h-32 bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 p-3 space-y-2">
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                    <div className="h-8 bg-slate-100 rounded animate-pulse mt-3" />
                    <div className="h-9 bg-slate-100 rounded-xl animate-pulse mt-3" />
                  </div>
                </div>
              </div>
            ))}
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
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products found</h3>
            <p className="text-slate-500">Try adjusting your search or category filter.</p>
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
