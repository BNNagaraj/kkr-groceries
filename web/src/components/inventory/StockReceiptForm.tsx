"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, functions } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { useAppStore } from "@/contexts/AppContext";
import { Store } from "@/types/settings";
import { StockPurchase } from "@/types/stock";
import { StockTransaction } from "@/types/inventory";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/helpers";
import {
  PackagePlus,
  Loader2,
  Search,
  AlertTriangle,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface StockReceiptFormProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected store ID (for agents) */
  fixedStoreId?: string;
  /** Pre-resolved store name (for agents, avoids extra lookup) */
  fixedStoreName?: string;
}

interface BoughtSummary {
  totalBought: number;
  totalAllocated: number;
  remaining: number;
  purchases: StockPurchase[];
}

export default function StockReceiptForm({
  open,
  onClose,
  fixedStoreId,
  fixedStoreName,
}: StockReceiptFormProps) {
  const { col } = useMode();
  const { products } = useAppStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState(fixedStoreId || "");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Bought stock tracking
  const [boughtSummary, setBoughtSummary] = useState<BoughtSummary | null>(null);
  const [loadingBought, setLoadingBought] = useState(false);

  useEffect(() => {
    if (fixedStoreId) return;
    const unsub = onSnapshot(
      collection(db, col("stores")),
      (snap) => {
        setStores(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Store)
            .filter((s) => s.isActive)
        );
      },
      (err) => console.error("[StockReceiptForm] Firestore listener error:", err)
    );
    return unsub;
  }, [col, fixedStoreId]);

  useEffect(() => {
    if (fixedStoreId) setStoreId(fixedStoreId);
  }, [fixedStoreId]);

  // When a product is selected, fetch bought qty vs already-allocated qty
  useEffect(() => {
    if (!selectedProductId || !open) {
      setBoughtSummary(null);
      return;
    }

    let cancelled = false;
    setLoadingBought(true);

    async function fetchBoughtData() {
      try {
        // 1. Get all purchases for this product (last 30 days)
        const cutoff = Timestamp.fromDate(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        const purchasesQuery = query(
          collection(db, col("stockPurchases")),
          where("productId", "==", Number(selectedProductId)),
          where("purchaseDate", ">=", cutoff)
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        const purchases = purchasesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as StockPurchase
        );

        // Also try matching by name (in case productId wasn't set)
        const selectedProduct = products.find(
          (p) => String(p.id) === selectedProductId
        );
        let nameMatchPurchases: StockPurchase[] = [];
        if (selectedProduct) {
          const nameQuery = query(
            collection(db, col("stockPurchases")),
            where("productName", "==", selectedProduct.name),
            where("purchaseDate", ">=", cutoff)
          );
          const nameSnap = await getDocs(nameQuery);
          nameMatchPurchases = nameSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as StockPurchase)
            .filter((p) => !purchases.some((ep) => ep.id === p.id)); // dedupe
        }

        const allPurchases = [...purchases, ...nameMatchPurchases];
        const totalBought = allPurchases.reduce((sum, p) => sum + (p.qty || 0), 0);

        // 2. Get total already allocated (receipt transactions for this product in last 30 days)
        const receiptsQuery = query(
          collection(db, col("stockTransactions")),
          where("productId", "==", selectedProductId),
          where("type", "==", "receipt"),
          where("createdAt", ">=", cutoff)
        );
        const receiptsSnap = await getDocs(receiptsQuery);
        const totalAllocated = receiptsSnap.docs.reduce(
          (sum, d) => sum + (d.data().qty || 0),
          0
        );

        if (!cancelled) {
          setBoughtSummary({
            totalBought,
            totalAllocated,
            remaining: totalBought - totalAllocated,
            purchases: allPurchases,
          });
        }
      } catch (err) {
        console.error("[StockReceiptForm] Failed to fetch bought data:", err);
        if (!cancelled) setBoughtSummary(null);
      } finally {
        if (!cancelled) setLoadingBought(false);
      }
    }

    fetchBoughtData();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId, open, col, products]);

  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.telugu?.toLowerCase().includes(q) ||
      p.hindi?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  const selectedProduct = products.find(
    (p) => String(p.id) === selectedProductId
  );

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find((p) => String(p.id) === id);
    if (prod) {
      setUnit(prod.unit || "kg");
    }
  };

  // Check if qty exceeds remaining bought stock
  const qtyNum = Number(qty) || 0;
  const exceedsBought =
    boughtSummary !== null &&
    boughtSummary.totalBought > 0 &&
    qtyNum > boughtSummary.remaining;
  const noPurchaseRecord =
    boughtSummary !== null && boughtSummary.totalBought === 0;

  const handleSubmit = async () => {
    if (!storeId) {
      toast.error("Select a store.");
      return;
    }
    if (!selectedProductId || !selectedProduct) {
      toast.error("Select a product.");
      return;
    }
    if (!qty || Number(qty) <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    // Hard block: cannot exceed bought stock
    if (exceedsBought) {
      toast.error(
        `Cannot add ${qty} ${unit}. Only ${boughtSummary!.remaining} ${unit} remains unallocated from purchases. Record more purchases in "Buying Stock" first.`
      );
      return;
    }

    // Hard block: must have a purchase record
    if (noPurchaseRecord) {
      toast.error(
        `No purchase record found for "${selectedProduct.name}" in the last 30 days. Record the purchase in "Buying Stock" tab first.`
      );
      return;
    }

    // Hard block: remaining is zero or negative
    if (boughtSummary && boughtSummary.remaining <= 0) {
      toast.error(
        `All bought stock for "${selectedProduct.name}" has been fully allocated. Buy more first.`
      );
      return;
    }

    const store =
      fixedStoreId && fixedStoreName
        ? { name: fixedStoreName }
        : stores.find((s) => s.id === storeId) || { name: "" };

    setSaving(true);
    try {
      const recordTxn = httpsCallable(functions, "recordStockTransaction");
      await recordTxn({
        storeId,
        storeName: (store as Store).name || "",
        productId: selectedProductId,
        productName: selectedProduct.name,
        type: "receipt",
        qty: Number(qty),
        unit: unit || selectedProduct.unit,
        costPrice: costPrice ? Number(costPrice) : null,
        supplier: supplier || null,
        notes: notes || null,
      });
      toast.success(
        `Added ${qty} ${unit} of ${selectedProduct.name} to inventory.`
      );
      // Reset form
      setSelectedProductId("");
      setProductSearch("");
      setQty("");
      setCostPrice("");
      setSupplier("");
      setNotes("");
      setBoughtSummary(null);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[StockReceiptForm] Failed:", e);
      toast.error("Failed to record stock.", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-600" />
            Add Stock (Receipt)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Store selector */}
          {!fixedStoreId && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Store *
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2"
              >
                <option value="">Select store...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Product search & select */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Product *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
            {productSearch && !selectedProductId && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg mt-1">
                {filteredProducts.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      handleSelectProduct(String(p.id));
                      setProductSearch(p.name);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    {p.name}{" "}
                    <span className="text-slate-400 text-xs">({p.unit})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="mt-1 text-xs text-emerald-600">
                Selected: {selectedProduct.name} ({selectedProduct.unit})
              </div>
            )}
          </div>

          {/* Bought Stock Info Banner */}
          {selectedProductId && (
            <div
              className={`rounded-xl p-3 border text-sm ${
                loadingBought
                  ? "bg-slate-50 border-slate-200"
                  : noPurchaseRecord
                    ? "bg-amber-50 border-amber-200"
                    : boughtSummary && boughtSummary.remaining <= 0
                      ? "bg-red-50 border-red-200"
                      : "bg-emerald-50 border-emerald-200"
              }`}
            >
              {loadingBought ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking purchase records...
                </div>
              ) : noPurchaseRecord ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-amber-800">
                      No purchase record found
                    </div>
                    <div className="text-xs text-amber-600 mt-0.5">
                      No buying stock entry for this product in the last 30
                      days. Record the purchase in &quot;Buying Stock&quot; tab first.
                    </div>
                  </div>
                </div>
              ) : boughtSummary ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-700">
                      Purchase Summary (Last 30 days)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <div className="text-lg font-bold text-blue-700">
                        {boughtSummary.totalBought}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Bought
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <div className="text-lg font-bold text-orange-600">
                        {boughtSummary.totalAllocated}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Allocated
                      </div>
                    </div>
                    <div
                      className={`rounded-lg p-2 border ${
                        boughtSummary.remaining <= 0
                          ? "bg-red-50 border-red-200"
                          : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      <div
                        className={`text-lg font-bold ${
                          boughtSummary.remaining <= 0
                            ? "text-red-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {boughtSummary.remaining}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Remaining
                      </div>
                    </div>
                  </div>
                  {boughtSummary.remaining <= 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      All bought stock has been allocated. Buy more first.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Qty + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Quantity *
                {boughtSummary &&
                  boughtSummary.remaining > 0 && (
                    <span className="text-emerald-600 ml-1">
                      (max: {boughtSummary.remaining})
                    </span>
                  )}
              </label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                min="0"
                max={
                  boughtSummary && boughtSummary.remaining > 0
                    ? boughtSummary.remaining
                    : undefined
                }
                className={exceedsBought ? "border-red-400 bg-red-50" : ""}
              />
              {exceedsBought && (
                <div className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Exceeds remaining bought stock ({boughtSummary!.remaining}{" "}
                  {unit})
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Unit
              </label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg"
              />
            </div>
          </div>

          {/* Cost Price + Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Cost Price (per unit)
              </label>
              <Input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder={
                  boughtSummary && boughtSummary.purchases.length > 0
                    ? `₹${boughtSummary.purchases[0].pricePerUnit} (last bought)`
                    : "₹0"
                }
                min="0"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Supplier
              </label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder={
                  boughtSummary && boughtSummary.purchases.length > 0
                    ? boughtSummary.purchases[0].supplier || "Optional"
                    : "Optional"
                }
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Notes
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        {/* Hard block warning banner */}
        {(exceedsBought || noPurchaseRecord || (boughtSummary && boughtSummary.remaining <= 0)) && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-700 text-sm">Cannot Add Stock</div>
              <div className="text-xs text-red-600 mt-0.5">
                {noPurchaseRecord
                  ? 'No purchase record found. Record the purchase in "Buying Stock" tab first.'
                  : exceedsBought
                    ? `You are trying to add ${qty} ${unit}, but only ${boughtSummary!.remaining} ${unit} is available (Bought: ${boughtSummary!.totalBought}, Already distributed: ${boughtSummary!.totalAllocated}).`
                    : `All bought stock has been distributed to stores. Buy more in "Buying Stock" tab first.`}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || exceedsBought || noPurchaseRecord || (boughtSummary !== null && boughtSummary.remaining <= 0)}
            className={
              exceedsBought || noPurchaseRecord || (boughtSummary !== null && boughtSummary.remaining <= 0)
                ? "opacity-50 cursor-not-allowed"
                : ""
            }
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PackagePlus className="w-4 h-4" />
            )}
            Add Stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
