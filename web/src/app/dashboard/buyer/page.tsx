"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db, functions } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, getDoc, setDoc, addDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { updateProfile } from "firebase/auth";
import Link from "next/link";
import { Package, MapPin, Trash2, LogOut, ArrowLeft, BarChart2, ChevronRight, User, Pencil, Plus, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { markOffline } from "@/hooks/usePresence";
import { Order } from "@/types/order";
// jsPDF lazy-loaded on click (~200KB kept out of initial bundle)
const lazyDownloadInvoice = async (order: Order) => {
  const { downloadInvoice } = await import("@/lib/invoice");
  downloadInvoice(order);
};
import { normalizeIndianPhone } from "@/lib/validation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
    shopName?: string;
}

interface BuyerProfile {
    displayName: string;
    phone: string;
    shopName: string;
    gstin: string;
    gstinVerified?: boolean;
    registeredAddress?: string;
    legalName?: string;
    businessType?: string;
    entityType?: string;
    ownerName?: string;
}

const EMPTY_PROFILE: BuyerProfile = { displayName: "", phone: "", shopName: "", gstin: "" };

/* ─── Address Form Dialog ─── */
function AddressFormDialog({
    open,
    onOpenChange,
    address,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    address: Address | null;
    onSave: (data: Omit<Address, "id">, id?: string) => Promise<void>;
}) {
    const isEdit = !!address;
    const [form, setForm] = React.useState({ name: "", phone: "", loc: "", pin: "", shopName: "" });
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setForm({
                name: address?.name || "",
                phone: address?.phone || "",
                loc: address?.loc || "",
                pin: address?.pin || "",
                shopName: address?.shopName || "",
            });
            setErrors({});
        }
    }, [open, address]);

    const validate = () => {
        const e: Record<string, string> = {};
        const n = form.name.trim();
        const p = form.phone.trim();
        const l = form.loc.trim();
        const pin = form.pin.trim();
        if (n.length < 2 || n.length > 50) e.name = "Name must be 2-50 characters";
        if (!/^\d{10}$/.test(p)) e.phone = "Phone must be exactly 10 digits";
        if (l.length < 10 || l.length > 200) e.loc = "Address must be 10-200 characters";
        if (!/^\d{6}$/.test(pin)) e.pin = "Pincode must be exactly 6 digits";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave(
                { name: form.name.trim(), phone: form.phone.trim(), loc: form.loc.trim(), pin: form.pin.trim(), shopName: form.shopName.trim() || undefined },
                address?.id
            );
            onOpenChange(false);
        } catch {
            toast.error("Failed to save address.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Address" : "Add New Address"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Contact Name *</label>
                        <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Phone *</label>
                        <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: normalizeIndianPhone(e.target.value) }))} placeholder="10-digit phone" inputMode="tel" />
                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Shop / Business Name</label>
                        <Input value={form.shopName} onChange={(e) => setForm(p => ({ ...p, shopName: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Address *</label>
                        <textarea
                            value={form.loc}
                            onChange={(e) => setForm(p => ({ ...p, loc: e.target.value }))}
                            placeholder="Full delivery address"
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
                        />
                        {errors.loc && <p className="text-xs text-red-500 mt-1">{errors.loc}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Pincode *</label>
                        <Input value={form.pin} onChange={(e) => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit pincode" inputMode="numeric" />
                        {errors.pin && <p className="text-xs text-red-500 mt-1">{errors.pin}</p>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? "Saving..." : isEdit ? "Update Address" : "Add Address"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
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
    if (status === "Shipped") return "secondary";
    if (status === "Accepted") return "secondary";
    if (status === "Rejected") return "destructive";
    return "outline";
}

type TabKey = "overview" | "orders" | "addresses" | "profile";
const VALID_TABS: TabKey[] = ["overview", "orders", "addresses", "profile"];

export default function BuyerDashboard() {
    const { currentUser } = useAuth();
    const { col } = useMode();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab") as TabKey | null;
    const initialTab: TabKey = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "overview";
    const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Profile state
    const [profile, setProfile] = useState<BuyerProfile>(EMPTY_PROFILE);
    const [profileSaving, setProfileSaving] = useState(false);

    // GSTIN verification state
    const [gstinStatus, setGstinStatus] = useState<"idle" | "verifying" | "verified" | "error" | "format_only">("idle");
    const [gstinMessage, setGstinMessage] = useState("");

    // Address dialog state
    const [addressDialogOpen, setAddressDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);

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

                // Fetch Buyer Profile
                const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
                if (profileSnap.exists()) {
                    const p = profileSnap.data();
                    const rawPhone = p.phone || currentUser.phoneNumber || "";
                    // Strip +91 country code from Firebase auth phone to get 10-digit form
                    const normalizedPhone = rawPhone.replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);
                    setProfile({
                        displayName: p.displayName || currentUser.displayName || "",
                        phone: normalizedPhone,
                        shopName: p.shopName || "",
                        gstin: p.gstin || "",
                        gstinVerified: p.gstinVerified || false,
                        registeredAddress: p.registeredAddress || "",
                        legalName: p.legalName || "",
                        businessType: p.businessType || "",
                        entityType: p.entityType || "",
                        ownerName: p.ownerName || "",
                    });
                    // Restore verified status if GSTIN was previously verified
                    if (p.gstinVerified && p.gstin) {
                        setGstinStatus("verified");
                        setGstinMessage("Previously verified");
                    }
                } else {
                    const fallbackPhone = normalizeIndianPhone(currentUser.phoneNumber || "");
                    setProfile({
                        displayName: currentUser.displayName || "",
                        phone: fallbackPhone,
                        shopName: "",
                        gstin: "",
                    });
                }
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

    const handleSaveProfile = async () => {
        if (!currentUser) return;
        setProfileSaving(true);
        try {
            const profileData: Record<string, unknown> = {
                displayName: profile.displayName.trim(),
                phone: profile.phone.trim(),
                shopName: profile.shopName.trim(),
                gstin: profile.gstin.trim(),
                updatedAt: new Date().toISOString(),
            };

            // Persist GSTIN verification data
            if (profile.gstinVerified) {
                profileData.gstinVerified = true;
                if (profile.registeredAddress) profileData.registeredAddress = profile.registeredAddress;
                if (profile.legalName) profileData.legalName = profile.legalName;
                if (profile.businessType) profileData.businessType = profile.businessType;
                if (profile.entityType) profileData.entityType = profile.entityType;
                if (profile.ownerName) profileData.ownerName = profile.ownerName;
            }

            await setDoc(doc(db, "users", currentUser.uid), profileData, { merge: true });

            if (profile.displayName.trim() && profile.displayName.trim() !== currentUser.displayName) {
                await updateProfile(currentUser, { displayName: profile.displayName.trim() });
            }
            toast.success("Profile saved!");
        } catch (e) {
            console.error("Failed to save profile:", e);
            toast.error("Failed to save profile.");
        } finally {
            setProfileSaving(false);
        }
    };

    const handleVerifyGSTIN = async () => {
        const gstin = profile.gstin.trim().toUpperCase();
        if (!gstin || gstin.length !== 15) {
            setGstinStatus("error");
            setGstinMessage("GSTIN must be exactly 15 characters");
            return;
        }

        setGstinStatus("verifying");
        setGstinMessage("");
        try {
            const verifyFn = httpsCallable(functions, "verifyGSTIN");
            const result = await verifyFn({ gstin });
            const data = result.data as {
                valid: boolean; formatValid: boolean; verified: boolean;
                tradeName?: string; legalName?: string; status?: string;
                businessType?: string; entityType?: string; ownerName?: string;
                address?: string; message: string;
            };

            if (data.verified && data.valid) {
                setGstinStatus("verified");
                setGstinMessage(data.message);

                // Auto-fill fields from verified data
                const bizName = data.tradeName || data.legalName || "";
                const updates: Partial<BuyerProfile> = {
                    gstinVerified: true,
                    legalName: data.legalName || "",
                    businessType: data.businessType || "",
                    entityType: data.entityType || "",
                    ownerName: data.ownerName || "",
                };

                // Auto-fill registered address
                if (data.address) {
                    updates.registeredAddress = data.address;
                }

                // Auto-fill shop name from trade name
                if (bizName && !profile.shopName.trim()) {
                    updates.shopName = bizName;
                    toast.success(`Business name auto-filled: ${bizName}`);
                } else if (bizName && profile.shopName.trim() !== bizName) {
                    toast(`Registered name: ${bizName}`, {
                        action: {
                            label: "Use this name",
                            onClick: () => setProfile(p => ({ ...p, shopName: bizName })),
                        },
                    });
                }

                setProfile(p => ({ ...p, ...updates }));
            } else if (data.formatValid && !data.verified) {
                setGstinStatus("format_only");
                setGstinMessage(data.message);
            } else {
                setGstinStatus("error");
                setGstinMessage(data.message);
                setProfile(p => ({ ...p, gstinVerified: false, registeredAddress: undefined }));
            }
        } catch (e) {
            console.error("GSTIN verification error:", e);
            setGstinStatus("error");
            setGstinMessage("Verification failed. Please try again.");
        }
    };

    const handleSaveAddress = async (data: Omit<Address, "id">, id?: string) => {
        if (!currentUser) return;
        const payload: Record<string, string> = { name: data.name, phone: data.phone, loc: data.loc, pin: data.pin };
        if (data.shopName) payload.shopName = data.shopName;

        if (id) {
            await updateDoc(doc(db, "users", currentUser.uid, "addresses", id), payload);
            setAddresses(prev => prev.map(a => a.id === id ? { ...a, ...payload } : a));
            toast.success("Address updated.");
        } else {
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "addresses"), payload);
            setAddresses(prev => [...prev, { id: docRef.id, ...data } as Address]);
            toast.success("Address added.");
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
                                href={`/dashboard/buyer/orders/detail?id=${o.id}`}
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
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-500">{o.productCount || 0} items</span>
                                        {(o.status === "Fulfilled" || o.status === "Shipped" || o.status === "Accepted") && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); lazyDownloadInvoice(o); }}
                                            >
                                                <FileText className="w-3.5 h-3.5 mr-1" /> Invoice
                                            </Button>
                                        )}
                                    </div>
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
            return (
                <div className="space-y-4">
                    <Button
                        onClick={() => { setEditingAddress(null); setAddressDialogOpen(true); }}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Add Address
                    </Button>

                    {addresses.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 flex flex-col items-center">
                            <MapPin className="w-12 h-12 text-slate-300 mb-2" />
                            No saved addresses. Add one above!
                        </div>
                    ) : (
                        addresses.map(a => (
                            <div key={a.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 mb-1">
                                        {a.name || 'Contact'} <span className="font-normal text-slate-500 ml-1">- {a.phone}</span>
                                    </div>
                                    {a.shopName && (
                                        <div className="text-sm text-slate-600 mb-1">{a.shopName}</div>
                                    )}
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
                                <div className="flex items-center gap-1 shrink-0 ml-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setEditingAddress(a); setAddressDialogOpen(true); }}
                                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.preventDefault(); setDeleteTarget(a.id); }}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            );
        }

        if (activeTab === "profile") {
            return (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Business Details</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Display Name</label>
                                <Input
                                    value={profile.displayName}
                                    onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value }))}
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone Number</label>
                                <Input
                                    value={profile.phone}
                                    onChange={(e) => setProfile(p => ({ ...p, phone: normalizeIndianPhone(e.target.value) }))}
                                    placeholder="10-digit phone"
                                    inputMode="tel"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Shop / Business Name</label>
                                <Input
                                    value={profile.shopName}
                                    onChange={(e) => setProfile(p => ({ ...p, shopName: e.target.value }))}
                                    placeholder="e.g. Ravi Vegetables, Sai Restaurant"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">GSTIN</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={profile.gstin}
                                        onChange={(e) => {
                                            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                                            setProfile(p => ({ ...p, gstin: v }));
                                            if (gstinStatus !== "idle") setGstinStatus("idle");
                                        }}
                                        placeholder="e.g. 22AAAAA0000A1Z5"
                                        maxLength={15}
                                        className="font-mono tracking-wider"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={handleVerifyGSTIN}
                                        disabled={gstinStatus === "verifying" || profile.gstin.trim().length !== 15}
                                        className="shrink-0"
                                    >
                                        {gstinStatus === "verifying" ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Verifying</>
                                        ) : (
                                            "Verify"
                                        )}
                                    </Button>
                                </div>
                                {gstinStatus === "verified" && (
                                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {gstinMessage}
                                    </p>
                                )}
                                {gstinStatus === "error" && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" /> {gstinMessage}
                                    </p>
                                )}
                                {gstinStatus === "format_only" && (
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {gstinMessage}
                                    </p>
                                )}
                                {gstinStatus === "idle" && (
                                    <p className="text-xs text-slate-400 mt-1">Optional. Enter 15-character GSTIN and click Verify to auto-fill business name.</p>
                                )}
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button onClick={handleSaveProfile} disabled={profileSaving}>
                                {profileSaving ? "Saving..." : "Save Profile"}
                            </Button>
                        </div>
                    </div>

                    {/* GST Registered Details — shown after verification */}
                    {profile.gstinVerified && (profile.registeredAddress || profile.legalName) && (
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-emerald-800">GST Registered Details</h2>
                            </div>
                            <div className="text-sm text-emerald-900 space-y-2">
                                {profile.legalName && (
                                    <div className="flex items-start gap-2">
                                        <span className="font-medium text-emerald-700 w-32 shrink-0">
                                            {profile.entityType === "Proprietorship" ? "Proprietor Name:" : "Legal Name:"}
                                        </span>
                                        <span>{profile.legalName}</span>
                                    </div>
                                )}
                                {profile.entityType && (
                                    <div className="flex items-start gap-2">
                                        <span className="font-medium text-emerald-700 w-32 shrink-0">Entity Type:</span>
                                        <span>{profile.entityType}</span>
                                    </div>
                                )}
                                {profile.businessType && profile.businessType !== profile.entityType && (
                                    <div className="flex items-start gap-2">
                                        <span className="font-medium text-emerald-700 w-32 shrink-0">Business Type:</span>
                                        <span>{profile.businessType}</span>
                                    </div>
                                )}
                                {profile.registeredAddress && (
                                    <div className="flex items-start gap-2">
                                        <span className="font-medium text-emerald-700 w-32 shrink-0">Reg. Address:</span>
                                        <span className="leading-relaxed">{profile.registeredAddress}</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-emerald-600 mt-3">This address will be used as the billing address on your invoices.</p>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Account Info</h2>
                        <div className="text-sm text-slate-600 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-500 w-20">Email:</span>
                                <span>{currentUser.email || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-500 w-20">Auth Phone:</span>
                                <span>{currentUser.phoneNumber || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-500 w-20">User ID:</span>
                                <span className="font-mono text-xs text-slate-400">{currentUser.uid}</span>
                            </div>
                        </div>
                    </div>
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
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <User className="w-5 h-5" /> Profile
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 hidden md:block">
                    <button
                        onClick={async () => {
                            if (currentUser) await markOffline(currentUser.uid);
                            const { auth } = await import("@/lib/firebase");
                            await auth.signOut();
                        }}
                        className="flex items-center gap-2 text-red-600 font-medium px-4 py-2 hover:bg-red-50 rounded-lg w-full transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 md:p-8 max-h-screen overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6 capitalize">{activeTab === "overview" ? "Overview" : activeTab === "orders" ? "Order History" : activeTab === "addresses" ? "Addresses" : "Profile"}</h1>
                    {renderCurrentTab()}
                </div>
            </div>

            {/* Address Form Dialog */}
            <AddressFormDialog
                open={addressDialogOpen}
                onOpenChange={setAddressDialogOpen}
                address={editingAddress}
                onSave={handleSaveAddress}
            />
        </div>
    );
}
