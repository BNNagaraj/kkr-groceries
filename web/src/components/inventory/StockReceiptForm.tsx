"use client";

import React, { useState, useEffect } from "react";
import { db, functions } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { useAppStore } from "@/contexts/AppContext";
import { Store } from "@/types/settings";
import { toast } from "sonner";
import {
  PackagePlus,
  Loader2,
  Search,
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

  useEffect(() => {
    if (fixedStoreId) return;
    const unsub = onSnapshot(collection(db, col("stores")), (snap) => {
      setStores(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Store))
          .filter((s) => s.isActive)
      );
    }, (err) => console.error("[StockReceiptForm] Firestore listener error:", err));
    return unsub;
  }, [col, fixedStoreId]);

  useEffect(() => {
    if (fixedStoreId) setStoreId(fixedStoreId);
  }, [fixedStoreId]);

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

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find((p) => String(p.id) === id);
    if (prod) {
      setUnit(prod.unit || "kg");
    }
  };

  const handleSubmit = async () => {
    if (!storeId) { toast.error("Select a store."); return; }
    if (!selectedProductId || !selectedProduct) { toast.error("Select a product."); return; }
    if (!qty || Number(qty) <= 0) { toast.error("Enter a valid quantity."); return; }

    const store = fixedStoreId && fixedStoreName
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
      toast.success(`Added ${qty} ${unit} of ${selectedProduct.name} to inventory.`);
      // Reset form
      setSelectedProductId("");
      setProductSearch("");
      setQty("");
      setCostPrice("");
      setSupplier("");
      setNotes("");
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
                    <span className="text-slate-400 text-xs">
                      ({p.unit})
                    </span>
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

          {/* Qty + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Quantity *
              </label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                min="0"
              />
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
                placeholder="₹0"
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
                placeholder="Optional"
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
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
