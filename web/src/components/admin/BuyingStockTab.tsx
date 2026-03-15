"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { StockTransaction } from "@/types/inventory";
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
} from "lucide-react";
import { StockPurchase } from "@/types/stock";
import { formatCurrency, dateToYMD } from "@/lib/helpers";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

  // Allocation tracking: how much of each product has been allocated to stores
  const [allocatedByProduct, setAllocatedByProduct] = useState<Map<string, number>>(new Map());

  // Load purchases
  const loadPurchases = useCallback(
    async (append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      try {
        const constraints: QueryConstraint[] = [
          orderBy("purchaseDate", "desc"),
        ];

        // Date filter
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

  // Fetch allocation data (receipt transactions grouped by productId)
  useEffect(() => {
    if (purchases.length === 0) return;
    async function fetchAllocations() {
      try {
        // Get the date range matching current filter
        const cutoff = Timestamp.fromDate(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        const receiptsQuery = query(
          collection(db, col("stockTransactions")),
          where("type", "==", "receipt"),
          where("createdAt", ">=", cutoff)
        );
        const snap = await getDocs(receiptsQuery);
        const allocMap = new Map<string, number>();
        snap.docs.forEach((d) => {
          const data = d.data() as StockTransaction;
          const key = data.productId;
          allocMap.set(key, (allocMap.get(key) || 0) + (data.qty || 0));
        });
        setAllocatedByProduct(allocMap);
      } catch (err) {
        console.error("[BuyingStock] Failed to fetch allocations:", err);
      }
    }
    fetchAllocations();
  }, [purchases, col]);

  // Product name autocomplete
  const handleProductNameChange = (val: string) => {
    setFormProductName(val);
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const matches = products.filter(
        (p) =>
          !p.isHidden &&
          (p.name.toLowerCase().includes(q) || p.telugu?.toLowerCase().includes(q))
      );
      setSuggestions(matches.slice(0, 6));
    } else {
      setSuggestions([]);
    }
    setFormProductId(undefined);
  };

  const selectProduct = (p: (typeof products)[0]) => {
    setFormProductName(p.name);
    setFormProductId(p.id);
    setFormUnit(p.unit || "kg");
    setSuggestions([]);
  };

  // Submit new purchase
  const handleAddPurchase = async () => {
    if (!formProductName.trim() || !formQty || !formPricePerUnit) {
      toast.error("Product name, quantity, and price are required.");
      return;
    }
    setSubmitting(true);
    try {
      const qty = Number(formQty);
      const price = Number(formPricePerUnit);
      await addDoc(collection(db, col("stockPurchases")), {
        productName: formProductName.trim(),
        productId: formProductId || null,
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
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const qty = Number(editData.qty) || 0;
      const price = Number(editData.pricePerUnit) || 0;
      await updateDoc(doc(db, col("stockPurchases"), editingId), {
        productName: editData.productName,
        qty,
        unit: editData.unit,
        pricePerUnit: price,
        totalCost: qty * price,
        supplier: editData.supplier || null,
        notes: editData.notes || null,
      });
      toast.success("Purchase updated!");
      setEditingId(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Admin Buying Stock
          </h2>
          <p className="text-sm text-slate-500 mt-1">Record and manage stock purchases</p>
        </div>
        <div className="flex gap-2">
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

      {/* Add Purchase Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">New Purchase</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Product Name with autocomplete */}
            <div className="relative md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Product Name *</label>
              <Input
                value={formProductName}
                onChange={(e) => handleProductNameChange(e.target.value)}
                placeholder="Start typing product name..."
              />
              {suggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectProduct(s)}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="text-xs text-slate-400">{s.unit}</span>
                    </button>
                  ))}
                </div>
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
            <Button onClick={handleAddPurchase} disabled={submitting}>
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
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
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
      {(() => {
        const totalAllocated = Array.from(allocatedByProduct.values()).reduce((s, v) => s + v, 0);
        const unallocated = totalItems - totalAllocated;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{filtered.length}</div>
              <div className="text-xs text-blue-600 font-medium">Purchases</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{totalItems.toLocaleString("en-IN")}</div>
              <div className="text-xs text-amber-600 font-medium">Total Qty Bought</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700">{totalAllocated.toLocaleString("en-IN")}</div>
              <div className="text-xs text-emerald-600 font-medium">Allocated to Stores</div>
            </div>
            <div className={`p-4 rounded-xl border ${unallocated > 0 ? "bg-orange-50 border-orange-100" : "bg-red-50 border-red-100"}`}>
              <div className={`text-2xl font-bold ${unallocated > 0 ? "text-orange-700" : "text-red-700"}`}>{unallocated.toLocaleString("en-IN")}</div>
              <div className={`text-xs font-medium ${unallocated > 0 ? "text-orange-600" : "text-red-600"}`}>
                {unallocated > 0 ? "Pending Allocation" : "Fully Allocated"}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Purchase Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                  <th className="px-4 py-3 text-center">Allocated</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Price/Unit</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-center">Actions</th>
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
                    return (
                      <tr key={p.id} className="bg-amber-50/50">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {purchaseDate.toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={editData.productName || ""}
                            onChange={(e) =>
                              setEditData({ ...editData, productName: e.target.value })
                            }
                            className="text-sm h-8"
                          />
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
                        <td className="px-4 py-3 text-center text-xs text-slate-400">—</td>
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
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={saveEdit}
                              className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                              title="Save"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
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
                          <Calendar className="w-3 h-3" />
                          {purchaseDate.toLocaleDateString("en-IN")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {p.productName}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {p.qty}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const productKey = p.productId ? String(p.productId) : "";
                          const allocated = productKey ? (allocatedByProduct.get(productKey) || 0) : 0;
                          if (!productKey) return <span className="text-xs text-slate-300">—</span>;
                          const pct = p.qty > 0 ? Math.min(100, Math.round((allocated / p.qty) * 100)) : 0;
                          return (
                            <div className="flex flex-col items-center">
                              <span className={`text-xs font-bold ${allocated >= p.qty ? "text-emerald-600" : "text-orange-600"}`}>
                                {allocated}/{p.qty}
                              </span>
                              <div className="w-12 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${allocated >= p.qty ? "bg-emerald-500" : "bg-orange-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
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
                      <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-center text-emerald-600 text-xs">
                    {Array.from(allocatedByProduct.values()).reduce((s, v) => s + v, 0)} allocated
                  </td>
                  <td className="px-4 py-3" colSpan={2}></td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {formatCurrency(totalSpend)}
                  </td>
                  <td className="px-4 py-3" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="p-4 text-center border-t border-slate-100">
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
