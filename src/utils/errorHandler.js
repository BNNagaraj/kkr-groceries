/**
 * Global Error Handler Utility
 * Handles unhandled errors and promise rejections
 */

import { showToast } from './dom.js';

/**
 * Initialize global error handlers
 */
export function initErrorHandlers() {
    // Handle synchronous errors
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global Error:', { message, source, lineno, colno, error });
        
        // Only show toast for critical errors, not for all errors
        if (message && !message.includes('Google Maps') && !message.includes('firebase')) {
            // Log to console but don't show generic toast - let specific handlers handle it
            console.warn('Non-critical error:', message);
        }
        
        // Prevent default handling
        return false;
    };

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled Promise Rejection:', event.reason);
        
        // Show toast for API-related errors
        if (event.reason && event.reason.message) {
            const msg = event.reason.message;
            if (msg.includes('network') || msg.includes('fetch') || msg.includes('permission')) {
                showToast('Connection error. Please check your internet.', 'error');
            }
        }
        
        // Prevent default handling
        event.preventDefault();
    });

    // Handle rejected promises that are later caught
    window.addEventListener('rejectionhandled', function(event) {
        console.log('Promise Rejection Handled:', event.reason);
    });
}

/**
 * Wrap async functions with error handling
 * @template T
 * @param {() => Promise<T>} fn - Async function to wrap
 * @param {string} errorMessage - User-friendly error message
 * @returns {Promise<T|null>}
 */
export async function safeAsync(fn, errorMessage = 'Operation failed') {
    try {
        return await fn();
    } catch (error) {
        console.error(errorMessage, error);
        showToast(errorMessage, 'error');
        return null;
    }
}

/**
 * Report error to console and optionally to user
 * @param {Error|string} error - Error object or message
 * @param {string} context - Where the error occurred
 * @param {boolean} [showUser=false] - Whether to show toast to user
 */
export function logError(error, context, showUser = false) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${context}]`, error);
    
    if (showUser) {
        showToast(`${context}: ${errorMsg}`, 'error');
    }
}
