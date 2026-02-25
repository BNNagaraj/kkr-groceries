import { db } from './firebase.js';
import { state, products } from '../store.js';
import { showToast } from '../utils/dom.js';

// We rely on window globals for UI updates until the components are fully wired via events
// The main.js entry will attach the render functions to window.

export function loadSettingsFromFirestore() {
    db.collection('settings').doc('config').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.commission != null) state.commissionPercent = parseFloat(data.commission);

            // Admin Map & Form controls
            if (data.enableOrderRequests !== undefined) state.enableOrderRequests = data.enableOrderRequests;
            if (data.minOrderValue != null) state.minOrderValue = Number(data.minOrderValue);
            if (data.geofenceRadiusKm != null) state.geofenceRadiusKm = Number(data.geofenceRadiusKm);

            if (data.moqs) {
                Object.entries(data.moqs).forEach(([id, m]) => {
                    const pr = products.find(x => x.id === +id);
                    if (pr) pr.moq = m;
                });
            }
            if (data.prices) {
                Object.entries(data.prices).forEach(([id, p]) => {
                    const pr = products.find(x => x.id === +id);
                    if (pr) pr.price = p;
                });
            }
            // Trigger UI updates safely if available
            if (window.renderProducts) window.renderProducts(state.currentCategory);
            if (window.updateMapCircle) window.updateMapCircle();
            if (window.updateUI) window.updateUI();
        }
    }, err => {
        console.log('Settings not yet in Firestore, using defaults');
    });
}

export async function saveAdminSettings() {
    const cVal = document.getElementById('globalCommission').value;
    const moqs = {};
    const prices = {};

    products.forEach(p => {
        const mqI = document.getElementById('moq-' + p.id);
        if (mqI) moqs[p.id] = parseInt(mqI.value, 10);

        // Custom Price override (if added later, right now let's just save what's there)
        const priceI = document.getElementById('price-' + p.id);
        if (priceI) prices[p.id] = parseFloat(priceI.value);
    });

    try {
        await db.collection('settings').doc('config').set({
            commission: parseFloat(cVal) || state.commissionPercent,
            moqs: moqs,
            prices: prices,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        showToast('Settings saved successfully and synced!', 'success');
    } catch (e) {
        showToast('Failed to save settings: ' + e.message, 'error');
    }
}

export async function saveAdminMapSettings() {
    const enableOrderReq = document.getElementById('mapEnableOrders').checked;
    const geofence = parseFloat(document.getElementById('mapGeofenceRadius').value) || 50;
    const minVal = parseFloat(document.getElementById('mapMinOrderVal').value) || 0;

    try {
        await db.collection('settings').doc('config').set({
            enableOrderRequests: enableOrderReq,
            geofenceRadiusKm: geofence,
            minOrderValue: minVal,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        state.enableOrderRequests = enableOrderReq;
        state.geofenceRadiusKm = geofence;
        state.minOrderValue = minVal;

        if (window.updateMapCircle) window.updateMapCircle();

        showToast('Map & Form controls saved!', 'success');
    } catch (e) {
        showToast('Failed to save map settings: ' + e.message, 'error');
    }
}
