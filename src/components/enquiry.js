import { state, GOOGLE_SCRIPT_URL } from '../store.js';
import { openAuthModal } from '../services/auth.js';
import { showToast, escapeHTML } from '../utils/dom.js';
import { validateCart, updateUI } from './cart.js';
import { renderProducts } from './products.js';
import { saveOrder } from '../services/orders.js';
import { saveAddressIfRequested, populateSavedAddresses } from '../services/addresses.js';

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

    if (!items.length) {
        list.innerHTML = '<span style="color:#64748b;font-size:0.9rem">No items added.</span>';
        sb.disabled = true;
    } else {
        const valid = validateCart();
        ve.style.display = valid ? 'none' : 'block';
        sb.disabled = !valid;

        const totalValue = items.reduce((s, i) => s + (i.price * i.qty), 0);
        const totalItems = items.reduce((s, i) => s + i.qty, 0);

        let html = items.map(i => {
            const iv = i.qty >= i.moq;
            const tp = i.price * i.qty;
            return `<div class="item-row ${!iv ? 'moq-warning' : ''}"><div class="item-info"><div class="item-name">${escapeHTML(i.name)} <span style="color:#64748b;font-size:0.8rem">(${escapeHTML(i.telugu)})</span></div><div class="item-qty" style="color:${iv ? 'var(--primary)' : 'var(--danger)'}">Qty: ${i.qty} ${i.unit} ${!iv ? '\u26A0\uFE0F Below MOQ!' : ''}</div></div><div style="text-align:right"><div class="item-price">\u20B9${tp}</div><div style="font-size:0.75rem;color:#64748b">\u20B9${i.price}/${i.unit}</div></div></div>`;
        }).join('');

        // Grand Total Row
        html += `<div style="background:var(--primary);color:white;padding:1rem;border-radius:10px;margin-top:1rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 15px rgba(5,150,105,0.3)">
                    <div>
                        <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;opacity:0.9">Checkout Total</div>
                        <div style="font-size:0.9rem;font-weight:600">${items.length} Products \u00B7 ${totalItems} Items</div>
                    </div>
                    <div style="font-size:1.5rem;font-weight:800">\u20B9${totalValue.toLocaleString('en-IN')}</div>
                 </div>`;

        list.innerHTML = html;
    }

    populateSavedAddresses();
    document.getElementById('enquiryModal').style.display = 'flex';

    // Defer Map initialization to allow modal animation to finish
    if (window.initDeliveryMap) setTimeout(() => { window.initDeliveryMap(); }, 300);
    document.body.style.overflow = 'hidden';
}

export function closeEnquiryModal() {
    document.getElementById('enquiryModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

export async function submitEnquiryForm(e) {
    e.preventDefault();
    if (!validateCart()) { showToast('Fix MOQ quantities', 'error'); return; }

    const items = Object.values(state.cart);
    if (!items.length) { showToast('Add items first', 'error'); return; }

    const totalValue = items.reduce((s, i) => s + (i.price * i.qty), 0);
    const formData = {
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        customerName: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        location: document.getElementById('deliveryLocation').value,
        pincode: document.getElementById('pincode').value,
        businessType: document.getElementById('businessType').value || 'Not specified',
        itemDetails: items.map(i => `${i.name}: ${i.qty}${i.unit} @\u20B9${i.price} = \u20B9${i.price * i.qty}`).join(' | '),
        orderSummary: items.map(i => `${i.name} x${i.qty}`).join(', '),
        moqCompliant: 'YES',
        totalItems: items.reduce((s, i) => s + i.qty, 0),
        totalValue: '\u20B9' + totalValue,
        productCount: items.length,
        userId: state.currentUser ? state.currentUser.uid : 'anonymous',
        source: 'KKR Groceries B2B'
    };

    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        // Save locally only
        saveOrder(formData);
        saveAddressIfRequested();
        document.getElementById('successMsg').style.display = 'block';
        showToast('Order saved locally!', 'success');
        setTimeout(() => {
            closeEnquiryModal();
            // empty cart
            Object.keys(state.cart).forEach(k => delete state.cart[k]);
            updateUI();
            renderProducts(state.currentCategory);
            document.getElementById('enquiryForm').reset();
            document.getElementById('successMsg').style.display = 'none';
        }, 2000);
        return;
    }

    const sb = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');
    sb.disabled = true;
    sb.querySelector('span').textContent = 'Sending...';
    spinner.style.display = 'block';

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(formData)
        });

        saveOrder(formData);
        saveAddressIfRequested();
        document.getElementById('successMsg').style.display = 'block';

        setTimeout(() => {
            closeEnquiryModal();
            Object.keys(state.cart).forEach(k => delete state.cart[k]);
            updateUI();
            renderProducts(state.currentCategory);
            document.getElementById('enquiryForm').reset();
            document.getElementById('successMsg').style.display = 'none';
            sb.disabled = false;
            sb.querySelector('span').textContent = 'Send Enquiry';
            spinner.style.display = 'none';
        }, 2000);
    } catch (err) {
        document.getElementById('errorMsg').style.display = 'block';
        showToast('Network error, but saved locally.', 'error');
        saveOrder(formData);
        saveAddressIfRequested();
        sb.disabled = false;
        sb.querySelector('span').textContent = 'Send Enquiry';
        spinner.style.display = 'none';
    }
}
