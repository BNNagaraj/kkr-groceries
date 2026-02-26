import './styles/main.css';

// Suppress Google Maps Places deprecation warning - we're using PlaceAutocompleteElement
const originalWarn = console.warn;
console.warn = function(...args) {
    const message = args[0] || '';
    if (typeof message === 'string' && 
        (message.includes('google.maps.places.Autocomplete is not available to new customers') ||
         message.includes('PlaceAutocompleteElement is recommended'))) {
        return; // Suppress this warning
    }
    originalWarn.apply(console, args);
};

import { db } from './services/firebase.js';
import { state, loadProducts, ADMIN_EMAILS } from './store.js';
import { setupAuthListener, openAuthModal, closeAuthModal, signInWithGoogle, signOutUser, sendOTP, verifyOTP } from './services/auth.js';
import { generateAPMCPrices } from './services/apmc.js';
import { renderProducts, handleSearch, filterCategory, renderSkeletonCards, setSort, openImageZoom, closeImageZoom } from './components/products.js';
import { updateUI, onProductGridClick, onProductQtyChange, adjustCartItem, removeCartItem, handleCartQtyChange } from './components/cart.js';
import { initVersionCheck, initServiceWorkerUpdateCheck } from './utils/versionCheck.js';
import { showUpdateNotification, addUpdateNotificationStyles, initUpdateNotification } from './components/updateNotification.js';
import { openEnquiryModal, closeEnquiryModal, submitEnquiryForm } from './components/enquiry.js';
import { 
    toggleAdmin, switchAdminTab, renderApmcTab, adminUpdateOrderStatus, 
    adminSaveAllProducts, adminExportProductsCSV, adminExportProductsExcel, 
    adminDeleteProduct, adminAddProduct, renderPricesTab, adminEditOrder, adminDownloadInvoice, 
    closeEditOrderModal, recalcEditOrder, saveEditedOrder, adminUploadImage, 
    adminUpgradeDefaultImages, cropAndUploadImage, closeCropperModal,
    adminChangeMarket, adminRefreshAPMC, renderOrdersTab, renderMapsTab, 
    renderStatsTab, saveAdminMapSettings, triggerFileInput,
    handleProductSearch, handleCategoryFilter, clearProductFilters, toggleAllMoq, toggleProductMoq,
    adminCancelModification
} from './components/admin/index.js';

// Import new admin portal pages
import {
    renderAdminDashboardPage,
    renderAdminPricesPage,
    renderAdminApmcPage,
    renderAdminOrdersPage,
    renderAdminMapsPage,
    cleanupAdminPages
} from './components/admin/pages.js';
import { openBuyerDashboard, closeBuyerDashboard, switchBuyerTab, buyerDeleteSavedAddress, reorder, downloadInvoice, acceptOrderModification, rejectOrderModification } from './components/buyer.js';
import { initMapServices, initDeliveryMap, getCurrentLocation, updateMapCircle } from './components/map.js';
import { showToast } from './utils/dom.js';
import { saveAdminSettings } from './services/settings.js';
import { initErrorHandlers } from './utils/errorHandler.js';
import { initRouter, router } from './router.js';

// Initialize global error handlers
initErrorHandlers();

// Initialize router
initRouter({
    toggleAdmin,
    openBuyerDashboard,
    openEnquiryModal,
    isAdmin: () => state.isAdminClaim || ADMIN_EMAILS.includes(state.currentUser?.email?.toLowerCase()),
    // New admin portal pages
    renderAdminDashboardPage,
    renderAdminPricesPage,
    renderAdminApmcPage,
    renderAdminOrdersPage,
    renderAdminMapsPage,
    cleanupAdminPages
});

// Wait for DOM to wire up main event listeners
document.addEventListener('DOMContentLoaded', () => {
    generateAPMCPrices();
    setupEventListeners();
    setupAuthListener();
    loadProducts(db, () => {
        renderProducts(state.currentCategory);
        updateUI();
    });
    
    // Initialize update checking
    addUpdateNotificationStyles();
    initUpdateNotification();
    initVersionCheck((newVersion, currentVersion) => {
        showUpdateNotification(newVersion, currentVersion);
    });
    initServiceWorkerUpdateCheck(() => {
        showUpdateNotification('New Service Worker', 'Previous');
    });
});

function setupEventListeners() {
    const obtn = document.getElementById('openEnquiryBtn');
    if (obtn) obtn.addEventListener('click', openEnquiryModal);

    const cbtn = document.getElementById('closeEnquiryBtn');
    if (cbtn) cbtn.addEventListener('click', closeEnquiryModal);

    const enqMod = document.getElementById('enquiryModal');
    if (enqMod) enqMod.addEventListener('click', e => { if (e.target === e.currentTarget) closeEnquiryModal(); });

    const modContent = document.querySelector('.modal-content');
    if (modContent) modContent.addEventListener('click', e => e.stopPropagation());

    const pGrid = document.getElementById('productsGrid');
    if (pGrid) {
        pGrid.addEventListener('click', onProductGridClick);
        pGrid.addEventListener('change', onProductQtyChange);
    }

    const form = document.getElementById('enquiryForm');
    if (form) form.addEventListener('submit', submitEnquiryForm);

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            if (category) filterCategory(category);
        });
    });

    // Auth Modal handling (if not closed via other means)
    const oabtn = document.getElementById('closeAuthBtn');
    if (oabtn) oabtn.addEventListener('click', closeAuthModal);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeEnquiryModal();
            closeAuthModal();
            closeBuyerDashboard();
            const ap = document.getElementById('adminPanel');
            if (ap && ap.classList.contains('open')) toggleAdmin();
        }
    });

    // Dropdown toggling
    document.addEventListener('click', e => {
        const menu = document.getElementById('userMenu');
        const userDropdown = document.getElementById('userDropdown');
        if (menu && userDropdown && !menu.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });

    // Map script lazy load is called in HTML via callback `initMapServices`
    // but we can also manually wire it if loaded synchronous
    if (window.google) initMapServices();
}


// ===== EXPOSE TO WINDOW (for HTML onclick handlers) =====
// The existing HTML markup makes extensive use of onclick attributes (e.g. filter buttons, tabs).
// Injecting these into window enables them to fire correctly in Vite's ES module context.
Object.assign(window, {
    handleSearch,
    filterCategory,
    setSort,
    openEnquiryModal,
    closeEnquiryModal,
    openAuthModal,
    closeAuthModal,
    signInWithGoogle,
    signOutUser,
    sendOTP,
    verifyOTP,
    toggleUserDropdown: () => {
        const d = document.getElementById('userDropdown');
        if (d) d.classList.toggle('show');
    },
    openBuyerDashboard,
    closeBuyerDashboard,
    switchBuyerTab,
    reorder,
    downloadInvoice,
    acceptOrderModification,
    rejectOrderModification,
    toggleAdmin,
    switchAdminTab,
    saveAdminSettings,
    saveAdminMapSettings,
    adminUpdateOrderStatus,
    adminSaveAllProducts,
    adminExportProductsCSV,
    adminExportProductsExcel,
    adminDeleteProduct,
    adminAddProduct,
    renderPricesTab,
    renderOrdersTab,
    renderMapsTab,
    renderStatsTab,
    adminEditOrder,
    adminDownloadInvoice,
    adminCancelModification,
    closeEditOrderModal,
    recalcEditOrder,
    saveEditedOrder,
    adminUploadImage,
    cropAndUploadImage,
    adminUpgradeDefaultImages,
    triggerFileInput,
    handleProductSearch,
    handleCategoryFilter,
    clearProductFilters,
    toggleAllMoq,
    toggleProductMoq,
    getCurrentLocation,
    buyerDeleteSavedAddress,
    generateAPMCPrices,
    renderApmcTab,
    adminChangeMarket,
    adminRefreshAPMC,
    adminDownloadInvoice,
    renderProducts,
    renderSkeletonCards,
    openImageZoom,
    closeImageZoom,
    showToast,
    initMapServices,
    initDeliveryMap,
    updateMapCircle,
    closeCropperModal,
    updateUI,
    adjustCartItem,
    removeCartItem,
    handleCartQtyChange,
    router,
    navigate: router.navigate.bind(router)
});

// Since state properties must map dynamically for direct variable refs in older code blocks:
Object.defineProperty(window, 'currentCategory', { get: () => state.currentCategory });
Object.defineProperty(window, 'selectedApmcMarket', { get: () => state.selectedApmcMarket });

// Dynamically inject Google Maps after the callback is securely on the window object
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== 'your_google_maps_key') {
    const mapScript = document.createElement('script');
    // Use loading=async for best-practice loading pattern
    // Use v=beta to access the new Places library with PlaceAutocompleteElement
    mapScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry&callback=initMapServices&loading=async`;
    mapScript.async = true;
    mapScript.defer = true;
    mapScript.onerror = () => {
        console.error('Failed to load Google Maps API. Please check your API key and network connection.');
    };
    document.head.appendChild(mapScript);
} else {
    console.warn('Google Maps API key not configured. Map features will be disabled.');
}
