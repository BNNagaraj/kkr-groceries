"use client";

import React, { useState, useEffect } from "react";
import { db, functions } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { StoreInventoryItem } from "@/types/inventory";
import { toast } from "sonner";
import {
  ShoppingBag,
  Loader2,
  Plus,
  Minus,
  Trash2,
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

interface SaleItem {
  productId: string;
  productName: string;
  available: number;
  qty: number;
  unit: string;
}

interface AgentSaleDialogProps {
  open: boolean;
  onClose: () => void;
  storeName?: string;
}

export default function AgentSaleDialog({ open, onClose, storeName }: AgentSaleDialogProps) {
  const { col } = useMode();
  const { agentStoreId } = useAuth();
  const [inventory, setInventory] = useState<StoreInventoryItem[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Load inventory for agent's store
  useEffect(() => {
    if (!agentStoreId || !open) { setInventory([]); return; }
    const q2 = query(collection(db, col("storeInventory")), where("storeId", "==", agentStoreId));
    const unsub = onSnapshot(q2, (snap) => {
      setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventoryItem)).filter((i) => i.currentQty > 0));
    });
    return unsub;
  }, [col, agentStoreId, open]);

  const addItem = (inv: StoreInventoryItem) => {
    if (items.some((i) => i.productId === inv.productId)) return;
    setItems((prev) => [
      ...prev,
      {
        productId: inv.productId,
        productName: inv.productName,
        available: inv.currentQty,
        qty: 1,
        unit: inv.unit,
      },
    ]);
  };

  const updateQty = (productId: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, qty: Math.max(1, Math.min(i.available, i.qty + delta)) }
          : i
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleSubmit = async () => {
    if (!agentStoreId) { toast.error("No store assigned."); return; }
    if (items.length === 0) { toast.error("Add at least one product."); return; }
    if (!buyerName.trim()) { toast.error("Enter buyer name."); return; }

    setSaving(true);
    try {
      const recordTxn = httpsCallable(functions, "recordStockTransaction");
      for (const item of items) {
        await recordTxn({
          storeId: agentStoreId,
          storeName: storeName || "",
          productId: item.productId,
          productName: item.productName,
          type: "sale",
          qty: item.qty,
          unit: item.unit,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim() || null,
        });
      }
      toast.success(`Sale of ${items.length} item(s) recorded for ${buyerName}.`);
      setItems([]);
      setBuyerName("");
      setBuyerPhone("");
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[AgentSaleDialog] Failed:", e);
      toast.error("Failed to record sale.", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            Record Sale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Store info (fixed) */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs font-medium text-orange-600">Selling from</div>
            <div className="text-sm font-semibold text-orange-800">{storeName || "Your Store"}</div>
          </div>

          {/* Available inventory to add */}
          {inventory.length > 0 ? (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Available Products (tap to add)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {inventory
                  .filter((inv) => !items.some((i) => i.productId === inv.productId))
                  .map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => addItem(inv)}
                      className="text-xs px-2 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 rounded-lg border border-slate-200 transition-colors"
                    >
                      {inv.productName} ({inv.currentQty} {inv.unit})
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400 text-sm">
              No inventory available in your store.
            </div>
          )}

          {/* Selected items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 block">
                Sale Items
              </label>
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {item.productName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Available: {item.available} {item.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.productId, -1)}
                      className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-8 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.productId, 1)}
                      className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-slate-500">{item.unit}</span>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="p-1 rounded text-red-500 hover:bg-red-50 ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buyer details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Buyer Name *
              </label>
              <Input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Buyer Phone
              </label>
              <Input
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || items.length === 0} className="bg-orange-600 hover:bg-orange-700">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingBag className="w-4 h-4" />
            )}
            Record Sale ({items.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
