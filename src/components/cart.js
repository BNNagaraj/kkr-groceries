import { state, products } from '../store.js';
import { getSellingPrice } from '../services/apmc.js';
import { renderProducts } from './products.js';
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
}

export function validateCart() {
    return Object.values(state.cart).every(i => i.qty >= i.moq);
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
    state.cart[id] = { ...p, price: sp, qty: p.moq };
    showToast(`Added ${p.name} (\u00D7${p.moq})`, 'success');
    updateUI();
    renderProducts(state.currentCategory);
}

export function updateQty(id, change) {
    if (!state.cart[id]) return;
    const nq = state.cart[id].qty + change;
    if (nq < state.cart[id].moq) {
        showToast(`Min order: ${state.cart[id].moq} ${state.cart[id].unit}`, 'error');
        return;
    }
    state.cart[id].qty = nq;
    updateUI();
    renderProducts(state.currentCategory);
}

export function handleQtyChange(id, value) {
    const qty = parseInt(value, 10) || 0;
    const p = products.find(x => x.id === id);
    if (!p) return;

    if (qty <= 0) {
        delete state.cart[id];
    } else if (qty < p.moq) {
        showToast(`Set to minimum: ${p.moq} ${p.unit}`, 'info');
        state.cart[id] = { ...p, price: getSellingPrice(p), qty: p.moq };
    } else {
        state.cart[id] = { ...p, price: getSellingPrice(p), qty };
    }
    updateUI();
    renderProducts(state.currentCategory);
}

export function removeItem(id) {
    delete state.cart[id];
    showToast('Item removed', 'info');
    updateUI();
    renderProducts(state.currentCategory);
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
