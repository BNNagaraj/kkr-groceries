import { db } from '../services/firebase.js';
import { state, products, isAdmin } from '../store.js';
import { escapeHTML } from '../utils/dom.js';
import { generateAPMCPrices, getSellingPrice } from '../services/apmc.js';
import { renderProducts } from './products.js';
import { saveAdminSettings } from '../services/settings.js';
import { updateOrderStatus } from '../services/orders.js';

export function toggleAdmin() {
    if (!isAdmin()) {
        if (window.showToast) window.showToast('Admin access restricted', 'error');
        return;
    }
    const p = document.getElementById('adminPanel');
    p.classList.toggle('open');
    if (p.classList.contains('open')) {
        renderPricesTab();
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
}

export function switchAdminTab(tab, btn) {
    document.querySelectorAll('#adminPanel .admin-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    ['Prices', 'Apmc', 'History', 'Stats', 'Orders'].forEach(t => {
        const el = document.getElementById('admin' + t + 'Tab');
        if (el) el.style.display = tab === t.toLowerCase() ? 'block' : 'none';
    });

    if (tab === 'prices') renderPricesTab();
    if (tab === 'apmc') renderApmcTab();
    if (tab === 'history') renderHistoryTab();
    if (tab === 'stats') renderStatsTab();
    if (tab === 'orders') renderOrdersTab();
}

export function renderPricesTab() {
    let h = `<div class="commission-global"><label>\uD83D\uDCB0 Commission %:</label><input type="number" class="commission-input" id="globalCommission" value="${state.commissionPercent}" min="0" max="100" step="0.5" style="width:80px"><span style="font-size:0.8rem;color:#64748b">Applied to APMC base prices</span></div>`;
    h += '<table class="price-table"><thead><tr><th>Product</th><th>APMC \u20B9</th><th>Sell \u20B9</th><th>MOQ</th><th>Unit</th></tr></thead><tbody>';

    products.forEach(p => {
        const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
        const apmcP = apmc ? apmc.modalPrice : '-';
        const sp = getSellingPrice(p);
        h += `<tr><td><strong>${p.name}</strong><br><span style="color:#64748b;font-size:0.75rem">${p.telugu}</span></td><td style="color:#3b82f6;font-weight:700">\u20B9${apmcP}</td><td style="color:#059669;font-weight:800">\u20B9${sp}</td><td><input type="number" class="moq-input" id="moq-${p.id}" value="${p.moq}" min="1"></td><td>${p.unit}</td></tr>`;
    });

    h += '</tbody></table><button class="save-btn" onclick="window.saveAdminSettings()">\u2705 Save Settings</button><p style="margin-top:0.5rem;font-size:0.8rem;color:#64748b">Settings are saved to cloud and synced to all users.</p>';
    document.getElementById('adminPricesTab').innerHTML = h;
}

export function renderApmcTab() {
    if (!state.apmcPrices) generateAPMCPrices(state.selectedApmcMarket);
    const d = state.apmcPrices[0] ? state.apmcPrices[0].date : 'N/A';

    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
                        <div>
                            <select id="apmcMarketSelect" onchange="window.generateAPMCPrices(this.value);window.renderApmcTab();window.renderProducts(window.currentCategory);" style="padding:0.4rem;font-weight:700;border:2px solid #e2e8f0;border-radius:8px;margin-bottom:0.25rem">
                                <option value="Bowenpally" ${state.selectedApmcMarket === 'Bowenpally' ? 'selected' : ''}>Hyderabad (Bowenpally)</option>
                                <option value="Gaddiannaram" ${state.selectedApmcMarket === 'Gaddiannaram' ? 'selected' : ''}>Hyderabad (Gaddiannaram)</option>
                                <option value="Gudimalkapur" ${state.selectedApmcMarket === 'Gudimalkapur' ? 'selected' : ''}>Hyderabad (Gudimalkapur)</option>
                                <option value="Monda" ${state.selectedApmcMarket === 'Monda' ? 'selected' : ''}>Secunderabad (Monda Market)</option>
                            </select>
                            <p style="font-size:0.8rem;color:#64748b">Date: ${d} | Unit: \u20B9/Quintal</p>
                        </div>
                        <button onclick="window.generateAPMCPrices(document.getElementById('apmcMarketSelect').value);window.renderApmcTab();window.renderProducts(window.currentCategory);window.showToast('Prices refreshed!','success')" style="padding:0.5rem 1rem;background:#3b82f6;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem">\u21BB Refresh</button>
                    </div>`;

    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.5rem;margin-bottom:1rem;text-align:center"><div style="padding:0.5rem;background:#dbeafe;border-radius:8px"><div style="font-size:0.7rem;color:#1e40af;font-weight:700">MIN</div></div><div style="padding:0.5rem;background:#d1fae5;border-radius:8px"><div style="font-size:0.7rem;color:#065f46;font-weight:700">MODAL</div></div><div style="padding:0.5rem;background:#fee2e2;border-radius:8px"><div style="font-size:0.7rem;color:#991b1b;font-weight:700">MAX</div></div></div>';

    state.apmcPrices.forEach(p => {
        h += `<div class="apmc-rate-row"><div class="apmc-rate-name">${p.commodity}</div><div class="apmc-rate-prices"><span class="apmc-min">\u20B9${p.minPrice}</span><span class="apmc-modal">\u20B9${p.modalPrice}</span><span class="apmc-max">\u20B9${p.maxPrice}</span></div></div>`;
    });
    document.getElementById('adminApmcTab').innerHTML = h;
}

export async function adminUpdateOrderStatus(id, newStatus) {
    try {
        await updateOrderStatus(id, newStatus);
        if (window.showToast) window.showToast(`Order ${escapeHTML(id)} marked as ${escapeHTML(newStatus)}`, 'success');
        renderOrdersTab();
    } catch (e) {
        if (window.showToast) window.showToast('Failed to update: ' + e.message, 'error');
    }
}

export async function renderOrdersTab() {
    let orders = [];
    try {
        const snap = await db.collection('orders').orderBy('createdAt', 'desc').get();
        orders = snap.docs.map(d => d.data());
    } catch (e) {
        try {
            const snap = await db.collection('orders').get();
            orders = snap.docs.map(d => d.data());
        }
        catch (e2) { console.log('Error loading orders:', e2); }
    }

    if (!orders.length) {
        document.getElementById('adminOrdersTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\uD83D\uDCE6 No orders yet</div>';
        return;
    }

    document.getElementById('adminOrdersTab').innerHTML = orders.map(o => {
        const sColor = o.status === 'Fulfilled' ? '#10b981' : (o.status === 'Accepted' ? '#3b82f6' : (o.status === 'Rejected' ? '#ef4444' : '#f59e0b'));
        let actions = '';
        if (o.status === 'Pending' || !o.status) {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem"><button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Accepted')" style="flex:1;background:#3b82f6;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Accept</button><button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Rejected')" style="flex:1;background:#fee2e2;color:#ef4444;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Reject</button></div>`;
        } else if (o.status === 'Accepted') {
            actions = `<div style="margin-top:0.5rem"><button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Fulfilled')" style="width:100%;background:#10b981;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Mark as Fulfilled</button></div>`;
        }

        return `<div class="history-card">
                    <div class="h-header" style="align-items:flex-start">
                        <div>
                            <span class="h-date">${escapeHTML(o.timestamp)}</span>
                            <div class="h-id">${escapeHTML(o.id)}</div>
                            <div style="font-size:0.85rem;color:#475569;margin-top:2px">${escapeHTML(o.customerName)} - ${escapeHTML(o.phone)}</div>
                        </div>
                        <span style="background:${sColor}20;color:${sColor};padding:0.25rem 0.5rem;border-radius:12px;font-size:0.75rem;font-weight:700">${escapeHTML(o.status || 'Pending')}</span>
                    </div>
                    <div class="h-items" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f1f5f9">${escapeHTML(o.orderSummary || '')}</div>
                    <div class="h-total" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
                        <span>${o.productCount || 0} items</span>
                        <span style="font-size:1.1rem;font-weight:800;color:#0f172a">${escapeHTML(o.totalValue || '')}</span>
                    </div>
                    ${actions}
                </div>`;
    }).join('');
}

export function renderHistoryTab() {
    document.getElementById('adminHistoryTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\u23F3 Order history will appear here</div>';
}

export async function renderStatsTab() {
    let orders = [];
    try {
        const snap = await db.collection('orders').get();
        orders = snap.docs.map(d => d.data());
    } catch (e) { console.log('Error loading stats:', e); }

    const rev = orders.reduce((s, o) => s + parseInt((o.totalValue || '0').replace(/[^0-9]/g, ''), 10), 0);
    const pop = {};
    orders.forEach(o => {
        if (o.orderSummary) {
            o.orderSummary.split(', ').forEach(x => {
                const n = x.split(' x')[0];
                pop[n] = (pop[n] || 0) + 1;
            });
        }
    });
    const top5 = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const customers = new Set(orders.map(o => o.customerName || o.userId)).size;

    let h = `<div class="dash-stats"><div class="dash-stat" style="background:#f0fdf4"><div class="val" style="color:#059669">${orders.length}</div><div class="lbl">Total Orders</div></div><div class="dash-stat" style="background:#eff6ff"><div class="val" style="color:#2563eb">\u20B9${rev.toLocaleString('en-IN')}</div><div class="lbl">Revenue</div></div><div class="dash-stat" style="background:#fef3c7"><div class="val" style="color:#d97706">${customers}</div><div class="lbl">Customers</div></div><div class="dash-stat" style="background:#fce7f3"><div class="val" style="color:#db2777">${products.length}</div><div class="lbl">Products</div></div></div>`;

    if (top5.length) {
        h += '<h4 style="margin-bottom:0.75rem;color:#334155;font-size:0.9rem">\uD83C\uDFC6 Top Products</h4>';
        top5.forEach(([n, c], i) => {
            h += `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f1f5f9"><span style="font-weight:600">${i + 1}. ${escapeHTML(n)}</span><span style="color:#059669;font-weight:700">${c} orders</span></div>`;
        });
    }
    if (orders.length) {
        h += '<h4 style="margin:1rem 0 0.75rem;color:#334155;font-size:0.9rem">\uD83D\uDD52 Recent Orders</h4>';
        orders.slice(0, 5).forEach(o => {
            h += `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem"><span style="color:#64748b">${escapeHTML(o.timestamp)}</span><span style="font-weight:700;color:#059669">${escapeHTML(o.totalValue)}</span></div>`;
        });
    }
    document.getElementById('adminStatsTab').innerHTML = h;
}
