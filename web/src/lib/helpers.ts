/** Safely extract a numeric value from totalValue (can be string "₹1,234" or number 1234) */
export function parseTotal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
  return 0;
}

/** Format a number as Indian Rupee currency string */
export function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Convert a Date to "YYYY-MM-DD" string */
export function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
