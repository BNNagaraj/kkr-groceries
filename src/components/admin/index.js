/**
 * Admin Dashboard Module - Main Entry Point
 * Consolidates all admin functionality
 */

import { state, isAdmin } from '../../store.js';
import { showToast } from '../../utils/dom.js';
import { logError } from '../../utils/errorHandler.js';
import { auth } from '../../services/firebase.js';

// Import sub-modules
import { renderPricesTab, adminExportProductsCSV, adminExportProductsExcel, adminSaveAllProducts, adminDeleteProduct, adminAddProduct, adminUpgradeDefaultImages, handleProductSearch, handleCategoryFilter, clearProductFilters, toggleAllMoq, toggleProductMoq } from './prices.js';
import { renderOrdersTab, adminUpdateOrderStatus, adminEditOrder, recalcEditOrder, closeEditOrderModal, saveEditedOrder, adminDownloadInvoice, adminCancelModification, loadMoreOrders, resetAndLoadOrders } from './orders.js';
import { renderStatsTab, cleanupCharts } from './stats.js';
import { adminUploadImage, cropAndUploadImage, closeCropperModal, initCropperKeyboardShortcuts, triggerFileInput } from './images.js';
import { renderMapsTab, saveAdminMapSettings } from './maps.js';
import { renderApmcTab, adminChangeMarket, adminRefreshAPMC } from './apmc.js';

// Track active tab for cleanup
let activeTab = 'prices';

/**
 * Check admin token and show warning if claim is missing
 */
async function checkAdminToken() {
    const user = auth.currentUser;
    if (!user) return;
    
    const adminEmails = [
        'raju2uraju@gmail.com',
        'kanthati.chakri@gmail.com'
    ];
    
    // Check if user is admin by email but missing claim
    if (adminEmails.includes(user.email?.toLowerCase()) && !state.isAdminClaim) {
        try {
            // Try to refresh token
            await user.getIdToken(true);
            const tokenResult = await user.getIdTokenResult();
            state.isAdminClaim = tokenResult.claims.admin === true;
            
            if (!state.isAdminClaim) {
                // Show warning banner
                showAdminWarningBanner();
            }
        } catch (e) {
            showAdminWarningBanner();
        }
    }
}

/**
 * Show admin warning banner for missing claim
 */
function showAdminWarningBanner() {
    const panel = document.getElementById('adminPanel');
    if (!panel || panel.querySelector('.admin-warning-banner')) return;
    
    const banner = document.createElement('div');
    banner.className = 'admin-warning-banner';
    banner.style.cssText = `
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #92400e;
        padding: 12px 16px;
        margin: 10px;
        border-radius: 8px;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    `;
    banner.innerHTML = `
        <span>⚠️ Admin permissions not fully activated. Some actions may fail. <strong>Please sign out and sign back in</strong> to refresh your access.</span>
        <button onclick="window.signOutAndReload()" style="
            background: #f59e0b;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            white-space: nowrap;
        ">Sign Out</button>
    `;
    
    panel.insertBefore(banner, panel.firstChild);
    
    // Add global function for sign out
    window.signOutAndReload = () => {
        auth.signOut().then(() => {
            window.location.href = '/?message=Please sign in again to activate admin permissions';
        });
    };
}

/**
 * Toggle admin panel visibility
 */
export async function toggleAdmin() {
    if (!isAdmin()) {
        showToast('Admin access restricted', 'error');
        return;
    }

    const panel = document.getElementById('adminPanel');
    if (!panel) return;

    panel.classList.toggle('open');
    
    if (panel.classList.contains('open')) {
        // Check admin token status
        await checkAdminToken();
        renderPricesTab();
        document.body.style.overflow = 'hidden';
        initCropperKeyboardShortcuts();
    } else {
        document.body.style.overflow = 'auto';
        cleanupCharts();
    }
}

/**
 * Switch between admin tabs
 * @param {string} tab - Tab name to switch to
 * @param {HTMLElement} btn - Button element that was clicked
 */
export function switchAdminTab(tab, btn) {
    // Cleanup previous tab
    if (activeTab === 'stats') {
        cleanupCharts();
    }

    // Update button states
    document.querySelectorAll('#adminPanel .admin-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Show/hide tab content
    const tabNames = ['Prices', 'Apmc', 'Orders', 'Maps', 'Stats'];
    tabNames.forEach(t => {
        const el = document.getElementById('admin' + t + 'Tab');
        if (el) el.style.display = tab === t.toLowerCase() ? 'block' : 'none';
    });

    // Render tab content
    activeTab = tab;
    switch (tab) {
        case 'prices':
            renderPricesTab();
            break;
        case 'apmc':
            renderApmcTab();
            break;
        case 'orders':
            renderOrdersTab();
            break;
        case 'maps':
            renderMapsTab();
            break;
        case 'stats':
            renderStatsTab();
            break;
    }
}

// Re-export all functions for backward compatibility
export {
    // Prices
    renderPricesTab,
    adminExportProductsCSV,
    adminExportProductsExcel,
    adminSaveAllProducts,
    adminDeleteProduct,
    adminAddProduct,
    adminUpgradeDefaultImages,
    handleProductSearch,
    handleCategoryFilter,
    clearProductFilters,
    toggleAllMoq,
    toggleProductMoq,
    
    // Orders
    renderOrdersTab,
    adminUpdateOrderStatus,
    adminEditOrder,
    recalcEditOrder,
    closeEditOrderModal,
    saveEditedOrder,
    adminDownloadInvoice,
    adminCancelModification,
    loadMoreOrders,
    resetAndLoadOrders,
    
    // Stats
    renderStatsTab,
    cleanupCharts,
    
    // Images
    adminUploadImage,
    cropAndUploadImage,
    closeCropperModal,
    initCropperKeyboardShortcuts,
    triggerFileInput,
    
    // Maps
    renderMapsTab,
    saveAdminMapSettings,
    
    // APMC
    renderApmcTab,
    adminChangeMarket,
    adminRefreshAPMC
};
