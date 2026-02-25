/**
 * Admin Statistics & Analytics Module
 * Handles charts and dashboard statistics with drill-down verification
 */

import { db } from '../../services/firebase.js';
import { products } from '../../store.js';
import { logError } from '../../utils/errorHandler.js';
import { showToast } from '../../utils/dom.js';

// Chart instances for cleanup
let adminRevChartInstance = null;
let adminPopChartInstance = null;
let adminStatusChartInstance = null;
let adminCategoryChartInstance = null;
let adminHourChartInstance = null;

// Store order data for drill-down
let cachedOrders = [];
let cachedOnlineUsers = [];

/**
 * Show modal with detailed data
 * @param {string} title - Modal title
 * @param {string} content - HTML content
 */
function showDetailModal(title, content) {
    // Remove existing modal
    const existingModal = document.getElementById('statsDetailModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'statsDetailModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1rem;
    `;
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 800px; width: 100%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b;">${title}</h3>
                <button onclick="document.getElementById('statsDetailModal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; padding: 0.25rem; line-height: 1;">×</button>
            </div>
            <div style="padding: 1.25rem; overflow-y: auto; flex: 1;">
                ${content}
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

/**
 * Render the statistics/analytics tab
 */
export async function renderStatsTab() {
    const tab = document.getElementById('adminStatsTab');
    if (!tab) return;

    let orders = [];
    let onlineUsers = [];
    try {
        const snap = await db.collection('orders').get();
        orders = snap.docs.map(d => d.data());
        cachedOrders = orders;
        
        // Fetch online users (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const presenceSnap = await db.collection('presence')
            .where('lastSeen', '>=', fiveMinutesAgo)
            .where('status', '==', 'online')
            .get();
        onlineUsers = presenceSnap.docs.map(d => d.data());
        cachedOnlineUsers = onlineUsers;
    } catch (e) {
        logError(e, 'renderStatsTab');
    }

    const rev = orders.reduce((s, o) => {
        const val = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
        return s + (isNaN(val) ? 0 : val);
    }, 0);

    // Calculate Average Order Value
    const aov = orders.length > 0 ? Math.round(rev / orders.length) : 0;

    const pop = {};
    const revByDate = {};

    // Calculate status breakdown
    const statusBreakdown = {};
    orders.forEach(o => {
        const status = o.status || 'Pending';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    // Calculate customer revenue for leaderboard and churn risk
    const customerRevenue = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    orders.forEach(o => {
        const customerKey = o.customerName || o.userId || 'Unknown';
        const val = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
        if (!customerRevenue[customerKey]) {
            customerRevenue[customerKey] = { 
                name: customerKey, 
                revenue: 0, 
                orders: 0,
                lastOrderDate: null,
                userId: o.userId
            };
        }
        customerRevenue[customerKey].revenue += (isNaN(val) ? 0 : val);
        customerRevenue[customerKey].orders += 1;
        
        // Track last order date for churn calculation
        const orderDate = o.timestamp ? new Date(o.timestamp) : null;
        if (orderDate && (!customerRevenue[customerKey].lastOrderDate || orderDate > customerRevenue[customerKey].lastOrderDate)) {
            customerRevenue[customerKey].lastOrderDate = orderDate;
        }
    });

    // Get top 10 customers
    const topCustomers = Object.values(customerRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    // Phase 2: Calculate churn risk customers (inactive for 30+ days)
    const churnRiskCustomers = Object.values(customerRevenue)
        .filter(c => c.lastOrderDate && c.lastOrderDate < thirtyDaysAgo)
        .sort((a, b) => a.lastOrderDate - b.lastOrderDate)
        .slice(0, 5);

    // Phase 2: Calculate revenue by product category
    const categoryRevenue = { daily: 0, rotate: 0, regional: 0, unknown: 0 };
    const categoryQuantity = { daily: 0, rotate: 0, regional: 0, unknown: 0 };
    
    orders.forEach(o => {
        if (o.cart && Array.isArray(o.cart)) {
            o.cart.forEach(item => {
                const product = products.find(p => p.id === item.id || p.name === item.name);
                const category = product?.category || 'unknown';
                const itemTotal = (item.price || 0) * (item.qty || 0);
                const itemQty = item.qty || 0;
                
                if (categoryRevenue[category] !== undefined) {
                    categoryRevenue[category] += itemTotal;
                    categoryQuantity[category] += itemQty;
                } else {
                    categoryRevenue.unknown += itemTotal;
                    categoryQuantity.unknown += itemQty;
                }
            });
        }
    });

    // Phase 2: Calculate peak hours (orders by hour of day)
    const ordersByHour = new Array(24).fill(0);
    orders.forEach(o => {
        if (o.timestamp) {
            const hour = new Date(o.timestamp).getHours();
            ordersByHour[hour]++;
        }
    });
    const peakHour = ordersByHour.indexOf(Math.max(...ordersByHour));

    orders.forEach(o => {
        if (o.orderSummary) {
            o.orderSummary.split(', ').forEach(x => {
                const n = x.split(' x')[0];
                if (n) pop[n] = (pop[n] || 0) + 1;
            });
        }
        if (o.timestamp) {
            const d = o.timestamp.split(',')[0];
            const v = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            if (d && !isNaN(v)) {
                revByDate[d] = (revByDate[d] || 0) + v;
            }
        }
    });

    const customers = new Set(orders.map(o => o.customerName || o.userId).filter(Boolean)).size;

    // Add pulse animation style if not exists
    if (!document.getElementById('onlinePulseStyle')) {
        const style = document.createElement('style');
        style.id = 'onlinePulseStyle';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.1); }
            }
            .stat-clickable { cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
            .stat-clickable:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
            .customer-clickable { cursor: pointer; color: #2563eb; text-decoration: underline; }
            .customer-clickable:hover { color: #1d4ed8; }
            .status-badge-clickable { cursor: pointer; transition: all 0.2s; }
            .status-badge-clickable:hover { transform: scale(1.05); filter: brightness(0.9); }
        `;
        document.head.appendChild(style);
    }

    let h = `<div class="dash-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="dash-stat stat-clickable" style="background:#f0fdf4; padding: 1.25rem; border-radius: 12px; text-align: center;" onclick="window.showOrdersDetail('all')" title="Click to view all orders">
            <div class="val" style="color:#059669; font-size: 1.875rem; font-weight: 800; margin-bottom: 0.25rem;">${orders.length}</div>
            <div class="lbl" style="color:#64748b; font-size: 0.875rem; font-weight: 500;">Total Orders</div>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">Click to view</div>
        </div>
        <div class="dash-stat stat-clickable" style="background:#eff6ff; padding: 1.25rem; border-radius: 12px; text-align: center;" onclick="window.showRevenueDetail()" title="Click to view revenue breakdown">
            <div class="val" style="color:#2563eb; font-size: 1.875rem; font-weight: 800; margin-bottom: 0.25rem;">${formatCurrency(rev)}</div>
            <div class="lbl" style="color:#64748b; font-size: 0.875rem; font-weight: 500;">Revenue</div>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">Click for details</div>
        </div>
        <div class="dash-stat stat-clickable" style="background:#fef3c7; padding: 1.25rem; border-radius: 12px; text-align: center;" onclick="window.showCustomersDetail()" title="Click to view customer directory">
            <div class="val" style="color:#d97706; font-size: 1.875rem; font-weight: 800; margin-bottom: 0.25rem;">${customers}</div>
            <div class="lbl" style="color:#64748b; font-size: 0.875rem; font-weight: 500;">Customers</div>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">Click to view</div>
        </div>
        <div class="dash-stat stat-clickable" style="background:#fce7f3; padding: 1.25rem; border-radius: 12px; text-align: center;" onclick="window.showProductsDetail()" title="Click to view product performance">
            <div class="val" style="color:#db2777; font-size: 1.875rem; font-weight: 800; margin-bottom: 0.25rem;">${products.length}</div>
            <div class="lbl" style="color:#64748b; font-size: 0.875rem; font-weight: 500;">Products</div>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">Click to view</div>
        </div>
        <div class="dash-stat" style="background:#e0e7ff; padding: 1.25rem; border-radius: 12px; text-align: center;" title="Average Order Value">
            <div class="val" style="color:#6366f1; font-size: 1.875rem; font-weight: 800; margin-bottom: 0.25rem;">${formatCurrency(aov)}</div>
            <div class="lbl" style="color:#64748b; font-size: 0.875rem; font-weight: 500;">Avg Order Value</div>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">Auto-calculated</div>
        </div>
        <div class="dash-stat stat-clickable" style="background:#ecfdf5; border:2px solid #10b981; padding: 1.25rem; border-radius: 12px; text-align: center;" onclick="window.showOnlineUsersDetail()" title="Click to view online users">
            <div class="val" style="color:#059669; font-size: 1.875rem; font-weight: 800; margin-bottom: 0.25rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                <span style="width:12px; height:12px; background:#10b981; border-radius:50%; display:inline-block; animation:pulse 2s infinite;"></span>
                ${onlineUsers.length}
            </div>
            <div class="lbl" style="color:#64748b; font-size: 0.875rem; font-weight: 500;">Online Now</div>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">Click to view</div>
        </div>
    </div>`;

    if (orders.length > 0) {
        h += `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem; margin-bottom:1rem;">
            <div style="background:white; padding:1rem; border-radius:12px; border:1px solid #e2e8f0; position: relative; height: 350px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <h4 style="margin:0; font-size:0.9rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Daily Revenue</h4>
                    <span style="font-size:0.7rem; color:#94a3b8;">Last 7 days</span>
                </div>
                <div style="height: 280px; position: relative;">
                    <canvas id="adminRevChart"></canvas>
                </div>
            </div>
            <div style="background:white; padding:1rem; border-radius:12px; border:1px solid #e2e8f0; max-height:350px; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <h4 style="margin:0; font-size:0.9rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Top Products</h4>
                    <span style="font-size:0.7rem; color:#94a3b8;">Click segment for details</span>
                </div>
                <div style="flex:1; display:flex; justify-content:center; align-items:center; min-height:200px;">
                    <canvas id="adminPopChart"></canvas>
                </div>
            </div>
        </div>`;

        // Phase 1: New Analytics Section
        h += `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem; margin-bottom:1rem;">
            <!-- Order Status Breakdown -->
            <div style="background:white; padding:1rem; border-radius:12px; border:1px solid #e2e8f0;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Order Status Breakdown</h4>
                <div style="max-height:250px; display:flex; justify-content:center;">
                    <canvas id="adminStatusChart"></canvas>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.75rem; justify-content:center;">
                    ${Object.entries(statusBreakdown).map(([status, count]) => {
                        const colors = {
                            'Pending': '#f59e0b',
                            'Accepted': '#3b82f6',
                            'Fulfilled': '#10b981',
                            'Rejected': '#ef4444'
                        };
                        return `<span class="status-badge-clickable" onclick="window.showOrdersByStatus('${status}')" style="background:${colors[status] || '#64748b'}20; color:${colors[status] || '#64748b'}; padding:0.35rem 0.75rem; border-radius:20px; font-size:0.8rem; font-weight:600; border:1px solid ${colors[status] || '#64748b'}40;" title="Click to view ${status} orders">${status}: ${count}</span>`;
                    }).join('')}
                </div>
            </div>
            
            <!-- Top Customers Leaderboard -->
            <div style="background:white; padding:1rem; border-radius:12px; border:1px solid #e2e8f0; max-height:400px; overflow-y:auto;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Top Customers by Revenue</h4>
                ${topCustomers.length > 0 ? `
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="border-bottom:2px solid #e2e8f0;">
                                <th style="text-align:left; padding:0.6rem; color:#64748b; font-weight:600;">#</th>
                                <th style="text-align:left; padding:0.6rem; color:#64748b; font-weight:600;">Customer</th>
                                <th style="text-align:right; padding:0.6rem; color:#64748b; font-weight:600;">Orders</th>
                                <th style="text-align:right; padding:0.6rem; color:#64748b; font-weight:600;">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topCustomers.map((c, i) => `
                                <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                    <td style="padding:0.6rem; font-weight:700; color:${i < 3 ? '#059669' : '#64748b'}">${i + 1}</td>
                                    <td style="padding:0.6rem;">
                                        <span class="customer-clickable" onclick="window.showCustomerOrders('${c.name.replace(/'/g, "\\'")}')" title="Click to view ${c.name}'s orders">${c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name}</span>
                                    </td>
                                    <td style="padding:0.6rem; text-align:right; color:#64748b;">${c.orders}</td>
                                    <td style="padding:0.6rem; text-align:right; font-weight:600; color:#059669;">${formatCurrency(c.revenue)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div style="text-align:center; color:#94a3b8; padding:2rem;">No customer data available</div>'}
            </div>
        </div>`;

        // Phase 2: Operational Intelligence Section
        h += `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem; margin-bottom:1rem;">
            <!-- Product Category Performance -->
            <div style="background:white; padding:1rem; border-radius:12px; border:1px solid #e2e8f0;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Revenue by Category</h4>
                <div style="max-height:250px; display:flex; justify-content:center;">
                    <canvas id="adminCategoryChart"></canvas>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:0.5rem; margin-top:0.75rem;">
                    ${Object.entries(categoryRevenue).filter(([cat, val]) => cat !== 'unknown' && val > 0).map(([cat, rev]) => {
                        const catColors = {
                            'daily': '#10b981',
                            'rotate': '#3b82f6',
                            'regional': '#f59e0b'
                        };
                        const catLabels = {
                            'daily': 'Daily Essentials',
                            'rotate': 'High Rotation',
                            'regional': 'Regional Specials'
                        };
                        return `<div onclick="window.showCategoryOrders('${cat}')" class="stat-clickable" style="background:${catColors[cat] || '#64748b'}10; padding:0.75rem; border-radius:8px; text-align:center; border:1px solid ${catColors[cat] || '#64748b'}30;" title="Click to view ${catLabels[cat] || cat} products">
                            <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; margin-bottom:0.25rem;">${catLabels[cat] || cat}</div>
                            <div style="font-size:1rem; font-weight:700; color:${catColors[cat] || '#64748b'};">${formatCurrency(rev)}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
            
            <!-- Peak Ordering Hours -->
            <div style="background:white; padding:1rem; border-radius:12px; border:1px solid #e2e8f0;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Peak Ordering Hours</h4>
                <div style="max-height:220px;">
                    <canvas id="adminHourChart"></canvas>
                </div>
                <div style="margin-top:0.75rem; padding:0.75rem; background:#f0fdf4; border-radius:8px; text-align:center; border:1px solid #10b98130;">
                    <span style="font-size:0.8rem; color:#64748b;">Peak Time: </span>
                    <span style="font-size:1rem; font-weight:700; color:#059669;">${peakHour}:00 - ${peakHour + 1}:00</span>
                    <span style="font-size:0.75rem; color:#94a3b8; display:block; margin-top:0.25rem;">${ordersByHour[peakHour]} orders during peak</span>
                </div>
            </div>
        </div>`;

        // Phase 2: Churn Risk Alert Section (if any customers at risk)
        if (churnRiskCustomers.length > 0) {
            h += `<div style="background:#fef3c7; border:2px solid #f59e0b; border-radius:12px; padding:1rem; margin-bottom:1rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                    <span style="font-size:1.25rem;">⚠️</span>
                    <h4 style="margin:0; font-size:0.95rem; color:#92400e; font-weight:700;">Churn Risk Alert</h4>
                    <span style="background:#f59e0b; color:white; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.75rem; font-weight:600;">${churnRiskCustomers.length} Customers</span>
                </div>
                <p style="margin:0 0 0.75rem 0; font-size:0.8rem; color:#92400e;">These customers haven't placed an order in the last 30 days</p>
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                    ${churnRiskCustomers.map(c => {
                        const daysSince = Math.floor((now - c.lastOrderDate) / (24 * 60 * 60 * 1000));
                        return `<div onclick="window.showCustomerOrders('${c.name.replace(/'/g, "\\'")}')" class="stat-clickable" style="background:white; padding:0.5rem 0.75rem; border-radius:8px; border:1px solid #fed7aa; font-size:0.8rem;" title="Click to view ${c.name}'s history">
                            <span style="font-weight:600; color:#92400e;">${c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name}</span>
                            <span style="color:#d97706; margin-left:0.5rem;">(${daysSince} days)</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }
        
        // Online Users Section
        h += `<div style="background:#ecfdf5; border:2px solid #10b981; border-radius:12px; padding:1rem; margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                <span style="font-size:1.25rem;">🟢</span>
                <h4 style="margin:0; font-size:0.95rem; color:#065f46; font-weight:700;">Users Online Now</h4>
                <span style="background:#10b981; color:white; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.75rem; font-weight:600;">${onlineUsers.length} Active</span>
            </div>
            ${onlineUsers.length > 0 ? `
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                    ${onlineUsers.map(u => `
                        <div style="background:white; padding:0.5rem 0.75rem; border-radius:8px; border:1px solid #6ee7b7; font-size:0.8rem; display:flex; align-items:center; gap:0.5rem;">
                            <span style="width:8px; height:8px; background:#10b981; border-radius:50%; display:inline-block;"></span>
                            <span style="font-weight:600; color:#065f46;">${(u.displayName || 'Anonymous').length > 20 ? (u.displayName || 'Anonymous').substring(0, 20) + '...' : (u.displayName || 'Anonymous')}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '<p style="margin:0; font-size:0.8rem; color:#059669;">No users currently online</p>'}
        </div>`;
    } else {
        h += `<div style="text-align:center; padding:3rem; color:#94a3b8;">📊 Awaiting orders to generate analytics</div>`;
    }

    tab.innerHTML = h;

    // Setup drill-down handlers
    setupDrillDownHandlers(orders, topCustomers, onlineUsers, revByDate);

    if (orders.length > 0) {
        setTimeout(() => renderCharts(revByDate, pop, statusBreakdown, categoryRevenue, ordersByHour), 100);
    }
}

/**
 * Setup drill-down click handlers
 */
function setupDrillDownHandlers(orders, topCustomers, onlineUsers, revByDate) {
    // Show all orders
    window.showOrdersDetail = (filter) => {
        const content = `
            <div style="margin-bottom:1rem; color:#64748b; font-size:0.9rem;">Total: ${orders.length} orders</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Order ID</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Customer</th>
                        <th style="text-align:center; padding:0.75rem; color:#64748b; font-weight:600;">Status</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Amount</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(o => {
                        const statusColors = {
                            'Pending': '#f59e0b',
                            'Accepted': '#3b82f6',
                            'Fulfilled': '#10b981',
                            'Rejected': '#ef4444'
                        };
                        return `<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:0.75rem; font-family:monospace; font-size:0.8rem;">${o.id || 'N/A'}</td>
                            <td style="padding:0.75rem;">${o.customerName || 'Unknown'}</td>
                            <td style="padding:0.75rem; text-align:center;">
                                <span style="background:${statusColors[o.status] || '#64748b'}20; color:${statusColors[o.status] || '#64748b'}; padding:0.25rem 0.5rem; border-radius:12px; font-size:0.75rem; font-weight:600;">${o.status || 'Pending'}</span>
                            </td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${o.totalValue || '₹0'}</td>
                            <td style="padding:0.75rem; font-size:0.8rem; color:#64748b;">${o.timestamp ? new Date(o.timestamp).toLocaleDateString('en-IN') : 'N/A'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        showDetailModal('All Orders', content);
    };

    // Show revenue breakdown
    window.showRevenueDetail = () => {
        const totalRev = orders.reduce((s, o) => {
            const val = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            return s + (isNaN(val) ? 0 : val);
        }, 0);
        
        const content = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                <div style="background:#f0fdf4; padding:1.25rem; border-radius:12px; text-align:center;">
                    <div style="font-size:2rem; font-weight:800; color:#059669;">${formatCurrency(totalRev)}</div>
                    <div style="font-size:0.875rem; color:#64748b;">Total Revenue</div>
                </div>
                <div style="background:#eff6ff; padding:1.25rem; border-radius:12px; text-align:center;">
                    <div style="font-size:2rem; font-weight:800; color:#2563eb;">${formatCurrency(Math.round(totalRev / orders.length))}</div>
                    <div style="font-size:0.875rem; color:#64748b;">Average Order</div>
                </div>
            </div>
            <h4 style="margin:0 0 1rem 0; color:#334155;">Revenue by Date</h4>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b;">Date</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b;">Revenue</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b;">% of Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(revByDate).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([date, rev]) => {
                        const percentage = ((rev / totalRev) * 100).toFixed(1);
                        return `<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:0.75rem;">${new Date(date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${formatCurrency(rev)}</td>
                            <td style="padding:0.75rem; text-align:right;">
                                <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.5rem;">
                                    <div style="width:60px; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                                        <div style="width:${percentage}%; height:100%; background:#3b82f6; border-radius:3px;"></div>
                                    </div>
                                    <span style="font-size:0.8rem; color:#64748b; min-width:45px;">${percentage}%</span>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        showDetailModal('Revenue Breakdown', content);
    };

    // Show customers detail
    window.showCustomersDetail = () => {
        const customerData = {};
        orders.forEach(o => {
            const key = o.customerName || o.userId || 'Unknown';
            if (!customerData[key]) {
                customerData[key] = { name: key, orders: 0, revenue: 0, lastOrder: null };
            }
            const val = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            customerData[key].orders += 1;
            customerData[key].revenue += isNaN(val) ? 0 : val;
            const orderDate = o.timestamp ? new Date(o.timestamp) : null;
            if (orderDate && (!customerData[key].lastOrder || orderDate > customerData[key].lastOrder)) {
                customerData[key].lastOrder = orderDate;
            }
        });

        const sortedCustomers = Object.values(customerData).sort((a, b) => b.revenue - a.revenue);

        const content = `
            <div style="margin-bottom:1rem; color:#64748b; font-size:0.9rem;">Total: ${sortedCustomers.length} unique customers</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Customer</th>
                        <th style="text-align:center; padding:0.75rem; color:#64748b; font-weight:600;">Orders</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Total Revenue</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Last Order</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedCustomers.map(c => `
                        <tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" onclick="window.showCustomerOrders('${c.name.replace(/'/g, "\\'")}')">
                            <td style="padding:0.75rem; font-weight:500; color:#334155;">${c.name}</td>
                            <td style="padding:0.75rem; text-align:center;">${c.orders}</td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${formatCurrency(c.revenue)}</td>
                            <td style="padding:0.75rem; text-align:right; font-size:0.8rem; color:#64748b;">${c.lastOrder ? c.lastOrder.toLocaleDateString('en-IN') : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        showDetailModal('Customer Directory', content);
    };

    // Show products detail
    window.showProductsDetail = () => {
        const productStats = {};
        orders.forEach(o => {
            if (o.cart && Array.isArray(o.cart)) {
                o.cart.forEach(item => {
                    const name = item.name || 'Unknown';
                    if (!productStats[name]) {
                        productStats[name] = { name, qty: 0, revenue: 0, orders: 0 };
                    }
                    productStats[name].qty += item.qty || 0;
                    productStats[name].revenue += (item.price || 0) * (item.qty || 0);
                    productStats[name].orders += 1;
                });
            }
        });

        const sortedProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

        const content = `
            <div style="margin-bottom:1rem; color:#64748b; font-size:0.9rem;">Products sold across all orders</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Product</th>
                        <th style="text-align:center; padding:0.75rem; color:#64748b; font-weight:600;">Qty Sold</th>
                        <th style="text-align:center; padding:0.75rem; color:#64748b; font-weight:600;">Orders</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedProducts.map(p => `
                        <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:0.75rem; font-weight:500; color:#334155;">${p.name}</td>
                            <td style="padding:0.75rem; text-align:center;">${p.qty}</td>
                            <td style="padding:0.75rem; text-align:center;">${p.orders}</td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${formatCurrency(p.revenue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        showDetailModal('Product Performance', content);
    };

    // Show orders by status
    window.showOrdersByStatus = (status) => {
        const filteredOrders = orders.filter(o => (o.status || 'Pending') === status);
        const content = `
            <div style="margin-bottom:1rem; color:#64748b; font-size:0.9rem;">${filteredOrders.length} orders with status: <strong>${status}</strong></div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Order ID</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Customer</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Amount</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(o => `
                        <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:0.75rem; font-family:monospace; font-size:0.8rem;">${o.id || 'N/A'}</td>
                            <td style="padding:0.75rem;">${o.customerName || 'Unknown'}</td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${o.totalValue || '₹0'}</td>
                            <td style="padding:0.75rem; font-size:0.8rem; color:#64748b;">${o.timestamp ? new Date(o.timestamp).toLocaleDateString('en-IN') : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        showDetailModal(`${status} Orders`, content);
    };

    // Show customer orders
    window.showCustomerOrders = (customerName) => {
        const customerOrders = orders.filter(o => (o.customerName || o.userId) === customerName);
        const totalSpent = customerOrders.reduce((s, o) => {
            const val = parseInt(String(o.totalValue || '0').replace(/[^0-9]/g, ''), 10);
            return s + (isNaN(val) ? 0 : val);
        }, 0);

        const content = `
            <div style="background:#f8fafc; padding:1rem; border-radius:12px; margin-bottom:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0 0 0.25rem 0; color:#1e293b;">${customerName}</h3>
                        <p style="margin:0; color:#64748b; font-size:0.9rem;">${customerOrders.length} orders • ${formatCurrency(totalSpent)} total spent</p>
                    </div>
                    <div style="background:#059669; color:white; padding:0.5rem 1rem; border-radius:20px; font-size:0.8rem; font-weight:600;">
                        Avg: ${formatCurrency(Math.round(totalSpent / customerOrders.length))}
                    </div>
                </div>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f1f5f9; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Order ID</th>
                        <th style="text-align:center; padding:0.75rem; color:#64748b; font-weight:600;">Status</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Amount</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Items</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${customerOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(o => {
                        const statusColors = {
                            'Pending': '#f59e0b',
                            'Accepted': '#3b82f6',
                            'Fulfilled': '#10b981',
                            'Rejected': '#ef4444'
                        };
                        return `<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:0.75rem; font-family:monospace; font-size:0.8rem;">${o.id || 'N/A'}</td>
                            <td style="padding:0.75rem; text-align:center;">
                                <span style="background:${statusColors[o.status] || '#64748b'}20; color:${statusColors[o.status] || '#64748b'}; padding:0.25rem 0.5rem; border-radius:12px; font-size:0.75rem; font-weight:600;">${o.status || 'Pending'}</span>
                            </td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${o.totalValue || '₹0'}</td>
                            <td style="padding:0.75rem; font-size:0.8rem; color:#64748b;">${o.orderSummary || 'N/A'}</td>
                            <td style="padding:0.75rem; font-size:0.8rem; color:#64748b;">${o.timestamp ? new Date(o.timestamp).toLocaleDateString('en-IN') : 'N/A'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        showDetailModal(`Customer: ${customerName}`, content);
    };

    // Show category orders
    window.showCategoryOrders = (category) => {
        const catLabels = { 'daily': 'Daily Essentials', 'rotate': 'High Rotation', 'regional': 'Regional Specials' };
        const categoryOrders = orders.filter(o => {
            if (!o.cart) return false;
            return o.cart.some(item => {
                const product = products.find(p => p.id === item.id || p.name === item.name);
                return product?.category === category;
            });
        });

        const content = `
            <div style="margin-bottom:1rem; color:#64748b; font-size:0.9rem;">${categoryOrders.length} orders containing ${catLabels[category] || category} products</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Order ID</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Customer</th>
                        <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">${catLabels[category] || category} Items</th>
                        <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${categoryOrders.map(o => {
                        const categoryItems = o.cart?.filter(item => {
                            const product = products.find(p => p.id === item.id || p.name === item.name);
                            return product?.category === category;
                        }) || [];
                        return `<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:0.75rem; font-family:monospace; font-size:0.8rem;">${o.id || 'N/A'}</td>
                            <td style="padding:0.75rem;">${o.customerName || 'Unknown'}</td>
                            <td style="padding:0.75rem; font-size:0.8rem;">${categoryItems.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                            <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${o.totalValue || '₹0'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        showDetailModal(`${catLabels[category] || category} Orders`, content);
    };

    // Show online users detail
    window.showOnlineUsersDetail = () => {
        const content = `
            <div style="margin-bottom:1rem; color:#64748b; font-size:0.9rem;">${onlineUsers.length} users currently active</div>
            ${onlineUsers.length > 0 ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
                    ${onlineUsers.map(u => `
                        <div style="background:#f0fdf4; padding:1rem; border-radius:12px; border:1px solid #10b98140;">
                            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
                                <span style="width:10px; height:10px; background:#10b981; border-radius:50%; animation:pulse 2s infinite;"></span>
                                <span style="font-weight:600; color:#065f46;">${u.displayName || 'Anonymous'}</span>
                            </div>
                            ${u.email ? `<div style="font-size:0.8rem; color:#64748b; margin-bottom:0.25rem;">${u.email}</div>` : ''}
                            <div style="font-size:0.75rem; color:#94a3b8;">Active now</div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p style="color:#64748b;">No users currently online</p>'}
        `;
        showDetailModal('Online Users', content);
    };
}

/**
 * Render charts
 * @param {Object} revByDate - Revenue by date mapping
 * @param {Object} pop - Product popularity mapping
 * @param {Object} statusBreakdown - Order status counts
 * @param {Object} categoryRevenue - Revenue by category
 * @param {Array} ordersByHour - Orders count by hour
 */
function renderCharts(revByDate, pop, statusBreakdown, categoryRevenue, ordersByHour) {
    // Cleanup existing charts
    if (adminRevChartInstance) {
        adminRevChartInstance.destroy();
        adminRevChartInstance = null;
    }
    if (adminPopChartInstance) {
        adminPopChartInstance.destroy();
        adminPopChartInstance = null;
    }
    if (adminStatusChartInstance) {
        adminStatusChartInstance.destroy();
        adminStatusChartInstance = null;
    }
    if (adminCategoryChartInstance) {
        adminCategoryChartInstance.destroy();
        adminCategoryChartInstance = null;
    }
    if (adminHourChartInstance) {
        adminHourChartInstance.destroy();
        adminHourChartInstance = null;
    }

    const ctxRev = document.getElementById('adminRevChart');
    if (ctxRev && window.Chart) {
        const labels = Object.keys(revByDate).slice(-7);
        const data = Object.values(revByDate).slice(-7);
        
        adminRevChartInstance = new window.Chart(ctxRev, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Daily Revenue (₹)',
                    data,
                    borderColor: '#3b82f6',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    }

    const ctxPop = document.getElementById('adminPopChart');
    const top5 = Object.entries(pop)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (ctxPop && top5.length && window.Chart) {
        adminPopChartInstance = new window.Chart(ctxPop, {
            type: 'doughnut',
            data: {
                labels: top5.map(x => x[0]),
                datasets: [{
                    data: top5.map(x => x[1]),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const productName = top5[index][0];
                        showProductOrders(productName);
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10
                        }
                    }
                }
            }
        });
    }

    // Phase 1: Status Breakdown Chart
    const ctxStatus = document.getElementById('adminStatusChart');
    if (ctxStatus && window.Chart && Object.keys(statusBreakdown).length > 0) {
        const statusColors = {
            'Pending': '#f59e0b',
            'Accepted': '#3b82f6',
            'Fulfilled': '#10b981',
            'Rejected': '#ef4444'
        };
        
        adminStatusChartInstance = new window.Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusBreakdown),
                datasets: [{
                    data: Object.values(statusBreakdown),
                    backgroundColor: Object.keys(statusBreakdown).map(s => statusColors[s] || '#64748b'),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                cutout: '60%',
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const status = Object.keys(statusBreakdown)[index];
                        window.showOrdersByStatus(status);
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Phase 2: Category Revenue Chart
    const ctxCategory = document.getElementById('adminCategoryChart');
    if (ctxCategory && window.Chart) {
        const catLabels = {
            'daily': 'Daily Essentials',
            'rotate': 'High Rotation',
            'regional': 'Regional Specials'
        };
        const catColors = ['#10b981', '#3b82f6', '#f59e0b'];
        
        const filteredCategories = Object.entries(categoryRevenue)
            .filter(([cat, val]) => cat !== 'unknown' && val > 0);
        
        if (filteredCategories.length > 0) {
            adminCategoryChartInstance = new window.Chart(ctxCategory, {
                type: 'pie',
                data: {
                    labels: filteredCategories.map(([cat]) => catLabels[cat] || cat),
                    datasets: [{
                        data: filteredCategories.map(([, val]) => val),
                        backgroundColor: catColors.slice(0, filteredCategories.length),
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    responsive: true,
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const categoryKey = filteredCategories[index][0];
                            window.showCategoryOrders(categoryKey);
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // Phase 2: Peak Hours Bar Chart
    const ctxHour = document.getElementById('adminHourChart');
    if (ctxHour && window.Chart && ordersByHour) {
        const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        
        adminHourChartInstance = new window.Chart(ctxHour, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Orders',
                    data: ordersByHour,
                    backgroundColor: ordersByHour.map((_, i) => {
                        const maxOrders = Math.max(...ordersByHour);
                        return ordersByHour[i] === maxOrders ? '#10b981' : '#3b82f680';
                    }),
                    borderColor: ordersByHour.map((_, i) => {
                        const maxOrders = Math.max(...ordersByHour);
                        return ordersByHour[i] === maxOrders ? '#059669' : '#3b82f6';
                    }),
                    borderWidth: 1,
                    borderRadius: 2
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 12,
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Show orders for a specific product
 * @param {string} productName
 */
function showProductOrders(productName) {
    const productOrders = cachedOrders.filter(o => {
        if (!o.cart) return false;
        return o.cart.some(item => item.name === productName);
    });

    const totalQty = productOrders.reduce((sum, o) => {
        const item = o.cart?.find(i => i.name === productName);
        return sum + (item?.qty || 0);
    }, 0);

    const content = `
        <div style="background:#f8fafc; padding:1rem; border-radius:12px; margin-bottom:1.5rem;">
            <h3 style="margin:0 0 0.5rem 0; color:#1e293b;">${productName}</h3>
            <p style="margin:0; color:#64748b; font-size:0.9rem;">${productOrders.length} orders • ${totalQty} units sold</p>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
                <tr style="background:#f1f5f9; border-bottom:2px solid #e2e8f0;">
                    <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Order ID</th>
                    <th style="text-align:left; padding:0.75rem; color:#64748b; font-weight:600;">Customer</th>
                    <th style="text-align:center; padding:0.75rem; color:#64748b; font-weight:600;">Quantity</th>
                    <th style="text-align:right; padding:0.75rem; color:#64748b; font-weight:600;">Order Total</th>
                </tr>
            </thead>
            <tbody>
                ${productOrders.map(o => {
                    const item = o.cart?.find(i => i.name === productName);
                    return `<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding:0.75rem; font-family:monospace; font-size:0.8rem;">${o.id || 'N/A'}</td>
                        <td style="padding:0.75rem;">${o.customerName || 'Unknown'}</td>
                        <td style="padding:0.75rem; text-align:center; font-weight:600;">${item?.qty || 0}</td>
                        <td style="padding:0.75rem; text-align:right; font-weight:600; color:#059669;">${o.totalValue || '₹0'}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    showDetailModal(`Product: ${productName}`, content);
}

/**
 * Cleanup chart instances when tab is hidden
 */
export function cleanupCharts() {
    if (adminRevChartInstance) {
        adminRevChartInstance.destroy();
        adminRevChartInstance = null;
    }
    if (adminPopChartInstance) {
        adminPopChartInstance.destroy();
        adminPopChartInstance = null;
    }
    if (adminStatusChartInstance) {
        adminStatusChartInstance.destroy();
        adminStatusChartInstance = null;
    }
    if (adminCategoryChartInstance) {
        adminCategoryChartInstance.destroy();
        adminCategoryChartInstance = null;
    }
    if (adminHourChartInstance) {
        adminHourChartInstance.destroy();
        adminHourChartInstance = null;
    }
}
