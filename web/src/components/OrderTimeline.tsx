"use client";

import React from "react";
import { Order } from "@/types/order";

export function formatStatusTime(timestamp: unknown): string {
  if (!timestamp) return "";
  try {
    const ts = timestamp as { toDate?: () => Date };
    const date = ts.toDate ? ts.toDate() : new Date(timestamp as string);
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function StatusTimeline({ order }: { order: Order }) {
  if (order.status === "Rejected") {
    return (
      <div className="mt-1.5 px-2 py-1 bg-red-50 rounded text-xs text-red-600">
        Rejected {order.rejectedAt ? `on ${formatStatusTime(order.rejectedAt)}` : ""}
      </div>
    );
  }

  const steps = [
    { key: "placed", label: "Placed", time: order.placedAt || order.createdAt },
    { key: "accepted", label: "Accepted", time: order.acceptedAt },
    { key: "shipped", label: "Shipped", time: order.shippedAt },
    { key: "delivered", label: "Delivered", time: order.deliveredAt },
  ];

  const renderedSteps = steps.map((s) => {
    const timeStr = formatStatusTime(s.time);
    if (!timeStr) {
      return (
        <span key={s.key} className="text-slate-300 text-[11px]">
          &rarr; {s.label}
        </span>
      );
    }
    const isActive =
      s.key === (order.status || "Pending").toLowerCase() ||
      (s.key === "delivered" && order.status === "Fulfilled");
    return (
      <span
        key={s.key}
        className={`px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${
          isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        &#10003; {s.label}: {timeStr}
      </span>
    );
  });

  const completedCount = steps.filter((s) => formatStatusTime(s.time)).length;
  if (completedCount <= 1) return null;

  return <div className="mt-1.5 flex flex-wrap gap-1 items-center">{renderedSteps}</div>;
}
