import { Timestamp } from "firebase/firestore";

/**
 * Convert a value that could be a Firestore Timestamp, a Date, an ISO string,
 * or a numeric epoch into milliseconds since the epoch.
 *
 * Returns 0 for null/undefined/unparseable input — the same convention used
 * throughout the codebase for ordering "missing" alongside oldest items.
 *
 * Replaces the various ad-hoc `(value as any).toDate()` casts that used to
 * be sprinkled across components. Prefer this helper any time you need to
 * sort or compare temporal values that round-trip through Firestore.
 */
export function toMillis(v: unknown): number {
  if (v == null) return 0;
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const parsed = new Date(v).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
