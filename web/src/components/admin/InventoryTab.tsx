"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { useMode } from "@/contexts/ModeContext";
import { useAppStore } from "@/contexts/AppContext";
import { Store } from "@/types/settings";
import { StoreInventoryItem, StockTransaction } from "@/types/inventory";
import { toast } from "sonner";
import Image from "next/image";
import {
  Warehouse,
  PackagePlus,
  ShoppingBag,
  ArrowRightLeft,
  AlertTriangle,
  Download,
  Loader2,
  Package,
  DollarSign,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const StockReceiptForm = dynamic(() => import("@/components/inventory/StockReceiptForm"), { ssr: false });
const QuickSaleDialog = dynamic(() => import("@/components/admin/QuickSaleDialog"), { ssr: false });
const StockTransferDialog = dynamic(() => import("@/components/admin/StockTransferDialog"), { ssr: false });
const InventoryAnalytics = dynamic(() => import("@/components/admin/InventoryAnalytics"), { ssr: false });

export default function InventoryTab() {
  const { col } = useMode();
  const { products } = useAppStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [inventory, setInventory] = useState<StoreInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStoreId, setFilterStoreId] = useState("all");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [view, setView] = useState<"grid" | "txns" | "analytics">("grid");

  // Build product lookup (by ID and name) for images and translations
  const productLookup = useMemo(() => {
    const byId = new Map<string, { image: string; telugu: string; hindi: string }>();
    const byName = new Map<string, { image: string; telugu: string; hindi: string }>();
    for (const p of products) {
      const info = { image: p.image || "", telugu: p.telugu || "", hindi: p.hindi || "" };
      byId.set(String(p.id), info);
      byName.set(p.name.toLowerCase(), info);
    }
    return { byId, byName };
  }, [products]);

  // Real-time listeners
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(collection(db, col("stores")), (snap) => {
        setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store)).filter((s) => s.isActive));
      }, (err) => console.error("[InventoryTab] Firestore listener error:", err))
    );

    unsubs.push(
      onSnapshot(collection(db, col("storeInventory")), (snap) => {
        setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventoryItem)));
        setLoading(false);
      }, (err) => console.error("[InventoryTab] Firestore listener error:", err))
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, col("stockTransactions")), orderBy("createdAt", "desc"), limit(500)),
        (snap) => {
          setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockTransaction)));
        },
        (err) => console.error("[InventoryTab] Firestore listener error:", err)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [col]);

  // Filtered inventory
  const filteredInv = useMemo(() => {
    if (filterStoreId === "all") return inventory;
    return inventory.filter((i) => i.storeId === filterStoreId);
  }, [inventory, filterStoreId]);

  // Summary stats
  const totalItems = filteredInv.reduce((s, i) => s + i.currentQty, 0);
  const totalValue = filteredInv.reduce((s, i) => s + i.currentQty * (i.costPrice || 0), 0);
  const lowStockItems = filteredInv.filter((i) => i.reorderLevel > 0 && i.currentQty <= i.reorderLevel);
  const uniqueProducts = new Set(filteredInv.map((i) => i.productId)).size;

  // Resolve product info (image, telugu, hindi) from product data
  const getProductInfo = (productId: string, productName: string) => {
    return (
      productLookup.byId.get(productId) ||
      productLookup.byName.get(productName.toLowerCase()) ||
      { image: "", telugu: "", hindi: "" }
    );
  };

  // Product-by-store grid data
  const gridData = useMemo(() => {
    const productMap = new Map<
      string,
      { productId: string; productName: string; image: string; telugu: string; hindi: string; stores: Map<string, number>; total: number }
    >();
    for (const inv of inventory) {
      if (!productMap.has(inv.productId)) {
        const info = getProductInfo(inv.productId, inv.productName);
        productMap.set(inv.productId, {
          productId: inv.productId,
          productName: inv.productName,
          image: info.image,
          telugu: info.telugu,
          hindi: info.hindi,
          stores: new Map(),
          total: 0,
        });
      }
      const entry = productMap.get(inv.productId)!;
      entry.stores.set(inv.storeId, inv.currentQty);
      entry.total += inv.currentQty;
    }
    return Array.from(productMap.values()).sort((a, b) => a.productName.localeCompare(b.productName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, productLookup]);

  // CSV Export
  const exportCSV = () => {
    const header = ["Product", "Telugu", "Hindi", ...stores.map((s) => s.name), "Total"];
    const rows = gridData.map((row) => [
      row.productName,
      row.telugu,
      row.hindi,
      ...stores.map((s) => String(row.stores.get(s.id) || 0)),
      String(row.total),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  // Filtered transactions
  const filteredTxns = useMemo(() => {
    if (filterStoreId === "all") return transactions;
    return transactions.filter((t) => t.storeId === filterStoreId);
  }, [transactions, filterStoreId]);

  const txnTypeColors: Record<string, string> = {
    receipt: "bg-emerald-100 text-emerald-700",
    sale: "bg-blue-100 text-blue-700",
    transfer_in: "bg-purple-100 text-purple-700",
    transfer_out: "bg-orange-100 text-orange-700",
    dispatch: "bg-amber-100 text-amber-700",
    adjustment: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Warehouse className="w-6 h-6 text-slate-400" /> Inventory Management
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setReceiptOpen(true)}>
            <PackagePlus className="w-4 h-4" /> Add Stock
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSaleOpen(true)}>
            <ShoppingBag className="w-4 h-4" /> Quick Sale
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-4 h-4" /> Transfer
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Package className="w-4 h-4" />
            <span className="text-xs font-semibold">Total Items</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalItems.toLocaleString("en-IN")}</div>
          <div className="text-[10px] text-slate-400">{uniqueProducts} unique products</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-semibold">Stock Value</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700">₹{totalValue.toLocaleString("en-IN")}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-semibold">Low Stock Alerts</span>
          </div>
          <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? "text-red-600" : "text-slate-800"}`}>
            {lowStockItems.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-semibold">Active Stores</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{stores.length}</div>
        </div>
      </div>

      {/* Store Filter + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterStoreId}
          onChange={(e) => setFilterStoreId(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg p-2"
        >
          <option value="all">All Stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === "grid" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            Inventory Grid
          </button>
          <button
            onClick={() => setView("txns")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === "txns" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            Transactions
          </button>
          <button
            onClick={() => setView("analytics")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${view === "analytics" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            <BarChart3 className="w-3 h-3" /> Analytics
          </button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
            <AlertTriangle className="w-4 h-4" /> Low Stock Alerts
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => {
              const info = getProductInfo(item.productId, item.productName);
              return (
                <span
                  key={item.id}
                  className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg flex items-center gap-1.5"
                >
                  {info.image && (
                    <Image src={info.image} alt="" width={16} height={16} className="rounded-sm object-cover" />
                  )}
                  {item.productName} @ {item.storeName}: {item.currentQty} {item.unit} (reorder: {item.reorderLevel})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading inventory...
        </div>
      ) : view === "grid" ? (
        /* Product-by-Store Grid */
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-3 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[220px]">
                  Product
                </th>
                {stores.map((s) => (
                  <th key={s.id} className="text-center p-3 font-semibold text-slate-600 whitespace-nowrap">
                    {s.name}
                  </th>
                ))}
                <th className="text-center p-3 font-semibold text-slate-800 bg-slate-100">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {gridData.length === 0 ? (
                <tr>
                  <td colSpan={stores.length + 2} className="text-center py-8 text-slate-400">
                    No inventory data yet. Add stock to get started.
                  </td>
                </tr>
              ) : (
                gridData.map((row) => (
                  <tr key={row.productId} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="p-2.5 sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2.5">
                        {/* Product Image */}
                        <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {row.image ? (
                            <Image
                              src={row.image}
                              alt={row.productName}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        {/* Name + Translations */}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-sm leading-tight truncate">
                            {row.productName}
                          </div>
                          {(row.telugu || row.hindi) && (
                            <div className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                              {row.telugu && <span className="text-emerald-600">{row.telugu}</span>}
                              {row.telugu && row.hindi && <span className="mx-1">·</span>}
                              {row.hindi && <span className="text-orange-500">{row.hindi}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {stores.map((s) => {
                      const qty = row.stores.get(s.id) || 0;
                      return (
                        <td
                          key={s.id}
                          className={`text-center p-3 ${
                            qty === 0 ? "text-slate-300" : qty < 10 ? "text-red-600 font-semibold" : "text-slate-700"
                          }`}
                        >
                          {qty}
                        </td>
                      );
                    })}
                    <td className="text-center p-3 font-bold text-slate-800 bg-slate-50">
                      {row.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : view === "analytics" ? (
        /* Analytics */
        <InventoryAnalytics stores={stores} inventory={inventory} transactions={transactions} />
      ) : (
        /* Transaction History */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredTxns.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No transactions yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTxns.map((txn) => {
                const txnInfo = getProductInfo(txn.productId, txn.productName);
                return (
                  <div key={txn.id} className="flex items-center gap-3 p-3">
                    {/* Product image in transactions too */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {txnInfo.image ? (
                        <Image
                          src={txnInfo.image}
                          alt={txn.productName}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${txnTypeColors[txn.type] || "bg-slate-100 text-slate-700"}`}>
                      {txn.type.replace("_", " ").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {txn.productName}
                        {(txnInfo.telugu || txnInfo.hindi) && (
                          <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                            {txnInfo.telugu && <span className="text-emerald-500">{txnInfo.telugu}</span>}
                            {txnInfo.telugu && txnInfo.hindi && " · "}
                            {txnInfo.hindi && <span className="text-orange-400">{txnInfo.hindi}</span>}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {txn.storeName}
                        {txn.buyerName && ` • Sold to: ${txn.buyerName}`}
                        {txn.counterpartStoreName && ` • ${txn.type === "transfer_in" ? "From" : "To"}: ${txn.counterpartStoreName}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${txn.type === "receipt" || txn.type === "transfer_in" ? "text-emerald-600" : "text-red-600"}`}>
                        {txn.type === "receipt" || txn.type === "transfer_in" ? "+" : "−"}{txn.qty} {txn.unit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {txn.createdByName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <StockReceiptForm open={receiptOpen} onClose={() => setReceiptOpen(false)} />
      <QuickSaleDialog open={saleOpen} onClose={() => setSaleOpen(false)} />
      <StockTransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  );
}
