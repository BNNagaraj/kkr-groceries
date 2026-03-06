"use client";

import React, { useState } from "react";
import { Send, Store } from "lucide-react";
import { validateName, validatePhone, validatePincode } from "@/lib/validation";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EnquiryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [formData, setFormData] = useState({
        customerName: "",
        phone: "",
        location: "",
        pincode: "",
        businessType: "Restaurant",
        dailyVolume: "Under 50kg"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        const errors: Record<string, string> = {};
        const nameResult = validateName(formData.customerName);
        if (!nameResult.valid) errors.customerName = nameResult.error!;
        const phoneResult = validatePhone(formData.phone);
        if (!phoneResult.valid) errors.phone = phoneResult.error!;
        const pincodeResult = validatePincode(formData.pincode);
        if (!pincodeResult.valid) errors.pincode = pincodeResult.error!;

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        setLoading(true);
        setSuccess(false);

        try {
            await fetch(process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL as string, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            setSuccess(true);
            toast.success("Request received!", {
                description: "Our sales team will contact you within 24 hours.",
            });
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 3000);
        } catch (err: unknown) {
            console.error("[Enquiry] Failed to send:", err);
            toast.error("Failed to send enquiry", {
                description: "Please try again or contact us directly.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton className="sm:max-w-lg p-0 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 p-6 text-white text-center">
                    <Store className="w-12 h-12 mx-auto mb-3 opacity-90" />
                    <DialogHeader className="text-center items-center">
                        <DialogTitle className="text-2xl font-bold text-white">Partner with Us</DialogTitle>
                        <DialogDescription className="text-emerald-100">
                            Get dedicated wholesale pricing & daily delivery
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">✅</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Request Received!</h3>
                            <p className="text-muted-foreground">Our sales team will contact you within 24 hours.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Your Name *</label>
                                    <Input
                                        required
                                        value={formData.customerName}
                                        onChange={e => { setFormData({ ...formData, customerName: e.target.value }); setFormErrors(p => { const n = { ...p }; delete n.customerName; return n; }); }}
                                        className={formErrors.customerName ? "border-destructive" : ""}
                                        placeholder="John Doe"
                                    />
                                    {formErrors.customerName && <p className="text-destructive text-xs mt-1">{formErrors.customerName}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone *</label>
                                    <Input
                                        required
                                        type="tel"
                                        inputMode="numeric"
                                        value={formData.phone}
                                        onChange={e => { setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }); setFormErrors(p => { const n = { ...p }; delete n.phone; return n; }); }}
                                        className={formErrors.phone ? "border-destructive" : ""}
                                        placeholder="10-digit phone"
                                    />
                                    {formErrors.phone && <p className="text-destructive text-xs mt-1">{formErrors.phone}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Name / Location *</label>
                                <Input
                                    required
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="Hotel Name, Area"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pincode *</label>
                                    <Input
                                        required
                                        type="text"
                                        value={formData.pincode}
                                        onChange={e => { setFormData({ ...formData, pincode: e.target.value }); setFormErrors(p => { const n = { ...p }; delete n.pincode; return n; }); }}
                                        className={formErrors.pincode ? "border-destructive" : ""}
                                        placeholder="500001"
                                    />
                                    {formErrors.pincode && <p className="text-destructive text-xs mt-1">{formErrors.pincode}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Type</label>
                                    <select
                                        value={formData.businessType}
                                        onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                                    >
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
                                <select
                                    value={formData.dailyVolume}
                                    onChange={e => setFormData({ ...formData, dailyVolume: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                                >
                                    <option>Under 50kg</option>
                                    <option>50kg - 100kg</option>
                                    <option>100kg - 500kg</option>
                                    <option>500kg+</option>
                                </select>
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12"
                                >
                                    {loading ? "Sending..." : <><Send className="w-4 h-4" /> Submit Enquiry</>}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
