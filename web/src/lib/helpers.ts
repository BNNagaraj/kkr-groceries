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

/** Get display name for a customer: shopName (if real) → customerName → fallback */
export function getDisplayName(order: { shopName?: string; customerName?: string }, fallback = "Unknown"): string {
  const shop = order.shopName?.trim();
  if (shop && shop.toLowerCase() !== "not specified") return shop;
  const name = order.customerName?.trim();
  if (name) return name;
  return fallback;
}

/** Convert a Date to "YYYY-MM-DD" string */
export function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Export an array of orders to a CSV file and trigger download */
export function exportOrdersToCSV(
  orders: {
    orderId?: string;
    customerName?: string;
    phone?: string;
    shopName?: string;
    location?: string;
    cart?: { name: string; qty: number; unit: string; price: number }[];
    totalValue?: unknown;
    status?: string;
    timestamp?: string;
  }[],
  filename?: string
) {
  const headers = ["OrderID", "Customer", "Phone", "Shop", "Location", "Items", "Total", "Status", "Date"];

  function escapeCSV(val: string): string {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  const rows = orders.map((o) => {
    const items = (o.cart || []).map((c) => `${c.name} x${c.qty}`).join("; ");
    const total = parseTotal(o.totalValue);
    return [
      o.orderId || "",
      o.customerName || "",
      o.phone || "",
      o.shopName || "",
      o.location || "",
      items,
      total.toString(),
      o.status || "",
      o.timestamp?.split(",")[0] || "",
    ]
      .map(escapeCSV)
      .join(",");
  });

  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `orders-${dateToYMD(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
