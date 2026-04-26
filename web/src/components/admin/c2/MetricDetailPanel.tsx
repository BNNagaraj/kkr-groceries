"use client";

import { X } from "lucide-react";
import { Order } from "@/types/order";
import { parseTotal } from "@/lib/helpers";
import type { PresenceDoc } from "@/contexts/PresenceContext";

export type MetricKey = "revenue" | "active" | "users" | "fulfillment" | "aov" | "pending";

const METRIC_TITLES: Record<MetricKey, string> = {
  revenue: "Fulfilled Orders (Revenue)",
  active: "Active Orders",
  users: "Online Users",
  fulfillment: "Fulfillment Breakdown",
  aov: "Fulfilled Order Values",
  pending: "Pending Revenue Orders",
};

interface MetricDetailPanelProps {
  metric: MetricKey;
  filteredOrders: Order[];
  onlineUsers: PresenceDoc[];
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export function MetricDetailPanel({
  metric,
  filteredOrders,
  onlineUsers,
  onClose,
  onSelectOrder,
  onNavigateToOrder,
}: MetricDetailPanelProps) {
  return (
    <div
      className="px-4 py-2.5 shrink-0 overflow-hidden"
      style={{
        borderBottom: "1px solid var(--c2-border)",
        background: "var(--c2-bg-secondary)",
        maxHeight: 200,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "var(--c2-text-muted)" }}
        >
          {METRIC_TITLES[metric]}
        </span>
        <button onClick={onClose} className="p-0.5 rounded hover:opacity-70">
          <X className="w-3.5 h-3.5" style={{ color: "var(--c2-text-muted)" }} />
        </button>
      </div>
      <div className="overflow-y-auto max-h-[140px] no-scrollbar">
        {(metric === "revenue" || metric === "aov") && <FulfilledTable
          orders={filteredOrders}
          onSelectOrder={onSelectOrder}
          onNavigateToOrder={onNavigateToOrder}
        />}
        {metric === "active" && <ActiveTable orders={filteredOrders} onSelectOrder={onSelectOrder} />}
        {metric === "users" && <UsersList users={onlineUsers} />}
        {metric === "fulfillment" && <FulfillmentBreakdown orders={filteredOrders} />}
        {metric === "pending" && <PendingTable orders={filteredOrders} />}
      </div>
    </div>
  );
}

function FulfilledTable({
  orders,
  onSelectOrder,
  onNavigateToOrder,
}: {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onNavigateToOrder?: (id: string) => void;
}) {
  const fulfilled = orders.filter((o) => o.status === "Fulfilled");
  if (fulfilled.length === 0) {
    return <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No fulfilled orders</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr style={{ color: "var(--c2-text-muted)" }}>
          <th className="text-left py-1 font-semibold">Customer</th>
          <th className="text-left py-1 font-semibold">Items</th>
          <th className="text-right py-1 font-semibold">Value</th>
        </tr>
      </thead>
      <tbody>
        {fulfilled
          .sort((a, b) => parseTotal(b.totalValue) - parseTotal(a.totalValue))
          .map((o) => (
            <tr
              key={o.id}
              className="cursor-pointer hover:brightness-110"
              style={{ borderTop: "1px solid var(--c2-border-subtle)" }}
              onClick={() => {
                onSelectOrder(o.id);
                onNavigateToOrder?.(o.id);
              }}
            >
              <td className="py-1" style={{ color: "var(--c2-text)" }}>{o.customerName || "Customer"}</td>
              <td className="py-1" style={{ color: "var(--c2-text-muted)" }}>{o.cart?.length || 0}</td>
              <td className="py-1 text-right font-semibold" style={{ color: "#10b981" }}>
                ₹{parseTotal(o.totalValue).toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function ActiveTable({ orders, onSelectOrder }: { orders: Order[]; onSelectOrder: (id: string) => void }) {
  const active = orders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected");
  if (active.length === 0) {
    return <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No active orders</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr style={{ color: "var(--c2-text-muted)" }}>
          <th className="text-left py-1 font-semibold">Customer</th>
          <th className="text-left py-1 font-semibold">Status</th>
          <th className="text-right py-1 font-semibold">Value</th>
        </tr>
      </thead>
      <tbody>
        {active.map((o) => (
          <tr
            key={o.id}
            className="cursor-pointer hover:brightness-110"
            style={{ borderTop: "1px solid var(--c2-border-subtle)" }}
            onClick={() => onSelectOrder(o.id)}
          >
            <td className="py-1" style={{ color: "var(--c2-text)" }}>{o.customerName || "Customer"}</td>
            <td className="py-1">
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{
                  background: `${
                    o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6"
                  }20`,
                  color: o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6",
                }}
              >
                {o.status}
              </span>
            </td>
            <td className="py-1 text-right font-semibold" style={{ color: "var(--c2-text)" }}>
              ₹{parseTotal(o.totalValue).toLocaleString("en-IN")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersList({ users }: { users: PresenceDoc[] }) {
  if (users.length === 0) {
    return <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No users online</div>;
  }
  return (
    <div className="space-y-1">
      {users.map((u) => (
        <div
          key={u.uid}
          className="flex items-center gap-2 py-1"
          style={{ borderTop: "1px solid var(--c2-border-subtle)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-[10px] font-medium truncate" style={{ color: "var(--c2-text)" }}>
            {u.displayName || u.email || "User"}
          </span>
        </div>
      ))}
    </div>
  );
}

function FulfillmentBreakdown({ orders }: { orders: Order[] }) {
  const total = orders.length;
  const statuses = [
    { label: "Fulfilled", count: orders.filter((o) => o.status === "Fulfilled").length, color: "#10b981" },
    { label: "Shipped", count: orders.filter((o) => o.status === "Shipped").length, color: "#8b5cf6" },
    { label: "Accepted", count: orders.filter((o) => o.status === "Accepted").length, color: "#3b82f6" },
    { label: "Pending", count: orders.filter((o) => o.status === "Pending").length, color: "#f59e0b" },
    { label: "Rejected", count: orders.filter((o) => o.status === "Rejected").length, color: "#ef4444" },
  ];
  return (
    <div className="space-y-1.5">
      {statuses.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="text-[10px] flex-1" style={{ color: "var(--c2-text-secondary)" }}>{s.label}</span>
          <span className="text-[10px] font-bold" style={{ color: "var(--c2-text)" }}>{s.count}</span>
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c2-bg-secondary)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${total > 0 ? (s.count / total) * 100 : 0}%`,
                background: s.color,
              }}
            />
          </div>
          <span className="text-[9px] w-8 text-right" style={{ color: "var(--c2-text-muted)" }}>
            {total > 0 ? Math.round((s.count / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

function PendingTable({ orders }: { orders: Order[] }) {
  const pending = orders.filter((o) => o.status !== "Fulfilled" && o.status !== "Rejected");
  if (pending.length === 0) {
    return <div className="text-[10px] py-2" style={{ color: "var(--c2-text-muted)" }}>No pending revenue</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr style={{ color: "var(--c2-text-muted)" }}>
          <th className="text-left py-1 font-semibold">Customer</th>
          <th className="text-left py-1 font-semibold">Status</th>
          <th className="text-right py-1 font-semibold">Value</th>
        </tr>
      </thead>
      <tbody>
        {pending.map((o) => (
          <tr key={o.id} style={{ borderTop: "1px solid var(--c2-border-subtle)" }}>
            <td className="py-1" style={{ color: "var(--c2-text)" }}>{o.customerName || "Customer"}</td>
            <td className="py-1">
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{
                  background: `${
                    o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6"
                  }20`,
                  color: o.status === "Pending" ? "#f59e0b" : o.status === "Accepted" ? "#3b82f6" : "#8b5cf6",
                }}
              >
                {o.status}
              </span>
            </td>
            <td className="py-1 text-right font-semibold" style={{ color: "#f97316" }}>
              ₹{parseTotal(o.totalValue).toLocaleString("en-IN")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
