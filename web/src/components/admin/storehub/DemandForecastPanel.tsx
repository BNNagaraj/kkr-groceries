"use client";

import React, { useMemo } from "react";
import { Order } from "@/types/order";
import { DeliveryModel } from "@/lib/eta";
import { TrendingUp, Users, CalendarDays } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Demand & capacity forecast — descriptive (not ML): learns the typical order
 * volume per weekday from loaded history and projects how many riders today's
 * expected volume needs, using the fleet's learned throughput (perStopMin).
 * Kills both idle riders and delivery backlogs without any model training.
 */
export default function DemandForecastPanel({ orders, model }: { orders: Order[]; model: DeliveryModel }) {
  const forecast = useMemo(() => {
    // Count orders per weekday and track distinct calendar days seen (to average).
    const perWeekdayCount = new Array(7).fill(0);
    const daysSeen: Record<number, Set<string>> = {};
    for (let i = 0; i < 7; i++) daysSeen[i] = new Set();

    let earliest: number | null = null;
    for (const o of orders) {
      const d = toDate(o.createdAt) || toDate(o.placedAt);
      if (!d) continue;
      const wd = d.getDay();
      perWeekdayCount[wd] += 1;
      daysSeen[wd].add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      const ms = d.getTime();
      if (earliest === null || ms < earliest) earliest = ms;
    }

    // Average orders on a given weekday = total / number of that weekday observed.
    const avgPerWeekday = perWeekdayCount.map((c, wd) => {
      const n = daysSeen[wd].size || 0;
      return n > 0 ? c / n : 0;
    });

    const todayWd = new Date().getDay();
    const expectedToday = Math.round(avgPerWeekday[todayWd]);

    // Rider need: throughput per rider (orders/hour) = 60 / perStopMin.
    // Assume a ~4h delivery window/day; ceil to whole riders.
    const perStop = model.perStopMin > 0 ? model.perStopMin : 20;
    const ordersPerRiderPerHour = 60 / perStop;
    const windowHours = 4;
    const capacityPerRider = ordersPerRiderPerHour * windowHours;
    const ridersNeeded = expectedToday > 0 ? Math.max(1, Math.ceil(expectedToday / capacityPerRider)) : 0;

    const maxAvg = Math.max(1, ...avgPerWeekday);
    const weeksObserved = earliest ? Math.max(1, Math.round((Date.now() - earliest) / (7 * 86_400_000))) : 0;

    return { avgPerWeekday, todayWd, expectedToday, ridersNeeded, maxAvg, capacityPerRider, weeksObserved };
  }, [orders, model]);

  if (forecast.weeksObserved === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Demand & Capacity Forecast
        </h3>
        <span className="text-[10px] text-slate-400">from ~{forecast.weeksObserved} week(s) of history</span>
      </div>

      {/* Today's projection */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold mb-0.5">
            <CalendarDays className="w-3.5 h-3.5" /> Expected today ({WEEKDAYS[forecast.todayWd]})
          </div>
          <div className="text-2xl font-extrabold text-slate-800 leading-none">{forecast.expectedToday}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">orders</div>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold mb-0.5">
            <Users className="w-3.5 h-3.5" /> Riders recommended
          </div>
          <div className="text-2xl font-extrabold text-slate-800 leading-none">{forecast.ridersNeeded}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">~{Math.round(forecast.capacityPerRider)} orders/rider·day</div>
        </div>
      </div>

      {/* Weekday demand bars */}
      <div className="flex items-end gap-2 h-24">
        {forecast.avgPerWeekday.map((avg, wd) => {
          const h = Math.round((avg / forecast.maxAvg) * 100);
          const isToday = wd === forecast.todayWd;
          return (
            <div key={wd} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[9px] text-slate-400 font-semibold">{avg >= 0.5 ? Math.round(avg) : ""}</div>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${isToday ? "bg-blue-500" : "bg-slate-200"}`}
                  style={{ height: `${Math.max(4, h)}%` }}
                  title={`${WEEKDAYS[wd]}: avg ${avg.toFixed(1)} orders`}
                />
              </div>
              <div className={`text-[10px] font-medium ${isToday ? "text-blue-600 font-bold" : "text-slate-400"}`}>
                {WEEKDAYS[wd]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
