/**
 * Simple Hash-Based Router
 * Provides client-side routing using URL hash fragments
 */

import { showToast } from './utils/dom.js';

/**
 * Route handler function type
 * @typedef {Function} RouteHandler
 * @param {Object} params - URL parameters
 * @param {string} hash - Current hash
 */

/**
 * Route definition
 * @typedef {Object} Route
 * @property {string} path - Route path pattern
 * @property {RouteHandler} handler - Route handler function
 * @property {string} [title] - Page title
 * @property {boolean} [auth] - Requires authentication
 * @property {boolean} [admin] - Requires admin access
 */

class Router {
    constructor() {
        /** @type {Map<string, Route>} */
        this.routes = new Map();
        /** @type {Route|null} */
        this.currentRoute = null;
        this.beforeHooks = [];
        this.afterHooks = [];
        
        // Bind hash change event
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    /**
     * Register a route
     * @param {string} path - Route path (e.g., '#admin', '#dashboard/orders')
     * @param {RouteHandler} handler - Route handler
     * @param {Object} [options] - Route options
     */
    on(path, handler, options = {}) {
        const route = {
            path,
            handler,
            title: options.title || '',
            auth: options.auth || false,
            admin: options.admin || false
        };
        this.routes.set(path, route);
        return this;
    }

    /**
     * Register before hook
     * @param {Function} fn - Hook function
     */
    beforeEach(fn) {
        this.beforeHooks.push(fn);
    }

    /**
     * Register after hook
     * @param {Function} fn - Hook function
     */
    afterEach(fn) {
        this.afterHooks.push(fn);
    }

    /**
     * Navigate to a route
     * @param {string} path - Path to navigate to
     * @param {boolean} [replace=false] - Replace current history entry
     */
    navigate(path, replace = false) {
        if (replace) {
            window.location.replace(path);
        } else {
            window.location.hash = path;
        }
    }

    /**
     * Get current route parameters from hash
     * @param {string} pattern - Route pattern
     * @param {string} hash - Current hash
     * @returns {Object|null}
     */
    matchRoute(pattern, hash) {
        // Remove # from beginning and normalize leading slashes
        const cleanHash = hash.replace(/^#/, '').replace(/^\//, '');
        const cleanPattern = pattern.replace(/^#/, '').replace(/^\//, '');

        // Simple exact match first
        if (cleanPattern === cleanHash) {
            return {};
        }

        // Pattern with parameters (e.g., 'order/:id')
        const patternParts = cleanPattern.split('/');
        const hashParts = cleanHash.split('/');

        if (patternParts.length !== hashParts.length) {
            return null;
        }

        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                params[patternParts[i].slice(1)] = decodeURIComponent(hashParts[i]);
            } else if (patternParts[i] !== hashParts[i]) {
                return null;
            }
        }

        return params;
    }

    /**
     * Handle current route
     */
    async handleRoute() {
        const hash = window.location.hash || '#';
        
        // Run before hooks
        for (const hook of this.beforeHooks) {
            const result = await hook(hash, this.currentRoute);
            if (result === false) return; // Cancel navigation
        }

        // Find matching route
        let matchedRoute = null;
        let params = {};

        for (const [path, route] of this.routes) {
            const match = this.matchRoute(path, hash);
            if (match !== null) {
                matchedRoute = route;
                params = match;
                break;
            }
        }

        // Default route handler (close all panels)
        if (!matchedRoute) {
            this.closeAllPanels();
            this.currentRoute = null;
            return;
        }

        // Check authentication
        if (matchedRoute.auth && !window._appState?.currentUser) {
            showToast('Please sign in to access this page', 'info');
            if (window.openAuthModal) window.openAuthModal();
            return;
        }

        // Check admin access - will be set by initRouter
        if (matchedRoute.admin && window._appIsAdmin && !window._appIsAdmin()) {
            showToast('Admin access required', 'error');
            this.navigate('#');
            return;
        }

        // Update page title
        if (matchedRoute.title) {
            document.title = matchedRoute.title + ' | KKR Groceries';
        }

        // Execute handler
        try {
            await matchedRoute.handler(params, hash);
            this.currentRoute = matchedRoute;
        } catch (error) {
            console.error('Route handler error:', error);
            showToast('Failed to load page', 'error');
        }

        // Run after hooks
        for (const hook of this.afterHooks) {
            await hook(hash, matchedRoute);
        }
    }

    /**
     * Close all open panels/modals
     */
    closeAllPanels() {
        // Close admin panel
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel?.classList.contains('open')) {
            adminPanel.classList.remove('open');
            document.body.style.overflow = 'auto';
        }

        // Close buyer panel
        const buyerPanel = document.getElementById('buyerPanel');
        if (buyerPanel?.classList.contains('open')) {
            buyerPanel.classList.remove('open');
            document.body.style.overflow = 'auto';
        }

        // Close enquiry modal
        const enquiryModal = document.getElementById('enquiryModal');
        if (enquiryModal) {
            enquiryModal.style.display = 'none';
        }

        // Close auth modal
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.classList.remove('open');
        }

        // Reset title
        document.title = 'KKR Groceries | Hyderabad B2B Vegetable Wholesale';
    }

    /**
     * Go back in history
     */
    back() {
        window.history.back();
    }

    /**
     * Get current hash
     * @returns {string}
     */
    currentHash() {
        return window.location.hash;
    }
}

// Create singleton instance
export const router = new Router();

// Convenience exports
export const { navigate, back, currentHash } = router;

/**
 * Initialize router with application routes
 * @param {Object} options - Configuration options
 * @param {Function} options.toggleAdmin - Toggle admin panel function
 * @param {Function} options.openBuyerDashboard - Open buyer dashboard function
 * @param {Function} options.openEnquiryModal - Open enquiry modal function
 * @param {Function} options.isAdmin - Check if user is admin
 */
export function initRouter(options = {}) {
    // Expose state and isAdmin to window for router use
    window._appState = window.state;
    window._appIsAdmin = options.isAdmin;
    
    // Admin portal routes (full pages) - Note: matchRoute removes # so patterns don't include it
    router.on('#/admin/dashboard', () => {
        if (options.renderAdminDashboardPage) options.renderAdminDashboardPage();
    }, { title: 'Admin Dashboard', admin: true });

    router.on('#/admin/prices', () => {
        if (options.renderAdminPricesPage) options.renderAdminPricesPage();
    }, { title: 'Admin - Prices & MOQ', admin: true });

    router.on('#/admin/apmc', () => {
        if (options.renderAdminApmcPage) options.renderAdminApmcPage();
    }, { title: 'Admin - APMC Live', admin: true });

    router.on('#/admin/orders', () => {
        if (options.renderAdminOrdersPage) options.renderAdminOrdersPage();
    }, { title: 'Admin - Orders', admin: true });

    router.on('#/admin/maps', () => {
        if (options.renderAdminMapsPage) options.renderAdminMapsPage();
    }, { title: 'Admin - Maps & Forms', admin: true });

    // Legacy admin route (redirects to new dashboard)
    router.on('#admin', () => {
        router.navigate('#/admin/dashboard');
    }, { title: 'Admin Dashboard', admin: true });

    // Cleanup admin pages when leaving admin routes
    router.beforeEach((hash) => {
        if (!hash.startsWith('#/admin') && options.cleanupAdminPages) {
            options.cleanupAdminPages();
        }
        return true;
    });

    // Buyer routes
    router.on('#dashboard', () => {
        if (options.openBuyerDashboard) options.openBuyerDashboard();
    }, { title: 'My Dashboard', auth: true });

    router.on('#orders', () => {
        if (options.openBuyerDashboard) {
            options.openBuyerDashboard();
            setTimeout(() => {
                const tabBtn = document.querySelector('[onclick*="orders"][onclick*="buyer"]');
                if (tabBtn) tabBtn.click();
            }, 100);
        }
    }, { title: 'My Orders', auth: true });

    // Order enquiry
    router.on('#enquiry', () => {
        if (options.openEnquiryModal) options.openEnquiryModal();
    }, { title: 'Send Order Request', auth: true });

    // Category routes
    router.on('#category/:id', (params) => {
        if (window.filterCategory) {
            window.filterCategory(params.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Home route
    router.on('#', () => {
        router.closeAllPanels();
    }, { title: 'Home' });

    return router;
}
