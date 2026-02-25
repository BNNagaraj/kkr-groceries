/**
 * DOM Utility Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { escapeHTML } from '../../utils/dom.js';

describe('escapeHTML', () => {
    it('should escape HTML tags', () => {
        expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
        expect(escapeHTML('<div>content</div>')).toBe('&lt;div&gt;content&lt;/div&gt;');
    });

    it('should escape quotes', () => {
        expect(escapeHTML('"quoted"')).toBe('&quot;quoted&quot;');
        expect(escapeHTML("'single'")).toBe('&#39;single&#39;');
    });

    it('should escape ampersands', () => {
        expect(escapeHTML('A & B')).toBe('A &amp; B');
    });

    it('should handle null/undefined', () => {
        expect(escapeHTML(null)).toBe('');
        expect(escapeHTML(undefined)).toBe('');
    });

    it('should handle numbers', () => {
        expect(escapeHTML(123)).toBe('123');
    });
});
