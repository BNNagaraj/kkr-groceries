import { Order } from "@/types/order";

export function generateInvoice(order: Order): string {
  const invoiceDate = order.timestamp || new Date().toLocaleString("en-IN");
  const sep = "═══════════════════════════════════════════════════════════════";
  const line = "───────────────────────────────────────────────────────────────";

  const lines: string[] = [
    sep,
    "                           KKR GROCERIES                        ",
    "                           ORDER INVOICE                        ",
    sep,
    "",
    `Order ID:    ${order.orderId || order.id}`,
    `Date:        ${invoiceDate}`,
    `Status:      ${order.status || "Pending"}`,
    "",
    line,
    "                     CUSTOMER DETAILS                           ",
    line,
    `Name:    ${order.customerName || "N/A"}`,
    `Phone:   ${order.phone || "N/A"}`,
    `Shop:    ${order.shopName || "N/A"}`,
    `Address: ${order.location || "N/A"}`,
    "",
    line,
    "                     ORDER ITEMS                                ",
    line,
  ];

  const cart = order.revisedFulfilledCart || order.revisedAcceptedCart || order.cart || [];
  let calculatedTotal = 0;

  cart.forEach((item, index) => {
    const amount = item.qty * item.price;
    calculatedTotal += amount;
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(
      `    ${item.unit} | Qty: ${item.qty} x ₹${item.price.toLocaleString("en-IN")} = ₹${amount.toLocaleString("en-IN")}`
    );
  });

  lines.push("");
  lines.push(line);
  lines.push(`TOTAL: ${order.totalValue || "₹" + calculatedTotal.toLocaleString("en-IN")}`);
  lines.push(line);
  lines.push("");
  lines.push("Thank you for shopping with KKR Groceries!");
  lines.push("");
  lines.push(sep);

  return lines.join("\n");
}

export function downloadInvoice(order: Order): void {
  const content = generateInvoice(order);
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `KKR-Invoice-${order.orderId || order.id}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
