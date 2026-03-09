/**
 * Second Firebase project (kkr-groceries-02-otp) — used exclusively for
 * delivery OTP SMS via Firebase Phone Auth.
 *
 * Isolated from the main project so Phone Auth ghost UIDs don't collide
 * with real buyer accounts.
 *
 * Lazy-initialized: getAuth() is only called when getOtpAuth() is first
 * invoked, avoiding unnecessary reCAPTCHA config fetches on every page load.
 *
 * On localhost (dev mode), appVerificationDisabledForTesting is enabled
 * because Firebase reCAPTCHA does not support localhost domains.
 * Use test phone numbers in Firebase Console for local testing.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const otpFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_OTP_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_OTP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_OTP_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_OTP_FIREBASE_APP_ID,
};

let _otpApp: FirebaseApp | null = null;
let _otpAuth: Auth | null = null;

/** Check if OTP Firebase config is properly set (env vars present) */
export function isOtpConfigValid(): boolean {
    return !!(
        otpFirebaseConfig.apiKey &&
        otpFirebaseConfig.authDomain &&
        otpFirebaseConfig.projectId &&
        otpFirebaseConfig.appId
    );
}

function getOtpApp(): FirebaseApp {
    if (!_otpApp) {
        if (!isOtpConfigValid()) {
            throw new Error(
                "OTP Firebase config missing. Set NEXT_PUBLIC_OTP_FIREBASE_* env vars and rebuild."
            );
        }
        _otpApp =
            getApps().find((a) => a.name === "otp") ||
            initializeApp(otpFirebaseConfig, "otp");
    }
    return _otpApp;
}

/**
 * Returns the Auth instance for the OTP project.
 * Lazily initializes on first call to avoid reCAPTCHA prefetch errors
 * when Phone Auth isn't yet enabled on the project.
 *
 * On localhost, disables app verification (reCAPTCHA) since Firebase
 * does not support reCAPTCHA on localhost. Use test phone numbers
 * configured in Firebase Console for local development.
 */
export function getOtpAuth(): Auth {
    if (!_otpAuth) {
        _otpAuth = getAuth(getOtpApp());

        // Firebase reCAPTCHA does not work on localhost — disable for dev
        if (typeof window !== "undefined" && window.location.hostname === "localhost") {
            _otpAuth.settings.appVerificationDisabledForTesting = true;
        }
    }
    return _otpAuth;
}
