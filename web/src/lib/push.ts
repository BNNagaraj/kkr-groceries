"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, setDoc, deleteField } from "firebase/firestore";
import { app, db } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

/**
 * Register this device for push notifications and store the FCM token on
 * presence/{uid} so Cloud Functions can target it on new assignments.
 *
 * No-op (returns null) unless:
 *   - NEXT_PUBLIC_FCM_VAPID_KEY is configured (generate in Firebase Console →
 *     Project Settings → Cloud Messaging → Web Push certificates),
 *   - the browser supports the FCM Web SDK + service workers, and
 *   - the user grants notification permission.
 *
 * Safe to call on every mount — it re-resolves the (possibly rotated) token
 * and merges it in idempotently.
 */
export async function registerPushToken(uid: string): Promise<string | null> {
  try {
    if (!VAPID_KEY || !uid || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }
    if (!(await isSupported())) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await setDoc(
      doc(db, "presence", uid),
      { fcmToken: token, fcmUpdatedAt: Date.now() },
      { merge: true }
    );
    return token;
  } catch (e) {
    // Push is a best-effort enhancement — never break the console over it.
    console.warn("[push] registration skipped:", e);
    return null;
  }
}

/** Clear the stored token (e.g. on sign-out) so a signed-out device stops
 *  receiving assignment pushes. Best-effort. */
export async function clearPushToken(uid: string): Promise<void> {
  try {
    if (!uid) return;
    await setDoc(doc(db, "presence", uid), { fcmToken: deleteField() }, { merge: true });
  } catch {
    /* ignore */
  }
}
