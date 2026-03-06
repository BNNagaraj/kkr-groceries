"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useAppStore } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Truck, ChevronRight, User, Trash2, BookMarked, Check, ShoppingCart, ClipboardList, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { functions, db } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { MapPicker, LocationDetails } from "./MapPicker";
import { validateName, validatePhone, validateAddress, sanitizeInput } from "@/lib/validation";
import { resolveSlabPrice, getAppliedTierLabel } from "@/lib/pricing";
import { useMode } from "@/contexts/ModeContext";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 3-step checkout progress indicator
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
    const steps = [
        { num: 1, label: "Cart", icon: ShoppingCart },
        { num: 2, label: "Details", icon: User },
        { num: 3, label: "Confirm", icon: ClipboardList },
    ] as const;

    return (
        <div className="flex items-center justify-center gap-0 px-4 py-3 bg-slate-50 border-b border-slate-100">
            {steps.map((step, i) => {
                const Icon = step.icon;
                const isActive = current === step.num;
                const isCompleted = current > step.num;
                return (
                    <React.Fragment key={step.num}>
                        {i > 0 && (
                            <div className={`w-8 h-0.5 ${isCompleted ? "bg-emerald-500" : "bg-slate-200"} transition-colors`} />
                        )}
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    isActive
                                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                                        : isCompleted
                                            ? "bg-emerald-500 text-white"
                                            : "bg-slate-200 text-slate-400"
                                }`}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                            </div>
                            <span className={`text-[10px] font-semibold ${isActive ? "text-emerald-700" : isCompleted ? "text-emerald-500" : "text-slate-400"}`}>
                                {step.label}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// Editable quantity display for cart items
function EditableQty({
    qty,
    onUpdate,
    minQty = 1,
}: {
    qty: number;
    onUpdate: (newQty: number) => void;
    minQty?: number;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(qty));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            setValue(String(qty));
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [editing, qty]);

    const handleConfirm = () => {
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0 && num !== qty) {
            // Enforce MOQ — snap to minimum if below
            const finalQty = num < minQty ? minQty : num;
            onUpdate(finalQty);
        }
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                    if (e.key === "Escape") setEditing(false);
                }}
                onBlur={handleConfirm}
                className="w-10 h-full flex items-center justify-center font-bold text-sm bg-white border-x border-emerald-300 text-emerald-700 text-center outline-none"
            />
        );
    }

    return (
        <div
            className="w-10 h-full flex items-center justify-center font-bold text-sm bg-white border-x border-slate-200 cursor-pointer hover:bg-emerald-50 transition-colors"
            onClick={() => setEditing(true)}
            title="Click to edit"
        >
            {qty}
        </div>
    );
}

interface SubmitOrderResponse {
    success: boolean;
    orderId: string;
    message: string;
}

interface SavedAddress {
    id: string;
    name: string;
    phone: string;
    loc: string;
    pin: string;
    /** Derived from recent order (not from addresses subcollection) */
    fromOrder?: boolean;
    shopName?: string;
}

export function CartDrawer({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const { cart, addToCart, removeFromCart, getCartTotal, clearCart } = useAppStore();
    const { currentUser } = useAuth();
    const { col } = useMode();
    const cartItems = Object.values(cart);
    const total = getCartTotal();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);

    // Ref-based guard: stays true for a brief window AFTER mapOpen becomes false
    // so that delayed mobile touch/focus events don't leak through to the Sheet.
    const mapOpenRef = useRef(false);
    useEffect(() => {
        if (mapOpen) {
            mapOpenRef.current = true;
        } else {
            // Keep ref true for 500 ms after close to absorb ghost events
            const t = setTimeout(() => { mapOpenRef.current = false; }, 500);
            return () => clearTimeout(t);
        }
    }, [mapOpen]);

    // Form State
    const [customerName, setCustomerName] = useState("");
    const [shopName, setShopName] = useState("");
    const [phone, setPhone] = useState(() => {
        const raw = currentUser?.phoneNumber || "";
        // Strip +91 country code from Firebase auth phone numbers to get 10-digit form
        return raw.replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);
    });
    const [address, setAddress] = useState("");
    const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // GSTIN (optional, verify-only)
    const [gstin, setGstin] = useState("");
    const [gstinStatus, setGstinStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
    const [gstinMessage, setGstinMessage] = useState("");
    const [gstinLegalName, setGstinLegalName] = useState("");
    const [gstinEntityType, setGstinEntityType] = useState("");
    const gstinLoadedRef = useRef(false);

    // Saved Addresses State
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [addressesLoaded, setAddressesLoaded] = useState(false);

    // Fetch saved addresses + recent order address when checkout opens
    const loadSavedAddresses = useCallback(async () => {
        if (!currentUser || addressesLoaded) return;
        setAddressesLoaded(true);

        const allAddresses: SavedAddress[] = [];

        try {
            // 1. Fetch from users/{uid}/addresses subcollection
            const addrSnap = await getDocs(collection(db, "users", currentUser.uid, "addresses"));
            addrSnap.docs.forEach((d) => {
                const data = d.data();
                allAddresses.push({
                    id: d.id,
                    name: data.name || "",
                    phone: data.phone || "",
                    loc: data.loc || "",
                    pin: data.pin || "",
                    shopName: data.shopName || "",
                });
            });

            // 2. Fetch most recent order's address as "last used"
            try {
                const orderQ = query(
                    collection(db, col("orders")),
                    where("userId", "==", currentUser.uid),
                    orderBy("createdAt", "desc"),
                    limit(1)
                );
                const orderSnap = await getDocs(orderQ);
                if (!orderSnap.empty) {
                    const recentOrder = orderSnap.docs[0].data();
                    const recentLoc = recentOrder.location || recentOrder.deliveryAddress || "";
                    // Only add if not already in saved addresses
                    const alreadySaved = allAddresses.some(
                        (a) => a.loc.trim().toLowerCase() === recentLoc.trim().toLowerCase()
                    );
                    if (recentLoc && !alreadySaved) {
                        allAddresses.unshift({
                            id: "__recent_order__",
                            name: recentOrder.customerName || "",
                            phone: recentOrder.phone || recentOrder.customerPhone || "",
                            loc: recentLoc,
                            pin: recentOrder.pincode || "",
                            shopName: recentOrder.shopName || "",
                            fromOrder: true,
                        });
                    }
                }
            } catch {
                // Index might not exist; skip silently
            }

            setSavedAddresses(allAddresses);

            // Auto-select the most recent order address or first saved address
            if (allAddresses.length > 0 && !address) {
                // Prefer the recent order address, otherwise first saved
                const recentAddr = allAddresses.find((a) => a.fromOrder) || allAddresses[0];
                applyAddress(recentAddr);
                setSelectedAddressId(recentAddr.id);
            }
        } catch (e) {
            console.warn("[CartDrawer] Failed to load saved addresses:", e);
        }
    }, [currentUser, addressesLoaded, col]); // eslint-disable-line react-hooks/exhaustive-deps

    // Apply a saved address to the form fields
    const applyAddress = (addr: SavedAddress) => {
        if (addr.name) setCustomerName(addr.name);
        if (addr.phone) setPhone(addr.phone);
        if (addr.loc) setAddress(addr.loc);
        if (addr.shopName) setShopName(addr.shopName);
        setFormErrors({});
    };

    // Load addresses when entering checkout (step 2)
    useEffect(() => {
        if (step >= 2 && currentUser) {
            loadSavedAddresses();
        }
    }, [step, currentUser, loadSavedAddresses]);

    // Pre-fill GSTIN from user profile (once per cart open)
    useEffect(() => {
        if (step >= 2 && currentUser && !gstinLoadedRef.current) {
            gstinLoadedRef.current = true;
            (async () => {
                try {
                    const snap = await getDoc(doc(db, "users", currentUser.uid));
                    if (snap.exists()) {
                        const p = snap.data();
                        if (p.gstin && p.gstinVerified) {
                            setGstin(p.gstin);
                            setGstinStatus("verified");
                            setGstinLegalName(p.legalName || "");
                            setGstinEntityType(p.entityType || "");
                            setGstinMessage("Verified");
                        } else if (p.gstin) {
                            setGstin(p.gstin);
                        }
                    }
                } catch (e) {
                    console.warn("[CartDrawer] Failed to load GSTIN from profile:", e);
                }
            })();
        }
    }, [step, currentUser]);

    // Reset addressesLoaded when cart drawer closes so fresh fetch next time
    useEffect(() => {
        if (!isOpen) {
            setAddressesLoaded(false);
            gstinLoadedRef.current = false;
        }
    }, [isOpen]);

    // Verify GSTIN via cloud function
    const handleVerifyGSTIN = async () => {
        const value = gstin.trim().toUpperCase();
        if (!value || value.length !== 15) {
            setGstinStatus("error");
            setGstinMessage("GSTIN must be exactly 15 characters");
            return;
        }
        setGstinStatus("verifying");
        setGstinMessage("");
        try {
            const verifyFn = httpsCallable(functions, "verifyGSTIN");
            const result = await verifyFn({ gstin: value });
            const data = result.data as {
                valid: boolean; verified: boolean;
                legalName?: string; tradeName?: string;
                entityType?: string; message: string;
            };
            if (data.verified && data.valid) {
                setGstin(value);
                setGstinStatus("verified");
                setGstinMessage(data.message);
                setGstinLegalName(data.legalName || "");
                setGstinEntityType(data.entityType || "");
                // Auto-fill shop name from trade name if empty
                if (data.tradeName && !shopName.trim()) {
                    setShopName(data.tradeName);
                }
            } else {
                setGstinStatus("error");
                setGstinMessage(data.message || "Verification failed");
            }
        } catch (e) {
            console.error("[CartDrawer] GSTIN verify error:", e);
            setGstinStatus("error");
            setGstinMessage("Verification failed. Please try again.");
        }
    };

    // Validate form and advance to step 3
    const handleProceedToConfirm = () => {
        const errors: Record<string, string> = {};
        const nameResult = validateName(customerName);
        if (!nameResult.valid) errors.customerName = nameResult.error!;
        const phoneResult = validatePhone(phone);
        if (!phoneResult.valid) errors.phone = phoneResult.error!;
        const addressResult = validateAddress(address);
        if (!addressResult.valid) errors.address = addressResult.error!;

        // GSTIN is optional, but if entered it must be verified
        if (gstin.trim() && gstinStatus !== "verified") {
            errors.gstin = "Please verify your GSTIN before proceeding, or clear the field to skip.";
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setStep(3);
    };

    const handlePlaceOrder = async () => {
        if (!currentUser) {
            toast.error("Please sign in to place an order.");
            return;
        }
        if (cartItems.length === 0) {
            toast.error("Cart is empty.");
            return;
        }

        setLoading(true);
        try {
            const submitOrderApi = httpsCallable<unknown, SubmitOrderResponse>(functions, "submitOrder");

            const orderSummary = cartItems
                .map((i) => `${i.name} (${i.qty} ${i.unit})`)
                .join(", ");

            // Resolve slab pricing for each cart item
            const resolvedCart = cartItems.map((item) => {
                const effectivePrice = resolveSlabPrice(item.qty, item.price, item.priceTiers);
                return {
                    name: item.name,
                    qty: item.qty,
                    price: effectivePrice,
                    unit: item.unit,
                    image: item.image || "",
                    telugu: item.telugu || "",
                    hindi: item.hindi || "",
                    basePrice: item.price,
                    appliedTier: getAppliedTierLabel(item.qty, item.price, item.priceTiers, item.unit) || "",
                };
            });

            const payload: Record<string, unknown> = {
                cart: resolvedCart,
                customerName: sanitizeInput(customerName),
                customerPhone: sanitizeInput(phone),
                shopName: sanitizeInput(shopName),
                deliveryAddress: sanitizeInput(address),
                locationDetails,
                orderSummary,
                productCount: cartItems.length,
                totalValue: `₹${total.toLocaleString("en-IN")}`,
            };

            // Include verified GSTIN if present
            if (gstin && gstinStatus === "verified") {
                payload.gstin = gstin;
                if (gstinLegalName) payload.gstinLegalName = gstinLegalName;
                if (gstinEntityType) payload.gstinEntityType = gstinEntityType;
            }

            const result = await submitOrderApi(payload);

            if (result.data.success) {
                toast.success("Order placed successfully!", {
                    description: `Order ID: ${result.data.orderId}`,
                });
                clearCart();
                setStep(1);
                onClose();
            }
        } catch (err: unknown) {
            console.error("[Cart] Failed to submit order:", err);
            const message = err instanceof Error ? err.message : "Unknown error occurred";
            toast.error("Failed to submit order", { description: message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={(open) => { if (!open) { if (mapOpenRef.current) return; setStep(1); onClose(); } }}>
                <SheetContent
                    side="right"
                    showCloseButton={step === 1}
                    className="flex flex-col p-0 w-full sm:max-w-md"
                    onInteractOutside={(e) => { if (mapOpenRef.current) e.preventDefault(); }}
                    onPointerDownOutside={(e) => { if (mapOpenRef.current) e.preventDefault(); }}
                    onFocusOutside={(e) => { if (mapOpenRef.current) e.preventDefault(); }}
                    onEscapeKeyDown={(e) => { if (mapOpenRef.current) e.preventDefault(); }}
                >
                    <SheetHeader className="p-4 border-b border-slate-100 shrink-0">
                        <SheetTitle className="flex items-center gap-2">
                            {step > 1 ? (
                                <>
                                    <button
                                        onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
                                        className="p-1 hover:bg-slate-100 rounded-lg -ml-1 text-slate-500"
                                    >
                                        <ChevronRight className="w-5 h-5 rotate-180" />
                                    </button>
                                    {step === 2 ? "Delivery Details" : "Review Order"}
                                </>
                            ) : (
                                "Your Cart"
                            )}
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            {step === 1 ? "Review items in your cart" : step === 2 ? "Enter your delivery details" : "Confirm and place your order"}
                        </SheetDescription>
                    </SheetHeader>

                    {step > 1 && <StepIndicator current={step} />}

                    {/* ───── STEP 1: Cart Review ───── */}
                    {step === 1 && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {cartItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                            <span className="text-4xl text-slate-200">🛒</span>
                                        </div>
                                        <p>Your cart is empty</p>
                                        <Button variant="ghost" onClick={onClose} className="text-primary font-semibold">
                                            Start Shopping
                                        </Button>
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {cartItems.map((item) => (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, x: 40 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }}
                                                transition={{ duration: 0.25, ease: "easeOut" }}
                                                className="flex gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm"
                                            >
                                                <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden relative border border-slate-100 shrink-0">
                                                    {item.image ? (
                                                        <Image
                                                            src={item.image}
                                                            alt={item.name}
                                                            fill
                                                            sizes="64px"
                                                            className="object-cover"
                                                            unoptimized={!item.image.includes("googleapis.com")}
                                                        />
                                                    ) : (
                                                        <span className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-xl">
                                                            {item.name[0]}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex-1 flex flex-col justify-between">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <span className="font-bold text-slate-800 leading-tight">
                                                            {item.name}
                                                        </span>
                                                        <span className="font-bold text-emerald-700 whitespace-nowrap">
                                                            ₹{(resolveSlabPrice(item.qty, item.price, item.priceTiers) * item.qty).toLocaleString("en-IN")}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="text-xs text-slate-500">
                                                            ₹{resolveSlabPrice(item.qty, item.price, item.priceTiers)}/{item.unit}
                                                            {item.priceTiers?.length ? (
                                                                <span className="text-emerald-600 ml-1 font-medium">
                                                                    ({getAppliedTierLabel(item.qty, item.price, item.priceTiers, item.unit)})
                                                                </span>
                                                            ) : null}
                                                            {item.moqRequired !== false && item.moq > 1 && (
                                                                <span className="text-slate-400 ml-1">(Min: {item.moq})</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => removeFromCart(item.id)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                                aria-label={`Remove ${item.name} from cart`}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg h-8 overflow-hidden">
                                                                <button
                                                                    onClick={() => addToCart(item, -1)}
                                                                    className="w-8 h-full flex items-center justify-center hover:bg-slate-100 text-slate-600 font-medium transition-colors"
                                                                >
                                                                    −
                                                                </button>
                                                                <EditableQty
                                                                    qty={item.qty}
                                                                    onUpdate={(newQty) => {
                                                                        const delta = newQty - item.qty;
                                                                        if (delta !== 0) addToCart(item, delta);
                                                                    }}
                                                                    minQty={(item.moqRequired !== false && item.moq > 0) ? item.moq : 1}
                                                                />
                                                                <button
                                                                    onClick={() => addToCart(item, 1)}
                                                                    className="w-8 h-full flex items-center justify-center hover:bg-slate-100 text-slate-600 font-medium transition-colors"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>

                            {cartItems.length > 0 && (
                                <div className="border-t border-slate-100 p-4 bg-slate-50 shrink-0">
                                    <div className="flex justify-between mb-4">
                                        <span className="text-slate-500 font-medium">Subtotal</span>
                                        <span className="text-xl font-bold text-slate-800">
                                            ₹{total.toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                    {!currentUser ? (
                                        <Button
                                            onClick={() => toast.info("Please sign in first")}
                                            className="w-full h-12 bg-primary-dark hover:bg-primary-dark/90"
                                        >
                                            <User className="w-5 h-5" /> Sign in to Checkout
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setStep(2)}
                                            className="w-full h-12 bg-primary-dark hover:bg-primary-dark/90"
                                        >
                                            Proceed to Delivery <ChevronRight className="w-5 h-5" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ───── STEP 2: Delivery Details ───── */}
                    {step === 2 && (
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                                        <User className="w-5 h-5 text-primary" /> Contact Details
                                    </h3>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                                            Your Name
                                        </label>
                                        <Input
                                            required
                                            value={customerName}
                                            onChange={(e) => {
                                                setCustomerName(e.target.value);
                                                setFormErrors((prev) => { const n = { ...prev }; delete n.customerName; return n; });
                                            }}
                                            className={formErrors.customerName ? "border-destructive" : ""}
                                            placeholder="John Doe"
                                        />
                                        {formErrors.customerName && <p className="text-destructive text-xs mt-1">{formErrors.customerName}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                                            Phone Number
                                        </label>
                                        <Input
                                            required
                                            type="tel"
                                            inputMode="numeric"
                                            value={phone}
                                            onChange={(e) => {
                                                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                                                setFormErrors((prev) => { const n = { ...prev }; delete n.phone; return n; });
                                            }}
                                            className={formErrors.phone ? "border-destructive" : ""}
                                            placeholder="10-digit phone"
                                        />
                                        {formErrors.phone && <p className="text-destructive text-xs mt-1">{formErrors.phone}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                                            Business / Restaurant Name
                                        </label>
                                        <Input
                                            required
                                            value={shopName}
                                            onChange={(e) => setShopName(e.target.value)}
                                            placeholder="KKR Hotel"
                                        />
                                    </div>
                                </div>

                                {/* Saved Addresses */}
                                {savedAddresses.length > 0 && (
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                            <BookMarked className="w-5 h-5 text-primary" /> Saved Addresses
                                        </h3>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                            {savedAddresses.map((addr) => (
                                                <button
                                                    key={addr.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedAddressId(addr.id);
                                                        applyAddress(addr);
                                                    }}
                                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                                        selectedAddressId === addr.id
                                                            ? "border-primary bg-primary/5"
                                                            : "border-slate-100 hover:border-slate-200 bg-slate-50"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-semibold text-sm text-slate-800">
                                                                    {addr.name || "Saved Address"}
                                                                </span>
                                                                {addr.fromOrder && (
                                                                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">
                                                                        Last Used
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                                {addr.loc}
                                                            </p>
                                                            {addr.pin && (
                                                                <span className="text-[10px] text-slate-400 font-semibold">
                                                                    PIN: {addr.pin}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {selectedAddressId === addr.id && (
                                                            <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0 mt-0.5">
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedAddressId(null);
                                                setAddress("");
                                                setCustomerName("");
                                                setShopName("");
                                                setPhone((currentUser?.phoneNumber || "").replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10));
                                            }}
                                            className="w-full mt-2 text-xs text-primary font-semibold py-1.5 hover:bg-primary/5 rounded-lg transition-colors"
                                        >
                                            + Use a new address
                                        </button>
                                    </div>
                                )}

                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                        <MapPin className="w-5 h-5 text-primary" /> Delivery
                                    </h3>
                                    <textarea
                                        required
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value);
                                            setSelectedAddressId(null);
                                            setFormErrors((prev) => { const n = { ...prev }; delete n.address; return n; });
                                        }}
                                        className={`w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all min-h-[100px] resize-none ${formErrors.address ? "border-destructive" : "border-input"}`}
                                        placeholder="Enter full delivery address..."
                                    />
                                    {formErrors.address && <p className="text-destructive text-xs mt-1">{formErrors.address}</p>}
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setMapOpen(true)}
                                        className="w-full mt-2"
                                    >
                                        <MapPin className="w-4 h-4" /> Pick on Map
                                    </Button>
                                </div>

                                {/* ── GSTIN (Optional) ─────────────────────── */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                                        <FileText className="w-5 h-5 text-primary" /> GSTIN
                                        <span className="text-xs font-normal text-slate-400">(Optional)</span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mb-3">For GST invoice. Must be verified to apply.</p>

                                    <div className="flex gap-2">
                                        <Input
                                            value={gstin}
                                            onChange={(e) => {
                                                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                                                setGstin(v);
                                                if (gstinStatus !== "idle") {
                                                    setGstinStatus("idle");
                                                    setGstinMessage("");
                                                    setGstinLegalName("");
                                                    setGstinEntityType("");
                                                }
                                                setFormErrors((prev) => { const n = { ...prev }; delete n.gstin; return n; });
                                            }}
                                            className={`flex-1 font-mono text-sm tracking-wider ${
                                                gstinStatus === "verified" ? "border-emerald-400 bg-emerald-50/50" :
                                                gstinStatus === "error" ? "border-destructive" : ""
                                            }`}
                                            placeholder="e.g. 29AANCS5446E1ZZ"
                                            disabled={gstinStatus === "verifying"}
                                        />
                                        {gstinStatus === "verified" ? (
                                            <div className="flex items-center gap-1 text-emerald-600 px-3 shrink-0">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleVerifyGSTIN}
                                                disabled={gstinStatus === "verifying" || gstin.trim().length !== 15}
                                                className="shrink-0 h-10"
                                            >
                                                {gstinStatus === "verifying" ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : "Verify"}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Status messages */}
                                    {gstinStatus === "verified" && gstinLegalName && (
                                        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800 space-y-1">
                                            <div className="flex gap-2">
                                                <span className="font-semibold text-emerald-600 w-20 shrink-0">
                                                    {gstinEntityType === "Proprietorship" ? "Proprietor:" : "Legal Name:"}
                                                </span>
                                                <span className="font-medium">{gstinLegalName}</span>
                                            </div>
                                            {gstinEntityType && (
                                                <div className="flex gap-2">
                                                    <span className="font-semibold text-emerald-600 w-20 shrink-0">Entity:</span>
                                                    <span>{gstinEntityType}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {gstinStatus === "error" && gstinMessage && (
                                        <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {gstinMessage}
                                        </p>
                                    )}
                                    {formErrors.gstin && (
                                        <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {formErrors.gstin}
                                        </p>
                                    )}

                                    {/* Quick clear if verified */}
                                    {gstinStatus === "verified" && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setGstin("");
                                                setGstinStatus("idle");
                                                setGstinMessage("");
                                                setGstinLegalName("");
                                                setGstinEntityType("");
                                            }}
                                            className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            Remove GSTIN from this order
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 p-4 bg-white shrink-0">
                                <Button
                                    onClick={handleProceedToConfirm}
                                    className="w-full h-12 bg-primary-dark hover:bg-primary-dark/90"
                                >
                                    Review Order <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ───── STEP 3: Order Confirmation ───── */}
                    {step === 3 && (
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Delivery Summary */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                        <Truck className="w-5 h-5 text-primary" /> Delivery Details
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex gap-3">
                                            <span className="text-slate-400 w-16 shrink-0">Name</span>
                                            <span className="font-medium text-slate-800">{customerName}</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <span className="text-slate-400 w-16 shrink-0">Phone</span>
                                            <span className="font-medium text-slate-800">{phone}</span>
                                        </div>
                                        {shopName && (
                                            <div className="flex gap-3">
                                                <span className="text-slate-400 w-16 shrink-0">Business</span>
                                                <span className="font-medium text-slate-800">{shopName}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-3">
                                            <span className="text-slate-400 w-16 shrink-0">Address</span>
                                            <span className="font-medium text-slate-800 leading-relaxed">{address}</span>
                                        </div>
                                        {gstin && gstinStatus === "verified" && (
                                            <div className="flex gap-3 pt-1 border-t border-slate-100 mt-1">
                                                <span className="text-slate-400 w-16 shrink-0">GSTIN</span>
                                                <span className="font-medium text-slate-800 font-mono text-xs tracking-wider flex items-center gap-1.5">
                                                    {gstin}
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setStep(2)}
                                        className="mt-3 text-xs text-primary font-semibold hover:underline"
                                    >
                                        Edit Details
                                    </button>
                                </div>

                                {/* Items Summary */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                        <ShoppingCart className="w-5 h-5 text-primary" /> Order Items ({cartItems.length})
                                    </h3>
                                    <div className="divide-y divide-slate-100">
                                        {cartItems.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-lg overflow-hidden relative border border-slate-100 shrink-0">
                                                        {item.image ? (
                                                            <Image
                                                                src={item.image}
                                                                alt={item.name}
                                                                fill
                                                                sizes="40px"
                                                                className="object-cover"
                                                                unoptimized={!item.image.includes("googleapis.com")}
                                                            />
                                                        ) : (
                                                            <span className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-sm">
                                                                {item.name[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-sm text-slate-800 truncate">{item.name}</div>
                                                        <div className="text-xs text-slate-400">{item.qty} {item.unit} × ₹{resolveSlabPrice(item.qty, item.price, item.priceTiers)}</div>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-sm text-emerald-700 shrink-0 ml-2">
                                                    ₹{(resolveSlabPrice(item.qty, item.price, item.priceTiers) * item.qty).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setStep(1)}
                                        className="mt-3 text-xs text-primary font-semibold hover:underline"
                                    >
                                        Edit Cart
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 p-4 bg-white shrink-0">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <div className="text-slate-500 font-medium text-sm">
                                            {cartItems.length} items
                                        </div>
                                        <div className="text-xl font-bold text-slate-800 leading-none">
                                            ₹{total.toLocaleString("en-IN")}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1 justify-end">
                                            <Truck className="w-3 h-3" /> Free Delivery
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={handlePlaceOrder}
                                    disabled={loading}
                                    className="w-full h-12 bg-primary-dark hover:bg-primary-dark/90"
                                >
                                    {loading ? "Processing..." : "Place Order"}
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
            {mapOpen && (
                <MapPicker
                    isOpen={mapOpen}
                    onClose={() => setMapOpen(false)}
                    onLocationSelect={(addr, details) => {
                        setAddress(addr);
                        setLocationDetails(details);
                    }}
                />
            )}
        </>
    );
}
