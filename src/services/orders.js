import { db, firebase } from './firebase.js';

export async function saveOrder(data) {
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
    try {
        await db.collection('orders').doc(orderId).set({
            id: orderId, status: 'Pending', ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return orderId;
    } catch (e) {
        console.error('Failed to save order to Firestore:', e);
        throw e;
    }
}

export async function updateOrderStatus(id, newStatus) {
    try {
        await db.collection('orders').doc(id).update({
            status: newStatus
        });
        return true;
    } catch (e) {
        console.error('Error updating order:', e);
        throw e;
    }
}
