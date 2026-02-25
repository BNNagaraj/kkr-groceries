/**
 * Admin Portal Pages
 * Full-page wrappers for each admin section
 */

import { renderAdminLayout, cleanupAdminLayout } from './layout.js';
import { renderPricesTab, adminExportProductsCSV, adminExportProductsExcel, adminSaveAllProducts, adminDeleteProduct, adminAddProduct, adminUpgradeDefaultImages, handleProductSearch, handleCategoryFilter, clearProductFilters, toggleAllMoq, toggleProductMoq } from './prices.js';
import { renderOrdersTab, adminUpdateOrderStatus, adminEditOrder, recalcEditOrder, closeEditOrderModal, saveEditedOrder, adminDownloadInvoice, adminCancelModification } from './orders.js';
import { renderStatsTab, cleanupCharts } from './stats.js';
import { renderMapsTab, saveAdminMapSettings } from './maps.js';
import { renderApmcTab, adminChangeMarket, adminRefreshAPMC } from './apmc.js';
import { adminUploadImage, cropAndUploadImage, closeCropperModal, triggerFileInput } from './images.js';

// Store active page for cleanup
let activePage = null;

/**
 * Create container element for tab content
 */
function createTabContainer(id) {
    const div = document.createElement('div');
    div.id = id;
    return div;
}

/**
 * Render Dashboard Analytics Page
 */
export function renderAdminDashboardPage() {
    activePage = 'dashboard';
    renderAdminLayout((container) => {
        const statsContainer = createTabContainer('adminStatsTab');
        container.appendChild(statsContainer);
        renderStatsTab();
    });
}

/**
 * Render Prices & MOQ Management Page
 */
export function renderAdminPricesPage() {
    activePage = 'prices';
    renderAdminLayout((container) => {
        const pricesContainer = createTabContainer('adminPricesTab');
        container.appendChild(pricesContainer);
        renderPricesTab();
    });
}

/**
 * Render APMC Live Prices Page
 */
export function renderAdminApmcPage() {
    activePage = 'apmc';
    renderAdminLayout((container) => {
        const apmcContainer = createTabContainer('adminApmcTab');
        container.appendChild(apmcContainer);
        renderApmcTab();
    });
}

/**
 * Render Order Management Page
 */
export function renderAdminOrdersPage() {
    activePage = 'orders';
    renderAdminLayout((container) => {
        const ordersContainer = createTabContainer('adminOrdersTab');
        container.appendChild(ordersContainer);
        renderOrdersTab();
    });
}

/**
 * Render Maps & Forms Settings Page
 */
export function renderAdminMapsPage() {
    activePage = 'maps';
    renderAdminLayout((container) => {
        const mapsContainer = createTabContainer('adminMapsTab');
        container.appendChild(mapsContainer);
        renderMapsTab();
    });
}

/**
 * Cleanup when leaving admin portal
 */
export function cleanupAdminPages() {
    if (activePage === 'dashboard') {
        cleanupCharts();
    }
    cleanupAdminLayout();
    activePage = null;
}

// Export all admin functions for global access
export {
    // Prices
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
    adminUpdateOrderStatus,
    adminEditOrder,
    recalcEditOrder,
    closeEditOrderModal,
    saveEditedOrder,
    adminDownloadInvoice,
    adminCancelModification,
    // Maps
    saveAdminMapSettings,
    // APMC
    adminChangeMarket,
    adminRefreshAPMC,
    // Images
    adminUploadImage,
    cropAndUploadImage,
    closeCropperModal,
    triggerFileInput
};
