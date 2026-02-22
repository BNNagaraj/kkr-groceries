import { db, firebase } from './firebase.js';
import { state } from '../store.js';
import { escapeHTML, showToast } from '../utils/dom.js';

// The maps markers are global from Google Maps API initialization.
// In the ES modules structure, we expect deliveryMap and deliveryMarker to be attached to window or imported from map.js.
// Since map.js handles Google Maps, we'll access window.deliveryMap for now to avoid circular dependencies.

export async function populateSavedAddresses() {
    if (!state.currentUser) return;
    let list = [];
    try {
        const snap = await db.collection('users').doc(state.currentUser.uid).collection('addresses').get();
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.log('No saved addresses yet');
    }

    let dd = document.getElementById('savedAddrSelect');
    if (!dd && list.length > 0) {
        dd = document.createElement('select');
        dd.id = 'savedAddrSelect';
        dd.style = 'width:100%;margin-bottom:0.75rem;padding:0.6rem;border:2px solid #e2e8f0;border-radius:8px';

        dd.addEventListener('change', e => {
            if (!e.target.value) return;
            const a = list[parseInt(e.target.value)];
            if (!a) return;

            document.getElementById('customerName').value = a.name || '';
            document.getElementById('customerPhone').value = a.phone || '';
            document.getElementById('deliveryLocation').value = a.loc || '';
            document.getElementById('pincode').value = a.pin || '';

            if (a.coords && window.deliveryMap && window.deliveryMarker) {
                const pos = new window.google.maps.LatLng(a.coords.lat, a.coords.lng);
                window.deliveryMap.setCenter(pos);
                window.deliveryMap.setZoom(16);
                window.deliveryMarker.setPosition(pos);
                window.google.maps.event.trigger(window.deliveryMap, 'resize');
            }
        });
        document.getElementById('customerName').parentNode.parentNode.insertBefore(dd, document.getElementById('customerName').parentNode);
    }

    if (dd) {
        dd.innerHTML = '<option value="">-- Choose a saved profile --</option>' +
            list.map((a, i) => `<option value="${i}">${escapeHTML(a.name || 'Profile')} - ${escapeHTML((a.loc || '').substring(0, 30))}... (${escapeHTML(a.pin)})</option>`).join('');
        dd.style.display = list.length ? 'block' : 'none';
    }
}

export async function saveAddressIfRequested() {
    if (!state.currentUser || !document.getElementById('saveAddress').checked) return;

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const loc = document.getElementById('deliveryLocation').value.trim();
    const pin = document.getElementById('pincode').value.trim();

    if (!loc || !pin || !name || !phone) {
        showToast('Please completely fill contact info to save profile', 'error');
        return;
    }

    try {
        const coords = window.deliveryMarker ? { lat: window.deliveryMarker.getPosition().lat(), lng: window.deliveryMarker.getPosition().lng() } : null;
        await db.collection('users').doc(state.currentUser.uid).collection('addresses').add({
            name, phone, loc, pin, coords,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Profile and address saved!', 'success');
    } catch (e) {
        showToast('Failed to save address: ' + e.message, 'error');
    }
}

export async function deleteSavedAddress(addrId) {
    if (!state.currentUser) return;
    try {
        await db.collection('users').doc(state.currentUser.uid).collection('addresses').doc(addrId).delete();
        showToast('Address deleted', 'success');
    } catch (e) {
        console.error('Error deleting address', e);
        showToast('Error deleting address', 'error');
    }
}
