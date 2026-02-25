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

    const totalSpent = myOrders.reduce((s, o) => s + parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10), 0);
    const pop = {};
    const spentByDate = {};
    myOrders.forEach(o => {
        if (o.orderSummary) {
            o.orderSummary.split(', ').forEach(x => {
                const n = x.split(' x')[0];
                pop[n] = (pop[n] || 0) + 1;
            });
        }
        if (o.timestamp) {
            const d = o.timestamp.split(',')[0];
            const v = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            spentByDate[d] = (spentByDate[d] || 0) + v;
        }
    });

    let h = `<div class="dash-stats">
        <div class="dash-stat" style="background:#f0fdf4"><div class="val" style="color:#059669">${myOrders.length}</div><div class="lbl">My Orders</div></div>
        <div class="dash-stat" style="background:#eff6ff"><div class="val" style="color:#2563eb">\u20B9${totalSpent.toLocaleString('en-IN')}</div><div class="lbl">Total Spent</div></div>
        <div class="dash-stat" style="background:#fef3c7"><div class="val" style="color:#d97706">${Object.keys(pop).length}</div><div class="lbl">Items Ordered</div></div>
    </div>`;

    if (myOrders.length > 0) {
        h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin-bottom:1rem">
            <div style="background:white;padding:1rem;border-radius:12px;border:1px solid #e2e8f0"><canvas id="buyerSpendChart"></canvas></div>
            <div style="background:white;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;max-height:250px;display:flex;justify-content:center"><canvas id="buyerPopChart"></canvas></div>
        </div>`;
    } else {
        h += `<div style="text-align:center;padding:3rem;color:#94a3b8">\uD83D\uDCCA Make your first order to unlock insights!</div>`;
    }

    document.getElementById('buyerOverviewTab').innerHTML = h;

    if (myOrders.length > 0) {
        setTimeout(() => {
            const ctxSpend = document.getElementById('buyerSpendChart');
            if (ctxSpend && window.Chart) {
                new window.Chart(ctxSpend, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(spentByDate).slice(-5),
                        datasets: [{
                            label: 'Spend (\u20B9)',
                            data: Object.values(spentByDate).slice(-5),
                            backgroundColor: '#3b82f6',
                            borderRadius: 4
                        }]
                    },
                    options: { maintainAspectRatio: false }
                });
            }

            const ctxPop = document.getElementById('buyerPopChart');
            const top3 = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 3);
            if (ctxPop && top3.length && window.Chart) {
                new window.Chart(ctxPop, {
                    type: 'pie',
                    data: {
                        labels: top3.map(x => x[0]),
                        datasets: [{
                            data: top3.map(x => x[1]),
                            backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
                        }]
                    },
                    options: { maintainAspectRatio: false }
                });
            }
        }, 100);
    }
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
            // Sort by createdAt descending (latest first)
            myOrders.sort((a, b) => {
                const tA = a.createdAt ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });
        } catch (e2) {
            console.log('Error loading buyer orders:', e2);
        }
    }
    if (!myOrders.length) {
        document.getElementById('buyerOrdersTab').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">\ud83d\udce6</div>
                <h3>No orders yet</h3>
                <p>Place your first order to see it here</p>
                <button class="btn-shop-now" onclick="closeBuyerDashboard(); filterCategory('all');">
                    Shop Now
                </button>
            </div>
        `;
        return;
    }
    document.getElementById('buyerOrdersTab').innerHTML = myOrders.map(o => {
        const hasPendingMod = o.modificationStatus === 'PendingBuyerApproval';
        const sColor = o.status === 'Fulfilled' ? '#10b981' : 
                      (o.status === 'Accepted' ? '#3b82f6' : 
                      (o.status === 'Rejected' ? '#ef4444' : 
                      (hasPendingMod ? '#f97316' : '#f59e0b')));
        const statusText = hasPendingMod ? 'Modification Pending' : (o.status || 'Pending');
        // Build timeline from status timestamps
        const timeline = {
            placed: o.placedAt || o.createdAt || o.timestamp,
            accepted: o.acceptedAt,
            shipped: o.shippedAt,
            fulfilled: o.deliveredAt || o.fulfilledAt
        };
        const timelineHtml = renderOrderTimeline(o.status, timeline);
        
        // Pending modification UI
        let pendingModHtml = '';
        if (hasPendingMod && o.pendingModification) {
            const mod = o.pendingModification;
            const changesList = mod.changes ? mod.changes.map(c => `<li>${escapeHTML(c)}</li>`).join('') : '';
            pendingModHtml = `
                <div style="margin:0.75rem 0;padding:0.75rem;background:#fff7ed;border:2px solid #fed7aa;border-radius:8px;">
                    <div style="font-weight:700;color:#c2410c;margin-bottom:0.5rem;">\ud83d\udce2 Order Modification Request</div>
                    <div style="font-size:0.85rem;color:#7c2d12;margin-bottom:0.5rem;">
                        The seller has proposed changes to your order:
                    </div>
                    <ul style="margin:0.5rem 0;padding-left:1.25rem;font-size:0.85rem;color:#9a3412;">${changesList}</ul>
                    <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
                        <button onclick="window.acceptOrderModification('${escapeHTML(o.id)}')" style="flex:1;background:#10b981;color:white;border:none;padding:0.5rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.85rem;">\u2713 Accept Changes</button>
                        <button onclick="window.rejectOrderModification('${escapeHTML(o.id)}')" style="flex:1;background:#fee2e2;color:#ef4444;border:none;padding:0.5rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.85rem;">\u2715 Reject</button>
                    </div>
                    <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #fed7aa;">
                        <div style="font-size:0.8rem;color:#9a3412;">
                            <strong>New Total:</strong> ${escapeHTML(mod.proposedTotalValue || '')} 
                            <span style="color:#c2410c;">(${mod.proposedCount} items)</span>
                        </div>
                        <div style="font-size:0.75rem;color:#9a3412;margin-top:0.25rem;">
                            ${escapeHTML(mod.proposedSummary || '')}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Location with Google Maps link
        const loc = o.location ? `<div style="margin-top:4px"><a href="https://maps.google.com/?q=${encodeURIComponent(o.location)}" target="_blank" style="color:#0ea5e9;text-decoration:none;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHTML(o.location)} - Pincode: ${escapeHTML(o.pincode || 'N/A')}</a></div>` : '';
        
        return `<div class="history-card ${hasPendingMod ? 'has-pending-mod' : ''}">
                    <div class="h-header">
                        <div>
                            <span class="h-date">${escapeHTML(o.timestamp)}</span>
                            <span class="h-id" style="display:block">${escapeHTML(o.id)}</span>
                            <div style="font-size:0.85rem;color:#475569;margin-top:2px"><strong>${escapeHTML(o.customerName)}</strong> - ${escapeHTML(o.phone)}</div>
                            ${loc}
                        </div>
                        <span style="background:${sColor}20;color:${sColor};padding:0.25rem 0.5rem;border-radius:12px;font-size:0.75rem;font-weight:700">${escapeHTML(statusText)}</span>
                    </div>
                    ${pendingModHtml}
                    ${!hasPendingMod ? timelineHtml : ''}
                    <div class="h-items" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f1f5f9">
                        ${(() => {
                            const orderItems = o.cart || o.items || [];
                            if (orderItems.length === 0) {
                                return escapeHTML(o.orderSummary || '');
                            }
                            const totalValue = orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
                            return `
                                <table class="enquiry-items-table order-summary-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Unit</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${orderItems.map(item => {
                                            const itemTotal = item.price * item.qty;
                                            const imgHtml = item.image 
                                                ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" class="enquiry-item-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                                                : '';
                                            const fallbackHtml = `<span class="enquiry-item-fallback">${item.name ? item.name[0] : '?'}</span>`;
                                            return `
                                                <tr>
                                                    <td class="product-cell">
                                                        <div class="enquiry-product">
                                                            <div class="enquiry-thumb">
                                                                ${imgHtml}
                                                                ${fallbackHtml}
                                                            </div>
                                                            <div class="enquiry-product-info">
                                                                <div class="enquiry-name">${escapeHTML(item.name)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="qty-cell">${item.qty}</td>
                                                    <td class="unit-cell">${escapeHTML(item.unit)}</td>
                                                    <td class="price-cell">₹${item.price.toLocaleString('en-IN')}</td>
                                                    <td class="total-cell">₹${itemTotal.toLocaleString('en-IN')}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                    <tfoot>
                                        <tr class="grand-total-row">
                                            <td colspan="4"><strong>Grand Total</strong></td>
                                            <td><strong>₹${totalValue.toLocaleString('en-IN')}</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            `;
                        })()}
                    </div>
                    <div class="h-total" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
                        <span>${o.productCount || 0} items</span>
                        <div style="display:flex;align-items:center;gap:0.75rem">
                            <button onclick="window.downloadInvoice('${o.id}')" class="invoice-btn" title="Download Invoice">
                                \ud83d\udcc4 Invoice
                            </button>
                            <button onclick="window.reorder('${o.id}')" class="reorder-btn" title="Reorder">\ud83d\udd04 Reorder</button>
                            <span style="font-size:1.1rem;font-weight:800;color:#0f172a">${escapeHTML(o.totalValue || '')}</span>
                        </div>
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
        document.getElementById('buyerAddressesTab').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📍</div>
                <h3>No saved addresses</h3>
                <p>Your saved delivery addresses will appear here</p>
            </div>
        `;
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

/**
 * Accept order modification proposed by admin
 * @param {string} orderId - Order ID
 */
export async function acceptOrderModification(orderId) {
    try {
        const { db } = await import('../services/firebase.js');
        const { showToast } = await import('../utils/dom.js');
        
        // Get the order
        const snap = await db.collection('orders').where('id', '==', orderId).get();
        if (snap.empty) {
            showToast('Order not found', 'error');
            return;
        }
        
        const orderDoc = snap.docs[0];
        const order = orderDoc.data();
        
        if (!order.pendingModification) {
            showToast('No pending modification found', 'error');
            return;
        }
        
        // Apply the modification
        const mod = order.pendingModification;
        await orderDoc.ref.update({
            cart: mod.proposedCart,
            orderSummary: mod.proposedSummary,
            totalValue: mod.proposedTotalValue,
            productCount: mod.proposedCount,
            revisedAcceptedCart: mod.proposedCart,
            pendingModification: null,
            modificationStatus: null,
            buyerNotified: false,
            modificationAcceptedAt: new Date().toISOString()
        });
        
        showToast('Order modification accepted!', 'success');
        renderBuyerOrders();
    } catch (error) {
        console.error('Error accepting modification:', error);
        const { showToast } = await import('../utils/dom.js');
        showToast('Failed to accept modification', 'error');
    }
}

/**
 * Reject order modification proposed by admin
 * @param {string} orderId - Order ID
 */
export async function rejectOrderModification(orderId) {
    try {
        const { db } = await import('../services/firebase.js');
        const { showToast } = await import('../utils/dom.js');
        
        // Get the order
        const snap = await db.collection('orders').where('id', '==', orderId).get();
        if (snap.empty) {
            showToast('Order not found', 'error');
            return;
        }
        
        const orderDoc = snap.docs[0];
        
        // Reject the modification - keep original values
        await orderDoc.ref.update({
            pendingModification: null,
            modificationStatus: 'RejectedByBuyer',
            buyerNotified: false,
            modificationRejectedAt: new Date().toISOString()
        });
        
        showToast('Order modification rejected', 'info');
        renderBuyerOrders();
    } catch (error) {
        console.error('Error rejecting modification:', error);
        const { showToast } = await import('../utils/dom.js');
        showToast('Failed to reject modification', 'error');
    }
}

// Order Timeline Helper
function renderOrderTimeline(status, timeline = {}) {
    const steps = [
        { key: 'placed', label: 'Placed', icon: '\ud83d\udcdd' },
        { key: 'accepted', label: 'Accepted', icon: '\u2705' },
        { key: 'shipped', label: 'Shipped', icon: '\ud83d\ude9a' },
        { key: 'fulfilled', label: 'Delivered', icon: '\ud83c\udf89' }
    ];
    
    const statusMap = {
        'Pending': 0,
        'Accepted': 1,
        'Shipped': 2,
        'Fulfilled': 3,
        'Rejected': -1
    };
    
    const currentStep = statusMap[status] || 0;
    
    if (status === 'Rejected') {
        return `<div class="order-timeline rejected">
            <div class="timeline-step rejected">
                <span class="step-icon">\u274c</span>
                <span class="step-label">Order Rejected</span>
            </div>
        </div>`;
    }
    
    const stepsHtml = steps.map((step, index) => {
        let state = 'pending';
        if (index < currentStep) state = 'completed';
        else if (index === currentStep) state = 'active';
        
        const time = timeline[step.key] ? formatTimelineTime(timeline[step.key]) : '';
        
        return `
            <div class="timeline-step ${state}">
                <div class="step-icon">${step.icon}</div>
                <div class="step-info">
                    <span class="step-label">${step.label}</span>
                    ${time ? `<span class="step-time">${time}</span>` : ''}
                </div>
                ${index < steps.length - 1 ? `<div class="step-connector ${index < currentStep ? 'completed' : ''}"></div>` : ''}
            </div>
        `;
    }).join('');
    
    return `<div class="order-timeline">${stepsHtml}</div>`;
}

function formatTimelineTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateStr}, ${timeStr}`;
}

// Reorder functionality
/**
 * Download invoice for an order
 * @param {string} orderId - Order ID to download invoice for
 */
export async function downloadInvoice(orderId) {
    const { showToast } = await import('../utils/dom.js');
    const { db } = await import('../services/firebase.js');
    
    try {
        // Fetch order data
        const snap = await db.collection('orders').where('id', '==', orderId).get();
        if (snap.empty) {
            showToast('Order not found', 'error');
            return;
        }
        
        const order = snap.docs[0].data();
        
        // Build invoice content
        const invoiceDate = order.timestamp || new Date().toLocaleString('en-IN');
        const invoiceLines = [
            '═══════════════════════════════════════════════════════════════',
            '                           KKR GROCERIES                        ',
            '                           ORDER INVOICE                          ',
            '═══════════════════════════════════════════════════════════════',
            '',
            `Order ID:    ${order.id}`,
            `Date:        ${invoiceDate}`,
            `Status:      ${order.status || 'Pending'}`,
            '',
            '───────────────────────────────────────────────────────────────',
            '                     CUSTOMER DETAILS                            ',
            '───────────────────────────────────────────────────────────────',
            `Name:    ${order.customerName || 'N/A'}`,
            `Phone:   ${order.phone || 'N/A'}`,
            `Address: ${order.address || order.location || 'N/A'}`,
            '',
            '───────────────────────────────────────────────────────────────',
            '                     ORDER ITEMS                                 ',
            '───────────────────────────────────────────────────────────────',
            ''
        ];
        
        // Add items
        if (order.cart && Array.isArray(order.cart)) {
            order.cart.forEach((item, index) => {
                const qty = item.qty || 0;
                const price = item.price || 0;
                const amount = qty * price;
                invoiceLines.push(`${(index + 1).toString().padStart(2)}. ${item.name || 'Unknown Item'}`);
                invoiceLines.push(`    ${item.unit || ''} | Qty: ${qty} x ₹${price} = ₹${amount.toLocaleString('en-IN')}`);
                invoiceLines.push('');
            });
        } else if (order.orderSummary) {
            // Fallback to order summary string
            invoiceLines.push('Items: ' + order.orderSummary);
            invoiceLines.push('');
        }
        
        invoiceLines.push('───────────────────────────────────────────────────────────────');
        invoiceLines.push(`TOTAL: ${order.totalValue || '₹0'}`);
        invoiceLines.push('───────────────────────────────────────────────────────────────');
        invoiceLines.push('');
        invoiceLines.push('Thank you for shopping with KKR Groceries!');
        invoiceLines.push('');
        invoiceLines.push('═══════════════════════════════════════════════════════════════');
        
        // Create and download file
        const invoiceContent = invoiceLines.join('\n');
        const blob = new Blob([invoiceContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `KKR-Invoice-${order.id}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        showToast('Invoice downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Invoice download failed:', error);
        showToast('Failed to download invoice', 'error');
    }
}

// Reorder functionality
export async function reorder(orderId) {
    const { showToast } = await import('../utils/dom.js');
    const { state } = await import('../store.js');
    const { db } = await import('../services/firebase.js');
    const { updateUI, updateProductUI } = await import('./cart.js');
    const { renderProducts } = await import('./products.js');
    
    try {
        const snap = await db.collection('orders').where('id', '==', orderId).get();
        if (snap.empty) {
            showToast('Order not found', 'error');
            return;
        }
        
        const order = snap.docs[0].data();
        const { products } = await import('../store.js');
        
        // Parse order summary and add to cart
        if (order.cart && Array.isArray(order.cart)) {
            order.cart.forEach(item => {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    state.cart[item.id] = {
                        ...product,
                        price: item.price,
                        qty: item.qty
                    };
                }
            });
        }
        
        updateUI();
        renderProducts(state.currentCategory);
        Object.keys(state.cart).forEach(id => updateProductUI(parseInt(id)));
        showToast('Items added to cart', 'success');
        
    } catch (error) {
        console.error('Reorder failed:', error);
        showToast('Failed to reorder', 'error');
    }
}
