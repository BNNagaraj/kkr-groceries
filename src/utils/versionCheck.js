/**
 * Version Check Utility
 * Detects when a new version of the app is deployed and notifies users
 */

const APP_VERSION = __APP_VERSION__; // Injected at build time
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

let updateCallback = null;
let checkInterval = null;

/**
 * Initialize version checking
 * @param {Function} onUpdate - Callback when update is available
 */
export function initVersionCheck(onUpdate) {
    updateCallback = onUpdate;
    
    // Check immediately on load
    checkForUpdates();
    
    // Periodic checks
    checkInterval = setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
    
    // Check when app becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkForUpdates();
        }
    });
}

/**
 * Check if a new version is available
 */
async function checkForUpdates() {
    try {
        // Add cache-busting query param
        const response = await fetch(`/version.json?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;
        
        if (serverVersion && serverVersion !== APP_VERSION) {
            console.log(`[Version Check] Update available: ${APP_VERSION} → ${serverVersion}`);
            if (updateCallback) {
                updateCallback(serverVersion, APP_VERSION);
            }
        }
    } catch (error) {
        // Silently fail - don't break the app
        console.debug('[Version Check] Failed to check:', error);
    }
}

/**
 * Force reload the page
 */
export function reloadPage() {
    // Clear service worker cache if exists
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    // Hard reload
    window.location.reload(true);
}

/**
 * Stop version checking
 */
export function stopVersionCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

/**
 * Get current app version
 */
export function getCurrentVersion() {
    return APP_VERSION;
}

// Check for Service Worker updates
export function initServiceWorkerUpdateCheck(onUpdate) {
    if (!('serviceWorker' in navigator)) return;
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] New service worker activated');
        if (onUpdate) onUpdate();
    });
    
    // Check for waiting SW
    navigator.serviceWorker.register('/sw.js').then(registration => {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[SW] New version waiting');
                    if (onUpdate) onUpdate();
                }
            });
        });
    });
}
