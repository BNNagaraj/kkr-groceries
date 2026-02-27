/**
 * Global State Management with Pub-Sub Pattern
 * Provides reactive state management with event subscription
 */

import { logError } from './utils/errorHandler.js';

/**
 * Subscription callback type
 * @typedef {Function} Subscriber
 * @param {*} newValue - New state value
 * @param {*} oldValue - Previous state value
 * @param {string} key - State key that changed
 */

/**
 * Store class implementing pub-sub pattern
 */
class Store {
    constructor() {
        /** @type {Object} Internal state object */
        this._state = {
            cart: {},
            currentCategory: 'all',
            searchTerm: '',
            currentUser: null,
            confirmationResult: null,
            commissionPercent: 15,
            apmcPrices: null,
            selectedApmcMarket: 'Bowenpally',
            isAdminClaim: false,
            enableOrderRequests: true,
            minOrderValue: 0,
            geofenceRadiusKm: 50,
            settingsLoaded: false
        };

        /** @type {Map<string, Set<Subscriber>>} Subscribers map */
        this._subscribers = new Map();

        /** @type {Map<string, Set<Subscriber>>} Subscribers for any key change */
        this._globalSubscribers = new Set();

        // Create reactive proxy
        this.state = new Proxy(this._state, {
            set: (target, key, value) => {
                const oldValue = target[key];
                target[key] = value;
                this._notify(key, value, oldValue);
                return true;
            },
            get: (target, key) => target[key]
        });
    }

    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch (use '*' for all changes)
     * @param {Subscriber} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (key === '*') {
            this._globalSubscribers.add(callback);
            return () => this._globalSubscribers.delete(callback);
        }

        if (!this._subscribers.has(key)) {
            this._subscribers.set(key, new Set());
        }
        this._subscribers.get(key).add(callback);

        // Return unsubscribe function
        return () => {
            const subs = this._subscribers.get(key);
            if (subs) subs.delete(callback);
        };
    }

    /**
     * Subscribe to multiple keys
     * @param {string[]} keys - State keys to watch
     * @param {Subscriber} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeMany(keys, callback) {
        const unsubscribers = keys.map(key => this.subscribe(key, callback));
        return () => unsubscribers.forEach(fn => fn());
    }

    /**
     * Set state value (triggers notifications)
     * @param {string} key - State key
     * @param {*} value - New value
     */
    set(key, value) {
        this.state[key] = value;
    }

    /**
     * Get state value
     * @param {string} key - State key
     * @returns {*} Current value
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Get entire state (for debugging)
     * @returns {Object}
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Update multiple state properties at once
     * @param {Object} updates - Key-value pairs to update
     * @param {boolean} [notify=true] - Whether to notify subscribers
     */
    batchUpdate(updates, notify = true) {
        const oldValues = {};
        
        // Set all values first
        Object.entries(updates).forEach(([key, value]) => {
            oldValues[key] = this._state[key];
            this._state[key] = value;
        });

        // Then notify
        if (notify) {
            Object.keys(updates).forEach(key => {
                this._notify(key, updates[key], oldValues[key]);
            });
        }
    }

    /**
     * Notify subscribers of state change
     * @private
     */
    _notify(key, newValue, oldValue) {
        // Notify specific subscribers
        const subs = this._subscribers.get(key);
        if (subs) {
            subs.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (err) {
                    logError(err, `Store subscriber for ${key}`);
                }
            });
        }

        // Notify global subscribers
        this._globalSubscribers.forEach(callback => {
            try {
                callback(newValue, oldValue, key);
            } catch (err) {
                logError(err, 'Store global subscriber');
            }
        });
    }

    /**
     * Create computed property
     * @param {string[]} deps - Dependencies (state keys)
     * @param {Function} compute - Compute function
     * @returns {Object} Computed property with value and subscribe
     */
    computed(deps, compute) {
        let cachedValue;
        let dirty = true;

        const update = () => {
            const values = deps.map(d => this._state[d]);
            cachedValue = compute(...values);
            dirty = false;
            return cachedValue;
        };

        // Subscribe to dependencies
        deps.forEach(dep => {
            this.subscribe(dep, () => {
                dirty = true;
            });
        });

        return {
            get value() {
                if (dirty) update();
                return cachedValue;
            },
            subscribe(callback) {
                return store.subscribe('*', () => {
                    if (dirty) {
                        const oldVal = cachedValue;
                        const newVal = update();
                        if (oldVal !== newVal) {
                            callback(newVal, oldVal);
                        }
                    }
                });
            }
        };
    }
}

// Create singleton store instance
const store = new Store();

// Export state (proxy for reactive access)
export const state = store.state;

// Export store methods
export const { subscribe, subscribeMany, set, get, batchUpdate, computed } = store;

// Maintain backward compatibility - state is still directly accessible
export default store;

// ============================================
// Legacy Exports (for backward compatibility)
// ============================================

// Constant data
export const ADMIN_EMAILS = ['raju2uraju@gmail.com', 'kanthati.chakri@gmail.com', 'nagaraj.b@swastikinfralogics.com'];
export const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

/** @type {Array<Object>} Products array */
export const products = [];

/**
 * Default products for seeding
 * @type {Array<Object>}
 */
const defaultProducts = [
    { id: 1, name: 'Tomato', telugu: 'టమాటో', hindi: 'Tamatar', price: 24, unit: 'kg', moq: 100, category: 'daily', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80', hot: true },
    { id: 2, name: 'Onion', telugu: 'ఉల్లిపాయ', hindi: 'Pyaz', price: 32, unit: 'kg', moq: 50, category: 'daily', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&q=80', hot: true },
    { id: 3, name: 'Potato', telugu: 'బంగాళాదుంప', hindi: 'Aloo', price: 28, unit: 'kg', moq: 50, category: 'daily', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80' },
    { id: 4, name: 'Green Chilli', telugu: 'పచ్చి మిర్చి', hindi: 'Hari Mirch', price: 45, unit: 'kg', moq: 25, category: 'daily', image: 'https://images.unsplash.com/photo-1596639556108-7a544df8bb3f?w=800&q=80', hot: true },
    { id: 5, name: "Lady's Finger", telugu: 'బెండకాయ', hindi: 'Bhindi', price: 38, unit: 'kg', moq: 30, category: 'rotate', image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?w=800&q=80' },
    { id: 6, name: 'Brinjal', telugu: 'వంకాయ', hindi: 'Baingan', price: 32, unit: 'kg', moq: 40, category: 'rotate', image: 'https://images.unsplash.com/photo-1604568102377-f273edcfebbc?w=800&q=80' },
    { id: 7, name: 'Cauliflower', telugu: 'పులవర్‌', hindi: 'Phool Gobi', price: 28, unit: 'piece', moq: 20, category: 'rotate', image: 'https://images.unsplash.com/photo-1568584711462-24cc6ad04aa6?w=800&q=80', fresh: true },
    { id: 8, name: 'Cabbage', telugu: 'క్యాబేజీ', hindi: 'Patta Gobi', price: 22, unit: 'piece', moq: 20, category: 'rotate', image: 'https://images.unsplash.com/photo-1597362925123-77861d3bfac1?w=800&q=80' },
    { id: 9, name: 'Carrot', telugu: 'క్యారెట్', hindi: 'Gajar', price: 42, unit: 'kg', moq: 25, category: 'rotate', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&q=80' },
    { id: 10, name: 'Spinach', telugu: 'పాలకూర', hindi: 'Palak', price: 18, unit: 'bunch', moq: 50, category: 'regional', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&q=80', fresh: true },
    { id: 11, name: 'Bottle Gourd', telugu: 'సొరకాయ', hindi: 'Lauki', price: 35, unit: 'piece', moq: 15, category: 'regional', image: null },
    { id: 12, name: 'Ridge Gourd', telugu: 'బీరకాయ', hindi: 'Turiya', price: 40, unit: 'kg', moq: 25, category: 'regional', image: null }
];

/**
 * Load products from Firestore
 * @param {Object} db - Firestore database instance
 * @param {Function} [callback] - Callback after products load
 */
export function loadProducts(db, callback) {
    db.collection('products').onSnapshot(async snap => {
        if (snap.empty) {
            // Seed database - use Promise.all for parallel execution
            try {
                await Promise.all(defaultProducts.map(p => 
                    db.collection('products').doc(p.id.toString()).set(p)
                ));
                console.log('Database seeded successfully');
            } catch (err) {
                console.error('Error seeding database:', err);
            }
        } else {
            products.length = 0; // Clear existing
            snap.docs.forEach(doc => {
                const data = doc.data();
                products.push({ id: parseInt(doc.id, 10), ...data });
            });
            products.sort((a, b) => a.id - b.id);
            
            // Notify subscribers that products loaded
            store._notify('productsLoaded', products, null);
            
            if (callback) callback();
        }
    }, err => {
        console.error("Error loading products:", err);
        // Fallback to static if offline
        products.length = 0;
        products.push(...defaultProducts);
        
        store._notify('productsLoaded', products, null);
        
        if (callback) callback();
    });
}

/**
 * Helper to determine admin status
 * @returns {boolean}
 */
export function isAdmin() {
    return state.isAdminClaim || (state.currentUser && state.currentUser.email && ADMIN_EMAILS.includes(state.currentUser.email.toLowerCase()));
}

// ============================================
// Computed State (examples)
// ============================================

/** Computed: Cart item count */
export const cartItemCount = store.computed(['cart'], (cart) => {
    return Object.keys(cart).length;
});

/** Computed: Cart total value */
export const cartTotal = store.computed(['cart'], (cart) => {
    return Object.values(cart).reduce((sum, item) => sum + (item.price * item.qty), 0);
});

/** Computed: Is user authenticated */
export const isAuthenticated = store.computed(['currentUser'], (user) => {
    return !!user;
});
