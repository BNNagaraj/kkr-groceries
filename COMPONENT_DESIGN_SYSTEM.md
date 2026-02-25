# KKR Groceries - Component Design System

## Design Principles

1. **Mobile-First**: All components designed for touch, minimum 44px touch targets
2. **Accessibility**: WCAG 2.1 AA compliant, keyboard navigable
3. **Performance**: Minimal DOM updates, CSS transitions over JS animations
4. **Consistency**: Reusable patterns, consistent spacing and colors

---

## Color Palette

```css
:root {
    /* Primary Brand Colors */
    --primary: #059669;          /* Emerald 600 */
    --primary-dark: #047857;     /* Emerald 700 */
    --primary-light: #10b981;    /* Emerald 500 */
    
    /* Accent Colors */
    --gold: #f59e0b;             /* Amber 500 - Hot badge */
    --ice: #0ea5e9;              /* Sky 500 - Fresh badge */
    --danger: #dc2626;           /* Red 600 - Errors, MOQ alerts */
    --warning: #f59e0b;          /* Amber 500 - Warnings */
    
    /* Neutral Colors */
    --text: #1f2937;             /* Gray 800 */
    --text-muted: #4b5563;       /* Gray 600 */
    --text-light: #9ca3af;       /* Gray 400 */
    --border-color: #e5e7eb;     /* Gray 200 */
    --bg: #f9fafb;               /* Gray 50 */
    --bg-white: #ffffff;
    
    /* Status Colors */
    --success-bg: #d1fae5;
    --success-text: #065f46;
    --warning-bg: #fef3c7;
    --warning-text: #92400e;
    --error-bg: #fee2e2;
    --error-text: #991b1b;
    --info-bg: #dbeafe;
    --info-text: #1e40af;
}
```

---

## Typography

```css
:root {
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-telugu: 'Noto Sans Telugu', sans-serif;
    
    /* Font Sizes */
    --text-xs: 0.75rem;    /* 12px */
    --text-sm: 0.875rem;   /* 14px */
    --text-base: 1rem;     /* 16px */
    --text-lg: 1.125rem;   /* 18px */
    --text-xl: 1.25rem;    /* 20px */
    --text-2xl: 1.5rem;    /* 24px */
    --text-3xl: 1.875rem;  /* 30px */
    
    /* Font Weights */
    --font-normal: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;
    
    /* Line Heights */
    --leading-tight: 1.25;
    --leading-normal: 1.5;
    --leading-relaxed: 1.625;
}
```

### Usage Patterns

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page Title | 1.5rem | 700 | 1.25 |
| Card Title | 1rem | 600 | 1.25 |
| Body Text | 0.875rem | 400 | 1.5 |
| Caption | 0.75rem | 400 | 1.5 |
| Price | 1.125rem | 700 | 1 |
| Button | 0.875rem | 600 | 1 |

---

## Spacing System

```css
:root {
    --space-1: 0.25rem;   /* 4px */
    --space-2: 0.5rem;    /* 8px */
    --space-3: 0.75rem;   /* 12px */
    --space-4: 1rem;      /* 16px */
    --space-5: 1.25rem;   /* 20px */
    --space-6: 1.5rem;    /* 24px */
    --space-8: 2rem;      /* 32px */
    --space-10: 2.5rem;   /* 40px */
    --space-12: 3rem;     /* 48px */
}
```

### Component Spacing Patterns

| Component | Padding | Gap |
|-----------|---------|-----|
| Button | 0.625rem 1.25rem | - |
| Card | 1rem | 0.75rem |
| Input | 0.75rem 1rem | - |
| Modal Content | 1.5rem | 1rem |
| List Item | 0.75rem 1rem | 0.5rem |

---

## Border Radius System

```css
:root {
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-full: 9999px;
}
```

### Usage Patterns

| Component | Radius |
|-----------|--------|
| Buttons | 8px (pill: 9999px) |
| Cards | 12px |
| Inputs | 8px |
| Modals | 16px |
| Badges | 9999px |
| Avatars | 9999px |
| Tables | 12px |

---

## Shadows

```css
:root {
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    --shadow-focus: 0 0 0 3px rgba(5, 150, 105, 0.2);
}
```

---

## Component Library

### 1. Buttons

```css
/* Base Button */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
}

/* Variants */
.btn-primary {
    background: var(--primary);
    color: white;
}
.btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
}
.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary {
    background: white;
    color: var(--text);
    border: 1px solid var(--border-color);
}
.btn-secondary:hover:not(:disabled) {
    background: var(--bg);
    border-color: var(--text-light);
}

.btn-danger {
    background: var(--danger);
    color: white;
}

.btn-ghost {
    background: transparent;
    color: var(--primary);
}
.btn-ghost:hover {
    background: rgba(5, 150, 105, 0.1);
}

/* Sizes */
.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
}
.btn-lg {
    padding: 0.875rem 1.75rem;
    font-size: 1rem;
}

/* Icon-only */
.btn-icon {
    padding: 0.625rem;
    aspect-ratio: 1;
}
```

### 2. Cards

```css
.card {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: box-shadow 0.2s ease;
}

.card:hover {
    box-shadow: var(--shadow-md);
}

.card-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
}

.card-body {
    padding: 1.25rem;
}

.card-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg);
}
```

### 3. Forms

```css
.form-group {
    margin-bottom: 1rem;
}

.form-label {
    display: block;
    margin-bottom: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
}

.form-input,
.form-select,
.form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    line-height: 1.5;
    color: var(--text);
    background: white;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    transition: border-color 0.2s, box-shadow 0.2s;
    min-height: 44px;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: var(--shadow-focus);
}

.form-input::placeholder {
    color: var(--text-light);
}

.form-input:disabled,
.form-select:disabled {
    background: var(--bg);
    cursor: not-allowed;
}

/* Input with icon */
.form-input-wrapper {
    position: relative;
}

.form-input-wrapper .icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-light);
}

.form-input-wrapper .form-input {
    padding-left: 2.5rem;
}

/* Error state */
.form-input.error {
    border-color: var(--danger);
}

.form-error {
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--danger);
}
```

### 4. Badges

```css
.badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: var(--radius-full);
    white-space: nowrap;
}

.badge-primary {
    background: var(--primary);
    color: white;
}

.badge-success {
    background: var(--success-bg);
    color: var(--success-text);
}

.badge-warning {
    background: var(--warning-bg);
    color: var(--warning-text);
}

.badge-danger {
    background: var(--error-bg);
    color: var(--error-text);
}

.badge-ghost {
    background: transparent;
    border: 1px solid currentColor;
}
```

### 5. Modals

```css
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: var(--z-modal);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
}

.modal-overlay.active {
    opacity: 1;
    visibility: visible;
}

.modal {
    background: white;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    max-height: calc(100vh - 2rem);
    display: flex;
    flex-direction: column;
    transform: scale(0.95) translateY(10px);
    transition: transform 0.3s ease;
}

.modal-overlay.active .modal {
    transform: scale(1) translateY(0);
}

.modal-header {
    padding: 1.25rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-title {
    font-size: 1.125rem;
    font-weight: 600;
}

.modal-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--bg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.modal-close:hover {
    background: var(--border-color);
}

.modal-body {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

/* Modal sizes */
.modal-sm { max-width: 360px; }
.modal-lg { max-width: 700px; }
.modal-xl { max-width: 900px; }
.modal-fullscreen {
    max-width: 100%;
    max-height: 100%;
    border-radius: 0;
}

/* Mobile full screen */
@media (max-width: 640px) {
    .modal-overlay {
        padding: 0;
        align-items: flex-end;
    }
    
    .modal {
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        max-height: 90vh;
    }
    
    .modal-sheet {
        min-height: 50vh;
    }
}
```

### 6. Tables

```css
.table-container {
    overflow-x: auto;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
}

.table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}

.table th,
.table td {
    padding: 0.875rem 1rem;
    text-align: left;
}

.table th {
    background: var(--bg);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
}

.table tbody tr {
    border-top: 1px solid var(--border-color);
}

.table tbody tr:hover {
    background: var(--bg);
}

/* Striped rows */
.table-striped tbody tr:nth-child(even) {
    background: var(--bg);
}

/* Compact */
.table-compact th,
.table-compact td {
    padding: 0.5rem 0.75rem;
}
```

### 7. Toasts

```css
.toast-container {
    position: fixed;
    bottom: calc(20px + var(--safe-area-bottom));
    right: 20px;
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 400px;
}

@media (max-width: 640px) {
    .toast-container {
        left: 1rem;
        right: 1rem;
        max-width: none;
    }
}

.toast {
    padding: 1rem 1.25rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    animation: slideInRight 0.3s ease;
}

.toast.success {
    background: var(--success-bg);
    color: var(--success-text);
}

.toast.error {
    background: var(--error-bg);
    color: var(--error-text);
}

.toast.warning {
    background: var(--warning-bg);
    color: var(--warning-text);
}

.toast.info {
    background: var(--info-bg);
    color: var(--info-text);
}

.toast-exit {
    animation: slideOutRight 0.3s ease forwards;
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideOutRight {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}
```

### 8. Skeleton Loaders

```css
.skeleton {
    background: linear-gradient(
        90deg,
        #f0f0f0 25%,
        #e8e8e8 50%,
        #f0f0f0 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-md);
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

.skeleton-circle {
    border-radius: 50%;
}

.skeleton-text {
    height: 1em;
    margin-bottom: 0.5em;
}

.skeleton-text:last-child {
    width: 80%;
}
```

---

## Z-Index Scale

```css
:root {
    --z-dropdown: 100;
    --z-sticky: 200;
    --z-header: 300;
    --z-drawer: 400;
    --z-modal: 500;
    --z-popover: 600;
    --z-toast: 700;
    --z-tooltip: 800;
}
```

---

## Responsive Breakpoints

```css
/* Mobile First Approach */

/* Small (phones) */
@media (min-width: 640px) { }

/* Medium (tablets) */
@media (min-width: 768px) { }

/* Large (desktops) */
@media (min-width: 1024px) { }

/* Extra Large */
@media (min-width: 1280px) { }
```

---

## Animation Tokens

```css
:root {
    --transition-fast: 150ms ease;
    --transition-base: 200ms ease;
    --transition-slow: 300ms ease;
    
    --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-out: cubic-bezier(0, 0, 0.2, 1);
    --ease-in: cubic-bezier(0.4, 0, 1, 1);
    --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

---

## Accessibility Guidelines

### Focus States
```css
*:focus-visible {
    outline: 3px solid var(--primary);
    outline-offset: 2px;
}

/* Skip link */
.skip-link {
    position: absolute;
    top: -100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.5rem;
    background: var(--primary);
    color: white;
    z-index: 9999;
    border-radius: 0 0 8px 8px;
}

.skip-link:focus {
    top: 0;
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

*Design System Version: 1.0*
*Last Updated: 2026-01-24*
