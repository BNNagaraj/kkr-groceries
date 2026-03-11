"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/contexts/AppContext";
import { useMode } from "@/contexts/ModeContext";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  startAfter,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
  where,
  QueryConstraint,
} from "firebase/firestore";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Save,
  X,
  Package,
  Calendar,
  Search,
  Settings2,
  Printer,
  FileDown,
  ImageIcon,
  Languages,
} from "lucide-react";
import { StockPurchase } from "@/types/stock";
import { formatCurrency, dateToYMD } from "@/lib/helpers";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 30;
const DAY = 86400000;

const DATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
] as const;

type DateFilterKey = (typeof DATE_FILTERS)[number]["key"];

/* ── localStorage helpers ── */
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch { /* ignore */ }
}

/* ── PDF generation for stock purchases ── */
async function downloadStockPdf(
  purchases: StockPurchase[],
  products: { id: number; name: string; telugu: string; hindi: string; image: string }[],
  opts: { showImages: boolean; showTelugu: boolean; showHindi: boolean },
  totalSpend: number,
  totalItems: number,
) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const C = {
    greenDark: "#064e3b",
    greenMid: "#047857",
    greenLight: "#059669",
    greenBg: "#f0fdf4",
    greenBorder: "#dcfce7",
    slate900: "#1e293b",
    slate500: "#64748b",
    slate400: "#94a3b8",
    slate300: "#cbd5e1",
    slate50: "#f8fafc",
    white: "#ffffff",
  };
  function hex(h: string): [number, number, number] {
    const s = h.replace("#", "");
    return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
  }
  function cur(n: number): string {
    return "Rs." + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const d = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = d.internal.pageSize.getWidth();
  const M = 12;
  let y = M;

  // Header
  d.setFillColor(...hex(C.greenDark));
  d.rect(0, 0, W, 28, "F");
  d.setTextColor(...hex(C.white));
  d.setFontSize(18);
  d.setFont("helvetica", "bold");
  d.text("KKR Groceries", M, 12);
  d.setFontSize(9);
  d.setFont("helvetica", "normal");
  d.text("B2B Vegetable Wholesale | Hyderabad", M, 18);
  d.setFontSize(14);
  d.setFont("helvetica", "bold");
  d.text("STOCK PURCHASES", W - M, 12, { align: "right" });
  d.setFontSize(9);
  d.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  d.text(`Generated: ${dateStr}`, W - M, 18, { align: "right" });
  y = 32;

  // Summary bar
  d.setFillColor(...hex(C.greenBg));
  d.rect(M, y, W - 2 * M, 10, "F");
  d.setDrawColor(...hex(C.greenBorder));
  d.rect(M, y, W - 2 * M, 10, "S");
  d.setTextColor(...hex(C.greenDark));
  d.setFontSize(9);
  d.setFont("helvetica", "bold");
  const colW = (W - 2 * M) / 3;
  d.text(`Records: ${purchases.length}`, M + 4, y + 6);
  d.text(`Total Qty: ${totalItems}`, M + colW, y + 6);
  d.text(`Total Spend: ${cur(totalSpend)}`, M + colW * 2, y + 6);
  y += 14;

  // Table data
  const productMap = new Map(products.map((p) => [p.id, p]));
  const tableData = purchases.map((p, i) => {
    const pDate = p.purchaseDate && typeof p.purchaseDate.toDate === "function" ? p.purchaseDate.toDate() : new Date();
    const cat = p.productId ? productMap.get(p.productId) : undefined;
    let itemName = p.productName;
    const altNames: string[] = [];
    if (opts.showTelugu && cat?.telugu) altNames.push(cat.telugu);
    if (opts.showHindi && cat?.hindi) altNames.push(cat.hindi);
    // Only add latin-safe alt names to PDF (jsPDF can't render Telugu/Hindi script)
    const latinAlts = altNames.filter((n) => /^[\u0020-\u007E\u00A0-\u00FF]*$/.test(n));
    if (latinAlts.length > 0) itemName += "\n" + latinAlts.join(" / ");

    return [
      String(i + 1),
      pDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      itemName,
      `${p.qty} ${p.unit}`,
      cur(p.pricePerUnit),
      cur(p.totalCost),
      p.supplier || "-",
    ];
  });

  autoTable(d, {
    startY: y,
    margin: { left: M, right: M },
    head: [["#", "Date", "Product", "Qty", "Price/Unit", "Total", "Supplier"]],
    body: tableData,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, textColor: hex(C.slate900), lineColor: hex(C.slate300), lineWidth: 0.1 },
    headStyles: { fillColor: hex(C.white), textColor: hex(C.greenDark), fontStyle: "bold", fontSize: 7, lineWidth: { bottom: 0.5 }, lineColor: hex(C.greenMid) },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: "auto" },
      3: { halign: "right", cellWidth: 20 },
      4: { halign: "right", cellWidth: 24 },
      5: { halign: "right", cellWidth: 24 },
      6: { cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: hex(C.slate50) },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (d as any).lastAutoTable?.finalY ?? y + 20;

  // Grand total
  if (y > d.internal.pageSize.getHeight() - 20) { d.addPage(); y = M; }
  d.setFillColor(...hex(C.greenDark));
  d.rect(M, y, W - 2 * M, 12, "F");
  d.setTextColor(...hex(C.white));
  d.setFontSize(10);
  d.setFont("helvetica", "bold");
  d.text("GRAND TOTAL", M + 6, y + 5);
  d.setFontSize(8);
  d.setFont("helvetica", "normal");
  d.text(`${purchases.length} records | ${totalItems} units`, M + 6, y + 10);
  d.setFontSize(14);
  d.setFont("helvetica", "bold");
  d.text(cur(totalSpend), W - M - 6, y + 8, { align: "right" });

  // Footer
  y += 16;
  d.setTextColor(...hex(C.slate400));
  d.setFontSize(7);
  d.setFont("helvetica", "normal");
  d.text("Generated by KKR Groceries - Stock Purchase System", W / 2, y, { align: "center" });

  d.save(`StockPurchases_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function BuyingStockTab() {
  const { currentUser } = useAuth();
  const { products } = useAppStore();
  const { col } = useMode();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formProductName, setFormProductName] = useState("");
  const [formProductId, setFormProductId] = useState<number | undefined>();
  const [formQty, setFormQty] = useState<number | "">("");
  const [formUnit, setFormUnit] = useState("kg");
  const [formPricePerUnit, setFormPricePerUnit] = useState<number | "">("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(dateToYMD(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof products>([]);

  // Table state
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<StockPurchase>>({});
  const [editProductId, setEditProductId] = useState<number | undefined>();
  const [editSuggestions, setEditSuggestions] = useState<typeof products>([]);

  // Display settings (persisted to localStorage)
  const [showImages, setShowImages] = useState(() => readStorage("kkr-bs-showImages", true));
  const [showTelugu, setShowTelugu] = useState(() => readStorage("kkr-bs-showTelugu", true));
  const [showHindi, setShowHindi] = useState(() => readStorage("kkr-bs-showHindi", true));
  const [showEnglish, setShowEnglish] = useState(() => readStorage("kkr-bs-showEnglish", true));
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Persist settings
  useEffect(() => { writeStorage("kkr-bs-showImages", showImages); }, [showImages]);
  useEffect(() => { writeStorage("kkr-bs-showTelugu", showTelugu); }, [showTelugu]);
  useEffect(() => { writeStorage("kkr-bs-showHindi", showHindi); }, [showHindi]);
  useEffect(() => { writeStorage("kkr-bs-showEnglish", showEnglish); }, [showEnglish]);

  // Close settings panel on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettingsPanel(false);
      }
    }
    if (showSettingsPanel) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSettingsPanel]);

  // Product lookup map for O(1) access
  const productMap = useMemo(() => {
    const m = new Map<number, (typeof products)[0]>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  // Load purchases
  const loadPurchases = useCallback(
    async (append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      try {
        const constraints: QueryConstraint[] = [
          orderBy("purchaseDate", "desc"),
        ];

        if (dateFilter !== "all" && dateFilter !== "custom") {
          const msMap: Record<string, number> = {
            today: DAY,
            week: 7 * DAY,
            month: 30 * DAY,
          };
          const ms = msMap[dateFilter];
          if (ms) {
            const cutoff = Timestamp.fromDate(new Date(Date.now() - ms));
            constraints.push(where("purchaseDate", ">=", cutoff));
          }
        } else if (dateFilter === "custom") {
          if (customFrom) {
            constraints.push(
              where("purchaseDate", ">=", Timestamp.fromDate(new Date(customFrom)))
            );
          }
          if (customTo) {
            const endDate = new Date(customTo);
            endDate.setHours(23, 59, 59, 999);
            constraints.push(
              where("purchaseDate", "<=", Timestamp.fromDate(endDate))
            );
          }
        }

        constraints.push(limit(PAGE_SIZE));

        if (append && lastDoc) {
          constraints.push(startAfter(lastDoc));
        }

        const q = query(collection(db, col("stockPurchases")), ...constraints);
        const snap = await getDocs(q);
        const data = snap.docs.map(
          (d) => ({ ...d.data(), id: d.id }) as StockPurchase
        );

        if (append) {
          setPurchases((prev) => [...prev, ...data]);
        } else {
          setPurchases(data);
        }

        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } catch (e) {
        console.error("[BuyingStock] Failed to load:", e);
        toast.error("Failed to load purchases.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dateFilter, customFrom, customTo, lastDoc, col]
  );

  // Re-fetch when filter changes
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) {
      setLastDoc(null);
      setPurchases([]);
    }
    initialLoadDone.current = true;
  }, [dateFilter, customFrom, customTo]);

  useEffect(() => {
    if (purchases.length === 0 || !initialLoadDone.current) {
      loadPurchases(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customFrom, customTo]);

  // Product name autocomplete — search English, Telugu, Hindi
  const handleProductNameChange = (val: string) => {
    setFormProductName(val);
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const matches = products.filter(
        (p) =>
          !p.isHidden &&
          (p.name.toLowerCase().includes(q) ||
           p.telugu?.toLowerCase().includes(q) ||
           p.hindi?.toLowerCase().includes(q))
      );
      setSuggestions(matches.slice(0, 8));
    } else {
      setSuggestions([]);
    }
    // Clear productId if user types manually (not from suggestion)
    setFormProductId(undefined);
  };

  const selectProduct = (p: (typeof products)[0]) => {
    setFormProductName(p.name);
    setFormProductId(p.id);
    setFormUnit(p.unit || "kg");
    setSuggestions([]);
  };

  // Submit new purchase — ONLY accept catalog products
  const handleAddPurchase = async () => {
    if (!formProductName.trim() || !formQty || !formPricePerUnit) {
      toast.error("Product name, quantity, and price are required.");
      return;
    }
    // ✅ Enforce: must be a product from the catalog
    if (formProductId === undefined) {
      toast.error("Please select a product from the catalog list. Only listed products are accepted.");
      return;
    }
    setSubmitting(true);
    try {
      const qty = Number(formQty);
      const price = Number(formPricePerUnit);
      await addDoc(collection(db, col("stockPurchases")), {
        productName: formProductName.trim(),
        productId: formProductId,
        qty,
        unit: formUnit,
        pricePerUnit: price,
        totalCost: qty * price,
        supplier: formSupplier.trim() || null,
        notes: formNotes.trim() || null,
        purchaseDate: Timestamp.fromDate(new Date(formDate)),
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || "unknown",
      });
      toast.success("Purchase recorded!");
      // Reset form
      setFormProductName("");
      setFormProductId(undefined);
      setFormQty("");
      setFormPricePerUnit("");
      setFormSupplier("");
      setFormNotes("");
      setFormDate(dateToYMD(new Date()));
      setSuggestions([]);
      // Reload
      setLastDoc(null);
      loadPurchases(false);
    } catch (e) {
      console.error("[BuyingStock] Add failed:", e);
      toast.error("Failed to add purchase.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit purchase
  const startEdit = (p: StockPurchase) => {
    setEditingId(p.id);
    setEditData({
      productName: p.productName,
      qty: p.qty,
      unit: p.unit,
      pricePerUnit: p.pricePerUnit,
      supplier: p.supplier || "",
      notes: p.notes || "",
    });
    setEditProductId(p.productId);
    setEditSuggestions([]);
  };

  // Edit autocomplete — same logic as add form
  const handleEditProductNameChange = (val: string) => {
    setEditData((prev) => ({ ...prev, productName: val }));
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const matches = products.filter(
        (p) =>
          !p.isHidden &&
          (p.name.toLowerCase().includes(q) ||
           p.telugu?.toLowerCase().includes(q) ||
           p.hindi?.toLowerCase().includes(q))
      );
      setEditSuggestions(matches.slice(0, 8));
    } else {
      setEditSuggestions([]);
    }
    // Clear productId when user types manually
    setEditProductId(undefined);
  };

  const selectEditProduct = (p: (typeof products)[0]) => {
    setEditData((prev) => ({ ...prev, productName: p.name, unit: p.unit || prev.unit }));
    setEditProductId(p.id);
    setEditSuggestions([]);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    // ✅ Enforce catalog-only for edits too
    if (editProductId === undefined) {
      toast.error("Please select a product from the catalog list. Only listed products are accepted.");
      return;
    }
    try {
      const qty = Number(editData.qty) || 0;
      const price = Number(editData.pricePerUnit) || 0;
      await updateDoc(doc(db, col("stockPurchases"), editingId), {
        productName: editData.productName,
        productId: editProductId,
        qty,
        unit: editData.unit,
        pricePerUnit: price,
        totalCost: qty * price,
        supplier: editData.supplier || null,
        notes: editData.notes || null,
      });
      toast.success("Purchase updated!");
      setEditingId(null);
      setEditSuggestions([]);
      loadPurchases(false);
    } catch (e) {
      console.error("[BuyingStock] Edit failed:", e);
      toast.error("Failed to update.");
    }
  };

  // Delete purchase
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this purchase record?")) return;
    try {
      await deleteDoc(doc(db, col("stockPurchases"), id));
      toast.success("Purchase deleted.");
      setPurchases((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error("[BuyingStock] Delete failed:", e);
      toast.error("Failed to delete.");
    }
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // PDF download
  const handlePdfDownload = async () => {
    if (filtered.length === 0) {
      toast.error("No records to export.");
      return;
    }
    try {
      toast.info("Generating PDF...");
      await downloadStockPdf(filtered, products, { showImages, showTelugu, showHindi }, totalSpend, totalItems);
      toast.success("PDF downloaded!");
    } catch (e) {
      console.error("[BuyingStock] PDF error:", e);
      toast.error("Failed to generate PDF.");
    }
  };

  // Filter by search
  const filtered = searchQuery
    ? purchases.filter((p) =>
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.supplier && p.supplier.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : purchases;

  // Summary
  const totalSpend = filtered.reduce((acc, p) => acc + (p.totalCost || 0), 0);
  const totalItems = filtered.reduce((acc, p) => acc + (p.qty || 0), 0);

  /** Helper: render product name cell with optional multilingual names */
  const renderProductName = (productName: string, productId?: number) => {
    const cat = productId ? productMap.get(productId) : undefined;
    return (
      <div className="flex items-center gap-2.5">
        {/* Product image */}
        {showImages && (
          <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
            {cat?.image ? (
              <Image
                src={cat.image}
                alt={productName}
                width={36}
                height={36}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-bold">
                {productName.charAt(0)}
              </div>
            )}
          </div>
        )}
        <div className="min-w-0">
          {showEnglish && (
            <div className="font-semibold text-slate-800 truncate">{productName}</div>
          )}
          {cat && showTelugu && cat.telugu && (
            <div className="text-xs text-slate-500 truncate font-telugu">{cat.telugu}</div>
          )}
          {cat && showHindi && cat.hindi && (
            <div className="text-xs text-slate-400 italic truncate">{cat.hindi}</div>
          )}
          {/* If English is off but nothing else shows, still show the name as fallback */}
          {!showEnglish && !(cat && showTelugu && cat.telugu) && !(cat && showHindi && cat.hindi) && (
            <div className="font-semibold text-slate-800 truncate">{productName}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Admin Buying Stock
          </h2>
          <p className="text-sm text-slate-500 mt-1">Record and manage stock purchases</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              title="Display Settings"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
            {showSettingsPanel && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 w-64 p-4 space-y-3 animate-[fadeIn_0.15s_ease-out]">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Display Settings</h4>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-400" /> Show Images
                  </span>
                  <button
                    onClick={() => setShowImages(!showImages)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showImages ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showImages ? "translate-x-5" : ""}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <Languages className="w-4 h-4 text-slate-400" /> English Names
                  </span>
                  <button
                    onClick={() => setShowEnglish(!showEnglish)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showEnglish ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showEnglish ? "translate-x-5" : ""}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <span className="w-4 h-4 text-center text-xs font-bold text-slate-400">తె</span> Telugu Names
                  </span>
                  <button
                    onClick={() => setShowTelugu(!showTelugu)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showTelugu ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showTelugu ? "translate-x-5" : ""}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <span className="w-4 h-4 text-center text-xs font-bold text-slate-400">हि</span> Hindi Names
                  </span>
                  <button
                    onClick={() => setShowHindi(!showHindi)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showHindi ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showHindi ? "translate-x-5" : ""}`} />
                  </button>
                </label>

                <div className="border-t border-slate-100 pt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handlePrint}>
                    <Printer className="w-3.5 h-3.5 mr-1" /> Print
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handlePdfDownload}>
                    <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Print & PDF (also visible on header row) */}
          <Button variant="outline" size="sm" onClick={handlePrint} title="Print">
            <Printer className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdfDownload} title="Download PDF">
            <FileDown className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLastDoc(null); loadPurchases(false); }}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? <ChevronUp className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? "Hide Form" : "Add Purchase"}
          </Button>
        </div>
      </div>

      {/* Print header (only visible during print) */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">KKR Groceries — Stock Purchases</h1>
        <p className="text-sm text-slate-500">Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
      </div>

      {/* Add Purchase Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 print:hidden">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">New Purchase</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Product Name with autocomplete */}
            <div className="relative md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Product Name * <span className="text-slate-400 font-normal">(select from catalog)</span>
              </label>
              <Input
                value={formProductName}
                onChange={(e) => handleProductNameChange(e.target.value)}
                placeholder="Start typing product name..."
                className={formProductId !== undefined ? "border-emerald-400 bg-emerald-50/30" : ""}
              />
              {formProductId !== undefined && (
                <span className="absolute right-3 top-[calc(50%+6px)] text-emerald-500 text-xs font-medium">✓ Listed</span>
              )}
              {suggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectProduct(s)}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 text-sm flex items-center gap-3 border-b border-slate-50 last:border-0"
                    >
                      {/* Product image in suggestions */}
                      <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                        {s.image ? (
                          <Image
                            src={s.image}
                            alt={s.name}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-bold">
                            {s.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-700">{s.name}</div>
                        <div className="text-xs text-slate-400 flex gap-2 truncate">
                          {s.telugu && <span className="font-telugu">{s.telugu}</span>}
                          {s.hindi && <span className="italic">{s.hindi}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{s.unit}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Warning when user types text that doesn't match */}
              {formProductName.length >= 2 && formProductId === undefined && suggestions.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No matching product found. Only products listed under Products &amp; Pricing can be added.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Purchase Date</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Qty *</label>
              <Input
                type="number"
                value={formQty}
                onChange={(e) => setFormQty(e.target.value ? Number(e.target.value) : "")}
                placeholder="0"
                min={0}
                step="0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Unit</label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="kg">kg</option>
                <option value="dozen">dozen</option>
                <option value="bunch">bunch</option>
                <option value="piece">piece</option>
                <option value="bag">bag</option>
                <option value="crate">crate</option>
                <option value="litre">litre</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Price/Unit (₹) *</label>
              <Input
                type="number"
                value={formPricePerUnit}
                onChange={(e) => setFormPricePerUnit(e.target.value ? Number(e.target.value) : "")}
                placeholder="0"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Total Cost</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-emerald-700">
                {formQty && formPricePerUnit
                  ? formatCurrency(Number(formQty) * Number(formPricePerUnit))
                  : "₹0"}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Supplier</label>
              <Input
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <Input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAddPurchase}
              disabled={submitting || formProductId === undefined}
              title={formProductId === undefined ? "Select a product from the catalog" : "Add purchase"}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              Add Purchase
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center print:hidden">
        <div className="flex flex-wrap gap-2">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                dateFilter === f.key
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-36 text-xs"
            />
            <span className="text-slate-400 text-xs">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-36 text-xs"
            />
          </div>
        )}

        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product/supplier..."
            className="pl-8 w-52 text-sm"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 print:p-2">
          <div className="text-2xl font-bold text-blue-700 print:text-base">{filtered.length}</div>
          <div className="text-xs text-blue-600 font-medium">Purchases</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 print:p-2">
          <div className="text-2xl font-bold text-amber-700 print:text-base">{totalItems.toLocaleString("en-IN")}</div>
          <div className="text-xs text-amber-600 font-medium">Total Qty Bought</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 print:p-2">
          <div className="text-2xl font-bold text-red-700 print:text-base">{formatCurrency(totalSpend)}</div>
          <div className="text-xs text-red-600 font-medium">Total Spend</div>
        </div>
      </div>

      {/* Purchase Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-slate-300">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-400">Loading purchases...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-600">No Purchases Found</h3>
            <p className="text-sm text-slate-400 mt-1">
              Click &quot;Add Purchase&quot; to record stock bought.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Price/Unit</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const isEditing = editingId === p.id;
                  const purchaseDate =
                    p.purchaseDate && typeof p.purchaseDate.toDate === "function"
                      ? p.purchaseDate.toDate()
                      : new Date();

                  if (isEditing) {
                    const editCat = editProductId ? productMap.get(editProductId) : undefined;
                    return (
                      <tr key={p.id} className="bg-amber-50/50 print:hidden">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {purchaseDate.toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              {/* Show image of selected edit product */}
                              {showImages && editCat?.image && (
                                <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                  <Image src={editCat.image} alt={editCat.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <Input
                                  value={editData.productName || ""}
                                  onChange={(e) => handleEditProductNameChange(e.target.value)}
                                  className={`text-sm h-8 ${editProductId !== undefined ? "border-emerald-400 bg-emerald-50/30" : ""}`}
                                  placeholder="Type to search catalog..."
                                />
                              </div>
                            </div>
                            {/* Edit autocomplete dropdown */}
                            {editSuggestions.length > 0 && (
                              <div className="absolute z-30 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                                {editSuggestions.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => selectEditProduct(s)}
                                    className="w-full text-left px-2.5 py-2 hover:bg-emerald-50 text-sm flex items-center gap-2.5 border-b border-slate-50 last:border-0"
                                  >
                                    <div className="w-8 h-8 rounded-md bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                      {s.image ? (
                                        <Image src={s.image} alt={s.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-bold">{s.name.charAt(0)}</div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-slate-700 text-xs">{s.name}</div>
                                      <div className="text-[10px] text-slate-400 flex gap-1.5 truncate">
                                        {s.telugu && <span className="font-telugu">{s.telugu}</span>}
                                        {s.hindi && <span className="italic">{s.hindi}</span>}
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">{s.unit}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Translated names below input */}
                            {editCat && (showTelugu || showHindi) && (
                              <div className="flex gap-2 mt-0.5 text-[10px] text-slate-400 truncate">
                                {showTelugu && editCat.telugu && <span className="font-telugu">{editCat.telugu}</span>}
                                {showHindi && editCat.hindi && <span className="italic">{editCat.hindi}</span>}
                              </div>
                            )}
                            {/* Warning if product not matched */}
                            {(editData.productName?.length || 0) >= 2 && editProductId === undefined && editSuggestions.length === 0 && (
                              <p className="text-[10px] text-amber-600 mt-0.5">No match — select from catalog</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={editData.qty || ""}
                            onChange={(e) =>
                              setEditData({ ...editData, qty: Number(e.target.value) })
                            }
                            className="text-sm h-8 w-20 text-center"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editData.unit || "kg"}
                            onChange={(e) =>
                              setEditData({ ...editData, unit: e.target.value })
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-sm h-8"
                          >
                            <option value="kg">kg</option>
                            <option value="dozen">dozen</option>
                            <option value="bunch">bunch</option>
                            <option value="piece">piece</option>
                            <option value="bag">bag</option>
                            <option value="crate">crate</option>
                            <option value="litre">litre</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={editData.pricePerUnit || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                pricePerUnit: Number(e.target.value),
                              })
                            }
                            className="text-sm h-8 w-24 text-right"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">
                          {formatCurrency(
                            (Number(editData.qty) || 0) *
                              (Number(editData.pricePerUnit) || 0)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={(editData.supplier as string) || ""}
                            onChange={(e) =>
                              setEditData({ ...editData, supplier: e.target.value })
                            }
                            className="text-sm h-8"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-4 py-3 print:hidden">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={editProductId === undefined}
                              className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={editProductId === undefined ? "Select a product from catalog first" : "Save"}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditSuggestions([]); }}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 print:hidden" />
                          {purchaseDate.toLocaleDateString("en-IN")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {renderProductName(p.productName, p.productId)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {p.qty}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(p.pricePerUnit)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {formatCurrency(p.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {p.supplier || "—"}
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary footer */}
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="font-bold text-sm">
                  <td className="px-4 py-3 text-slate-600" colSpan={2}>
                    Total ({filtered.length} records)
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {totalItems}
                  </td>
                  <td className="px-4 py-3" colSpan={2}></td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {formatCurrency(totalSpend)}
                  </td>
                  <td className="px-4 py-3 print:hidden" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="p-4 text-center border-t border-slate-100 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadPurchases(true)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-1" />
              )}
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
