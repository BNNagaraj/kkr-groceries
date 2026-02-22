import './styles/app.css';

import { state } from './store.js';
import { setupAuthListener, openAuthModal, closeAuthModal, signInWithGoogle, signOutUser } from './services/auth.js';
import { generateAPMCPrices } from './services/apmc.js';
import { renderProducts, handleSearch, filterCategory } from './components/products.js';
import { updateUI, onProductGridClick, onProductQtyChange } from './components/cart.js';
import { openEnquiryModal, closeEnquiryModal, submitEnquiryForm } from './components/enquiry.js';
import { toggleAdmin, switchAdminTab, renderApmcTab } from './components/admin.js';
import { openBuyerDashboard, closeBuyerDashboard, switchBuyerTab, buyerDeleteSavedAddress } from './components/buyer.js';
import { initMapServices, initDeliveryMap, getCurrentLocation } from './components/map.js';
import { showToast } from './utils/dom.js';
import { saveAdminSettings } from './services/settings.js';
import { adminUpdateOrderStatus } from './components/admin.js';

// Wait for DOM to wire up main event listeners
document.addEventListener('DOMContentLoaded', () => {
    generateAPMCPrices();
    setupEventListeners();
    setupAuthListener();
    renderProducts(state.currentCategory);
    updateUI();
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
    openEnquiryModal,
    closeEnquiryModal,
    openAuthModal,
    closeAuthModal,
    signInWithGoogle,
    signOutUser,
    toggleUserDropdown: () => {
        const d = document.getElementById('userDropdown');
        if (d) d.classList.toggle('show');
    },
    openBuyerDashboard,
    closeBuyerDashboard,
    switchBuyerTab,
    toggleAdmin,
    switchAdminTab,
    saveAdminSettings,
    adminUpdateOrderStatus,
    getCurrentLocation,
    buyerDeleteSavedAddress,
    generateAPMCPrices,
    renderApmcTab,
    renderProducts,
    showToast,
    initMapServices,
    initDeliveryMap,
    updateUI
});

// Since state properties must map dynamically for direct variable refs in older code blocks:
Object.defineProperty(window, 'currentCategory', { get: () => state.currentCategory });
Object.defineProperty(window, 'selectedApmcMarket', { get: () => state.selectedApmcMarket });
