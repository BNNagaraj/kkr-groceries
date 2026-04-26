import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ─── Colour palette (matches invoice.ts) ─── */
const C = {
  greenDark: "#064e3b",
  greenMid: "#047857",
  greenLight: "#059669",
  greenBg: "#f0fdf4",
  greenBorder: "#dcfce7",
  slate900: "#1e293b",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate50: "#f8fafc",
  white: "#ffffff",
} as const;

/* ─── Helpers ─── */
function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [
    parseInt(s.substring(0, 2), 16),
    parseInt(s.substring(2, 4), 16),
    parseInt(s.substring(4, 6), 16),
  ];
}

function cur(n: number): string {
  return "Rs." + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function curWhole(n: number): string {
  return "Rs." + n.toLocaleString("en-IN");
}

/** Check if string only contains characters renderable by Helvetica (Latin) */
function isLatin(str: string): boolean {
  return /^[\u0020-\u007E\u00A0-\u00FF]*$/.test(str);
}

/* ─── Types (same as BuyList.tsx) ─── */
interface CustomerDetail {
  customerName: string;
  shopName: string;
  orderId: string;
  qty: number;
  price: number;
}

interface AggregatedItem {
  name: string;
  totalQty: number;
  unit: string;
  avgPrice: number;
  estimatedCost: number;
  category: string;
  image: string;
  telugu: string;
  hindi: string;
  orderCount: number;
  customers: CustomerDetail[];
}

interface CategoryGroup {
  categoryId: string;
  categoryLabel: string;
  items: AggregatedItem[];
  subtotal: number;
}

interface Summary {
  uniqueItems: number;
  qtyBreakdown: string;
  totalCost: number;
  categoryCount: number;
  boughtCount: number;
  orderCount: number;
}

/* ─── Main Export ─── */
export function downloadBuyListPdf(
  categoryGroups: CategoryGroup[],
  summary: Summary,
  statuses: string[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12; // margin
  let y = M;

  /* ── Header Bar ── */
  doc.setFillColor(...hex(C.greenDark));
  doc.rect(0, 0, W, 28, "F");

  doc.setTextColor(...hex(C.white));
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("KKR Groceries", M, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("B2B Vegetable Wholesale | Hyderabad", M, 18);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("PROCUREMENT BUY LIST", W - M, 12, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(`Generated: ${dateStr}`, W - M, 18, { align: "right" });

  y = 32;

  /* ── Info Bar ── */
  doc.setFillColor(...hex(C.greenBg));
  doc.rect(M, y, W - 2 * M, 12, "F");
  doc.setDrawColor(...hex(C.greenBorder));
  doc.rect(M, y, W - 2 * M, 12, "S");

  doc.setTextColor(...hex(C.greenDark));
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  const colW = (W - 2 * M) / 4;
  doc.text(`Items: ${summary.uniqueItems}`, M + 4, y + 5);
  doc.text(`Qty: ${summary.qtyBreakdown}`, M + colW, y + 5);
  doc.text(`Est. Cost: ${curWhole(summary.totalCost)}`, M + colW * 2, y + 5);
  doc.text(`Categories: ${summary.categoryCount}`, M + colW * 3, y + 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hex(C.slate500));
  doc.text(`Status: ${statuses.join(", ")} | Orders: ${summary.orderCount}`, M + 4, y + 10);

  y += 16;

  /* ── Category Tables ── */
  let globalIdx = 0;

  for (const group of categoryGroups) {
    // Check if we need a new page (at least 30mm for header + one row)
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = M;
    }

    /* Category sub-header */
    doc.setFillColor(...hex(C.greenLight));
    doc.rect(M, y, W - 2 * M, 8, "F");
    doc.setTextColor(...hex(C.white));
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(group.categoryLabel.toUpperCase(), M + 4, y + 5.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const catInfo = `${group.items.length} items | ${curWhole(group.subtotal)}`;
    doc.text(catInfo, W - M - 4, y + 5.5, { align: "right" });

    y += 10;

    /* Items table */
    const tableData = group.items.map((item) => {
      globalIdx++;
      let itemName = item.name;
      // Add alt names if Latin-safe
      const altNames: string[] = [];
      if (item.telugu && isLatin(item.telugu)) altNames.push(item.telugu.trim());
      if (item.hindi && isLatin(item.hindi)) altNames.push(item.hindi.trim());
      if (altNames.length > 0) {
        itemName += "\n" + altNames.join(" / ");
      }

      return [
        String(globalIdx),
        itemName,
        String(item.totalQty),
        item.unit,
        cur(item.avgPrice),
        cur(item.estimatedCost),
        String(item.orderCount),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["#", "Item", "Qty", "Unit", "Avg Price", "Est. Cost", "Orders"]],
      body: tableData,
      theme: "plain",
      styles: {
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        textColor: hex(C.slate900),
        lineColor: hex(C.slate300),
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: hex(C.white),
        textColor: hex(C.greenDark),
        fontStyle: "bold",
        fontSize: 7,
        lineWidth: { bottom: 0.5 },
        lineColor: hex(C.greenMid),
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { halign: "right", cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 24 },
        6: { halign: "center", cellWidth: 16 },
      },
      alternateRowStyles: {
        fillColor: hex(C.slate50),
      },
      didParseCell(data) {
        // Make alt names italic
        if (data.section === "body" && data.column.index === 1) {
          const text = data.cell.text.join("\n");
          if (text.includes("\n")) {
            data.cell.styles.fontStyle = "italic";
          }
        }
      },
    });

    // `lastAutoTable` typed via the jsPDF module augmentation in @/types/jspdf-augment.d.ts
    y = doc.lastAutoTable?.finalY ?? y + 20;

    /* Category subtotal row */
    doc.setFillColor(...hex(C.greenBg));
    doc.rect(M, y, W - 2 * M, 6, "F");
    doc.setTextColor(...hex(C.greenDark));
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Subtotal: ${cur(group.subtotal)}`, W - M - 4, y + 4, { align: "right" });
    doc.text(`${group.items.length} items`, M + 4, y + 4);

    y += 10;
  }

  /* ── Grand Total Bar ── */
  if (y > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    y = M;
  }

  doc.setFillColor(...hex(C.greenDark));
  doc.rect(M, y, W - 2 * M, 14, "F");

  doc.setTextColor(...hex(C.white));
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL", M + 6, y + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${summary.uniqueItems} unique items across ${summary.orderCount} orders`, M + 6, y + 11);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(curWhole(summary.totalCost), W - M - 6, y + 9, { align: "right" });

  y += 18;

  /* ── Footer ── */
  doc.setTextColor(...hex(C.slate400));
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Generated by KKR Groceries - Procurement System", W / 2, y, { align: "center" });

  /* ── Save ── */
  const fileDate = new Date()
    .toISOString()
    .slice(0, 10);
  doc.save(`BuyList_${fileDate}.pdf`);
}
