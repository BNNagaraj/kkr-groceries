/**
 * APMC Price Service
 * @module services/apmc
 */

import { state } from '../store.js';

/**
 * Commodity base price ranges (in ₹ per Quintal)
 * @type {Array<{name: string, bMin: number, bMax: number}>}
 */
const COMMODITY_BASE_RANGES = [
    { name: 'Tomato', bMin: 18, bMax: 35 },
    { name: 'Onion', bMin: 22, bMax: 45 },
    { name: 'Potato', bMin: 20, bMax: 38 },
    { name: 'Green Chilli', bMin: 30, bMax: 65 },
    { name: "Lady's Finger", bMin: 28, bMax: 50 },
    { name: 'Brinjal', bMin: 22, bMax: 42 },
    { name: 'Cauliflower', bMin: 20, bMax: 40 },
    { name: 'Cabbage', bMin: 15, bMax: 30 },
    { name: 'Carrot', bMin: 30, bMax: 55 },
    { name: 'Spinach', bMin: 10, bMax: 25 },
    { name: 'Bottle Gourd', bMin: 25, bMax: 45 },
    { name: 'Ridge Gourd', bMin: 28, bMax: 50 }
];

/**
 * Available APMC markets
 * @type {Array<string>}
 */
export const APMC_MARKETS = [
    'Bowenpally',
    'Gaddiannaram',
    'Gudimalkapur',
    'Monda'
];

/**
 * Generate APMC prices for a market
 * Note: This generates simulated prices. For production, integrate with actual APMC API.
 * @param {string} [marketName='Bowenpally'] - Market name
 * @returns {Array<import('../types/index.js').APMCPrice>}
 */
export function generateAPMCPrices(marketName = 'Bowenpally') {
    state.selectedApmcMarket = marketName;
    const d = new Date();
    
    // Create seed from date and market name
    let marketHash = 0;
    for (let i = 0; i < marketName.length; i++) {
        marketHash += marketName.charCodeAt(i);
    }
    
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + marketHash;

    state.apmcPrices = COMMODITY_BASE_RANGES.map((c, i) => {
        // Generate pseudo-random price based on seed
        const h = ((seed * (i + 7)) % 1000) / 1000;
        const min = c.bMin + Math.floor(h * (c.bMax - c.bMin) * 0.4);
        const max = c.bMin + Math.floor(h * (c.bMax - c.bMin) * 0.8) + Math.floor((c.bMax - c.bMin) * 0.3);
        const modal = Math.floor((min + max) / 2);
        
        return {
            commodity: c.name,
            minPrice: min,
            maxPrice: Math.min(max, c.bMax),
            modalPrice: modal,
            date: d.toISOString().split('T')[0]
        };
    });

    return state.apmcPrices;
}

/**
 * Get selling price for a product
 * @param {import('../types/index.js').Product} product - Product object
 * @returns {number} Selling price
 */
export function getSellingPrice(product) {
    if (!product) return 0;
    
    // Use override price if set
    if (product.overridePrice > 0) {
        return product.overridePrice;
    }

    // Generate APMC prices if not available
    if (!state.apmcPrices) {
        generateAPMCPrices();
    }
    
    // Calculate from APMC modal price
    const apmc = state.apmcPrices.find(a => a.commodity === product.name);
    if (apmc) {
        const base = apmc.modalPrice;
        return Math.round(base + base * state.commissionPercent / 100);
    }
    
    // Fallback to product price
    return product.price || 0;
}

/**
 * Get APMC price for a commodity
 * @param {string} commodityName - Commodity name
 * @returns {import('../types/index.js').APMCPrice|null}
 */
export function getAPMCPrice(commodityName) {
    if (!state.apmcPrices) {
        generateAPMCPrices();
    }
    return state.apmcPrices.find(a => a.commodity === commodityName) || null;
}

/**
 * Convert price per quintal to price per unit
 * @param {number} pricePerQuintal - Price per quintal (100 kg)
 * @param {string} unit - Target unit (kg, piece, bunch)
 * @returns {number} Price per unit
 */
export function convertToUnit(pricePerQuintal, unit) {
    const quintalInKg = 100;
    
    switch (unit.toLowerCase()) {
        case 'kg':
            return Math.round(pricePerQuintal / quintalInKg);
        case 'piece':
        case 'bunch':
            // Estimate: 1 piece/bunch ≈ 250g on average
            return Math.round(pricePerQuintal / quintalInKg * 0.25);
        default:
            return Math.round(pricePerQuintal / quintalInKg);
    }
}

/**
 * Calculate commission amount
 * @param {number} basePrice - Base price
 * @param {number} [commissionPercent] - Commission percentage (defaults to state)
 * @returns {number} Commission amount
 */
export function calculateCommission(basePrice, commissionPercent) {
    const percent = commissionPercent ?? state.commissionPercent;
    return Math.round(basePrice * percent / 100);
}

/**
 * Format price for display
 * @param {number} price - Price value
 * @param {boolean} [withSymbol=true] - Include ₹ symbol
 * @returns {string} Formatted price
 */
export function formatPrice(price, withSymbol = true) {
    const formatted = price.toLocaleString('en-IN');
    return withSymbol ? `₹${formatted}` : formatted;
}
