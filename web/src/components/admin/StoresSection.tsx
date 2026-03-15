"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { useMode } from "@/contexts/ModeContext";
import { Store, StoreType } from "@/types/settings";
import { Order } from "@/types/order";
import { StoreInventoryItem } from "@/types/inventory";
import { parseTotal } from "@/lib/helpers";
import { toast } from "sonner";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
  Warehouse,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  MapPin,
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  UserCheck,
  Building2,
  ShoppingCart,
  TrendingUp,
  Package,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 }; // Hyderabad

interface SimpleUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
}

interface StoreForm {
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  isActive: boolean;
  type: StoreType;
  agentUid: string;
  agentName: string;
  agentPhone: string;
}

const EMPTY_FORM: StoreForm = {
  name: "",
  address: "",
  phone: "",
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng,
  isActive: true,
  type: "own",
  agentUid: "",
  agentName: "",
  agentPhone: "",
};

interface StoresSectionProps {
  /** Pre-loaded orders from parent (e.g. StoreHub) to avoid duplicate listeners */
  externalOrders?: Order[];
  /** Pre-loaded inventory from parent to avoid duplicate listeners */
  externalInventory?: StoreInventoryItem[];
}

export default function StoresSection({ externalOrders, externalInventory }: StoresSectionProps = {}) {
  const { col } = useMode();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [localInventory, setLocalInventory] = useState<StoreInventoryItem[]>([]);

  // Use external data if provided, otherwise use local listeners
  const orders = externalOrders ?? localOrders;
  const inventory = externalInventory ?? localInventory;

  // Load orders for per-store stats (last 30 days) — skip if parent provides data
  useEffect(() => {
    if (externalOrders) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const unsub = onSnapshot(
      query(
        collection(db, col("orders")),
        where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setLocalOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      },
      (err) => console.warn("[StoresSection] Orders listener error:", err.message)
    );
    return unsub;
  }, [col, externalOrders]);

  // Load inventory for per-store stock stats — skip if parent provides data
  useEffect(() => {
    if (externalInventory) return;
    const unsub = onSnapshot(
      collection(db, col("storeInventory")),
      (snap) => {
        setLocalInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventoryItem)));
      },
      (err) => console.warn("[StoresSection] Inventory listener error:", err.message)
    );
    return unsub;
  }, [col, externalInventory]);

  // Compute per-store stats
  const storeStats = useMemo(() => {
    const stats = new Map<string, {
      totalOrders: number;
      revenue: number;
      pending: number;
      accepted: number;
      shipped: number;
      fulfilled: number;
      rejected: number;
      stockItems: number;
      stockValue: number;
      lowStock: number;
    }>();

    // Order stats
    for (const order of orders) {
      const sid = order.assignedStoreId;
      if (!sid) continue;
      const s = stats.get(sid) || { totalOrders: 0, revenue: 0, pending: 0, accepted: 0, shipped: 0, fulfilled: 0, rejected: 0, stockItems: 0, stockValue: 0, lowStock: 0 };
      s.totalOrders++;
      s.revenue += parseTotal(order.totalValue);
      const status = (order.status || "Pending").toLowerCase();
      if (status === "pending") s.pending++;
      else if (status === "accepted") s.accepted++;
      else if (status === "shipped") s.shipped++;
      else if (status === "fulfilled") s.fulfilled++;
      else if (status === "rejected") s.rejected++;
      stats.set(sid, s);
    }

    // Inventory stats
    for (const inv of inventory) {
      const s = stats.get(inv.storeId) || { totalOrders: 0, revenue: 0, pending: 0, accepted: 0, shipped: 0, fulfilled: 0, rejected: 0, stockItems: 0, stockValue: 0, lowStock: 0 };
      s.stockItems += inv.currentQty;
      s.stockValue += inv.currentQty * (inv.costPrice || 0);
      if (inv.reorderLevel > 0 && inv.currentQty <= inv.reorderLevel) s.lowStock++;
      stats.set(inv.storeId, s);
    }

    return stats;
  }, [orders, inventory]);

  // Load users for agent assignment
  useEffect(() => {
    if (usersLoaded) return;
    const listUsers = httpsCallable<unknown, { users: SimpleUser[] }>(functions, "listRegisteredUsers");
    listUsers({ pageSize: 500 })
      .then((r) => setAllUsers(r.data.users || []))
      .catch((e) => console.warn("[StoresSection] Failed to load users:", e))
      .finally(() => setUsersLoaded(true));
  }, [usersLoaded]);

  // Map refs for the dialog
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerInstance = useRef<any>(null);

  // Real-time listener
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, col("stores")),
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Store)
        );
        data.sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
        setStores(data);
        setLoading(false);
      },
      (err) => {
        console.error("[StoresSection] Snapshot error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [col]);

  // Initialize map when dialog opens
  const initMap = useCallback(() => {
    if (!window.google || !mapRef.current) return;

    // Destroy previous instance
    mapInstance.current = null;
    markerInstance.current = null;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: form.lat, lng: form.lng },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
    });

    const marker = new window.google.maps.Marker({
      position: { lat: form.lat, lng: form.lng },
      map,
      draggable: true,
      title: "Store location",
    });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        setForm((prev) => ({ ...prev, lat: pos.lat(), lng: pos.lng() }));
      }
    });

    // Also allow clicking the map to move marker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addListener("click", (e: any) => {
      if (e.latLng) {
        marker.setPosition(e.latLng);
        setForm((prev) => ({
          ...prev,
          lat: e.latLng!.lat(),
          lng: e.latLng!.lng(),
        }));
      }
    });

    mapInstance.current = map;
    markerInstance.current = marker;
  }, [form.lat, form.lng]);

  useEffect(() => {
    if (!dialogOpen) return;

    // Small delay to let dialog DOM render
    const timeout = setTimeout(() => {
      if (window.google) {
        initMap();
      } else {
        const existing = document.querySelector(
          'script[src*="maps.googleapis.com/maps/api/js"]'
        );
        if (!existing) {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry`;
          script.async = true;
          script.defer = true;
          script.onload = initMap;
          document.head.appendChild(script);
        } else {
          existing.addEventListener("load", initMap);
          // If already loaded, trigger immediately
          if (window.google) initMap();
        }
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [dialogOpen, initMap]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (store: Store) => {
    setEditingId(store.id);
    setForm({
      name: store.name,
      address: store.address,
      phone: store.phone,
      lat: store.lat,
      lng: store.lng,
      isActive: store.isActive,
      type: store.type || "own",
      agentUid: store.agentUid || "",
      agentName: store.agentName || "",
      agentPhone: store.agentPhone || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Store name is required.");
      return;
    }
    if (!form.address.trim()) {
      toast.error("Address is required.");
      return;
    }

    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        lat: form.lat,
        lng: form.lng,
        isActive: form.isActive,
        type: form.type,
      };

      if (form.type === "agent") {
        data.agentUid = form.agentUid;
        data.agentName = form.agentName;
        data.agentPhone = form.agentPhone;
      } else {
        data.agentUid = "";
        data.agentName = "";
        data.agentPhone = "";
      }

      let storeDocId = editingId;
      if (editingId) {
        await updateDoc(doc(db, col("stores"), editingId), data);
        toast.success("Store updated!");
      } else {
        const ref = await addDoc(collection(db, col("stores")), {
          ...data,
          createdAt: serverTimestamp(),
        });
        storeDocId = ref.id;
        toast.success("Store added!");
      }

      // Set or revoke agent claim
      if (form.type === "agent" && form.agentUid && storeDocId) {
        try {
          const setAgentClaim = httpsCallable(functions, "setAgentClaim");
          await setAgentClaim({ uid: form.agentUid, agent: true, storeId: storeDocId });
        } catch (claimErr) {
          console.warn("[StoresSection] Failed to set agent claim:", claimErr);
          toast.warning("Store saved but agent claim could not be set. Try again from Users tab.");
        }
      }

      // If switching from agent to own, revoke previous agent's claim
      if (editingId && form.type === "own") {
        const prev = stores.find((s) => s.id === editingId);
        if (prev?.agentUid) {
          try {
            const setAgentClaim = httpsCallable(functions, "setAgentClaim");
            await setAgentClaim({ uid: prev.agentUid, agent: false });
          } catch (claimErr) {
            console.warn("[StoresSection] Failed to revoke agent claim:", claimErr);
          }
        }
      }

      setDialogOpen(false);
    } catch (e) {
      console.error("[StoresSection] Save failed:", e);
      toast.error("Failed to save store.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, col("stores"), deleteId));
      toast.success("Store deleted.");
    } catch (e) {
      console.error("[StoresSection] Delete failed:", e);
      toast.error("Failed to delete store.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (store: Store) => {
    try {
      await updateDoc(doc(db, col("stores"), store.id), {
        isActive: !store.isActive,
      });
      toast.success(
        store.isActive ? "Store deactivated." : "Store activated."
      );
    } catch (e) {
      console.error("[StoresSection] Toggle active failed:", e);
      toast.error("Failed to update store.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                Stores / Warehouses
              </h3>
              <p className="text-sm text-slate-500">
                Manage pickup locations for delivery routing
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Store
          </Button>
        </div>
      </div>

      {/* Store List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading stores...
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Warehouse className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-medium">No stores yet</p>
            <p className="text-xs mt-1">
              Add your first store/warehouse to enable delivery routing
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stores.map((store) => (
              <div
                key={store.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  store.isActive
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50 opacity-60"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    store.isActive
                      ? "bg-purple-100 text-purple-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <Warehouse className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">
                      {store.name}
                    </span>
                    {(store.type || "own") === "own" ? (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Building2 className="w-2.5 h-2.5" /> Own Run
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <UserCheck className="w-2.5 h-2.5" /> Agent Run
                      </span>
                    )}
                    {store.isActive ? (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {store.address}
                    </span>
                    {store.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {store.phone}
                      </span>
                    )}
                    {store.agentName && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <UserCheck className="w-3 h-3" /> {store.agentName}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
                  </div>

                  {/* Per-store stats */}
                  {(() => {
                    const s = storeStats.get(store.id);
                    if (!s) return null;
                    const hasOrders = s.totalOrders > 0;
                    const hasStock = s.stockItems > 0;
                    if (!hasOrders && !hasStock) return null;
                    return (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-100">
                        {hasOrders && (
                          <>
                            <div className="flex items-center gap-1 text-[10px]">
                              <ShoppingCart className="w-3 h-3 text-blue-500" />
                              <span className="font-bold text-slate-700">{s.totalOrders}</span>
                              <span className="text-slate-400">orders</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <TrendingUp className="w-3 h-3 text-emerald-500" />
                              <span className="font-bold text-emerald-700">{"\u20B9"}{s.revenue.toLocaleString("en-IN")}</span>
                            </div>
                            {/* Mini pipeline */}
                            <div className="flex items-center gap-1 text-[10px]">
                              {s.pending > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">{s.pending}P</span>}
                              {s.accepted > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{s.accepted}A</span>}
                              {s.shipped > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">{s.shipped}S</span>}
                              {s.fulfilled > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">{s.fulfilled}F</span>}
                            </div>
                          </>
                        )}
                        {hasStock && (
                          <>
                            <div className="flex items-center gap-1 text-[10px]">
                              <Package className="w-3 h-3 text-purple-500" />
                              <span className="font-bold text-slate-700">{s.stockItems.toLocaleString("en-IN")}</span>
                              <span className="text-slate-400">stock</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="font-bold text-purple-600">{"\u20B9"}{s.stockValue.toLocaleString("en-IN")}</span>
                              <span className="text-slate-400">value</span>
                            </div>
                            {s.lowStock > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold">{s.lowStock} low stock</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(store)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      store.isActive
                        ? "text-amber-600 hover:bg-amber-50"
                        : "text-emerald-600 hover:bg-emerald-50"
                    }`}
                    title={
                      store.isActive ? "Deactivate" : "Activate"
                    }
                  >
                    {store.isActive ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(store)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(store.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Store" : "Add New Store"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Store Name *
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Kukatpally Warehouse"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Phone
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Store Type */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                Store Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: "own", agentUid: "", agentName: "", agentPhone: "" }))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                    form.type === "own"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Own Run
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: "agent" }))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                    form.type === "agent"
                      ? "bg-orange-50 border-orange-300 text-orange-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> Agent Run
                </button>
              </div>
            </div>

            {/* Agent Assignment */}
            {form.type === "agent" && (
              <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-3 space-y-3">
                <label className="text-xs font-medium text-orange-700 block">
                  Assign Agent
                </label>
                <select
                  value={form.agentUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const user = allUsers.find((u) => u.uid === uid);
                    setForm((p) => ({
                      ...p,
                      agentUid: uid,
                      agentName: user?.displayName || user?.email?.split("@")[0] || user?.phone || "",
                      agentPhone: user?.phone || "",
                    }));
                  }}
                  className="w-full text-sm border border-orange-200 rounded-lg p-2 bg-white"
                >
                  <option value="">Select a user...</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email || u.phone || u.uid}
                    </option>
                  ))}
                </select>
                {form.agentUid && (
                  <div className="text-xs text-orange-600">
                    Agent: {form.agentName} {form.agentPhone && `(${form.agentPhone})`}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Address *
              </label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Full address"
              />
            </div>

            {/* Map Picker */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Location (drag marker or click map)
              </label>
              <div
                ref={mapRef}
                className="h-[250px] w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200"
              />
              <div className="flex gap-4 mt-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400">Lat</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.lat}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        lat: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="text-xs h-8"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400">Lng</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.lng}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        lng: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                onClick={() =>
                  setForm((p) => ({ ...p, isActive: !p.isActive }))
                }
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  form.isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    form.isActive ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-slate-700">Active</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingId ? "Update" : "Add"} Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this store?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this store/warehouse. Orders
              previously assigned to it won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
