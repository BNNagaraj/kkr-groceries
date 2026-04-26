"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingCart, User, LogOut, Settings, TrendingUp } from "lucide-react";
import { markOffline } from "@/hooks/usePresence";

import { EnquiryModal } from "./EnquiryModal";
import { NotificationBell } from "./NotificationBell";
import { OtpPopup } from "./OtpPopup";
import { OtpConfigWarning } from "./admin/OtpConfigWarning";
import { AuthModal } from "./AuthModal";

export function Header({ onOpenCart }: { onOpenCart: () => void }) {
    const { cart } = useAppStore();
    const { currentUser, isAdmin } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [enquiryOpen, setEnquiryOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Cart count only available after hydration (cart comes from localStorage)
    const cartItemCount = mounted ? Object.keys(cart).length : 0;

    return (
        <>
            <header role="banner" className="fixed top-0 left-0 right-0 h-[70px] bg-gradient-to-br from-[#064e3b] to-[#065f46] text-white z-50 shadow-md">
                <div className="max-w-[1400px] mx-auto h-full px-4 flex justify-between items-center">
                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="text-3xl">🥬</div>
                        <div className="flex flex-col">
                            <span className="font-bold text-xl leading-none tracking-tight">KKR Groceries</span>
                            <span className="text-[10px] text-emerald-200 uppercase tracking-widest font-semibold mt-0.5">B2B Wholesale</span>
                        </div>
                    </Link>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {isAdmin && (
                            <Link
                                href="/market-rates"
                                className="hidden sm:flex text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full items-center gap-1.5"
                            >
                                <TrendingUp className="w-4 h-4" /> Market Rates
                            </Link>
                        )}
                        <button
                            onClick={() => setEnquiryOpen(true)}
                            className="hidden sm:flex text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full items-center"
                        >
                            Partner with Us
                        </button>
                        {isAdmin && (
                            <Link
                                href="/dashboard/admin"
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <Settings className="w-5 h-5" />
                            </Link>
                        )}

                        {currentUser && <NotificationBell />}

                        <div className="relative">
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                aria-label="User menu"
                                aria-expanded={menuOpen}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors overflow-hidden"
                            >
                                {currentUser?.photoURL ? (
                                    <img
                                        src={currentUser.photoURL}
                                        alt=""
                                        className="w-full h-full object-cover rounded-full"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <User className="w-5 h-5" />
                                )}
                            </button>

                            {menuOpen && (
                                <div className="absolute top-[120%] right-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 text-slate-800 animate-in fade-in slide-in-from-top-2">
                                    {currentUser ? (
                                        <>
                                            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 overflow-hidden">
                                                    {currentUser.photoURL ? (
                                                        <img
                                                            src={currentUser.photoURL}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        currentUser.displayName ? currentUser.displayName[0].toUpperCase() : "U"
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold truncate">{currentUser.displayName || "User"}</div>
                                                    <div className="text-xs text-slate-500 truncate">{currentUser.email || currentUser.phoneNumber}</div>
                                                </div>
                                            </div>
                                            <Link href="/dashboard/buyer?tab=orders" className="block px-4 py-2 text-sm hover:bg-slate-50 transition-colors">
                                                My Orders
                                            </Link>
                                            <button
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                                onClick={async () => {
                                                    if (currentUser) await markOffline(currentUser.uid);
                                                    const { auth } = await import("@/lib/firebase");
                                                    await auth.signOut();
                                                    setMenuOpen(false);
                                                }}
                                            >
                                                <LogOut className="w-4 h-4" /> Sign Out
                                            </button>
                                        </>
                                    ) : (
                                        <div className="px-4 py-3">
                                            <p className="text-xs text-slate-500 mb-2">Sign in to save addresses and view past orders.</p>
                                            <button
                                                onClick={() => {
                                                    setMenuOpen(false);
                                                    setAuthOpen(true);
                                                }}
                                                className="w-full bg-[#064e3b] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#065f46]"
                                            >
                                                Login / Sign Up
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onOpenCart}
                            aria-label={`Shopping cart${cartItemCount > 0 ? `, ${cartItemCount} items` : ""}`}
                            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center relative transition-colors shadow-sm"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            {cartItemCount > 0 && (
                                <span aria-hidden="true" className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-[#064e3b]">
                                    {cartItemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>
            <EnquiryModal isOpen={enquiryOpen} onClose={() => setEnquiryOpen(false)} />
            <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
            {currentUser && <OtpPopup />}
            <OtpConfigWarning />
        </>
    );
}
