"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { Package, MapPin, Trash2, LogOut, ArrowLeft, BarChart2, ChevronRight } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { Order } from "@/types/order";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import OverviewCharts from "@/components/OverviewCharts";

interface Address {
    id: string;
    name: string;
    phone: string;
    loc: string;
    pin: string;
}

/** Safely extract a numeric value from totalValue (can be string "₹1,234" or number 1234 in Firestore) */
function parseTotal(v: unknown): number {
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, "") || "0", 10);
    return 0;
}

/** Display totalValue safely — handles both string "₹1,234" and number 1234 from Firestore */
function displayTotal(v: unknown): string {
    if (typeof v === "number") return `₹${v.toLocaleString("en-IN")}`;
    if (typeof v === "string") return v;
    return "₹0";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    if (status === "Fulfilled") return "default";
    if (status === "Accepted") return "secondary";
    if (status === "Rejected") return "destructive";
    return "outline";
}

export default function BuyerDashboard() {
    const { currentUser } = useAuth();
    const { col } = useMode();
    const [activeTab, setActiveTab] = useState<"overview" | "orders" | "addresses">("overview");

    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Orders
                const qOrders = query(collection(db, col("orders")), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                try {
                    const snap = await getDocs(qOrders);
                    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
                } catch {
                    // Fallback if index missing
                    const fallbackQ = query(collection(db, col("orders")), where("userId", "==", currentUser.uid));
                    const snap = await getDocs(fallbackQ);
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
                    data.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                        return timeB - timeA;
                    });
                    setOrders(data);
                }

                // Fetch Addresses
                const snapAddr = await getDocs(collection(db, "users", currentUser.uid, "addresses"));
                setAddresses(snapAddr.docs.map(d => ({ id: d.id, ...d.data() } as Address)));
            } catch (err) {
                console.error("Dashboard error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, col]);

    const handleDeleteAddress = async () => {
        if (!deleteTarget || !currentUser) return;
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "addresses", deleteTarget));
            setAddresses(prev => prev.filter(a => a.id !== deleteTarget));
            toast.success("Address deleted.");
        } catch (e) {
            console.error("[Dashboard] Failed to delete address:", e);
            toast.error("Failed to delete address.");
        } finally {
            setDeleteTarget(null);
        }
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800">Please Sign In</h2>
                    <Link href="/" className="text-primary mt-2 block hover:underline">Return Home</Link>
                </div>
            </div>
        );
    }

    // Calculate Overview Stats
    const totalSpent = orders.reduce((acc, o) => acc + parseTotal(o.totalValue), 0);

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
            const v = parseTotal(o.totalValue);
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
                        <OverviewCharts
                            recentDates={recentDates}
                            spentByDate={spentByDate}
                            topItems={topItems}
                        />
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
                        const hasPendingMod = o.modificationStatus === "PendingBuyerApproval";

                        return (
                            <Link
                                key={o.id}
                                href={`/dashboard/buyer/orders/${o.id}`}
                                className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                    <div>
                                        <div className="font-semibold text-slate-800">{o.timestamp}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{o.orderId || o.id}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={statusBadgeVariant(o.status || "Pending")}>
                                            {o.status || "Pending"}
                                        </Badge>
                                        {hasPendingMod && (
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                                Action Required
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="py-3 border-y border-slate-100 text-sm text-slate-600 leading-relaxed">
                                    {o.orderSummary}
                                </div>
                                <div className="flex justify-between items-center mt-3 pt-1">
                                    <span className="text-sm font-medium text-slate-500">{o.productCount || 0} items</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-slate-800">{displayTotal(o.totalValue)}</span>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    </div>
                                </div>
                            </Link>
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
                                <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(a.loc)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-sky-600 hover:underline mb-1 leading-relaxed max-w-xl block"
                                >
                                    {a.loc}
                                </a>
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pincode: {a.pin}</div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.preventDefault(); setDeleteTarget(a.id); }}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </div>
                    ))}
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Delete Address Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this address?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The address will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleDeleteAddress}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
