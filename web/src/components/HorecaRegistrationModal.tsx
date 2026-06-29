"use client";

import React, { useState } from "react";
import { UtensilsCrossed, Send, Building2, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { validateName, validatePhone, validatePincode } from "@/lib/validation";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BUSINESS_TYPES = [
    "Restaurant",
    "Hotel",
    "Caterer",
    "Cloud Kitchen",
    "Canteen / Mess",
    "Other",
];

const SCHEDULE_OPTIONS = [
    "Daily",
    "Alternate Days",
    "Weekly",
    "On-demand",
];

const VOLUME_OPTIONS = [
    "Under 50 kg",
    "50 – 100 kg",
    "100 – 500 kg",
    "500 kg+",
];

export function HorecaRegistrationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { currentUser, isHoreca } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    // Existing request status for this account: blocks a second submission
    const [checking, setChecking] = useState(true);
    const [existingStatus, setExistingStatus] = useState<"pending" | "approved" | "rejected" | null>(null);

    const [formData, setFormData] = useState({
        contactName: "",
        businessName: "",
        businessType: "Restaurant",
        phone: "",
        email: "",
        location: "",
        pincode: "",
        schedule: "Daily",
        dailyVolume: "Under 50 kg",
        notes: "",
    });

    // On open: prefill from the signed-in account and check for an existing request
    React.useEffect(() => {
        if (!isOpen) return;
        if (!currentUser) { setChecking(false); return; }

        setFormData((p) => ({
            ...p,
            email: p.email || currentUser.email || "",
            phone: p.phone || (currentUser.phoneNumber || "").replace(/\D/g, "").slice(-10),
        }));

        setChecking(true);
        getDoc(doc(db, "horeca_requests", currentUser.uid))
            .then((snap) => {
                existedBeforeRef.current = snap.exists();
                if (snap.exists()) {
                    const st = snap.data().status as "pending" | "approved" | "rejected";
                    // A rejected request may be re-submitted, so treat it like "no active request"
                    setExistingStatus(st === "rejected" ? null : st);
                } else {
                    setExistingStatus(null);
                }
            })
            .catch(() => { existedBeforeRef.current = false; setExistingStatus(null); })
            .finally(() => setChecking(false));
    }, [isOpen, currentUser]);

    // Tracks whether a request document already existed when the modal opened —
    // if so, a submit is a re-application (an update) and we notify admins explicitly.
    const existedBeforeRef = React.useRef(false);

    const clearError = (field: string) => {
        setFormErrors((p) => { const n = { ...p }; delete n[field]; return n; });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentUser) {
            toast.error("Please sign in first to apply for HORECA access.");
            return;
        }
        // Block double submission
        if (existingStatus === "pending" || existingStatus === "approved" || isHoreca) {
            toast.info("You already have a HORECA application on record.");
            return;
        }

        // Validate
        const errors: Record<string, string> = {};
        const nameResult = validateName(formData.contactName);
        if (!nameResult.valid) errors.contactName = nameResult.error!;
        if (!formData.businessName.trim()) errors.businessName = "Business name is required";
        const phoneResult = validatePhone(formData.phone);
        if (!phoneResult.valid) errors.phone = phoneResult.error!;
        if (!formData.location.trim()) errors.location = "Location/area is required";
        const pincodeResult = validatePincode(formData.pincode);
        if (!pincodeResult.valid) errors.pincode = pincodeResult.error!;

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setLoading(true);

        try {
            // Doc id = uid → one request per account, always tied to the logged-in user
            await setDoc(doc(db, "horeca_requests", currentUser.uid), {
                ...formData,
                phone: formData.phone.trim(),
                email: formData.email.trim().toLowerCase(),
                // Identifiers for reliable matching when granting the claim
                requesterUid: currentUser.uid,
                requesterEmail: (currentUser.email || formData.email || "").trim().toLowerCase() || null,
                requesterPhone: (currentUser.phoneNumber || "").replace(/\D/g, "").slice(-10) || null,
                status: "pending",
                createdAt: serverTimestamp(),
            });

            // Re-application (doc already existed) → notify admins, since the
            // onDocumentCreated trigger only fires for brand-new requests.
            if (existedBeforeRef.current) {
                try {
                    const { functions } = await import("@/lib/firebase");
                    const { httpsCallable } = await import("firebase/functions");
                    await httpsCallable(functions, "notifyHorecaResubmission")({ requestId: currentUser.uid });
                } catch (notifyErr) {
                    console.warn("[HORECA] resubmission notify failed:", notifyErr);
                }
            }

            setExistingStatus("pending");
            setSuccess(true);
            toast.success("HORECA application submitted!", {
                description: "Our team will review and contact you within 24 hours.",
            });
            setTimeout(() => {
                setSuccess(false);
                setFormData({
                    contactName: "",
                    businessName: "",
                    businessType: "Restaurant",
                    phone: "",
                    email: "",
                    location: "",
                    pincode: "",
                    schedule: "Daily",
                    dailyVolume: "Under 50 kg",
                    notes: "",
                });
                onClose();
            }, 3000);
        } catch (err: unknown) {
            console.error("[HORECA] Failed to submit:", err);
            toast.error("Failed to submit application", {
                description: "Please try again or contact us directly.",
            });
        } finally {
            setLoading(false);
        }
    };

    const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton className="sm:max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-800 to-purple-600 p-6 text-white text-center">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-90" />
                    <DialogHeader className="text-center items-center">
                        <DialogTitle className="text-2xl font-bold text-white">HORECA Access</DialogTitle>
                        <DialogDescription className="text-purple-100">
                            Apply for economy bulk pricing for Restaurants, Hotels &amp; Caterers
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <UtensilsCrossed className="w-8 h-8 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Application Submitted!</h3>
                            <p className="text-muted-foreground">Our team will review your application and contact you within 24 hours.</p>
                        </div>
                    ) : !currentUser ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Building2 className="w-8 h-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Please sign in first</h3>
                            <p className="text-muted-foreground">HORECA access is linked to your account. Sign in (with the email or phone you use), then apply.</p>
                        </div>
                    ) : checking ? (
                        <div className="text-center py-12 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Checking your application status…</p>
                        </div>
                    ) : (isHoreca || existingStatus === "approved") ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">You already have HORECA access</h3>
                            <p className="text-muted-foreground">Use the <strong>Regular / Restaurant&nbsp;/&nbsp;Hotel</strong> toggle in the header to switch to restaurant pricing. If you don&apos;t see it, reload the page.</p>
                        </div>
                    ) : existingStatus === "pending" ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Application under review</h3>
                            <p className="text-muted-foreground">You&apos;ve already applied for HORECA access. Our team will review and contact you within 24 hours — no need to apply again.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Contact Name + Phone */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Name *</label>
                                    <Input
                                        required
                                        value={formData.contactName}
                                        onChange={(e) => { setFormData({ ...formData, contactName: e.target.value }); clearError("contactName"); }}
                                        className={formErrors.contactName ? "border-destructive" : ""}
                                        placeholder="Your Name"
                                    />
                                    {formErrors.contactName && <p className="text-destructive text-xs mt-1">{formErrors.contactName}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone *</label>
                                    <Input
                                        required
                                        type="tel"
                                        inputMode="numeric"
                                        value={formData.phone}
                                        onChange={(e) => { setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }); clearError("phone"); }}
                                        className={formErrors.phone ? "border-destructive" : ""}
                                        placeholder="10-digit phone"
                                    />
                                    {formErrors.phone && <p className="text-destructive text-xs mt-1">{formErrors.phone}</p>}
                                </div>
                            </div>

                            {/* Business Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Name *</label>
                                <Input
                                    required
                                    value={formData.businessName}
                                    onChange={(e) => { setFormData({ ...formData, businessName: e.target.value }); clearError("businessName"); }}
                                    className={formErrors.businessName ? "border-destructive" : ""}
                                    placeholder="Hotel / Restaurant Name"
                                />
                                {formErrors.businessName && <p className="text-destructive text-xs mt-1">{formErrors.businessName}</p>}
                            </div>

                            {/* Email — used to match your login account for access */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email {currentUser?.email ? "" : "(if you log in with email)"}</label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError("email"); }}
                                    className={formErrors.email ? "border-destructive" : ""}
                                    placeholder="you@business.com"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">Use the same email/phone you sign in with so access is granted automatically on approval.</p>
                            </div>

                            {/* Business Type + Schedule */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Type *</label>
                                    <select
                                        value={formData.businessType}
                                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                                        className={selectClass}
                                    >
                                        {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Requirement Schedule</label>
                                    <select
                                        value={formData.schedule}
                                        onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                                        className={selectClass}
                                    >
                                        {SCHEDULE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Location + Pincode */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Location / Area *</label>
                                    <Input
                                        required
                                        value={formData.location}
                                        onChange={(e) => { setFormData({ ...formData, location: e.target.value }); clearError("location"); }}
                                        className={formErrors.location ? "border-destructive" : ""}
                                        placeholder="Banjara Hills, Hyderabad"
                                    />
                                    {formErrors.location && <p className="text-destructive text-xs mt-1">{formErrors.location}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pincode *</label>
                                    <Input
                                        required
                                        type="text"
                                        value={formData.pincode}
                                        onChange={(e) => { setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }); clearError("pincode"); }}
                                        className={formErrors.pincode ? "border-destructive" : ""}
                                        placeholder="500034"
                                    />
                                    {formErrors.pincode && <p className="text-destructive text-xs mt-1">{formErrors.pincode}</p>}
                                </div>
                            </div>

                            {/* Volume */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Est. Daily Volume</label>
                                <select
                                    value={formData.dailyVolume}
                                    onChange={(e) => setFormData({ ...formData, dailyVolume: e.target.value })}
                                    className={selectClass}
                                >
                                    {VOLUME_OPTIONS.map((v) => <option key={v}>{v}</option>)}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Additional Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                                    placeholder="Any special requirements..."
                                    rows={2}
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-purple-600 hover:bg-purple-700"
                                >
                                    {loading ? "Submitting..." : <><Send className="w-4 h-4" /> Apply for HORECA Access</>}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
