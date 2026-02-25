"use client";

import React, { useState } from "react";
import { X, Send, Store } from "lucide-react";

export function EnquiryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        customerName: "",
        phone: "",
        location: "",
        pincode: "",
        businessType: "Restaurant",
        dailyVolume: "Under 50kg"
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(false);
        setError("");

        try {
            const resp = await fetch(process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL as string, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            // no-cors means we can't read the response properly, but if it didn't throw it likely worked.
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 3000);
        } catch (err: any) {
            console.error(err);
            setError("Failed to send enquiry. Please try again or contact us directly.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] transition-opacity flex justify-center items-center p-4"
                onClick={onClose}
            >
                <div
                    className="bg-white max-w-lg w-full rounded-2xl shadow-xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 p-6 text-white text-center relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <Store className="w-12 h-12 mx-auto mb-3 opacity-90" />
                        <h2 className="text-2xl font-bold mb-1">Partner with Us</h2>
                        <p className="text-emerald-100 text-sm">Get dedicated wholesale pricing & daily delivery</p>
                    </div>

                    <div className="p-6">
                        {success ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">✅</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Request Received!</h3>
                                <p className="text-slate-500">Our sales team will contact you within 24 hours.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">{error}</div>}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Your Name *</label>
                                        <input required value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" placeholder="John Doe" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone *</label>
                                        <input required type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" placeholder="+91" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Name / Location *</label>
                                    <input required value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" placeholder="Hotel Name, Area" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pincode *</label>
                                        <input required type="text" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" placeholder="500001" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Type</label>
                                        <select value={formData.businessType} onChange={e => setFormData({ ...formData, businessType: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow text-slate-700">
                                            <option>Restaurant / Hotel</option>
                                            <option>Caterer</option>
                                            <option>Retail Shop</option>
                                            <option>Supermarket</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Est. Daily Volume</label>
                                    <select value={formData.dailyVolume} onChange={e => setFormData({ ...formData, dailyVolume: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow text-slate-700">
                                        <option>Under 50kg</option>
                                        <option>50kg - 100kg</option>
                                        <option>100kg - 500kg</option>
                                        <option>500kg+</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20"
                                    >
                                        {loading ? "Sending..." : <><Send className="w-4 h-4" /> Submit Enquiry</>}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
