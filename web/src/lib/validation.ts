export interface ValidationResult {
    valid: boolean;
    error: string | null;
}

export function validatePhone(phone: string): ValidationResult {
    const cleaned = phone.replace(/[\s\-+]/g, "");
    // Strip 91 country code prefix only when number has >10 digits (e.g. 919876543210)
    const digits = cleaned.length > 10 ? cleaned.replace(/^91/, "") : cleaned;

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
