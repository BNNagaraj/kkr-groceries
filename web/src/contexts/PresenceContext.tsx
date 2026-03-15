"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PresenceDoc {
  uid: string;
  userId?: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  lastSeen: Timestamp | null;
  online?: boolean;
  status?: string;
  isDelivery?: boolean;
  role?: string;
  lat?: number;
  lng?: number;
}

interface PresenceContextValue {
  /** All presence docs (raw, unfiltered) */
  presenceList: PresenceDoc[];
  /** Delivery-role users who are online (seen within last 2 minutes) */
  onlineDeliveryBoys: PresenceDoc[];
  /** True until the first snapshot arrives */
  isLoading: boolean;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [presenceList, setPresenceList] = useState<PresenceDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "presence"),
      (snap) => {
        const docs: PresenceDoc[] = snap.docs.map((d) => {
          const data = d.data() as PresenceDoc;
          return { ...data, uid: data.uid || data.userId || d.id };
        });
        setPresenceList(docs);
        setIsLoading(false);
      },
      (err) => {
        console.warn("[PresenceContext] Listener error:", err.message);
        setIsLoading(false);
      }
    );
    return unsub;
  }, []);

  const onlineDeliveryBoys = useMemo(() => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    return presenceList.filter((p) => {
      const isDelivery = p.isDelivery || p.role === "delivery";
      if (!isDelivery) return false;
      const isMarkedOnline = p.online === true || p.status === "online";
      if (!isMarkedOnline) return false;
      const lastSeenMs = p.lastSeen && typeof p.lastSeen.toMillis === "function"
        ? p.lastSeen.toMillis()
        : 0;
      return lastSeenMs > twoMinutesAgo;
    });
  }, [presenceList]);

  const value = useMemo<PresenceContextValue>(
    () => ({ presenceList, onlineDeliveryBoys, isLoading }),
    [presenceList, onlineDeliveryBoys, isLoading]
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePresenceData(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error("usePresenceData must be used inside <PresenceProvider>");
  }
  return ctx;
}
