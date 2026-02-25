/**
 * Admin APMC Price Management Module
 * Handles APMC market price display and selection
 */

import { state } from '../../store.js';
import { generateAPMCPrices } from '../../services/apmc.js';
import { renderProducts } from '../products.js';
import { showToast } from '../../utils/dom.js';

/**
 * Render the APMC prices tab
 */
export function renderApmcTab() {
    const tab = document.getElementById('adminApmcTab');
    if (!tab) return;

    if (!state.apmcPrices) generateAPMCPrices(state.selectedApmcMarket);
    
    const d = state.apmcPrices?.[0]?.date || 'N/A';

    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
        <div>
            <select id="apmcMarketSelect" onchange="window.adminChangeMarket(this.value)" style="padding:0.4rem;font-weight:700;border:2px solid #e2e8f0;border-radius:8px;margin-bottom:0.25rem">
                <option value="Bowenpally" ${state.selectedApmcMarket === 'Bowenpally' ? 'selected' : ''}>Hyderabad (Bowenpally)</option>
                <option value="Gaddiannaram" ${state.selectedApmcMarket === 'Gaddiannaram' ? 'selected' : ''}>Hyderabad (Gaddiannaram)</option>
                <option value="Gudimalkapur" ${state.selectedApmcMarket === 'Gudimalkapur' ? 'selected' : ''}>Hyderabad (Gudimalkapur)</option>
                <option value="Monda" ${state.selectedApmcMarket === 'Monda' ? 'selected' : ''}>Secunderabad (Monda Market)</option>
            </select>
            <p style="font-size:0.8rem;color:#64748b">Date: ${d} | Unit: ₹/Quintal</p>
        </div>
        <button onclick="window.adminRefreshAPMC()" style="padding:0.5rem 1rem;background:#3b82f6;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem">↻ Refresh</button>
    </div>`;

    h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.5rem;margin-bottom:1rem;text-align:center">
        <div style="padding:0.5rem;background:#dbeafe;border-radius:8px">
            <div style="font-size:0.7rem;color:#1e40af;font-weight:700">MIN</div>
        </div>
        <div style="padding:0.5rem;background:#d1fae5;border-radius:8px">
            <div style="font-size:0.7rem;color:#065f46;font-weight:700">MODAL</div>
        </div>
        <div style="padding:0.5rem;background:#fee2e2;border-radius:8px">
            <div style="font-size:0.7rem;color:#991b1b;font-weight:700">MAX</div>
        </div>
    </div>`;

    state.apmcPrices.forEach(p => {
        h += `<div class="apmc-rate-row">
            <div class="apmc-rate-name">${p.commodity}</div>
            <div class="apmc-rate-prices">
                <span class="apmc-min">₹${p.minPrice}</span>
                <span class="apmc-modal">₹${p.modalPrice}</span>
                <span class="apmc-max">₹${p.maxPrice}</span>
            </div>
        </div>`;
    });

    tab.innerHTML = h;
}

/**
 * Change APMC market
 * @param {string} marketName - Market to switch to
 */
export function adminChangeMarket(marketName) {
    generateAPMCPrices(marketName);
    renderApmcTab();
    renderProducts(window.currentCategory || 'all');
    showToast(`Switched to ${marketName} market`, 'success');
}

/**
 * Refresh APMC prices
 */
export function adminRefreshAPMC() {
    const select = document.getElementById('apmcMarketSelect');
    const market = select ? select.value : state.selectedApmcMarket;
    generateAPMCPrices(market);
    renderApmcTab();
    renderProducts(window.currentCategory || 'all');
    showToast('Prices refreshed!', 'success');
}
