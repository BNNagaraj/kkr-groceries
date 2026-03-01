import { Order } from "@/types/order";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ─── colour palette (matches email template) ─── */
const GREEN_DARK = "#064e3b";
const GREEN_MID = "#047857";
const GREEN_LIGHT = "#059669";
const GREEN_BG = "#f0fdf4";
const GREEN_BORDER = "#dcfce7";
const SLATE_900 = "#1e293b";
const SLATE_500 = "#64748b";
const SLATE_300 = "#94a3b8";
const WHITE = "#ffffff";

/* ─── helpers ─── */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function formatCurrency(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

function formatDate(order: Order): string {
  if (order.timestamp) return order.timestamp;
  if (order.createdAt?.toDate) {
    return order.createdAt.toDate().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Date().toLocaleString("en-IN");
}

function getDateForFilename(order: Order): string {
  let d: Date;
  if (order.createdAt?.toDate) {
    d = order.createdAt.toDate();
  } else if (order.timestamp) {
    d = new Date(order.timestamp);
  } else {
    d = new Date();
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ─── status badge colours ─── */
function getStatusStyle(status: string): {
  bg: [number, number, number];
  fg: [number, number, number];
  label: string;
} {
  switch (status) {
    case "Accepted":
      return { bg: [219, 234, 254], fg: [37, 99, 235], label: "ACCEPTED" };
    case "Fulfilled":
      return { bg: [220, 252, 231], fg: [5, 150, 105], label: "FULFILLED" };
    case "Rejected":
      return { bg: [254, 226, 226], fg: [220, 38, 38], label: "REJECTED" };
    default:
      return { bg: [254, 243, 199], fg: [146, 64, 14], label: "PENDING" };
  }
}

/* ══════════════════════════════════════════════
   PDF INVOICE GENERATOR
   ══════════════════════════════════════════════ */
export function downloadInvoice(order: Order): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ─── HEADER (green gradient bar) ───
  doc.setFillColor(...hexToRgb(GREEN_DARK));
  doc.rect(0, 0, pageW, 38, "F");
  // lighter stripe
  doc.setFillColor(...hexToRgb(GREEN_MID));
  doc.rect(0, 32, pageW, 6, "F");

  // Brand name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...hexToRgb(WHITE));
  doc.text("KKR Groceries", pageW / 2, 16, { align: "center" });

  // Subtitle
  doc.setFontSize(8);
  doc.setTextColor(167, 243, 208); // #a7f3d0
  doc.text("HYDERABAD B2B WHOLESALE", pageW / 2, 22, { align: "center" });

  // INVOICE label
  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb(WHITE));
  doc.text("TAX INVOICE", pageW / 2, 30, { align: "center" });

  y = 46;

  // ─── ORDER ID BAR ───
  doc.setFillColor(...hexToRgb(GREEN_BG));
  doc.roundedRect(margin, y, contentW, 20, 3, 3, "F");
  doc.setDrawColor(...hexToRgb(GREEN_BORDER));
  doc.roundedRect(margin, y, contentW, 20, 3, 3, "S");

  // Order ID (left)
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(GREEN_MID));
  doc.setFont("helvetica", "bold");
  doc.text("ORDER ID", margin + 6, y + 7);
  doc.setFontSize(12);
  doc.setTextColor(...hexToRgb(GREEN_DARK));
  doc.text(order.orderId || order.id, margin + 6, y + 15);

  // Status badge (centre-right)
  const statusStyle = getStatusStyle(order.status || "Pending");
  const badgeX = pageW / 2 + 10;
  doc.setFillColor(...statusStyle.bg);
  doc.roundedRect(badgeX, y + 5, 30, 10, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(...statusStyle.fg);
  doc.setFont("helvetica", "bold");
  doc.text(statusStyle.label, badgeX + 15, y + 12, { align: "center" });

  // Date + item count (right)
  const cart =
    order.revisedFulfilledCart ||
    order.revisedAcceptedCart ||
    order.cart ||
    [];
  const itemCount = cart.length;
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(GREEN_MID));
  doc.text("DATE", pageW - margin - 6, y + 7, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(SLATE_900));
  doc.text(formatDate(order), pageW - margin - 6, y + 15, { align: "right" });

  y += 28;

  // ─── CUSTOMER DETAILS SECTION ───
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(GREEN_MID));
  doc.setFont("helvetica", "bold");
  doc.text("DELIVERY DETAILS", margin, y);
  y += 3;

  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.roundedRect(margin, y, contentW, 36, 3, 3, "F");

  const detailsCol1 = margin + 6;
  const detailsCol2 = pageW / 2 + 4;

  // Row 1: Customer name + Phone
  y += 8;
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(SLATE_300));
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER", detailsCol1, y);
  doc.text("PHONE", detailsCol2, y);

  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(SLATE_900));
  doc.setFont("helvetica", "bold");
  doc.text(order.customerName || "N/A", detailsCol1, y);
  doc.text(order.phone || "N/A", detailsCol2, y);

  // Row 2: Shop + Address
  y += 8;
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(SLATE_300));
  doc.setFont("helvetica", "bold");
  if (order.shopName && order.shopName !== "Not specified") {
    doc.text("SHOP / BUSINESS", detailsCol1, y);
  }
  doc.text("DELIVERY ADDRESS", detailsCol2, y);

  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(SLATE_900));
  doc.setFont("helvetica", "bold");
  if (order.shopName && order.shopName !== "Not specified") {
    doc.text(order.shopName, detailsCol1, y);
  }

  // Wrap address text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addressLines = doc.splitTextToSize(
    order.location || "N/A",
    contentW / 2 - 10
  );
  doc.text(addressLines, detailsCol2, y);

  // Calculate where the details box ends
  const detailsBoxEndY = y + Math.max(addressLines.length * 4, 4) + 4;

  y = detailsBoxEndY + 6;

  // ─── ORDER ITEMS TABLE ───
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(GREEN_MID));
  doc.setFont("helvetica", "bold");
  doc.text("ORDER ITEMS", margin, y);
  y += 3;

  let calculatedTotal = 0;
  const tableRows = cart.map((item, i) => {
    const amount = item.qty * item.price;
    calculatedTotal += amount;
    const nameStr = [item.name, item.telugu, item.hindi]
      .filter(Boolean)
      .join(" / ");
    return [
      (i + 1).toString(),
      nameStr,
      item.qty.toString(),
      item.unit,
      formatCurrency(item.price),
      formatCurrency(amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Item", "Qty", "Unit", "Price", "Amount"]],
    body: tableRows,
    theme: "plain",
    headStyles: {
      fillColor: hexToRgb(GREEN_DARK),
      textColor: hexToRgb(WHITE),
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
      halign: "left",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 16, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "right", cellWidth: 24 },
      5: {
        halign: "right",
        cellWidth: 28,
        fontStyle: "bold",
        textColor: hexToRgb(GREEN_MID),
      },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: hexToRgb(SLATE_900),
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      lineColor: [241, 245, 249],
      lineWidth: 0.3,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── TOTAL AMOUNT BAR ───
  doc.setFillColor(...hexToRgb(GREEN_DARK));
  doc.roundedRect(margin, y, contentW, 16, 3, 3, "F");
  // lighter gradient overlay on right side
  doc.setFillColor(...hexToRgb(GREEN_MID));
  doc.roundedRect(pageW / 2, y, contentW / 2 + margin - pageW / 2, 16, 0, 0, "F");
  // re-draw rounded right corners
  doc.setFillColor(...hexToRgb(GREEN_MID));
  doc.roundedRect(pageW - margin - 30, y, 30, 16, 3, 3, "F");

  doc.setFontSize(10);
  doc.setTextColor(167, 243, 208);
  doc.setFont("helvetica", "bold");
  doc.text("Total Amount", margin + 8, y + 10);

  doc.setFontSize(16);
  doc.setTextColor(...hexToRgb(WHITE));
  doc.text(
    order.totalValue || formatCurrency(calculatedTotal),
    pageW - margin - 8,
    y + 11,
    { align: "right" }
  );

  y += 24;

  // ─── ITEMS SUMMARY ───
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(SLATE_500));
  doc.setFont("helvetica", "normal");
  doc.text(
    `${itemCount} item${itemCount !== 1 ? "s" : ""} | ${order.orderSummary || ""}`,
    pageW / 2,
    y,
    { align: "center" }
  );

  y += 10;

  // ─── FOOTER ───
  // Check if we need more space for footer — add page if needed
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 30) {
    doc.addPage();
    y = 20;
  }

  // Footer separator
  doc.setDrawColor(...hexToRgb(GREEN_BORDER));
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(GREEN_MID));
  doc.setFont("helvetica", "bold");
  doc.text("KKR Groceries", pageW / 2, y, { align: "center" });
  y += 4;
  doc.setTextColor(...hexToRgb(SLATE_500));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    "Hyderabad B2B Vegetable Wholesale",
    pageW / 2,
    y,
    { align: "center" }
  );
  y += 4;
  doc.setTextColor(...hexToRgb(SLATE_300));
  doc.text("Thank you for choosing KKR Groceries!", pageW / 2, y, {
    align: "center",
  });

  // ─── DOWNLOAD ───
  const orderId = order.orderId || order.id;
  const dateStr = getDateForFilename(order);
  const filename = `${orderId}_${dateStr}.pdf`;

  doc.save(filename);
}
