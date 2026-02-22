import { auth, firebase } from './firebase.js';
import { state, isAdmin } from '../store.js';
import { loadSettingsFromFirestore } from './settings.js';
import { showToast } from '../utils/dom.js';

export function openAuthModal() {
    document.getElementById('authModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

export function closeAuthModal() {
    document.getElementById('authModal').classList.remove('open');
    document.body.style.overflow = 'auto';
}

export function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(() => {
        closeAuthModal();
        showToast('Signed in successfully!', 'success');
    }).catch(err => {
        console.error(err);
        showToast('Sign in failed: ' + err.message, 'error');
    });
}

export function setupAuthListener() {
    auth.onAuthStateChanged(async user => {
        state.currentUser = user;
        const loginBtn = document.getElementById('loginBtn');
        const userMenu = document.getElementById('userMenu');
        const adminToggle = document.querySelector('.admin-toggle');

        if (user) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';

            const avatar = document.getElementById('userAvatar');
            if (avatar) {
                avatar.src = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23059669"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="45">' + (user.displayName || user.phoneNumber || 'U')[0].toUpperCase() + '</text></svg>';
                avatar.alt = (user.displayName || 'U')[0];
            }

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

            // Show/hide Admin button based on claims
            if (adminToggle) adminToggle.style.display = isAdmin() ? 'flex' : 'none';

            // Load Firestore settings
            loadSettingsFromFirestore();
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (userMenu) userMenu.style.display = 'none';
            state.isAdminClaim = false;
            if (adminToggle) adminToggle.style.display = 'none';
        }
    });
}

export function signOutUser() {
    auth.signOut().then(() => {
        showToast('Signed out', 'info');
        window.location.reload();
    });
}
