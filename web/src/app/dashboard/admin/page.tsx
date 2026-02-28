"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore, Product } from "@/contexts/AppContext";
import { db, functions } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import Image from "next/image";
import { Settings, PackageSearch, Activity, ArrowLeft, LogOut, Save, Upload, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import OrdersTab from "@/components/admin/OrdersTab";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function AdminDashboard() {
    const { currentUser, isAdmin, loading: authLoading } = useAuth();
    const { products } = useAppStore();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"prices" | "orders" | "stats">("prices");
    const [editingProducts, setEditingProducts] = useState<Product[]>([]);
    const [globalCommission, setGlobalCommission] = useState(15);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetId = useRef<number | null>(null);

    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            router.push("/");
        }
    }, [currentUser, isAdmin, authLoading, router]);

    useEffect(() => {
        if (products.length > 0) {
            setEditingProducts(JSON.parse(JSON.stringify(products)));
        }
    }, [products]);

    const handleProductChange = (id: number, field: keyof Product, value: string | number | boolean) => {
        setEditingProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSaveAllProducts = async () => {
        setConfirmSaveOpen(false);
        setLoading(true);
        try {
            const batch = [];
            for (const p of editingProducts) {
                batch.push(setDoc(doc(db, "products", p.id.toString()), p, { merge: true }));
            }
            await Promise.all(batch);
            toast.success("All products have been updated successfully!");
        } catch (e) {
            console.error(e);
            toast.error("Error saving products. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (productId: number) => {
        uploadTargetId.current = productId;
        fileInputRef.current?.click();
    };

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const productId = uploadTargetId.current;
        if (!file || productId === null) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("Image must be under 10MB.");
            return;
        }

        setUploadingId(productId);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const uploadFn = httpsCallable<
                { productId: string; base64Image: string },
                { success: boolean; url: string }
            >(functions, "uploadProductImage");
            const result = await uploadFn({ productId: productId.toString(), base64Image: base64 });

            if (result.data.success && result.data.url) {
                setEditingProducts(prev =>
                    prev.map(p => p.id === productId ? { ...p, image: result.data.url } : p)
                );
                toast.success("Image uploaded successfully!");
            }
        } catch (err) {
            console.error("Image upload failed:", err);
            toast.error("Image upload failed. Please try again.");
        } finally {
            setUploadingId(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const filteredProducts = editingProducts.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.telugu?.toLowerCase().includes(q) || p.id.toString().includes(q);
    });

    if (authLoading || (!currentUser || !isAdmin)) {
        return <div className="min-h-screen flex items-center justify-center p-8">Loading Admin Area...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Hidden file input for image upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileSelected}
            />

            {/* Save Confirmation Dialog */}
            <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Save all product changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will update {editingProducts.length} products in the live database. Customers will see these changes immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveAllProducts}>
                            Save to Live Catalog
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                                    <Input
                                        type="number"
                                        value={globalCommission}
                                        onChange={(e) => setGlobalCommission(Number(e.target.value))}
                                        className="w-20 text-center"
                                    />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            type="text"
                                            placeholder="Search products..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-8 w-48"
                                        />
                                    </div>
                                    <Button
                                        onClick={() => setConfirmSaveOpen(true)}
                                        disabled={loading}
                                    >
                                        <Save className="w-4 h-4" /> Save Live Catalog
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Image</th>
                                                <th className="px-4 py-3">ID</th>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-center">Active</th>
                                                <th className="px-4 py-3">Override &#8377;</th>
                                                <th className="px-4 py-3 text-center">MOQ</th>
                                                <th className="px-4 py-3">Badging</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredProducts.map(p => (
                                                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.isHidden ? 'opacity-50 bg-slate-100' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center flex-shrink-0">
                                                                {p.image ? (
                                                                    <Image
                                                                        src={p.image}
                                                                        alt={p.name}
                                                                        width={40}
                                                                        height={40}
                                                                        className="object-cover w-full h-full"
                                                                    />
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs font-bold">
                                                                        {p.name?.[0] || "?"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => handleImageUpload(p.id)}
                                                                disabled={uploadingId === p.id}
                                                                className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                                                                title="Upload image"
                                                            >
                                                                {uploadingId === p.id ? (
                                                                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                                                                ) : (
                                                                    <Upload className="w-4 h-4 text-slate-400" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
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

                    {activeTab === "orders" && <OrdersTab />}

                    {activeTab === "stats" && (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
                            <h3 className="text-xl font-bold text-slate-800">Advanced Analytics</h3>
                            <p className="text-slate-500 mt-2">Analytics will be available in a future phase.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
