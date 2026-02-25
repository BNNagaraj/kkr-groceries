/**
 * Validation Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
    validatePhone,
    validatePincode,
    validateName,
    validateEmail,
    validateAddress,
    validateQuantity,
    validatePrice,
    sanitizeInput
} from '../../utils/validation.js';

describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
        expect(validatePhone('9876543210').valid).toBe(true);
        expect(validatePhone('98765 43210').valid).toBe(true);
        expect(validatePhone('9876543210').error).toBeNull();
    });

    it('should reject invalid phone numbers', () => {
        expect(validatePhone('1234567890').valid).toBe(false); // Invalid start
        expect(validatePhone('987654321').valid).toBe(false); // Too short
        expect(validatePhone('98765432101').valid).toBe(false); // Too long
        expect(validatePhone('').valid).toBe(false); // Empty
    });
});

describe('validatePincode', () => {
    it('should validate correct pincodes', () => {
        expect(validatePincode('500001').valid).toBe(true);
        expect(validatePincode('500032').valid).toBe(true);
    });

    it('should reject invalid pincodes', () => {
        expect(validatePincode('50001').valid).toBe(false); // Too short
        expect(validatePincode('5000001').valid).toBe(false); // Too long
        expect(validatePincode('').valid).toBe(false); // Empty
    });
});

describe('validateName', () => {
    it('should validate correct names', () => {
        expect(validateName('John Doe').valid).toBe(true);
        expect(validateName("O'Connor").valid).toBe(true);
        expect(validateName('Anne-Marie').valid).toBe(true);
    });

    it('should reject invalid names', () => {
        expect(validateName('').valid).toBe(false); // Empty
        expect(validateName('J').valid).toBe(false); // Too short
        expect(validateName('John123').valid).toBe(false); // Contains numbers
    });
});

describe('validateEmail', () => {
    it('should validate correct emails', () => {
        expect(validateEmail('test@example.com').valid).toBe(true);
        expect(validateEmail('user.name@domain.co.in').valid).toBe(true);
    });

    it('should reject invalid emails', () => {
        expect(validateEmail('invalid').valid).toBe(false);
        expect(validateEmail('@example.com').valid).toBe(false);
        expect(validateEmail('').valid).toBe(false);
    });
});

describe('validateAddress', () => {
    it('should validate correct addresses', () => {
        expect(validateAddress('123 Main Street, Hyderabad').valid).toBe(true);
        expect(validateAddress('Apt 4B, Building 7, Banjara Hills').valid).toBe(true);
    });

    it('should reject invalid addresses', () => {
        expect(validateAddress('').valid).toBe(false); // Empty
        expect(validateAddress('123').valid).toBe(false); // Too short
    });
});

describe('validateQuantity', () => {
    it('should validate correct quantities', () => {
        expect(validateQuantity(100, 50).valid).toBe(true);
        expect(validateQuantity(50, 50).valid).toBe(true); // At minimum
    });

    it('should reject invalid quantities', () => {
        expect(validateQuantity(40, 50).valid).toBe(false); // Below minimum
        expect(validateQuantity(0, 1).valid).toBe(false);
        expect(validateQuantity('abc', 1).valid).toBe(false); // NaN
    });
});

describe('validatePrice', () => {
    it('should validate correct prices', () => {
        expect(validatePrice(100).valid).toBe(true);
        expect(validatePrice(0).valid).toBe(true); // Zero is valid
        expect(validatePrice(99999).valid).toBe(true);
    });

    it('should reject invalid prices', () => {
        expect(validatePrice(-10).valid).toBe(false); // Negative
        expect(validatePrice(1000000).valid).toBe(false); // Too high
        expect(validatePrice('abc').valid).toBe(false); // NaN
    });
});

describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
        expect(sanitizeInput('<script>alert(1)</script>')).not.toContain('<');
        expect(sanitizeInput('<script>alert(1)</script>')).not.toContain('>');
    });

    it('should remove javascript protocol', () => {
        expect(sanitizeInput('javascript:alert(1)')).not.toContain('javascript:');
    });

    it('should trim whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should limit length', () => {
        const longString = 'a'.repeat(600);
        expect(sanitizeInput(longString).length).toBe(500);
    });

    it('should handle null/undefined', () => {
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
    });
});
