"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { toast } from "sonner";
import {
    Megaphone,
    MessageSquarePlus,
    Send,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Info,
    AlertTriangle,
    Tag,
    ChevronDown,
    ChevronUp,
    MessageCircle,
    ShieldCheck,
    Copy,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ───
interface Announcement {
    id: string;
    title: string;
    body: string;
    type: "info" | "warning" | "promo";
    createdAt: Timestamp | null;
    active: boolean;
}

interface GrievanceReply {
    message: string;
    by: string;
    byName: string;
    isAdmin: boolean;
    at: Timestamp | null;
}

interface Grievance {
    id: string;
    userId: string;
    userName: string;
    userPhone: string;
    subject: string;
    message: string;
    category: string;
    status: "open" | "in-progress" | "resolved" | "closed";
    createdAt: Timestamp | null;
    replies: GrievanceReply[];
}

interface OtpMessage {
    id: string;
    orderId: string;
    otp: string;
    expiresAt: string;
    createdAt: string | Timestamp;
    read: boolean;
}

function toEpoch(v: unknown): number {
    if (!v) return 0;
    if (typeof v === "string") return new Date(v).getTime() || 0;
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof v === "object" && v !== null && "toMillis" in v) {
        return (v as Timestamp).toMillis();
    }
    return 0;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

const CATEGORIES = [
    "Order Issue",
    "Delivery Problem",
    "Product Quality",
    "Pricing Query",
    "Suggestion",
    "General Inquiry",
    "Other",
];

function formatDate(ts: Timestamp | null | undefined) {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    open: { label: "Open", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <Clock className="w-3 h-3" /> },
    "in-progress": { label: "In Progress", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <Loader2 className="w-3 h-3" /> },
    resolved: { label: "Resolved", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    closed: { label: "Closed", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function MessageCenter() {
    const { currentUser } = useAuth();
    const { col } = useMode();
    const [tab, setTab] = useState<"announcements" | "messages" | "otps">("announcements");
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [grievances, setGrievances] = useState<Grievance[]>([]);
    const [otpMessages, setOtpMessages] = useState<OtpMessage[]>([]);
    const [loadingAnn, setLoadingAnn] = useState(true);
    const [loadingGrv, setLoadingGrv] = useState(true);
    const [loadingOtp, setLoadingOtp] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [sending, setSending] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [form, setForm] = useState({
        subject: "",
        message: "",
        category: "General Inquiry",
    });

    // Tick every second for OTP countdowns
    useEffect(() => {
        if (tab !== "otps" || otpMessages.length === 0) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [tab, otpMessages.length]);

    // Listen to active announcements
    useEffect(() => {
        const q = query(
            collection(db, "announcements"),
            where("active", "==", true),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
            setLoadingAnn(false);
        }, () => setLoadingAnn(false));
        return unsub;
    }, []);

    // Listen to user's grievances
    useEffect(() => {
        if (!currentUser) { setLoadingGrv(false); return; }
        const q = query(
            collection(db, "grievances"),
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            setGrievances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Grievance)));
            setLoadingGrv(false);
        }, () => setLoadingGrv(false));
        return unsub;
    }, [currentUser]);

    // Listen to user's delivery OTP notifications (last 24 hours)
    useEffect(() => {
        if (!currentUser) { setLoadingOtp(false); return; }
        const q = query(
            collection(db, col("notifications")),
            where("userId", "==", currentUser.uid),
            where("type", "==", "delivery_otp")
        );
        const unsub = onSnapshot(q, (snap) => {
            const cutoff = Date.now() - TWENTY_FOUR_HOURS;
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() } as OtpMessage))
                .filter((o) => {
                    // Show if created within last 24 hours OR if OTP is still valid
                    const created = toEpoch(o.createdAt);
                    const expires = new Date(o.expiresAt).getTime();
                    return created > cutoff || expires > Date.now();
                })
                .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
            setOtpMessages(items);
            setLoadingOtp(false);
        }, () => setLoadingOtp(false));
        return unsub;
    }, [currentUser, col]);

    const handleSubmitGrievance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) {
            toast.error("Please sign in to submit a message.");
            return;
        }
        if (!form.subject.trim() || !form.message.trim()) {
            toast.error("Subject and message are required.");
            return;
        }
        setSending(true);
        try {
            await addDoc(collection(db, "grievances"), {
                userId: currentUser.uid,
                userName: currentUser.displayName || "User",
                userPhone: currentUser.phoneNumber || currentUser.email || "",
                subject: form.subject.trim(),
                message: form.message.trim(),
                category: form.category,
                status: "open",
                createdAt: serverTimestamp(),
                replies: [],
            });
            toast.success("Message submitted successfully!");
            setForm({ subject: "", message: "", category: "General Inquiry" });
            setShowForm(false);
            setTab("messages");
        } catch (err) {
            console.error("[MessageCenter] Submit failed:", err);
            toast.error("Failed to submit. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const handleReply = async (grievanceId: string) => {
        if (!currentUser || !replyText.trim()) return;
        setSending(true);
        try {
            const { doc: fbDoc, updateDoc, arrayUnion } = await import("firebase/firestore");
            await updateDoc(fbDoc(db, "grievances", grievanceId), {
                replies: arrayUnion({
                    message: replyText.trim(),
                    by: currentUser.uid,
                    byName: currentUser.displayName || "User",
                    isAdmin: false,
                    at: Timestamp.now(),
                }),
            });
            setReplyText("");
            setReplyingTo(null);
            toast.success("Reply sent!");
        } catch (err) {
            console.error("[MessageCenter] Reply failed:", err);
            toast.error("Failed to send reply.");
        } finally {
            setSending(false);
        }
    };

    const announcementIcon = (type: string) => {
        if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        if (type === "promo") return <Tag className="w-4 h-4 text-purple-500" />;
        return <Info className="w-4 h-4 text-blue-500" />;
    };

    const announcementBg = (type: string) => {
        if (type === "warning") return "border-amber-200 bg-amber-50/50";
        if (type === "promo") return "border-purple-200 bg-purple-50/50";
        return "border-blue-200 bg-blue-50/50";
    };

    const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

    return (
        <div className="space-y-6">
            {/* Tab Switcher */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-0">
                <button
                    onClick={() => setTab("announcements")}
                    className={`flex items-center gap-2 px-1 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                        tab === "announcements"
                            ? "border-emerald-600 text-emerald-700"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Megaphone className="w-4 h-4" /> Announcements
                    {announcements.length > 0 && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{announcements.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setTab("messages")}
                    className={`flex items-center gap-2 px-1 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                        tab === "messages"
                            ? "border-emerald-600 text-emerald-700"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <MessageCircle className="w-4 h-4" /> My Messages
                    {grievances.filter((g) => g.status === "open" || g.status === "in-progress").length > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {grievances.filter((g) => g.status === "open" || g.status === "in-progress").length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab("otps")}
                    className={`flex items-center gap-2 px-1 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                        tab === "otps"
                            ? "border-emerald-600 text-emerald-700"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <ShieldCheck className="w-4 h-4" /> Delivery OTPs
                    {otpMessages.filter((o) => new Date(o.expiresAt).getTime() > Date.now()).length > 0 && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {otpMessages.filter((o) => new Date(o.expiresAt).getTime() > Date.now()).length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Announcements Tab ── */}
            {tab === "announcements" && (
                <div className="space-y-3">
                    {loadingAnn ? (
                        <div className="text-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</div>
                    ) : announcements.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                            <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <h3 className="font-bold text-slate-700">No announcements</h3>
                            <p className="text-sm text-slate-500 mt-1">Check back later for updates from KKR Groceries.</p>
                        </div>
                    ) : (
                        announcements.map((a) => (
                            <div key={a.id} className={`rounded-xl border p-4 ${announcementBg(a.type)}`}>
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">{announcementIcon(a.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 text-sm">{a.title}</h3>
                                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                                        <span className="text-xs text-slate-400 mt-2 block">{formatDate(a.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── My Messages Tab ── */}
            {tab === "messages" && (
                <div className="space-y-4">
                    {/* New Message Button */}
                    {!showForm && (
                        <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700">
                            <MessageSquarePlus className="w-4 h-4" /> New Message
                        </Button>
                    )}

                    {/* New Message Form */}
                    {showForm && (
                        <form onSubmit={handleSubmitGrievance} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <MessageSquarePlus className="w-4 h-4 text-emerald-600" /> Submit a Message
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Category</label>
                                    <select
                                        value={form.category}
                                        onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                                        className={selectClass}
                                    >
                                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Subject *</label>
                                    <Input
                                        required
                                        value={form.subject}
                                        onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                                        placeholder="Brief subject line"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Message *</label>
                                <textarea
                                    required
                                    value={form.message}
                                    onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                                    placeholder="Describe your issue, query, or suggestion in detail..."
                                    rows={4}
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                                <Button type="submit" disabled={sending} className="bg-emerald-600 hover:bg-emerald-700">
                                    {sending ? "Sending..." : <><Send className="w-4 h-4" /> Submit</>}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Message List */}
                    {loadingGrv ? (
                        <div className="text-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</div>
                    ) : grievances.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                            <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <h3 className="font-bold text-slate-700">No messages yet</h3>
                            <p className="text-sm text-slate-500 mt-1">Submit a message to get started — we typically respond within 24 hours.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {grievances.map((g) => {
                                const st = statusConfig[g.status] || statusConfig.open;
                                const isExpanded = expandedId === g.id;
                                const hasNewReply = g.replies?.some((r) => r.isAdmin);
                                return (
                                    <div key={g.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        {/* Header row */}
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : g.id)}
                                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-slate-800 text-sm truncate">{g.subject}</h4>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${st.bg} ${st.color}`}>
                                                        {st.icon} {st.label}
                                                    </span>
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{g.category}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{g.message}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {hasNewReply && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Admin replied" />}
                                                <span className="text-xs text-slate-400">{formatDate(g.createdAt)}</span>
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                            </div>
                                        </button>

                                        {/* Expanded details */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 p-4 space-y-3">
                                                {/* Original message */}
                                                <div className="bg-slate-50 rounded-lg p-3">
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{g.message}</p>
                                                </div>

                                                {/* Replies */}
                                                {g.replies?.length > 0 && (
                                                    <div className="space-y-2 pl-3 border-l-2 border-slate-200">
                                                        {g.replies.map((r, i) => (
                                                            <div key={i} className={`rounded-lg p-3 ${r.isAdmin ? "bg-emerald-50 border border-emerald-100" : "bg-blue-50 border border-blue-100"}`}>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-xs font-bold ${r.isAdmin ? "text-emerald-700" : "text-blue-700"}`}>
                                                                        {r.isAdmin ? "KKR Support" : "You"}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">{formatDate(r.at)}</span>
                                                                </div>
                                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reply form */}
                                                {(g.status === "open" || g.status === "in-progress") && (
                                                    replyingTo === g.id ? (
                                                        <div className="flex gap-2">
                                                            <Input
                                                                value={replyText}
                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                placeholder="Type your reply..."
                                                                className="flex-1"
                                                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(g.id); } }}
                                                            />
                                                            <Button size="sm" onClick={() => handleReply(g.id)} disabled={sending || !replyText.trim()}>
                                                                <Send className="w-4 h-4" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button size="sm" variant="outline" onClick={() => setReplyingTo(g.id)}>
                                                            <MessageCircle className="w-4 h-4" /> Reply
                                                        </Button>
                                                    )
                                                )}

                                                {(g.status === "resolved" || g.status === "closed") && (
                                                    <p className="text-xs text-slate-400 italic">This conversation has been {g.status}.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Delivery OTPs Tab ── */}
            {tab === "otps" && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                        Delivery OTPs are shown here for up to 24 hours. Share the code only with the delivery person.
                    </p>

                    {loadingOtp ? (
                        <div className="text-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</div>
                    ) : otpMessages.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <h3 className="font-bold text-slate-700">No recent OTPs</h3>
                            <p className="text-sm text-slate-500 mt-1">Delivery OTPs will appear here when your order is out for delivery.</p>
                        </div>
                    ) : (
                        otpMessages.map((o) => {
                            const expiresMs = new Date(o.expiresAt).getTime();
                            const isActive = expiresMs > now;
                            const secondsLeft = isActive ? Math.max(0, Math.floor((expiresMs - now) / 1000)) : 0;
                            const createdDate = toEpoch(o.createdAt);
                            const hoursAgo = createdDate ? Math.floor((now - createdDate) / (1000 * 60 * 60)) : null;

                            return (
                                <div
                                    key={o.id}
                                    className={`rounded-xl border overflow-hidden shadow-sm ${
                                        isActive
                                            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                                            : "border-slate-200 bg-slate-50/50"
                                    }`}
                                >
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                    isActive ? "bg-emerald-100" : "bg-slate-200"
                                                }`}>
                                                    <ShieldCheck className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">
                                                        Delivery OTP
                                                        {o.orderId && (
                                                            <span className="font-normal text-slate-400 ml-1.5">
                                                                #{o.orderId.slice(-6).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <span className="text-xs text-slate-400">
                                                        {createdDate ? new Date(createdDate).toLocaleDateString("en-IN", {
                                                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                                        }) : ""}
                                                        {hoursAgo !== null && hoursAgo > 0 && ` (${hoursAgo}h ago)`}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                                isActive
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                    : "bg-slate-100 border-slate-200 text-slate-500"
                                            }`}>
                                                {isActive ? (
                                                    <>
                                                        <Clock className="w-3 h-3" />
                                                        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle className="w-3 h-3" />
                                                        Expired
                                                    </>
                                                )}
                                            </span>
                                        </div>

                                        {/* OTP Code */}
                                        <div className={`mt-3 rounded-lg p-3 text-center ${
                                            isActive ? "bg-emerald-100/60" : "bg-slate-100"
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                                                {isActive ? "Your Code" : "Code (Expired)"}
                                            </div>
                                            <div className={`text-3xl font-extrabold tracking-[0.3em] font-mono select-all ${
                                                isActive ? "text-emerald-800" : "text-slate-400 line-through"
                                            }`}>
                                                {o.otp}
                                            </div>
                                        </div>

                                        {/* Copy button for active OTPs */}
                                        {isActive && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(o.otp);
                                                        setCopiedId(o.id);
                                                        setTimeout(() => setCopiedId(null), 2000);
                                                    } catch {
                                                        toast.error("Failed to copy");
                                                    }
                                                }}
                                                className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 rounded-lg py-1.5 transition-colors"
                                            >
                                                {copiedId === o.id ? (
                                                    <><Check className="w-3.5 h-3.5" /> Copied!</>
                                                ) : (
                                                    <><Copy className="w-3.5 h-3.5" /> Copy Code</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
