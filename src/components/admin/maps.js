/**
 * Admin Maps & Forms Settings Module
 * Handles map configuration and form controls
 */

import { db } from '../../services/firebase.js';
import { state } from '../../store.js';
import { showToast } from '../../utils/dom.js';
import { logError } from '../../utils/errorHandler.js';
import { validateAndNotify, validateQuantity } from '../../utils/validation.js';

/**
 * Render the maps and forms settings tab
 */
export function renderMapsTab() {
    const tab = document.getElementById('adminMapsTab');
    if (!tab) return;

    const html = `
    <div style="background:white;padding:2rem;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);max-width:600px;margin:0 auto">
        <h3 style="margin-top:0;margin-bottom:1.5rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:1rem">🗺️ Map & Forms Control Panel</h3>
        
        <!-- Toggle Orders -->
        <div style="margin-bottom:1.5rem">
            <label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#334155">Order Requests Form</label>
            <div style="display:flex;align-items:center;gap:0.75rem">
                <input type="checkbox" id="mapEnableOrders" ${state.enableOrderRequests ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">
                <span style="color:#64748b;font-size:0.95rem">Enable buyers to send orders via the form</span>
            </div>
            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">If disabled, the Send Order Request button will be hidden from the main site.</p>
        </div>

        <!-- Min Order Value -->
        <div style="margin-bottom:1.5rem">
            <label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#334155">Minimum Order Value (₹)</label>
            <input type="number" id="mapMinOrderVal" value="${state.minOrderValue}" min="0" max="100000" style="width:100%;padding:0.75rem;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem">
            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">Orders below this rupee total cannot be submitted (0 for no limit).</p>
        </div>

        <!-- Geofence Radius -->
        <div style="margin-bottom:2rem">
            <label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#334155">Geofence Delivery Radius (KM)</label>
            <input type="number" id="mapGeofenceRadius" value="${state.geofenceRadiusKm}" min="1" max="500" style="width:100%;padding:0.75rem;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem">
            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">Sets the maximum distance from Hyderabad center allowed for placing a pin.</p>
        </div>

        <button onclick="window.saveAdminMapSettings()" style="width:100%;background:#059669;color:white;padding:1rem;border:none;border-radius:8px;font-weight:700;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 6px rgba(5,150,105,0.2)">Save Map & Form Controls</button>
    </div>
    `;
    tab.innerHTML = html;
}

/**
 * Save map and form settings
 */
export async function saveAdminMapSettings() {
    const enableOrdersEl = document.getElementById('mapEnableOrders');
    const geofenceEl = document.getElementById('mapGeofenceRadius');
    const minValEl = document.getElementById('mapMinOrderVal');

    if (!enableOrdersEl || !geofenceEl || !minValEl) {
        logError('Map settings elements not found', 'saveAdminMapSettings');
        return;
    }

    const enableOrderReq = enableOrdersEl.checked;
    const geofence = parseFloat(geofenceEl.value) || 50;
    const minVal = parseFloat(minValEl.value) || 0;

    // Validate geofence radius
    const geoValidation = validateQuantity(geofence, 1, 500);
    if (!validateAndNotify(geoValidation)) return;

    // Validate minimum order value
    if (minVal < 0 || minVal > 100000) {
        showToast('Minimum order value must be between 0 and 100,000', 'error');
        return;
    }

    try {
        await db.collection('settings').doc('config').set({
            enableOrderRequests: enableOrderReq,
            geofenceRadiusKm: geofence,
            minOrderValue: minVal,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Update local state
        state.enableOrderRequests = enableOrderReq;
        state.geofenceRadiusKm = geofence;
        state.minOrderValue = minVal;

        // Update map circle if function available
        if (window.updateMapCircle) window.updateMapCircle();

        showToast('Map & Form controls saved!', 'success');
    } catch (e) {
        logError(e, 'saveAdminMapSettings', true);
    }
}
