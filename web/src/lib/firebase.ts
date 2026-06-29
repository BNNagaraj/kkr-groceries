import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
export const db = getFirestore(app);
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
