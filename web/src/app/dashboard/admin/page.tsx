"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore, Product, ProductTier } from "@/contexts/AppContext";
import { db, functions } from "@/lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import Image from "next/image";
import { Settings, PackageSearch, Activity, ArrowLeft, LogOut, Save, Upload, Loader2, Search, Cog, Users, ShoppingBasket, BookOpen, FlaskConical, Plus, Zap, Trash2, Warehouse, Package, Ruler, X, ChevronUp, ChevronDown, GripVertical, UtensilsCrossed, MessageCircle, Star } from "lucide-react";
import { formatTiersForDisplay } from "@/lib/pricing";
import { CATEGORY_GROUPS, UNIT_OPTIONS } from "@/lib/constants";
import { useUnitOptions } from "@/hooks/useUnitOptions";
import { useMode } from "@/contexts/ModeContext";
import { ModeToggle } from "@/components/admin/ModeToggle";
import { useRouter } from "next/navigation";
import { markOffline } from "@/hooks/usePresence";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { toast } from "sonner";

// ── Lazy-loaded tab components (only compiled when the tab is first opened) ──
const TabLoader = () => (
    <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
    </div>
);

const CommandCenter = dynamic(() => import("@/components/admin/CommandCenter"), {
    loading: TabLoader, ssr: false,
});
const OrdersTab = dynamic(() => import("@/components/admin/OrdersTab"), {
    loading: TabLoader, ssr: false,
});
const AdminAnalytics = dynamic(() => import("@/components/admin/AdminAnalytics"), {
    loading: TabLoader, ssr: false,
});
const SettingsTab = dynamic(() => import("@/components/admin/SettingsTab"), {
    loading: TabLoader, ssr: false,
});
const UsersTab = dynamic(() => import("@/components/admin/UsersTab"), {
    loading: TabLoader, ssr: false,
});
const BuyingStockTab = dynamic(() => import("@/components/admin/BuyingStockTab"), {
    loading: TabLoader, ssr: false,
});
const AccountsTab = dynamic(() => import("@/components/admin/AccountsTab"), {
    loading: TabLoader, ssr: false,
});
const InventoryTab = dynamic(() => import("@/components/admin/InventoryTab"), {
    loading: TabLoader, ssr: false,
});
const StoreHub = dynamic(() => import("@/components/admin/StoreHub"), {
    loading: TabLoader, ssr: false,
});
const HorecaRequestsTab = dynamic(() => import("@/components/admin/HorecaRequestsTab"), {
    loading: TabLoader, ssr: false,
});
const MessagesTab = dynamic(() => import("@/components/admin/MessagesTab"), {
    loading: TabLoader, ssr: false,
});
const AddProductModal = dynamic(() => import("@/components/admin/AddProductModal"), {
    ssr: false,
});
const PriceTierEditor = dynamic(() => import("@/components/admin/PriceTierEditor"), {
    ssr: false,
});

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
    const { allProducts: products } = useAppStore();
    const { mode } = useMode();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"command" | "prices" | "orders" | "stats" | "users" | "horeca" | "messages" | "stock" | "accounts" | "inventory" | "storehub" | "settings">("command");
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
    const [confirmCopyOpen, setConfirmCopyOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const [priceTierFilter, setPriceTierFilter] = useState<ProductTier>("standard");
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [manageUnitsOpen, setManageUnitsOpen] = useState(false);
    const [newUnitInput, setNewUnitInput] = useState("");
    const { units: allUnits, customUnits, addUnit, removeUnit } = useUnitOptions();
    const [tierEditProduct, setTierEditProduct] = useState<Product | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
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

    // Products that would be copied to the Restaurant/Hotel (economy) tier:
    // every Regular product that doesn't already have an economy copy.
    const economyCopiedSourceIds = new Set(
        products
            .filter((p) => p.tier === "economy")
            .map((p) => p.sourceId)
            .filter((x): x is number => typeof x === "number")
    );
    const productsToCopy = products.filter(
        (p) => (p.tier || "standard") === "standard" && !economyCopiedSourceIds.has(p.id)
    );

    const handleCopyToHoreca = async () => {
        setConfirmCopyOpen(false);
        if (productsToCopy.length === 0) {
            toast.info("All Regular products are already copied to Restaurant / Hotel.");
            return;
        }
        setCopying(true);
        try {
            let maxId = products.reduce((m, p) => Math.max(m, p.id), 0);
            const batch = productsToCopy.map((p) => {
                maxId += 1;
                const copy: Product = { ...p, id: maxId, tier: "economy", sourceId: p.id };
                return setDoc(doc(db, "products", maxId.toString()), copy);
            });
            await Promise.all(batch);
            toast.success(
                `Copied ${productsToCopy.length} product${productsToCopy.length > 1 ? "s" : ""} to Restaurant / Hotel. Switch the Tier column to adjust their prices.`
            );
        } catch (e) {
            console.error("[Admin] Copy to Restaurant/Hotel failed:", e);
            toast.error("Failed to copy products. Please try again.");
        } finally {
            setCopying(false);
        }
    };

    const handleDeleteProduct = async () => {
        if (!deleteTarget || deleteConfirmText.toLowerCase() !== "delete") return;
        try {
            await deleteDoc(doc(db, "products", deleteTarget.id.toString()));
            setEditingProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
            toast.success(`"${deleteTarget.name}" has been permanently deleted.`);
        } catch (e) {
            console.error("[Admin] Failed to delete product:", e);
            toast.error("Error deleting product. Please try again.");
        } finally {
            setDeleteTarget(null);
            setDeleteConfirmText("");
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

    /** Move a product up or down in the sort order */
    const handleMoveProduct = (productId: number, direction: "up" | "down") => {
        setEditingProducts(prev => {
            const sorted = [...prev].sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
            const idx = sorted.findIndex(p => p.id === productId);
            if (idx < 0) return prev;
            if (direction === "up" && idx === 0) return prev;
            if (direction === "down" && idx === sorted.length - 1) return prev;

            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            const reordered = sorted.map((p, i) => ({ ...p, sortOrder: i }));
            const tempOrder = reordered[idx].sortOrder;
            reordered[idx] = { ...reordered[idx], sortOrder: reordered[swapIdx].sortOrder };
            reordered[swapIdx] = { ...reordered[swapIdx], sortOrder: tempOrder };

            return reordered;
        });
    };

    /** Jump a product to a specific position (1-based input from the admin) */
    const handleJumpToPosition = (productId: number, targetPos: number) => {
        setEditingProducts(prev => {
            const sorted = [...prev].sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
            const fromIdx = sorted.findIndex(p => p.id === productId);
            if (fromIdx < 0) return prev;

            // Clamp to valid 0-based range
            const toIdx = Math.max(0, Math.min(sorted.length - 1, targetPos - 1));
            if (fromIdx === toIdx) return prev;

            // Remove the product from its current position and insert at the target
            const item = sorted[fromIdx];
            sorted.splice(fromIdx, 1);
            sorted.splice(toIdx, 0, item);

            // Re-assign sequential sortOrder values
            return sorted.map((p, i) => ({ ...p, sortOrder: i }));
        });
    };

    // Sort editingProducts by sortOrder for display
    const sortedEditingProducts = [...editingProducts].sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));

    const filteredProducts = sortedEditingProducts.filter(p => {
        // Tier sub-tab filter (Regular vs Restaurant/Hotel)
        if ((p.tier || "standard") !== priceTierFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.telugu?.toLowerCase().includes(q) || p.id.toString().includes(q);
    });

    // Counts per tier for sub-tab badges
    const regularCount = editingProducts.filter(p => (p.tier || "standard") === "standard").length;
    const horecaCount = editingProducts.filter(p => p.tier === "economy").length;

    if (authLoading || (!currentUser || !isAdmin)) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
                {/* Sidebar skeleton */}
                <div className="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 flex flex-col">
                    <div className="p-6 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-white/40 font-bold">
                            <ArrowLeft className="w-4 h-4" /> Back to Store
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 animate-pulse" />
                            <div className="space-y-2">
                                <div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
                                <div className="h-2 w-28 bg-slate-800 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                    <nav className="p-4 flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar flex-1">
                        {[1,2,3,4,5,6].map((i) => (
                            <div key={i} className="h-11 rounded-xl bg-slate-800/50 animate-pulse" />
                        ))}
                    </nav>
                </div>
                {/* Content skeleton */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        <p className="text-sm text-slate-400 font-medium">Loading admin dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PresenceProvider>
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

            {/* Copy to Restaurant/Hotel Confirmation Dialog */}
            <AlertDialog open={confirmCopyOpen} onOpenChange={setConfirmCopyOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <UtensilsCrossed className="w-5 h-5 text-purple-600" /> Copy Regular products to Restaurant / Hotel?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    This will create <strong className="text-slate-800">{productsToCopy.length}</strong> new Restaurant / Hotel
                                    {productsToCopy.length === 1 ? " item" : " items"}, duplicating every Regular product (name, category, image, units &amp; current prices).
                                </p>
                                <p className="text-sm text-slate-500">
                                    Afterwards, switch each copy&apos;s <strong>Tier</strong> column to <strong>Restaurant / Hotel</strong> view and update the prices.
                                    Regular products that were already copied are skipped, so it&apos;s safe to run this again after adding new items.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCopyToHoreca} className="bg-purple-600 hover:bg-purple-700">
                            Copy {productsToCopy.length} {productsToCopy.length === 1 ? "Product" : "Products"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Product Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">Delete Product Permanently?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>
                                    You are about to permanently delete <strong className="text-slate-800">&quot;{deleteTarget?.name}&quot;</strong> (ID: {deleteTarget?.id}).
                                    This action cannot be undone.
                                </p>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">
                                        Type <span className="text-red-600 font-mono bg-red-50 px-1 py-0.5 rounded">delete</span> to confirm:
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                        placeholder="Type 'delete' here..."
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteProduct}
                            disabled={deleteConfirmText.toLowerCase() !== "delete"}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600"
                        >
                            <Trash2 className="w-4 h-4 mr-1" /> Delete Forever
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
                        onClick={() => setActiveTab("horeca")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'horeca' ? 'bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400 shadow-inner border border-purple-500/20' : 'hover:bg-slate-800/50 hover:text-purple-300'}`}
                    >
                        <UtensilsCrossed className="w-5 h-5" /> HORECA Requests
                    </button>
                    <button
                        onClick={() => setActiveTab("messages")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'messages' ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 shadow-inner border border-blue-500/20' : 'hover:bg-slate-800/50 hover:text-blue-300'}`}
                    >
                        <MessageCircle className="w-5 h-5" /> Messages
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
                        onClick={() => setActiveTab("storehub")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'storehub' ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-400 shadow-inner border border-purple-500/20' : 'hover:bg-slate-800/50 hover:text-purple-300'}`}
                    >
                        <Warehouse className="w-5 h-5" /> Store Hub
                    </button>
                    <button
                        onClick={() => setActiveTab("inventory")}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeTab === 'inventory' ? 'bg-slate-800 text-white shadow-inner' : 'hover:bg-slate-800/50 hover:text-white'}`}
                    >
                        <Package className="w-5 h-5" /> Inventory
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
                                        onClick={() => setManageUnitsOpen(true)}
                                    >
                                        <Ruler className="w-4 h-4" /> Units
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setConfirmCopyOpen(true)}
                                        disabled={copying || productsToCopy.length === 0}
                                        className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                                        title={productsToCopy.length === 0 ? "All Regular products already copied" : `Copy ${productsToCopy.length} Regular product(s) to Restaurant/Hotel`}
                                    >
                                        {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
                                        Copy → Restaurant/Hotel
                                        {productsToCopy.length > 0 && !copying && (
                                            <span className="ml-1 bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{productsToCopy.length}</span>
                                        )}
                                    </Button>
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

                            {/* Tier sub-tabs — keep Regular and Restaurant/Hotel catalogs separate */}
                            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                                <button
                                    onClick={() => setPriceTierFilter("standard")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        priceTierFilter === "standard"
                                            ? "bg-white text-emerald-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    <Star className="w-4 h-4" /> Regular
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priceTierFilter === "standard" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{regularCount}</span>
                                </button>
                                <button
                                    onClick={() => setPriceTierFilter("economy")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        priceTierFilter === "economy"
                                            ? "bg-white text-purple-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    <UtensilsCrossed className="w-4 h-4" /> Restaurant / Hotel
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priceTierFilter === "economy" ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-500"}`}>{horecaCount}</span>
                                </button>
                            </div>

                            {/* Active tier context banner */}
                            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                                priceTierFilter === "economy"
                                    ? "bg-purple-50 border-purple-200 text-purple-800"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            }`}>
                                {priceTierFilter === "economy" ? <UtensilsCrossed className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                                You are editing
                                <span className="font-extrabold">{priceTierFilter === "economy" ? "Restaurant / Hotel" : "Regular"}</span>
                                prices
                                <span className={`font-normal ${priceTierFilter === "economy" ? "text-purple-600" : "text-emerald-600"}`}>
                                    · changes here only affect the {priceTierFilter === "economy" ? "Restaurant / Hotel" : "Regular"} catalog
                                </span>
                            </div>

                            <div className={`bg-white rounded-xl shadow-sm border overflow-hidden border-t-4 ${
                                priceTierFilter === "economy" ? "border-purple-300 border-t-purple-500" : "border-emerald-300 border-t-emerald-500"
                            }`}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className={`border-b font-bold uppercase text-[10px] tracking-wider ${
                                            priceTierFilter === "economy"
                                                ? "bg-purple-50/70 border-purple-100 text-purple-700"
                                                : "bg-emerald-50/70 border-emerald-100 text-emerald-700"
                                        }`}>
                                            <tr>
                                                <th className="px-4 py-3">Image</th>
                                                <th className="px-4 py-3">ID</th>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3">Tier</th>
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
                                                <th className="px-4 py-3 text-center">Order</th>
                                                <th className="px-4 py-3 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredProducts.length === 0 && (
                                                <tr>
                                                    <td colSpan={13} className="px-4 py-12 text-center">
                                                        {priceTierFilter === "economy" && horecaCount === 0 ? (
                                                            <div className="flex flex-col items-center gap-2 text-slate-500">
                                                                <UtensilsCrossed className="w-8 h-8 text-slate-300" />
                                                                <p className="font-semibold text-slate-600">No Restaurant / Hotel products yet</p>
                                                                <p className="text-sm">Use the <span className="font-bold text-purple-600">Copy → Restaurant/Hotel</span> button above to duplicate your Regular catalog, then adjust the prices here.</p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 text-slate-500">
                                                                <Search className="w-8 h-8 text-slate-300" />
                                                                <p className="font-semibold text-slate-600">No products match your search</p>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
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
                                                        <input
                                                            type="text"
                                                            value={p.name}
                                                            onChange={(e) => handleProductChange(p.id, "name", e.target.value)}
                                                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 min-w-[120px]"
                                                            placeholder="English name"
                                                        />
                                                        <div className="flex gap-1 mt-1">
                                                            <input
                                                                type="text"
                                                                value={p.telugu || ""}
                                                                onChange={(e) => handleProductChange(p.id, "telugu", e.target.value)}
                                                                className="w-1/2 px-1.5 py-0.5 border border-slate-200 rounded text-[11px] text-slate-500 focus:ring-1 focus:ring-emerald-500 font-telugu"
                                                                placeholder="తెలుగు"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={p.hindi || ""}
                                                                onChange={(e) => handleProductChange(p.id, "hindi", e.target.value)}
                                                                className="w-1/2 px-1.5 py-0.5 border border-slate-200 rounded text-[11px] text-slate-500 focus:ring-1 focus:ring-emerald-500"
                                                                placeholder="Hindi"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={p.category || ""}
                                                            onChange={(e) => handleProductChange(p.id, "category", e.target.value)}
                                                            className="px-2 py-1 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-emerald-500 w-full max-w-[140px]"
                                                        >
                                                            <option value="">—</option>
                                                            {CATEGORY_GROUPS.map((g) => (
                                                                <optgroup key={g.id} label={g.label}>
                                                                    {g.categories.map((c) => (
                                                                        <option key={c.id} value={c.id}>{c.label}</option>
                                                                    ))}
                                                                </optgroup>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={p.tier || "standard"}
                                                            onChange={(e) => handleProductChange(p.id, "tier", e.target.value)}
                                                            className={`px-2 py-1 border rounded text-xs font-semibold w-full min-w-[130px] ${
                                                                (p.tier || "standard") === "economy"
                                                                    ? "bg-purple-50 border-purple-300 text-purple-700"
                                                                    : "bg-white border-slate-200 text-slate-600"
                                                            }`}
                                                        >
                                                            <option value="standard">Regular</option>
                                                            <option value="economy">Restaurant/Hotel</option>
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
                                                        <select
                                                            value={p.unit}
                                                            onChange={(e) => handleProductChange(p.id, 'unit', e.target.value)}
                                                            className="text-slate-400 ml-1 text-sm bg-transparent border-none cursor-pointer focus:ring-1 focus:ring-emerald-500 rounded"
                                                        >
                                                            {allUnits.map((u) => (
                                                                <option key={u} value={u}>/{u}</option>
                                                            ))}
                                                        </select>
                                                        {p.priceTiers && p.priceTiers.length > 0 && (() => {
                                                            const tiers = formatTiersForDisplay(p.priceTiers);
                                                            return (
                                                                <div className="text-[10px] text-emerald-600 mt-0.5 leading-relaxed">
                                                                    {tiers.map((t, i) => (
                                                                        <span key={i}>
                                                                            {t.range}: ₹{t.price}
                                                                            {i < tiers.length - 1 && <span className="text-slate-300"> · </span>}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
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
                                                    {/* Reorder Up/Down + editable position */}
                                                    <td className="px-2 py-3 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <button
                                                                onClick={() => handleMoveProduct(p.id, "up")}
                                                                disabled={!!searchQuery || filteredProducts[0]?.id === p.id}
                                                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                                title="Move up"
                                                            >
                                                                <ChevronUp className="w-4 h-4" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                defaultValue={filteredProducts.indexOf(p) + 1}
                                                                key={`${p.id}-${p.sortOrder ?? p.id}`}
                                                                min={1}
                                                                max={editingProducts.length}
                                                                onBlur={(e) => {
                                                                    const val = parseInt(e.target.value, 10);
                                                                    if (!isNaN(val) && val > 0) handleJumpToPosition(p.id, val);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        (e.target as HTMLInputElement).blur();
                                                                    }
                                                                }}
                                                                className="w-10 text-center text-[11px] font-mono text-slate-500 border border-slate-200 rounded py-0.5 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white hover:border-slate-400 transition-colors"
                                                                title="Type a position number to jump (e.g. 1 = first)"
                                                            />
                                                            <button
                                                                onClick={() => handleMoveProduct(p.id, "down")}
                                                                disabled={!!searchQuery || filteredProducts[filteredProducts.length - 1]?.id === p.id}
                                                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                                title="Move down"
                                                            >
                                                                <ChevronDown className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => { setDeleteTarget(p); setDeleteConfirmText(""); }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            title={`Delete ${p.name}`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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

                    {activeTab === "horeca" && <HorecaRequestsTab />}

                    {activeTab === "messages" && <MessagesTab />}

                    {activeTab === "stock" && <BuyingStockTab />}

                    {activeTab === "accounts" && <AccountsTab />}

                    {activeTab === "inventory" && <InventoryTab />}

                    {activeTab === "storehub" && <StoreHub onNavigateToOrder={navigateToOrder} />}

                    {activeTab === "settings" && <SettingsTab />}

                    {/* Add Product Modal */}
                    <AddProductModal
                        open={addProductOpen}
                        onClose={() => setAddProductOpen(false)}
                        existingIds={editingProducts.map(p => p.id)}
                        onProductAdded={(p) => setEditingProducts(prev => [...prev, p])}
                        defaultTier={priceTierFilter}
                    />

                    {/* Manage Units Modal */}
                    {manageUnitsOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setManageUnitsOpen(false)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Ruler className="w-5 h-5 text-slate-500" /> Manage Units
                                    </h3>
                                    <button onClick={() => setManageUnitsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-5 space-y-4">
                                    {/* Add new unit */}
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (newUnitInput.trim()) {
                                                await addUnit(newUnitInput);
                                                setNewUnitInput("");
                                                toast.success(`Unit "${newUnitInput.trim()}" added`);
                                            }
                                        }}
                                        className="flex gap-2"
                                    >
                                        <input
                                            type="text"
                                            value={newUnitInput}
                                            onChange={(e) => setNewUnitInput(e.target.value)}
                                            placeholder="e.g. Crate, Box, Tray..."
                                            className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newUnitInput.trim()}
                                            className="h-10 px-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" /> Add
                                        </button>
                                    </form>

                                    {/* Existing units list */}
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Default Units</p>
                                        <div className="flex flex-wrap gap-2">
                                            {UNIT_OPTIONS.map((u) => (
                                                <span key={u} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">
                                                    {u}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {customUnits.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom Units</p>
                                            <div className="flex flex-wrap gap-2">
                                                {customUnits.map((u) => (
                                                    <span key={u} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium">
                                                        {u}
                                                        <button
                                                            onClick={async () => { await removeUnit(u); toast.success(`Unit "${u}" removed`); }}
                                                            className="ml-0.5 text-amber-400 hover:text-red-500 transition-colors"
                                                            title="Remove unit"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

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
        </PresenceProvider>
    );
}
