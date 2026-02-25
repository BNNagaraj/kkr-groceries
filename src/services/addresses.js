import { db, firebase } from './firebase.js';
import { state } from '../store.js';
import { escapeHTML, showToast } from '../utils/dom.js';

// Track saved addresses for this session
let savedAddressesList = [];
let hasAutoSelected = false;

// Force expose to window for debugging
console.log('ADDRESS MODULE LOADED');
try {
    window.ADDRESS_MODULE_LOADED = true;
    window.populateSavedAddressesDebug = function() {
        console.log('Manual call to populateSavedAddresses');
        return populateSavedAddresses();
    };
} catch(e) {
    console.error('Failed to expose debug functions:', e);
}

// Poll for user state changes when modal is open
// This is more reliable than subscription due to module load order
let lastUserId = null;
setInterval(() => {
    const currentUserId = state.currentUser?.uid;
    if (currentUserId !== lastUserId) {
        lastUserId = currentUserId;
        const modal = document.getElementById('enquiryModal');
        if (modal && modal.style.display === 'block') {
            console.log('User changed, repopulating addresses');
            populateSavedAddresses();
        }
    }
}, 500);

// The maps markers are global from Google Maps API initialization.
// In the ES modules structure, we expect deliveryMap and deliveryMarker to be attached to window or imported from map.js.
// Since map.js handles Google Maps, we'll access window.deliveryMap for now to avoid circular dependencies.

export async function populateSavedAddresses() {
    console.log('=== POPULATE SAVED ADDRESSES CALLED ===');
    console.log('currentUser:', state.currentUser?.uid || 'none');
    
    // Check if DOM is ready
    if (!document.getElementById('customerName')) {
        console.log('DOM not ready, retrying in 200ms...');
        setTimeout(() => populateSavedAddresses(), 200);
        return;
    }
    
    // Always create dropdown, even without user - we'll just show "Add New Address" option
    const user = state.currentUser;
    console.log('User:', user);
    
    try {
        let list = [];
        // Only fetch saved addresses if user is logged in
        if (user) {
            try {
                const snap = await db.collection('users').doc(user.uid).collection('addresses').get();
                list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.log('No saved addresses yet or error fetching:', e.message);
            }
        }
        
        savedAddressesList = list;
        console.log('Saved addresses loaded:', list.length);

        let dd = document.getElementById('savedAddrSelect');
        console.log('Dropdown exists:', !!dd);
        
        if (!dd) {
            // Dynamically create the dropdown container and select
            const customerNameField = document.getElementById('customerName');
            if (!customerNameField || !customerNameField.parentNode) {
                console.log('customerName field not found, cannot insert dropdown');
                return;
            }
            
            // Create container div
            const container = document.createElement('div');
            container.className = 'form-group';
            container.id = 'savedAddressContainer';
            
            // Create label
            const label = document.createElement('label');
            label.htmlFor = 'savedAddrSelect';
            label.textContent = 'Select Saved Address';
            
            // Create select
            dd = document.createElement('select');
            dd.id = 'savedAddrSelect';
            dd.style = 'width:100%;padding:0.6rem;border:2px solid #e2e8f0;border-radius:8px;';
            
            // Add event listener
            dd.addEventListener('change', e => {
                if (!e.target.value) {
                    // "Add New Address" selected - clear fields
                    document.getElementById('customerName').value = '';
                    document.getElementById('customerPhone').value = '';
                    document.getElementById('deliveryLocation').value = '';
                    document.getElementById('pincode').value = '';
                    return;
                }
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
            
            // Assemble and insert
            container.appendChild(label);
            container.appendChild(dd);
            customerNameField.parentNode.parentNode.insertBefore(container, customerNameField.parentNode);
            console.log('Dropdown dynamically inserted');
        }

        if (dd) {
            console.log('Updating dropdown options, list length:', list.length);
            // Build options with default indicator
            let optionsHtml = '<option value="">-- Add New Address --</option>';
            list.forEach((a, i) => {
                const defaultIndicator = a.isDefault ? ' ★' : '';
                const label = a.name ? `${a.name}${defaultIndicator} - ${(a.loc || '').substring(0, 30)}...` : `Address ${i + 1}${defaultIndicator}`;
                optionsHtml += `<option value="${i}">${escapeHTML(label)} (${escapeHTML(a.pin || 'No Pin')})</option>`;
            });
            dd.innerHTML = optionsHtml;
            
            // Auto-select default or first address on first load
            if (!hasAutoSelected && list.length > 0) {
                const defaultIndex = list.findIndex(a => a.isDefault);
                const selectIndex = defaultIndex >= 0 ? defaultIndex : 0;
                dd.value = String(selectIndex);
                dd.dispatchEvent(new Event('change'));
                hasAutoSelected = true;
            }
        }
    } catch (err) {
        console.error('Error populating saved addresses:', err);
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
        
        // Check if this is the first address - make it default
        const isFirstAddress = savedAddressesList.length === 0;
        
        await db.collection('users').doc(state.currentUser.uid).collection('addresses').add({
            name, phone, loc, pin, coords,
            isDefault: isFirstAddress,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast(isFirstAddress ? 'Profile and address saved as default!' : 'Profile and address saved!', 'success');
        
        // Refresh the saved addresses list
        await populateSavedAddresses();
    } catch (e) {
        showToast('Failed to save address: ' + e.message, 'error');
    }
}

export async function setDefaultAddress(addrId) {
    if (!state.currentUser || !addrId) return;
    
    try {
        const userRef = db.collection('users').doc(state.currentUser.uid);
        const addressesRef = userRef.collection('addresses');
        
        // First, unset all other defaults
        const snapshot = await addressesRef.where('isDefault', '==', true).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { isDefault: false });
        });
        
        // Set the new default
        batch.update(addressesRef.doc(addrId), { isDefault: true });
        await batch.commit();
        
        // Update local list
        savedAddressesList.forEach(a => a.isDefault = (a.id === addrId));
        
        // Refresh dropdown
        const dd = document.getElementById('savedAddrSelect');
        if (dd) {
            const currentValue = dd.value;
            dd.dispatchEvent(new Event('focus')); // Trigger refresh
            dd.value = currentValue;
        }
        
        showToast('Default address updated', 'success');
    } catch (e) {
        console.error('Error setting default address', e);
        showToast('Error setting default address', 'error');
    }
}

export async function deleteSavedAddress(addrId) {
    if (!state.currentUser) return;
    try {
        await db.collection('users').doc(state.currentUser.uid).collection('addresses').doc(addrId).delete();
        
        // Remove from local list
        savedAddressesList = savedAddressesList.filter(a => a.id !== addrId);
        
        // If we deleted the default and there are other addresses, make the first one default
        const remaining = savedAddressesList.length;
        if (remaining > 0 && !savedAddressesList.some(a => a.isDefault)) {
            await setDefaultAddress(savedAddressesList[0].id);
        }
        
        showToast('Address deleted', 'success');
    } catch (e) {
        console.error('Error deleting address', e);
        showToast('Error deleting address', 'error');
    }
}

// Reset auto-select flag when modal is closed (call this when enquiry modal opens)
export function resetAddressAutoSelect() {
    hasAutoSelected = false;
}
