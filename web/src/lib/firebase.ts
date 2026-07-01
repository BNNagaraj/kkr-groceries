import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    type Firestore,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only once
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// ── Firestore with offline persistence ──
// In the browser we enable IndexedDB-backed persistent cache so delivery agents
// (and buyers) can view previously-loaded orders/products even on flaky mobile
// networks, and queued reads resolve from cache when offline. On the server
// (static export / build) IndexedDB is unavailable, so fall back to plain init.
function initDb(): Firestore {
    if (typeof window === "undefined") return getFirestore(app);
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
    } catch {
        // Already initialized (hot reload) or persistence unsupported → reuse default.
        return getFirestore(app);
    }
}

export const db = initDb();
export const functions = getFunctions(app);
export const functionsAsia = getFunctions(app, "asia-south1");
export const storage = getStorage(app);

// ── App Check (guarded) ──
// Protects Cloud Functions/Firestore from non-app clients. Inert until a
// reCAPTCHA v3 site key is provided via NEXT_PUBLIC_APPCHECK_RECAPTCHA_KEY.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_APPCHECK_RECAPTCHA_KEY) {
    import("firebase/app-check").then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
        try {
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_APPCHECK_RECAPTCHA_KEY as string),
                isTokenAutoRefreshEnabled: true,
            });
        } catch {
            /* already initialized */
        }
    }).catch(() => { /* app-check unavailable */ });
}

// ── Analytics (guarded) ──
// Browser-only; inert until a measurementId is present in the Firebase config.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
        isSupported().then((ok) => { if (ok) { try { getAnalytics(app); } catch { /* ignore */ } } });
    }).catch(() => { /* analytics unavailable */ });
}
