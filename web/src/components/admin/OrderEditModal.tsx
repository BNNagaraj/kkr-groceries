"use client";

import React, { useState, useMemo } from "react";
import { X, Send } from "lucide-react";
import { Order, OrderCartItem } from "@/types/order";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface EditItem {
  name: string;
  unit: string;
  originalQty: number;
  originalPrice: number;
  acceptedQty: number;
  acceptedPrice: number;
  fulfilledQty: number;
  fulfilledPrice: number;
}

interface Props {
  order: Order;
  onClose: () => void;
  onSave: (
    orderId: string,
    proposedCart: OrderCartItem[],
    changes: string[],
    userId: string
  ) => Promise<void>;
}

export default function OrderEditModal({ order, onClose, onSave }: Props) {
  const showFulfilled = order.status === "Fulfilled";
  const originalCart = order.originalCart || order.cart || [];
  const acCart = order.revisedAcceptedCart || order.cart || [];
  const fuCart = order.revisedFulfilledCart || acCart;

  const [items, setItems] = useState<EditItem[]>(() =>
    originalCart.map((item) => {
      const acItem = acCart.find((x) => x.name === item.name) || { ...item, qty: 0 };
      const fuItem = fuCart.find((x) => x.name === item.name) || { ...acItem };
      return {
        name: item.name,
        unit: item.unit,
        originalQty: item.qty,
        originalPrice: item.price,
        acceptedQty: acItem.qty,
        acceptedPrice: acItem.price || item.price,
        fulfilledQty: fuItem.qty,
        fulfilledPrice: fuItem.price || item.price,
      };
    })
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, field: keyof EditItem, value: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const totals = useMemo(() => {
    let original = 0;
    let accepted = 0;
    let fulfilled = 0;
    items.forEach((item) => {
      original += item.originalQty * item.originalPrice;
      accepted += item.acceptedQty * item.acceptedPrice;
      fulfilled += item.fulfilledQty * item.fulfilledPrice;
    });
    return { original, accepted, fulfilled };
  }, [items]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Store originalCart if not already stored
      if (!order.originalCart) {
        await updateDoc(doc(db, "orders", order.id), { originalCart: order.cart });
      }

      // Build proposed cart from accepted values (items with qty > 0)
      const proposedCart: OrderCartItem[] = [];
      const changes: string[] = [];

      items.forEach((item) => {
        const qty = showFulfilled ? item.fulfilledQty : item.acceptedQty;
        const price = showFulfilled ? item.fulfilledPrice : item.acceptedPrice;

        if (qty > 0) {
          proposedCart.push({
            name: item.name,
            qty,
            price,
            unit: item.unit,
          });

          if (qty !== item.originalQty) {
            changes.push(`${item.name}: Qty ${item.originalQty} \u2192 ${qty}`);
          }
          if (price !== item.originalPrice) {
            changes.push(
              `${item.name}: Rate \u20B9${item.originalPrice} \u2192 \u20B9${price}`
            );
          }
        }
      });

      await onSave(order.id, proposedCart, changes, order.userId);
    } catch (e) {
      console.error("Failed to save edited order:", e);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Edit Order</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                {order.orderId || order.id}
              </span>
              <span className="text-xs text-slate-500">Status: {order.status || "Pending"}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 px-3 text-slate-600 font-semibold">Item</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold bg-slate-50">
                  Original
                </th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold bg-blue-50">
                  Accepted
                </th>
                {showFulfilled && (
                  <th className="text-right py-2 px-3 text-slate-600 font-semibold bg-emerald-50">
                    Fulfilled
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const origAmt = item.originalQty * item.originalPrice;
                const accAmt = item.acceptedQty * item.acceptedPrice;
                const fulAmt = item.fulfilledQty * item.fulfilledPrice;

                return (
                  <tr key={idx} className="border-b border-slate-100">
                    {/* Item name */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.unit}</div>
                    </td>

                    {/* Original (read-only) */}
                    <td className="py-3 px-3 text-right bg-slate-50">
                      <div className="text-xs text-slate-500 mb-0.5">
                        {item.originalQty} x &#8377;{item.originalPrice}
                      </div>
                      <div className="font-bold text-slate-700">
                        &#8377;{origAmt.toLocaleString("en-IN")}
                      </div>
                    </td>

                    {/* Accepted (editable) */}
                    <td className="py-3 px-3 text-right bg-blue-50">
                      <div className="flex items-center justify-end gap-1 mb-0.5">
                        <input
                          type="number"
                          value={item.acceptedQty}
                          min={0}
                          onChange={(e) =>
                            updateItem(idx, "acceptedQty", parseFloat(e.target.value) || 0)
                          }
                          className="w-14 px-1 py-0.5 border border-slate-200 rounded text-right text-sm"
                        />
                        <span className="text-xs text-slate-400">x</span>
                        <input
                          type="number"
                          value={item.acceptedPrice}
                          min={0}
                          onChange={(e) =>
                            updateItem(idx, "acceptedPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-1 py-0.5 border border-slate-200 rounded text-right text-sm"
                        />
                      </div>
                      <div className="font-bold text-slate-800">
                        &#8377;{accAmt.toLocaleString("en-IN")}
                      </div>
                    </td>

                    {/* Fulfilled (editable, conditional) */}
                    {showFulfilled && (
                      <td className="py-3 px-3 text-right bg-emerald-50">
                        <div className="flex items-center justify-end gap-1 mb-0.5">
                          <input
                            type="number"
                            value={item.fulfilledQty}
                            min={0}
                            onChange={(e) =>
                              updateItem(idx, "fulfilledQty", parseFloat(e.target.value) || 0)
                            }
                            className="w-14 px-1 py-0.5 border border-slate-200 rounded text-right text-sm"
                          />
                          <span className="text-xs text-slate-400">x</span>
                          <input
                            type="number"
                            value={item.fulfilledPrice}
                            min={0}
                            onChange={(e) =>
                              updateItem(idx, "fulfilledPrice", parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-1 py-0.5 border border-slate-200 rounded text-right text-sm"
                          />
                        </div>
                        <div className="font-bold text-emerald-800">
                          &#8377;{fulAmt.toLocaleString("en-IN")}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-base">
                <td className="py-3 px-3 text-slate-700">Total</td>
                <td className="py-3 px-3 text-right bg-slate-50 text-slate-700">
                  &#8377;{totals.original.toLocaleString("en-IN")}
                </td>
                <td className="py-3 px-3 text-right bg-blue-50 text-slate-800">
                  &#8377;{totals.accepted.toLocaleString("en-IN")}
                </td>
                {showFulfilled && (
                  <td className="py-3 px-3 text-right bg-emerald-50 text-emerald-800">
                    &#8377;{totals.fulfilled.toLocaleString("en-IN")}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] hover:bg-[#065f46] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {saving ? "Sending..." : "Send Changes to Buyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
