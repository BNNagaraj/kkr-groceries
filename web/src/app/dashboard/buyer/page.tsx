"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { Home, Package, MapPin, Trash2, LogOut, ArrowLeft, BarChart2 } from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface Order {
    id: string;
    timestamp: string;
    createdAt: any;
    status: string;
    orderSummary: string;
    productCount: number;
    totalValue: string;
}

interface Address {
    id: string;
    name: string;
    phone: string;
    loc: string;
    pin: string;
}

export default function BuyerDashboard() {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<"overview" | "orders" | "addresses">("overview");

    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Orders
                let qOrders = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                try {
                    const snap = await getDocs(qOrders);
                    setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
                } catch (e) {
                    // Fallback if index missing
                    const fallbackQ = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
                    const snap = await getDocs(fallbackQ);
                    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
                    // Sort manually
                    data.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                        return timeB - timeA;
                    });
                    setOrders(data);
                }

                // Fetch Addresses
                const snapAddr = await getDocs(collection(db, "users", currentUser.uid, "addresses"));
                setAddresses(snapAddr.docs.map(doc => ({ id: doc.id, ...doc.data() } as Address)));
            } catch (err) {
                console.error("Dashboard error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    const handleDeleteAddress = async (id: string) => {
        if (!confirm("Delete this address?")) return;
        if (!currentUser) return;
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "addresses", id));
            setAddresses(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error(e);
            alert("Failed to delete address");
        }
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800">Please Sign In</h2>
                    <Link href="/" className="text-emerald-600 mt-2 block hover:underline">Return Home</Link>
                </div>
            </div>
        );
    }

    // Calculate Overview Stats
    const totalSpent = orders.reduce((acc, o) => acc + parseInt(o.totalValue.replace(/[^0-9]/g, "") || "0", 10), 0);

    const pop: Record<string, number> = {};
    const spentByDate: Record<string, number> = {};

    orders.forEach((o) => {
        if (o.orderSummary) {
            o.orderSummary.split(", ").forEach(x => {
                const n = x.split(" x")[0];
                pop[n] = (pop[n] || 0) + 1;
            });
        }
        if (o.timestamp) {
            const d = o.timestamp.split(",")[0];
            const v = parseInt(o.totalValue.replace(/[^0-9]/g, "") || "0", 10);
            spentByDate[d] = (spentByDate[d] || 0) + v;
        }
    });

    const topItems = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const recentDates = Object.keys(spentByDate).slice(-5);

    const renderCurrentTab = () => {
        if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading dashboard...</div>;

        if (activeTab === "overview") {
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                            <div className="text-3xl font-bold text-emerald-700">{orders.length}</div>
                            <div className="text-sm text-emerald-600 font-medium">My Orders</div>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                            <div className="text-3xl font-bold text-blue-700">₹{totalSpent.toLocaleString('en-IN')}</div>
                            <div className="text-sm text-blue-600 font-medium">Total Spent</div>
                        </div>
                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                            <div className="text-3xl font-bold text-amber-700">{Object.keys(pop).length}</div>
                            <div className="text-sm text-amber-600 font-medium">Unique Items Ordered</div>
                        </div>
                    </div>

                    {orders.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px]">
                                <h3 className="font-bold mb-4 text-slate-800">Recent Spending</h3>
                                <Bar
                                    data={{
                                        labels: recentDates,
                                        datasets: [{
                                            label: "Spend (₹)",
                                            data: recentDates.map(d => spentByDate[d]),
                                            backgroundColor: "#3b82f6",
                                            borderRadius: 4
                                        }]
                                    }}
                                    options={{ maintainAspectRatio: false }}
                                />
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px] flex flex-col">
                                <h3 className="font-bold mb-4 text-slate-800">Top Items</h3>
                                <div className="flex-1 min-h-0 flex items-center justify-center">
                                    <Pie
                                        data={{
                                            labels: topItems.map(x => x[0]),
                                            datasets: [{
                                                data: topItems.map(x => x[1]),
                                                backgroundColor: ["#10b981", "#f59e0b", "#ef4444"]
                                            }]
                                        }}
                                        options={{ maintainAspectRatio: false }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                            <span className="text-4xl block mb-2">📊</span>
                            <p className="text-slate-500">Make your first order to unlock insights!</p>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === "orders") {
            if (orders.length === 0) {
                return <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 flex flex-col items-center"><Package className="w-12 h-12 text-slate-300 mb-2" />No orders yet.</div>;
            }
            return (
                <div className="space-y-4">
                    {orders.map(o => {
                        const isFulfilled = o.status === "Fulfilled";
                        const isAccepted = o.status === "Accepted";
                        const isRejected = o.status === "Rejected";
                        const statusColor = isFulfilled ? "text-emerald-700 bg-emerald-50 ring-emerald-600/20" :
                            isAccepted ? "text-blue-700 bg-blue-50 ring-blue-600/20" :
                                isRejected ? "text-red-700 bg-red-50 ring-red-600/20" :
                                    "text-amber-700 bg-amber-50 ring-amber-600/20";

                        return (
                            <div key={o.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                    <div>
                                        <div className="font-semibold text-slate-800">{o.timestamp}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{o.id}</div>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${statusColor} w-max`}>
                                        {o.status || 'Pending'}
                                    </span>
                                </div>
                                <div className="py-3 border-y border-slate-100 text-sm text-slate-600 leading-relaxed">
                                    {o.orderSummary}
                                </div>
                                <div className="flex justify-between items-center mt-3 pt-1">
                                    <span className="text-sm font-medium text-slate-500">{o.productCount || 0} items</span>
                                    <span className="text-lg font-bold text-slate-800">{o.totalValue}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (activeTab === "addresses") {
            if (addresses.length === 0) {
                return <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 flex flex-col items-center"><MapPin className="w-12 h-12 text-slate-300 mb-2" />No saved addresses.</div>;
            }
            return (
                <div className="space-y-4">
                    {addresses.map(a => (
                        <div key={a.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                            <div>
                                <div className="font-bold text-slate-800 mb-1">
                                    {a.name || 'Contact'} <span className="font-normal text-slate-500 ml-1">- {a.phone}</span>
                                </div>
                                <div className="text-sm text-slate-600 mb-1 leading-relaxed max-w-xl">{a.loc}</div>
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pincode: {a.pin}</div>
                            </div>
                            <button
                                onClick={() => handleDeleteAddress(a.id)}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete Address"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-white border-r border-slate-200 shrink-0 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex flex-col gap-2">
                    <Link href="/" className="flex items-center gap-2 text-emerald-700 font-bold hover:opacity-80 transition-opacity">
                        <ArrowLeft className="w-4 h-4" /> Back to Store
                    </Link>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                            {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : "U"}
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">{currentUser.displayName || "Buyer"}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[140px]">{currentUser.email || currentUser.phoneNumber}</div>
                        </div>
                    </div>
                </div>

                <nav className="p-4 flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar flex-1">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <BarChart2 className="w-5 h-5" /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("orders")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Package className="w-5 h-5" /> Order History
                    </button>
                    <button
                        onClick={() => setActiveTab("addresses")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'addresses' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <MapPin className="w-5 h-5" /> Addresses
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 hidden md:block">
                    <button
                        onClick={() => { import("@/lib/firebase").then(({ auth }) => auth.signOut()) }}
                        className="flex items-center gap-2 text-red-600 font-medium px-4 py-2 hover:bg-red-50 rounded-lg w-full transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 md:p-8 max-h-screen overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6 capitalize">{activeTab}</h1>
                    {renderCurrentTab()}
                </div>
            </div>
        </div>
    );
}
