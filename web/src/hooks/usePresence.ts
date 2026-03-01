"use client";

import { useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

export function usePresence(user: User | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const presenceRef = doc(db, "presence", user.uid);

    const writePresence = async (online: boolean) => {
      try {
        await setDoc(
          presenceRef,
          {
            uid: user.uid,
            userId: user.uid, // backward compat with old schema
            displayName: user.displayName || null,
            email: user.email || null,
            phone: user.phoneNumber || null,
            lastSeen: serverTimestamp(),
            online,
            status: online ? "online" : "offline", // backward compat with old schema
          },
          { merge: true }
        );
      } catch (e) {
        // Silently fail — presence is non-critical
        console.debug("[Presence] write failed:", e);
      }
    };

    // Mark online immediately
    writePresence(true);

    // Heartbeat
    intervalRef.current = setInterval(() => {
      writePresence(true);
    }, HEARTBEAT_INTERVAL_MS);

    // On page close, try to mark offline
    const handleUnload = () => {
      // Use sendBeacon-style approach: fire-and-forget
      writePresence(false);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", handleUnload);
      writePresence(false);
    };
  }, [user]);
}
