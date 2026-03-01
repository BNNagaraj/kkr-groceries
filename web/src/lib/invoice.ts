import { Order } from "@/types/order";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ══════════════════════════════════════════════════════════════════
   KKR GROCERIES — PROFESSIONAL INVOICE / BILL GENERATOR
   Indian Standard compliant (GST Act Sec 31, Rules 46/49)
   ══════════════════════════════════════════════════════════════════ */

/* ─── Colour palette (matches email template) ─── */
const C = {
  greenDark: "#064e3b",
  greenMid: "#047857",
  greenLight: "#059669",
  greenBg: "#f0fdf4",
  greenBorder: "#dcfce7",
  greenMint: "#a7f3d0",
  slate900: "#1e293b",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  red: "#dc2626",
  redBg: "#fee2e2",
  amber: "#92400e",
  amberBg: "#fef3c7",
} as const;

/* ─── Seller / Company info ─── */
const SELLER = {
  name: "KKR Groceries",
  tagline: "B2B Vegetable Wholesale",
  address: "Hyderabad, Telangana, India",
  phone: "+91 93472 13498",
  gstin: "Not Registered",          // update when GST-registered
  placeOfSupply: "Telangana (36)",
  stateCode: "36",
};

const IS_GST_REGISTERED = false;    // flip to true when GST applies

/* ─── helpers ─── */
function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
}

function cur(n: number): string {
  return "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function curWhole(n: number): string {
  return "\u20B9" + n.toLocaleString("en-IN");
}

/** Convert number to Indian-English words — "Rupees Twelve Thousand Five Hundred Only" */
function amountInWords(num: number): string {
  if (num === 0) return "Rupees Zero Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const toWords = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + toWords(n % 100) : "");
    if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "");
    return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + toWords(n % 10000000) : "");
  };

  const whole = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - whole) * 100);
  let result = "Rupees " + toWords(whole);
  if (paise > 0) result += " and " + toWords(paise) + " Paise";
  return result + " Only";
}

function formatDate(order: Order): string {
  const d = getOrderDate(order);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(order: Order): string {
  const d = getOrderDate(order);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function getOrderDate(order: Order): Date {
  if (order.createdAt?.toDate) return order.createdAt.toDate();
  if (order.timestamp) return new Date(order.timestamp);
  return new Date();
}

function getDateForFilename(order: Order): string {
  const d = getOrderDate(order);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ─── Document type logic (Indian norms) ─── */
interface DocType {
  title: string;
  subtitle: string;
  disclaimer: string;
  showWatermark: boolean;
}

function getDocumentType(status: string): DocType {
  const isFulfilled = status === "Fulfilled" || status === "Delivered";

  if (isFulfilled) {
    if (IS_GST_REGISTERED) {
      return {
        title: "TAX INVOICE",
        subtitle: "Original for Recipient",
        disclaimer: "",
        showWatermark: false,
      };
    }
    return {
      title: "BILL OF SUPPLY",
      subtitle: "Original for Recipient",
      disclaimer: "Supply by dealer not liable to be registered under GST",
      showWatermark: false,
    };
  }

  // Pending, Accepted, Rejected — always proforma
  return {
    title: "PROFORMA INVOICE",
    subtitle: "Order Estimate — Not a Final Bill",
    disclaimer: "This is not a Tax Invoice / Bill of Supply. For reference only.",
    showWatermark: true,
  };
}

/* ─── Status badge styling ─── */
function getStatusBadge(status: string) {
  switch (status) {
    case "Accepted":
      return { bg: hex(C.blueBg), fg: hex(C.blue), label: "ACCEPTED" };
    case "Fulfilled":
    case "Delivered":
      return { bg: [220, 252, 231] as [number, number, number], fg: hex(C.greenLight), label: "FULFILLED" };
    case "Rejected":
      return { bg: hex(C.redBg), fg: hex(C.red), label: "CANCELLED" };
    default:
      return { bg: hex(C.amberBg), fg: hex(C.amber), label: "PENDING" };
  }
}

/* ══════════════════════════════════════════════════════════════════
   MAIN GENERATOR
   ══════════════════════════════════════════════════════════════════ */
export function downloadInvoice(order: Order): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const M = 14;                                 // margin
  const CW = W - M * 2;                        // content width
  const midX = W / 2;
  let y = 0;

  const cart = order.revisedFulfilledCart || order.revisedAcceptedCart || order.cart || [];
  const status = order.status || "Pending";
  const docType = getDocumentType(status);
  const badge = getStatusBadge(status);
  const orderId = order.orderId || order.id;

  // Compute total
  let calculatedTotal = 0;
  cart.forEach((item) => { calculatedTotal += item.qty * item.price; });

  // Parse total value (from string like "₹12,500")
  const totalNum = (() => {
    if (typeof order.totalValue === "string") {
      const n = parseFloat(order.totalValue.replace(/[^\d.]/g, ""));
      if (!isNaN(n)) return n;
    }
    return calculatedTotal;
  })();

  /* ═══════════════════ PROFORMA WATERMARK ═══════════════════ */
  if (docType.showWatermark) {
    doc.saveGraphicsState();
    // @ts-expect-error - jsPDF GState
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.setTextColor(...hex(C.slate900));
    doc.text("PROFORMA", midX, H / 2, {
      align: "center",
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  /* ═══════════════════ HEADER ═══════════════════ */
  // Dark green header bar
  doc.setFillColor(...hex(C.greenDark));
  doc.rect(0, 0, W, 36, "F");
  // Lighter accent stripe
  doc.setFillColor(...hex(C.greenMid));
  doc.rect(0, 30, W, 6, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...hex(C.white));
  doc.text(SELLER.name, M + 2, 14);

  // Tagline
  doc.setFontSize(8);
  doc.setTextColor(167, 243, 208);
  doc.text(SELLER.tagline.toUpperCase(), M + 2, 20);

  // Seller contact — right side
  doc.setFontSize(7.5);
  doc.setTextColor(...hex(C.white));
  doc.setFont("helvetica", "normal");
  doc.text(SELLER.address, W - M - 2, 10, { align: "right" });
  doc.text("Phone: " + SELLER.phone, W - M - 2, 15, { align: "right" });
  if (IS_GST_REGISTERED) {
    doc.setFont("helvetica", "bold");
    doc.text("GSTIN: " + SELLER.gstin, W - M - 2, 20, { align: "right" });
  }

  // Document title in accent stripe
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...hex(C.white));
  doc.text(docType.title, midX, 34.5, { align: "center" });

  y = 42;

  /* ═══════════════════ DOCUMENT INFO BAR ═══════════════════ */
  doc.setFillColor(...hex(C.greenBg));
  doc.roundedRect(M, y, CW, 18, 2, 2, "F");
  doc.setDrawColor(...hex(C.greenBorder));
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 18, 2, 2, "S");

  const col1 = M + 5;
  const col2 = M + CW * 0.28;
  const col3 = M + CW * 0.56;
  const col4 = M + CW * 0.78;

  // Invoice No
  doc.setFontSize(6.5);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE NO.", col1, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(...hex(C.greenDark));
  doc.text(orderId, col1, y + 12);

  // Date
  doc.setFontSize(6.5);
  doc.setTextColor(...hex(C.greenMid));
  doc.text("DATE", col2, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(...hex(C.slate900));
  doc.text(formatDate(order), col2, y + 12);

  // Place of Supply
  doc.setFontSize(6.5);
  doc.setTextColor(...hex(C.greenMid));
  doc.text("PLACE OF SUPPLY", col3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(...hex(C.slate900));
  doc.text(SELLER.placeOfSupply, col3, y + 12);

  // Status badge
  doc.setFillColor(...badge.bg);
  doc.roundedRect(col4, y + 4, 32, 10, 3, 3, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...badge.fg);
  doc.setFont("helvetica", "bold");
  doc.text(badge.label, col4 + 16, y + 10.5, { align: "center" });

  y += 24;

  /* ═══════════════════ SELLER ↔ BUYER (two columns) ═══════════════════ */
  const halfW = (CW - 4) / 2;
  const boxH = 34;

  // ── FROM (Seller) ──
  doc.setFillColor(...hex(C.slate50));
  doc.roundedRect(M, y, halfW, boxH, 2, 2, "F");

  doc.setFontSize(7);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("FROM", M + 5, y + 6);

  doc.setFontSize(10);
  doc.setTextColor(...hex(C.slate900));
  doc.text(SELLER.name, M + 5, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...hex(C.slate500));
  doc.text(SELLER.address, M + 5, y + 19);
  doc.text("Ph: " + SELLER.phone, M + 5, y + 24);
  if (IS_GST_REGISTERED) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hex(C.slate700));
    doc.text("GSTIN: " + SELLER.gstin, M + 5, y + 29);
  }

  // ── TO (Buyer) ──
  const buyerX = M + halfW + 4;
  doc.setFillColor(...hex(C.slate50));
  doc.roundedRect(buyerX, y, halfW, boxH, 2, 2, "F");

  doc.setFontSize(7);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("TO", buyerX + 5, y + 6);

  doc.setFontSize(10);
  doc.setTextColor(...hex(C.slate900));
  doc.text(order.customerName || "N/A", buyerX + 5, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...hex(C.slate500));

  let buyerY = y + 19;
  if (order.shopName && order.shopName !== "Not specified") {
    doc.text(order.shopName, buyerX + 5, buyerY);
    buyerY += 5;
  }
  doc.text("Ph: " + (order.phone || "N/A"), buyerX + 5, buyerY);
  buyerY += 5;

  // Address — wrap inside the box
  const addrLines = doc.splitTextToSize(order.location || "N/A", halfW - 10);
  doc.text(addrLines.slice(0, 2), buyerX + 5, buyerY);

  y += boxH + 6;

  /* ═══════════════════ ITEMS TABLE ═══════════════════ */
  doc.setFontSize(8);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("ORDER ITEMS", M, y);
  y += 2;

  const tableRows = cart.map((item, i) => {
    const amount = item.qty * item.price;
    const nameStr = [item.name, item.telugu, item.hindi].filter(Boolean).join(" / ");
    return [
      String(i + 1),
      nameStr,
      "0713",              // HSN code for dried vegetables (placeholder)
      String(item.qty),
      item.unit,
      cur(item.price),
      cur(amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["#", "Description of Goods", "HSN", "Qty", "Unit", "Rate (\u20B9)", "Amount (\u20B9)"]],
    body: tableRows,
    theme: "plain",
    headStyles: {
      fillColor: hex(C.greenDark),
      textColor: hex(C.white),
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      halign: "left",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "center", cellWidth: 13, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 26, fontStyle: "bold", textColor: hex(C.greenMid) },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: hex(C.slate900),
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { lineColor: [241, 245, 249], lineWidth: 0.2 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 2;

  /* ═══════════════════ TAX SUMMARY TABLE ═══════════════════ */
  const summaryX = M + CW * 0.52;
  const summaryW = CW * 0.48;
  const labelX = summaryX + 4;
  const valX = summaryX + summaryW - 4;
  const rowH = 6.5;

  // Subtotal
  doc.setFillColor(...hex(C.slate50));
  doc.rect(summaryX, y, summaryW, rowH, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hex(C.slate500));
  doc.text("Subtotal", labelX, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hex(C.slate900));
  doc.text(cur(calculatedTotal), valX, y + 4.5, { align: "right" });
  y += rowH;

  if (IS_GST_REGISTERED) {
    // CGST row
    doc.setFillColor(...hex(C.white));
    doc.rect(summaryX, y, summaryW, rowH, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hex(C.slate500));
    doc.setFontSize(8);
    doc.text("CGST (0%)", labelX, y + 4.5);
    doc.text(cur(0), valX, y + 4.5, { align: "right" });
    y += rowH;

    // SGST row
    doc.setFillColor(...hex(C.slate50));
    doc.rect(summaryX, y, summaryW, rowH, "F");
    doc.text("SGST (0%)", labelX, y + 4.5);
    doc.text(cur(0), valX, y + 4.5, { align: "right" });
    y += rowH;
  } else {
    // Tax exempt note
    doc.setFillColor(...hex(C.white));
    doc.rect(summaryX, y, summaryW, rowH, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hex(C.slate400));
    doc.setFontSize(7);
    doc.text("Tax: Not Applicable (Unregistered)", labelX, y + 4.5);
    doc.setTextColor(...hex(C.slate500));
    doc.setFontSize(8);
    doc.text(cur(0), valX, y + 4.5, { align: "right" });
    y += rowH;
  }

  // ── Total bar ──
  const totalBarH = 10;
  doc.setFillColor(...hex(C.greenDark));
  doc.roundedRect(summaryX, y + 1, summaryW, totalBarH, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(167, 243, 208);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", labelX, y + 7.5);
  doc.setFontSize(13);
  doc.setTextColor(...hex(C.white));
  doc.text(curWhole(totalNum), valX, y + 8, { align: "right" });

  y += totalBarH + 6;

  /* ═══════════════════ AMOUNT IN WORDS ═══════════════════ */
  doc.setFillColor(...hex(C.greenBg));
  doc.roundedRect(M, y, CW, 10, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("AMOUNT IN WORDS", M + 5, y + 4);
  doc.setFontSize(8.5);
  doc.setTextColor(...hex(C.greenDark));
  doc.setFont("helvetica", "bold");
  const wordsText = amountInWords(totalNum);
  const wrappedWords = doc.splitTextToSize(wordsText, CW - 10);
  doc.text(wrappedWords[0] || wordsText, M + 5, y + 8.5);

  y += 14;

  /* ═══════════════════ DISCLAIMER (for proforma) ═══════════════════ */
  if (docType.disclaimer) {
    doc.setFillColor(254, 243, 199);  // amber-100
    doc.roundedRect(M, y, CW, 8, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...hex(C.amber));
    doc.setFont("helvetica", "bold");
    doc.text("NOTE: " + docType.disclaimer, midX, y + 5.5, { align: "center" });
    y += 12;
  }

  /* ═══════════════════ TERMS & CONDITIONS + SIGNATURE ═══════════════════ */
  // Check if we need a new page
  if (y > H - 65) {
    doc.addPage();
    y = 20;
  }

  // Divider line
  doc.setDrawColor(...hex(C.slate300));
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 5;

  // Two-column bottom section
  const termsW = CW * 0.58;
  const sigW = CW * 0.38;
  const sigX = M + CW - sigW;

  // ── Terms & Conditions (left) ──
  doc.setFontSize(7.5);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("TERMS & CONDITIONS", M, y);
  y += 4;

  const terms = [
    "1. Goods once sold will not be taken back or exchanged.",
    "2. All disputes are subject to Hyderabad jurisdiction.",
    "3. Prices are subject to change without prior notice.",
    "4. Payment to be made as per agreed terms.",
    "5. Please verify goods at the time of delivery.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...hex(C.slate500));
  terms.forEach((t) => {
    doc.text(t, M, y);
    y += 3.8;
  });

  // ── Authorised Signatory (right) ──
  const sigTopY = y - (terms.length * 3.8) - 4;    // align with terms top
  doc.setFillColor(...hex(C.slate50));
  doc.roundedRect(sigX, sigTopY, sigW, 32, 2, 2, "F");

  doc.setFontSize(7.5);
  doc.setTextColor(...hex(C.greenMid));
  doc.setFont("helvetica", "bold");
  doc.text("For " + SELLER.name, sigX + sigW / 2, sigTopY + 6, { align: "center" });

  // Signature line
  doc.setDrawColor(...hex(C.slate300));
  doc.setLineWidth(0.2);
  doc.line(sigX + 10, sigTopY + 22, sigX + sigW - 10, sigTopY + 22);

  doc.setFontSize(7);
  doc.setTextColor(...hex(C.slate500));
  doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", sigX + sigW / 2, sigTopY + 27, { align: "center" });

  y = Math.max(y, sigTopY + 36) + 4;

  /* ═══════════════════ FOOTER ═══════════════════ */
  // Check page space
  if (y > H - 22) {
    doc.addPage();
    y = H - 22;
  }

  // Footer divider
  doc.setDrawColor(...hex(C.greenBorder));
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 5;

  // Computer generated note
  doc.setFontSize(6.5);
  doc.setTextColor(...hex(C.slate400));
  doc.setFont("helvetica", "italic");
  doc.text("This is a computer-generated document and does not require a physical signature.", midX, y, { align: "center" });
  y += 4;

  // Brand footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...hex(C.greenMid));
  doc.text(SELLER.name, midX, y, { align: "center" });
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...hex(C.slate500));
  doc.text(SELLER.tagline + " | " + SELLER.address + " | " + SELLER.phone, midX, y, { align: "center" });
  y += 3.5;
  doc.setTextColor(...hex(C.slate400));
  doc.setFontSize(6);
  doc.text("Thank you for your business!", midX, y, { align: "center" });

  /* ═══════════════════ SAVE / DOWNLOAD ═══════════════════ */
  const dateStr = getDateForFilename(order);
  const filename = `${orderId}_${dateStr}.pdf`;
  doc.save(filename);
}
