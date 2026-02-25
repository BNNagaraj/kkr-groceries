/**
 * Admin Portal Layout with Sidebar Navigation
 * Full-page admin interface replacing modal approach
 */

import { isAdmin } from '../../store.js';
import { showToast } from '../../utils/dom.js';

// Track sidebar state
let sidebarOpen = false;

/**
 * Toggle sidebar for mobile
 */
function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.admin-sidebar-overlay');
    if (sidebar) {
        sidebar.style.transform = sidebarOpen ? 'translateX(0)' : 'translateX(-100%)';
    }
    if (overlay) {
        overlay.style.display = sidebarOpen ? 'block' : 'none';
    }
}

/**
 * Exit admin portal
 */
function exitAdmin() {
    window.location.hash = '#';
}

/**
 * Render admin layout wrapper
 * @param {Function} contentRenderer - Function to render page content
 */
export function renderAdminLayout(contentRenderer) {
    // Check admin access
    if (!isAdmin()) {
        showToast('Admin access required', 'error');
        window.location.hash = '#';
        return;
    }

    const app = document.getElementById('app');
    if (!app) return;

    // Get current route
    const hash = window.location.hash;
    const currentRoute = hash.replace('#/admin/', '').split('/')[0] || 'dashboard';

    // Navigation items
    const navItems = [
        { id: 'home', label: 'Home', icon: '🏠', isHome: true },
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'prices', label: 'Prices & MOQ', icon: '💰' },
        { id: 'apmc', label: 'APMC Live', icon: '📈' },
        { id: 'orders', label: 'Orders', icon: '📦' },
        { id: 'maps', label: 'Maps & Forms', icon: '🗺️' }
    ];

    // Build nav HTML
    let navHtml = '';
    navItems.forEach(item => {
        const isActive = currentRoute === item.id;
        const bgColor = isActive ? '#eff6ff' : 'transparent';
        const textColor = isActive ? '#2563eb' : '#64748b';
        const activeIndicator = isActive ? '<span style="margin-left: auto; font-size: 10px; color: #2563eb;">●</span>' : '';
        const href = item.isHome ? '' : `#/admin/${item.id}`;

        navHtml += `
            <a href="${href}" 
               style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; margin: 4px 12px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 15px; background: ${bgColor}; color: ${textColor}; transition: all 0.2s;">
                <span style="font-size: 20px;">${item.icon}</span>
                <span>${item.label}</span>
                ${activeIndicator}
            </a>
        `;
    });

    // Page titles
    const titles = {
        'dashboard': '📊 Dashboard Analytics',
        'prices': '💰 Prices & MOQ Management',
        'apmc': '📈 APMC Live Prices',
        'orders': '📦 Order Management',
        'maps': '🗺️ Maps & Form Settings'
    };
    const pageTitle = titles[currentRoute] || 'Admin Portal';

    // Create layout
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-portal-wrapper';
    wrapper.innerHTML = `
        <style>
            .admin-portal-wrapper { min-height: 100vh; display: flex; background: #f8fafc; }
            .admin-sidebar { width: 260px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 1001; }
            .admin-main { flex: 1; margin-left: 260px; padding: 24px; min-height: 100vh; }
            .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
            .admin-content { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; min-height: calc(100vh - 140px); }
            .admin-mobile-header { display: none; }
            
            @media (max-width: 1024px) {
                .admin-sidebar { transform: translateX(-100%); transition: transform 0.3s; }
                .admin-sidebar.open { transform: translateX(0); }
                .admin-main { margin-left: 0; margin-top: 60px; padding: 16px; }
                .admin-mobile-header { display: flex !important; position: fixed; top: 0; left: 0; right: 0; height: 60px; background: white; border-bottom: 1px solid #e2e8f0; z-index: 1000; padding: 0 16px; align-items: center; justify-content: space-between; }
                .admin-sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; }
                .admin-sidebar-overlay.open { display: block; }
            }
            
            .nav-link:hover { background: #f1f5f9 !important; }
        </style>

        <!-- Mobile Header -->
        <div class="admin-mobile-header">
            <div style="display: flex; align-items: center; gap: 12px;">
                <button id="sidebarToggle" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 8px;">☰</button>
                <span style="font-weight: 700; font-size: 18px; color: #1e293b;">🥬 Admin</span>
            </div>
            <button id="exitAdminMobile" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">Exit</button>
        </div>

        <!-- Sidebar Overlay (mobile) -->
        <div class="admin-sidebar-overlay" id="sidebarOverlay"></div>

        <!-- Sidebar -->
        <aside class="admin-sidebar" id="adminSidebar">
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">🥬</span>
                <span style="font-weight: 700; font-size: 18px; color: #1e293b;">Admin Portal</span>
                <button id="closeSidebar" style="display: none; margin-left: auto; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            </div>

            <nav style="flex: 1; padding: 16px 0; overflow-y: auto;">
                ${navHtml}
            </nav>

            <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0;">
                <button id="exitAdmin" style="width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; font-weight: 500; justify-content: center;">
                    <span>←</span>
                    <span>Exit Admin</span>
                </button>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="admin-main">
            <div class="admin-header">
                <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 0;">${pageTitle}</h1>
                <div style="display: flex; align-items: center; gap: 16px;">
                    <span style="color: #64748b; font-size: 14px;">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <button id="exitAdminDesktop" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500;">Exit Admin</button>
                </div>
            </div>

            <div class="admin-content" id="adminPageContent">
                <!-- Content rendered here -->
            </div>
        </main>
    `;

    // Clear and append
    app.innerHTML = '';
    app.appendChild(wrapper);

    // Setup event listeners
    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', toggleSidebar);
    document.getElementById('exitAdmin')?.addEventListener('click', exitAdmin);
    document.getElementById('exitAdminDesktop')?.addEventListener('click', exitAdmin);
    document.getElementById('exitAdminMobile')?.addEventListener('click', exitAdmin);

    // Render content
    const contentContainer = document.getElementById('adminPageContent');
    if (contentContainer && contentRenderer) {
        contentRenderer(contentContainer);
    }
}

/**
 * Cleanup when leaving admin portal
 */
export function cleanupAdminLayout() {
    sidebarOpen = false;
}
