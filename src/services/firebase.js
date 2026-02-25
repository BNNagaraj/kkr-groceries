/**
 * Firebase Configuration and Initialization
 * @module services/firebase
 */

/** @type {Object} Firebase configuration object */
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Assuming global firebase from CDN in index.html
if (!window.firebase.apps.length) {
    window.firebase.initializeApp(firebaseConfig);
}

/** @type {import('firebase/auth').Auth} Authentication instance */
export const auth = window.firebase.auth();

/** @type {import('firebase/firestore').Firestore} Firestore database instance */
export const db = window.firebase.firestore();

/** @type {import('firebase/functions').Functions} Cloud Functions instance */
export const functions = window.firebase.functions();

/** @type {import('firebase/storage').Storage} Storage instance */
export const storage = window.firebase.storage();

/** @type {import('firebase/app').FirebaseApp} Firebase app instance */
export const firebase = window.firebase;

/**
 * Check if Firebase is properly initialized
 * @returns {boolean}
 */
export function isFirebaseReady() {
    return !!(auth && db && functions && storage);
}

/**
 * Get Firebase error message
 * @param {Error} error - Firebase error object
 * @returns {string} User-friendly error message
 */
export function getFirebaseErrorMessage(error) {
    const code = error?.code || '';
    const messages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account already exists with this email.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'permission-denied': 'You do not have permission to perform this action.',
        'not-found': 'The requested item was not found.',
        'already-exists': 'This item already exists.',
        'resource-exhausted': 'Quota exceeded. Please try again later.',
        'failed-precondition': 'Operation failed. Please check your settings.',
        'unavailable': 'Service temporarily unavailable. Please try again.',
        'deadline-exceeded': 'Request timed out. Please try again.',
        'cancelled': 'Operation was cancelled.',
        'data-loss': 'Data loss detected. Please contact support.',
        'unauthenticated': 'Please sign in to continue.'
    };
    return messages[code] || error?.message || 'An unexpected error occurred.';
}
