import { state, products } from '../store.js';
import { getSellingPrice } from '../services/apmc.js';

// Sort options
export const SORT_OPTIONS = {
    popular: { label: 'Popular', fn: (a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) },
    'price-low': { label: 'Price: Low to High', fn: (a, b) => getSellingPrice(a) - getSellingPrice(b) },
    'price-high': { label: 'Price: High to Low', fn: (a, b) => getSellingPrice(b) - getSellingPrice(a) },
    name: { label: 'A-Z Name', fn: (a, b) => a.name.localeCompare(b.name) }
};

let currentSort = 'popular';

export function setSort(sortBy) {
    if (!SORT_OPTIONS[sortBy]) return;
    currentSort = sortBy;
    
    // Update UI
    document.querySelectorAll('.sort-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sort === sortBy);
    });
    
    const select = document.getElementById('sortSelect');
    if (select) select.value = sortBy;
    
    renderProducts(state.currentCategory);
}

export function getCurrentSort() {
    return currentSort;
}

export function handleSearch(v) {
    state.searchTerm = v.toLowerCase().trim();
    renderProducts(state.currentCategory);
}

// Skeleton loader for products
// Image Zoom Modal
export function openImageZoom(imageUrl, productName) {
    // Remove existing modal if any
    const existing = document.getElementById('imageZoomModal');
    if (existing) existing.remove();
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'imageZoomModal';
    modal.className = 'image-zoom-modal';
    modal.innerHTML = `<img src="${imageUrl}" alt="${productName}" onclick="event.stopPropagation()">`;
    modal.onclick = () => closeImageZoom();
    
    document.body.appendChild(modal);
    
    // Trigger animation
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
    
    // Close on escape key
    document.addEventListener('keydown', handleZoomKeydown);
}

export function closeImageZoom() {
    const modal = document.getElementById('imageZoomModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
    document.removeEventListener('keydown', handleZoomKeydown);
}

function handleZoomKeydown(e) {
    if (e.key === 'Escape') closeImageZoom();
}

export function renderSkeletonCards(count = 6) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = Array(count).fill(0).map((_, i) => `
        <div class="product-card skeleton" style="animation-delay: ${i * 0.1}s">
            <div class="thumb-wrap">
                <div class="skeleton-image"></div>
            </div>
            <div class="product-info">
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
                <div class="skeleton-badge"></div>
            </div>
            <div class="card-actions">
                <div class="skeleton-button"></div>
            </div>
        </div>
    `).join('');
}

export function filterCategory(c) {
    state.currentCategory = c || 'all';
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.category === state.currentCategory)
    });
    renderProducts(state.currentCategory);
}

export function renderProducts(category) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    let visibleProducts = products.filter(p => !p.isHidden);
    let filtered = category === 'all' ? visibleProducts : visibleProducts.filter(p => p.category === category);

    if (state.searchTerm) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(state.searchTerm) ||
            p.telugu.includes(state.searchTerm) ||
            p.hindi.toLowerCase().includes(state.searchTerm)
        );
    }
    
    // Apply sorting
    if (SORT_OPTIONS[currentSort]) {
        filtered.sort(SORT_OPTIONS[currentSort].fn);
    }

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">\ud83d\udd0d</div>
                <h3>No products found</h3>
                <p>Try adjusting your search or browse all categories</p>
                <button class="btn-clear-search" onclick="handleSearch(''); filterCategory('all');">
                    Clear Filters
                </button>
            </div>
        `;
        return;
    }
    
    // Update results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    }

    filtered.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.id = 'card-' + product.id;

        const ci = state.cart[product.id];
        const qty = ci ? ci.qty : 0;
        const isIn = qty > 0;
        const moqRequired = product.moqRequired !== false; // Default to true if not set
        const isValid = moqRequired ? qty >= product.moq : qty > 0;
        
        const stockStatus = product.stockStatus || (product.stock === 0 ? 'out-of-stock' : product.stock && product.stock < 10 ? 'low-stock' : 'in-stock');
        const isOutOfStock = stockStatus === 'out-of-stock';

        if (isIn) {
            card.classList.add('selected');
            if (!isValid) card.classList.add('invalid');
        }
        
        if (isOutOfStock) {
            card.classList.add('out-of-stock');
        }
        
        // MOQ badge HTML - show different message when MOQ not required
        const moqBadgeHtml = moqRequired 
            ? `<div class="moq-badge"><span>\u26a0\ufe0f</span><span>Min: ${product.moq} ${product.unit}</span></div>`
            : `<div class="moq-badge no-moq"><span>\u2705</span><span>No MOQ required</span></div>`;

        const sp = getSellingPrice(product);
        const apmcP = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === product.name) : null;

        const hasImg = product.image && product.image.trim() !== '';
        // Use a data-src pattern to handle broken images gracefully
        const imgHtml = hasImg
            ? `<img src="${product.image}" alt="${product.name}" loading="lazy" 
                onclick="window.openImageZoom('${product.image}', '${product.name}')" 
                style="cursor:zoom-in" 
                onerror="this.style.display='none'; this.parentElement.querySelector('.img-fallback').style.display='flex';">
               <span class="img-fallback" style="display:none">${product.name[0]}</span>`
            : `<span class="img-fallback" style="display:flex">${product.name[0]}</span>`;
        
        // Stock status badge
        const stockBadgeHtml = {
            'out-of-stock': '<span class="stock-badge out-of-stock">Out of Stock</span>',
            'low-stock': '<span class="stock-badge low-stock">Low Stock</span>',
            'in-stock': ''
        }[stockStatus] || '';

        card.innerHTML = `
            <div class="thumb-wrap">
                ${product.hot ? '<span class="hot-badge">\uD83D\uDD25</span>' : ''}${product.fresh ? '<span class="fresh-badge">\u2744\uFE0F</span>' : ''}
                ${stockBadgeHtml}
                ${imgHtml}
                <div class="select-indicator">${isIn ? qty : '\u2714'}</div>
            </div>
            <div class="product-info">
                <div class="product-header">
                    <div class="names">
                        <h3>${product.name}</h3>
                        <div class="regional"><span class="telugu">${product.telugu}</span><span class="hindi">${product.hindi}</span></div>
                        ${moqBadgeHtml}
                    </div>
                    <div class="price-block">
                        <div class="price">\u20B9${sp}</div>
                        <span class="unit">/${product.unit}</span>
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-add ${isIn ? 'hidden' : ''}" id="btn-add-${product.id}" type="button" data-action="add" data-product-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>
                    <span>${isOutOfStock ? 'Out of Stock' : 'Add +'}</span>
                    ${!isOutOfStock ? (moqRequired ? `<span class="moq-hint">Min ${product.moq}</span>` : `<span class="moq-hint no-moq">Any qty</span>`) : ''}
                </button>
                <div class="qty-controls ${isIn ? 'active' : ''} ${!isValid && isIn ? 'error' : ''}" id="qty-controls-${product.id}">
                    <div class="qty-row">
                        <button class="qty-btn" type="button" data-action="decrease" data-product-id="${product.id}" ${qty <= (moqRequired ? product.moq : 1) ? 'disabled' : ''}>\u2212</button>
                        <input type="number" class="qty-input" id="qty-input-${product.id}" value="${isIn ? qty : (moqRequired ? product.moq : 1)}" data-action="set-qty" data-product-id="${product.id}" min="${moqRequired ? product.moq : 1}" inputmode="numeric">
                        <button class="qty-btn" type="button" data-action="increase" data-product-id="${product.id}">+</button>
                    </div>
                    ${!isValid && isIn ? (moqRequired ? `<div class="moq-label"><span>\u26a0\ufe0f</span><span>Min ${product.moq} required</span></div>` : `<div class="moq-label"><span>\u26a0\ufe0f</span><span>Minimum 1 required</span></div>`) : `<span class="unit-label">${product.unit}</span>`}
                    <button class="remove-btn" type="button" data-action="remove" data-product-id="${product.id}">Remove</button>
                </div>
            </div>`;

        grid.appendChild(card);
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.3s ease';
        requestAnimationFrame(() => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 50);
        });
    });
}

// Partial DOM update to prevent flash on quantity change
export function updateProductUI(productId) {
    const card = document.getElementById('card-' + productId);
    if (!card) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const ci = state.cart[productId];
    const qty = ci ? ci.qty : 0;
    const isIn = qty > 0;
    const moqRequired = product.moqRequired !== false;
    const isValid = moqRequired ? qty >= product.moq : qty > 0;

    if (isIn) {
        card.classList.add('selected');
        if (!isValid) card.classList.add('invalid');
        else card.classList.remove('invalid');
    } else {
        card.classList.remove('selected', 'invalid');
    }

    const selInd = card.querySelector('.select-indicator');
    if (selInd) selInd.textContent = isIn ? qty : '\u2714';

    const btnAdd = card.querySelector('.btn-add');
    if (btnAdd) {
        if (isIn) btnAdd.classList.add('hidden');
        else btnAdd.classList.remove('hidden');
    }

    const qtyControls = card.querySelector('.qty-controls');
    if (qtyControls) {
        if (isIn) qtyControls.classList.add('active');
        else qtyControls.classList.remove('active');

        if (!isValid && isIn) qtyControls.classList.add('error');
        else qtyControls.classList.remove('error');

        let moqLabel = qtyControls.querySelector('.moq-label');
        let unitLabel = qtyControls.querySelector('.unit-label');

        if (!isValid && isIn) {
            if (!moqLabel && unitLabel) {
                const msg = moqRequired ? `Min ${product.moq} required` : 'Minimum 1 required';
                unitLabel.outerHTML = `<div class="moq-label"><span>\u26a0\ufe0f</span><span>${msg}</span></div>`;
            }
        } else {
            if (moqLabel) {
                moqLabel.outerHTML = `<span class="unit-label">${product.unit}</span>`;
            }
        }
    }

    const qtyInput = card.querySelector('.qty-input');
    if (qtyInput) {
        qtyInput.value = isIn ? qty : (moqRequired ? product.moq : 1);
        qtyInput.min = moqRequired ? product.moq : 1;
    }

    const decreaseBtn = card.querySelector('[data-action="decrease"]');
    if (decreaseBtn) {
        decreaseBtn.disabled = qty <= (moqRequired ? product.moq : 1);
    }
}

