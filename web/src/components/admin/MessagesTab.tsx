"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    arrayUnion,
    deleteDoc,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
    Megaphone,
    MessageCircle,
    Send,
    Clock,
    CheckCircle2,
    Loader2,
    Search,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    AlertTriangle,
    Info,
    Tag,
    ChevronDown,
    ChevronUp,
    Phone,
    User as UserIcon,
    ArrowRightLeft,
    PackagePlus,
} from "lucide-react";
import ItemRequestsPanel from "./ItemRequestsPanel";
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

// ─── Types ───
interface Announcement {
    id: string;
    title: string;
    body: string;
    type: "info" | "warning" | "promo";
    createdAt: Timestamp | null;
    active: boolean;
    createdBy: string;
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

function formatDate(ts: Timestamp | null | undefined) {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

const STATUS_OPTIONS: { value: Grievance["status"]; label: string; color: string }[] = [
    { value: "open", label: "Open", color: "text-amber-700 bg-amber-50" },
    { value: "in-progress", label: "In Progress", color: "text-blue-700 bg-blue-50" },
    { value: "resolved", label: "Resolved", color: "text-emerald-700 bg-emerald-50" },
    { value: "closed", label: "Closed", color: "text-slate-500 bg-slate-100" },
];

export default function MessagesTab() {
    const { currentUser } = useAuth();
    const [section, setSection] = useState<"grievances" | "announcements" | "requests">("grievances");

    // ── Grievances state ──
    const [grievances, setGrievances] = useState<Grievance[]>([]);
    const [loadingGrv, setLoadingGrv] = useState(true);
    const [grvFilter, setGrvFilter] = useState<"all" | Grievance["status"]>("all");
    const [grvSearch, setGrvSearch] = useState("");
    const [expandedGrv, setExpandedGrv] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replySending, setReplySending] = useState(false);

    // ── Announcements state ──
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loadingAnn, setLoadingAnn] = useState(true);
    const [annForm, setAnnForm] = useState({ title: "", body: "", type: "info" as "info" | "warning" | "promo" });
    const [showAnnForm, setShowAnnForm] = useState(false);
    const [annSending, setAnnSending] = useState(false);
    const [deleteAnn, setDeleteAnn] = useState<Announcement | null>(null);

    // ── Listeners ──
    useEffect(() => {
        const q = query(collection(db, "grievances"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setGrievances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Grievance)));
            setLoadingGrv(false);
        }, () => setLoadingGrv(false));
        return unsub;
    }, []);

    useEffect(() => {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
            setLoadingAnn(false);
        }, () => setLoadingAnn(false));
        return unsub;
    }, []);

    // ── Filtered grievances ──
    const filteredGrievances = useMemo(() => {
        let list = grievances;
        if (grvFilter !== "all") list = list.filter((g) => g.status === grvFilter);
        if (grvSearch.trim()) {
            const q = grvSearch.toLowerCase();
            list = list.filter((g) =>
                g.subject.toLowerCase().includes(q) ||
                g.userName.toLowerCase().includes(q) ||
                g.userPhone.includes(q) ||
                g.category.toLowerCase().includes(q) ||
                g.message.toLowerCase().includes(q)
            );
        }
        return list;
    }, [grievances, grvFilter, grvSearch]);

    const grvCounts = useMemo(() => ({
        all: grievances.length,
        open: grievances.filter((g) => g.status === "open").length,
        "in-progress": grievances.filter((g) => g.status === "in-progress").length,
        resolved: grievances.filter((g) => g.status === "resolved").length,
        closed: grievances.filter((g) => g.status === "closed").length,
    }), [grievances]);

    // ── Admin reply ──
    const handleAdminReply = async (grievanceId: string) => {
        if (!currentUser || !replyText.trim()) return;
        setReplySending(true);
        try {
            await updateDoc(doc(db, "grievances", grievanceId), {
                replies: arrayUnion({
                    message: replyText.trim(),
                    by: currentUser.uid,
                    byName: "KKR Support",
                    isAdmin: true,
                    at: Timestamp.now(),
                }),
                // Auto-move to in-progress if still open
                ...(grievances.find((g) => g.id === grievanceId)?.status === "open"
                    ? { status: "in-progress" } : {}),
            });
            setReplyText("");
            toast.success("Reply sent to user.");
        } catch (err) {
            console.error("[MessagesTab] Reply failed:", err);
            toast.error("Failed to send reply.");
        } finally {
            setReplySending(false);
        }
    };

    // ── Status change ──
    const handleStatusChange = async (grievanceId: string, newStatus: Grievance["status"]) => {
        try {
            await updateDoc(doc(db, "grievances", grievanceId), { status: newStatus });
            toast.success(`Status updated to ${newStatus}`);
        } catch (err) {
            console.error("[MessagesTab] Status update failed:", err);
            toast.error("Failed to update status.");
        }
    };

    // ── Create announcement ──
    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!annForm.title.trim() || !annForm.body.trim()) {
            toast.error("Title and body are required."); return;
        }
        setAnnSending(true);
        try {
            await addDoc(collection(db, "announcements"), {
                title: annForm.title.trim(),
                body: annForm.body.trim(),
                type: annForm.type,
                active: true,
                createdAt: serverTimestamp(),
                createdBy: currentUser?.uid || "",
            });
            toast.success("Announcement published!");
            setAnnForm({ title: "", body: "", type: "info" });
            setShowAnnForm(false);
        } catch (err) {
            console.error("[MessagesTab] Announcement create failed:", err);
            toast.error("Failed to create announcement.");
        } finally {
            setAnnSending(false);
        }
    };

    // ── Toggle announcement active ──
    const toggleAnnActive = async (ann: Announcement) => {
        try {
            await updateDoc(doc(db, "announcements", ann.id), { active: !ann.active });
            toast.success(ann.active ? "Announcement hidden" : "Announcement shown");
        } catch (err) {
            toast.error("Failed to update announcement.");
        }
    };

    // ── Delete announcement ──
    const handleDeleteAnn = async () => {
        if (!deleteAnn) return;
        try {
            await deleteDoc(doc(db, "announcements", deleteAnn.id));
            toast.success("Announcement deleted.");
        } catch (err) {
            toast.error("Failed to delete announcement.");
        } finally {
            setDeleteAnn(null);
        }
    };

    const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

    return (
        <div className="space-y-6">
            {/* Section Switcher */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Message Center</h2>
                        <p className="text-sm text-slate-500">User messages, grievances &amp; announcements</p>
                    </div>
                </div>
                {grvCounts.open > 0 && section === "grievances" && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700">{grvCounts.open} open</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setSection("grievances")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        section === "grievances" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <MessageCircle className="w-4 h-4" /> User Messages ({grvCounts.all})
                </button>
                <button
                    onClick={() => setSection("announcements")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        section === "announcements" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Megaphone className="w-4 h-4" /> Announcements ({announcements.length})
                </button>
                <button
                    onClick={() => setSection("requests")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        section === "requests" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <PackagePlus className="w-4 h-4" /> Item Requests
                </button>
            </div>

            {/* ═══════════ ITEM REQUESTS SECTION ═══════════ */}
            {section === "requests" && <ItemRequestsPanel />}

            {/* ═══════════ GRIEVANCES SECTION ═══════════ */}
            {section === "grievances" && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
                            {(["all", "open", "in-progress", "resolved", "closed"] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setGrvFilter(f)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                                        grvFilter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    {f === "all" ? "All" : f.replace("-", " ")} ({grvCounts[f]})
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="search"
                                value={grvSearch}
                                onChange={(e) => setGrvSearch(e.target.value)}
                                placeholder="Search messages..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                    </div>

                    {/* Grievance List */}
                    {loadingGrv ? (
                        <div className="text-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</div>
                    ) : filteredGrievances.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                            <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-700">No messages</h3>
                            <p className="text-sm text-slate-500">{grvFilter !== "all" ? "No messages match this filter." : "No user messages yet."}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredGrievances.map((g) => {
                                const isExpanded = expandedGrv === g.id;
                                const st = STATUS_OPTIONS.find((s) => s.value === g.status) || STATUS_OPTIONS[0];
                                return (
                                    <div key={g.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        {/* Header */}
                                        <button
                                            onClick={() => setExpandedGrv(isExpanded ? null : g.id)}
                                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                                                g.status === "open" ? "bg-amber-500" :
                                                g.status === "in-progress" ? "bg-blue-500" :
                                                g.status === "resolved" ? "bg-emerald-500" : "bg-slate-400"
                                            }`}>
                                                {g.userName?.[0]?.toUpperCase() || "U"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-slate-800 text-sm truncate">{g.subject}</h4>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{g.category}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {g.userName}</span>
                                                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {g.userPhone}</span>
                                                    <span>{formatDate(g.createdAt)}</span>
                                                    {g.replies?.length > 0 && (
                                                        <span className="flex items-center gap-1 text-blue-600"><MessageCircle className="w-3 h-3" /> {g.replies.length} replies</span>
                                                    )}
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                                        </button>

                                        {/* Expanded */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 p-4 space-y-4">
                                                {/* Original */}
                                                <div className="bg-slate-50 rounded-lg p-3">
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{g.message}</p>
                                                </div>

                                                {/* Replies thread */}
                                                {g.replies?.length > 0 && (
                                                    <div className="space-y-2 pl-3 border-l-2 border-slate-200">
                                                        {g.replies.map((r, i) => (
                                                            <div key={i} className={`rounded-lg p-3 ${r.isAdmin ? "bg-emerald-50 border border-emerald-100" : "bg-blue-50 border border-blue-100"}`}>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-xs font-bold ${r.isAdmin ? "text-emerald-700" : "text-blue-700"}`}>
                                                                        {r.isAdmin ? "KKR Support" : r.byName || "User"}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">{formatDate(r.at)}</span>
                                                                </div>
                                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Status + Reply */}
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    {/* Status changer */}
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                                                        <select
                                                            value={g.status}
                                                            onChange={(e) => handleStatusChange(g.id, e.target.value as Grievance["status"])}
                                                            className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            {STATUS_OPTIONS.map((s) => (
                                                                <option key={s.value} value={s.value}>{s.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Reply input */}
                                                    <div className="flex gap-2 flex-1">
                                                        <Input
                                                            value={expandedGrv === g.id ? replyText : ""}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Type admin reply..."
                                                            className="flex-1 text-sm"
                                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdminReply(g.id); } }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleAdminReply(g.id)}
                                                            disabled={replySending || !replyText.trim()}
                                                            className="bg-emerald-600 hover:bg-emerald-700"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ ANNOUNCEMENTS SECTION ═══════════ */}
            {section === "announcements" && (
                <div className="space-y-4">
                    {/* Create button */}
                    {!showAnnForm && (
                        <Button onClick={() => setShowAnnForm(true)}><Plus className="w-4 h-4" /> New Announcement</Button>
                    )}

                    {/* Create form */}
                    {showAnnForm && (
                        <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Megaphone className="w-4 h-4 text-blue-600" /> Create Announcement</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Title *</label>
                                    <Input
                                        required
                                        value={annForm.title}
                                        onChange={(e) => setAnnForm((p) => ({ ...p, title: e.target.value }))}
                                        placeholder="Announcement title"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Type</label>
                                    <select
                                        value={annForm.type}
                                        onChange={(e) => setAnnForm((p) => ({ ...p, type: e.target.value as "info" | "warning" | "promo" }))}
                                        className={selectClass}
                                    >
                                        <option value="info">Info</option>
                                        <option value="warning">Warning / Alert</option>
                                        <option value="promo">Promotion / Offer</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Body *</label>
                                <textarea
                                    required
                                    value={annForm.body}
                                    onChange={(e) => setAnnForm((p) => ({ ...p, body: e.target.value }))}
                                    placeholder="Write your announcement..."
                                    rows={4}
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={() => setShowAnnForm(false)}>Cancel</Button>
                                <Button type="submit" disabled={annSending}>
                                    {annSending ? "Publishing..." : <><Megaphone className="w-4 h-4" /> Publish</>}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Announcement List */}
                    {loadingAnn ? (
                        <div className="text-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</div>
                    ) : announcements.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-700">No announcements</h3>
                            <p className="text-sm text-slate-500">Create one to broadcast to all users.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {announcements.map((a) => (
                                <div key={a.id} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${!a.active ? "opacity-50" : ""}`}>
                                    <div className="flex items-start gap-3 p-4">
                                        <div className="mt-0.5">
                                            {a.type === "warning" ? <AlertTriangle className="w-5 h-5 text-amber-500" /> :
                                             a.type === "promo" ? <Tag className="w-5 h-5 text-purple-500" /> :
                                             <Info className="w-5 h-5 text-blue-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-800">{a.title}</h4>
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                                    {a.active ? "Active" : "Hidden"}
                                                </span>
                                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">{a.type}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                                            <span className="text-xs text-slate-400 mt-2 block">{formatDate(a.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => toggleAnnActive(a)}
                                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                                title={a.active ? "Hide" : "Show"}
                                            >
                                                {a.active ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                                            </button>
                                            <button
                                                onClick={() => setDeleteAnn(a)}
                                                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Delete Announcement Confirm */}
            <AlertDialog open={!!deleteAnn} onOpenChange={(open) => !open && setDeleteAnn(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete &ldquo;{deleteAnn?.title}&rdquo;. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAnn} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
