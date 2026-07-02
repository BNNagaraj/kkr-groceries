"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    writeBatch,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMode } from "@/contexts/ModeContext";
import { toast } from "sonner";
import { PackagePlus, CheckCircle2, XCircle, Loader2, Phone, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react";

interface ProductRequest {
    id: string;
    userId: string;
    userName: string;
    userPhone: string;
    item: string;
    note?: string;
    status: "open" | "added" | "dismissed";
    createdAt: Timestamp | null;
}

interface RequestGroup {
    key: string;
    label: string;
    requests: ProductRequest[];
}

/**
 * Item Requests — the demand signal buyers send when a search finds nothing.
 * Open requests are grouped by (normalised) item name with a demand count, so
 * "broccoli" asked by 4 buyers reads as one line. "Mark added" resolves the
 * whole group and notifies every requester; "Dismiss" quietly closes it.
 */
export default function ItemRequestsPanel() {
    const { col } = useMode();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actingOn, setActingOn] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showResolved, setShowResolved] = useState(false);

    useEffect(() => {
        const qy = query(collection(db, "productRequests"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(
            qy,
            (snap) => {
                setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductRequest)));
                setLoading(false);
            },
            (err) => {
                console.error("[ItemRequests] snapshot error:", err);
                setLoading(false);
            }
        );
        return unsub;
    }, []);

    const groups = useMemo<RequestGroup[]>(() => {
        const open = requests.filter((r) => r.status === "open");
        const byKey: Record<string, RequestGroup> = {};
        for (const r of open) {
            const key = r.item.trim().toLowerCase();
            if (!byKey[key]) byKey[key] = { key, label: r.item.trim(), requests: [] };
            byKey[key].requests.push(r);
        }
        // Most-demanded first
        return Object.values(byKey).sort((a, b) => b.requests.length - a.requests.length);
    }, [requests]);

    const resolvedCount = requests.filter((r) => r.status !== "open").length;

    /** Resolve a whole group: added → also notify each requester. */
    const resolveGroup = async (group: RequestGroup, status: "added" | "dismissed") => {
        setActingOn(group.key);
        try {
            const batch = writeBatch(db);
            for (const r of group.requests) {
                batch.update(doc(db, "productRequests", r.id), {
                    status,
                    resolvedAt: serverTimestamp(),
                });
                if (status === "added") {
                    batch.set(doc(collection(db, col("notifications"))), {
                        userId: r.userId,
                        type: "item_added",
                        title: "Requested item now available!",
                        message: `"${group.label}" you asked for is now in our catalog — order it anytime.`,
                        read: false,
                        createdAt: serverTimestamp(),
                    });
                }
            }
            await batch.commit();
            toast.success(
                status === "added"
                    ? `Marked "${group.label}" as added — ${group.requests.length} buyer${group.requests.length !== 1 ? "s" : ""} notified.`
                    : `Dismissed "${group.label}".`
            );
        } catch (err) {
            console.error("[ItemRequests] resolve failed:", err);
            toast.error("Failed to update requests.");
        } finally {
            setActingOn(null);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-emerald-600" />
                    Item Requests
                    {groups.length > 0 && (
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                            {groups.length} open
                        </span>
                    )}
                </h3>
                {resolvedCount > 0 && (
                    <button
                        onClick={() => setShowResolved((v) => !v)}
                        className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1"
                    >
                        {showResolved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {resolvedCount} resolved
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                    No open item requests. When a buyer searches for something not in the catalog, their request appears here.
                </p>
            ) : (
                <div className="space-y-2">
                    {groups.map((g) => {
                        const isExpanded = expanded === g.key;
                        const isActing = actingOn === g.key;
                        return (
                            <div key={g.key} className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-3 p-3">
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : g.key)}
                                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                                    >
                                        <span className="font-semibold text-slate-800 capitalize truncate">{g.label}</span>
                                        <span className="shrink-0 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                                            {g.requests.length} buyer{g.requests.length !== 1 ? "s" : ""}
                                        </span>
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                                    </button>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => resolveGroup(g, "added")}
                                            disabled={isActing}
                                            title="Mark as added to catalog — notifies all requesters"
                                            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                                        >
                                            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            Added
                                        </button>
                                        <button
                                            onClick={() => resolveGroup(g, "dismissed")}
                                            disabled={isActing}
                                            title="Dismiss without notifying"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 space-y-1.5">
                                        {g.requests.map((r) => (
                                            <div key={r.id} className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                                <span className="inline-flex items-center gap-1 font-semibold">
                                                    <UserIcon className="w-3 h-3 text-slate-400" />
                                                    {r.userName || "Buyer"}
                                                </span>
                                                {r.userPhone && (
                                                    <span className="inline-flex items-center gap-1 text-slate-400">
                                                        <Phone className="w-3 h-3" /> {r.userPhone}
                                                    </span>
                                                )}
                                                {r.note && <span className="text-slate-500 italic">“{r.note}”</span>}
                                                <span className="text-slate-300 ml-auto">
                                                    {r.createdAt?.toDate?.().toLocaleDateString("en-IN", { day: "numeric", month: "short" }) || ""}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showResolved && resolvedCount > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
                    {requests
                        .filter((r) => r.status !== "open")
                        .slice(0, 20)
                        .map((r) => (
                            <div key={r.id} className="text-xs text-slate-400 flex items-center gap-2">
                                <span className={r.status === "added" ? "text-emerald-500" : "text-slate-300"}>
                                    {r.status === "added" ? "✓ added" : "✕ dismissed"}
                                </span>
                                <span className="capitalize">{r.item}</span>
                                <span className="text-slate-300">· {r.userName || "Buyer"}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}
