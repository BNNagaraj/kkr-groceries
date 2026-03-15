"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { useMode } from "@/contexts/ModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Store } from "@/types/settings";
import { StoreInventoryItem, StockTransaction } from "@/types/inventory";
import {
  Warehouse,
  Package,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Loader2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const AgentSaleDialog = dynamic(() => import("@/components/agent/AgentSaleDialog"), { ssr: false });

export default function AgentDashboard() {
  const { col } = useMode();
  const { agentStoreId } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<StoreInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleOpen, setSaleOpen] = useState(false);
  const [view, setView] = useState<"inventory" | "history">("inventory");

  // Load store info
  useEffect(() => {
    if (!agentStoreId) return;
    getDoc(doc(db, col("stores"), agentStoreId)).then((snap) => {
      if (snap.exists()) setStore({ id: snap.id, ...snap.data() } as Store);
    });
  }, [agentStoreId, col]);

  // Real-time inventory
  useEffect(() => {
    if (!agentStoreId) { setLoading(false); return; }
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, col("storeInventory")), where("storeId", "==", agentStoreId)),
        (snap) => {
          setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventoryItem)));
          setLoading(false);
        },
        (err) => console.error("[AgentDashboard] Firestore listener error:", err)
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, col("stockTransactions")),
          where("storeId", "==", agentStoreId),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snap) => {
          setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockTransaction)));
        },
        (err) => console.error("[AgentDashboard] Firestore listener error:", err)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [agentStoreId, col]);

  const totalItems = inventory.reduce((s, i) => s + i.currentQty, 0);
  const totalValue = inventory.reduce((s, i) => s + i.currentQty * (i.costPrice || 0), 0);
  const lowStockItems = inventory.filter((i) => i.reorderLevel > 0 && i.currentQty <= i.reorderLevel);

  const statusBadge = (item: StoreInventoryItem) => {
    if (item.currentQty === 0) return <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Out of Stock</span>;
    if (item.reorderLevel > 0 && item.currentQty <= item.reorderLevel) return <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Low Stock</span>;
    return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">OK</span>;
  };

  const txnTypeColors: Record<string, string> = {
    receipt: "bg-emerald-100 text-emerald-700",
    sale: "bg-blue-100 text-blue-700",
    transfer_in: "bg-purple-100 text-purple-700",
    transfer_out: "bg-orange-100 text-orange-700",
    dispatch: "bg-amber-100 text-amber-700",
    adjustment: "bg-slate-100 text-slate-700",
  };

  if (!agentStoreId) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Warehouse className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-semibold text-lg">No Store Assigned</p>
        <p className="text-sm mt-1">Contact admin to assign you to a store.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Store Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{store?.name || "Loading..."}</h2>
            <p className="text-orange-100 text-sm">{store?.address || ""}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <Package className="w-5 h-5 mx-auto text-slate-400 mb-1" />
          <div className="text-xl font-bold text-slate-800">{totalItems}</div>
          <div className="text-[10px] text-slate-400">Total Items</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <DollarSign className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
          <div className="text-xl font-bold text-emerald-700">₹{totalValue.toLocaleString("en-IN")}</div>
          <div className="text-[10px] text-slate-400">Stock Value</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <TrendingDown className="w-5 h-5 mx-auto text-red-500 mb-1" />
          <div className={`text-xl font-bold ${lowStockItems.length > 0 ? "text-red-600" : "text-slate-800"}`}>
            {lowStockItems.length}
          </div>
          <div className="text-[10px] text-slate-400">Low Stock</div>
        </div>
      </div>

      {/* Actions + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setView("inventory")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "inventory" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            <Package className="w-3 h-3 inline mr-1" /> Inventory
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "history" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
          >
            <History className="w-3 h-3 inline mr-1" /> History
          </button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200" onClick={() => setSaleOpen(true)}>
            <ShoppingBag className="w-4 h-4" /> Record Sale
          </Button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-1">
            <AlertTriangle className="w-4 h-4" /> Low Stock!
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lowStockItems.map((item) => (
              <span key={item.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">
                {item.productName}: {item.currentQty} {item.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading inventory...
        </div>
      ) : view === "inventory" ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {inventory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-medium">No inventory yet</p>
              <p className="text-xs mt-1">Use &quot;Add Stock&quot; to add products to your store.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left p-3 font-semibold text-slate-600">Product</th>
                  <th className="text-center p-3 font-semibold text-slate-600">Qty</th>
                  <th className="text-center p-3 font-semibold text-slate-600">Unit</th>
                  <th className="text-center p-3 font-semibold text-slate-600">Reorder</th>
                  <th className="text-center p-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...inventory].sort((a, b) => a.productName.localeCompare(b.productName)).map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{item.productName}</td>
                    <td className={`text-center p-3 font-bold ${item.currentQty === 0 ? "text-red-600" : "text-slate-800"}`}>
                      {item.currentQty}
                    </td>
                    <td className="text-center p-3 text-slate-500">{item.unit}</td>
                    <td className="text-center p-3 text-slate-400">{item.reorderLevel || "—"}</td>
                    <td className="text-center p-3">{statusBadge(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 p-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${txnTypeColors[txn.type] || "bg-slate-100 text-slate-700"}`}>
                    {txn.type.replace("_", " ").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{txn.productName}</div>
                    <div className="text-[10px] text-slate-400">
                      {txn.buyerName && `Sold to: ${txn.buyerName}`}
                      {txn.supplier && `Supplier: ${txn.supplier}`}
                      {txn.notes && ` • ${txn.notes}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${txn.type === "receipt" || txn.type === "transfer_in" ? "text-emerald-600" : "text-red-600"}`}>
                      {txn.type === "receipt" || txn.type === "transfer_in" ? "+" : "−"}{txn.qty} {txn.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AgentSaleDialog
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        storeName={store?.name}
      />
    </div>
  );
}
