"use client";

import React, { useState } from "react";
import { PriceTier, Product } from "@/contexts/AppContext";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PriceTierEditorProps {
  product: Product;
  onSave: (productId: number, tiers: PriceTier[]) => void;
  onClose: () => void;
}

const MAX_TIERS = 5;

export default function PriceTierEditor({ product, onSave, onClose }: PriceTierEditorProps) {
  const [tiers, setTiers] = useState<PriceTier[]>(
    product.priceTiers?.length
      ? [...product.priceTiers].sort((a, b) => a.minQty - b.minQty)
      : []
  );
  const [error, setError] = useState("");

  const addTier = () => {
    if (tiers.length >= MAX_TIERS) return;
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].maxQty || 0) : 0;
    setTiers([
      ...tiers,
      { minQty: lastMax > 0 ? lastMax + 1 : 1, maxQty: 0, price: product.price },
    ]);
    setError("");
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
    setError("");
  };

  const updateTier = (index: number, field: keyof PriceTier, value: number) => {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
    setError("");
  };

  const validate = (): boolean => {
    if (tiers.length === 0) return true; // No tiers = flat pricing

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t.minQty <= 0) {
        setError(`Tier ${i + 1}: Min Qty must be > 0`);
        return false;
      }
      if (t.maxQty !== 0 && t.maxQty < t.minQty) {
        setError(`Tier ${i + 1}: Max Qty must be >= Min Qty (or 0 for unlimited)`);
        return false;
      }
      if (t.price <= 0) {
        setError(`Tier ${i + 1}: Price must be > 0`);
        return false;
      }
      // Check overlap with previous tier
      if (i > 0) {
        const prev = tiers[i - 1];
        const prevMax = prev.maxQty === 0 ? Infinity : prev.maxQty;
        if (t.minQty <= prevMax) {
          setError(`Tier ${i + 1}: Min Qty (${t.minQty}) overlaps with previous tier's range`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    onSave(product.id, sorted);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Price Tiers — {product.name}</DialogTitle>
          <DialogDescription>
            Set quantity-based pricing slabs. Base price: ₹{product.price}/{product.unit}. Up to {MAX_TIERS} tiers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {tiers.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">
              No tiers configured. This product uses flat pricing (₹{product.price}/{product.unit}).
            </div>
          )}

          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Min Qty</label>
                  <input
                    type="number"
                    value={tier.minQty || ""}
                    onChange={(e) => updateTier(i, "minQty", Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:ring-1 focus:ring-emerald-500 outline-none"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Max Qty</label>
                  <input
                    type="number"
                    value={tier.maxQty || ""}
                    onChange={(e) => updateTier(i, "maxQty", Number(e.target.value))}
                    placeholder="∞"
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:ring-1 focus:ring-emerald-500 outline-none"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Price (₹)</label>
                  <input
                    type="number"
                    value={tier.price || ""}
                    onChange={(e) => updateTier(i, "price", Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:ring-1 focus:ring-emerald-500 outline-none"
                    min={0}
                    step="0.5"
                  />
                </div>
              </div>
              <button
                onClick={() => removeTier(i)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                title="Remove tier"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {tiers.length < MAX_TIERS && (
            <button
              onClick={addTier}
              className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Tier ({tiers.length}/{MAX_TIERS})
            </button>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>
          )}

          <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2.5">
            <strong>How it works:</strong> The entire order quantity gets the rate of the matching tier.
            Set Max Qty to 0 (or leave empty) for &quot;unlimited&quot; on the last tier.
            Example: 1-100 @ ₹10, 101-500 @ ₹8, 501+ @ ₹6.5
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} className="flex-1">Save Tiers</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
