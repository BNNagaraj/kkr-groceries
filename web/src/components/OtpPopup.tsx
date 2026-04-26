"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  limit,
  Timestamp,
} from "firebase/firestore";
import { useMode } from "@/contexts/ModeContext";
import { ShieldCheck, X } from "lucide-react";

interface OtpNotification {
  id: string;
  orderId: string;
  otp: string;
  expiresAt: string;
  createdAt: string | Timestamp;
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

/**
 * Pops up a centered modal whenever a fresh, unread delivery_otp notification
 * arrives for the signed-in buyer. Lives globally in the Header so it appears
 * regardless of which page the buyer is on.
 *
 * Dismissed by tapping "Got it" (marks read) or by closing — the same
 * notification won't pop again because the listener filters on `read === false`.
 */
export function OtpPopup() {
  const { currentUser } = useAuth();
  const { col } = useMode();
  const [active, setActive] = useState<OtpNotification | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, col("notifications")),
      where("userId", "==", currentUser.uid),
      where("type", "==", "delivery_otp"),
      where("read", "==", false),
      limit(5)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setActive(null);
          return;
        }
        // Pick the most recent notification not already dismissed in this session
        const candidates = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as OtpNotification)
          .filter((n) => n.otp && n.expiresAt && !dismissedIds.has(n.id))
          .filter((n) => new Date(n.expiresAt).getTime() > Date.now())
          .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
        setActive(candidates[0] || null);
      },
      (err) => console.warn("[OtpPopup] Listener error:", err.message)
    );

    return unsub;
  }, [currentUser, col, dismissedIds]);

  // 1-second tick for the countdown
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;

  const secondsLeft = Math.max(
    0,
    Math.floor((new Date(active.expiresAt).getTime() - now) / 1000)
  );
  if (secondsLeft <= 0) return null;

  const handleDismiss = async (markRead: boolean) => {
    setDismissedIds((s) => new Set(s).add(active.id));
    if (markRead) {
      try {
        await updateDoc(doc(db, col("notifications"), active.id), { read: true });
      } catch (e) {
        console.warn("[OtpPopup] Failed to mark read:", e);
      }
    }
    setActive(null);
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={() => handleDismiss(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-[scaleIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-popup-title"
      >
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <h2 id="otp-popup-title" className="font-bold text-lg">
                Delivery OTP
              </h2>
            </div>
            <button
              onClick={() => handleDismiss(false)}
              aria-label="Close"
              className="w-8 h-8 -mr-2 -mt-1 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-emerald-50 mt-2">
            Show this code to the delivery person to confirm receipt of your order.
          </p>
        </div>

        <div className="px-6 py-6 text-center bg-emerald-50/40">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2">
            Your Code
          </div>
          <div
            className="text-5xl font-extrabold tracking-[0.4em] font-mono text-emerald-900 select-all"
            aria-label={`Delivery OTP ${active.otp.split("").join(" ")}`}
          >
            {active.otp}
          </div>
          <div className="text-xs text-slate-500 mt-3">
            Expires in{" "}
            <span className="font-bold text-slate-700">
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-100">
          <button
            onClick={() => handleDismiss(true)}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            Got it
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Do not share with anyone other than the delivery person.
          </p>
        </div>
      </div>
    </div>
  );
}
