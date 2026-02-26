/**
 * Admin Dashboard Module - Main Entry Point
 * Consolidates all admin functionality
 */

import { state, isAdmin } from '../../store.js';
import { showToast } from '../../utils/dom.js';
import { logError } from '../../utils/errorHandler.js';

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
 * Toggle admin panel visibility
 */
export function toggleAdmin() {
    if (!isAdmin()) {
        showToast('Admin access restricted', 'error');
        return;
    }

    const panel = document.getElementById('adminPanel');
    if (!panel) return;

    panel.classList.toggle('open');
    
    if (panel.classList.contains('open')) {
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
