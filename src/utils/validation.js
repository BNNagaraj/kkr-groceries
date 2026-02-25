/**
 * Input Validation Utilities
 * Provides validation functions for forms and user inputs
 */

import { showToast } from './dom.js';

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string|null} error - Error message if invalid
 */

/**
 * Validate phone number (Indian format)
 * @param {string} phone - Phone number to validate
 * @returns {ValidationResult}
 */
export function validatePhone(phone) {
    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^[6-9]\d{9}$/;
    
    if (!cleanPhone) {
        return { valid: false, error: 'Phone number is required' };
    }
    if (!phoneRegex.test(cleanPhone)) {
        return { valid: false, error: 'Please enter a valid 10-digit mobile number' };
    }
    return { valid: true, error: null };
}

/**
 * Validate Indian pincode
 * @param {string} pincode - Pincode to validate
 * @returns {ValidationResult}
 */
export function validatePincode(pincode) {
    const pinRegex = /^\d{6}$/;
    
    if (!pincode) {
        return { valid: false, error: 'Pincode is required' };
    }
    if (!pinRegex.test(pincode)) {
        return { valid: false, error: 'Please enter a valid 6-digit pincode' };
    }
    return { valid: true, error: null };
}

/**
 * Validate name field
 * @param {string} name - Name to validate
 * @param {number} [minLength=2] - Minimum length
 * @param {number} [maxLength=50] - Maximum length
 * @returns {ValidationResult}
 */
export function validateName(name, minLength = 2, maxLength = 50) {
    if (!name || !name.trim()) {
        return { valid: false, error: 'Name is required' };
    }
    if (name.trim().length < minLength) {
        return { valid: false, error: `Name must be at least ${minLength} characters` };
    }
    if (name.trim().length > maxLength) {
        return { valid: false, error: `Name must be less than ${maxLength} characters` };
    }
    // Check for only letters and spaces
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(name.trim())) {
        return { valid: false, error: 'Name can only contain letters, spaces, hyphens and apostrophes' };
    }
    return { valid: true, error: null };
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {ValidationResult}
 */
export function validateEmail(email) {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }
    return { valid: true, error: null };
}

/**
 * Validate address/location
 * @param {string} address - Address to validate
 * @returns {ValidationResult}
 */
export function validateAddress(address) {
    if (!address || !address.trim()) {
        return { valid: false, error: 'Delivery address is required' };
    }
    if (address.trim().length < 10) {
        return { valid: false, error: 'Please enter a complete address (at least 10 characters)' };
    }
    if (address.trim().length > 200) {
        return { valid: false, error: 'Address is too long (max 200 characters)' };
    }
    return { valid: true, error: null };
}

/**
 * Validate quantity is within allowed range
 * @param {number} qty - Quantity to validate
 * @param {number} min - Minimum allowed
 * @param {number} [max=9999] - Maximum allowed
 * @returns {ValidationResult}
 */
export function validateQuantity(qty, min, max = 9999) {
    const numQty = parseInt(qty, 10);
    
    if (isNaN(numQty)) {
        return { valid: false, error: 'Please enter a valid number' };
    }
    if (numQty < min) {
        return { valid: false, error: `Minimum quantity is ${min}` };
    }
    if (numQty > max) {
        return { valid: false, error: `Maximum quantity is ${max}` };
    }
    return { valid: true, error: null };
}

/**
 * Validate price is positive
 * @param {number} price - Price to validate
 * @returns {ValidationResult}
 */
export function validatePrice(price) {
    const numPrice = parseFloat(price);
    
    if (isNaN(numPrice)) {
        return { valid: false, error: 'Please enter a valid price' };
    }
    if (numPrice < 0) {
        return { valid: false, error: 'Price cannot be negative' };
    }
    if (numPrice > 100000) {
        return { valid: false, error: 'Price exceeds maximum allowed' };
    }
    return { valid: true, error: null };
}

/**
 * Validate product data (for admin)
 * @param {Object} product - Product object to validate
 * @returns {ValidationResult}
 */
export function validateProduct(product) {
    if (!product.name || !product.name.trim()) {
        return { valid: false, error: 'Product name is required' };
    }
    if (product.name.trim().length > 100) {
        return { valid: false, error: 'Product name is too long' };
    }
    if (!product.unit || !product.unit.trim()) {
        return { valid: false, error: 'Unit is required (e.g., kg, piece)' };
    }
    
    const moqValid = validateQuantity(product.moq, 1);
    if (!moqValid.valid) return moqValid;
    
    const priceValid = validatePrice(product.price || 0);
    if (!priceValid.valid) return priceValid;
    
    return { valid: true, error: null };
}

/**
 * Validate order data before submission
 * @param {Object} orderData - Order data to validate
 * @returns {ValidationResult}
 */
export function validateOrder(orderData) {
    const nameValid = validateName(orderData.customerName);
    if (!nameValid.valid) return nameValid;
    
    const phoneValid = validatePhone(orderData.phone);
    if (!phoneValid.valid) return phoneValid;
    
    const addressValid = validateAddress(orderData.location);
    if (!addressValid.valid) return addressValid;
    
    if (!orderData.cart || orderData.cart.length === 0) {
        return { valid: false, error: 'Your cart is empty' };
    }
    
    return { valid: true, error: null };
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
    if (!input) return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .substring(0, 500); // Limit length
}

/**
 * Validate and show toast on error
 * @param {ValidationResult} result - Validation result
 * @returns {boolean} - True if valid
 */
export function validateAndNotify(result) {
    if (!result.valid && result.error) {
        showToast(result.error, 'error');
        return false;
    }
    return true;
}
