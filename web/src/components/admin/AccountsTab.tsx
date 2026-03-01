"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  BookOpen,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Save,
  X,
  Lock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { AccountEntry, LedgerRow, PnLData, EntryCategory } from "@/types/accounts";
import { StockPurchase } from "@/types/stock";
import { Order } from "@/types/order";
import { formatCurrency, parseTotal, dateToYMD } from "@/lib/helpers";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CATEGORY_OPTIONS: { value: EntryCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "transport", label: "Transportation" },
  { value: "misc", label: "Miscellaneous" },
  { value: "other", label: "Other" },
];

const PERIOD_FILTERS = [
  { key: "month", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
] as const;

type PeriodKey = (typeof PERIOD_FILTERS)[number]["key"];

function getPeriodRange(key: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (key) {
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "lastMonth": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        from: lm,
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    }
    case "quarter": {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { from: qStart, to };
    }
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to };
    case "all":
      return { from: new Date(2020, 0, 1), to };
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
}

export default function AccountsTab() {
  const { currentUser } = useAuth();
  const { col } = useMode();

  // Data sources
  const [manualEntries, setManualEntries] = useState<AccountEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockPurchases, setStockPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showPnL, setShowPnL] = useState(false);

  // Manual entry form
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(dateToYMD(new Date()));
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState<EntryCategory>("misc");
  const [formType, setFormType] = useState<"credit" | "debit">("debit");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AccountEntry>>({});

  // Fetch all data sources
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersSnap, purchasesSnap, entriesSnap] = await Promise.all([
        getDocs(collection(db, col("orders"))),
        getDocs(collection(db, col("stockPurchases"))),
        getDocs(query(collection(db, col("accountEntries")), orderBy("date", "desc"))),
      ]);

      setOrders(
        ordersSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order)
      );
      setStockPurchases(
        purchasesSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as StockPurchase)
      );
      setManualEntries(
        entriesSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as AccountEntry)
      );
    } catch (e) {
      console.error("[Accounts] Failed to load data:", e);
      toast.error("Failed to load accounts data.");
    } finally {
      setLoading(false);
    }
  }, [col]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get date range for filtering
  const dateRange = useMemo(() => {
    if (period === "custom") {
      return {
        from: customFrom ? new Date(customFrom) : new Date(2020, 0, 1),
        to: customTo
          ? new Date(new Date(customTo).setHours(23, 59, 59, 999))
          : new Date(),
      };
    }
    return getPeriodRange(period);
  }, [period, customFrom, customTo]);

  // Build ledger rows from all sources
  const ledgerRows = useMemo(() => {
    const rows: LedgerRow[] = [];
    const { from, to } = dateRange;

    // Auto-entries from fulfilled orders (CREDIT — stock sold)
    orders
      .filter((o) => o.status === "Fulfilled")
      .forEach((o) => {
        let orderDate: Date;
        if (o.deliveredAt && typeof o.deliveredAt.toDate === "function") {
          orderDate = o.deliveredAt.toDate();
        } else if (o.createdAt && typeof o.createdAt.toDate === "function") {
          orderDate = o.createdAt.toDate();
        } else {
          return;
        }

        if (orderDate < from || orderDate > to) return;

        const amount = parseTotal(o.totalValue);
        rows.push({
          id: `sale-${o.id}`,
          date: orderDate,
          description: `Sale to ${o.shopName || o.customerName || "Customer"} (${o.orderId})`,
          category: "Sale",
          credit: amount,
          debit: 0,
          balance: 0,
          source: "auto-sale",
          refId: o.id,
        });
      });

    // Auto-entries from stock purchases (DEBIT — stock bought)
    stockPurchases.forEach((sp) => {
      let purchaseDate: Date;
      if (sp.purchaseDate && typeof sp.purchaseDate.toDate === "function") {
        purchaseDate = sp.purchaseDate.toDate();
      } else {
        return;
      }

      if (purchaseDate < from || purchaseDate > to) return;

      rows.push({
        id: `purchase-${sp.id}`,
        date: purchaseDate,
        description: `Purchased ${sp.productName} (${sp.qty} ${sp.unit})${sp.supplier ? ` from ${sp.supplier}` : ""}`,
        category: "Purchase",
        credit: 0,
        debit: sp.totalCost,
        balance: 0,
        source: "auto-purchase",
        refId: sp.id,
      });
    });

    // Manual entries
    manualEntries.forEach((e) => {
      let entryDate: Date;
      if (e.date && typeof e.date.toDate === "function") {
        entryDate = e.date.toDate();
      } else {
        return;
      }

      if (entryDate < from || entryDate > to) return;

      const catLabel =
        CATEGORY_OPTIONS.find((c) => c.value === e.category)?.label || e.category;

      rows.push({
        id: `manual-${e.id}`,
        date: entryDate,
        description: e.description,
        category: catLabel,
        credit: e.type === "credit" ? e.amount : 0,
        debit: e.type === "debit" ? e.amount : 0,
        balance: 0,
        source: "manual",
        refId: e.id,
      });
    });

    // Sort ascending for running balance computation
    rows.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute running balance
    let balance = 0;
    rows.forEach((r) => {
      balance += r.credit - r.debit;
      r.balance = balance;
    });

    // Filter by category if not "all"
    let filtered = rows;
    if (categoryFilter !== "all") {
      filtered = rows.filter((r) =>
        r.category.toLowerCase() === categoryFilter.toLowerCase() ||
        (categoryFilter === "auto" && (r.source === "auto-sale" || r.source === "auto-purchase")) ||
        (categoryFilter === "manual" && r.source === "manual")
      );
    }

    // Return in descending order for display
    return filtered.reverse();
  }, [orders, stockPurchases, manualEntries, dateRange, categoryFilter]);

  // P&L computation
  const pnl = useMemo((): PnLData => {
    const { from, to } = dateRange;

    // Revenue from fulfilled orders
    let revenue = 0;
    orders
      .filter((o) => o.status === "Fulfilled")
      .forEach((o) => {
        let orderDate: Date;
        if (o.deliveredAt && typeof o.deliveredAt.toDate === "function") {
          orderDate = o.deliveredAt.toDate();
        } else if (o.createdAt && typeof o.createdAt.toDate === "function") {
          orderDate = o.createdAt.toDate();
        } else return;
        if (orderDate < from || orderDate > to) return;
        revenue += parseTotal(o.totalValue);
      });

    // COGS from stock purchases
    let cogs = 0;
    stockPurchases.forEach((sp) => {
      let d: Date;
      if (sp.purchaseDate && typeof sp.purchaseDate.toDate === "function") {
        d = sp.purchaseDate.toDate();
      } else return;
      if (d < from || d > to) return;
      cogs += sp.totalCost;
    });

    const grossProfit = revenue - cogs;

    // Operating expenses from manual debit entries
    const expenses: Record<string, number> = {};
    manualEntries.forEach((e) => {
      if (e.type !== "debit") return;
      let d: Date;
      if (e.date && typeof e.date.toDate === "function") {
        d = e.date.toDate();
      } else return;
      if (d < from || d > to) return;
      const catLabel =
        CATEGORY_OPTIONS.find((c) => c.value === e.category)?.label || e.category;
      expenses[catLabel] = (expenses[catLabel] || 0) + e.amount;
    });

    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);

    return {
      revenue,
      cogs,
      grossProfit,
      expenses,
      totalExpenses,
      netProfit: grossProfit - totalExpenses,
    };
  }, [orders, stockPurchases, manualEntries, dateRange]);

  // Add manual entry
  const handleAddEntry = async () => {
    if (!formDesc.trim() || !formAmount) {
      toast.error("Description and amount are required.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, col("accountEntries")), {
        date: Timestamp.fromDate(new Date(formDate)),
        description: formDesc.trim(),
        category: formCategory,
        type: formType,
        amount: Number(formAmount),
        notes: formNotes.trim() || null,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || "unknown",
      });
      toast.success("Entry added!");
      setFormDesc("");
      setFormAmount("");
      setFormNotes("");
      setFormDate(dateToYMD(new Date()));
      fetchData();
    } catch (e) {
      console.error("[Accounts] Add failed:", e);
      toast.error("Failed to add entry.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit manual entry
  const startEdit = (e: AccountEntry) => {
    setEditingId(e.id);
    setEditData({
      description: e.description,
      category: e.category,
      type: e.type,
      amount: e.amount,
      notes: e.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, col("accountEntries"), editingId), {
        description: editData.description,
        category: editData.category,
        type: editData.type,
        amount: Number(editData.amount),
        notes: editData.notes || null,
      });
      toast.success("Entry updated!");
      setEditingId(null);
      fetchData();
    } catch (e) {
      console.error("[Accounts] Edit failed:", e);
      toast.error("Failed to update.");
    }
  };

  // Delete manual entry
  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this manual entry?")) return;
    try {
      await deleteDoc(doc(db, col("accountEntries"), entryId));
      toast.success("Entry deleted.");
      fetchData();
    } catch (e) {
      console.error("[Accounts] Delete failed:", e);
      toast.error("Failed to delete.");
    }
  };

  // Summary stats
  const totalCredit = ledgerRows.reduce((a, r) => a + r.credit, 0);
  const totalDebit = ledgerRows.reduce((a, r) => a + r.debit, 0);
  const currentBalance = ledgerRows.length > 0 ? ledgerRows[0].balance : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Accounts
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Financial register with auto-tracked sales &amp; purchases
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPnL(!showPnL)}
          >
            <DollarSign className="w-4 h-4 mr-1" />
            {showPnL ? "Hide P&L" : "P&L Statement"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? (
              <ChevronUp className="w-4 h-4 mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            {showForm ? "Hide" : "Add Entry"}
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="flex flex-wrap gap-2">
          {PERIOD_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setPeriod(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                period === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
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

        <div className="flex gap-2 ml-auto">
          {["all", "auto", "manual"].map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                categoryFilter === c
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c === "all" ? "All" : c === "auto" ? "Auto" : "Manual"}
            </button>
          ))}
        </div>
      </div>

      {/* P&L Statement */}
      {showPnL && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            Profit &amp; Loss Statement
          </h3>
          <p className="text-xs text-slate-400">
            Period: {dateRange.from.toLocaleDateString("en-IN")} — {dateRange.to.toLocaleDateString("en-IN")}
          </p>

          <div className="space-y-3">
            {/* Revenue */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="font-medium text-emerald-700 flex items-center gap-2">
                <ArrowDown className="w-4 h-4" /> Revenue (Sales)
              </span>
              <span className="font-bold text-emerald-700 text-lg">
                {formatCurrency(pnl.revenue)}
              </span>
            </div>

            {/* COGS */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="font-medium text-red-600 flex items-center gap-2">
                <ArrowUp className="w-4 h-4" /> Cost of Goods (Purchases)
              </span>
              <span className="font-bold text-red-600 text-lg">
                ({formatCurrency(pnl.cogs)})
              </span>
            </div>

            {/* Gross Profit */}
            <div className="flex items-center justify-between py-3 border-b-2 border-slate-200 bg-slate-50 px-3 rounded-lg">
              <span className="font-bold text-slate-800">Gross Profit</span>
              <span
                className={`font-bold text-xl ${
                  pnl.grossProfit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrency(pnl.grossProfit)}
              </span>
            </div>

            {/* Operating Expenses */}
            <div className="mt-2">
              <div className="font-medium text-slate-600 text-sm mb-2">Operating Expenses:</div>
              {Object.keys(pnl.expenses).length === 0 ? (
                <p className="text-xs text-slate-400 pl-4">No manual expenses recorded for this period.</p>
              ) : (
                <div className="space-y-1 pl-4">
                  {Object.entries(pnl.expenses)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-600">{cat}</span>
                        <span className="text-sm font-medium text-red-600">
                          ({formatCurrency(amt)})
                        </span>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex items-center justify-between py-2 mt-2 border-t border-slate-200">
                <span className="font-medium text-slate-700">Total Expenses</span>
                <span className="font-bold text-red-600">
                  ({formatCurrency(pnl.totalExpenses)})
                </span>
              </div>
            </div>

            {/* Net Profit */}
            <div
              className={`flex items-center justify-between py-4 px-4 rounded-xl ${
                pnl.netProfit >= 0
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <span className="font-bold text-lg text-slate-800">Net Profit</span>
              <span
                className={`font-bold text-2xl ${
                  pnl.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {pnl.netProfit >= 0 ? "" : "-"}
                {formatCurrency(Math.abs(pnl.netProfit))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Entry Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">
            New Manual Entry
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Description *
              </label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="e.g. Monthly rent, Driver salary..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as EntryCategory)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Type</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-200">
                <button
                  onClick={() => setFormType("debit")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    formType === "debit"
                      ? "bg-red-500 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Debit (-)
                </button>
                <button
                  onClick={() => setFormType("credit")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    formType === "credit"
                      ? "bg-emerald-500 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Credit (+)
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Amount (₹) *
              </label>
              <Input
                type="number"
                value={formAmount}
                onChange={(e) =>
                  setFormAmount(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="0"
                min={0}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAddEntry} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              Add Entry
            </Button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">Total Credit</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {formatCurrency(totalCredit)}
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUp className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-600">Total Debit</span>
          </div>
          <div className="text-2xl font-bold text-red-700">
            {formatCurrency(totalDebit)}
          </div>
        </div>
        <div
          className={`p-4 rounded-xl border ${
            currentBalance >= 0
              ? "bg-blue-50 border-blue-100"
              : "bg-orange-50 border-orange-100"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className={`w-4 h-4 ${currentBalance >= 0 ? "text-blue-500" : "text-orange-500"}`} />
            <span className={`text-xs font-medium ${currentBalance >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              Net Balance
            </span>
          </div>
          <div className={`text-2xl font-bold ${currentBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
            {currentBalance >= 0 ? "" : "-"}
            {formatCurrency(Math.abs(currentBalance))}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-400">Loading accounts...</span>
          </div>
        ) : ledgerRows.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-600">No Entries Found</h3>
            <p className="text-sm text-slate-400 mt-1">
              Entries will appear automatically from sales and purchases.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Credit</th>
                  <th className="px-4 py-3 text-right text-red-600">Debit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerRows.map((row) => {
                  const isManual = row.source === "manual";
                  const manualEntry = isManual
                    ? manualEntries.find((e) => e.id === row.refId)
                    : null;
                  const isEditing = isManual && editingId === row.refId;

                  if (isEditing && manualEntry) {
                    return (
                      <tr key={row.id} className="bg-amber-50/50">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {row.date.toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={editData.description || ""}
                            onChange={(e) =>
                              setEditData({ ...editData, description: e.target.value })
                            }
                            className="text-sm h-8"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editData.category || "misc"}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                category: e.target.value as EntryCategory,
                              })
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-xs h-8"
                          >
                            {CATEGORY_OPTIONS.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editData.type === "credit" && (
                            <Input
                              type="number"
                              value={editData.amount || ""}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  amount: Number(e.target.value),
                                })
                              }
                              className="text-sm h-8 w-24 text-right"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editData.type === "debit" && (
                            <Input
                              type="number"
                              value={editData.amount || ""}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  amount: Number(e.target.value),
                                })
                              }
                              className="text-sm h-8 w-24 text-right"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={saveEdit}
                              className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        row.credit > 0
                          ? "bg-emerald-50/30"
                          : row.debit > 0 && row.source !== "manual"
                          ? "bg-red-50/30"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {row.date.toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        {row.description}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            row.source === "auto-sale"
                              ? "default"
                              : row.source === "auto-purchase"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {row.source === "auto-sale" && "Sale"}
                          {row.source === "auto-purchase" && "Purchase"}
                          {row.source === "manual" && row.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {row.credit > 0 ? formatCurrency(row.credit) : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {row.debit > 0 ? formatCurrency(row.debit) : ""}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          row.balance >= 0 ? "text-slate-800" : "text-red-700"
                        }`}
                      >
                        {row.balance >= 0 ? "" : "-"}
                        {formatCurrency(Math.abs(row.balance))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isManual && manualEntry ? (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => startEdit(manualEntry)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(manualEntry.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
