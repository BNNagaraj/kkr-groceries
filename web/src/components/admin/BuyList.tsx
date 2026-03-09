"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Package,
  Scale,
  IndianRupee,
  LayoutGrid,
  Search,
  ImageIcon,
  Languages,
  FileDown,
  Copy,
  Printer,
  ChevronDown,
  ChevronRight,
  Check,
  Users,
  ShoppingBasket,
  ArrowUpDown,
  X,
} from "lucide-react";
import { Order, OrderStatus } from "@/types/order";
import { Product } from "@/contexts/AppContext";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { toast } from "sonner";

/* ─── Types ─── */

interface BuyListProps {
  orders: Order[];
  products: Product[];
  productImageMap: Record<string, string>;
}

interface CustomerDetail {
  customerName: string;
  shopName: string;
  orderId: string;
  qty: number;
  price: number;
}

interface AggregatedItem {
  name: string;
  totalQty: number;
  unit: string;
  avgPrice: number;
  estimatedCost: number;
  category: string;
  image: string;
  telugu: string;
  hindi: string;
  orderCount: number;
  customers: CustomerDetail[];
}

interface CategoryGroup {
  categoryId: string;
  categoryLabel: string;
  items: AggregatedItem[];
  subtotal: number;
}

type SortField = "name" | "qty" | "cost" | "orderCount" | "category";

const STATUS_OPTIONS: OrderStatus[] = ["Pending", "Accepted", "Shipped", "Fulfilled"];

const STATUS_COLORS: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-300",
  Accepted: "bg-blue-100 text-blue-800 border-blue-300",
  Shipped: "bg-purple-100 text-purple-800 border-purple-300",
  Fulfilled: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Rejected: "bg-red-100 text-red-800 border-red-300",
};

/* ─── Component ─── */

export default function BuyList({ orders, products, productImageMap }: BuyListProps) {
  // Filters
  const [includeStatuses, setIncludeStatuses] = useState<Set<OrderStatus>>(
    new Set(["Pending", "Accepted"])
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("category");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Display toggles
  const [showImages, setShowImages] = useState(true);
  const [showAltNames, setShowAltNames] = useState(false);

  // Collapse/expand state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [boughtItems, setBoughtItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Build product lookup for category matching
  const productLookup = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.name.toLowerCase().trim(), p));
    return map;
  }, [products]);

  // Aggregate items across filtered orders
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, AggregatedItem>();

    const filteredOrders = orders.filter((o) =>
      includeStatuses.has((o.status || "Pending") as OrderStatus)
    );

    for (const order of filteredOrders) {
      const cart = order.cart || [];
      for (const item of cart) {
        const key = (item.name || "").toLowerCase().trim();
        if (!key) continue;
        const product = productLookup.get(key);
        const existing = map.get(key);

        const customerDetail: CustomerDetail = {
          customerName: order.customerName || "Unknown",
          shopName: order.shopName || "",
          orderId: order.orderId || order.id,
          qty: item.qty,
          price: item.price,
        };

        if (existing) {
          existing.totalQty += item.qty;
          existing.estimatedCost += item.qty * item.price;
          existing.orderCount += 1;
          existing.customers.push(customerDetail);
        } else {
          map.set(key, {
            name: item.name,
            totalQty: item.qty,
            unit: item.unit || "Kg",
            avgPrice: item.price,
            estimatedCost: item.qty * item.price,
            category: product?.category || "uncategorized",
            image: item.image || productImageMap[key] || "",
            telugu: item.telugu || product?.telugu || "",
            hindi: item.hindi || product?.hindi || "",
            orderCount: 1,
            customers: [customerDetail],
          });
        }
      }
    }

    // Compute weighted average price
    map.forEach((item) => {
      if (item.totalQty > 0) {
        item.avgPrice = item.estimatedCost / item.totalQty;
      }
    });

    return Array.from(map.values());
  }, [orders, includeStatuses, productLookup, productImageMap]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return aggregatedItems;
    const q = searchQuery.toLowerCase().trim();
    return aggregatedItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.telugu?.toLowerCase().includes(q) ||
        item.hindi?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [aggregatedItems, searchQuery]);

  // Sort items
  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "qty":
          cmp = a.totalQty - b.totalQty;
          break;
        case "cost":
          cmp = a.estimatedCost - b.estimatedCost;
          break;
        case "orderCount":
          cmp = a.orderCount - b.orderCount;
          break;
        case "category":
          cmp = a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filteredItems, sortBy, sortDir]);

  // Group by category
  const categoryGroups = useMemo(() => {
    const catMap = new Map<string, AggregatedItem[]>();
    for (const item of sortedItems) {
      const cat = item.category;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(item);
    }

    // Build ordered groups
    const catLookup = new Map(PRODUCT_CATEGORIES.map((c) => [c.id, c.label]));
    const groups: CategoryGroup[] = [];

    // Add known categories in order
    for (const cat of PRODUCT_CATEGORIES) {
      const items = catMap.get(cat.id);
      if (items && items.length > 0) {
        groups.push({
          categoryId: cat.id,
          categoryLabel: cat.label,
          items,
          subtotal: items.reduce((s, i) => s + i.estimatedCost, 0),
        });
        catMap.delete(cat.id);
      }
    }

    // Add uncategorized / unknown categories at end
    catMap.forEach((items, catId) => {
      if (items.length > 0) {
        groups.push({
          categoryId: catId,
          categoryLabel: catLookup.get(catId) || "Other",
          items,
          subtotal: items.reduce((s, i) => s + i.estimatedCost, 0),
        });
      }
    });

    return groups;
  }, [sortedItems]);

  // Summary computations
  const summary = useMemo(() => {
    const unitMap = new Map<string, number>();
    let totalCost = 0;
    let boughtCount = 0;

    aggregatedItems.forEach((item) => {
      const unit = (item.unit || "Pcs").trim();
      unitMap.set(unit, (unitMap.get(unit) || 0) + item.totalQty);
      totalCost += item.estimatedCost;
      if (boughtItems.has(item.name.toLowerCase().trim())) boughtCount++;
    });

    const qtyBreakdown = Array.from(unitMap.entries())
      .map(([unit, qty]) => `${qty} ${unit}`)
      .join(", ");

    const orderCount = orders.filter((o) =>
      includeStatuses.has((o.status || "Pending") as OrderStatus)
    ).length;

    return {
      uniqueItems: aggregatedItems.length,
      qtyBreakdown: qtyBreakdown || "0",
      totalCost,
      categoryCount: categoryGroups.length,
      boughtCount,
      orderCount,
    };
  }, [aggregatedItems, categoryGroups, boughtItems, orders, includeStatuses]);

  // Toggle helpers
  const toggleStatus = (status: OrderStatus) => {
    setIncludeStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const toggleBought = (itemName: string) => {
    const key = itemName.toLowerCase().trim();
    setBoughtItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpanded = (itemName: string) => {
    const key = itemName.toLowerCase().trim();
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    const lines: string[] = [
      "KKR Groceries - Buy List",
      `Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
      `Status: ${Array.from(includeStatuses).join(", ")}`,
      `Orders: ${summary.orderCount}`,
      "",
    ];

    for (const group of categoryGroups) {
      lines.push(`${group.categoryLabel.toUpperCase()} (${group.items.length} items)`);
      group.items.forEach((item, i) => {
        const bought = boughtItems.has(item.name.toLowerCase().trim()) ? " ✓" : "";
        lines.push(`  ${i + 1}. ${item.name} - ${item.totalQty} ${item.unit}${bought}`);
      });
      lines.push("");
    }

    lines.push(`Total: ${summary.uniqueItems} items | Est. ₹${summary.totalCost.toLocaleString("en-IN")}`);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Buy list copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // PDF download (lazy-loaded)
  const handleDownloadPdf = async () => {
    try {
      const { downloadBuyListPdf } = await import("@/lib/buylist-pdf");
      downloadBuyListPdf(categoryGroups, summary, Array.from(includeStatuses));
      toast.success("PDF downloaded!");
    } catch (e) {
      console.error("PDF error:", e);
      toast.error("Failed to generate PDF");
    }
  };

  // Print
  const handlePrint = () => window.print();

  // Format currency
  const cur = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const curWhole = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  // Progress
  const progressPct = summary.uniqueItems > 0 ? Math.round((summary.boughtCount / summary.uniqueItems) * 100) : 0;

  /* ─── Empty State ─── */
  if (aggregatedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <ShoppingBasket className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg font-semibold">No items to procure</p>
        <p className="text-sm mt-1">
          {orders.length === 0
            ? "No orders loaded. Try changing the date filter above."
            : "No orders match the selected statuses. Try selecting Pending or Accepted."}
        </p>
        {/* Status chips even in empty state */}
        <div className="flex flex-wrap gap-2 mt-6">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                includeStatuses.has(s)
                  ? STATUS_COLORS[s]
                  : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              {includeStatuses.has(s) && <Check className="w-3 h-3 inline mr-1" />}
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-2">
      {/* ─── 1. Status Filter Chips ─── */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs font-medium text-slate-500 mr-1">Include:</span>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              includeStatuses.has(s)
                ? STATUS_COLORS[s]
                : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
            }`}
          >
            {includeStatuses.has(s) && <Check className="w-3 h-3 inline mr-1" />}
            {s}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-2">
          from {summary.orderCount} order{summary.orderCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ─── 2. Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Package className="w-5 h-5" />}
          label="Unique Items"
          value={String(summary.uniqueItems)}
          sub="products to procure"
          color="text-emerald-700"
          bg="bg-emerald-50"
        />
        <SummaryCard
          icon={<Scale className="w-5 h-5" />}
          label="Total Quantity"
          value={summary.qtyBreakdown}
          sub="across all units"
          color="text-blue-700"
          bg="bg-blue-50"
          small
        />
        <SummaryCard
          icon={<IndianRupee className="w-5 h-5" />}
          label="Estimated Cost"
          value={curWhole(summary.totalCost)}
          sub="procurement budget"
          color="text-amber-700"
          bg="bg-amber-50"
        />
        <SummaryCard
          icon={<LayoutGrid className="w-5 h-5" />}
          label="Categories"
          value={String(summary.categoryCount)}
          sub="product groups"
          color="text-purple-700"
          bg="bg-purple-50"
        />
      </div>

      {/* ─── 3. Toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Image toggle */}
        <button
          onClick={() => setShowImages(!showImages)}
          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
            showImages
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-white text-slate-500 border-slate-200"
          }`}
          title="Toggle product images"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Images</span>
        </button>

        {/* Alt names toggle */}
        <button
          onClick={() => setShowAltNames(!showAltNames)}
          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
            showAltNames
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-white text-slate-500 border-slate-200"
          }`}
          title="Toggle Telugu/Hindi names"
        >
          <Languages className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Names</span>
        </button>

        {/* Sort */}
        <select
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split("-") as [SortField, "asc" | "desc"];
            setSortBy(f);
            setSortDir(d);
          }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          <option value="category-asc">Sort: Category</option>
          <option value="name-asc">Sort: Name A-Z</option>
          <option value="name-desc">Sort: Name Z-A</option>
          <option value="qty-desc">Sort: Qty High-Low</option>
          <option value="qty-asc">Sort: Qty Low-High</option>
          <option value="cost-desc">Sort: Cost High-Low</option>
          <option value="cost-asc">Sort: Cost Low-High</option>
          <option value="orderCount-desc">Sort: Most Orders</option>
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <button
          onClick={handleDownloadPdf}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PDF</span>
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </button>
        <button
          onClick={handlePrint}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Print</span>
        </button>
      </div>

      {/* ─── 4. Category-Grouped Table ─── */}
      {categoryGroups.map((group) => {
        const isCollapsed = collapsedCategories.has(group.categoryId);
        return (
          <div key={group.categoryId} className="rounded-xl border border-slate-200 overflow-hidden print:break-inside-avoid">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(group.categoryId)}
              className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 hover:bg-emerald-100/80 transition-colors text-left print:bg-emerald-50"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-emerald-600" />
                )}
                <span className="font-bold text-sm text-emerald-900">{group.categoryLabel}</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-200/60 text-emerald-800 rounded-full">
                  {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-sm font-semibold text-emerald-700">
                {curWhole(group.subtotal)}
              </span>
            </button>

            {/* Items Table */}
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-emerald-600 bg-white text-left">
                      <th className="w-10 px-3 py-2 text-center print:hidden">
                        <Check className="w-3.5 h-3.5 text-slate-400 mx-auto" />
                      </th>
                      <th className="w-8 px-2 py-2 text-slate-500 font-semibold text-xs">#</th>
                      {showImages && <th className="w-12 px-2 py-2 text-slate-500 font-semibold text-xs print:hidden">Img</th>}
                      <th className="px-3 py-2 text-slate-500 font-semibold text-xs">
                        <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-slate-700">
                          Item {sortBy === "name" && <ArrowUpDown className="w-3 h-3" />}
                        </button>
                      </th>
                      <th className="w-20 px-3 py-2 text-slate-500 font-semibold text-xs text-right">
                        <button onClick={() => toggleSort("qty")} className="flex items-center gap-1 ml-auto hover:text-slate-700">
                          Qty {sortBy === "qty" && <ArrowUpDown className="w-3 h-3" />}
                        </button>
                      </th>
                      <th className="w-16 px-2 py-2 text-slate-500 font-semibold text-xs">Unit</th>
                      <th className="w-24 px-3 py-2 text-slate-500 font-semibold text-xs text-right">Avg Price</th>
                      <th className="w-24 px-3 py-2 text-slate-500 font-semibold text-xs text-right">
                        <button onClick={() => toggleSort("cost")} className="flex items-center gap-1 ml-auto hover:text-slate-700">
                          Est. Cost {sortBy === "cost" && <ArrowUpDown className="w-3 h-3" />}
                        </button>
                      </th>
                      <th className="w-20 px-3 py-2 text-slate-500 font-semibold text-xs text-center">
                        <button onClick={() => toggleSort("orderCount")} className="flex items-center gap-1 mx-auto hover:text-slate-700">
                          Orders {sortBy === "orderCount" && <ArrowUpDown className="w-3 h-3" />}
                        </button>
                      </th>
                      <th className="w-10 px-2 py-2 print:hidden" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, idx) => {
                      const key = item.name.toLowerCase().trim();
                      const isBought = boughtItems.has(key);
                      const isExpanded = expandedItems.has(key);

                      return (
                        <React.Fragment key={key}>
                          {/* Item Row */}
                          <tr
                            className={`border-b border-slate-100 transition-colors ${
                              isBought
                                ? "bg-emerald-50/50 line-through text-slate-400"
                                : idx % 2 === 0
                                ? "bg-white"
                                : "bg-slate-50/50"
                            } hover:bg-emerald-50/30`}
                          >
                            {/* Bought checkbox */}
                            <td className="px-3 py-2.5 text-center print:hidden">
                              <button
                                onClick={() => toggleBought(item.name)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                  isBought
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-slate-300 hover:border-emerald-400"
                                }`}
                              >
                                {isBought && <Check className="w-3 h-3" />}
                              </button>
                            </td>

                            {/* Index */}
                            <td className="px-2 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>

                            {/* Image */}
                            {showImages && (
                              <td className="px-2 py-2.5 print:hidden">
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  {item.image ? (
                                    <Image
                                      src={item.image}
                                      alt={item.name}
                                      width={36}
                                      height={36}
                                      className="object-cover w-full h-full"
                                      unoptimized={!item.image.includes("googleapis.com")}
                                    />
                                  ) : (
                                    <span className="text-xs font-bold text-slate-400">
                                      {item.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Item Name */}
                            <td className="px-3 py-2.5">
                              <div className={`font-semibold text-sm ${isBought ? "text-slate-400" : "text-slate-800"}`}>
                                {item.name}
                              </div>
                              {showAltNames && (item.telugu || item.hindi) && (
                                <div className="text-xs text-slate-400 italic mt-0.5">
                                  {[item.telugu, item.hindi].filter(Boolean).join(" / ")}
                                </div>
                              )}
                            </td>

                            {/* Qty */}
                            <td className="px-3 py-2.5 text-right">
                              <span className={`font-bold text-sm ${isBought ? "text-slate-400" : "text-slate-900"}`}>
                                {item.totalQty}
                              </span>
                            </td>

                            {/* Unit */}
                            <td className="px-2 py-2.5 text-xs text-slate-500">{item.unit}</td>

                            {/* Avg Price */}
                            <td className="px-3 py-2.5 text-right text-xs text-slate-600">
                              {cur(item.avgPrice)}
                            </td>

                            {/* Est. Cost */}
                            <td className="px-3 py-2.5 text-right">
                              <span className={`font-semibold text-sm ${isBought ? "text-slate-400" : "text-emerald-700"}`}>
                                {cur(item.estimatedCost)}
                              </span>
                            </td>

                            {/* Order count */}
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                {item.orderCount}
                              </span>
                            </td>

                            {/* Expand */}
                            <td className="px-2 py-2.5 print:hidden">
                              <button
                                onClick={() => toggleExpanded(item.name)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Show customer details"
                              >
                                <Users className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>

                          {/* Customer Breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={showImages ? 10 : 9} className="p-0">
                                <div className="bg-slate-50 border-l-4 border-emerald-300 mx-2 mb-2 rounded-lg overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-left">
                                        <th className="px-4 py-2 text-slate-500 font-semibold">Customer</th>
                                        <th className="px-3 py-2 text-slate-500 font-semibold">Shop</th>
                                        <th className="px-3 py-2 text-slate-500 font-semibold">Order ID</th>
                                        <th className="px-3 py-2 text-slate-500 font-semibold text-right">Qty</th>
                                        <th className="px-3 py-2 text-slate-500 font-semibold text-right">Price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.customers.map((c, ci) => (
                                        <tr key={ci} className="border-b border-slate-100 last:border-0">
                                          <td className="px-4 py-1.5 text-slate-700 font-medium">{c.customerName}</td>
                                          <td className="px-3 py-1.5 text-slate-500">{c.shopName || "—"}</td>
                                          <td className="px-3 py-1.5 text-slate-400 font-mono">
                                            {(c.orderId || "").slice(-8)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-slate-700 font-semibold">{c.qty}</td>
                                          <td className="px-3 py-1.5 text-right text-slate-600">{cur(c.price)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* ─── 5. Grand Total Footer ─── */}
      <div className="bg-emerald-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:bg-emerald-900">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-emerald-300 font-medium">Procurement Progress</div>
            <div className="text-lg font-bold">
              {summary.boughtCount} / {summary.uniqueItems} items
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-32 h-2 bg-emerald-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm text-emerald-300 font-semibold">{progressPct}%</span>
        </div>

        <div className="text-right">
          <div className="text-xs text-emerald-300 font-medium">Grand Total</div>
          <div className="text-2xl font-extrabold">{curWhole(summary.totalCost)}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary Card Sub-Component ─── */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
  bg,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 print:border print:shadow-none">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bg}`}>
          <div className={color}>{icon}</div>
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className={`${color} font-extrabold ${small ? "text-lg" : "text-2xl"} leading-tight`}>
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
