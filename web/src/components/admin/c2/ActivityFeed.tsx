"use client";

import React, { useEffect, useRef, useState } from "react";
import type { C2Theme } from "../CommandCenter";
import { Order, OrderStatus } from "@/types/order";
import { parseTotal } from "@/lib/helpers";

// ─── Event Types ──────────────────────────────────────────────────────────
interface C2Event {
  id: string;
  time: string;
  type: "new_order" | "status_change" | "user_online" | "alert";
  emoji: string;
  label: string;
  detail: string;
  color: string;
}

const STATUS_EMOJI: Record<string, string> = {
  Pending: "\uD83D\uDFE2",
  Accepted: "\u2705",
  Shipped: "\uD83D\uDCE6",
  Fulfilled: "\u2728",
  Rejected: "\uD83D\uDEAB",
};

const STATUS_LABEL: Record<string, string> = {
  Pending: "NEW ORDER",
  Accepted: "ACCEPTED",
  Shipped: "SHIPPED",
  Fulfilled: "FULFILLED",
  Rejected: "REJECTED",
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "#22c55e",
  Accepted: "#3b82f6",
  Shipped: "#8b5cf6",
  Fulfilled: "#10b981",
  Rejected: "#ef4444",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const parseOrderTotal = parseTotal;

// ─── Activity Feed Component ──────────────────────────────────────────────
interface ActivityFeedProps {
  orders: Order[];
  onlineUsers: { uid: string; displayName: string | null; email: string | null; location?: string }[];
  theme: C2Theme;
}

export default function ActivityFeed({ orders, onlineUsers }: ActivityFeedProps) {
  const [events, setEvents] = useState<C2Event[]>([]);
  const prevOrdersRef = useRef<Map<string, OrderStatus>>(new Map());
  const prevOnlineRef = useRef<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (orders.length === 0) return;
    const prevMap = prevOrdersRef.current;
    const now = new Date();
    const newEvents: C2Event[] = [];

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const map = new Map<string, OrderStatus>();
      orders.forEach((o) => map.set(o.id, o.status || "Pending"));
      prevOrdersRef.current = map;
      return;
    }

    orders.forEach((order) => {
      const prevStatus = prevMap.get(order.id);
      const currentStatus = order.status || "Pending";

      if (!prevStatus) {
        const total = parseOrderTotal(order.totalValue);
        newEvents.push({
          id: `${order.id}-new-${Date.now()}`,
          time: formatTime(now),
          type: "new_order",
          emoji: "\uD83D\uDFE2",
          label: "NEW ORDER",
          detail: `${order.orderId?.slice(-8) || "..."} from ${order.customerName || "Customer"} \u2014 \u20B9${total.toLocaleString("en-IN")}`,
          color: "#22c55e",
        });
      } else if (prevStatus !== currentStatus) {
        newEvents.push({
          id: `${order.id}-${currentStatus}-${Date.now()}`,
          time: formatTime(now),
          type: "status_change",
          emoji: STATUS_EMOJI[currentStatus] || "\u26AA",
          label: STATUS_LABEL[currentStatus] || currentStatus.toUpperCase(),
          detail: `${order.orderId?.slice(-8) || "..."} ${currentStatus === "Shipped" ? "to" : currentStatus === "Fulfilled" ? "delivered to" : "for"} ${order.customerName || "Customer"}${order.location ? ` \u2022 ${order.location}` : ""}`,
          color: STATUS_COLOR[currentStatus] || "#94a3b8",
        });
      }
    });

    const map = new Map<string, OrderStatus>();
    orders.forEach((o) => map.set(o.id, o.status || "Pending"));
    prevOrdersRef.current = map;

    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
    }
  }, [orders]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    const prevSet = prevOnlineRef.current;
    const now = new Date();
    const newEvents: C2Event[] = [];
    onlineUsers.forEach((u) => {
      if (!prevSet.has(u.uid)) {
        newEvents.push({
          id: `user-${u.uid}-${Date.now()}`,
          time: formatTime(now),
          type: "user_online",
          emoji: "\uD83D\uDC64",
          label: "USER ONLINE",
          detail: `${u.displayName || u.email || u.uid.slice(0, 8)}${u.location ? ` \u2022 ${u.location}` : ""}`,
          color: "#22c55e",
        });
      }
    });
    prevOnlineRef.current = new Set(onlineUsers.map((u) => u.uid));
    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
    }
  }, [onlineUsers]);

  useEffect(() => {
    if (!isHovering && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events, isHovering]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-2.5 sm:px-4 py-2.5 sm:py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--c2-border)" }}
      >
        <h3 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2" style={{ color: "var(--c2-text)" }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          Activity Feed
        </h3>
        <span className="text-[10px] font-mono" style={{ color: "var(--c2-text-muted)" }}>
          {events.length} events
        </span>
      </div>

      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto no-scrollbar"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12" style={{ color: "var(--c2-text-muted)" }}>
            <div className="text-2xl mb-2 opacity-30">&#x1F4E1;</div>
            <div className="text-[11px]">Monitoring for activity...</div>
            <div className="text-[10px] mt-1" style={{ color: "var(--c2-text-muted)", opacity: 0.5 }}>
              Events will appear here in real-time
            </div>
          </div>
        ) : (
          <div>
            {events.map((event) => (
              <div
                key={event.id}
                className="px-2.5 sm:px-4 py-2 sm:py-2.5 transition-colors group"
                style={{ borderBottom: "1px solid var(--c2-border-subtle)" }}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span
                    className="text-[10px] font-mono shrink-0 pt-0.5 w-12 sm:w-16 tabular-nums"
                    style={{ color: "var(--c2-text-muted)" }}
                  >
                    {event.time}
                  </span>
                  <span className="text-sm shrink-0">{event.emoji}</span>
                  <div className="min-w-0 flex-1 break-words">
                    <span className="text-[10px] font-bold tracking-widest mr-2" style={{ color: event.color }}>
                      {event.label}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--c2-text-secondary)" }}>
                      {event.detail}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
