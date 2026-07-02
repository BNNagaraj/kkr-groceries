"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { BuyAgainStrip } from "@/components/BuyAgainStrip";
import { RequestItemCard } from "@/components/RequestItemCard";
import { Footer } from "@/components/Footer";
import { useAppStore } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Search, ShoppingBasket, Truck, Clock, Shield, UtensilsCrossed, Star, ArrowUpDown } from "lucide-react";
import { CATEGORY_GROUPS, getGroupForCategory } from "@/lib/constants";
import { useBusiness } from "@/contexts/BusinessContext";

const CartDrawer = dynamic(() => import("@/components/CartDrawer").then(m => m.CartDrawer), {
  ssr: false,
});
const InstallBanner = dynamic(() => import("@/components/InstallBanner").then(m => m.InstallBanner), {
  ssr: false,
});

const GROUP_TABS = [
  { id: "all", label: "All" },
  ...CATEGORY_GROUPS.map((g) => ({ id: g.id, label: g.label })),
];

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export default function Home() {
  const { products, loadingProducts, activeTier, setActiveTier } = useAppStore();
  const { theme } = useTheme();
  const { biz } = useBusiness();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("vegetables");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("featured");

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

  const filteredProducts = useMemo(() => products.filter((p) => {
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
  }), [products, activeGroup, activeCategory, searchQuery]);

  // Buyer-facing sort. "featured" preserves the admin-curated sortOrder.
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case "price-asc":
        return list.sort((a, b) => a.price - b.price);
      case "price-desc":
        return list.sort((a, b) => b.price - a.price);
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [filteredProducts, sortBy]);

  return (
    <div className="min-h-screen pb-20">
      <Header onOpenCart={() => setCartOpen(true)} />

      {/* ── Hero Banner ── */}
      <section
        className="mt-[70px] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
      >
        <div className="max-w-[1400px] mx-auto px-4 py-6 sm:py-8 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Brand logo — prominent in the banner */}
            <img
              src={biz.logoUrl || "/icon-192.png"}
              alt={biz.storeName || "KKR Groceries"}
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl shadow-lg object-contain bg-white/10 p-1.5"
            />
            <div>
              <h1 className="text-white text-xl sm:text-2xl font-extrabold tracking-tight">
                {biz.storeName || "KKR Groceries"}
              </h1>
              <p className="text-white/70 text-sm sm:text-base mt-0.5 max-w-md">
                Fresh vegetables &amp; groceries at wholesale prices — delivered to your doorstep
              </p>
              <div className="flex items-center gap-4 sm:gap-6 mt-2.5">
                <div className="flex items-center gap-1.5 text-white/80 text-xs sm:text-sm">
                  <Truck className="w-3.5 h-3.5" /> <span>Same-day delivery</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/80 text-xs sm:text-sm">
                  <Clock className="w-3.5 h-3.5" /> <span>Order by 10 PM</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-white/80 text-xs sm:text-sm">
                  <Shield className="w-3.5 h-3.5" /> <span>APMC rates</span>
                </div>
              </div>
            </div>
          </div>
          <ShoppingBasket className="w-20 h-20 sm:w-28 sm:h-28 text-white/[0.07] absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block" />
        </div>
        {/* Decorative wave */}
        <svg className="absolute bottom-0 left-0 w-full h-4 sm:h-6" viewBox="0 0 1440 24" fill="none" preserveAspectRatio="none">
          <path d="M0 24V8C240 0 480 0 720 8C960 16 1200 16 1440 8V24H0Z" fill="var(--theme-page-bg, #fef8f0)" />
        </svg>
      </section>

      {/* Restaurant/Hotel pricing context strip — shown only in economy mode */}
      {activeTier === "economy" && (
        <div className="bg-purple-600 text-white">
          <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <UtensilsCrossed className="w-4 h-4 shrink-0" />
              <p className="text-sm font-semibold truncate">
                Restaurant / Hotel pricing
                <span className="hidden sm:inline font-normal text-purple-100"> — wholesale rates for bulk buyers</span>
              </p>
            </div>
            <button
              onClick={() => setActiveTier("standard")}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-bold bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-full"
            >
              <Star className="w-3 h-3" /> Switch to Regular
            </button>
          </div>
        </div>
      )}

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 mt-4">
        {/* Buy again — quick reorder from the buyer's last order */}
        <BuyAgainStrip />

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
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 shadow-sm"
                style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
              />
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="appearance-none w-full md:w-auto pl-9 pr-8 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 shadow-sm cursor-pointer"
                style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name: A–Z</option>
              </select>
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
                      ? "text-white shadow-md"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                  style={activeGroup === g.id ? { background: "var(--color-primary-dark)", boxShadow: "0 4px 6px -1px color-mix(in srgb, var(--color-primary-dark) 30%, transparent)" } : undefined}
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
                      ? "text-white shadow-md"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                  style={activeCategory === cat.id
                    ? { background: "var(--color-primary)", boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 40%, transparent)" }
                    : undefined
                  }
                  onMouseEnter={(e) => { if (activeCategory !== cat.id) { e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-primary) 8%, white)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-primary) 30%, white)"; } }}
                  onMouseLeave={(e) => { if (activeCategory !== cat.id) { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = ""; } }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product count & Grid */}
        {!loadingProducts && sortedProducts.length > 0 && (
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-sm font-medium" style={{ color: "var(--color-primary-dark)" }}>
              Showing <span className="font-bold">{sortedProducts.length}</span> product{sortedProducts.length !== 1 ? "s" : ""}
              {activeCategory !== "all" && activeGroup !== "all" ? ` in ${subCategories.find(c => c.id === activeCategory)?.label || ""}` : activeGroup !== "all" ? ` in ${GROUP_TABS.find(g => g.id === activeGroup)?.label || ""}` : ""}
            </p>
            {activeTier === "economy" && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">
                <UtensilsCrossed className="w-3 h-3" /> Restaurant / Hotel
              </span>
            )}
          </div>
        )}
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
                className="rounded-2xl overflow-hidden shadow-sm"
                style={{ background: "color-mix(in srgb, var(--color-primary) 4%, white)", border: "1px solid color-mix(in srgb, var(--color-primary) 12%, white)" }}
              >
                <div className="h-10 animate-pulse" style={{ background: "color-mix(in srgb, var(--color-primary) 20%, white)" }} />
                <div className="flex">
                  <div className="w-32 h-28 animate-pulse shrink-0" style={{ background: "color-mix(in srgb, var(--color-primary) 10%, white)" }} />
                  <div className="flex-1 p-3 space-y-2">
                    <div className="h-4 rounded animate-pulse w-3/4" style={{ background: "color-mix(in srgb, var(--color-primary) 12%, white)" }} />
                    <div className="h-3 rounded animate-pulse w-1/2" style={{ background: "color-mix(in srgb, var(--color-primary) 8%, white)" }} />
                    <div className="h-8 rounded animate-pulse mt-3" style={{ background: "color-mix(in srgb, var(--color-primary) 8%, white)" }} />
                    <div className="h-9 rounded-xl animate-pulse mt-3" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, white)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedProducts.length > 0 ? (
          <div
            className="theme-grid"
            style={{
              "--grid-cols": theme.grid.mobile,
              "--grid-cols-sm": theme.grid.tablet,
              "--grid-cols-lg": theme.grid.desktop,
              "--grid-cols-xl": theme.grid.wide,
            } as React.CSSProperties}
          >
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-6xl mb-4">🧺</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products available yet</h3>
            <p className="text-slate-500">Our catalog is being updated — please check back soon.</p>
          </div>
        ) : (
          <div className="text-center py-20 px-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products found</h3>
            <p className="text-slate-500">Try adjusting your search or category filter.</p>
            {/* Demand capture: let the buyer request the item we don't stock */}
            <RequestItemCard initialItem={searchQuery.trim()} />
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <InstallBanner />
    </div>
  );
}
