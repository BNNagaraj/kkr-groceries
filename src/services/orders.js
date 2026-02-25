/**
 * Order Service
 * @module services/orders
 */

import { db, firebase } from './firebase.js';
import { logError } from '../utils/errorHandler.js';

/**
 * Save order to Firestore
 * @param {import('../types/index.js').Order} data - Order data
 * @returns {Promise<string>} Order ID
 */
export async function saveOrder(data) {
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
    try {
        const now = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('orders').doc(orderId).set({
            id: orderId,
            status: 'Pending',
            ...data,
            placedAt: now,           // Timestamp when order was placed
            createdAt: now,
            updatedAt: now
        });
        return orderId;
    } catch (error) {
        logError(error, 'saveOrder');
        throw error;
    }
}

/**
 * Status timestamp field mapping
 */
const STATUS_TIMESTAMP_FIELDS = {
    'Pending': 'placedAt',
    'Accepted': 'acceptedAt',
    'Fulfilled': 'deliveredAt',
    'Rejected': 'rejectedAt'
};

/**
 * Update order status with timestamp tracking
 * @param {string} id - Order ID
 * @param {string} newStatus - New status (Pending, Accepted, Fulfilled, Rejected)
 * @returns {Promise<boolean>}
 */
export async function updateOrderStatus(id, newStatus) {
    const validStatuses = ['Pending', 'Accepted', 'Fulfilled', 'Rejected'];
    
    if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }

    try {
        const updates = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add timestamp for this status change
        const timestampField = STATUS_TIMESTAMP_FIELDS[newStatus];
        if (timestampField) {
            updates[timestampField] = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // If status is Fulfilled, also set shippedAt if not already set
        if (newStatus === 'Fulfilled' && !updates.shippedAt) {
            updates.shippedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        await db.collection('orders').doc(id).update(updates);
        return true;
    } catch (error) {
        logError(error, 'updateOrderStatus');
        throw error;
    }
}

/**
 * Get order by ID
 * @param {string} id - Order ID
 * @returns {Promise<import('../types/index.js').Order|null>}
 */
export async function getOrder(id) {
    try {
        const doc = await db.collection('orders').doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        logError(error, 'getOrder');
        throw error;
    }
}

/**
 * Get orders by user ID
 * @param {string} userId - User ID
 * @param {number} [limit=50] - Maximum number of orders to fetch
 * @returns {Promise<Array<import('../types/index.js').Order>>}
 */
export async function getOrdersByUser(userId, limit = 50) {
    try {
        const snap = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        logError(error, 'getOrdersByUser');
        // Fallback without ordering
        try {
            const snap = await db.collection('orders')
                .where('userId', '==', userId)
                .get();
            const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            orders.sort((a, b) => {
                const tA = a.createdAt ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });
            return orders;
        } catch (e) {
            logError(e, 'getOrdersByUser fallback');
            return [];
        }
    }
}

/**
 * Get all orders (admin only)
 * @param {number} [limit=100] - Maximum number of orders
 * @returns {Promise<Array<import('../types/index.js').Order>>}
 */
export async function getAllOrders(limit = 100) {
    try {
        const snap = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        logError(error, 'getAllOrders');
        // Fallback without ordering
        try {
            const snap = await db.collection('orders').get();
            const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            orders.sort((a, b) => {
                const tA = a.createdAt ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });
            return orders;
        } catch (e) {
            logError(e, 'getAllOrders fallback');
            return [];
        }
    }
}

/**
 * Delete order (admin only)
 * @param {string} id - Order ID
 * @returns {Promise<boolean>}
 */
export async function deleteOrder(id) {
    try {
        await db.collection('orders').doc(id).delete();
        return true;
    } catch (error) {
        logError(error, 'deleteOrder');
        throw error;
    }
}

/**
 * Get order statistics
 * @returns {Promise<Object>}
 */
export async function getOrderStats() {
    try {
        const snap = await db.collection('orders').get();
        const orders = snap.docs.map(d => d.data());
        
        const total = orders.length;
        const revenue = orders.reduce((sum, o) => {
            const val = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        
        const byStatus = orders.reduce((acc, o) => {
            const status = o.status || 'Pending';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        const uniqueCustomers = new Set(orders.map(o => o.userId).filter(Boolean)).size;
        
        return {
            total,
            revenue,
            byStatus,
            uniqueCustomers
        };
    } catch (error) {
        logError(error, 'getOrderStats');
        return { total: 0, revenue: 0, byStatus: {}, uniqueCustomers: 0 };
    }
}
