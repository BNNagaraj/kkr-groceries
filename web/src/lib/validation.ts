export interface ValidationResult {
    valid: boolean;
    error: string | null;
}

/**
 * Normalize any Indian phone input to a bare 10-digit number.
 * Strips +91, 91, 0 prefixes and non-digit characters.
 * Examples:
 *   "+919876543210" → "9876543210"
 *   "919876543210"  → "9876543210"
 *   "09876543210"   → "9876543210"
 *   "9188441334"    → "9188441334"  (10-digit number starting with 91 — kept as-is)
 */
export function normalizeIndianPhone(raw: string): string {
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    // Strip leading country code only when number has >10 digits
    if (digits.length > 10 && digits.startsWith("91")) {
        digits = digits.slice(2);
    } else if (digits.length > 10 && digits.startsWith("0")) {
        digits = digits.slice(1);
    }
    return digits.slice(0, 10);
}

export function validatePhone(phone: string): ValidationResult {
    const digits = normalizeIndianPhone(phone);

    if (!digits) {
        return { valid: false, error: "Phone number is required" };
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
        return { valid: false, error: "Enter a valid 10-digit mobile number" };
    }
    return { valid: true, error: null };
}

export function validateName(name: string, minLength = 2, maxLength = 50): ValidationResult {
    if (!name || !name.trim()) {
        return { valid: false, error: "Name is required" };
    }
    if (name.trim().length < minLength) {
        return { valid: false, error: `Name must be at least ${minLength} characters` };
    }
    if (name.trim().length > maxLength) {
        return { valid: false, error: `Name must be less than ${maxLength} characters` };
    }
    return { valid: true, error: null };
}

export function validatePincode(pincode: string): ValidationResult {
    if (!pincode) {
        return { valid: false, error: "Pincode is required" };
    }
    if (!/^\d{6}$/.test(pincode)) {
        return { valid: false, error: "Enter a valid 6-digit pincode" };
    }
    return { valid: true, error: null };
}

export function validateAddress(address: string): ValidationResult {
    if (!address || !address.trim()) {
        return { valid: false, error: "Delivery address is required" };
    }
    if (address.trim().length < 10) {
        return { valid: false, error: "Please enter a complete address (at least 10 characters)" };
    }
    if (address.trim().length > 200) {
        return { valid: false, error: "Address is too long (max 200 characters)" };
    }
    return { valid: true, error: null };
}

export function sanitizeInput(input: string): string {
    if (!input) return "";
    return input
        .trim()
        .replace(/[<>]/g, "")
        .replace(/javascript:/gi, "")
        .substring(0, 500);
}
