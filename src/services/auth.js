/**
 * Authentication Service
 * @module services/auth
 */

import { auth, firebase, db } from './firebase.js';
import { state, isAdmin } from '../store.js';
import { loadSettingsFromFirestore } from './settings.js';
import { showToast } from '../utils/dom.js';
import { logError } from '../utils/errorHandler.js';

// Online presence tracking
let presenceInterval = null;
const PRESENCE_INTERVAL = 30000; // Update every 30 seconds
const ONLINE_THRESHOLD = 5 * 60 * 1000; // Consider online if active in last 5 minutes

/**
 * Update user's online presence in Firestore
 */
async function updatePresence() {
    if (!state.currentUser) return;
    
    try {
        await db.collection('presence').doc(state.currentUser.uid).set({
            userId: state.currentUser.uid,
            displayName: state.currentUser.displayName || state.currentUser.phoneNumber || 'Anonymous',
            email: state.currentUser.email || null,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'online'
        }, { merge: true });
    } catch (e) {
        // Silent fail - presence is not critical
        console.debug('Presence update failed:', e);
    }
}

/**
 * Set user as offline
 */
async function setOffline() {
    if (!state.currentUser) return;
    
    try {
        await db.collection('presence').doc(state.currentUser.uid).update({
            status: 'offline',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.debug('Set offline failed:', e);
    }
}

/**
 * Start presence tracking
 */
function startPresenceTracking() {
    // Update immediately on login
    updatePresence();
    
    // Update periodically
    presenceInterval = setInterval(updatePresence, PRESENCE_INTERVAL);
    
    // Update on page visibility change (when user returns to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updatePresence();
        }
    });
    
    // Set offline on page unload
    window.addEventListener('beforeunload', () => {
        setOffline();
    });
}

/**
 * Stop presence tracking
 */
function stopPresenceTracking() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
    setOffline();
}

/**
 * Open authentication modal
 */
export function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close authentication modal
 */
export function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = 'auto';
    }

    // Reset visual phone states
    const otpSection = document.getElementById('otpSection');
    if (otpSection) otpSection.style.display = 'none';
    
    const sendBtn = document.getElementById('sendOtpBtn');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send OTP';
    }
}

/**
 * Sign in with Google
 * @returns {Promise<void>}
 */
export async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        closeAuthModal();
        showToast('Signed in successfully!', 'success');
    } catch (err) {
        logError(err, 'signInWithGoogle', true);
    }
}

/**
 * Send OTP to phone number
 * @returns {Promise<void>}
 */
export async function sendOTP() {
    const phoneInput = document.getElementById('phoneInput');
    const phone = phoneInput?.value?.trim();
    
    if (!phone || phone.length !== 10) {
        showToast('Please enter a valid 10-digit mobile number', 'error');
        return;
    }

    const phoneNumber = '+91' + phone;
    const btn = document.getElementById('sendOtpBtn');
    
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
    }

    try {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptchaContainer', {
                'size': 'invisible',
                'callback': () => {
                    // reCAPTCHA solved
                }
            });
        }

        const confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);
        window.confirmationResult = confirmationResult;
        
        const otpSection = document.getElementById('otpSection');
        if (otpSection) otpSection.style.display = 'block';
        if (btn) btn.textContent = 'Sent ✅';
        
        showToast('OTP sent successfully', 'success');
    } catch (error) {
        logError(error, 'sendOTP');
        
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Send OTP';
        }
        
        // Reset reCAPTCHA if it fails
        if (window.recaptchaVerifier) {
            try {
                const widgetId = await window.recaptchaVerifier.render();
                grecaptcha.reset(widgetId);
            } catch (e) {
                // reCAPTCHA might not be rendered yet
            }
        }
        
        showToast('Failed to send OTP: ' + error.message, 'error');
    }
}

/**
 * Verify OTP code
 * @returns {Promise<void>}
 */
export async function verifyOTP() {
    const otpInput = document.getElementById('otpInput');
    const otp = otpInput?.value?.trim();
    
    if (!otp || otp.length !== 6) {
        showToast('Please enter a valid 6-digit OTP', 'error');
        return;
    }

    if (!window.confirmationResult) {
        showToast('Error: Please request OTP first', 'error');
        return;
    }

    const btn = document.querySelector('.otp-row button');
    if (btn) btn.disabled = true;

    try {
        await window.confirmationResult.confirm(otp);
        closeAuthModal();
        showToast('Signed in successfully!', 'success');
        
        // Reset states
        if (phoneInput) phoneInput.value = '';
        if (otpInput) otpInput.value = '';
        
        const otpSection = document.getElementById('otpSection');
        if (otpSection) otpSection.style.display = 'none';
        
        const sendBtn = document.getElementById('sendOtpBtn');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send OTP';
        }
        
        if (btn) btn.disabled = false;
    } catch (error) {
        logError(error, 'verifyOTP');
        if (btn) btn.disabled = false;
        showToast('Invalid OTP: ' + error.message, 'error');
    }
}

/**
 * Set up authentication state listener
 */
export function setupAuthListener() {
    auth.onAuthStateChanged(async user => {
        state.currentUser = user;
        
        const loginBtn = document.getElementById('loginBtn');
        const userMenu = document.getElementById('userMenu');
        const adminToggle = document.querySelector('.admin-toggle');

        if (user) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';

            // Update avatar
            const avatar = document.getElementById('userAvatar');
            if (avatar) {
                const initial = (user.displayName || user.phoneNumber || 'U')[0].toUpperCase();
                avatar.src = user.photoURL || `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23059669"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="45">${initial}</text></svg>`;
                avatar.alt = (user.displayName || 'U')[0];
            }

            // Update user info display
            const uName = document.getElementById('userName');
            if (uName) uName.textContent = user.displayName || user.phoneNumber || 'User';

            const uEmail = document.getElementById('userEmail');
            if (uEmail) uEmail.textContent = user.email || user.phoneNumber || '';

            // Pre-fill form
            const nameInput = document.getElementById('customerName');
            const phoneInput = document.getElementById('customerPhone');
            if (nameInput && user.displayName) nameInput.value = user.displayName;
            if (phoneInput && user.phoneNumber) phoneInput.value = user.phoneNumber.replace('+91', '');

            // Check Firebase Custom Claims for admin
            try {
                const tokenResult = await user.getIdTokenResult();
                state.isAdminClaim = tokenResult.claims.admin === true;
            } catch (e) {
                state.isAdminClaim = false;
            }

            // Show/hide Admin button
            if (adminToggle) adminToggle.style.display = isAdmin() ? 'flex' : 'none';
            
            // Start tracking online presence
            startPresenceTracking();
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (userMenu) userMenu.style.display = 'none';
            state.isAdminClaim = false;
            if (adminToggle) adminToggle.style.display = 'none';
            
            // Stop presence tracking
            stopPresenceTracking();
        }

        // ALWAYS LOAD SETTINGS REGARDLESS OF AUTH STATUS TO FIX PRICING
        if (!state.settingsLoaded) {
            loadSettingsFromFirestore();
            state.settingsLoaded = true;
        }
    });
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
    try {
        // Set offline before signing out
        await setOffline();
        await auth.signOut();
        showToast('Signed out', 'info');
        window.location.reload();
    } catch (error) {
        logError(error, 'signOutUser', true);
    }
}

/**
 * Get current user
 * @returns {import('../types/index.js').User|null}
 */
export function getCurrentUser() {
    return state.currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return !!state.currentUser;
}
