import { db, storage, functions } from '../services/firebase.js';
import { state, products, isAdmin } from '../store.js';
import { escapeHTML } from '../utils/dom.js';
import { generateAPMCPrices, getSellingPrice } from '../services/apmc.js';
import { renderProducts } from './products.js';
import { saveAdminSettings, saveAdminMapSettings } from '../services/settings.js';
import { updateOrderStatus } from '../services/orders.js';

let adminRevChartInstance = null;
let adminPopChartInstance = null;
let cropperInstance = null;
let currentCropId = null;
let currentCropExt = null;

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

    ['Prices', 'Apmc', 'History', 'Stats', 'Orders', 'Maps'].forEach(t => {
        const el = document.getElementById('admin' + t + 'Tab');
        if (el) el.style.display = tab === t.toLowerCase() ? 'block' : 'none';
    });

    if (tab === 'prices') renderPricesTab();
    if (tab === 'apmc') renderApmcTab();
    if (tab === 'history') renderHistoryTab();
    if (tab === 'stats') renderStatsTab();
    if (tab === 'orders') renderOrdersTab();
    if (tab === 'maps') renderMapsTab();
}

export function renderPricesTab() {
    let h = `<div class="commission-global" style="margin-bottom:1rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <div>
            <label>\uD83D\uDCB0 Commission %:</label>
            <input type="number" class="commission-input" id="globalCommission" value="${state.commissionPercent}" min="0" max="100" step="0.5" style="width:80px">
            <button class="save-btn" onclick="window.saveAdminSettings()" style="margin-left:0.5rem;padding:0.4rem 0.8rem">\u2705 Save Commission</button>
            <div style="font-size:0.8rem;color:#64748b;margin-top:4px">Applied to APMC base prices</div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="save-btn" onclick="window.adminExportProductsCSV()" style="background:#f59e0b;padding:0.4rem 0.8rem">📄 CSV</button>
            <button class="save-btn" onclick="window.adminExportProductsExcel()" style="background:#10b981;padding:0.4rem 0.8rem">📊 Excel</button>
            <button class="save-btn" onclick="window.adminSaveAllProducts()" style="background:#3b82f6;padding:0.4rem 0.8rem">💾 Save All</button>
            <button class="save-btn" onclick="window.adminUpgradeDefaultImages()" style="background:#8b5cf6;padding:0.4rem 0.8rem">📸 Upgrade Old Images</button>
            <div style="display:flex;gap:0.25rem;">
                <input type="text" id="newProductName" placeholder="New Product Name" style="padding:0.3rem 0.5rem; border:1px solid #cbd5e1; border-radius:4px; font-size: 0.85rem; width: 140px;">
                <button class="save-btn" onclick="window.adminAddProduct()" style="background:#6366f1;padding:0.4rem 0.8rem">➕ Add Product</button>
            </div>
        </div>
    </div>`;
    h += '<table class="price-table" style="width:100%"><thead><tr><th>Product</th><th>Image</th><th>APMC ₹</th><th>Override ₹</th><th>MOQ</th><th>Unit</th><th>Vis</th><th>Del</th></tr></thead><tbody>';

    products.forEach(p => {
        const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
        const apmcP = apmc ? apmc.modalPrice : '-';
        h += `<tr>
            <td style="min-width:120px"><strong>${escapeHTML(p.name)}</strong><br><span style="color:#64748b;font-size:0.75rem">${escapeHTML(p.telugu || '')}</span></td>
            <td>
                <div style="display:flex;flex-direction:column;gap:4px;align-items:center">
                    <img src="${escapeHTML(p.image || '')}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;${p.image ? '' : 'display:none'}" id="img-preview-${p.id}" onerror="this.style.display='none'">
                    <input type="file" accept="image/*" style="font-size:0.7rem;width:120px" onchange="window.adminUploadImage(event, '${p.id}')">
                </div>
                <input type="hidden" id="image-${p.id}" value="${escapeHTML(p.image || '')}">
            </td>
            <td style="color:#3b82f6;font-weight:700">\u20B9${apmcP}</td>
            <td><input type="number" class="moq-input" id="price-${p.id}" value="${p.overridePrice || ''}" placeholder="APMC" min="0" style="width:60px"></td>
            <td><input type="number" class="moq-input" id="moq-${p.id}" value="${p.moq}" min="1" style="width:50px"></td>
            <td><input type="text" class="moq-input" id="unit-${p.id}" value="${escapeHTML(p.unit)}" style="width:50px"></td>
            <td style="text-align:center"><input type="checkbox" id="visible-${p.id}" ${p.isHidden ? '' : 'checked'}></td>
            <td style="text-align:center">
                <button onclick="window.adminDeleteProduct('${p.id}')" style="background:#ef4444;color:white;border:none;padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;font-size:0.75rem">\uD83D\uDDD1\uFE0F</button>
            </td>
        </tr>`;
    });

    h += '</tbody></table>';
    document.getElementById('adminPricesTab').innerHTML = h;
}

export function renderMapsTab() {
    const tab = document.getElementById('adminMapsTab');
    if (!tab) return;

    // Attach save handler to global window so HTML onclicks can find it
    if (!window.saveAdminMapSettings) window.saveAdminMapSettings = saveAdminMapSettings;

    const html = `
    <div style="background:white;padding:2rem;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);max-width:600px;margin:0 auto">
        <h3 style="margin-top:0;margin-bottom:1.5rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:1rem">🗺️ Map & Forms Control Panel</h3>
        
        <!-- Toggle Orders -->
        <div style="margin-bottom:1.5rem">
            <label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#334155">Order Requests Form</label>
            <div style="display:flex;align-items:center;gap:0.75rem">
                <input type="checkbox" id="mapEnableOrders" \${state.enableOrderRequests ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">
                <span style="color:#64748b;font-size:0.95rem">Enable buyers to send orders via the form</span>
            </div>
            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">If disabled, the Send Order Request button will be hidden from the main site.</p>
        </div>

        <!-- Min Order Value -->
        <div style="margin-bottom:1.5rem">
            <label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#334155">Minimum Order Value (₹)</label>
            <input type="number" id="mapMinOrderVal" value="\${state.minOrderValue}" min="0" style="width:100%;padding:0.75rem;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem">
            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">Orders below this rupee total cannot be submitted (0 for no limit).</p>
        </div>

        <!-- Geofence Radius -->
        <div style="margin-bottom:2rem">
            <label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#334155">Geofence Delivery Radius (KM)</label>
            <input type="number" id="mapGeofenceRadius" value="\${state.geofenceRadiusKm}" min="1" max="500" style="width:100%;padding:0.75rem;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem">
            <p style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem">Sets the maximum distance from Hyderabad center allowed for placing a pin.</p>
        </div>

        <button onclick="window.saveAdminMapSettings()" style="width:100%;background:#059669;color:white;padding:1rem;border:none;border-radius:8px;font-weight:700;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 6px rgba(5,150,105,0.2)">Save Map & Form Controls</button>
    </div>
    `;
    tab.innerHTML = html;
}

export function adminExportProductsCSV() {
    let csv = 'Product ID,Name,Telugu,APMC Price,Override Price,MOQ,Unit,Visibility\n';
    products.forEach(p => {
        const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
        const apmcP = apmc ? apmc.modalPrice : '';
        const vis = p.isHidden ? 'Hidden' : 'Visible';
        csv += `${escapeHTML(p.id.toString())},"${escapeHTML(p.name)}","${escapeHTML(p.telugu || '')}",${apmcP},${p.overridePrice || 0},${p.moq},${escapeHTML(p.unit)},${vis}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'kkr_products.csv';
    a.click();
}

export function adminExportProductsExcel() {
    let table = '<table border="1"><tr><th>Product ID</th><th>Name</th><th>Telugu</th><th>APMC Price</th><th>Override Price</th><th>MOQ</th><th>Unit</th><th>Visibility</th></tr>';
    products.forEach(p => {
        const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
        const apmcP = apmc ? apmc.modalPrice : '';
        const vis = p.isHidden ? 'Hidden' : 'Visible';
        table += `<tr><td>${escapeHTML(p.id.toString())}</td><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.telugu || '')}</td><td>${apmcP}</td><td>${p.overridePrice || 0}</td><td>${p.moq}</td><td>${escapeHTML(p.unit)}</td><td>${vis}</td></tr>`;
    });
    table += '</table>';
    const uri = 'data:application/vnd.ms-excel;base64,' + btoa(unescape(encodeURIComponent(table)));
    const a = document.createElement('a');
    a.href = uri;
    a.download = 'kkr_products.xls';
    a.click();
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

let currentAdminOrders = [];
export async function renderOrdersTab() {
    let orders = [];
    try {
        const snap = await db.collection('orders').orderBy('createdAt', 'desc').get();
        orders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (e) {
        try {
            const snap = await db.collection('orders').get();
            orders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            orders.sort((a, b) => {
                const tA = a.createdAt ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });
        }
        catch (e2) { console.log('Error loading orders:', e2); }
    }

    currentAdminOrders = orders; // Cache for edit loop
    const filterState = window.adminOrderFilterState || 'all';

    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h3 style="margin:0;color:#1e293b;font-size:1.1rem">Order Management</h3>
        <select id="adminOrderFilterSelect" onchange="window.adminOrderFilterState = this.value; window.renderOrdersTab()" style="padding:0.4rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.9rem">
            <option value="all" ${filterState === 'all' ? 'selected' : ''}>All Orders</option>
            <option value="today" ${filterState === 'today' ? 'selected' : ''}>Today</option>
            <option value="week" ${filterState === 'week' ? 'selected' : ''}>This Week</option>
            <option value="fortnight" ${filterState === 'fortnight' ? 'selected' : ''}>This Fortnight</option>
            <option value="month" ${filterState === 'month' ? 'selected' : ''}>This Month</option>
            <option value="quarter" ${filterState === 'quarter' ? 'selected' : ''}>This Quarter</option>
            <option value="half" ${filterState === 'half' ? 'selected' : ''}>Half Yearly</option>
            <option value="year" ${filterState === 'year' ? 'selected' : ''}>This Year</option>
        </select>
    </div>`;

    const now = Date.now();
    const DAY = 86400000;

    let filteredOrders = orders.filter(o => {
        if (filterState === 'all') return true;
        const ts = o.createdAt ? o.createdAt.toMillis() : null;
        if (!ts) return true;
        const diff = now - ts;
        if (filterState === 'today') return diff <= DAY;
        if (filterState === 'week') return diff <= 7 * DAY;
        if (filterState === 'fortnight') return diff <= 14 * DAY;
        if (filterState === 'month') return diff <= 30 * DAY;
        if (filterState === 'quarter') return diff <= 90 * DAY;
        if (filterState === 'half') return diff <= 180 * DAY;
        if (filterState === 'year') return diff <= 365 * DAY;
        return true;
    });

    if (!filteredOrders.length) {
        h += '<div style="text-align:center;color:#94a3b8;padding:2rem">\uD83D\uDCE6 No orders found for this timeframe</div>';
        document.getElementById('adminOrdersTab').innerHTML = h;
        return;
    }

    h += filteredOrders.map(o => {
        const sColor = o.status === 'Fulfilled' ? '#10b981' : (o.status === 'Accepted' ? '#3b82f6' : (o.status === 'Rejected' ? '#ef4444' : '#f59e0b'));
        let actions = '';
        if (o.status === 'Pending' || !o.status) {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem">
                           <button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Accepted')" style="flex:1;background:#3b82f6;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Accept</button>
                           <button onclick="window.adminEditOrder('${escapeHTML(o.id)}')" style="flex:1;background:#f59e0b;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Edit Items</button>
                           <button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Rejected')" style="flex:1;background:#fee2e2;color:#ef4444;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Reject</button>
                       </div>`;
        } else if (o.status === 'Accepted') {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem">
                           <button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Fulfilled')" style="flex:2;background:#10b981;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Mark as Fulfilled</button>
                           <button onclick="window.adminEditOrder('${escapeHTML(o.id)}')" style="flex:1;background:#f59e0b;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Edit</button>
                       </div>`;
        } else if (o.status === 'Fulfilled') {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem">
                           <button onclick="window.adminEditOrder('${escapeHTML(o.id)}')" style="flex:1;background:#f59e0b;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Edit Past Order</button>
                       </div>`;
        }

        const loc = o.location ? `<div style="margin-top:4px"><a href="https://maps.google.com/?q=${encodeURIComponent(o.location)}" target="_blank" style="color:#0ea5e9;text-decoration:none;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHTML(o.location)}</a></div>` : '';

        return `<div class="history-card">
                    <div class="h-header" style="align-items:flex-start">
                        <div>
                            <span class="h-date">${escapeHTML(o.timestamp)}</span>
                            <div class="h-id">${escapeHTML(o.id)}</div>
                            <div style="font-size:0.85rem;color:#475569;margin-top:2px"><strong>${escapeHTML(o.customerName)}</strong> - ${escapeHTML(o.phone)}</div>
                            ${loc}
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

    document.getElementById('adminOrdersTab').innerHTML = h;
}

let currentEditOrderId = null;
let currentEditOrderStatus = null;
let originalCartData = [];

export function closeEditOrderModal() {
    document.getElementById('editOrderModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

export function recalcEditOrder() {
    let tO = 0;
    let tA = 0;
    let tF = 0;

    originalCartData.forEach((item, idx) => {
        tO += (item.qty * item.price);

        const aqEl = document.getElementById(`ea-qty-${idx}`);
        const arEl = document.getElementById(`ea-rate-${idx}`);
        if (aqEl && arEl) {
            const aq = parseFloat(aqEl.value) || 0;
            const ar = parseFloat(arEl.value) || 0;
            const aAmt = aq * ar;
            tA += aAmt;
            document.getElementById(`ea-amt-${idx}`).textContent = `₹${aAmt.toLocaleString('en-IN')}`;
        }

        if (currentEditOrderStatus === 'Fulfilled') {
            const fqEl = document.getElementById(`ef-qty-${idx}`);
            const frEl = document.getElementById(`ef-rate-${idx}`);
            if (fqEl && frEl) {
                const fq = parseFloat(fqEl.value) || 0;
                const fr = parseFloat(frEl.value) || 0;
                const fAmt = fq * fr;
                tF += fAmt;
                document.getElementById(`ef-amt-${idx}`).textContent = `₹${fAmt.toLocaleString('en-IN')}`;
            }
        }
    });

    document.getElementById('grandTotalOriginal').textContent = `₹${tO.toLocaleString('en-IN')}`;
    document.getElementById('grandTotalAccepted').textContent = `₹${tA.toLocaleString('en-IN')}`;
    if (currentEditOrderStatus === 'Fulfilled') document.getElementById('grandTotalFulfilled').textContent = `₹${tF.toLocaleString('en-IN')}`;
}

export async function adminEditOrder(id) {
    try {
        const o = currentAdminOrders.find(x => String(x.id) === String(id));
        if (!o) {
            if (window.showToast) window.showToast('Could not locate order ID in cache.', 'error');
            return;
        }
        if (!o.cart || !o.cart.length) {
            if (window.showToast) window.showToast('Cannot edit legacy order lacking cart array.', 'error');
            return;
        }

        currentEditOrderId = id;
        currentEditOrderStatus = o.status || 'Pending';

        // Store original snapshot
        // If originalCart isn't stored explicitly, o.cart is the current active cart.
        // For our robust logic, we assume o.cart WAS the originally mapped cart if revised carts are null.
        // If a user edits a cart 3 times, `cart` updates. We should strictly preserve `originalCart` permanently.
        if (!o.originalCart) {
            // Safe to lock the original
            await db.collection('orders').doc(id).update({ originalCart: o.cart });
            originalCartData = o.cart;
        } else {
            originalCartData = o.originalCart;
        }

        const acCart = o.revisedAcceptedCart || o.cart;
        const fuCart = o.revisedFulfilledCart || acCart;

        document.getElementById('editOrderIdLabel').textContent = escapeHTML(id);
        document.getElementById('editOrderStatusLabel').textContent = escapeHTML(currentEditOrderStatus);

        const fHeader = document.getElementById('revisedFulfilledHeader');
        const fFooter = document.getElementById('grandTotalFulfilled');

        let showF = (currentEditOrderStatus === 'Fulfilled');
        fHeader.style.display = showF ? 'table-cell' : 'none';
        fFooter.style.display = showF ? 'table-cell' : 'none';

        let tbody = '';

        originalCartData.forEach((item, idx) => {
            const oAmt = item.qty * item.price;
            const acItem = acCart.find(x => x.name === item.name) || { ...item, qty: 0 };
            const fuItem = fuCart.find(x => x.name === item.name) || { ...acItem };

            let accCol = `
            <div style="display:flex;gap:0.5rem;align-items:center;justify-content:flex-end;margin-bottom:0.25rem;">
                <input type="number" id="ea-qty-${idx}" value="${acItem.qty}" min="0" step="1" style="width:60px;padding:0.25rem;text-align:right" oninput="window.recalcEditOrder()">
                <span style="font-size:0.8rem;color:#64748b">x</span>
                <input type="number" id="ea-rate-${idx}" value="${acItem.price || item.price}" min="0" style="width:70px;padding:0.25rem;text-align:right" oninput="window.recalcEditOrder()">
            </div>
            <div style="font-weight:700;color:#0f172a;" id="ea-amt-${idx}">₹${(acItem.qty * (acItem.price || item.price)).toLocaleString('en-IN')}</div>
        `;

            let fulCol = '';
            if (showF) {
                fulCol = `<td style="padding:0.75rem;border:1px solid #cbd5e1;text-align:right;background:#ecfdf5;">
                <div style="display:flex;gap:0.5rem;align-items:center;justify-content:flex-end;margin-bottom:0.25rem;">
                    <input type="number" id="ef-qty-${idx}" value="${fuItem.qty}" min="0" step="1" style="width:60px;padding:0.25rem;text-align:right" oninput="window.recalcEditOrder()">
                    <span style="font-size:0.8rem;color:#64748b">x</span>
                    <input type="number" id="ef-rate-${idx}" value="${fuItem.price || item.price}" min="0" style="width:70px;padding:0.25rem;text-align:right" oninput="window.recalcEditOrder()">
                </div>
                <div style="font-weight:700;color:#065f46;" id="ef-amt-${idx}">₹${(fuItem.qty * (fuItem.price || item.price)).toLocaleString('en-IN')}</div>
            </td>`;
            } else {
                fulCol = `<td style="display:none;" id="ef-cell-${idx}"></td>`;
            }

            tbody += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:0.75rem;border:1px solid #cbd5e1;">
                    <div style="font-weight:600;color:#1e293b">${escapeHTML(item.name)}</div>
                    <div style="font-size:0.8rem;color:#64748b">${escapeHTML(item.unit)}</div>
                </td>
                <td style="padding:0.75rem;border:1px solid #cbd5e1;text-align:right;background:#f8fafc;">
                    <div style="color:#475569;font-size:0.85rem;margin-bottom:0.25rem;">${item.qty} x ₹${item.price}</div>
                    <div style="font-weight:700;">₹${oAmt.toLocaleString('en-IN')}</div>
                </td>
                <td style="padding:0.75rem;border:1px solid #cbd5e1;text-align:right;background:#eff6ff;">
                    ${accCol}
                </td>
                ${fulCol}
            </tr>
        `;
        });

        document.getElementById('editOrderTableBody').innerHTML = tbody;
        document.getElementById('editOrderModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';

        recalcEditOrder();
    } catch (err) {
        console.error('Error opening edit modal:', err);
        if (window.showToast) window.showToast('Error opening modal: ' + err.message, 'error');
    }
}

export async function saveEditedOrder() {
    if (!currentEditOrderId) return;
    const saveBtn = document.querySelector('#editOrderModal .modal-content button:nth-child(2)');
    if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }

    try {
        let revAccCart = [];
        let revFulCart = [];
        let totalVal = 0;
        let finalSummary = [];
        let newCount = 0;

        originalCartData.forEach((item, idx) => {
            const aq = parseFloat(document.getElementById(`ea-qty-${idx}`).value) || 0;
            const ar = parseFloat(document.getElementById(`ea-rate-${idx}`).value) || 0;
            if (aq > 0) revAccCart.push({ ...item, qty: aq, price: ar });

            if (currentEditOrderStatus === 'Fulfilled') {
                const fq = parseFloat(document.getElementById(`ef-qty-${idx}`).value) || 0;
                const fr = parseFloat(document.getElementById(`ef-rate-${idx}`).value) || 0;
                if (fq > 0) {
                    revFulCart.push({ ...item, qty: fq, price: fr });
                    totalVal += (fq * fr);
                    finalSummary.push(`${item.name} x${fq}`);
                    newCount++;
                }
            } else {
                totalVal += (aq * ar);
                finalSummary.push(`${item.name} x${aq}`);
                newCount++;
            }
        });

        const activeCart = currentEditOrderStatus === 'Fulfilled' ? revFulCart : revAccCart;

        const payload = {
            revisedAcceptedCart: revAccCart,
            orderSummary: finalSummary.join(', '),
            totalValue: '₹' + totalVal.toLocaleString('en-IN'),
            productCount: newCount,
            cart: activeCart
        };

        if (currentEditOrderStatus === 'Fulfilled') {
            payload.revisedFulfilledCart = revFulCart;
        }

        await db.collection('orders').doc(currentEditOrderId).update(payload);

        if (window.showToast) window.showToast('Order saved successfully!', 'success');
        closeEditOrderModal();
        renderOrdersTab();
    } catch (err) {
        console.error('Save Edit Error:', err);
        if (window.showToast) window.showToast('Failed to save edits.', 'error');
    } finally {
        if (saveBtn) { saveBtn.textContent = 'Save Changes'; saveBtn.disabled = false; }
    }
}

export async function adminSaveAllProducts() {
    try {
        const batch = db.batch();
        let count = 0;
        products.forEach(p => {
            const moqEl = document.getElementById('moq-' + p.id);
            if (!moqEl) return;
            const moq = parseInt(moqEl.value, 10);
            const pVal = document.getElementById('price-' + p.id).value;
            const overridePrice = pVal ? parseFloat(pVal) : 0;
            const unit = document.getElementById('unit-' + p.id).value;
            const isHidden = !document.getElementById(`visible-${p.id}`).checked;
            const image = document.getElementById(`image-${p.id}`).value;

            const docRef = db.collection('products').doc(p.id.toString());
            batch.update(docRef, { moq, overridePrice, unit, isHidden, image });
            count++;
        });

        if (count > 0) {
            await batch.commit();
            if (window.showToast) window.showToast(`Successfully saved ${count} products!`, 'success');
            setTimeout(() => { if (document.getElementById('adminPanel').classList.contains('open')) window.renderPricesTab() }, 500);
        }
    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast('Failed to bulk save products', 'error');
    }
}

export async function adminDeleteProduct(id) {
    if (!confirm('Are you sure you want to completely delete this product from the database?')) return;
    try {
        await db.collection('products').doc(id.toString()).delete();
        if (window.showToast) window.showToast('Product deleted', 'success');
    } catch (e) {
        if (window.showToast) window.showToast('Failed to delete product', 'error');
    }
}

export async function adminAddProduct() {
    const inputEl = document.getElementById('newProductName');
    let name = inputEl ? inputEl.value : '';

    if (!name || !name.trim()) {
        if (window.showToast) window.showToast('Please type a product name first', 'error');
        if (inputEl) inputEl.focus();
        return;
    }

    // Auto-increment maximum ID (ignore non-numeric IDs like arbitrary strings if any exist)
    const validNumericIds = products.map(p => Number(p.id)).filter(n => !isNaN(n));
    const maxId = validNumericIds.length > 0 ? Math.max(...validNumericIds) : 0;
    const newId = (maxId + 1).toString();

    try {
        await db.collection('products').doc(newId).set({
            name: name.trim(),
            telugu: '',
            hindi: '',
            price: 0,
            unit: 'kg',
            moq: 1,
            category: 'daily',
            image: '',
            isHidden: false
        });

        if (inputEl) inputEl.value = ''; // Clear input
        if (window.showToast) window.showToast(`Product ${newId} added. You can now edit its details or upload an image inline.`, 'success');
        setTimeout(() => { if (document.getElementById('adminPanel').classList.contains('open')) window.renderPricesTab() }, 500);
    } catch (e) {
        console.error("Add Product Error:", e);
        if (window.showToast) window.showToast('Failed to add product: ' + e.message, 'error');
    }
}

export async function adminUploadImage(event, productId) {
    const file = event.target.files[0];
    if (!file) return;

    const maxFileSize = 10 * 1024 * 1024; // 10MB Limit for raw uploads before crop
    if (file.size > maxFileSize) {
        if (window.showToast) window.showToast('File is too large. Max 10MB.', 'error');
        event.target.value = '';
        return;
    }

    currentCropId = productId;
    currentCropExt = file.name.split('.').pop();

    const reader = new FileReader();
    reader.onload = (e) => {
        const cropperImg = document.getElementById('cropperImage');
        const modal = document.getElementById('cropperModal');

        // Ensure modal is visible so dimensions are available
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }

        // Wait for image load before initializing cropper
        cropperImg.onload = () => {
            try {
                if (typeof window.Cropper !== 'function') {
                    console.error('Cropper library not found on window object');
                    if (window.showToast) window.showToast('Error: Image cropper library failed to load.', 'error');
                    return;
                }

                cropperInstance = new window.Cropper(cropperImg, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 0.8,
                    responsive: true,
                    background: false
                });
            } catch (err) {
                console.error('Failed to initialize Cropper:', err);
                if (window.showToast) window.showToast('Failed to start image adjustment tool.', 'error');
            }
        };

        cropperImg.src = e.target.result;
        document.getElementById('saveCropBtn').onclick = () => cropAndUploadImage();
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be selected again if needed
    event.target.value = '';
}

export async function cropAndUploadImage() {
    const saveBtn = document.getElementById('saveCropBtn');
    const originalBtnText = 'Save Crop & Upload';

    if (!cropperInstance || !currentCropId) {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalBtnText;
        }
        return;
    }

    if (!saveBtn) return;

    try {
        saveBtn.textContent = 'Uploading...';
        saveBtn.disabled = true;

        const canvas = cropperInstance.getCroppedCanvas({
            width: 800,
            height: 800
        });

        if (!canvas) throw new Error('Could not create cropped canvas');

        // Convert to Promise to handle errors naturally in try-catch
        const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
        });

        if (!blob) throw new Error('Failed to process image cropped area');

        if (window.showToast) window.showToast('Processing image...', 'info');
        const base64Image = canvas.toDataURL('image/jpeg', 0.9);

        if (window.showToast) window.showToast('Uploading via secure tunnel...', 'info');

        // Call the Cloud Function instead of direct storage write
        const uploadFn = functions.httpsCallable('uploadProductImage');
        const result = await uploadFn({
            productId: currentCropId,
            base64Image: base64Image
        });

        if (!result.data || !result.data.success) {
            throw new Error(result.data?.message || 'Secure upload failed');
        }

        const url = result.data.url;

        // 3. Update UI State
        const imgInput = document.getElementById(`image-${currentCropId}`);
        if (imgInput) imgInput.value = url;

        const previewEl = document.getElementById(`img-preview-${currentCropId}`);
        if (previewEl) {
            previewEl.src = url;
            previewEl.style.display = 'block';
        }

        if (window.showToast) window.showToast('Image updated successfully!', 'success');
        closeCropperModal();

    } catch (e) {
        console.error('Image Upload Error:', e);
        const errorMsg = e.message || 'Unknown error';
        if (window.showToast) window.showToast('Upload failed: ' + errorMsg, 'error');

    } finally {
        // Ensure button is at least enabled if we didn't close the modal
        const modal = document.getElementById('cropperModal');
        if (modal && modal.style.display !== 'none' && saveBtn) {
            saveBtn.disabled = false;
            if (saveBtn.textContent === 'Uploading...') {
                saveBtn.textContent = originalBtnText;
            }
        }
    }
}

export function closeCropperModal() {
    document.getElementById('cropperModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
}

export function renderHistoryTab() {
    const el = document.getElementById('adminHistoryTab');
    if (el) el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\u23F3 Order history will appear here</div>';
}

export async function renderStatsTab() {
    let orders = [];
    try {
        const snap = await db.collection('orders').get();
        orders = snap.docs.map(d => d.data());
    } catch (e) { console.log('Error loading stats:', e); }

    const rev = orders.reduce((s, o) => s + parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10), 0);
    const pop = {};
    const revByDate = {};

    orders.forEach(o => {
        if (o.orderSummary) {
            o.orderSummary.split(', ').forEach(x => {
                const n = x.split(' x')[0];
                pop[n] = (pop[n] || 0) + 1;
            });
        }
        if (o.timestamp) {
            const d = o.timestamp.split(',')[0];
            const v = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            revByDate[d] = (revByDate[d] || 0) + v;
        }
    });

    const customers = new Set(orders.map(o => o.customerName || o.userId)).size;

    let h = `<div class="dash-stats">
        <div class="dash-stat" style="background:#f0fdf4"><div class="val" style="color:#059669">${orders.length}</div><div class="lbl">Total Orders</div></div>
        <div class="dash-stat" style="background:#eff6ff"><div class="val" style="color:#2563eb">\u20B9${rev.toLocaleString('en-IN')}</div><div class="lbl">Revenue</div></div>
        <div class="dash-stat" style="background:#fef3c7"><div class="val" style="color:#d97706">${customers}</div><div class="lbl">Customers</div></div>
        <div class="dash-stat" style="background:#fce7f3"><div class="val" style="color:#db2777">${products.length}</div><div class="lbl">Products</div></div>
    </div>`;

    if (orders.length > 0) {
        h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;margin-bottom:1rem">
            <div style="background:white;padding:1rem;border-radius:12px;border:1px solid #e2e8f0"><canvas id="adminRevChart"></canvas></div>
            <div style="background:white;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;max-height:300px;display:flex;justify-content:center"><canvas id="adminPopChart"></canvas></div>
        </div>`;
    } else {
        h += `<div style="text-align:center;padding:3rem;color:#94a3b8">\uD83D\uDCCA Awaiting orders to generate analytics</div>`;
    }

    document.getElementById('adminStatsTab').innerHTML = h;

    if (orders.length > 0) {
        setTimeout(() => {
            if (adminRevChartInstance) adminRevChartInstance.destroy();
            if (adminPopChartInstance) adminPopChartInstance.destroy();

            const ctxRev = document.getElementById('adminRevChart');
            if (ctxRev && window.Chart) {
                adminRevChartInstance = new window.Chart(ctxRev, {
                    type: 'line',
                    data: {
                        labels: Object.keys(revByDate).slice(-7),
                        datasets: [{
                            label: 'Daily Revenue (\u20B9)',
                            data: Object.values(revByDate).slice(-7),
                            borderColor: '#3b82f6',
                            tension: 0.3,
                            fill: true,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)'
                        }]
                    },
                    options: { maintainAspectRatio: false }
                });
            }

            const ctxPop = document.getElementById('adminPopChart');
            const top5 = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 5);
            if (ctxPop && top5.length && window.Chart) {
                adminPopChartInstance = new window.Chart(ctxPop, {
                    type: 'doughnut',
                    data: {
                        labels: top5.map(x => x[0]),
                        datasets: [{
                            data: top5.map(x => x[1]),
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
                        }]
                    },
                    options: { maintainAspectRatio: false }
                });
            }
        }, 100);
    }
}

export async function adminUpgradeDefaultImages() {
    if (!confirm('Are you sure you want to upgrade the first 12 products to use new high-resolution images?')) return;

    const updatedImages = {
        1: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80",
        2: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&q=80",
        3: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80",
        4: "https://images.unsplash.com/photo-1596639556108-7a544df8bb3f?w=800&q=80",
        5: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Okra_Abelmoschus_esculentus.jpg/800px-Okra_Abelmoschus_esculentus.jpg",
        6: "https://images.unsplash.com/photo-1604568102377-f273edcfebbc?w=800&q=80",
        7: "https://images.unsplash.com/photo-1568584711462-24cc6ad04aa6?w=800&q=80",
        8: "https://images.unsplash.com/photo-1597362925123-77861d3bfac1?w=800&q=80",
        9: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&q=80",
        10: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&q=80",
        11: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Bottle_gourd.jpg/800px-Bottle_gourd.jpg",
        12: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Luffa_aegyptiaca_fruit.jpg/800px-Luffa_aegyptiaca_fruit.jpg"
    };

    try {
        if (window.showToast) window.showToast('Upgrading images...', 'info');
        const batch = db.batch();
        let upgradeCount = 0;

        for (const [id, imageUrl] of Object.entries(updatedImages)) {
            if (products.some(p => String(p.id) === id)) {
                const docRef = db.collection('products').doc(id);
                batch.update(docRef, { image: imageUrl });
                upgradeCount++;
            }
        }

        if (upgradeCount > 0) {
            await batch.commit();
            if (window.showToast) window.showToast(`Successfully upgraded ${upgradeCount} product images to high-res!`, 'success');
            setTimeout(() => { if (document.getElementById('adminPanel').classList.contains('open')) window.renderPricesTab() }, 500);
        } else {
            if (window.showToast) window.showToast('No matching products found to upgrade.', 'info');
        }
    } catch (e) {
        console.error("Upgrade Images Error:", e);
        if (window.showToast) window.showToast('Failed to upgrade images: ' + e.message, 'error');
    }
}
