"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Order } from "@/types/order";
import { parseTotal, formatCurrency } from "@/lib/helpers";
import { normalizeIndianPhone } from "@/lib/validation";
import { Search, X } from "lucide-react";

const STATUS_DOT_COLOR: Record<string, string> = {
  Pending: "#f59e0b",
  Accepted: "#3b82f6",
  Shipped: "#8b5cf6",
  Fulfilled: "#10b981",
  Rejected: "#ef4444",
};

interface OrderSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onSelectOrder?: (orderId: string) => void;
}

export default function OrderSearch({ open, onOpenChange, orders, onSelectOrder }: OrderSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    const normalizedPhone = normalizeIndianPhone(q);

    return orders
      .filter((o) => {
        if (o.orderId?.toLowerCase().includes(q)) return true;
        if (o.customerName?.toLowerCase().includes(q)) return true;
        if (o.shopName?.toLowerCase().includes(q)) return true;
        if (o.location?.toLowerCase().includes(q)) return true;
        // Phone matching (normalized)
        if (normalizedPhone.length >= 4) {
          const oPhone = normalizeIndianPhone(o.phone || "");
          if (oPhone.includes(normalizedPhone)) return true;
        }
        return false;
      })
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, 20);
  }, [query, orders]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onSelectOrder?.(results[selectedIndex].id);
      onOpenChange(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Search panel */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--c2-bg-card, #ffffff)",
          border: "1px solid var(--c2-border, #e2e8f0)",
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--c2-border, #e2e8f0)" }}
        >
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--c2-text-muted, #94a3b8)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search orders by name, phone, shop, ID..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--c2-text, #0f172a)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-0.5 rounded hover:opacity-70">
              <X className="w-4 h-4" style={{ color: "var(--c2-text-muted, #94a3b8)" }} />
            </button>
          )}
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{
              background: "var(--c2-bg-secondary, #f1f5f9)",
              color: "var(--c2-text-muted, #94a3b8)",
              border: "1px solid var(--c2-border, #e2e8f0)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="py-8 text-center text-sm" style={{ color: "var(--c2-text-muted, #94a3b8)" }}>
              No orders found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!query.trim() && (
            <div className="py-8 text-center text-sm" style={{ color: "var(--c2-text-muted, #94a3b8)" }}>
              Start typing to search across all orders...
            </div>
          )}

          {results.map((order, i) => {
            const total = parseTotal(order.totalValue);
            const statusColor = STATUS_DOT_COLOR[order.status || "Pending"] || "#94a3b8";
            const isSelected = i === selectedIndex;

            return (
              <div
                key={order.id}
                className="px-4 py-2.5 cursor-pointer transition-colors"
                style={{
                  background: isSelected ? "var(--c2-bg-secondary, #f1f5f9)" : "transparent",
                  borderBottom: "1px solid var(--c2-border-subtle, #f1f5f9)",
                }}
                onClick={() => {
                  onSelectOrder?.(order.id);
                  onOpenChange(false);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="flex items-center gap-3">
                  {/* Status dot */}
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--c2-text, #0f172a)" }}>
                        {order.customerName || "Customer"}
                      </span>
                      {order.shopName && order.shopName.toLowerCase() !== "not specified" && (
                        <span className="text-[10px] truncate" style={{ color: "var(--c2-text-muted, #94a3b8)" }}>
                          {order.shopName}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: "var(--c2-text-muted, #94a3b8)" }}>
                      {order.orderId && <span className="font-mono">{order.orderId.slice(-8)}</span>}
                      {order.phone && <span>{order.phone}</span>}
                      {order.location && <span className="truncate">{order.location}</span>}
                    </div>
                  </div>

                  {/* Right info */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold" style={{ color: "var(--c2-text, #0f172a)" }}>
                      {formatCurrency(total)}
                    </div>
                    <div className="text-[10px]" style={{ color: statusColor }}>
                      {order.status || "Pending"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 flex items-center gap-4 text-[10px]"
          style={{
            borderTop: "1px solid var(--c2-border, #e2e8f0)",
            color: "var(--c2-text-muted, #94a3b8)",
          }}
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--c2-bg-secondary, #f1f5f9)", border: "1px solid var(--c2-border, #e2e8f0)" }}>
              &uarr;&darr;
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--c2-bg-secondary, #f1f5f9)", border: "1px solid var(--c2-border, #e2e8f0)" }}>
              Enter
            </kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--c2-bg-secondary, #f1f5f9)", border: "1px solid var(--c2-border, #e2e8f0)" }}>
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
