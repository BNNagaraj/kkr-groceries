"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { markOffline } from "@/hooks/usePresence";
import { registerPushToken, clearPushToken } from "@/lib/push";
import { Truck, LogOut, Loader2, Power, Package, CalendarDays } from "lucide-react";

const DeliveryDashboard = dynamic(() => import("@/components/delivery/DeliveryDashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading deliveries…
    </div>
  ),
});

export default function DeliveryConsolePage() {
  const { currentUser, isDelivery, loading } = useAuth();
  const router = useRouter();
  const { col } = useMode();

  const [available, setAvailable] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);
  const [stats, setStats] = useState({ today: 0, week: 0 });

  // Live availability flag from the agent's presence doc
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, "presence", currentUser.uid), (snap) => {
      if (snap.exists()) setAvailable(snap.data().available !== false);
    });
    return unsub;
  }, [currentUser]);

  // Register this device for new-assignment push notifications (no-op until a
  // VAPID key is configured — see NEXT_PUBLIC_FCM_VAPID_KEY / push.ts).
  useEffect(() => {
    if (!currentUser || !isDelivery) return;
    registerPushToken(currentUser.uid);
  }, [currentUser, isDelivery]);

  // Deliveries completed today / this week
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, col("orders")), where("deliveredBy", "==", currentUser.uid))
        );
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startWeek = new Date(startToday);
        startWeek.setDate(startToday.getDate() - 6);
        let today = 0;
        let week = 0;
        snap.docs.forEach((d) => {
          const t = (d.data().deliveredAt as { toDate?: () => Date } | undefined)?.toDate?.();
          if (!t) return;
          if (t >= startToday) today += 1;
          if (t >= startWeek) week += 1;
        });
        setStats({ today, week });
      } catch {
        /* ignore */
      }
    })();
  }, [currentUser, col]);

  const toggleAvailable = async () => {
    if (!currentUser) return;
    setSavingAvail(true);
    try {
      await setDoc(doc(db, "presence", currentUser.uid), { available: !available }, { merge: true });
    } catch {
      /* ignore */
    } finally {
      setSavingAvail(false);
    }
  };

  const handleSignOut = async () => {
    if (currentUser) {
      await clearPushToken(currentUser.uid);
      await markOffline(currentUser.uid);
    }
    const { auth } = await import("@/lib/firebase");
    await auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!currentUser || !isDelivery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <Truck className="w-12 h-12 text-slate-300 mb-3" />
        <h1 className="text-lg font-bold text-slate-700">Delivery access required</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          This console is for KKR delivery agents. If you&apos;re an agent, sign in with your registered number.
        </p>
        <Link href="/" className="mt-4 text-emerald-700 font-semibold hover:underline text-sm">
          ← Back to store
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-blue-700 text-white shadow-md">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <span className="font-bold text-lg">Delivery Console</span>
          </div>
          <button
            onClick={handleSignOut}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{currentUser.displayName || "Delivery Agent"}</div>
            <div className="text-blue-200 text-xs truncate">{currentUser.phoneNumber || currentUser.email}</div>
          </div>
          <button
            onClick={toggleAvailable}
            disabled={savingAvail}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-60 ${
              available ? "bg-emerald-500 text-white" : "bg-white/15 text-white"
            }`}
          >
            {savingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            {available ? "Online" : "Offline"}
          </button>
        </div>
      </header>

      {/* Stats strip */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-800 leading-none">{stats.today}</div>
            <div className="text-xs text-slate-500 mt-0.5">Delivered today</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-800 leading-none">{stats.week}</div>
            <div className="text-xs text-slate-500 mt-0.5">Last 7 days</div>
          </div>
        </div>
      </div>

      {!available && (
        <div className="mx-4 mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          You&apos;re <strong>offline</strong> — you won&apos;t receive new auto-assignments. You can still complete your current deliveries.
        </div>
      )}

      {/* Deliveries */}
      <main className="flex-1 px-4 py-4">
        <DeliveryDashboard />
      </main>
    </div>
  );
}
