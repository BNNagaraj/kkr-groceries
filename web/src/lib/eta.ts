/**
 * Delivery ETA / SLA engine (client-side).
 *
 * Projects a delivery time for each active order from the fleet's learned
 * "minutes per stop" (see the self-learning flywheel in functions/delivery.js,
 * which writes settings/deliveryModel) and flags orders at risk of breaching
 * the SLA window. Pure functions — no I/O — so both the rider console and the
 * admin cockpit can share the same logic.
 */

import type { Order } from "@/types/order";

export interface DeliveryModel {
  perStopMin: number; // learned average minutes to clear one stop (travel + wait + service)
  slaMinutes: number; // promised delivery window, measured from assignment
  sampleCount?: number;
  updatedAt?: unknown;
}

/** Sensible fallback until the flywheel has accumulated samples. */
export const DEFAULT_MODEL: DeliveryModel = { perStopMin: 20, slaMinutes: 90 };

export type EtaRisk = "ontime" | "at_risk" | "late";

export interface EtaResult {
  etaMin: number; // minutes from now until this stop is projected done
  etaAt: number; // absolute projected completion time (ms epoch)
  risk: EtaRisk;
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
  const t = v as { toMillis?: () => number };
  if (typeof t.toMillis === "function") return t.toMillis();
  return null;
}

/**
 * Rank each active order within its rider's remaining queue (1-based), in the
 * sequence the rider will actually work them: batched stops in optimised order
 * first, then by assignment/creation time. Returns a map of orderId → rank.
 */
export function rankRiderQueues(activeOrders: Order[]): Map<string, number> {
  const byRider: Record<string, Order[]> = {};
  for (const o of activeOrders) {
    const rider = o.assignedTo || "_unassigned";
    (byRider[rider] = byRider[rider] || []).push(o);
  }
  const ranks = new Map<string, number>();
  for (const list of Object.values(byRider)) {
    list.sort((a, b) => {
      const ab = a.batchId || "";
      const bb = b.batchId || "";
      if (ab !== bb) return ab < bb ? -1 : 1;
      if (a.batchId) return (a.batchStopIndex ?? 0) - (b.batchStopIndex ?? 0);
      const at = toMillis(a.assignedAt) ?? toMillis(a.createdAt) ?? 0;
      const bt = toMillis(b.assignedAt) ?? toMillis(b.createdAt) ?? 0;
      return at - bt;
    });
    list.forEach((o, i) => ranks.set(o.id, i + 1));
  }
  return ranks;
}

/**
 * Project the ETA + SLA risk for a single order.
 * @param rankInQueue 1-based position in the rider's remaining queue.
 */
export function computeEta(
  rankInQueue: number,
  assignedAtMs: number | null,
  model: DeliveryModel,
  now: number = Date.now()
): EtaResult {
  const perStop = model.perStopMin > 0 ? model.perStopMin : DEFAULT_MODEL.perStopMin;
  const etaMin = Math.max(0, Math.round(rankInQueue * perStop));
  const etaAt = now + etaMin * 60_000;
  const sla = model.slaMinutes > 0 ? model.slaMinutes : DEFAULT_MODEL.slaMinutes;

  let risk: EtaRisk = "ontime";
  if (assignedAtMs) {
    const deadline = assignedAtMs + sla * 60_000;
    if (now > deadline) risk = "late";
    else if (etaAt > deadline) risk = "at_risk";
  }
  return { etaMin, etaAt, risk };
}

/** Convenience: compute ETA for an order given the precomputed queue ranks. */
export function orderEta(order: Order, ranks: Map<string, number>, model: DeliveryModel, now?: number): EtaResult {
  const rank = ranks.get(order.id) ?? 1;
  return computeEta(rank, toMillis(order.assignedAt), model, now);
}

/** Human label for an ETA (e.g. "~25m"). */
export function etaLabel(etaMin: number): string {
  if (etaMin < 1) return "now";
  if (etaMin < 60) return `~${etaMin}m`;
  const h = Math.floor(etaMin / 60);
  const m = etaMin % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}
