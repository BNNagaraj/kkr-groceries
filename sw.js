/**
 * KKR Groceries Service Worker
 * Provides offline support, caching, and background sync
 */

const CACHE_VERSION = 'v2'; // Update this when making significant changes
const CACHE_NAME = `kkr-groceries-${CACHE_VERSION}-${new Date().toISOString().slice(0,10)}`;
const STATIC_ASSETS = [
    '/index.html',
    '/manifest.json',
    '/src/main.js',
    '/src/store.js',
    '/src/styles/app.css',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Noto+Sans+Telugu:wght@400;700&display=swap'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).catch(err => {
            console.error('[SW] Cache failed:', err);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => {
                        console.log('[SW] Deleting old cache:', k);
                        return caches.delete(k);
                    })
            );
        }).then(() => {
            console.log('[SW] Activated');
            return self.clients.claim();
        })
    );
});

// Helper: Check if request is for Firebase
function isFirebaseRequest(url) {
    return url.includes('googleapis.com') || 
           url.includes('firebase') || 
           url.includes('gstatic.com');
}

// Helper: Check if request is for an image
function isImageRequest(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip Firebase requests - let them go directly
    if (isFirebaseRequest(url.href)) {
        return;
    }
    
    // Skip non-GET requests (POST, PUT, DELETE, etc.)
    // Cache API only supports GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Navigation requests - Network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        if (cached) return cached;
                        // Return offline page if available
                        return caches.match('/index.html');
                    });
                })
        );
        return;
    }

    // Image requests - Cache first with fallback
    if (isImageRequest(url.href)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Return a fallback image or placeholder
                    return new Response('Image not available', {
                        status: 404,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
        );
        return;
    }

    // API requests (non-Firebase) - Network first
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                    });
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Default: Cache first
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });
                }
                return response;
            });
        })
    );
});

// Background Sync: Queue failed orders
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event:', event.tag);
    
    if (event.tag === 'sync-orders') {
        event.waitUntil(syncPendingOrders());
    }
});

// Push Notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'New notification from KKR Groceries',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || false,
        data: data.data || {}
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || 'KKR Groceries',
            options
        )
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notificationData = event.notification.data;
    let url = '/';

    if (notificationData.orderId) {
        url = `/order/${notificationData.orderId}`;
    } else if (notificationData.type === 'admin') {
        url = '/#admin/orders';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

/**
 * Sync pending orders from IndexedDB
 */
async function syncPendingOrders() {
    try {
        const pendingOrders = await getPendingOrders();
        
        for (const order of pendingOrders) {
            try {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });

                if (response.ok) {
                    await removePendingOrder(order.id);
                    
                    // Notify user of successful sync
                    self.registration.showNotification('Order Synced', {
                        body: `Order ${order.id} has been submitted successfully`,
                        icon: '/icon-192x192.png'
                    });
                }
            } catch (err) {
                console.error('[SW] Failed to sync order:', order.id, err);
            }
        }
    } catch (err) {
        console.error('[SW] Error in syncPendingOrders:', err);
    }
}

/**
 * Get pending orders from IndexedDB
 * @returns {Promise<Array>}
 */
function getPendingOrders() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('KKR_Groceries_DB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('pendingOrders', 'readonly');
            const store = tx.objectStore('pendingOrders');
            const getAll = store.getAll();
            
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => reject(getAll.error);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingOrders')) {
                db.createObjectStore('pendingOrders', { keyPath: 'id' });
            }
        };
    });
}

/**
 * Remove pending order from IndexedDB
 * @param {string} orderId
 */
function removePendingOrder(orderId) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('KKR_Groceries_DB', 1);
        
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('pendingOrders', 'readwrite');
            const store = tx.objectStore('pendingOrders');
            const del = store.delete(orderId);
            
            del.onsuccess = () => resolve();
            del.onerror = () => reject(del.error);
        };
        
        request.onerror = () => reject(request.error);
    });
}

// Message handling from client
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

console.log('[SW] Service Worker loaded');
