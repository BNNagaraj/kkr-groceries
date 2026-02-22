import { db } from '../services/firebase.js';
import { state } from '../store.js';
import { escapeHTML } from '../utils/dom.js';
import { deleteSavedAddress } from '../services/addresses.js';

export function openBuyerDashboard() {
    document.getElementById('userDropdown').classList.remove('show');
    document.getElementById('buyerPanel').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderBuyerOverview();
}

export function closeBuyerDashboard() {
    document.getElementById('buyerPanel').classList.remove('open');
    document.body.style.overflow = 'auto';
}

export function switchBuyerTab(tab, btn) {
    document.querySelectorAll('#buyerPanel .admin-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    ['Overview', 'Orders', 'Addresses'].forEach(t => {
        document.getElementById('buyer' + t + 'Tab').style.display = tab === t.toLowerCase() ? 'block' : 'none';
    });
    if (tab === 'overview') renderBuyerOverview();
    if (tab === 'orders') renderBuyerOrders();
    if (tab === 'addresses') renderBuyerAddresses();
}

export async function renderBuyerOverview() {
    let myOrders = [];
    try {
        if (state.currentUser) {
            const snap = await db.collection('orders').where('userId', '==', state.currentUser.uid).get();
            myOrders = snap.docs.map(d => d.data());
        }
    } catch (e) {
        console.log('Error loading buyer orders:', e);
    }

    const totalSpent = myOrders.reduce((s, o) => s + parseInt((o.totalValue || '0').replace(/[^0-9]/g, ''), 10), 0);
    const pop = {};
    myOrders.forEach(o => {
        if (o.orderSummary) {
            o.orderSummary.split(', ').forEach(x => {
                const n = x.split(' x')[0];
                pop[n] = (pop[n] || 0) + 1;
            });
        }
    });

    const top3 = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 3);
    let h = `<div class="dash-stats"><div class="dash-stat" style="background:#f0fdf4"><div class="val" style="color:#059669">${myOrders.length}</div><div class="lbl">My Orders</div></div><div class="dash-stat" style="background:#eff6ff"><div class="val" style="color:#2563eb">\u20B9${totalSpent.toLocaleString('en-IN')}</div><div class="lbl">Total Spent</div></div><div class="dash-stat" style="background:#fef3c7"><div class="val" style="color:#d97706">${Object.keys(pop).length}</div><div class="lbl">Products Ordered</div></div></div>`;

    if (top3.length) {
        h += '<h4 style="margin-bottom:0.75rem;color:#334155;font-size:0.9rem">\uD83C\uDFC6 Most Ordered</h4>';
        top3.forEach(([n, c], i) => {
            h += `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f1f5f9"><span style="font-weight:600">${i + 1}. ${escapeHTML(n)}</span><span style="color:#059669;font-weight:700">${c}\u00D7</span></div>`;
        });
    }
    document.getElementById('buyerOverviewTab').innerHTML = h;
}

export async function renderBuyerOrders() {
    let myOrders = [];
    try {
        if (state.currentUser) {
            const snap = await db.collection('orders').where('userId', '==', state.currentUser.uid).orderBy('createdAt', 'desc').get();
            myOrders = snap.docs.map(d => d.data());
        }
    } catch (e) {
        // Index may not exist yet, try without orderBy
        try {
            const snap = await db.collection('orders').where('userId', '==', state.currentUser.uid).get();
            myOrders = snap.docs.map(d => d.data());
        } catch (e2) {
            console.log('Error loading buyer orders:', e2);
        }
    }
    if (!myOrders.length) {
        document.getElementById('buyerOrdersTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\uD83D\uDCE6 No orders yet</div>';
        return;
    }
    document.getElementById('buyerOrdersTab').innerHTML = myOrders.map(o => {
        const sColor = o.status === 'Fulfilled' ? '#10b981' : (o.status === 'Accepted' ? '#3b82f6' : (o.status === 'Rejected' ? '#ef4444' : '#f59e0b'));
        return `<div class="history-card">
                    <div class="h-header">
                        <div>
                            <span class="h-date">${escapeHTML(o.timestamp)}</span>
                            <span class="h-id" style="display:block">${escapeHTML(o.id)}</span>
                        </div>
                        <span style="background:${sColor}20;color:${sColor};padding:0.25rem 0.5rem;border-radius:12px;font-size:0.75rem;font-weight:700">${escapeHTML(o.status || 'Pending')}</span>
                    </div>
                    <div class="h-items" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f1f5f9">${escapeHTML(o.orderSummary || '')}</div>
                    <div class="h-total" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
                        <span>${o.productCount || 0} items</span>
                        <span style="font-size:1.1rem;font-weight:800;color:#0f172a">${escapeHTML(o.totalValue || '')}</span>
                    </div>
                </div>`;
    }).join('');
}

export async function renderBuyerAddresses() {
    if (!state.currentUser) {
        document.getElementById('buyerAddressesTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">Please sign in to view addresses</div>';
        return;
    }
    let list = [];
    try {
        const snap = await db.collection('users').doc(state.currentUser.uid).collection('addresses').get();
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.log('Error loading addresses:', e); }

    if (!list.length) {
        document.getElementById('buyerAddressesTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">📍 No saved addresses</div>';
        return;
    }

    document.getElementById('buyerAddressesTab').innerHTML = list.map((a) => `
                <div class="history-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="font-weight:700;color:#0f172a;margin-bottom:0.25rem">${escapeHTML(a.name || 'Contact')} <span style="font-weight:400;color:#475569">- ${escapeHTML(a.phone || '')}</span></div>
                        <div style="font-size:0.9rem;color:#334155;margin-bottom:0.25rem">${escapeHTML(a.loc)}</div>
                        <div style="font-size:0.8rem;color:#64748b">Pincode: ${escapeHTML(a.pin)}</div>
                    </div>
                    <button onclick="window.buyerDeleteSavedAddress('${a.id}')" style="background:#fee2e2;color:#ef4444;border:none;padding:0.5rem;border-radius:8px;cursor:pointer;font-size:1rem" title="Delete Address">🗑️</button>
                </div>
            `).join('');
}

export function buyerDeleteSavedAddress(id) {
    deleteSavedAddress(id).then(() => renderBuyerAddresses());
}
