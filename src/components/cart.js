import { state, products } from '../store.js';
import { getSellingPrice } from '../services/apmc.js';
import { renderProducts, updateProductUI } from './products.js';
import { showToast } from '../utils/dom.js';
import { openAuthModal } from '../services/auth.js';

export function updateUI() {
    const count = Object.keys(state.cart).length;
    const badge = document.getElementById('cartCount');
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('show', count > 0);
    }

    const total = Object.values(state.cart).reduce((s, i) => s + (i.price * i.qty), 0);
    const el = document.getElementById('orderTotal');
    if (el) {
        el.textContent = '\u20B9' + total.toLocaleString('en-IN');
        el.classList.toggle('show', total > 0);
    }
    
    // Render mobile cart bar only (no expand functionality)
    renderMobileCartBar();
}

export function validateCart() {
    return Object.values(state.cart).every(i => {
        const moqRequired = i.moqRequired !== false;
        return moqRequired ? i.qty >= i.moq : i.qty >= 1;
    });
}

export function handleAddClick(id) {
    if (!state.currentUser) {
        openAuthModal();
        showToast('Please sign in to add items', 'info');
        return;
    }
    const p = products.find(x => x.id === id);
    if (!p) return;

    const sp = getSellingPrice(p);
    const moqRequired = p.moqRequired !== false;
    const initialQty = moqRequired ? p.moq : 1;
    state.cart[id] = { ...p, price: sp, qty: initialQty };
    showToast(`Added ${p.name} (\u00d7${initialQty})`, 'success');
    updateUI();
    updateProductUI(id);
}

export function updateQty(id, change) {
    if (!state.cart[id]) return;
    const item = state.cart[id];
    const nq = item.qty + change;
    const moqRequired = item.moqRequired !== false;
    const minQty = moqRequired ? item.moq : 1;
    
    if (nq < minQty) {
        if (moqRequired) {
            showToast(`Min order: ${item.moq} ${item.unit}`, 'error');
        } else {
            // If MOQ not required, remove item when going below 1
            delete state.cart[id];
            showToast('Item removed', 'info');
        }
        return;
    }
    item.qty = nq;
    updateUI();
    updateProductUI(id);
}

export function handleQtyChange(id, value) {
    const qty = parseInt(value, 10) || 0;
    const p = products.find(x => x.id === id);
    if (!p) return;

    const moqRequired = p.moqRequired !== false;
    const minQty = moqRequired ? p.moq : 1;

    if (qty <= 0) {
        delete state.cart[id];
    } else if (qty < minQty && moqRequired) {
        showToast(`Set to minimum: ${p.moq} ${p.unit}`, 'info');
        state.cart[id] = { ...p, price: getSellingPrice(p), qty: p.moq };
    } else if (qty < minQty && !moqRequired) {
        // If MOQ not required, remove when below 1
        delete state.cart[id];
        showToast('Item removed', 'info');
    } else {
        state.cart[id] = { ...p, price: getSellingPrice(p), qty };
    }
    updateUI();
    updateProductUI(id);
}

export function removeItem(id) {
    delete state.cart[id];
    showToast('Item removed', 'info');
    updateUI();
    updateProductUI(id);
}

// Global Event Delegation Helper mapping clicks on the grid
export function onProductGridClick(e) {
    const btn = e.target.closest('button[data-action][data-product-id]');
    if (!btn) return;
    const id = Number(btn.dataset.productId);
    if (!Number.isFinite(id)) return;

    const a = btn.dataset.action;
    if (a === 'add') handleAddClick(id);
    if (a === 'decrease') updateQty(id, -1);
    if (a === 'increase') updateQty(id, 1);
    if (a === 'remove') removeItem(id);
}

export function onProductQtyChange(e) {
    const i = e.target.closest('input[data-action="set-qty"]');
    if (i) handleQtyChange(Number(i.dataset.productId), i.value);
}

// Handle direct quantity input change from enquiry modal
export function handleCartQtyChange(productId, value) {
    const qty = parseInt(value, 10) || 0;
    const item = state.cart[productId];
    if (!item) return;
    
    if (qty <= 0) {
        removeCartItem(productId);
        return;
    }
    
    if (qty < item.moq) {
        showToast(`Minimum order quantity is ${item.moq} ${item.unit}`, 'warning');
        item.qty = item.moq;
    } else {
        item.qty = qty;
    }
    
    updateUI();
    updateProductUI(productId);
    
    // Refresh enquiry modal
    const enquiryModal = document.getElementById('enquiryModal');
    if (enquiryModal && enquiryModal.style.display === 'flex') {
        import('./enquiry.js').then(m => m.openEnquiryModal());
    }
}

// Mobile Cart Bar - Simple summary only
export function renderMobileCartBar() {
    const existing = document.getElementById('mobileCartBar');
    if (existing) existing.remove();
    
    const items = Object.values(state.cart);
    if (items.length === 0) return;
    
    const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
    const totalValue = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    const bar = document.createElement('div');
    bar.id = 'mobileCartBar';
    bar.className = 'mobile-cart-bar';
    bar.innerHTML = `
        <div class="cart-summary">
            <span class="item-count">${totalItems} item${totalItems > 1 ? 's' : ''}</span>
            <span class="total-price">₹${totalValue.toLocaleString('en-IN')}</span>
        </div>
        <button class="btn-view-cart" onclick="openEnquiryModal()">
            View Cart →
        </button>
    `;
    document.body.appendChild(bar);
}

// Cart item management for enquiry modal
export function adjustCartItem(productId, delta) {
    const item = state.cart[productId];
    if (!item) return;
    
    const product = products.find(p => p.id === productId);
    const newQty = item.qty + delta;
    
    if (newQty < item.moq && delta < 0) {
        delete state.cart[productId];
        showToast(`${product.name} removed from cart`, 'info');
    } else {
        item.qty = newQty;
    }
    
    updateUI();
    updateProductUI(productId);
    
    // Refresh enquiry modal if open
    const enquiryModal = document.getElementById('enquiryModal');
    if (enquiryModal && enquiryModal.style.display === 'flex') {
        import('./enquiry.js').then(m => m.openEnquiryModal());
    }
}

export function removeCartItem(productId) {
    const product = products.find(p => p.id === productId);
    delete state.cart[productId];
    showToast(`${product?.name || 'Item'} removed from cart`, 'info');
    updateUI();
    updateProductUI(productId);
    
    // Refresh enquiry modal if open
    const enquiryModal = document.getElementById('enquiryModal');
    if (enquiryModal && enquiryModal.style.display === 'flex') {
        import('./enquiry.js').then(m => m.openEnquiryModal());
    }
}
