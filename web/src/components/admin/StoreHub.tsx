"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where, Timestamp } from "firebase/firestore";
import { useMode } from "@/contexts/ModeContext";
import { Store } from "@/types/settings";
import { Order } from "@/types/order";
import { StoreInventoryItem } from "@/types/inventory";
import {
  Warehouse,
  LayoutDashboard,
  Truck,
  Settings2,
  Loader2,
} from "lucide-react";

import StoreOverview from "./storehub/StoreOverview";
import StoreDetail from "./storehub/StoreDetail";
import DeliveryFleetPanel from "./storehub/DeliveryFleetPanel";
import StoresSection from "./StoresSection";

type SubTab = "overview" | "stores" | "fleet";

interface StoreHubProps {
  onNavigateToOrder?: (orderId: string) => void;
}

export default function StoreHub({ onNavigateToOrder }: StoreHubProps) {
  const { col } = useMode();
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<StoreInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down into specific store
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // ── Real-time listeners ──
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Stores
    unsubs.push(
      onSnapshot(
        collection(db, col("stores")),
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store));
          data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          setStores(data);
          setLoading(false);
        },
        (err) => {
          console.warn("[StoreHub] Stores error:", err.message);
          setLoading(false);
        }
      )
    );

    // Orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    unsubs.push(
      onSnapshot(
        query(
          collection(db, col("orders")),
          where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
          orderBy("createdAt", "desc")
        ),
        (snap) => {
          setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
        },
        (err) => console.warn("[StoreHub] Orders error:", err.message)
      )
    );

    // Inventory
    unsubs.push(
      onSnapshot(
        collection(db, col("storeInventory")),
        (snap) => {
          setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventoryItem)));
        },
        (err) => console.warn("[StoreHub] Inventory error:", err.message)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [col]);

  // Selected store for detail view
  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) || null,
    [stores, selectedStoreId]
  );

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setSubTab("overview"); // stay on overview, but show detail
  };

  const handleBackFromDetail = () => {
    setSelectedStoreId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading Store Hub...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store Hub Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Store Hub</h1>
            <p className="text-xs text-slate-500">
              {stores.length} store{stores.length !== 1 ? "s" : ""} &middot;{" "}
              {stores.filter((s) => s.isActive).length} active
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      {!selectedStoreId && (
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <SubTabButton
            label="Overview"
            icon={<LayoutDashboard className="w-4 h-4" />}
            active={subTab === "overview"}
            onClick={() => setSubTab("overview")}
          />
          <SubTabButton
            label="Manage Stores"
            icon={<Settings2 className="w-4 h-4" />}
            active={subTab === "stores"}
            onClick={() => setSubTab("stores")}
          />
          <SubTabButton
            label="Delivery Fleet"
            icon={<Truck className="w-4 h-4" />}
            active={subTab === "fleet"}
            onClick={() => setSubTab("fleet")}
          />
        </div>
      )}

      {/* Content */}
      {selectedStoreId && selectedStore ? (
        <StoreDetail
          store={selectedStore}
          orders={orders}
          inventory={inventory}
          onBack={handleBackFromDetail}
          onNavigateToOrder={onNavigateToOrder}
        />
      ) : (
        <>
          {subTab === "overview" && (
            <StoreOverview
              stores={stores}
              orders={orders}
              inventory={inventory}
              onSelectStore={handleSelectStore}
            />
          )}
          {subTab === "stores" && <StoresSection externalOrders={orders} externalInventory={inventory} />}
          {subTab === "fleet" && (
            <DeliveryFleetPanel orders={orders} stores={stores} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-tab Button ───────────────────────────────────────────────────────────
function SubTabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-white text-slate-800 shadow-sm"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
