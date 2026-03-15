"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Store } from "@/types/settings";
import { Warehouse, ChevronDown, Check, X } from "lucide-react";

interface StoreFilterProps {
  stores: Store[];
  selectedStoreIds: string[];
  onSelectionChange: (storeIds: string[]) => void;
}

export default function StoreFilter({ stores, selectedStoreIds, onSelectionChange }: StoreFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allSelected = selectedStoreIds.length === 0; // empty = all stores
  const label = allSelected
    ? "All Stores"
    : selectedStoreIds.length === 1
    ? stores.find((s) => s.id === selectedStoreIds[0])?.name || "1 Store"
    : `${selectedStoreIds.length} Stores`;

  const toggle = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      onSelectionChange(selectedStoreIds.filter((id) => id !== storeId));
    } else {
      onSelectionChange([...selectedStoreIds, storeId]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
        style={{
          background: allSelected ? "transparent" : "rgba(139,92,246,0.12)",
          color: allSelected ? "var(--c2-text-muted)" : "#8b5cf6",
          border: allSelected ? "1px solid var(--c2-border)" : "1px solid rgba(139,92,246,0.3)",
        }}
      >
        <Warehouse className="w-3 h-3" />
        <span className="max-w-[80px] truncate">{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg shadow-xl overflow-hidden"
          style={{
            background: "var(--c2-bg-card)",
            border: "1px solid var(--c2-border)",
          }}
        >
          {/* "All Stores" option */}
          <button
            onClick={() => { onSelectionChange([]); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors hover:brightness-110"
            style={{
              background: allSelected ? "rgba(139,92,246,0.08)" : "transparent",
              color: allSelected ? "#8b5cf6" : "var(--c2-text-secondary)",
              borderBottom: "1px solid var(--c2-border-subtle)",
            }}
          >
            {allSelected && <Check className="w-3 h-3 text-purple-500" />}
            {!allSelected && <span className="w-3" />}
            All Stores
          </button>

          {/* Individual stores */}
          <div className="max-h-[200px] overflow-y-auto">
            {stores.map((store) => {
              const isSelected = selectedStoreIds.includes(store.id);
              return (
                <button
                  key={store.id}
                  onClick={() => toggle(store.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors hover:brightness-110"
                  style={{
                    background: isSelected ? "rgba(139,92,246,0.06)" : "transparent",
                    color: isSelected ? "#8b5cf6" : "var(--c2-text-secondary)",
                  }}
                >
                  {isSelected ? <Check className="w-3 h-3 text-purple-500 shrink-0" /> : <span className="w-3 shrink-0" />}
                  <span className="truncate">{store.name}</span>
                  <span
                    className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      background: store.type === "agent" ? "rgba(249,115,22,0.12)" : "rgba(16,185,129,0.12)",
                      color: store.type === "agent" ? "#f97316" : "#10b981",
                    }}
                  >
                    {store.type === "agent" ? "Agent" : "Own"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Clear selection */}
          {!allSelected && (
            <button
              onClick={() => { onSelectionChange([]); setOpen(false); }}
              className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-medium transition-colors hover:brightness-110"
              style={{
                borderTop: "1px solid var(--c2-border-subtle)",
                color: "var(--c2-text-muted)",
              }}
            >
              <X className="w-3 h-3" />
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
