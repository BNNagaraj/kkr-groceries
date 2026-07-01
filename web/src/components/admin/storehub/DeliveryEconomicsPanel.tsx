"use client";

import React, { useMemo, useState } from "react";
import { Order } from "@/types/order";
import { DeliveryModel } from "@/lib/eta";
import { IndianRupee, Wallet, TrendingDown, MapPin } from "lucide-react";

function orderValue(o: Order): number {
  return Math.round(Number(String(o.totalValue || "0").replace(/[^0-9.]/g, "")) || 0);
}

/**
 * Delivery unit economics — the cost/margin of every drop.
 *
 * Delivery cost per order is derived from the fleet's learned minutes-per-stop
 * and a configurable rider cost/hour (rider wage + vehicle/fuel allocation).
 * "Delivery margin" = order value − delivery cost. It does NOT subtract COGS
 * (goods cost isn't in the order model), so it's contribution *after delivery*,
 * not net profit — labelled as such.
 */
export default function DeliveryEconomicsPanel({ orders, model }: { orders: Order[]; model: DeliveryModel }) {
  const [riderCostPerHour, setRiderCostPerHour] = useState(120); // ₹/hour, editable

  const econ = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "Fulfilled");
    if (delivered.length === 0) return null;

    const perStop = model.perStopMin > 0 ? model.perStopMin : 20;
    const costPerDelivery = (perStop / 60) * riderCostPerHour;

    let revenue = 0;
    const byZone: Record<string, { count: number; revenue: number }> = {};
    for (const o of delivered) {
      const v = orderValue(o);
      revenue += v;
      const zone = o.pincode || "—";
      const z = (byZone[zone] = byZone[zone] || { count: 0, revenue: 0 });
      z.count += 1;
      z.revenue += v;
    }

    const count = delivered.length;
    const totalDeliveryCost = costPerDelivery * count;
    const avgOrderValue = revenue / count;
    const costPct = revenue > 0 ? (totalDeliveryCost / revenue) * 100 : 0;
    const marginAfterDelivery = revenue - totalDeliveryCost;

    const zones = Object.entries(byZone)
      .map(([zone, z]) => ({
        zone,
        count: z.count,
        revenue: z.revenue,
        cost: costPerDelivery * z.count,
        margin: z.revenue - costPerDelivery * z.count,
        costPct: z.revenue > 0 ? (costPerDelivery * z.count / z.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { count, costPerDelivery, totalDeliveryCost, avgOrderValue, costPct, marginAfterDelivery, revenue, zones };
  }, [orders, model, riderCostPerHour]);

  if (!econ) return null;

  const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <IndianRupee className="w-3.5 h-3.5" /> Delivery Unit Economics
        </h3>
        <label className="text-[11px] text-slate-500 flex items-center gap-1.5">
          Rider cost/hr ₹
          <input
            type="number"
            value={riderCostPerHour}
            onChange={(e) => setRiderCostPerHour(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 px-2 py-1 rounded border border-slate-200 text-right font-semibold text-slate-700"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Kpi label="Cost / delivery" value={rupee(econ.costPerDelivery)} icon={<Wallet className="w-4 h-4 text-blue-600" />} />
        <Kpi label="Avg order value" value={rupee(econ.avgOrderValue)} icon={<IndianRupee className="w-4 h-4 text-emerald-600" />} />
        <Kpi label="Delivery cost %" value={`${econ.costPct.toFixed(1)}%`} icon={<TrendingDown className="w-4 h-4 text-amber-600" />} />
        <Kpi label={`Margin (${econ.count} drops)`} value={rupee(econ.marginAfterDelivery)} icon={<Wallet className="w-4 h-4 text-purple-600" />} />
      </div>

      {econ.zones.length > 0 && (
        <div className="border-t border-slate-100 pt-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Top zones by volume
          </div>
          <div className="space-y-1">
            {econ.zones.map((z) => (
              <div key={z.zone} className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-700 w-14 truncate">{z.zone}</span>
                <span className="text-slate-400">{z.count} drops</span>
                <span className="text-emerald-700 ml-auto">{rupee(z.revenue)}</span>
                <span className={`w-14 text-right font-semibold ${z.costPct > 15 ? "text-red-600" : "text-slate-500"}`}>
                  {z.costPct.toFixed(0)}% cost
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="text-[10px] text-slate-400 mt-2">
        Delivery margin = revenue − delivery cost (excludes goods cost). Cost uses learned ~{model.perStopMin}m/stop.
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2.5">
      <div className="mb-1">{icon}</div>
      <div className="text-lg font-bold text-slate-800 leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
