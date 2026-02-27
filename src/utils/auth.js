/**
 * Authentication Utilities
 * @module utils/auth
 */

import { auth } from '../services/firebase.js';

/**
 * Force refresh the user's ID token
 * This is needed after admin claims are updated
 * @returns {Promise<boolean>}
 */
export async function refreshAuthToken() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('No user logged in');
            return false;
        }
        
        // Force token refresh
        await user.getIdToken(true);
        console.log('Auth token refreshed');
        return true;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        return false;
    }
}

/**
 * Check if current user has admin claim
 * @returns {Promise<boolean>}
 */
export async function checkIsAdmin() {
    try {
        const user = auth.currentUser;
        if (!user) return false;
        
        const idTokenResult = await user.getIdTokenResult();
        return idTokenResult.claims.admin === true;
    } catch (error) {
        console.error('Failed to check admin status:', error);
        return false;
    }
}

/**
 * Get admin status with user-friendly messages
 * @returns {Promise<{isAdmin: boolean, message: string}>}
 */
export async function getAdminStatus() {
    try {
        const user = auth.currentUser;
        if (!user) {
            return {
                isAdmin: false,
                message: 'Not logged in'
            };
        }
        
        const idTokenResult = await user.getIdTokenResult();
        const isAdmin = idTokenResult.claims.admin === true;
        
        if (isAdmin) {
            return {
                isAdmin: true,
                message: 'You have admin access'
            };
        } else {
            // Check if email is in admin list
            const adminEmails = [
                'raju2uraju@gmail.com',
                'kanthati.chakri@gmail.com',
                'nagaraj.b@swastikinfralogics.com'
            ];
            
            if (adminEmails.includes(user.email?.toLowerCase())) {
                return {
                    isAdmin: false,
                    message: 'Admin claim not found. Please sign out and sign back in to refresh your permissions.',
                    action: 'relogin'
                };
            }
            
            return {
                isAdmin: false,
                message: 'You do not have admin access'
            };
        }
    } catch (error) {
        return {
            isAdmin: false,
            message: 'Error checking admin status: ' + error.message
        };
    }
}

/**
 * Sign out and redirect to login
 */
export async function signOutAndRedirect() {
    try {
        await auth.signOut();
        window.location.href = '/?message=Please sign in again to update your permissions';
    } catch (error) {
        console.error('Sign out failed:', error);
        window.location.reload();
    }
}
