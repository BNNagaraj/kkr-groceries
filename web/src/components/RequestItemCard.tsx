"use client";

import React, { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PackagePlus, Send, Loader2, CheckCircle2 } from "lucide-react";

/**
 * "Request an item" — shown when a search finds nothing, i.e. the exact moment
 * a buyer discovers we don't stock what they need. Each submission lands in
 * the productRequests collection as a demand signal the admin can act on.
 */
export function RequestItemCard({ initialItem }: { initialItem: string }) {
  const { currentUser } = useAuth();
  const [item, setItem] = useState(initialItem);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Follow the search box while the user refines their (unmatched) query.
  useEffect(() => {
    setItem(initialItem);
    setSent(false);
  }, [initialItem]);

  if (!currentUser) {
    return (
      <p className="text-sm text-slate-400 mt-4">
        Looking for something we don&apos;t stock? Sign in to request it and we&apos;ll try to source it.
      </p>
    );
  }

  if (sent) {
    return (
      <div className="mt-4 inline-flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-semibold">
        <CheckCircle2 className="w-4 h-4" />
        Request received — we&apos;ll notify you if we add it.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = item.trim();
    if (name.length < 2) {
      toast.error("Please enter the item name.");
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, "productRequests"), {
        userId: currentUser.uid,
        userName: currentUser.displayName || "",
        userPhone: currentUser.phoneNumber || "",
        item: name.slice(0, 60),
        note: note.trim().slice(0, 200),
        status: "open",
        createdAt: serverTimestamp(),
      });
      setSent(true);
      toast.success("Item request sent!", { description: `We'll try to source "${name}" for you.` });
    } catch (err) {
      console.error("[RequestItem] failed:", err);
      toast.error("Couldn't send the request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 max-w-md mx-auto text-left">
      <div className="flex items-center gap-1.5 text-sm font-bold mb-2" style={{ color: "var(--color-primary-dark)" }}>
        <PackagePlus className="w-4 h-4" />
        Can&apos;t find it? Request the item
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="e.g. Broccoli"
          maxLength={60}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={sending}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-white rounded-xl px-4 py-2.5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
          style={{ background: "var(--color-accent, #3A9B42)" }}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Request
        </button>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: quantity needed, how often… (helps us source it)"
        maxLength={200}
        className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2"
        style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
      />
    </form>
  );
}
