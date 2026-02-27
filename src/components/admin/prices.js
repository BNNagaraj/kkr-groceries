/**
 * Admin Prices Management Module
 * Handles product pricing, MOQ, and visibility settings
 */

import { db, auth, functions } from '../../services/firebase.js';
import { state, products } from '../../store.js';
import { escapeHTML, showToast } from '../../utils/dom.js';
import { validateProduct } from '../../utils/validation.js';
import { logError } from '../../utils/errorHandler.js';
import { initImageUpload } from './images.js';

// Search/filter state
let productSearchTerm = '';
let productFilterCategory = 'all';

/**
 * Render the prices management tab
 */
export function renderPricesTab() {
    const tab = document.getElementById('adminPricesTab');
    if (!tab) return;

    const filteredProducts = getFilteredProducts();

    let h = `
    <!-- Header Controls -->
    <div class="admin-prices-header">
        <div class="commission-section">
            <label class="commission-label">
                💰 Commission %
                <input type="number" id="globalCommission" value="${state.commissionPercent}" min="0" max="100" step="0.5">
            </label>
            <button class="btn btn-success" onclick="window.saveAdminSettings()">
                ✅ Save Commission
            </button>
            <span class="commission-hint">Applied to APMC base prices</span>
        </div>
        
        <div class="action-buttons">
            <button class="btn btn-warning" onclick="window.adminExportProductsCSV()" title="Export to CSV">
                📄 CSV
            </button>
            <button class="btn btn-success" onclick="window.adminExportProductsExcel()" title="Export to Excel">
                📊 Excel
            </button>
            <button class="btn btn-primary" onclick="window.adminSaveAllProducts()" title="Save all changes">
                💾 Save All
            </button>
            <button class="btn btn-purple" onclick="window.adminUpgradeDefaultImages()" title="Upgrade to high-res images">
                📸 Upgrade Images
            </button>
            <button class="btn btn-orange" onclick="window.refreshAdminClaim()" title="Refresh admin permissions">
                🔑 Refresh Admin
            </button>
        </div>
    </div>

    <!-- Search and Add Product -->
    <div class="admin-prices-toolbar">
        <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="productSearch" placeholder="Search products..." 
                value="${escapeHTML(productSearchTerm)}" 
                oninput="window.handleProductSearch(this.value)">
            ${productSearchTerm ? `<button class="clear-search" onclick="window.handleProductSearch('')">×</button>` : ''}
        </div>
        
        <div class="category-filter">
            <select id="categoryFilter" onchange="window.handleCategoryFilter(this.value)">
                <option value="all" ${productFilterCategory === 'all' ? 'selected' : ''}>All Categories</option>
                <option value="daily" ${productFilterCategory === 'daily' ? 'selected' : ''}>Daily Essentials</option>
                <option value="rotate" ${productFilterCategory === 'rotate' ? 'selected' : ''}>High Rotation</option>
                <option value="regional" ${productFilterCategory === 'regional' ? 'selected' : ''}>Regional Specials</option>
            </select>
        </div>
        
        <div class="add-product-form">
            <input type="text" id="newProductName" placeholder="New product name...">
            <button class="btn btn-primary" onclick="window.adminAddProduct()">
                ➕ Add
            </button>
        </div>
    </div>

    <!-- Results Count -->
    <div class="results-count">
        Showing ${filteredProducts.length} of ${products.length} products
    </div>

    <!-- Base64 Image Warning -->
    ${filteredProducts.some(p => p.image?.startsWith('data:image')) ? `
        <div class="base64-warning">
            <span>⚠️</span>
            <div>
                <strong>Storage Not Configured:</strong> Images are being saved as base64. 
                This increases database size. To fix this, enable Firebase Storage in your project.
                <a href="https://console.firebase.google.com/project/_/storage" target="_blank" style="color: #92400e; text-decoration: underline;">Learn more →</a>
            </div>
        </div>
    ` : ''}

    <!-- Products Table -->
    <div class="products-table-wrapper">
        <table class="admin-products-table">
            <thead>
                <tr>
                    <th class="col-image">Image</th>
                    <th class="col-product">Product</th>
                    <th class="col-apmc">APMC ₹</th>
                    <th class="col-price">Override ₹</th>
                    <th class="col-moq">
                        <label class="moq-header-label" title="Require MOQ for all products">
                            <input type="checkbox" id="selectAllMoq" onchange="window.toggleAllMoq(this.checked)" checked>
                            <span>MOQ Req</span>
                        </label>
                    </th>
                    <th class="col-unit">Unit</th>
                    <th class="col-visible">Visible</th>
                    <th class="col-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filteredProducts.length === 0 ? `
                    <tr>
                        <td colspan="8" class="no-results">
                            <div class="no-results-content">
                                <span class="icon">🔍</span>
                                <p>No products found matching "${escapeHTML(productSearchTerm)}"</p>
                                <button class="btn btn-secondary" onclick="window.clearProductFilters()">Clear Filters</button>
                            </div>
                        </td>
                    </tr>
                ` : filteredProducts.map(p => renderProductRow(p)).join('')}
            </tbody>
        </table>
    </div>

    <!-- Products Cards (Mobile) -->
    <div class="admin-products-cards">
        ${filteredProducts.length === 0 ? `
            <div class="no-results">
                <div class="no-results-content">
                    <span class="icon">🔍</span>
                    <p>No products found matching "${escapeHTML(productSearchTerm)}"</p>
                    <button class="btn btn-secondary" onclick="window.clearProductFilters()">Clear Filters</button>
                </div>
            </div>
        ` : filteredProducts.map(p => renderProductCard(p)).join('')}
    </div>`;

    tab.innerHTML = h;

    // Initialize image uploads for each product
    filteredProducts.forEach(p => {
        initImageUpload(p.id);
    });
}

/**
 * Render a single product row
 * @param {Object} p - Product object
 * @returns {string} HTML string
 */
function renderProductRow(p) {
    const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
    const apmcP = apmc ? apmc.modalPrice : '-';
    const hasImage = p.image && p.image.trim() !== '';
    const isBase64Image = hasImage && p.image.startsWith('data:image');

    return `<tr data-product-id="${p.id}" ${isBase64Image ? 'class="has-base64-image"' : ''}>
        <td class="col-image">
            <div id="img-upload-${p.id}" class="image-upload-container ${hasImage ? 'has-image' : 'no-image'}">
                <img id="img-preview-${p.id}" 
                    src="${escapeHTML(hasImage ? p.image : '')}" 
                    alt="${escapeHTML(p.name)}"
                    style="${hasImage ? '' : 'display:none'}"
                    onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">
                
                <div class="upload-overlay">
                    <button type="button" class="upload-btn" onclick="window.triggerFileInput('${p.id}')" title="Upload new image">
                        📷
                    </button>
                    <input type="file" accept="image/*" hidden>
                </div>
                
                <div class="upload-loading">
                    <span class="spinner"></span>
                </div>
            </div>
            <input type="hidden" id="image-table-${p.id}" value="${escapeHTML(p.image || '')}">
        </td>
        
        <td class="col-product">
            <div class="product-info">
                <strong class="product-name">${escapeHTML(p.name)}</strong>
                ${p.telugu ? `<span class="product-telugu">${escapeHTML(p.telugu)}</span>` : ''}
                <span class="product-category category-${p.category}">${p.category}</span>
            </div>
        </td>
        
        <td class="col-apmc">
            <span class="apmc-price">₹${apmcP}</span>
        </td>
        
        <td class="col-price">
            <input type="number" 
                id="price-table-${p.id}" 
                value="${p.overridePrice || ''}" 
                placeholder="${apmcP}"
                min="0" 
                step="0.01"
                class="price-input">
        </td>
        
        <td class="col-moq">
            <div class="moq-cell">
                <label class="moq-checkbox-label" title="MOQ Required">
                    <input type="checkbox" 
                        id="moq-required-table-${p.id}" 
                        ${p.moqRequired !== false ? 'checked' : ''}
                        onchange="window.toggleProductMoq(${p.id}, this.checked)">
                </label>
                <input type="number" 
                    id="moq-table-${p.id}" 
                    value="${p.moq}" 
                    min="1" 
                    class="moq-input"
                    ${p.moqRequired === false ? 'disabled style="opacity:0.5"' : ''}>
            </div>
        </td>
        
        <td class="col-unit">
            <input type="text" 
                id="unit-table-${p.id}" 
                value="${escapeHTML(p.unit)}" 
                class="unit-input">
        </td>
        
        <td class="col-visible">
            <label class="toggle-switch">
                <input type="checkbox" id="visible-table-${p.id}" ${p.isHidden ? '' : 'checked'}>
                <span class="toggle-slider"></span>
            </label>
        </td>
        
        <td class="col-actions">
            <button class="btn-icon btn-delete" onclick="window.adminDeleteProduct('${p.id}')" title="Delete product">
                🗑️
            </button>
        </td>
    </tr>`;
}

/**
 * Render a single product card for mobile view
 * @param {Object} p - Product object
 * @returns {string} HTML string
 */
function renderProductCard(p) {
    const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
    const apmcP = apmc ? apmc.modalPrice : '-';
    const hasImage = p.image && p.image.trim() !== '';
    const isBase64Image = hasImage && p.image.startsWith('data:image');

    return `<div class="admin-product-card" data-product-id="${p.id}" ${isBase64Image ? 'class="admin-product-card has-base64-image"' : ''}>
        <!-- Card Header: Image and Product Info -->
        <div class="card-header">
            <div class="card-image-section">
                <div id="img-upload-${p.id}" class="image-upload-container ${hasImage ? 'has-image' : 'no-image'}">
                    <img id="img-preview-${p.id}" 
                        src="${escapeHTML(hasImage ? p.image : '')}" 
                        alt="${escapeHTML(p.name)}"
                        style="${hasImage ? '' : 'display:none'}"
                        onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">
                    
                    <div class="upload-overlay">
                        <button type="button" class="upload-btn" onclick="window.triggerFileInput('${p.id}')" title="Upload new image">
                            📷
                        </button>
                        <input type="file" accept="image/*" hidden>
                    </div>
                    
                    <div class="upload-loading">
                        <span class="spinner"></span>
                    </div>
                </div>
                <input type="hidden" id="image-card-${p.id}" value="${escapeHTML(p.image || '')}">
            </div>
            
            <div class="card-product-info">
                <strong class="product-name">${escapeHTML(p.name)}</strong>
                ${p.telugu ? `<span class="product-telugu">${escapeHTML(p.telugu)}</span>` : ''}
                <span class="product-category category-${p.category}">${p.category}</span>
                <span class="apmc-price">APMC: ₹${apmcP}</span>
            </div>
        </div>
        
        <!-- Card Body: Pricing and Settings -->
        <div class="card-body">
            <div class="card-field">
                <label>Override Price (₹)</label>
                <input type="number" 
                    id="price-card-${p.id}" 
                    value="${p.overridePrice || ''}" 
                    placeholder="${apmcP}"
                    min="0" 
                    step="0.01"
                    class="price-input">
            </div>
            
            <div class="card-field-row">
                <div class="card-field moq-field">
                    <label>
                        <input type="checkbox" 
                            id="moq-required-card-${p.id}" 
                            ${p.moqRequired !== false ? 'checked' : ''}
                            onchange="window.toggleProductMoq(${p.id}, this.checked)">
                        MOQ Required
                    </label>
                    <input type="number" 
                        id="moq-card-${p.id}" 
                        value="${p.moq}" 
                        min="1" 
                        class="moq-input"
                        ${p.moqRequired === false ? 'disabled style="opacity:0.5"' : ''}>
                </div>
                
                <div class="card-field">
                    <label>Unit</label>
                    <input type="text" 
                        id="unit-card-${p.id}" 
                        value="${escapeHTML(p.unit)}" 
                        class="unit-input">
                </div>
            </div>
        </div>
        
        <!-- Card Footer: Visibility and Actions -->
        <div class="card-footer">
            <label class="toggle-switch">
                <input type="checkbox" id="visible-table-${p.id}" ${p.isHidden ? '' : 'checked'}>
                <span class="toggle-slider"></span>
                <span class="toggle-label">${p.isHidden ? 'Hidden' : 'Visible'}</span>
            </label>
            
            <button class="btn-icon btn-delete" onclick="window.adminDeleteProduct('${p.id}')" title="Delete product">
                🗑️ Delete
            </button>
        </div>
    </div>`;
}

/**
 * Get filtered products based on search and category
 * @returns {Array} Filtered products
 */
function getFilteredProducts() {
    let filtered = [...products];

    // Category filter
    if (productFilterCategory !== 'all') {
        filtered = filtered.filter(p => p.category === productFilterCategory);
    }

    // Search filter
    if (productSearchTerm) {
        const term = productSearchTerm.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(term) ||
            (p.telugu && p.telugu.includes(term)) ||
            (p.hindi && p.hindi.toLowerCase().includes(term))
        );
    }

    return filtered;
}

/**
 * Handle product search
 * @param {string} value - Search value
 */
export function handleProductSearch(value) {
    productSearchTerm = value.trim();
    renderPricesTab();
}

/**
 * Handle category filter change
 * @param {string} value - Category value
 */
export function handleCategoryFilter(value) {
    productFilterCategory = value;
    renderPricesTab();
}

/**
 * Clear all filters
 */
export function clearProductFilters() {
    productSearchTerm = '';
    productFilterCategory = 'all';
    renderPricesTab();
}

/**
 * Toggle MOQ required for all products
 * @param {boolean} checked - Whether MOQ is required
 */
export function toggleAllMoq(checked) {
    products.forEach(p => {
        p.moqRequired = checked;
    });
    renderPricesTab();
    showToast(checked ? 'MOQ required for all products' : 'MOQ not required for all products', 'info');
}

/**
 * Toggle MOQ required for a single product
 * @param {number} productId - Product ID
 * @param {boolean} checked - Whether MOQ is required
 */
export function toggleProductMoq(productId, checked) {
    const product = products.find(p => p.id === productId);
    if (product) {
        product.moqRequired = checked;
        // Update the MOQ input disabled state for both table and card views
        const moqTableInput = document.getElementById(`moq-table-${productId}`);
        const moqCardInput = document.getElementById(`moq-card-${productId}`);
        
        [moqTableInput, moqCardInput].forEach(moqInput => {
            if (moqInput) {
                moqInput.disabled = !checked;
                moqInput.style.opacity = checked ? '1' : '0.5';
            }
        });
        
        showToast(`${product.name}: MOQ ${checked ? 'required' : 'not required'}`, 'info');
    }
}

/**
 * Export products to CSV
 */
export function adminExportProductsCSV() {
    const filtered = getFilteredProducts();
    let csv = 'Product ID,Name,Telugu,Hindi,Category,APMC Price,Override Price,MOQ,MOQ Required,Unit,Visibility\n';
    
    filtered.forEach(p => {
        const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
        const apmcP = apmc ? apmc.modalPrice : '';
        const vis = p.isHidden ? 'Hidden' : 'Visible';
        const moqReq = p.moqRequired !== false ? 'Yes' : 'No';
        csv += `${p.id},"${p.name}","${p.telugu || ''}","${p.hindi || ''}",${p.category},${apmcP},${p.overridePrice || ''},${p.moq},${moqReq},${p.unit},${vis}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kkr_products_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Export products to Excel
 */
export function adminExportProductsExcel() {
    const filtered = getFilteredProducts();
    let html = '<table border="1"><tr>';
    html += '<th>ID</th><th>Name</th><th>Telugu</th><th>Hindi</th><th>Category</th>';
    html += '<th>APMC Price</th><th>Override Price</th><th>MOQ</th><th>Unit</th><th>Visible</th></tr>';
    
    filtered.forEach(p => {
        const apmc = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === p.name) : null;
        const vis = p.isHidden ? 'No' : 'Yes';
        html += `<tr>
            <td>${p.id}</td>
            <td>${escapeHTML(p.name)}</td>
            <td>${escapeHTML(p.telugu || '')}</td>
            <td>${escapeHTML(p.hindi || '')}</td>
            <td>${p.category}</td>
            <td>${apmc ? apmc.modalPrice : '-'}</td>
            <td>${p.overridePrice || '-'}</td>
            <td>${p.moq}</td>
            <td>${escapeHTML(p.unit)}</td>
            <td>${vis}</td>
        </tr>`;
    });
    
    html += '</table>';
    
    const uri = 'data:application/vnd.ms-excel;base64,' + btoa(unescape(encodeURIComponent(html)));
    const link = document.createElement('a');
    link.href = uri;
    link.download = `kkr_products_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
}

/**
 * Save all products in batch
 */
export async function adminSaveAllProducts() {
    const filtered = getFilteredProducts();
    if (filtered.length === 0) return;

    // Show loading
    const btn = document.querySelector('.btn-primary[onclick*="adminSaveAllProducts"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Saving...';
    }

    try {
        const batch = db.batch();
        let count = 0;
        const errors = [];
        const skipped = [];

        filtered.forEach(p => {
            // Get all form elements (try table view first, then card view)
            const moqEl = document.getElementById(`moq-table-${p.id}`) || document.getElementById(`moq-card-${p.id}`);
            const unitEl = document.getElementById(`unit-table-${p.id}`) || document.getElementById(`unit-card-${p.id}`);
            const visibleEl = document.getElementById(`visible-table-${p.id}`) || document.getElementById(`visible-card-${p.id}`);
            const imageEl = document.getElementById(`image-table-${p.id}`) || document.getElementById(`image-card-${p.id}`);
            const moqRequiredEl = document.getElementById(`moq-required-table-${p.id}`) || document.getElementById(`moq-required-card-${p.id}`);
            
            // Get price from either table or card view
            const priceEl = document.getElementById(`price-table-${p.id}`) || document.getElementById(`price-card-${p.id}`);

            // Debug logging
            console.log(`Processing ${p.name} (ID: ${p.id}):`, {
                moqEl: moqEl?.value,
                priceEl: priceEl?.value,
                unitEl: unitEl?.value,
                moqRequiredEl: moqRequiredEl?.checked
            });

            // Check if required elements exist
            if (!moqEl) {
                skipped.push(`${p.name}: MOQ element not found`);
                return;
            }
            if (!priceEl) {
                skipped.push(`${p.name}: Price element not found`);
                return;
            }

            const moq = parseInt(moqEl.value, 10);
            const priceValue = priceEl.value.trim();
            const overridePrice = priceValue ? parseFloat(priceValue) : 0;
            const unit = unitEl?.value?.trim() || p.unit;
            const isHidden = visibleEl ? !visibleEl.checked : p.isHidden;
            const image = imageEl?.value || p.image;
            const moqRequired = moqRequiredEl ? moqRequiredEl.checked : true;

            // Validate
            if (!unit) {
                errors.push(`${p.name}: Unit is required`);
                return;
            }
            if (isNaN(moq) || moq < 1) {
                errors.push(`${p.name}: MOQ must be at least 1`);
                return;
            }

            console.log(`Saving ${p.name}: overridePrice=${overridePrice}, moq=${moq}, unit=${unit}`);

            const docRef = db.collection('products').doc(p.id.toString());
            batch.update(docRef, { 
                moq, 
                moqRequired,
                overridePrice: overridePrice > 0 ? overridePrice : 0, 
                unit, 
                isHidden, 
                image,
                updatedAt: new Date().toISOString()
            });
            
            // Update local state
            p.moq = moq;
            p.moqRequired = moqRequired;
            p.overridePrice = overridePrice > 0 ? overridePrice : 0;
            p.unit = unit;
            p.isHidden = isHidden;
            p.image = image;
            
            count++;
        });

        if (skipped.length > 0) {
            console.warn('Skipped products:', skipped);
        }

        if (errors.length > 0) {
            console.error('Validation errors:', errors);
            if (typeof window.showToast === 'function') {
                window.showToast(`Validation errors: ${errors.join(', ')}`, 'error');
            }
            return;
        }

        if (count > 0) {
            await batch.commit();
            console.log(`Successfully saved ${count} products`);
            
            // Re-render to show updated values
            renderPricesTab();
            
            if (typeof window.showToast === 'function') {
                window.showToast(`Successfully saved ${count} products!`, 'success');
            }
        } else {
            console.warn('No products to save');
            if (typeof window.showToast === 'function') {
                window.showToast('No products were saved. Please check console for details.', 'warning');
            }
        }
    } catch (e) {
        logError(e, 'adminSaveAllProducts', true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💾 Save All';
        }
    }
}

/**
 * Delete a product
 * @param {string|number} id - Product ID
 */
export async function adminDeleteProduct(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;

    if (!confirm(`Are you sure you want to delete "${product.name}"? This cannot be undone.`)) {
        return;
    }

    try {
        await db.collection('products').doc(id.toString()).delete();
        
        const idx = products.findIndex(p => String(p.id) === String(id));
        if (idx > -1) {
            products.splice(idx, 1);
        }
        
        renderPricesTab();
        if (typeof window.showToast === 'function') {
            window.showToast(`"${product.name}" deleted successfully`, 'success');
        }
    } catch (e) {
        logError(e, 'adminDeleteProduct', true);
    }
}

/**
 * Add a new product
 */
export async function adminAddProduct() {
    const inputEl = document.getElementById('newProductName');
    const name = inputEl?.value?.trim();

    if (!name) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please enter a product name', 'error');
        }
        inputEl?.focus();
        return;
    }

    if (name.length < 2) {
        if (typeof window.showToast === 'function') {
            window.showToast('Product name must be at least 2 characters', 'error');
        }
        return;
    }

    // Check for duplicates
    if (products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        if (typeof window.showToast === 'function') {
            window.showToast('A product with this name already exists', 'error');
        }
        return;
    }

    const validNumericIds = products.map(p => Number(p.id)).filter(n => !isNaN(n));
    const maxId = validNumericIds.length > 0 ? Math.max(...validNumericIds) : 0;
    const newId = (maxId + 1).toString();

    const newProduct = {
        id: parseInt(newId),
        name,
        telugu: '',
        hindi: '',
        price: 0,
        unit: 'kg',
        moq: 1,
        category: 'daily',
        image: '',
        isHidden: false
    };

    try {
        await db.collection('products').doc(newId).set(newProduct);
        products.push(newProduct);
        
        inputEl.value = '';
        renderPricesTab();
        
        if (typeof window.showToast === 'function') {
            window.showToast(`"${name}" added successfully!`, 'success');
        }
    } catch (e) {
        logError(e, 'adminAddProduct', true);
    }
}

/**
 * Product images - Use Firebase Storage URLs after uploading
 */
const RELIABLE_IMAGES = {
    // Add your Firebase Storage URLs here after uploading images
    // Example: 'Tomato': 'https://firebasestorage.googleapis.com/v0/b/your-bucket.appspot.com/o/products%2Ftomato.jpg?alt=media'
};

const DEFAULT_PLACEHOLDER = '/images/default-product.svg'; // Local placeholder or null

/**
 * Check if an image URL is broken (known problematic URLs)
 */
function isBrokenImage(imageUrl) {
    if (!imageUrl) return true;
    
    // Known broken patterns
    const brokenPatterns = [
        'photo-1604568102377-f273edcfebbc',
        'photo-1596639556108-7a544df8bb3f',
        'Green_chilli_closeup.jpg',
        'Okra_%28Abelmoschus_esculentus%29_%283%29',
        'Vegetable-Ede-carrot.jpg',
        'Spinach_leaves.jpg/220px',
        'Bottle_gourd.jpg/220px'
    ];
    
    return brokenPatterns.some(pattern => imageUrl.includes(pattern));
}

/**
 * Upgrade default product images - fixes broken images and updates to reliable URLs
 */
export async function adminUpgradeDefaultImages() {
    // Find products with broken or missing images
    const productsToUpdate = products.filter(p => {
        const needsUpdate = !p.image || 
                           p.image.trim() === '' || 
                           isBrokenImage(p.image) ||
                           false; // Manual upload only - no auto image updates
        return needsUpdate && RELIABLE_IMAGES[p.name];
    });
    
    if (productsToUpdate.length === 0) {
        if (typeof window.showToast === 'function') {
            window.showToast('No products need image upgrades', 'info');
        }
        return;
    }

    if (!confirm(`Fix images for ${productsToUpdate.length} products?\n\nPlease upload images manually to Firebase Storage first.`)) return;

    try {
        const batch = db.batch();
        let updateCount = 0;
        
        productsToUpdate.forEach(p => {
            const newImage = RELIABLE_IMAGES[p.name] || DEFAULT_PLACEHOLDER;
            const docRef = db.collection('products').doc(p.id.toString());
            batch.update(docRef, { image: newImage });
            p.image = newImage;
            updateCount++;
        });

        await batch.commit();
        renderPricesTab();
        
        if (typeof window.showToast === 'function') {
            window.showToast(`Fixed ${updateCount} product images!`, 'success');
        }
    } catch (e) {
        logError(e, 'adminUpgradeDefaultImages', true);
    }
}

/**
 * Refresh admin claim for current user
 */
export async function refreshAdminClaim() {
    try {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please sign in first', 'error');
            return;
        }
        
        showToast('Refreshing admin status...', 'info');
        
        // Call the cloud function to set admin claim
        const setAdminClaim = functions.httpsCallable('setAdminClaim');
        const result = await setAdminClaim({ 
            email: user.email, 
            admin: true 
        });
        
        console.log('Admin claim result:', result.data);
        
        // Force token refresh
        await user.getIdToken(true);
        
        showToast('✅ Admin status refreshed! Please reload the page.', 'success');
        
        // Reload after 2 seconds
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (e) {
        console.error('Error refreshing admin claim:', e);
        showToast(`Failed: ${e.message}`, 'error');
    }
}

// Expose functions to window
if (typeof window !== 'undefined') {
    window.handleProductSearch = handleProductSearch;
    window.handleCategoryFilter = handleCategoryFilter;
    window.clearProductFilters = clearProductFilters;
    window.toggleAllMoq = toggleAllMoq;
    window.toggleProductMoq = toggleProductMoq;
    window.refreshAdminClaim = refreshAdminClaim;
}
