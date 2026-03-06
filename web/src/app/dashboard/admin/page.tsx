"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore, Product } from "@/contexts/AppContext";
import { db, functions } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import Image from "next/image";
import { Settings, PackageSearch, Activity, ArrowLeft, LogOut, Save, Upload, Loader2, Search, Cog, Users, ShoppingBasket, BookOpen, FlaskConical, Plus, Zap } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { useMode } from "@/contexts/ModeContext";
import { ModeToggle } from "@/components/admin/ModeToggle";
import { useRouter } from "next/navigation";
import OrdersTab from "@/components/admin/OrdersTab";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import SettingsTab from "@/components/admin/SettingsTab";
import UsersTab from "@/components/admin/UsersTab";
import BuyingStockTab from "@/components/admin/BuyingStockTab";
import AccountsTab from "@/components/admin/AccountsTab";
import CommandCenter from "@/components/admin/CommandCenter";
import AddProductModal from "@/components/admin/AddProductModal";
import PriceTierEditor from "@/components/admin/PriceTierEditor";
import { markOffline } from "@/hooks/usePresence";
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
    const { mode } = useMode();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"command" | "prices" | "orders" | "stats" | "users" | "stock" | "accounts" | "settings">("command");
    const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);

    // Navigate from C2 map to Orders tab, highlighting a specific order
    const navigateToOrder = useCallback((orderId: string) => {
        setHighlightOrderId(orderId);
        setActiveTab("orders");
    }, []);

    // F2 keyboard shortcut to jump to Command Center
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "F2") {
                e.preventDefault();
                setActiveTab("command");
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);
    const [editingProducts, setEditingProducts] = useState<Product[]>([]);
    const [globalCommission, setGlobalCommission] = useState(15);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [tierEditProduct, setTierEditProduct] = useState<Product | null>(null);
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
            console.error("[Admin] Failed to save products:", e);
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
                        onClick={() => setActiveTab("command")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'command' ? 'bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-400 shadow-inner border border-amber-500/20' : 'hover:bg-slate-800/50 hover:text-amber-300'}`}
                    >
                        <Zap className="w-5 h-5" /> Command Center
                    </button>
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
                    <button
                        onClick={() => setActiveTab("users")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <Users className="w-5 h-5" /> User Management
                    </button>
                    <button
                        onClick={() => setActiveTab("stock")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'stock' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <ShoppingBasket className="w-5 h-5" /> Buying Stock
                    </button>
                    <button
                        onClick={() => setActiveTab("accounts")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'accounts' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <BookOpen className="w-5 h-5" /> Accounts
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <Cog className="w-5 h-5" /> Settings
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800 hidden md:block space-y-2">
                    <ModeToggle />
                    <button
                        onClick={async () => {
                            if (currentUser) await markOffline(currentUser.uid);
                            const { auth } = await import("@/lib/firebase");
                            await auth.signOut();
                        }}
                        className="flex items-center gap-2 text-red-400 font-medium px-4 py-2 hover:bg-red-500/10 rounded-lg w-full transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 max-h-screen overflow-y-auto ${activeTab === 'command' ? 'p-2 md:p-3' : 'p-4 md:p-8'}`}>
                {activeTab === "command" && (
                    <>
                        {mode === "test" && (
                            <div className="bg-amber-950/50 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg mb-2 text-[11px] font-semibold flex items-center justify-center gap-2">
                                <FlaskConical className="w-3.5 h-3.5" />
                                TEST MODE — Monitoring test data
                            </div>
                        )}
                        <CommandCenter onNavigateToOrder={navigateToOrder} />
                    </>
                )}
                <div className={`max-w-6xl mx-auto ${activeTab === 'command' ? 'hidden' : ''}`}>
                    {mode === "test" && activeTab !== "command" && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2.5 rounded-xl mb-4 text-sm font-semibold flex items-center justify-center gap-2">
                            <FlaskConical className="w-4 h-4" />
                            TEST MODE — Data shown is for testing purposes only
                        </div>
                    )}
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
                                        variant="outline"
                                        onClick={() => setAddProductOpen(true)}
                                    >
                                        <Plus className="w-4 h-4" /> Add Product
                                    </Button>
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
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3 text-center">Active</th>
                                                <th className="px-4 py-3">Override &#8377;</th>
                                                <th className="px-4 py-3 text-center">MOQ</th>
                                                <th className="px-4 py-3 text-center">
                                                    <label className="flex items-center gap-1 justify-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingProducts.length > 0 && editingProducts.every(p => p.moqRequired !== false)}
                                                            onChange={(e) => {
                                                                const val = e.target.checked;
                                                                setEditingProducts(prev => prev.map(p => ({ ...p, moqRequired: val })));
                                                            }}
                                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                                        />
                                                        <span>MOQ Req.</span>
                                                    </label>
                                                </th>
                                                <th className="px-4 py-3 text-center">Tiers</th>
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
                                                                        unoptimized={!p.image.includes("googleapis.com")}
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
                                                        <div className="text-xs text-slate-500">
                                                            <span className="font-telugu">{p.telugu}</span>
                                                            {p.hindi && <><span className="text-slate-300 mx-1">|</span>{p.hindi}</>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={p.category || ""}
                                                            onChange={(e) => handleProductChange(p.id, "category", e.target.value)}
                                                            className="px-2 py-1 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-emerald-500 w-full max-w-[140px]"
                                                        >
                                                            <option value="">—</option>
                                                            {PRODUCT_CATEGORIES.map((c) => (
                                                                <option key={c.id} value={c.id}>{c.label}</option>
                                                            ))}
                                                        </select>
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
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={p.moqRequired !== false}
                                                            onChange={(e) => handleProductChange(p.id, 'moqRequired', e.target.checked)}
                                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => setTierEditProduct(p)}
                                                            className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                                                                p.priceTiers && p.priceTiers.length > 0
                                                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                    : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                                            }`}
                                                        >
                                                            {p.priceTiers && p.priceTiers.length > 0
                                                                ? `${p.priceTiers.length} tiers`
                                                                : "+ Add"}
                                                        </button>
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
                        <OrdersTab
                            products={products}
                            highlightOrderId={highlightOrderId}
                            onHighlightClear={() => setHighlightOrderId(null)}
                        />
                    )}

                    {activeTab === "stats" && <AdminAnalytics />}

                    {activeTab === "users" && <UsersTab />}

                    {activeTab === "stock" && <BuyingStockTab />}

                    {activeTab === "accounts" && <AccountsTab />}

                    {activeTab === "settings" && <SettingsTab />}

                    {/* Add Product Modal */}
                    <AddProductModal
                        open={addProductOpen}
                        onClose={() => setAddProductOpen(false)}
                        existingIds={editingProducts.map(p => p.id)}
                        onProductAdded={(p) => setEditingProducts(prev => [...prev, p])}
                    />

                    {/* Price Tier Editor Modal */}
                    {tierEditProduct && (
                        <PriceTierEditor
                            product={tierEditProduct}
                            onSave={(productId, tiers) => {
                                setEditingProducts(prev =>
                                    prev.map(p => p.id === productId
                                        ? { ...p, priceTiers: tiers.length > 0 ? tiers : undefined }
                                        : p
                                    )
                                );
                            }}
                            onClose={() => setTierEditProduct(null)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
