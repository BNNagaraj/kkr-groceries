"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db, functions } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { Order, OrderRoutingResponse, StoreRoutingResult, SuggestedTransfer } from "@/types/order";
import { Store } from "@/types/settings";
import { findNearest, GeoEntity } from "@/lib/geo";
import { toast } from "sonner";
import {
  Truck,
  Warehouse,
  MapPin,
  Loader2,
  Navigation,
  User,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  XCircle,
  FileEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PresenceDoc {
  uid: string;
  displayName: string | null;
  phone: string | null;
  lat?: number;
  lng?: number;
  online: boolean;
  isDelivery?: boolean;
}

interface Props {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignDeliveryDialog({
  open,
  order,
  onClose,
  onAssigned,
}: Props) {
  const { col } = useMode();
  const [stores, setStores] = useState<Store[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<PresenceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedDeliveryUid, setSelectedDeliveryUid] = useState<string>("");

  // Smart routing state
  const [routingResult, setRoutingResult] = useState<OrderRoutingResponse | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string>("");
  const [showStockDetails, setShowStockDetails] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [showRevisedDialog, setShowRevisedDialog] = useState(false);

  // Fetch routing result
  const fetchRouting = useCallback(async (orderId: string) => {
    setRoutingLoading(true);
    setRoutingError("");
    try {
      const assignFn = httpsCallable<{ orderId: string }, OrderRoutingResponse>(
        functions,
        "assignOrderToStore"
      );
      const result = await assignFn({ orderId });
      setRoutingResult(result.data);

      // Auto-select best store from routing
      if (result.data.bestStoreId) {
        setSelectedStoreId(result.data.bestStoreId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to compute routing";
      setRoutingError(msg);
      console.error("[AssignDelivery] Routing error:", e);
    } finally {
      setRoutingLoading(false);
    }
  }, []);

  // Fetch stores + delivery boys + routing when dialog opens
  useEffect(() => {
    if (!open || !order) return;
    setLoading(true);
    setRoutingResult(null);
    setShowStockDetails(false);

    const fetchData = async () => {
      try {
        // Fetch active stores
        const storesSnap = await getDocs(collection(db, col("stores")));
        const allStores = storesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Store))
          .filter((s) => s.isActive);
        setStores(allStores);

        // Fetch online delivery boys from presence
        const presenceSnap = await getDocs(
          query(
            collection(db, "presence"),
            where("isDelivery", "==", true),
            where("online", "==", true)
          )
        );
        const boys = presenceSnap.docs.map((d) => d.data() as PresenceDoc);
        setDeliveryBoys(boys);

        // Auto-select nearest store (fallback if routing fails)
        if (order.lat && order.lng && allStores.length > 0) {
          const storeEntities: (GeoEntity & { id: string })[] = allStores.map(
            (s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })
          );
          const nearest = findNearest(order.lat, order.lng, storeEntities);
          if (nearest) setSelectedStoreId(nearest.id);
        } else if (allStores.length > 0) {
          setSelectedStoreId(allStores[0].id);
        }
      } catch (e) {
        console.error("[AssignDelivery] Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Fire smart routing in parallel
    fetchRouting(order.id);
  }, [open, order, col, fetchRouting]);

  // When selectedStoreId changes, auto-select nearest delivery boy to that store
  useEffect(() => {
    if (!selectedStoreId || deliveryBoys.length === 0) return;
    const store = stores.find((s) => s.id === selectedStoreId);
    if (!store) return;

    const boyEntities: GeoEntity[] = deliveryBoys
      .filter((b) => b.lat && b.lng)
      .map((b) => ({
        id: b.uid,
        name: b.displayName || b.phone || b.uid,
        lat: b.lat!,
        lng: b.lng!,
      }));

    if (boyEntities.length > 0) {
      const nearest = findNearest(store.lat, store.lng, boyEntities);
      if (nearest) setSelectedDeliveryUid(nearest.id);
    } else if (deliveryBoys.length > 0) {
      setSelectedDeliveryUid(deliveryBoys[0].uid);
    }
  }, [selectedStoreId, stores, deliveryBoys]);

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const selectedBoy = deliveryBoys.find((b) => b.uid === selectedDeliveryUid);

  // Get routing info for selected store
  const selectedStoreRouting = useMemo<StoreRoutingResult | null>(() => {
    if (!routingResult || !selectedStoreId) return null;
    return routingResult.stores.find((s) => s.storeId === selectedStoreId) || null;
  }, [routingResult, selectedStoreId]);

  // Distance info
  const distInfo = useMemo(() => {
    if (!order?.lat || !order?.lng || !selectedStore) return null;
    const storeEntities: GeoEntity[] = [
      { id: selectedStore.id, name: selectedStore.name, lat: selectedStore.lat, lng: selectedStore.lng },
    ];
    return findNearest(order.lat, order.lng, storeEntities);
  }, [order, selectedStore]);

  // Execute suggested transfers
  const handleExecuteTransfers = async () => {
    if (!routingResult || routingResult.suggestedTransfers.length === 0) return;
    setTransferring(true);
    try {
      const recordTxn = httpsCallable(functions, "recordStockTransaction");
      let success = 0;
      let failed = 0;

      for (const t of routingResult.suggestedTransfers) {
        try {
          // Transfer OUT from source store
          await recordTxn({
            storeId: t.fromStoreId,
            storeName: t.fromStoreName,
            productId: t.productId,
            productName: t.productName,
            type: "transfer_out",
            qty: t.qty,
            unit: t.unit,
            notes: `Auto-transfer for order ${order?.orderId || ""}`,
          });
          // Transfer IN to target store
          await recordTxn({
            storeId: t.toStoreId,
            storeName: t.toStoreName,
            productId: t.productId,
            productName: t.productName,
            type: "transfer_in",
            qty: t.qty,
            unit: t.unit,
            notes: `Auto-transfer for order ${order?.orderId || ""}`,
          });
          success++;
        } catch (txErr) {
          console.error(`Transfer failed for ${t.productName}:`, txErr);
          failed++;
        }
      }

      if (success > 0) {
        toast.success(`${success} transfer(s) completed!`);
      }
      if (failed > 0) {
        toast.error(`${failed} transfer(s) failed. Check inventory.`);
      }

      // Refresh routing to show updated stock
      if (order) await fetchRouting(order.id);
    } catch (e) {
      console.error("[AssignDelivery] Transfer error:", e);
      toast.error("Failed to execute transfers.");
    } finally {
      setTransferring(false);
    }
  };

  const handleAssign = async () => {
    if (!order) return;

    const updates: Record<string, unknown> = {};

    if (selectedStoreId && selectedStore) {
      updates.assignedStoreId = selectedStoreId;
      updates.assignedStoreName = selectedStore.name;
    }
    if (selectedDeliveryUid && selectedBoy) {
      updates.assignedTo = selectedDeliveryUid;
      updates.assignedToName =
        selectedBoy.displayName || selectedBoy.phone || selectedDeliveryUid;
      updates.assignedAt = serverTimestamp();
    }

    if (Object.keys(updates).length > 0) {
      setSaving(true);
      try {
        await updateDoc(doc(db, col("orders"), order.id), updates);
        toast.success("Delivery assigned!");
      } catch (e) {
        console.error("[AssignDelivery] Save failed:", e);
        toast.error("Failed to assign delivery.");
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    onAssigned();
  };

  const handleSkip = () => {
    onAssigned();
  };

  // Handle "Send Revised Order" — opens the RevisedOrderDialog
  const handleSendRevision = () => {
    setShowRevisedDialog(true);
  };

  if (!order) return null;

  // Fulfillment badge color
  const getFulfillmentColor = (pct: number) => {
    if (pct >= 100) return "text-green-700 bg-green-50 border-green-200";
    if (pct >= 70) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  return (
    <>
      <Dialog open={open && !showRevisedDialog} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-600" />
              Smart Delivery Assignment
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading stores & delivery boys...
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Order Info */}
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <div className="font-semibold text-slate-800">
                  #{order.orderId} — {order.customerName}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {order.location || "No address"}
                  {order.lat && order.lng && (
                    <span className="text-slate-400 ml-1">
                      ({order.lat.toFixed(3)}, {order.lng.toFixed(3)})
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  <Package className="w-3 h-3 inline mr-1" />
                  {order.productCount} items • {order.totalValue}
                </div>
              </div>

              {/* Smart Routing Result */}
              {routingLoading ? (
                <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-600 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing stock at all stores...
                </div>
              ) : routingError ? (
                <div className="bg-red-50 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {routingError}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-red-600 h-7"
                    onClick={() => order && fetchRouting(order.id)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : routingResult ? (
                <div className="space-y-2">
                  {/* Best store recommendation */}
                  <div className={`rounded-xl p-3 text-sm border ${getFulfillmentColor(routingResult.bestFulfillmentPercent)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        {routingResult.bestFulfillmentPercent >= 100 ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        Best Match: {routingResult.bestStoreName}
                      </div>
                      <span className="font-bold text-lg">
                        {routingResult.bestFulfillmentPercent}%
                      </span>
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {routingResult.bestFulfillmentPercent >= 100
                        ? "All items available — ready to fulfill!"
                        : `${(routingResult.stores[0]?.missingItems || []).length} item(s) missing — see options below`}
                    </div>
                  </div>

                  {/* Store rankings */}
                  <button
                    onClick={() => setShowStockDetails(!showStockDetails)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full"
                  >
                    {showStockDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showStockDetails ? "Hide" : "Show"} all store rankings ({routingResult.stores.length} stores)
                  </button>

                  {showStockDetails && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {routingResult.stores.map((sr) => (
                        <button
                          key={sr.storeId}
                          onClick={() => setSelectedStoreId(sr.storeId)}
                          className={`w-full text-left rounded-lg p-2 text-xs border transition-all ${
                            sr.storeId === selectedStoreId
                              ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{sr.storeName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">{sr.distanceKm} km</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                sr.fulfillmentPercent >= 100
                                  ? "bg-green-100 text-green-700"
                                  : sr.fulfillmentPercent >= 70
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {sr.fulfillmentPercent}%
                              </span>
                            </div>
                          </div>
                          {sr.missingItems.length > 0 && (
                            <div className="text-[10px] text-red-500 mt-0.5">
                              Missing: {sr.missingItems.map((m) => m.productName).join(", ")}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected store stock details */}
                  {selectedStoreRouting && selectedStoreRouting.missingItems.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Missing Items at {selectedStoreRouting.storeName}
                      </div>
                      <div className="space-y-1">
                        {selectedStoreRouting.missingItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-amber-700 bg-white/50 rounded-lg px-2 py-1">
                            <span>{item.productName}</span>
                            <span>
                              <span className="text-red-600 font-medium">{item.availableQty}</span>
                              <span className="text-slate-400"> / {item.requestedQty} {item.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Transfer suggestions */}
                      {routingResult.suggestedTransfers.length > 0 && (
                        <div className="border-t border-amber-200 pt-2 mt-2">
                          <div className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Transfer from Other Stores
                          </div>
                          {routingResult.suggestedTransfers.map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-slate-600 bg-blue-50/50 rounded px-2 py-1 mb-0.5">
                              <span>
                                {t.productName} ({t.qty} {t.unit})
                              </span>
                              <span className="text-blue-600">
                                ← {t.fromStoreName}
                              </span>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-1.5 h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={handleExecuteTransfers}
                            disabled={transferring}
                          >
                            {transferring ? (
                              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Transferring...</>
                            ) : (
                              <><ArrowRightLeft className="w-3 h-3 mr-1" /> Execute All Transfers</>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Cannot transfer — offer revised order */}
                      {routingResult.suggestedTransfers.length < selectedStoreRouting.missingItems.length && (
                        <div className="border-t border-amber-200 pt-2 mt-2">
                          <div className="text-[11px] text-red-600 mb-1.5 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            {selectedStoreRouting.missingItems.length - routingResult.suggestedTransfers.length} item(s) unavailable across all stores
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={handleSendRevision}
                          >
                            <FileEdit className="w-3 h-3 mr-1" /> Send Revised Order to Buyer
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* All items available */}
                  {selectedStoreRouting && selectedStoreRouting.missingItems.length === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>All {selectedStoreRouting.availableItems.length} items in stock at {selectedStoreRouting.storeName}. Ready to ship!</span>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Store selector (manual override) */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-purple-600" /> Pickup Store
                  {distInfo && (
                    <span className="text-slate-400 font-normal">
                      (~{distInfo.distanceKm.toFixed(1)} km from delivery)
                    </span>
                  )}
                </label>
                {stores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No stores configured. Add stores in Settings.
                  </p>
                ) : (
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">— None —</option>
                    {stores.map((s) => {
                      const sr = routingResult?.stores.find((r) => r.storeId === s.id);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {(s as Store & { type?: string }).type === "agent" ? " [Agent]" : ""}
                          {sr ? ` — ${sr.fulfillmentPercent}% stock, ${sr.distanceKm}km` : ` — ${s.address}`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Agent store note */}
              {selectedStore && (selectedStore as Store & { type?: string }).type === "agent" && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-xs text-orange-700 flex items-start gap-2">
                  <User className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Agent-run store.</span>{" "}
                    {(selectedStore as Store & { agentName?: string }).agentName
                      ? `Agent "${(selectedStore as Store & { agentName?: string }).agentName}" handles delivery. You can still assign a KKR delivery boy.`
                      : "This store is agent-run. The agent typically handles delivery."}
                  </div>
                </div>
              )}

              {/* Delivery Boy */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" /> Delivery Boy
                  {deliveryBoys.length > 0 && (
                    <span className="text-slate-400 font-normal">
                      ({deliveryBoys.length} online)
                    </span>
                  )}
                </label>
                {deliveryBoys.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No delivery boys online. Assign delivery role in User Management.
                  </p>
                ) : (
                  <select
                    value={selectedDeliveryUid}
                    onChange={(e) => setSelectedDeliveryUid(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">— None —</option>
                    {deliveryBoys.map((b) => (
                      <option key={b.uid} value={b.uid}>
                        {b.displayName || b.phone || b.uid}
                        {b.lat && b.lng ? " (GPS)" : " (no GPS)"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Summary */}
              {(selectedStore || selectedBoy) && (
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                  {selectedStore && (
                    <div className="flex items-center gap-1.5">
                      <Warehouse className="w-3 h-3" />
                      Pickup from: <strong>{selectedStore.name}</strong>
                    </div>
                  )}
                  {selectedBoy && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      Deliver by:{" "}
                      <strong>
                        {selectedBoy.displayName || selectedBoy.phone || selectedBoy.uid}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSkip} disabled={saving}>
              Skip
            </Button>
            <Button
              onClick={handleAssign}
              disabled={saving || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              Assign & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revised Order Dialog */}
      {showRevisedDialog && order && selectedStoreRouting && (
        <RevisedOrderInlineDialog
          open={showRevisedDialog}
          order={order}
          storeRouting={selectedStoreRouting}
          onClose={() => setShowRevisedDialog(false)}
          onSent={() => {
            setShowRevisedDialog(false);
            onClose();
          }}
          col={col}
        />
      )}
    </>
  );
}

/* ─── Inline Revised Order Dialog ─── */
interface RevisedOrderInlineProps {
  open: boolean;
  order: Order;
  storeRouting: StoreRoutingResult;
  onClose: () => void;
  onSent: () => void;
  col: (name: string) => string;
}

function RevisedOrderInlineDialog({
  open,
  order,
  storeRouting,
  onClose,
  onSent,
  col,
}: RevisedOrderInlineProps) {
  const [sending, setSending] = useState(false);

  // Build revised cart from available items
  const revisedCart = useMemo(() => {
    return order.cart
      .filter((item) => {
        // Keep only items that have stock
        const missing = storeRouting.missingItems.find(
          (m) => m.productName === item.name && m.availableQty === 0
        );
        return !missing; // Remove items with 0 available
      })
      .map((item) => {
        // Reduce qty for partially available items
        const partial = storeRouting.missingItems.find(
          (m) => m.productName === item.name && m.availableQty > 0
        );
        if (partial) {
          return { ...item, qty: partial.availableQty };
        }
        return item;
      });
  }, [order.cart, storeRouting]);

  const removedItems = useMemo(() => {
    return storeRouting.missingItems.filter((m) => m.availableQty === 0);
  }, [storeRouting]);

  const reducedItems = useMemo(() => {
    return storeRouting.missingItems.filter((m) => m.availableQty > 0);
  }, [storeRouting]);

  const revisedTotal = useMemo(() => {
    return revisedCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [revisedCart]);

  const handleSendRevision = async () => {
    setSending(true);
    try {
      const changes: string[] = [];
      removedItems.forEach((m) => {
        changes.push(`Removed: ${m.productName} (unavailable)`);
      });
      reducedItems.forEach((m) => {
        changes.push(
          `Reduced: ${m.productName} from ${m.requestedQty} to ${m.availableQty} ${m.unit}`
        );
      });

      const modification = {
        proposedCart: revisedCart,
        proposedSummary: revisedCart
          .map((i) => `${i.name} (${i.qty} ${i.unit})`)
          .join(", "),
        proposedTotalValue: `₹${revisedTotal.toLocaleString("en-IN")}`,
        proposedCount: revisedCart.length,
        changes,
        modifiedAt: new Date().toISOString(),
        modifiedBy: "Smart Order Routing",
        status: "PendingBuyerApproval",
        reason: "stock_routing",
      };

      // Update order with pending modification
      await updateDoc(doc(db, col("orders"), order.id), {
        pendingModification: modification,
        modificationStatus: "PendingBuyerApproval",
      });

      // Create in-app notification for buyer
      if (order.userId && order.userId !== "anonymous") {
        const { addDoc, serverTimestamp: st } = await import("firebase/firestore");
        await addDoc(collection(db, col("notifications")), {
          userId: order.userId,
          title: "Order Revision Required",
          body: `Your order #${order.orderId} has been revised — ${changes.length} change(s). Please review and confirm.`,
          type: "order_revision",
          orderId: order.orderId,
          read: false,
          createdAt: st(),
        });
      }

      // Queue email notification
      if (order.userEmail) {
        const { addDoc, serverTimestamp: st } = await import("firebase/firestore");
        await addDoc(collection(db, "mail"), {
          to: [order.userEmail],
          message: {
            subject: `Order #${order.orderId} — Revision Required`,
            html: `<div style="font-family:sans-serif;padding:20px;">
              <h2>Order Revision Required</h2>
              <p>Dear ${order.customerName},</p>
              <p>Some items in your order <strong>#${order.orderId}</strong> are currently unavailable. Please review the revised order below:</p>
              <h3>Changes:</h3>
              <ul>${changes.map((c) => `<li>${c}</li>`).join("")}</ul>
              <p><strong>Revised Total: ₹${revisedTotal.toLocaleString("en-IN")}</strong></p>
              <p>Please log in to accept or reject this revision.</p>
              <p>Thank you,<br/>KKR Groceries</p>
            </div>`,
          },
          createdAt: serverTimestamp(),
        });
      }

      toast.success("Revised order sent to buyer for confirmation!");
      onSent();
    } catch (e) {
      console.error("[RevisedOrder] Send failed:", e);
      toast.error("Failed to send revised order.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-orange-600" />
            Send Revised Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Removed items */}
          {removedItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Removed Items ({removedItems.length})
              </div>
              {removedItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-red-600 py-0.5 line-through opacity-70">
                  <span>{item.productName}</span>
                  <span>{item.requestedQty} {item.unit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reduced items */}
          {reducedItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Reduced Quantities ({reducedItems.length})
              </div>
              {reducedItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-amber-700 py-0.5">
                  <span>{item.productName}</span>
                  <span>
                    <span className="line-through opacity-50 mr-1">{item.requestedQty}</span>
                    → {item.availableQty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Revised cart */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Revised Order ({revisedCart.length} items)
            </div>
            {revisedCart.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-green-700 py-0.5">
                <span>{item.name}</span>
                <span>
                  {item.qty} {item.unit} × ₹{item.price} = ₹{(item.qty * item.price).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            <div className="border-t border-green-200 mt-2 pt-2 flex items-center justify-between text-sm font-bold text-green-800">
              <span>Revised Total</span>
              <span>₹{revisedTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Original: {order.productCount} items • {order.totalValue}</span>
              <span>→ Revised: {revisedCart.length} items • ₹{revisedTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSendRevision}
            disabled={sending || revisedCart.length === 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileEdit className="w-4 h-4" />
            )}
            Send Revision to Buyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
