/**
 * Project-wide ambient declarations.
 *
 * Add a property here only if it represents real runtime state that the type
 * system can't otherwise see — typically legacy browser globals or third-party
 * scripts that attach themselves to `window` without shipping types.
 */

declare global {
  interface Window {
    /**
     * Legacy Safari/iOS audio context (pre-Web Audio standardization).
     * Modern browsers expose `AudioContext`; older WebKit-based ones only
     * have the prefixed variant. Falling back to it lets the app produce
     * notification sounds on older Safari.
     */
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};
