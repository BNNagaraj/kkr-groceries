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
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  Phone,
  MapPin,
  Square,
  CheckSquare,
  X,
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
  {
    status: "Rejected",
    label: "Rejected",
    icon: <XCircle className="w-4 h-4" />,
    color: "#ef4444",
    bgGlowDark: "rgba(239,68,68,0.08)",
    bgGlowLight: "rgba(239,68,68,0.04)",
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
  onFulfillClick,
  isSelected,
  onToggleSelect,
  showCheckbox,
}: {
  order: Order;
  stageColor: string;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  onFulfillClick?: (order: Order) => void;
  isSelected?: boolean;
  onToggleSelect?: (orderId: string) => void;
  showCheckbox?: boolean;
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
      className={`rounded-lg p-2 sm:p-3 transition-all duration-200 cursor-pointer ${agingClass}`}
      style={{
        background: "var(--c2-bg-card)",
        border: isSelected ? "2px solid #3b82f6" : "1px solid var(--c2-border-subtle)",
        boxShadow: "var(--c2-card-shadow)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-start gap-2">
          {showCheckbox && (
            <button
              className="shrink-0 mt-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(order.id);
              }}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-500" />
              ) : (
                <Square className="w-4 h-4" style={{ color: "var(--c2-text-muted)" }} />
              )}
            </button>
          )}
          <div className="min-w-0">
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
                    // Intercept Fulfill for OTP verification
                    if (action.status === "Fulfilled" && onFulfillClick) {
                      onFulfillClick(order);
                    } else {
                      onStatusChange(order.id, action.status);
                    }
                  }}
                  className="flex-1 text-[11px] font-semibold py-2 sm:py-1.5 px-2 sm:px-3 rounded-md transition-all hover:brightness-110 active:scale-95"
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
  onBulkStatusChange?: (orderIds: string[], newStatus: OrderStatus) => void;
  /** Called instead of onStatusChange when "Fulfill" is clicked (to intercept for OTP) */
  onFulfillClick?: (order: Order) => void;
  theme: C2Theme;
}

export default function OrderPipeline({ orders, onStatusChange, onBulkStatusChange, onFulfillClick, theme }: OrderPipelineProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectedCollapsed, setRejectedCollapsed] = useState(true);

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

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleStageSelect = (status: OrderStatus) => {
    const stageOrders = grouped[status] || [];
    const allSelected = stageOrders.every((o) => selectedIds.has(o.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      stageOrders.forEach((o) => {
        if (allSelected) next.delete(o.id);
        else next.add(o.id);
      });
      return next;
    });
  };

  // Determine bulk action buttons based on selected orders
  const bulkActions = useMemo(() => {
    if (selectedIds.size === 0) return [];
    const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
    const actions: { label: string; status: OrderStatus; color: string; count: number }[] = [];

    const pendingSelected = selectedOrders.filter((o) => o.status === "Pending");
    const acceptedSelected = selectedOrders.filter((o) => o.status === "Accepted");
    const shippedSelected = selectedOrders.filter((o) => o.status === "Shipped");

    if (pendingSelected.length > 0) {
      actions.push({ label: `Accept (${pendingSelected.length})`, status: "Accepted", color: "#3b82f6", count: pendingSelected.length });
      actions.push({ label: `Reject (${pendingSelected.length})`, status: "Rejected", color: "#ef4444", count: pendingSelected.length });
    }
    if (acceptedSelected.length > 0) {
      actions.push({ label: `Ship (${acceptedSelected.length})`, status: "Shipped", color: "#8b5cf6", count: acceptedSelected.length });
    }
    if (shippedSelected.length > 0) {
      actions.push({ label: `Fulfill (${shippedSelected.length})`, status: "Fulfilled", color: "#10b981", count: shippedSelected.length });
    }
    return actions;
  }, [selectedIds, orders]);

  const handleBulkAction = (targetStatus: OrderStatus) => {
    // Determine source statuses that can transition to targetStatus
    const validSourceStatuses: OrderStatus[] = [];
    if (targetStatus === "Accepted" || targetStatus === "Rejected") validSourceStatuses.push("Pending");
    else if (targetStatus === "Shipped") validSourceStatuses.push("Accepted");
    else if (targetStatus === "Fulfilled") validSourceStatuses.push("Shipped");

    const ids = orders
      .filter((o) => selectedIds.has(o.id) && validSourceStatuses.includes(o.status || "Pending"))
      .map((o) => o.id);

    if (ids.length > 0 && onBulkStatusChange) {
      onBulkStatusChange(ids, targetStatus);
      setSelectedIds(new Set());
    }
  };

  // Main 4 stages + rejected
  const mainStages = PIPELINE_STAGES.filter((s) => s.status !== "Rejected");
  const rejectedStage = PIPELINE_STAGES.find((s) => s.status === "Rejected")!;
  const rejectedOrders = grouped["Rejected"] || [];

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-2.5 sm:px-4 py-2.5 sm:py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <h3 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2" style={{ color: "var(--c2-text)" }}>
          <span className="text-base sm:text-lg">&#x1F4E6;</span> Order Pipeline
        </h3>
        <div className="flex items-center gap-2">
          {rejectedOrders.length > 0 && (
            <button
              onClick={() => setRejectedCollapsed(!rejectedCollapsed)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <XCircle className="w-3 h-3" />
              {rejectedOrders.length}
              {rejectedCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <span className="text-[10px] font-mono" style={{ color: "var(--c2-text-muted)" }}>
            {orders.length} total
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main 4 stages */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-0 overflow-hidden">
          {mainStages.map((stage) => {
            const stageOrders = grouped[stage.status] || [];
            const allSelected = stageOrders.length > 0 && stageOrders.every((o) => selectedIds.has(o.id));
            const someSelected = stageOrders.some((o) => selectedIds.has(o.id));

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
                  className="px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between shrink-0"
                  style={{ borderBottom: "1px solid var(--c2-border-subtle)" }}
                >
                  <div className="flex items-center gap-1.5">
                    {onBulkStatusChange && stageOrders.length > 0 && (
                      <button
                        onClick={() => toggleStageSelect(stage.status)}
                        className="shrink-0"
                      >
                        {allSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Square
                            className="w-3.5 h-3.5"
                            style={{ color: someSelected ? "#3b82f6" : "var(--c2-text-muted)" }}
                          />
                        )}
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color: stage.color }}>
                      {stage.icon}
                      <span className="hidden sm:inline">{stage.label}</span>
                    </div>
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
                    <OrderCard
                      key={order.id}
                      order={order}
                      stageColor={stage.color}
                      onStatusChange={onStatusChange}
                      onFulfillClick={onFulfillClick}
                      isSelected={selectedIds.has(order.id)}
                      onToggleSelect={onBulkStatusChange ? toggleSelect : undefined}
                      showCheckbox={!!onBulkStatusChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rejected column (collapsible) */}
        {rejectedOrders.length > 0 && !rejectedCollapsed && (
          <div
            className="w-48 sm:w-56 flex flex-col overflow-hidden shrink-0"
            style={{
              backgroundColor: theme === "dark" ? rejectedStage.bgGlowDark : rejectedStage.bgGlowLight,
              borderLeft: "1px solid var(--c2-border-subtle)",
            }}
          >
            <div
              className="px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between shrink-0"
              style={{ borderBottom: "1px solid var(--c2-border-subtle)" }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide" style={{ color: rejectedStage.color }}>
                {rejectedStage.icon}
                Rejected
              </div>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${rejectedStage.color}20`, color: rejectedStage.color }}
              >
                {rejectedOrders.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
              {rejectedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  stageColor={rejectedStage.color}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {bulkActions.length > 0 && (
        <div
          className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5"
          style={{
            background: "var(--c2-bg-card)",
            borderTop: "2px solid #3b82f6",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold" style={{ color: "var(--c2-text)" }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1 rounded hover:opacity-70"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" style={{ color: "var(--c2-text-muted)" }} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <button
                key={`${action.status}-${action.label}`}
                onClick={() => handleBulkAction(action.status)}
                className="text-[11px] font-semibold py-1.5 px-3 rounded-md transition-all hover:brightness-110 active:scale-95"
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
        </div>
      )}
    </div>
  );
}
