/**
 * Admin Orders Management Module
 * Handles order viewing, filtering, status updates, and editing
 */

import { db } from '../../services/firebase.js';
import { escapeHTML } from '../../utils/dom.js';
import { updateOrderStatus } from '../../services/orders.js';
import { logError } from '../../utils/errorHandler.js';

// Cache for current orders
let currentAdminOrders = [];
let currentEditOrderId = null;
let currentEditOrderStatus = null;
let originalCartData = [];

// Filter state
let adminOrderFilterState = 'all';

// Pagination state
const ORDERS_PER_PAGE = 50;
let lastOrderDoc = null;
let hasMoreOrders = true;
let isLoadingOrders = false;

/**
 * Format timestamp for display (handles Firestore timestamps and ISO strings)
 * @param {any} timestamp - Firestore timestamp or ISO string
 * @returns {string} Formatted date/time string
 */
function formatStatusTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    } catch {
        return '';
    }
}

/**
 * Render status timeline for admin view
 * @param {Object} o - Order object
 * @returns {string} HTML for status timeline
 */
function renderAdminStatusTimeline(o) {
    const statuses = [
        { key: 'placed', label: 'Placed', time: o.placedAt || o.createdAt },
        { key: 'accepted', label: 'Accepted', time: o.acceptedAt },
        { key: 'shipped', label: 'Shipped', time: o.shippedAt },
        { key: 'delivered', label: 'Delivered', time: o.deliveredAt || o.fulfilledAt }
    ];
    
    // For rejected orders
    if (o.status === 'Rejected') {
        return `<div style="margin-top:6px;padding:4px 8px;background:#fee2e2;border-radius:4px;font-size:0.75rem;color:#dc2626">
            ❌ Rejected ${o.rejectedAt ? `on ${formatStatusTime(o.rejectedAt)}` : ''}
        </div>`;
    }
    
    // Build timeline showing completed and pending steps
    const timelineItems = statuses.map(s => {
        const timeStr = formatStatusTime(s.time);
        if (!timeStr) {
            // Future step (not yet completed)
            return `<span style="color:#cbd5e1;font-size:0.7rem">→ ${s.label}</span>`;
        }
        // Completed step
        const isActive = s.key.toLowerCase() === (o.status || 'pending').toLowerCase() ||
                        (s.key === 'delivered' && o.status === 'Fulfilled');
        const color = isActive ? '#059669' : '#64748b';
        const bg = isActive ? '#d1fae5' : '#f1f5f9';
        return `<span style="background:${bg};color:${color};padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:500;white-space:nowrap">
            ✓ ${s.label}: ${timeStr}
        </span>`;
    }).filter(Boolean);
    
    if (timelineItems.length <= 1) return ''; // Don't show if only placed
    
    return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
        ${timelineItems.join('')}
    </div>`;
}

/**
 * Render the orders management tab
 */
export async function renderOrdersTab() {
    const tab = document.getElementById('adminOrdersTab');
    if (!tab) return;

    // Show loading state
    if (isLoadingOrders) return;
    isLoadingOrders = true;
    
    // Check if we need to reset pagination
    const shouldReset = !lastOrderDoc;
    
    let orders = shouldReset ? [] : [...currentAdminOrders];
    
    try {
        // Build query with pagination - limit to recent orders for performance
        let query = db.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(ORDERS_PER_PAGE);
        
        // Add pagination cursor if loading more
        if (lastOrderDoc) {
            query = query.startAfter(lastOrderDoc);
        }
        
        const snap = await query.get();
        
        // Update pagination state
        hasMoreOrders = snap.docs.length === ORDERS_PER_PAGE;
        lastOrderDoc = snap.docs[snap.docs.length - 1] || null;
        
        const newOrders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        orders = shouldReset ? newOrders : [...orders, ...newOrders];
        
    } catch (e) {
        console.warn('[Orders] Query failed, trying fallback:', e.message);
        // Fallback: fetch without ordering
        try {
            const snap = await db.collection('orders').limit(ORDERS_PER_PAGE).get();
            orders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            // Sort client-side
            orders.sort((a, b) => {
                const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
                const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
                return tB - tA;
            });
            hasMoreOrders = false;
        } catch (e2) {
            logError(e2, 'renderOrdersTab - fallback query');
        }
    }
    
    isLoadingOrders = false;
    currentAdminOrders = orders;
    const filterState = adminOrderFilterState;

    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h3 style="margin:0;color:#1e293b;font-size:1.1rem">Order Management</h3>
        <select id="adminOrderFilterSelect" onchange="window.adminOrderFilterState = this.value; window.resetAndLoadOrders()" style="padding:0.4rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.9rem">
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

    const filteredOrders = orders.filter(o => {
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
        h += '<div style="text-align:center;color:#94a3b8;padding:2rem">📦 No orders found for this timeframe</div>';
        tab.innerHTML = h;
        return;
    }

    h += filteredOrders.map(o => {
        const hasPendingMod = o.modificationStatus === 'PendingBuyerApproval';
        const sColor = o.status === 'Fulfilled' ? '#10b981' : 
                      (o.status === 'Accepted' ? '#3b82f6' : 
                      (o.status === 'Rejected' ? '#ef4444' : 
                      (hasPendingMod ? '#f97316' : '#f59e0b')));
        
        const statusText = hasPendingMod ? 'Pending Approval' : (o.status || 'Pending');
        
        let actions = '';
        if (hasPendingMod) {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap">
                <button onclick="window.adminCancelModification('${escapeHTML(o.id)}')" style="flex:1;min-width:100px;background:#fee2e2;color:#ef4444;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Cancel Changes</button>
                <button onclick="window.adminDownloadInvoice('${escapeHTML(o.id)}')" style="flex:1;min-width:80px;background:#0ea5e9;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">📄 Invoice</button>
            </div>`;
        } else if (o.status === 'Pending' || !o.status) {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap">
                <button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Accepted')" style="flex:1;min-width:80px;background:#3b82f6;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Accept</button>
                <button onclick="window.adminEditOrder('${escapeHTML(o.id)}')" style="flex:1;min-width:80px;background:#f59e0b;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Edit</button>
                <button onclick="window.adminDownloadInvoice('${escapeHTML(o.id)}')" style="flex:1;min-width:80px;background:#0ea5e9;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">📄 Invoice</button>
                <button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Rejected')" style="flex:1;min-width:80px;background:#fee2e2;color:#ef4444;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Reject</button>
            </div>`;
        } else if (o.status === 'Accepted') {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem">
                <button onclick="window.adminUpdateOrderStatus('${escapeHTML(o.id)}', 'Fulfilled')" style="flex:2;background:#10b981;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Mark as Fulfilled</button>
                <button onclick="window.adminDownloadInvoice('${escapeHTML(o.id)}')" style="flex:1;background:#0ea5e9;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">📄 Invoice</button>
                <button onclick="window.adminEditOrder('${escapeHTML(o.id)}')" style="flex:1;background:#f59e0b;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Edit</button>
            </div>`;
        } else if (o.status === 'Fulfilled') {
            actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem">
                <button onclick="window.adminDownloadInvoice('${escapeHTML(o.id)}')" style="flex:1;background:#0ea5e9;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">📄 Invoice</button>
                <button onclick="window.adminEditOrder('${escapeHTML(o.id)}')" style="flex:1;background:#f59e0b;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Edit</button>
            </div>`;
        }

        // Location with Google Maps link and Pincode
        const loc = o.location ? `<div style="margin-top:4px;display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><a href="https://maps.google.com/?q=${encodeURIComponent(o.location)}" target="_blank" style="color:#0ea5e9;text-decoration:none;font-size:0.85rem">${escapeHTML(o.location)} - Pincode: ${escapeHTML(o.pincode || 'N/A')}</a></div>` : '';
        
        // Buyer login info (email/phone from user account)
        const buyerLogin = o.userEmail || o.userPhone || o.userId || 'N/A';
        
        // Customer info line with icons: 👤 Name | 📱 Phone | 🔑 UserID
        const buyerInfo = `<div style="font-size:0.85rem;color:#475569;margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;gap:3px">👤 ${escapeHTML(o.customerName || 'N/A')}</span>
            <span style="color:#cbd5e1">|</span>
            <span style="display:inline-flex;align-items:center;gap:3px">📱 ${escapeHTML(o.phone || 'N/A')}</span>
            <span style="color:#cbd5e1">|</span>
            <span style="display:inline-flex;align-items:center;gap:3px">🔑 ${escapeHTML(buyerLogin)}</span>
        </div>`;

        // Order ID with blue background style
        const orderIdStyle = `background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:4px;font-size:0.85rem;font-weight:600;font-family:monospace;display:inline-block;margin-top:2px`;
        
        // Status timeline for admin
        const statusTimeline = renderAdminStatusTimeline(o);

        return `<div class="history-card">
            <div class="h-header" style="align-items:flex-start">
                <div style="flex:1;min-width:0">
                    <div style="font-size:0.8rem;color:#64748b;margin-bottom:4px">${escapeHTML(o.timestamp)}</div>
                    <div style="${orderIdStyle}">${escapeHTML(o.id)}</div>
                    ${buyerInfo}
                    ${loc}
                    ${statusTimeline}
                </div>
                <span style="background:${sColor}20;color:${sColor};padding:0.25rem 0.75rem;border-radius:12px;font-size:0.75rem;font-weight:700;flex-shrink:0;margin-left:8px">${escapeHTML(statusText)}</span>
                ${hasPendingMod ? `<div style="margin-top:0.25rem;font-size:0.7rem;color:#f97316;background:#fff7ed;padding:0.2rem 0.4rem;border-radius:4px;border:1px solid #fed7aa;">⏳ Waiting for buyer approval</div>` : ''}
            </div>
            <div class="h-items" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f1f5f9">${(() => {
                const orderItems = o.cart || o.items || [];
                return orderItems.length > 0 
                    ? orderItems.map(item => {
                        const imgHtml = item.image 
                            ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" class="order-item-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                            : '';
                        const fallbackHtml = `<span class="order-item-fallback">${item.name ? item.name[0] : '?'}</span>`;
                        const amount = (item.qty || 0) * (item.price || 0);
                        return `
                            <div class="order-item-row">
                                <div class="order-item-thumb">
                                    ${imgHtml}
                                    ${fallbackHtml}
                                </div>
                                <span class="order-item-name">${escapeHTML(item.name)}</span>
                                <span class="order-item-qty">${item.qty} ${escapeHTML(item.unit)}</span>
                                <span class="order-item-price">₹${item.price}</span>
                                <span class="order-item-amount" style="font-weight:600;color:#0f172a;">₹${amount.toLocaleString('en-IN')}</span>
                            </div>
                        `;
                    }).join('')
                    : escapeHTML(o.orderSummary || '');
            })()}</div>
            <div class="h-total" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
                <span>${o.productCount || 0} items</span>
                <span style="font-size:1.1rem;font-weight:800;color:#0f172a">${escapeHTML(o.totalValue || '')}</span>
            </div>
            ${actions}
        </div>`;
    }).join('');
    
    // Add Load More button if there are more orders
    if (hasMoreOrders && filterState === 'all') {
        h += `<div style="text-align:center;margin-top:1.5rem;padding:1rem">
            <button class="btn btn-secondary" onclick="window.loadMoreOrders()" ${isLoadingOrders ? 'disabled' : ''}>
                ${isLoadingOrders ? '⏳ Loading...' : '📥 Load More Orders'}
            </button>
        </div>`;
    }

    tab.innerHTML = h;
}

/**
 * Load more orders for pagination
 */
export async function loadMoreOrders() {
    if (isLoadingOrders || !hasMoreOrders) return;
    await renderOrdersTab();
}

/**
 * Update order status
 * @param {string} id - Order ID
 * @param {string} newStatus - New status
 */
export async function adminUpdateOrderStatus(id, newStatus) {
    try {
        await updateOrderStatus(id, newStatus);
        if (window.showToast) window.showToast(`Order ${escapeHTML(id)} marked as ${escapeHTML(newStatus)}`, 'success');
        renderOrdersTab();
    } catch (e) {
        logError(e, 'adminUpdateOrderStatus', true);
        
        // Handle permission errors with helpful message
        if (e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions')) {
            const user = window.firebase?.auth().currentUser;
            if (user) {
                const adminEmails = [
                    'raju2uraju@gmail.com',
                    'kanthati.chakri@gmail.com'
                ];
                
                if (adminEmails.includes(user.email?.toLowerCase())) {
                    if (window.showToast) {
                        window.showToast('Admin permissions not detected. Please sign out and sign back in to refresh your access.', 'error', 5000);
                    }
                    
                    // Show relogin prompt
                    setTimeout(() => {
                        if (confirm('Your admin permissions need to be refreshed. Sign out now?')) {
                            window.firebase.auth().signOut().then(() => {
                                window.location.href = '/?message=Please sign in again to update your permissions';
                            });
                        }
                    }, 100);
                } else {
                    if (window.showToast) {
                        window.showToast('You do not have permission to update orders.', 'error');
                    }
                }
            }
        }
    }
}

/**
 * Open order edit modal
 * @param {string} id - Order ID to edit
 */
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

        // Store original cart if not already stored
        if (!o.originalCart) {
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

        const showF = (currentEditOrderStatus === 'Fulfilled');
        if (fHeader) fHeader.style.display = showF ? 'table-cell' : 'none';
        if (fFooter) fFooter.style.display = showF ? 'table-cell' : 'none';

        let tbody = '';

        originalCartData.forEach((item, idx) => {
            const oAmt = item.qty * item.price;
            const acItem = acCart.find(x => x.name === item.name) || { ...item, qty: 0 };
            const fuItem = fuCart.find(x => x.name === item.name) || { ...acItem };

            const accCol = `
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

            const itemImgHtml = item.image 
                ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;" onerror="this.style.display='none'">`
                : `<div style="width:40px;height:40px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-weight:700;color:#64748b;border:1px solid #e2e8f0;">${item.name ? item.name[0] : '?'}</div>`;
            
            tbody += `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:0.75rem;border:1px solid #cbd5e1;">
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                            ${itemImgHtml}
                            <div>
                                <div style="font-weight:600;color:#1e293b">${escapeHTML(item.name)}</div>
                                <div style="font-size:0.8rem;color:#64748b">${escapeHTML(item.unit)}</div>
                            </div>
                        </div>
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

        const tableBody = document.getElementById('editOrderTableBody');
        if (tableBody) tableBody.innerHTML = tbody;
        
        const modal = document.getElementById('editOrderModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        recalcEditOrder();
    } catch (err) {
        logError(err, 'adminEditOrder', true);
    }
}

/**
 * Recalculate order totals during editing
 */
export function recalcEditOrder() {
    let tO = 0, tA = 0, tF = 0;

    originalCartData.forEach((item, idx) => {
        tO += (item.qty * item.price);

        const aqEl = document.getElementById(`ea-qty-${idx}`);
        const arEl = document.getElementById(`ea-rate-${idx}`);
        if (aqEl && arEl) {
            const aq = parseFloat(aqEl.value) || 0;
            const ar = parseFloat(arEl.value) || 0;
            const aAmt = aq * ar;
            tA += aAmt;
            const amtEl = document.getElementById(`ea-amt-${idx}`);
            if (amtEl) amtEl.textContent = `₹${aAmt.toLocaleString('en-IN')}`;
        }

        if (currentEditOrderStatus === 'Fulfilled') {
            const fqEl = document.getElementById(`ef-qty-${idx}`);
            const frEl = document.getElementById(`ef-rate-${idx}`);
            if (fqEl && frEl) {
                const fq = parseFloat(fqEl.value) || 0;
                const fr = parseFloat(frEl.value) || 0;
                const fAmt = fq * fr;
                tF += fAmt;
                const amtEl = document.getElementById(`ef-amt-${idx}`);
                if (amtEl) amtEl.textContent = `₹${fAmt.toLocaleString('en-IN')}`;
            }
        }
    });

    const grandTotalOriginal = document.getElementById('grandTotalOriginal');
    const grandTotalAccepted = document.getElementById('grandTotalAccepted');
    const grandTotalFulfilled = document.getElementById('grandTotalFulfilled');

    if (grandTotalOriginal) grandTotalOriginal.textContent = `₹${tO.toLocaleString('en-IN')}`;
    if (grandTotalAccepted) grandTotalAccepted.textContent = `₹${tA.toLocaleString('en-IN')}`;
    if (currentEditOrderStatus === 'Fulfilled' && grandTotalFulfilled) {
        grandTotalFulfilled.textContent = `₹${tF.toLocaleString('en-IN')}`;
    }
}

/**
 * Close edit order modal
 */
export function closeEditOrderModal() {
    const modal = document.getElementById('editOrderModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentEditOrderId = null;
    currentEditOrderStatus = null;
    originalCartData = [];
}

/**
 * Download invoice for an order (admin)
 * @param {string} orderId - Order ID to download invoice for
 */
export async function adminDownloadInvoice(orderId) {
    try {
        // Find order in cache first
        let order = currentAdminOrders.find(o => String(o.id) === String(orderId));
        
        // If not in cache, fetch from Firestore
        if (!order) {
            const snap = await db.collection('orders').where('id', '==', orderId).get();
            if (snap.empty) {
                if (window.showToast) window.showToast('Order not found', 'error');
                return;
            }
            order = snap.docs[0].data();
        }
        
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
        if (window.showToast) window.showToast('Invoice downloaded successfully!', 'success');
        
    } catch (error) {
        logError(error, 'adminDownloadInvoice', true);
    }
}

/**
 * Cancel pending modification
 * @param {string} orderId - Order ID
 */
export async function adminCancelModification(orderId) {
    try {
        await db.collection('orders').doc(orderId).update({
            pendingModification: null,
            modificationStatus: null,
            buyerNotified: false
        });
        
        // Update local cache
        const orderIdx = currentAdminOrders.findIndex(o => o.id === orderId);
        if (orderIdx > -1) {
            currentAdminOrders[orderIdx].pendingModification = null;
            currentAdminOrders[orderIdx].modificationStatus = null;
            currentAdminOrders[orderIdx].buyerNotified = false;
        }
        
        if (window.showToast) window.showToast('Modification cancelled', 'info');
        renderOrdersTab();
    } catch (e) {
        logError(e, 'adminCancelModification', true);
    }
}

/**
 * Save edited order - creates a pending modification for buyer approval
 */
export async function saveEditedOrder() {
    if (!currentEditOrderId) return;
    
    const saveBtn = document.querySelector('#editOrderModal .modal-content button:nth-child(2)');
    if (saveBtn) {
        saveBtn.textContent = 'Sending to Buyer...';
        saveBtn.disabled = true;
    }

    try {
        let proposedCart = [];
        let totalVal = 0;
        let finalSummary = [];
        let newCount = 0;

        originalCartData.forEach((item, idx) => {
            const aqEl = document.getElementById(`ea-qty-${idx}`);
            const arEl = document.getElementById(`ea-rate-${idx}`);
            const aq = aqEl ? (parseFloat(aqEl.value) || 0) : 0;
            const ar = arEl ? (parseFloat(arEl.value) || 0) : 0;
            
            if (aq > 0) {
                proposedCart.push({ ...item, qty: aq, price: ar });
                totalVal += (aq * ar);
                finalSummary.push(`${item.name} x${aq}`);
                newCount++;
            }
        });

        // Get the original order
        const order = currentAdminOrders.find(o => o.id === currentEditOrderId);
        
        // Calculate changes
        const changes = [];
        const originalCart = order.originalCart || order.cart || [];
        
        proposedCart.forEach(newItem => {
            const origItem = originalCart.find(o => o.name === newItem.name);
            if (origItem) {
                if (newItem.qty !== origItem.qty) {
                    changes.push(`${newItem.name}: Qty ${origItem.qty} → ${newItem.qty}`);
                }
                if (newItem.price !== origItem.price) {
                    changes.push(`${newItem.name}: Rate ₹${origItem.price} → ₹${newItem.price}`);
                }
            }
        });

        // Create pending modification
        const pendingModification = {
            proposedCart,
            proposedSummary: finalSummary.join(', '),
            proposedTotalValue: '₹' + totalVal.toLocaleString('en-IN'),
            proposedCount: newCount,
            changes: changes.length > 0 ? changes : ['Order details updated'],
            modifiedAt: new Date().toISOString(),
            modifiedBy: 'admin',
            status: 'PendingBuyerApproval'
        };

        const payload = {
            pendingModification,
            modificationStatus: 'PendingBuyerApproval'
        };

        await db.collection('orders').doc(currentEditOrderId).update(payload);

        // Update local cache
        const orderIdx = currentAdminOrders.findIndex(o => o.id === currentEditOrderId);
        if (orderIdx > -1) {
            Object.assign(currentAdminOrders[orderIdx], payload);
        }

        // Send notification to buyer
        await sendModificationNotification(currentEditOrderId, order.userId, changes);

        if (window.showToast) window.showToast('Order changes sent to buyer for approval!', 'success');
        closeEditOrderModal();
        renderOrdersTab();
    } catch (err) {
        logError(err, 'saveEditedOrder', true);
    } finally {
        if (saveBtn) {
            saveBtn.textContent = 'Send Changes to Buyer';
            saveBtn.disabled = false;
        }
    }
}

/**
 * Send notification to buyer about order modification
 */
async function sendModificationNotification(orderId, userId, changes) {
    if (!userId) return;
    
    try {
        // Create notification in Firestore
        await db.collection('notifications').add({
            userId,
            orderId,
            type: 'orderModification',
            title: 'Order Modification Request',
            message: `Your order ${orderId} has been modified. Changes: ${changes.join(', ')}`,
            changes,
            read: false,
            createdAt: new Date().toISOString()
        });
        
        // Also update order with notification flag
        await db.collection('orders').doc(orderId).update({
            buyerNotified: true,
            notificationSentAt: new Date().toISOString()
        });
    } catch (e) {
        logError(e, 'sendModificationNotification');
    }
}


/**
 * Reset pagination and load orders from start
 */
export function resetAndLoadOrders() {
    lastOrderDoc = null;
    hasMoreOrders = true;
    currentAdminOrders = [];
    renderOrdersTab();
}

// Expose to window
if (typeof window !== 'undefined') {
    window.loadMoreOrders = loadMoreOrders;
    window.resetAndLoadOrders = resetAndLoadOrders;
}
