"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAppStore } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { X, MapPin, Truck, ChevronRight, User } from "lucide-react";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { MapPicker, LocationDetails } from "./MapPicker";
import { validateName, validatePhone, validateAddress, sanitizeInput } from "@/lib/validation";

interface SubmitOrderResponse {
    success: boolean;
    orderId: string;
    message: string;
}

export function CartDrawer({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const { cart, addToCart, getCartTotal, clearCart } = useAppStore();
    const { currentUser } = useAuth();
    const cartItems = Object.values(cart);
    const total = getCartTotal();

    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);

    // Form State
    const [customerName, setCustomerName] = useState("");
    const [shopName, setShopName] = useState("");
    const [phone, setPhone] = useState(currentUser?.phoneNumber || "");
    const [address, setAddress] = useState("");
    const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleCheckoutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return alert("Please sign in to place an order.");
        if (cartItems.length === 0) return alert("Cart is empty.");

        // Validate fields
        const errors: Record<string, string> = {};
        const nameResult = validateName(customerName);
        if (!nameResult.valid) errors.customerName = nameResult.error!;
        const phoneResult = validatePhone(phone);
        if (!phoneResult.valid) errors.phone = phoneResult.error!;
        const addressResult = validateAddress(address);
        if (!addressResult.valid) errors.address = addressResult.error!;

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        setLoading(true);
        try {
            const submitOrderApi = httpsCallable<unknown, SubmitOrderResponse>(functions, "submitOrder");

            const orderSummary = cartItems
                .map((i) => `${i.name} (${i.qty} ${i.unit})`)
                .join(", ");

            const payload = {
                cart: cartItems,
                customerName: sanitizeInput(customerName),
                customerPhone: sanitizeInput(phone),
                shopName: sanitizeInput(shopName),
                deliveryAddress: sanitizeInput(address),
                locationDetails,
                orderSummary,
                productCount: cartItems.length,
                totalValue: `₹${total.toLocaleString("en-IN")}`,
            };

            const result = await submitOrderApi(payload);

            if (result.data.success) {
                alert("Order placed successfully! Order ID: " + result.data.orderId);
                clearCart();
                setIsCheckingOut(false);
                onClose();
            }
        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : "Unknown error occurred";
            alert("Failed to submit order: " + message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity"
                onClick={onClose}
            />
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {isCheckingOut ? (
                            <>
                                <button
                                    onClick={() => setIsCheckingOut(false)}
                                    className="p-1 hover:bg-slate-100 rounded-lg -ml-1 text-slate-500"
                                >
                                    <ChevronRight className="w-5 h-5 rotate-180" />
                                </button>
                                Checkout Details
                            </>
                        ) : (
                            "Your Cart"
                        )}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!isCheckingOut ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cartItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                        <span className="text-4xl text-slate-200">🛒</span>
                                    </div>
                                    <p>Your cart is empty</p>
                                    <button
                                        onClick={onClose}
                                        className="text-emerald-600 font-semibold hover:text-emerald-700"
                                    >
                                        Start Shopping
                                    </button>
                                </div>
                            ) : (
                                cartItems.map((item) => (
                                    <div
                                        key={item.id}
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
                                                    ₹{(item.price * item.qty).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="text-xs text-slate-500">
                                                    ₹{item.price}/{item.unit}
                                                </div>
                                                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg h-8 overflow-hidden">
                                                    <button
                                                        onClick={() => addToCart(item, -1)}
                                                        className="w-8 h-full flex items-center justify-center hover:bg-slate-100 text-slate-600 font-medium transition-colors"
                                                    >
                                                        −
                                                    </button>
                                                    <div className="w-10 h-full flex items-center justify-center font-bold text-sm bg-white border-x border-slate-200">
                                                        {item.qty}
                                                    </div>
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
                                ))
                            )}
                        </div>

                        {cartItems.length > 0 && (
                            <div className="border-t border-slate-100 p-4 bg-slate-50">
                                <div className="flex justify-between mb-4">
                                    <span className="text-slate-500 font-medium">Subtotal</span>
                                    <span className="text-xl font-bold text-slate-800">
                                        ₹{total.toLocaleString("en-IN")}
                                    </span>
                                </div>
                                {!currentUser ? (
                                    <button
                                        onClick={() => alert("Redirect to login required")}
                                        className="w-full bg-[#064e3b] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#065f46] shadow-md shadow-emerald-900/20"
                                    >
                                        <User className="w-5 h-5" /> Sign in to Checkout
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsCheckingOut(true)}
                                        className="w-full bg-[#064e3b] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#065f46] shadow-md shadow-emerald-900/20"
                                    >
                                        Proceed to Delivery <ChevronRight className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <form
                        onSubmit={handleCheckoutSubmit}
                        className="flex-1 flex flex-col h-full bg-slate-50"
                    >
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                                    <User className="w-5 h-5 text-emerald-600" /> Contact Details
                                </h3>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                                        Your Name
                                    </label>
                                    <input
                                        required
                                        value={customerName}
                                        onChange={(e) => {
                                            setCustomerName(e.target.value);
                                            setFormErrors((prev) => { const n = { ...prev }; delete n.customerName; return n; });
                                        }}
                                        className={`w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${formErrors.customerName ? "border-red-400" : "border-slate-200"}`}
                                        placeholder="John Doe"
                                    />
                                    {formErrors.customerName && <p className="text-red-500 text-xs mt-1">{formErrors.customerName}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        required
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => {
                                            setPhone(e.target.value);
                                            setFormErrors((prev) => { const n = { ...prev }; delete n.phone; return n; });
                                        }}
                                        className={`w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${formErrors.phone ? "border-red-400" : "border-slate-200"}`}
                                        placeholder="+91"
                                    />
                                    {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                                        Business / Restaurant Name
                                    </label>
                                    <input
                                        required
                                        value={shopName}
                                        onChange={(e) => setShopName(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                        placeholder="KKR Hotel"
                                    />
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                    <MapPin className="w-5 h-5 text-emerald-600" /> Delivery
                                </h3>
                                <textarea
                                    required
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(e.target.value);
                                        setFormErrors((prev) => { const n = { ...prev }; delete n.address; return n; });
                                    }}
                                    className={`w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[100px] resize-none ${formErrors.address ? "border-red-400" : "border-slate-200"}`}
                                    placeholder="Enter full delivery address..."
                                />
                                {formErrors.address && <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>}
                                <button
                                    type="button"
                                    onClick={() => setMapOpen(true)}
                                    className="w-full mt-2 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <MapPin className="w-4 h-4" /> Pick on Map
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
                                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1 justify-end">
                                        <Truck className="w-3 h-3" /> Free Delivery
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#064e3b] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#065f46] disabled:opacity-50 transition-colors shadow-md shadow-emerald-900/20"
                            >
                                {loading ? "Processing..." : "Confirm & Place Order"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
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
