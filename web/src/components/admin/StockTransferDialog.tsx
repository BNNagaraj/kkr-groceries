"use client";

import React, { useState, useEffect } from "react";
import { db, functions } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { Store } from "@/types/settings";
import { StoreInventoryItem } from "@/types/inventory";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Loader2,
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

interface StockTransferDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function StockTransferDialog({ open, onClose }: StockTransferDialogProps) {
  const { col } = useMode();
  const [stores, setStores] = useState<Store[]>([]);
  const [sourceStoreId, setSourceStoreId] = useState("");
  const [destStoreId, setDestStoreId] = useState("");
  const [inventory, setInventory] = useState<StoreInventoryItem[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, col("stores")), (snap) => {
      setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store)).filter((s) => s.isActive));
    }, (err) => console.error("[StockTransferDialog] Firestore listener error:", err));
    return unsub;
  }, [col]);

  // Load source store inventory
  useEffect(() => {
    if (!sourceStoreId) { setInventory([]); return; }
    const q2 = query(collection(db, col("storeInventory")), where("storeId", "==", sourceStoreId));
    const unsub = onSnapshot(q2, (snap) => {
      setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventoryItem)).filter((i) => i.currentQty > 0));
    }, (err) => console.error("[StockTransferDialog] Firestore listener error:", err));
    return unsub;
  }, [col, sourceStoreId]);

  const selectedInv = inventory.find((i) => i.productId === productId);
  const sourceStore = stores.find((s) => s.id === sourceStoreId);
  const destStore = stores.find((s) => s.id === destStoreId);

  const handleSubmit = async () => {
    if (!sourceStoreId || !destStoreId) { toast.error("Select both stores."); return; }
    if (sourceStoreId === destStoreId) { toast.error("Source and destination must be different."); return; }
    if (!productId || !selectedInv) { toast.error("Select a product."); return; }
    if (!qty || Number(qty) <= 0) { toast.error("Enter a valid quantity."); return; }
    if (Number(qty) > selectedInv.currentQty) { toast.error(`Only ${selectedInv.currentQty} available.`); return; }

    setSaving(true);
    try {
      const recordTxn = httpsCallable(functions, "recordStockTransaction");
      await recordTxn({
        storeId: sourceStoreId,
        storeName: sourceStore?.name || "",
        productId,
        productName: selectedInv.productName,
        type: "transfer_out",
        qty: Number(qty),
        unit: selectedInv.unit,
        counterpartStoreId: destStoreId,
        counterpartStoreName: destStore?.name || "",
        notes: notes || null,
      });
      toast.success(`Transferred ${qty} ${selectedInv.unit} of ${selectedInv.productName} from ${sourceStore?.name} to ${destStore?.name}.`);
      setProductId("");
      setQty("");
      setNotes("");
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[StockTransferDialog] Failed:", e);
      toast.error("Transfer failed.", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-purple-600" />
            Stock Transfer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source store */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              From Store *
            </label>
            <select
              value={sourceStoreId}
              onChange={(e) => { setSourceStoreId(e.target.value); setProductId(""); }}
              className="w-full text-sm border border-slate-200 rounded-lg p-2"
            >
              <option value="">Select source store...</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Dest store */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              To Store *
            </label>
            <select
              value={destStoreId}
              onChange={(e) => setDestStoreId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2"
            >
              <option value="">Select destination store...</option>
              {stores.filter((s) => s.id !== sourceStoreId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Product selector */}
          {sourceStoreId && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Product *
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2"
              >
                <option value="">Select product...</option>
                {inventory.map((inv) => (
                  <option key={inv.productId} value={inv.productId}>
                    {inv.productName} — {inv.currentQty} {inv.unit} available
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Qty */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Quantity * {selectedInv && <span className="text-slate-400">(max: {selectedInv.currentQty})</span>}
            </label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              min="1"
              max={selectedInv?.currentQty || undefined}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
