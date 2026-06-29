"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, functions } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy,
    Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import {
    UtensilsCrossed,
    Check,
    X,
    Clock,
    Building2,
    Phone,
    MapPin,
    CalendarDays,
    Scale,
    AlertCircle,
    Loader2,
    Search,
    StickyNote,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface HorecaRequest {
    id: string;
    contactName: string;
    businessName: string;
    businessType: string;
    phone: string;
    location: string;
    pincode: string;
    schedule: string;
    dailyVolume: string;
    notes: string;
    status: "pending" | "approved" | "rejected";
    createdAt: Timestamp | null;
    reviewedAt?: Timestamp | null;
    reviewedBy?: string;
    matchedUid?: string;
}

type ConfirmAction = { type: "approve" | "reject"; request: HorecaRequest } | null;

export default function HorecaRequestsTab() {
    const [requests, setRequests] = useState<HorecaRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
    const [searchQuery, setSearchQuery] = useState("");
    const [syncing, setSyncing] = useState(false);

    // Real-time listener on horeca_requests
    useEffect(() => {
        const q = query(collection(db, "horeca_requests"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as HorecaRequest[];
            setRequests(docs);
            setLoading(false);
        }, (err) => {
            console.error("[HorecaRequests] Listener error:", err);
            setLoading(false);
        });
        return unsub;
    }, []);

    const filteredRequests = useMemo(() => {
        let list = requests;
        if (filter !== "all") {
            list = list.filter((r) => r.status === filter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (r) =>
                    r.contactName?.toLowerCase().includes(q) ||
                    r.businessName?.toLowerCase().includes(q) ||
                    r.phone?.includes(q) ||
                    r.location?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [requests, filter, searchQuery]);

    const counts = useMemo(() => ({
        all: requests.length,
        pending: requests.filter((r) => r.status === "pending").length,
        approved: requests.filter((r) => r.status === "approved").length,
        rejected: requests.filter((r) => r.status === "rejected").length,
    }), [requests]);

    const handleApprove = async (req: HorecaRequest) => {
        setActionLoading(req.id);
        try {
            // Call Cloud Function to approve — it auto-grants HORECA claim if phone matches
            const approveHorecaFn = httpsCallable<
                { requestId: string },
                { success: boolean; message: string; matchedUid?: string }
            >(functions, "approveHorecaRequest");
            const result = await approveHorecaFn({ requestId: req.id });

            if (result.data.matchedUid) {
                toast.success(`Approved! HORECA access auto-granted.`, {
                    description: `${req.businessName} — matched existing user`,
                });
            } else {
                toast.success(`Approved! HORECA access will be granted when user registers.`, {
                    description: `${req.businessName} — no matching user found yet`,
                });
            }
        } catch (err: unknown) {
            console.error("[HORECA] Approve failed:", err);
            toast.error("Failed to approve request");
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const syncFn = httpsCallable<
                Record<string, never>,
                { success: boolean; checked: number; granted: number; alreadyHad: number; notRegistered: number }
            >(functions, "syncHorecaClaims");
            const { data } = await syncFn({});
            if (data.granted > 0) {
                toast.success(`Granted HORECA access to ${data.granted} account${data.granted > 1 ? "s" : ""}`, {
                    description: `${data.alreadyHad} already had it · ${data.notRegistered} not registered yet · ${data.checked} approved total`,
                });
            } else {
                toast.success("All approved accounts are in sync", {
                    description: `${data.alreadyHad} already granted · ${data.notRegistered} not registered yet · ${data.checked} approved total`,
                });
            }
        } catch (err) {
            console.error("[HORECA] Sync failed:", err);
            toast.error("Failed to sync HORECA claims");
        } finally {
            setSyncing(false);
        }
    };

    const handleReject = async (req: HorecaRequest) => {
        setActionLoading(req.id);
        try {
            await updateDoc(doc(db, "horeca_requests", req.id), {
                status: "rejected",
                reviewedAt: serverTimestamp(),
            });
            toast.success(`Rejected request from ${req.businessName}`);
        } catch (err: unknown) {
            console.error("[HORECA] Reject failed:", err);
            toast.error("Failed to reject request");
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
        }
    };

    const formatDate = (ts: Timestamp | null | undefined) => {
        if (!ts?.toDate) return "—";
        return ts.toDate().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> Pending</span>;
            case "approved":
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><Check className="w-3 h-3" /> Approved</span>;
            case "rejected":
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><X className="w-3 h-3" /> Rejected</span>;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading HORECA requests...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <UtensilsCrossed className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">HORECA Requests</h2>
                        <p className="text-sm text-slate-500">Restaurant, Hotel &amp; Caterer access applications</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {counts.pending > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700">{counts.pending} pending</span>
                        </div>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing}
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                        title="Re-check every approved request and grant HORECA access to any registered user who is missing it"
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sync HORECA Access
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {(["pending", "all", "approved", "rejected"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                                filter === f
                                    ? "bg-white text-slate-800 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            {f} ({counts[f]})
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search requests..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                </div>
            </div>

            {/* Request Cards */}
            {filteredRequests.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                    <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-700 mb-1">No {filter !== "all" ? filter : ""} requests</h3>
                    <p className="text-sm text-slate-500">
                        {filter === "pending" ? "All caught up! No pending applications." : "No requests match your filter."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredRequests.map((req) => (
                        <div
                            key={req.id}
                            className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                                req.status === "pending"
                                    ? "border-amber-200 hover:border-amber-300"
                                    : req.status === "approved"
                                    ? "border-emerald-200"
                                    : "border-slate-200 opacity-75"
                            }`}
                        >
                            <div className="p-4 sm:p-5">
                                {/* Top row: business info + status */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                                            req.businessType === "Restaurant" ? "bg-orange-500" :
                                            req.businessType === "Hotel" ? "bg-blue-500" :
                                            req.businessType === "Caterer" ? "bg-pink-500" :
                                            req.businessType === "Cloud Kitchen" ? "bg-violet-500" :
                                            "bg-slate-500"
                                        }`}>
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{req.businessName}</h3>
                                            <p className="text-sm text-slate-500">{req.businessType} • {req.contactName}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {statusBadge(req.status)}
                                        <span className="text-xs text-slate-400">{formatDate(req.createdAt)}</span>
                                    </div>
                                </div>

                                {/* Details grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{req.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{req.location}, {req.pincode}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{req.schedule}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Scale className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{req.dailyVolume}</span>
                                    </div>
                                </div>

                                {/* Notes */}
                                {req.notes && (
                                    <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-2.5 mb-3">
                                        <StickyNote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                        <span>{req.notes}</span>
                                    </div>
                                )}

                                {/* Matched UID info */}
                                {req.status === "approved" && req.matchedUid && (
                                    <div className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5 mb-3">
                                        ✓ HORECA claim auto-granted to user {req.matchedUid.slice(0, 12)}...
                                    </div>
                                )}

                                {/* Action buttons */}
                                {req.status === "pending" && (
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        <Button
                                            size="sm"
                                            onClick={() => setConfirmAction({ type: "approve", request: req })}
                                            disabled={actionLoading === req.id}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            {actionLoading === req.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <><Check className="w-4 h-4" /> Approve</>
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setConfirmAction({ type: "reject", request: req })}
                                            disabled={actionLoading === req.id}
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            <X className="w-4 h-4" /> Reject
                                        </Button>
                                    </div>
                                )}

                                {/* Reviewed info */}
                                {req.status !== "pending" && req.reviewedAt && (
                                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                                        Reviewed on {formatDate(req.reviewedAt)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirm Dialog */}
            <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmAction?.type === "approve" ? "Approve HORECA Request?" : "Reject HORECA Request?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction?.type === "approve"
                                ? `This will approve "${confirmAction.request.businessName}" for HORECA access. The claim is granted to the exact account they applied from (the email or phone they signed in with).`
                                : `This will reject the application from "${confirmAction?.request.businessName}". They can apply again later.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!confirmAction) return;
                                if (confirmAction.type === "approve") {
                                    handleApprove(confirmAction.request);
                                } else {
                                    handleReject(confirmAction.request);
                                }
                            }}
                            className={confirmAction?.type === "approve"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-red-600 hover:bg-red-700"
                            }
                        >
                            {confirmAction?.type === "approve" ? "Approve" : "Reject"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
