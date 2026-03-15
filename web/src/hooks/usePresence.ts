"use client";

import { useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Mark a user offline in Firestore.
 * Exported so sign-out handlers can call it explicitly before auth.signOut().
 */
export async function markOffline(uid: string): Promise<void> {
  try {
    const presenceRef = doc(db, "presence", uid);
    await updateDoc(presenceRef, {
      online: false,
      status: "offline",
      lastSeen: serverTimestamp(),
    });
  } catch (e) {
    console.debug("[Presence] markOffline failed:", e);
  }
}

export function usePresence(user: User | null, role?: "delivery") {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to the current uid so beforeunload can access it synchronously
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      uidRef.current = null;
      return;
    }

    uidRef.current = user.uid;
    const presenceRef = doc(db, "presence", user.uid);
    const isDelivery = role === "delivery";

    const writeOnline = async () => {
      try {
        const data: Record<string, unknown> = {
          uid: user.uid,
          userId: user.uid,
          displayName: user.displayName || null,
          email: user.email || null,
          phone: user.phoneNumber || null,
          lastSeen: serverTimestamp(),
          online: true,
          status: "online",
          isDelivery,
        };

        // For delivery boys, capture GPS coordinates (passive — only on heartbeat)
        if (isDelivery && typeof navigator !== "undefined" && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000,
              });
            });
            data.lat = pos.coords.latitude;
            data.lng = pos.coords.longitude;
          } catch {
            // Geolocation denied or unavailable — continue without coordinates
          }
        }

        await setDoc(presenceRef, data, { merge: true });
      } catch (e) {
        console.debug("[Presence] write failed:", e);
      }
    };

    // Mark online immediately
    writeOnline();

    // Heartbeat every 60s
    intervalRef.current = setInterval(writeOnline, HEARTBEAT_INTERVAL_MS);

    // On tab/window close — use visibilitychange (more reliable than beforeunload)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && uidRef.current) {
        // navigator.sendBeacon is not available for Firestore, so fire-and-forget
        markOffline(uidRef.current);
      } else if (document.visibilityState === "visible" && uidRef.current) {
        // User came back — re-mark online
        writeOnline();
      }
    };

    const handleBeforeUnload = () => {
      if (uidRef.current) {
        markOffline(uidRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Effect cleanup (runs on sign-out when user changes to null)
      if (uidRef.current) {
        markOffline(uidRef.current);
      }
    };
  }, [user, role]);
}
