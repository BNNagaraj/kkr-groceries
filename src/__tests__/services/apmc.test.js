/**
 * APMC Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    generateAPMCPrices,
    getSellingPrice,
    getAPMCPrice,
    convertToUnit,
    calculateCommission,
    formatPrice,
    APMC_MARKETS
} from '../../services/apmc.js';
import { state } from '../../store.js';

describe('APMC Markets', () => {
    it('should have defined markets', () => {
        expect(APMC_MARKETS).toContain('Bowenpally');
        expect(APMC_MARKETS).toContain('Gaddiannaram');
        expect(APMC_MARKETS.length).toBe(4);
    });
});

describe('generateAPMCPrices', () => {
    beforeEach(() => {
        state.apmcPrices = null;
    });

    it('should generate prices for default market', () => {
        const prices = generateAPMCPrices();
        expect(prices).toBeInstanceOf(Array);
        expect(prices.length).toBeGreaterThan(0);
        expect(state.selectedApmcMarket).toBe('Bowenpally');
    });

    it('should generate prices for specified market', () => {
        generateAPMCPrices('Monda');
        expect(state.selectedApmcMarket).toBe('Monda');
    });

    it('should have valid price structure', () => {
        const prices = generateAPMCPrices();
        prices.forEach(price => {
            expect(price).toHaveProperty('commodity');
            expect(price).toHaveProperty('minPrice');
            expect(price).toHaveProperty('maxPrice');
            expect(price).toHaveProperty('modalPrice');
            expect(price).toHaveProperty('date');
            expect(price.minPrice).toBeLessThanOrEqual(price.maxPrice);
            expect(price.modalPrice).toBeGreaterThanOrEqual(price.minPrice);
            expect(price.modalPrice).toBeLessThanOrEqual(price.maxPrice);
        });
    });
});

describe('getSellingPrice', () => {
    beforeEach(() => {
        state.commissionPercent = 15;
        state.apmcPrices = null;
    });

    it('should return override price if set', () => {
        const product = {
            name: 'Tomato',
            overridePrice: 50,
            price: 30
        };
        expect(getSellingPrice(product)).toBe(50);
    });

    it('should calculate price from APMC with commission', () => {
        generateAPMCPrices();
        const product = {
            name: 'Tomato',
            overridePrice: 0,
            price: 30
        };
        const price = getSellingPrice(product);
        expect(price).toBeGreaterThan(0);
    });

    it('should return base price if APMC price not found', () => {
        state.apmcPrices = [];
        const product = {
            name: 'Unknown Product',
            price: 50
        };
        expect(getSellingPrice(product)).toBe(50);
    });

    it('should handle null product', () => {
        expect(getSellingPrice(null)).toBe(0);
    });
});

describe('formatPrice', () => {
    it('should format with symbol by default', () => {
        expect(formatPrice(1000)).toBe('₹1,000');
        expect(formatPrice(100)).toBe('₹100');
    });

    it('should format without symbol when specified', () => {
        expect(formatPrice(1000, false)).toBe('1,000');
    });
});

describe('calculateCommission', () => {
    it('should calculate commission correctly', () => {
        state.commissionPercent = 15;
        expect(calculateCommission(100)).toBe(15);
        expect(calculateCommission(200)).toBe(30);
    });

    it('should use provided percentage', () => {
        expect(calculateCommission(100, 20)).toBe(20);
    });
});
