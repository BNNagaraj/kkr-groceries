import { state, GOOGLE_SCRIPT_URL } from '../store.js';
import { openAuthModal } from '../services/auth.js';
import { showToast, escapeHTML } from '../utils/dom.js';
import { validateCart, updateUI } from './cart.js';
import { renderProducts } from './products.js';
import { saveOrder } from '../services/orders.js';
import { saveAddressIfRequested, populateSavedAddresses, resetAddressAutoSelect } from '../services/addresses.js';

// Track state for quantity editing
let editingQtyItemId = null;
let editingQtyOriginalValue = null;

export function openEnquiryModal() {
    if (!state.currentUser) {
        openAuthModal();
        showToast('Please sign in first', 'info');
        return;
    }
    const items = Object.values(state.cart);
    const list = document.getElementById('selectedItemsList');
    const ve = document.getElementById('validationError');
    const sb = document.getElementById('submitBtn');

    // Always reset auto-select and populate saved addresses (even for empty cart)
    resetAddressAutoSelect();
    
    if (!items.length) {
        list.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        ve.style.display = 'none';
        sb.disabled = true;
        document.getElementById('enquiryModal').style.display = 'block';
        // Delay to ensure DOM is ready then populate addresses
        setTimeout(() => populateSavedAddresses(), 100);
        return;
    }

    // Delay to ensure DOM is ready then populate addresses
    setTimeout(() => populateSavedAddresses(), 100);

    // BUG FIX: Check moqRequired when displaying MOQ warnings
    const invalidItems = items.filter(i => {
        const moqRequired = i.moqRequired !== false;
        return moqRequired && i.qty < i.moq;
    });
    
    ve.style.display = invalidItems.length ? 'block' : 'none';
    ve.innerHTML = invalidItems.length 
        ? '⚠️ Please adjust quantities to meet MOQ requirements: ' + 
          invalidItems.map(i => `${i.name} (min ${i.moq})`).join(', ')
        : '';
    sb.disabled = invalidItems.length > 0;

    // Build table with product images
    const totalValue = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    
    list.innerHTML = `
        <table class="enquiry-items-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${items.map(i => {
                    const moqRequired = i.moqRequired !== false;
                    const iv = moqRequired ? i.qty >= i.moq : true;
                    const minQty = moqRequired ? i.moq : 1;
                    const tp = i.price * i.qty;
                    const imgHtml = i.image 
                        ? `<img src="${i.image}" alt="${i.name}" class="enquiry-item-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                        : '';
                    const fallbackHtml = `<span class="enquiry-item-fallback">${i.name[0]}</span>`;
                    return `
                    <tr data-id="${i.id}">
                        <td class="product-cell">
                            <div class="enquiry-product">
                                <div class="enquiry-thumb">
                                    ${imgHtml}
                                    ${fallbackHtml}
                                </div>
                                <div class="enquiry-product-info">
                                    <div class="enquiry-name">${escapeHTML(i.name)}</div>
                                    <div class="enquiry-telugu">${escapeHTML(i.telugu)}</div>
                                    ${!iv && moqRequired ? `<div class="moq-warning">Min ${i.moq} ${escapeHTML(i.unit)} required</div>` : ''}
                                </div>
                            </div>
                        </td>
                        <td class="qty-cell">
                            <div class="enquiry-qty-controls">
                                <button class="qty-btn" onclick="adjustEnquiryQty(${i.id}, -1)" ${i.qty <= minQty ? 'disabled' : ''}>-</button>
                                <input type="number" class="qty-input" value="${i.qty}" min="${minQty}" 
                                       onchange="updateEnquiryQty(${i.id}, this.value)" 
                                       onfocus="startQtyEdit(${i.id}, this.value)"
                                       onblur="endQtyEdit(${i.id}, this.value)"
                                       onkeydown="handleQtyKey(event, ${i.id})">
                                <button class="qty-btn" onclick="adjustEnquiryQty(${i.id}, 1)">+</button>
                            </div>
                        </td>
                        <td class="unit-cell">${escapeHTML(i.unit)}</td>
                        <td class="price-cell">₹${i.price.toLocaleString('en-IN')}</td>
                        <td class="total-cell">₹${tp.toLocaleString('en-IN')}</td>
                        <td class="action-cell">
                            <button class="remove-btn" onclick="removeFromEnquiry(${i.id})" title="Remove">×</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
            <tfoot>
                <tr class="grand-total-row">
                    <td colspan="4"><strong>Grand Total</strong></td>
                    <td colspan="2"><strong>₹${totalValue.toLocaleString('en-IN')}</strong></td>
                </tr>
            </tfoot>
        </table>`;

    document.getElementById('enquiryModal').style.display = 'block';
    
    // Initialize map after modal is shown (needed for proper map rendering)
    setTimeout(() => {
        if (typeof window !== 'undefined' && window.initDeliveryMap) {
            window.initDeliveryMap();
        }
    }, 100);
}

export function closeEnquiryModal() {
    document.getElementById('enquiryModal').style.display = 'none';
    editingQtyItemId = null;
    editingQtyOriginalValue = null;
}

export function adjustEnquiryQty(id, delta) {
    const item = state.cart[id];
    if (!item) return;
    
    const moqRequired = item.moqRequired !== false;
    const minQty = moqRequired ? item.moq : 1;
    const newQty = item.qty + delta;
    
    if (newQty >= minQty) {
        item.qty = newQty;
        updateUI();
        openEnquiryModal(); // Refresh modal
    }
}

export function updateEnquiryQty(id, value) {
    const item = state.cart[id];
    if (!item) return;
    
    const moqRequired = item.moqRequired !== false;
    const minQty = moqRequired ? item.moq : 1;
    const newQty = parseInt(value) || minQty;
    
    if (newQty >= minQty) {
        item.qty = newQty;
        updateUI();
        openEnquiryModal(); // Refresh modal
    } else {
        showToast(`Minimum quantity is ${minQty} ${item.unit}`, 'error');
        openEnquiryModal(); // Refresh to reset value
    }
}

export function startQtyEdit(id, value) {
    editingQtyItemId = id;
    editingQtyOriginalValue = value;
}

export function endQtyEdit(id, value) {
    // Only update if value changed
    if (value !== editingQtyOriginalValue) {
        updateEnquiryQty(id, value);
    }
    editingQtyItemId = null;
    editingQtyOriginalValue = null;
}

export function handleQtyKey(event, id) {
    if (event.key === 'Enter') {
        event.target.blur();
    } else if (event.key === 'Escape') {
        // Reset to original value
        if (editingQtyOriginalValue !== null) {
            event.target.value = editingQtyOriginalValue;
            event.target.blur();
        }
    }
}

export function removeFromEnquiry(id) {
    delete state.cart[id];
    updateUI();
    openEnquiryModal(); // Refresh modal
    showToast('Item removed', 'info');
}

export async function submitEnquiryForm(event) {
    event.preventDefault();
    const items = Object.values(state.cart);
    if (!items.length) {
        showToast('Cart is empty', 'error');
        return;
    }

    // BUG FIX: Validate based on moqRequired
    const invalidItems = items.filter(i => {
        const moqRequired = i.moqRequired !== false;
        return moqRequired && i.qty < i.moq;
    });
    
    if (invalidItems.length) {
        showToast('Please meet MOQ requirements', 'error');
        return;
    }

    const addressInput = document.getElementById('deliveryLocation');
    const saveAddressCheckbox = document.getElementById('saveAddress');
    const address = addressInput?.value?.trim();

    if (!address) {
        showToast('Please enter delivery address', 'error');
        addressInput?.focus();
        return;
    }

    // Validate pincode (6-digit numeric)
    const pincodeInput = document.getElementById('pincode');
    const pincode = pincodeInput?.value?.trim();
    if (!pincode || !/^\d{6}$/.test(pincode)) {
        showToast('Please enter a valid 6-digit pincode', 'error');
        pincodeInput?.focus();
        return;
    }

    const sb = document.getElementById('submitBtn');
    sb.disabled = true;
    sb.innerHTML = '<span class="spinner"></span> Submitting...';

    try {
        const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);
        const orderData = {
            items: items.map(i => ({
                name: i.name,
                qty: i.qty,
                unit: i.unit,
                price: i.price,
                image: i.image
            })),
            cart: items.map(i => ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                unit: i.unit,
                price: i.price,
                image: i.image,
                telugu: i.telugu,
                hindi: i.hindi
            })),
            total: totalAmount,
            totalValue: '₹' + totalAmount.toLocaleString('en-IN'),
            productCount: items.length,
            address: address,
            userId: state.currentUser?.uid,
            userEmail: state.currentUser?.email,
            timestamp: new Date().toISOString()
        };

        // Save order to Firebase (primary storage)
        await saveOrder(orderData);

        // Try to save to Google Sheets (secondary backup) - don't fail if this errors
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
        } catch (sheetError) {
            console.warn('Google Sheets sync failed:', sheetError);
        }

        // Save address if requested
        if (saveAddressCheckbox?.checked) {
            await saveAddressIfRequested(address);
        }

        showToast('Order submitted successfully!', 'success');
        
        // Clear cart
        Object.keys(state.cart).forEach(key => delete state.cart[key]);
        updateUI();
        closeEnquiryModal();
        renderProducts();

    } catch (e) {
        console.error('Submit error:', e);
        showToast('Failed to submit order. Please try again.', 'error');
    } finally {
        sb.disabled = false;
        sb.innerHTML = 'Submit Order';
    }
}

// Expose functions to window for onclick handlers
if (typeof window !== 'undefined') {
    window.openEnquiryModal = openEnquiryModal;
    window.closeEnquiryModal = closeEnquiryModal;
    window.adjustEnquiryQty = adjustEnquiryQty;
    window.updateEnquiryQty = updateEnquiryQty;
    window.removeFromEnquiry = removeFromEnquiry;
    window.submitEnquiryForm = submitEnquiryForm;
    window.startQtyEdit = startQtyEdit;
    window.endQtyEdit = endQtyEdit;
    window.handleQtyKey = handleQtyKey;
}
