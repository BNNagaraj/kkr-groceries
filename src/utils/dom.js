// Utility for sanitizing output to prevent XSS
export function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Toast notification queue system
const toastQueue = [];
let isShowingToast = false;
const TOAST_DURATION = 3000;

/**
 * Creates a toast DOM element with the specified message and type
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (info, success, error, warning)
 * @returns {HTMLElement} The created toast element
 */
function createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add entry animation class
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    return toast;
}

/**
 * Removes a toast element with animation
 * @param {HTMLElement} toastElement - The toast element to remove
 */
function removeToast(toastElement) {
    if (!toastElement || !toastElement.parentNode) return;
    
    // Add exit animation
    toastElement.style.opacity = '0';
    toastElement.style.transform = 'translateY(-20px)';
    
    // Remove after animation completes
    setTimeout(() => {
        if (toastElement.parentNode) {
            toastElement.remove();
        }
        
        // Process next toast in queue
        isShowingToast = false;
        processToastQueue();
    }, 300);
}

/**
 * Processes the next toast in the queue
 */
function processToastQueue() {
    if (isShowingToast || toastQueue.length === 0) {
        return;
    }
    
    isShowingToast = true;
    
    const { message, type } = toastQueue.shift();
    const container = document.getElementById('toastContainer');
    
    if (!container) {
        isShowingToast = false;
        return;
    }
    
    // Create and append toast element
    const toast = createToastElement(message, type);
    container.appendChild(toast);
    
    // Trigger entry animation (next frame)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
    });
    
    // Set up removal after duration
    setTimeout(() => {
        removeToast(toast);
    }, TOAST_DURATION);
}

/**
 * Shows a toast notification using the queue system
 * @param {string} msg - The message to display
 * @param {string} type - The type of toast (info, success, error, warning)
 */
export function showToast(msg, type = 'info') {
    // Add to queue
    toastQueue.push({ message: msg, type: type });
    
    // Start processing if not already showing
    processToastQueue();
}
