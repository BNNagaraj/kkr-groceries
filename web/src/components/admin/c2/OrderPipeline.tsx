"use client";

import React, { useState, useMemo } from "react";
import type { C2Theme } from "../CommandCenter";
import { Order, OrderStatus } from "@/types/order";
import { parseTotal, formatCurrency } from "@/lib/helpers";
import {
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Phone,
  MapPin,
} from "lucide-react";

// ─── Pipeline Columns ─────────────────────────────────────────────────────
const PIPELINE_STAGES: {
  status: OrderStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgGlowDark: string;
  bgGlowLight: string;
}[] = [
  {
    status: "Pending",
    label: "Pending",
    icon: <Clock className="w-4 h-4" />,
    color: "#f59e0b",
    bgGlowDark: "rgba(245,158,11,0.08)",
    bgGlowLight: "rgba(245,158,11,0.04)",
  },
  {
    status: "Accepted",
    label: "Accepted",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "#3b82f6",
    bgGlowDark: "rgba(59,130,246,0.08)",
    bgGlowLight: "rgba(59,130,246,0.04)",
  },
  {
    status: "Shipped",
    label: "Shipped",
    icon: <Truck className="w-4 h-4" />,
    color: "#8b5cf6",
    bgGlowDark: "rgba(139,92,246,0.08)",
    bgGlowLight: "rgba(139,92,246,0.04)",
  },
  {
    status: "Fulfilled",
    label: "Fulfilled",
    icon: <PackageCheck className="w-4 h-4" />,
    color: "#10b981",
    bgGlowDark: "rgba(16,185,129,0.08)",
    bgGlowLight: "rgba(16,185,129,0.04)",
  },
];

// ─── Aging helper ───────────────────────────────────────────────────────────
function getAgingClass(order: Order): string {
  if (order.status === "Fulfilled" || order.status === "Rejected") return "";
  const ts = order.createdAt
    ? typeof order.createdAt === "object" && "toDate" in order.createdAt
      ? (order.createdAt as any).toDate().getTime()
      : new Date(order.timestamp || "").getTime()
    : Date.now();
  const elapsed = (Date.now() - ts) / 60000;
  if (elapsed > 30) return "c2-aging-critical";
  if (elapsed > 15) return "c2-aging-warning";
  return "";
}

function getElapsedText(order: Order): string {
  const ts = order.createdAt
    ? typeof order.createdAt === "object" && "toDate" in order.createdAt
      ? (order.createdAt as any).toDate().getTime()
      : new Date(order.timestamp || "").getTime()
    : Date.now();
  const elapsed = Math.floor((Date.now() - ts) / 60000);
  if (elapsed < 1) return "just now";
  if (elapsed < 60) return `${elapsed}m ago`;
  const hours = Math.floor(elapsed / 60);
  if (hours < 24) return `${hours}h ${elapsed % 60}m`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Order Card ──────────────────────────────────────────────────────────
function OrderCard({
  order,
  onStatusChange,
}: {
  order: Order;
  stageColor: string;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const agingClass = getAgingClass(order);
  const totalValue = parseTotal(order.totalValue);

  const nextActions: { label: string; status: OrderStatus; color: string }[] = [];
  if (order.status === "Pending") {
    nextActions.push({ label: "Accept", status: "Accepted", color: "#3b82f6" });
    nextActions.push({ label: "Reject", status: "Rejected", color: "#ef4444" });
  } else if (order.status === "Accepted") {
    nextActions.push({ label: "Ship", status: "Shipped", color: "#8b5cf6" });
  } else if (order.status === "Shipped") {
    nextActions.push({ label: "Fulfill", status: "Fulfilled", color: "#10b981" });
  }

  return (
    <div
      className={`rounded-lg p-3 transition-all duration-200 cursor-pointer ${agingClass}`}
      style={{
        background: "var(--c2-bg-card)",
        border: "1px solid var(--c2-border-subtle)",
        boxShadow: "var(--c2-card-shadow)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--c2-text)" }}>
              {order.customerName || "Customer"}
            </span>
            {agingClass === "c2-aging-critical" && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" />
            )}
          </div>
          {order.shopName && (
            <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--c2-text-muted)" }}>
              {order.shopName}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold" style={{ color: "var(--c2-text)" }}>
            {formatCurrency(totalValue)}
          </div>
          <div className="text-[10px]" style={{ color: "var(--c2-text-muted)" }}>
            {getElapsedText(order)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px]" style={{ color: "var(--c2-text-muted)" }}>
        <span
          className="px-1.5 py-0.5 rounded"
          style={{ background: "var(--c2-bg-secondary)" }}
        >
          {order.productCount || order.cart?.length || 0} items
        </span>
        {order.orderId && (
          <span className="font-mono opacity-60">{order.orderId.slice(-8)}</span>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "1px solid var(--c2-border-subtle)" }}>
          {order.phone && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--c2-text-secondary)" }}>
              <Phone className="w-3 h-3" />
              {order.phone}
            </div>
          )}
          {order.location && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--c2-text-secondary)" }}>
              <MapPin className="w-3 h-3" />
              <span className="truncate">{order.location}</span>
            </div>
          )}
          {order.cart && order.cart.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
              {order.cart.slice(0, 5).map((item, i) => (
                <div key={i} className="flex justify-between text-[10px] px-1" style={{ color: "var(--c2-text-muted)" }}>
                  <span className="truncate flex-1">{item.name}</span>
                  <span className="shrink-0 ml-2">
                    {item.qty} {item.unit} &times; {formatCurrency(item.price)}
                  </span>
                </div>
              ))}
              {order.cart.length > 5 && (
                <div className="text-[10px] px-1" style={{ color: "var(--c2-text-muted)", opacity: 0.6 }}>
                  +{order.cart.length - 5} more items
                </div>
              )}
            </div>
          )}
          {nextActions.length > 0 && onStatusChange && (
            <div className="flex gap-2 mt-2">
              {nextActions.map((action) => (
                <button
                  key={action.status}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(order.id, action.status);
                  }}
                  className="flex-1 text-[11px] font-semibold py-1.5 px-3 rounded-md transition-all hover:brightness-110 active:scale-95"
                  style={{
                    backgroundColor: `${action.color}20`,
                    color: action.color,
                    border: `1px solid ${action.color}30`,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center mt-1">
        {expanded ? (
          <ChevronUp className="w-3 h-3" style={{ color: "var(--c2-text-muted)" }} />
        ) : (
          <ChevronDown className="w-3 h-3" style={{ color: "var(--c2-text-muted)" }} />
        )}
      </div>
    </div>
  );
}

// ─── Main Pipeline ────────────────────────────────────────────────────────
interface OrderPipelineProps {
  orders: Order[];
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  theme: C2Theme;
}

export default function OrderPipeline({ orders, onStatusChange, theme }: OrderPipelineProps) {
  const grouped = useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      Pending: [], Accepted: [], Shipped: [], Fulfilled: [], Rejected: [],
    };
    orders.forEach((o) => {
      const status = o.status || "Pending";
      if (map[status]) map[status].push(o);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        const ta = a.createdAt && typeof a.createdAt === "object" && "toDate" in a.createdAt
          ? (a.createdAt as any).toDate().getTime() : new Date(a.timestamp || 0).getTime();
        const tb = b.createdAt && typeof b.createdAt === "object" && "toDate" in b.createdAt
          ? (b.createdAt as any).toDate().getTime() : new Date(b.timestamp || 0).getTime();
        return tb - ta;
      })
    );
    return map;
  }, [orders]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <h3 className="text-sm font-bold tracking-wide flex items-center gap-2" style={{ color: "var(--c2-text)" }}>
          <span className="text-lg">&#x1F4E6;</span> Order Pipeline
        </h3>
        <span className="text-[10px] font-mono" style={{ color: "var(--c2-text-muted)" }}>
          {orders.length} total
        </span>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-0 overflow-hidden">
        {PIPELINE_STAGES.map((stage) => {
          const stageOrders = grouped[stage.status] || [];
          return (
            <div
              key={stage.status}
              className="flex flex-col overflow-hidden"
              style={{
                backgroundColor: theme === "dark" ? stage.bgGlowDark : stage.bgGlowLight,
                borderRight: "1px solid var(--c2-border-subtle)",
              }}
            >
              <div
                className="px-3 py-2.5 flex items-center justify-between shrink-0"
                style={{ borderBottom: "1px solid var(--c2-border-subtle)" }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color: stage.color }}>
                  {stage.icon}
                  {stage.label}
                </div>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                >
                  {stageOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
                {stageOrders.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-[10px]" style={{ color: "var(--c2-text-muted)" }}>
                    No orders
                  </div>
                )}
                {stageOrders.map((order) => (
                  <OrderCard key={order.id} order={order} stageColor={stage.color} onStatusChange={onStatusChange} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
