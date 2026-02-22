import { state, products } from '../store.js';
import { getSellingPrice } from '../services/apmc.js';

export function handleSearch(v) {
    state.searchTerm = v.toLowerCase().trim();
    renderProducts(state.currentCategory);
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
    let filtered = category === 'all' ? products : products.filter(p => p.category === category);

    if (state.searchTerm) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(state.searchTerm) ||
            p.telugu.includes(state.searchTerm) ||
            p.hindi.toLowerCase().includes(state.searchTerm)
        );
    }

    if (!filtered.length) {
        grid.innerHTML = '<div class="no-results"><div class="nr-icon">\uD83D\uDD0D</div><h3>No vegetables found</h3><p>Try a different search or category</p></div>';
        return;
    }

    filtered.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.id = 'card-' + product.id;

        const ci = state.cart[product.id];
        const qty = ci ? ci.qty : 0;
        const isIn = qty > 0;
        const isValid = qty >= product.moq;

        if (isIn) {
            card.classList.add('selected');
            if (!isValid) card.classList.add('invalid');
        }

        const sp = getSellingPrice(product);
        const apmcP = state.apmcPrices ? state.apmcPrices.find(a => a.commodity === product.name) : null;

        card.innerHTML = `
            <div class="thumb-wrap">
                ${product.hot ? '<span class="hot-badge">\uD83D\uDD25</span>' : ''}${product.fresh ? '<span class="fresh-badge">\u2744\uFE0F</span>' : ''}
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.classList.add('error');this.nextElementSibling.style.display='flex'">
                <span class="img-fallback">${product.name[0]}</span>
                <div class="select-indicator">${isIn ? qty : '\u2714'}</div>
            </div>
            <div class="product-info">
                <div class="product-header">
                    <div class="names">
                        <h3>${product.name}</h3>
                        <div class="regional"><span class="telugu">${product.telugu}</span><span class="hindi">${product.hindi}</span></div>
                        <div class="moq-badge"><span>\u26A0\uFE0F</span><span>Min: ${product.moq} ${product.unit}</span></div>
                    </div>
                    <div class="price-block">
                        <div class="price">\u20B9${sp}${apmcP ? '<span class="apmc-live">APMC+' + state.commissionPercent + '%</span>' : ''}</div>
                        <span class="unit">/${product.unit}</span>
                        <div class="apmc-tag">${apmcP ? 'APMC \u20B9' + apmcP.modalPrice : 'APMC'}</div>
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-add ${isIn ? 'hidden' : ''}" id="btn-add-${product.id}" type="button" data-action="add" data-product-id="${product.id}"><span>Add +</span><span class="moq-hint">Min ${product.moq}</span></button>
                <div class="qty-controls ${isIn ? 'active' : ''} ${!isValid && isIn ? 'error' : ''}" id="qty-controls-${product.id}">
                    <div class="qty-row">
                        <button class="qty-btn" type="button" data-action="decrease" data-product-id="${product.id}" ${qty <= product.moq ? 'disabled' : ''}>\u2212</button>
                        <input type="number" class="qty-input" id="qty-input-${product.id}" value="${isIn ? qty : product.moq}" data-action="set-qty" data-product-id="${product.id}" min="${product.moq}" inputmode="numeric">
                        <button class="qty-btn" type="button" data-action="increase" data-product-id="${product.id}">+</button>
                    </div>
                    ${!isValid && isIn ? `<div class="moq-label"><span>\u26A0\uFE0F</span><span>Min ${product.moq} required</span></div>` : `<span class="unit-label">${product.unit}</span>`}
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
