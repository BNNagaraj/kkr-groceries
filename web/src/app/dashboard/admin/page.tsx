"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore, Product } from "@/contexts/AppContext";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, updateDoc, doc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { Settings, PackageSearch, Activity, LayoutDashboard, ArrowLeft, LogOut, Save, Download } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
    const { currentUser, isAdmin, loading: authLoading } = useAuth();
    const { products } = useAppStore();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"prices" | "orders" | "stats">("prices");

    // Local state for editing products before saving
    const [editingProducts, setEditingProducts] = useState<Product[]>([]);
    const [globalCommission, setGlobalCommission] = useState(15);

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            router.push("/");
        }
    }, [currentUser, isAdmin, authLoading, router]);

    useEffect(() => {
        // Clone products for local admin editing
        if (products.length > 0) {
            setEditingProducts(JSON.parse(JSON.stringify(products)));
        }
    }, [products]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
            setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
            // Fallback
            const snap = await getDocs(collection(db, "orders"));
            const data = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
            data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setOrders(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin && activeTab === "orders") {
            loadOrders();
        }
    }, [isAdmin, activeTab]);

    const handleProductChange = (id: number, field: keyof Product, value: any) => {
        setEditingProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSaveAllProducts = async () => {
        if (!confirm("Save all product changes to live database?")) return;
        setLoading(true);
        try {
            const batch = [];
            for (const p of editingProducts) {
                batch.push(setDoc(doc(db, "products", p.id.toString()), p, { merge: true }));
            }
            await Promise.all(batch);
            alert("All products have been updated successfully!");
        } catch (e) {
            console.error(e);
            alert("Error saving products.");
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (e) {
            console.error(e);
            alert("Failed to update status");
        }
    };

    if (authLoading || (!currentUser || !isAdmin)) {
        return <div className="min-h-screen flex items-center justify-center p-8">Loading Admin Area...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 flex flex-col">
                <div className="p-6 border-b border-slate-800 flex flex-col gap-2">
                    <Link href="/" className="flex items-center gap-2 text-white font-bold hover:opacity-80 transition-opacity">
                        <ArrowLeft className="w-4 h-4" /> Back to Store
                    </Link>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg border border-slate-700">
                            A
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Super Admin</div>
                            <div className="text-xs text-slate-400 truncate max-w-[140px]">{currentUser.email}</div>
                        </div>
                    </div>
                </div>

                <nav className="p-4 flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar flex-1">
                    <button
                        onClick={() => setActiveTab("prices")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'prices' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <Settings className="w-5 h-5" /> Products & Pricing
                    </button>
                    <button
                        onClick={() => setActiveTab("orders")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <PackageSearch className="w-5 h-5" /> Customer Orders
                    </button>
                    <button
                        onClick={() => setActiveTab("stats")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'stats' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <Activity className="w-5 h-5" /> Analytics
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800 hidden md:block">
                    <button
                        onClick={() => { import("@/lib/firebase").then(({ auth }) => auth.signOut()) }}
                        className="flex items-center gap-2 text-red-400 font-medium px-4 py-2 hover:bg-red-500/10 rounded-lg w-full transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 md:p-8 max-h-screen overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {activeTab === "prices" && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex items-center gap-4">
                                    <label className="font-bold text-slate-700">Global Margin %:</label>
                                    <input
                                        type="number"
                                        value={globalCommission}
                                        onChange={(e) => setGlobalCommission(Number(e.target.value))}
                                        className="w-20 px-3 py-1.5 border border-slate-300 rounded text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveAllProducts}
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-[#064e3b] hover:bg-[#065f46] text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> Save Live Catalog
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">ID</th>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-center">Active</th>
                                                <th className="px-4 py-3">Override ₹</th>
                                                <th className="px-4 py-3 text-center">MOQ</th>
                                                <th className="px-4 py-3">Badging</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {editingProducts.map(p => (
                                                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.isHidden ? 'opacity-50 bg-slate-100' : ''}`}>
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-800">{p.name}</div>
                                                        <div className="text-xs text-slate-500">{p.telugu}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!p.isHidden}
                                                            onChange={(e) => handleProductChange(p.id, 'isHidden', !e.target.checked)}
                                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            value={p.price || ''}
                                                            onChange={(e) => handleProductChange(p.id, 'price', Number(e.target.value))}
                                                            className="w-20 px-2 py-1 border border-slate-200 rounded text-right focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                                                        />
                                                        <span className="text-slate-400 ml-1">/{p.unit}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={p.moq || 1}
                                                            onChange={(e) => handleProductChange(p.id, 'moq', Number(e.target.value))}
                                                            className="w-16 px-2 py-1 border border-slate-200 rounded text-center focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-3">
                                                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={p.hot || false}
                                                                    onChange={(e) => handleProductChange(p.id, 'hot', e.target.checked)}
                                                                    className="rounded text-red-500 focus:ring-red-500"
                                                                /> Hot
                                                            </label>
                                                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={p.fresh || false}
                                                                    onChange={(e) => handleProductChange(p.id, 'fresh', e.target.checked)}
                                                                    className="rounded text-emerald-500 focus:ring-emerald-500"
                                                                /> Fresh
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "orders" && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                                <LayoutDashboard className="w-6 h-6 text-slate-400" /> Order Management
                            </h2>
                            {orders.map(o => (
                                <div key={o.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-bold text-slate-800 text-lg">{o.shopName || o.customerName}</span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${o.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800' :
                                                    o.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                        o.status === 'Accepted' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {o.status || 'Pending'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-500">{o.customerPhone} • {o.deliveryAddress}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <select
                                                value={o.status || 'Pending'}
                                                onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 p-2 outline-none font-semibold cursor-pointer"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Accepted">Accepted</option>
                                                <option value="Fulfilled">Fulfilled</option>
                                                <option value="Rejected">Rejected</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                                            <div className="font-semibold text-slate-700 mb-1">Order Items:</div>
                                            {o.orderSummary}
                                        </div>
                                        <div className="shrink-0 text-right flex flex-col justify-end">
                                            <div className="text-xs text-slate-400 mb-1">{o.timestamp}</div>
                                            <div className="text-2xl font-bold text-slate-800">{o.totalValue}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === "stats" && (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
                            <span className="text-6xl block mb-4">📈</span>
                            <h3 className="text-xl font-bold text-slate-800">Advanced Analytics Available</h3>
                            <p className="text-slate-500">Analytics migrated to dedicated server-side components in future phase.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
