/**
 * Push Notification Service
 * Handles browser push notifications and in-app notifications
 * @module services/notifications
 */

import { db, firebase } from './firebase.js';
import { logError } from '../utils/errorHandler.js';
import { state } from '../store.js';

// VAPID key for web push (public key).
// Prefer env-configured key and fall back to existing value for backward compatibility.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    'BN2ZK9oUMQ2NN9mIDb-bFD6kUAtJSQKNkRcag5znq2o-rZkRpD2sU03i291DuYueXSjlAN-sNili7aCWW_ZNVD8';

// Notification state
let messaging = null;
let notificationsEnabled = false;
let inAppNotifications = [];
let fcmToken = null;
let messagingInitPromise = null;
const IS_LOCAL_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Check if Firebase Messaging is supported (handles sync/async SDK variants)
 * @returns {Promise<boolean>}
 */
async function isMessagingSupported() {
    if (!firebase.messaging || typeof firebase.messaging.isSupported !== 'function') {
        return false;
    }

    try {
        const supported = firebase.messaging.isSupported();
        return typeof supported === 'boolean' ? supported : await supported;
    } catch (_) {
        return false;
    }
}

/**
 * Get FCM token (for use in other modules)
 * @returns {string|null}
 */
export function getFCMToken() {
    return fcmToken;
}

/**
 * Initialize Firebase Cloud Messaging (if available)
 */
export async function initMessaging() {
    if (messaging) return true;
    if (messagingInitPromise) return messagingInitPromise;

    messagingInitPromise = (async () => {
        if (!VAPID_KEY) {
            console.warn('[Notifications] Missing VAPID key. Push notifications are disabled.');
            return false;
        }

        const supported = await isMessagingSupported();
        if (!supported) {
            if (IS_LOCAL_DEV) {
                console.debug('[Notifications] Push messaging unavailable in this browser/runtime');
            }
            return false;
        }

        try {
            messaging = firebase.messaging();

            // Handle foreground messages
            messaging.onMessage((payload) => {
                console.log('[Notifications] Foreground message received:', payload);
                const notification = payload?.notification || {
                    title: payload?.data?.title || 'KKR Groceries',
                    body: payload?.data?.body || 'You have a new update'
                };
                showInAppNotification(notification);
            });

            return true;
        } catch (e) {
            console.warn('[Notifications] Failed to initialize messaging:', e.message);
            return false;
        }
    })();

    return messagingInitPromise;
}

/**
 * Request notification permission and get FCM token
 * @returns {Promise<boolean>}
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('[Notifications] Browser does not support notifications');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';

        if (!notificationsEnabled) {
            return false;
        }

        // Ensure messaging is initialized for this runtime/browser
        if (!messaging) {
            await initMessaging();
        }

        if (!messaging) {
            notificationsEnabled = false;
            console.warn('[Notifications] Permission granted, but push messaging is unavailable in this browser.');
            return false;
        }

        // Get FCM token with VAPID key
        const token = await messaging.getToken({ vapidKey: VAPID_KEY });
        if (token) {
            fcmToken = token;
            console.log('[Notifications] FCM Token obtained:', token.substring(0, 20) + '...');
            // Save token via Cloud Function
            await saveFCMToken(token);
        }

        // Handle token refresh (legacy compat SDKs only)
        if (typeof messaging.onTokenRefresh === 'function') {
            messaging.onTokenRefresh(async () => {
                try {
                    const newToken = await messaging.getToken({ vapidKey: VAPID_KEY });
                    fcmToken = newToken;
                    await saveFCMToken(newToken);
                    console.log('[Notifications] FCM token refreshed');
                } catch (e) {
                    console.warn('[Notifications] Token refresh failed:', e.message);
                }
            });
        }

        return notificationsEnabled;
    } catch (e) {
        notificationsEnabled = false;
        logError(e, 'requestNotificationPermission');
        return false;
    }
}

/**
 * Save FCM token via Cloud Function
 * @param {string} token - FCM token
 */
async function saveFCMToken(token) {
    if (!state.currentUser) return;

    try {
        // Use callable function to register token
        const registerToken = firebase.functions().httpsCallable('registerFCMToken');
        await registerToken({ token, platform: 'web' });
        console.log('[Notifications] FCM token registered successfully');
    } catch (e) {
        console.warn('[Notifications] Failed to save FCM token:', e.message);
        // Fallback: save directly to Firestore
        try {
            await db.collection('users').doc(state.currentUser.uid).collection('tokens').doc('fcm').set({
                token,
                platform: 'web',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                active: true
            });
        } catch (e2) {
            console.warn('[Notifications] Firestore fallback also failed:', e2.message);
        }
    }
}

/**
 * Show in-app notification (toast-style)
 * @param {Object} notification - Notification data
 */
export function showInAppNotification(notification) {
    const title = notification?.title || 'Notification';
    const body = notification?.body || notification?.message || '';
    const icon = notification?.icon;

    // Create notification element
    const el = document.createElement('div');
    el.className = 'in-app-notification';
    el.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 16px;
        max-width: 360px;
        z-index: 10000;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        animation: slideInRight 0.3s ease;
        border-left: 4px solid #059669;
    `;

    if (icon) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        img.style.cssText = 'width:40px;height:40px;border-radius:8px;flex-shrink:0';
        el.appendChild(img);
    } else {
        const iconBox = document.createElement('div');
        iconBox.style.cssText = 'width:40px;height:40px;border-radius:8px;background:#059669;color:white;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0';
        iconBox.textContent = 'N';
        el.appendChild(iconBox);
    }

    const content = document.createElement('div');
    content.style.cssText = 'flex:1;min-width:0';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight:600;color:#1e293b;font-size:0.95rem;margin-bottom:4px';
    titleEl.textContent = title;
    content.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.style.cssText = 'color:#64748b;font-size:0.85rem;line-height:1.4';
    bodyEl.textContent = body;
    content.appendChild(bodyEl);
    el.appendChild(content);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.2rem;padding:0;line-height:1';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => el.remove());
    el.appendChild(closeBtn);

    document.body.appendChild(el);

    // Add animation styles if not present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .in-app-notification.removing {
                animation: slideOutRight 0.3s ease forwards;
            }
        `;
        document.head.appendChild(style);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (el.parentElement) {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }
    }, 5000);

    // Play notification sound (optional)
    playNotificationSound();
}

/**
 * Play notification sound
 */
function playNotificationSound() {
    // Create a subtle notification sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // Silent fail - sound is not critical
    }
}

/**
 * Send order notification to admin
 * @param {string} orderId - Order ID
 * @param {Object} orderData - Order data
 */
export async function notifyAdminNewOrder(orderId, orderData) {
    try {
        const title = 'New Order Received';
        const message = `${orderData.customerName || 'Customer'} placed order ${orderId} (${orderData.totalValue || ''})`;

        // Store notification in Firestore for cloud function to process
        await db.collection('notifications').add({
            type: 'newOrder',
            title,
            message,
            orderId,
            orderData: {
                customerName: orderData.customerName,
                totalValue: orderData.totalValue,
                productCount: orderData.productCount
            },
            targetRole: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            processed: false
        });
    } catch (e) {
        console.warn('[Notifications] Failed to send admin notification:', e.message);
    }
}

/**
 * Send push notification directly via Cloud Function
 * @param {string} userId - Target user ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 */
export async function sendPushNotification(userId, title, body, data = {}) {
    if (!userId) return;
    
    try {
        const sendNotification = firebase.functions().httpsCallable('sendPushNotification');
        const result = await sendNotification({ userId, title, body, data });
        console.log('[Notifications] Push notification sent:', result.data);
        return result.data;
    } catch (e) {
        console.warn('[Notifications] Failed to send push notification:', e.message);
        return null;
    }
}

/**
 * Send order status notification to buyer
 * @param {string} userId - Buyer user ID
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
export async function notifyBuyerOrderStatus(userId, orderId, status) {
    if (!userId) return;

    const statusMessages = {
        'Accepted': 'Your order has been accepted! ðŸŽ‰',
        'Fulfilled': 'Your order has been delivered! ðŸšš',
        'Rejected': 'Your order could not be processed âŒ'
    };
    
    const title = 'Order Update';
    const body = statusMessages[status] || `Order status: ${status}`;

    try {
        // Create notification document
        await db.collection('notifications').add({
            type: 'orderStatus',
            orderId,
            status,
            message: body,
            userId,
            targetRole: 'buyer',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        // Also send push notification directly
        await sendPushNotification(userId, title, body, {
            type: 'orderStatus',
            orderId,
            status
        });
    } catch (e) {
        console.warn('[Notifications] Failed to send buyer notification:', e.message);
    }
}

/**
 * Send order modification notification to buyer
 * @param {string} userId - Buyer user ID
 * @param {string} orderId - Order ID
 * @param {Array} changes - List of changes
 */
export async function notifyBuyerModification(userId, orderId, changes) {
    if (!userId) return;

    const title = 'Order Modification Request';
    const body = `Your order ${orderId} has modifications pending your approval`;

    try {
        // Create notification document
        await db.collection('notifications').add({
            type: 'orderModification',
            orderId,
            changes,
            message: body,
            userId,
            targetRole: 'buyer',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        // Also send push notification directly
        await sendPushNotification(userId, title, body, {
            type: 'orderModification',
            orderId,
            requireInteraction: 'true'
        });
    } catch (e) {
        console.warn('[Notifications] Failed to send modification notification:', e.message);
    }
}

/**
 * Get unread notifications for current user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
export async function getUnreadNotifications(userId) {
    if (!userId) return [];

    try {
        const snap = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('[Notifications] Failed to get unread notifications:', e.message);
        return [];
    }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 */
export async function markNotificationRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('[Notifications] Failed to mark notification as read:', e.message);
    }
}

/**
 * Show notification bell/badge with unread count
 * @param {number} count - Unread count
 */
export function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Check if notifications are enabled
 * @returns {boolean}
 */
export function areNotificationsEnabled() {
    return notificationsEnabled;
}

// Initialize on module load
if (typeof window !== 'undefined') {
    initMessaging().catch(() => {});
}

/**
 * UI handler for requesting notification permission
 * Call this from a button click to enable notifications
 */
export async function requestNotificationPermissionUI() {
    try {
        if (!('Notification' in window)) {
            if (window.showToast) {
                window.showToast('This browser does not support notifications.', 'error');
            }
            updateNotificationButton(false);
            return false;
        }

        const pushSupported = await initMessaging();
        if (!pushSupported) {
            if (window.showToast) {
                window.showToast('Push notifications are not supported in this browser.', 'info');
            }
            updateNotificationButton(false);
            return false;
        }

        // Check if already granted
        if (Notification.permission === 'granted') {
            if (window.showToast) {
                window.showToast('Notifications already enabled!', 'success');
            }
            updateNotificationButton(true);
            return true;
        }

        // Check if denied
        if (Notification.permission === 'denied') {
            if (window.showToast) {
                window.showToast('Notifications blocked. Please enable in browser settings.', 'error');
            }
            updateNotificationButton(false);
            return false;
        }

        // Request permission
        const granted = await requestNotificationPermission();

        if (granted) {
            if (window.showToast) {
                window.showToast('ðŸŽ‰ Notifications enabled! You\'ll receive updates about your orders.', 'success');
            }
            updateNotificationButton(true);
        } else {
            if (window.showToast) {
                window.showToast('Notifications not enabled. You can enable them later from settings.', 'info');
            }
            updateNotificationButton(false);
        }

        return granted;
    } catch (e) {
        console.error('[Notifications] Error requesting permission:', e);
        if (window.showToast) {
            window.showToast('Failed to enable notifications', 'error');
        }
        return false;
    }
}

/**
 * Update notification button state
 */
function updateNotificationButton(enabled) {
    const btn = document.getElementById('notificationToggleBtn');
    if (btn) {
        if (enabled) {
            btn.textContent = 'ðŸ”” Notifications Enabled';
            btn.style.color = '#059669';
        } else {
            btn.textContent = 'ðŸ”” Enable Notifications';
            btn.style.color = '';
        }
    }
}

/**
 * Check and update notification button on page load
 */
export function checkNotificationStatus() {
    if (!('Notification' in window)) {
        updateNotificationButton(false);
        return false;
    }

    initMessaging()
        .then((pushSupported) => {
            updateNotificationButton(Notification.permission === 'granted' && pushSupported);
        })
        .catch(() => {
            updateNotificationButton(false);
        });

    return Notification.permission === 'granted';
}

// Expose to window
if (typeof window !== 'undefined') {
    window.requestNotificationPermissionUI = requestNotificationPermissionUI;
    window.checkNotificationStatus = checkNotificationStatus;
    window.showInAppNotification = showInAppNotification;
}


