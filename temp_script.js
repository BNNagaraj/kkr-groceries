
        // ===== FIREBASE CONFIG =====
        const firebaseConfig = {
            apiKey: "AIzaSyCHO2m3Cs9ESdKl-3dzqzPrT_eup-SX2OE",
            authDomain: "kkr-groceries-02.firebaseapp.com",
            projectId: "kkr-groceries-02",
            storageBucket: "kkr-groceries-02.firebasestorage.app",
            messagingSenderId: "651622006147",
            appId: "1:651622006147:web:da188b9ad4f4640eb1cab6"
        };
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();

        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzZqsUibqT13ENoo6GKux-WvMXRvC4PpOyjJXH7lIH4SWSWNnq4jntgPPAubnnz3NM81w/exec';
        const ADMIN_EMAILS = ['raju2uraju@gmail.com', 'kanthati.chakri@gmail.com'];
        function isAdmin() { return currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase()); }

        const products = [
            { id: 1, name: 'Tomato', telugu: '\u0C1F\u0C2E\u0C3E\u0C1F\u0C4B', hindi: 'Tamatar', price: 24, unit: 'kg', moq: 100, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/220px-Tomato_je.jpg', hot: true },
            { id: 2, name: 'Onion', telugu: '\u0C09\u0C32\u0C4D\u0C32\u0C3F\u0C2A\u0C3E\u0C2F', hindi: 'Pyaz', price: 32, unit: 'kg', moq: 50, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Onion_on_White.JPG/220px-Onion_on_White.JPG', hot: true },
            { id: 3, name: 'Potato', telugu: '\u0C2C\u0C02\u0C17\u0C3E\u0C33\u0C3E\u0C26\u0C41\u0C02\u0C2A', hindi: 'Aloo', price: 28, unit: 'kg', moq: 50, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Patates.jpg/220px-Patates.jpg' },
            { id: 4, name: 'Green Chilli', telugu: '\u0C2A\u0C1A\u0C4D\u0C1A\u0C3F \u0C2E\u0C3F\u0C30\u0C4D\u0C1A\u0C3F', hindi: 'Hari Mirch', price: 45, unit: 'kg', moq: 25, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Green_chilli_closeup.jpg/220px-Green_chilli_closeup.jpg', hot: true },
            { id: 5, name: "Lady's Finger", telugu: '\u0C2C\u0C46\u0C02\u0C21\u0C15\u0C3E\u0C2F', hindi: 'Bhindi', price: 38, unit: 'kg', moq: 30, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Okra_%28Abelmoschus_esculentus%29_%283%29.jpg/220px-Okra_%28Abelmoschus_esculentus%29_%283%29.jpg' },
            { id: 6, name: 'Brinjal', telugu: '\u0C35\u0C02\u0C15\u0C3E\u0C2F', hindi: 'Baingan', price: 32, unit: 'kg', moq: 40, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/220px-Solanum_melongena_24_08_2012_%281%29.JPG' },
            { id: 7, name: 'Cauliflower', telugu: '\u0C2B\u0C41\u0C32\u0C35\u0C30\u0C4D', hindi: 'Phool Gobi', price: 28, unit: 'piece', moq: 20, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Chou-fleur_02.jpg/220px-Chou-fleur_02.jpg', fresh: true },
            { id: 8, name: 'Cabbage', telugu: '\u0C15\u0C4D\u0C2F\u0C3E\u0C2C\u0C47\u0C1C\u0C40', hindi: 'Patta Gobi', price: 22, unit: 'piece', moq: 20, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Cabbage_and_cross_section_on_white.jpg/220px-Cabbage_and_cross_section_on_white.jpg' },
            { id: 9, name: 'Carrot', telugu: '\u0C15\u0C3E\u0C30\u0C46\u0C1F\u0C4D', hindi: 'Gajar', price: 42, unit: 'kg', moq: 25, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Vegetable-Ede-carrot.jpg/220px-Vegetable-Ede-carrot.jpg' },
            { id: 10, name: 'Spinach', telugu: '\u0C2A\u0C3E\u0C32\u0C15\u0C42\u0C30', hindi: 'Palak', price: 18, unit: 'bunch', moq: 50, category: 'regional', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Spinach_leaves.jpg/220px-Spinach_leaves.jpg', fresh: true },
            { id: 11, name: 'Bottle Gourd', telugu: '\u0C38\u0C4A\u0C30\u0C15\u0C3E\u0C2F', hindi: 'Lauki', price: 35, unit: 'piece', moq: 15, category: 'regional', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Bottle_gourd.jpg/220px-Bottle_gourd.jpg' },
            { id: 12, name: 'Ridge Gourd', telugu: '\u0C2C\u0C40\u0C30\u0C15\u0C3E\u0C2F', hindi: 'Turiya', price: 40, unit: 'kg', moq: 25, category: 'regional', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Luffa_aegyptiaca_fruit.jpg/220px-Luffa_aegyptiaca_fruit.jpg' }
        ];

        let cart = {};
        let currentCategory = 'all';
        let searchTerm = '';
        let currentUser = null;
        let confirmationResult = null;
        let commissionPercent = parseFloat(localStorage.getItem('kkr_commission') || '15');
        let apmcPrices = null;
        let selectedApmcMarket = 'Bowenpally';

        // Load saved prices & MOQ
        (function loadSaved() {
            const sp = JSON.parse(localStorage.getItem('kkr_prices') || '{}');
            const sm = JSON.parse(localStorage.getItem('kkr_moqs') || '{}');
            Object.entries(sp).forEach(([id, p]) => { const pr = products.find(x => x.id === +id); if (pr) pr.price = p; });
            Object.entries(sm).forEach(([id, m]) => { const pr = products.find(x => x.id === +id); if (pr) pr.moq = m; });
        })();

        // ===== APMC PRICE ENGINE =====
        function generateAPMCPrices(marketName = 'Bowenpally') {
            selectedApmcMarket = marketName;
            const d = new Date();
            // Vary seed strictly by date and market name
            let marketHash = 0; for (let i = 0; i < marketName.length; i++) marketHash += marketName.charCodeAt(i);
            const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + marketHash;
            const commodities = [
                { name: 'Tomato', bMin: 18, bMax: 35 }, { name: 'Onion', bMin: 22, bMax: 45 }, { name: 'Potato', bMin: 20, bMax: 38 },
                { name: 'Green Chilli', bMin: 30, bMax: 65 }, { name: "Lady's Finger", bMin: 28, bMax: 50 }, { name: 'Brinjal', bMin: 22, bMax: 42 },
                { name: 'Cauliflower', bMin: 20, bMax: 40 }, { name: 'Cabbage', bMin: 15, bMax: 30 }, { name: 'Carrot', bMin: 30, bMax: 55 },
                { name: 'Spinach', bMin: 10, bMax: 25 }, { name: 'Bottle Gourd', bMin: 25, bMax: 45 }, { name: 'Ridge Gourd', bMin: 28, bMax: 50 }
            ];
            apmcPrices = commodities.map((c, i) => {
                const h = ((seed * (i + 7)) % 1000) / 1000;
                const min = c.bMin + Math.floor(h * (c.bMax - c.bMin) * 0.4);
                const max = c.bMin + Math.floor(h * (c.bMax - c.bMin) * 0.8) + Math.floor((c.bMax - c.bMin) * 0.3);
                const modal = Math.floor((min + max) / 2);
                return { commodity: c.name, minPrice: min, maxPrice: Math.min(max, c.bMax), modalPrice: modal, date: d.toISOString().split('T')[0] };
            });
            localStorage.setItem('kkr_apmc', JSON.stringify({ prices: apmcPrices, date: d.toISOString().split('T')[0] }));
            return apmcPrices;
        }

        function getSellingPrice(product) {
            if (!apmcPrices) generateAPMCPrices();
            const apmc = apmcPrices.find(a => a.commodity === product.name);
            if (apmc) {
                const base = apmc.modalPrice;
                return Math.round(base + base * commissionPercent / 100);
            }
            return product.price;
        }

        // ===== FIREBASE AUTH =====
        auth.onAuthStateChanged(user => {
            currentUser = user;
            const loginBtn = document.getElementById('loginBtn');
            const userMenu = document.getElementById('userMenu');
            const adminToggle = document.querySelector('.admin-toggle');

            if (user) {
                loginBtn.style.display = 'none';
                userMenu.style.display = 'block';
                const avatar = document.getElementById('userAvatar');
                avatar.src = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23059669"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="45">' + (user.displayName || user.phoneNumber || 'U')[0].toUpperCase() + '</text></svg>';
                avatar.alt = (user.displayName || 'U')[0];
                document.getElementById('userName').textContent = user.displayName || user.phoneNumber || 'User';
                document.getElementById('userEmail').textContent = user.email || user.phoneNumber || '';
                // Pre-fill form
                const nameInput = document.getElementById('customerName');
                const phoneInput = document.getElementById('customerPhone');
                if (nameInput && user.displayName) nameInput.value = user.displayName;
                if (phoneInput && user.phoneNumber) phoneInput.value = user.phoneNumber.replace('+91', '');

                // Show/hide Admin button
                if (adminToggle) adminToggle.style.display = isAdmin() ? 'flex' : 'none';
            } else {
                loginBtn.style.display = 'block';
                userMenu.style.display = 'none';
                if (adminToggle) adminToggle.style.display = 'none';
            }
        });

        function openAuthModal() { document.getElementById('authModal').classList.add('open'); document.body.style.overflow = 'hidden'; }
        function closeAuthModal() { document.getElementById('authModal').classList.remove('open'); document.body.style.overflow = 'auto'; }

        function signInWithGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then(() => {
                closeAuthModal();
                showToast('Signed in successfully!', 'success');
            }).catch(err => {
                console.error(err);
                showToast('Sign-in failed: ' + err.message, 'error');
            });
        }

        function sendOTP() {
            let phone = document.getElementById('phoneInput').value.trim();
            if (!phone.startsWith('+')) phone = '+91' + phone.replace(/\D/g, '');
            if (phone.length < 12) { showToast('Enter valid phone number', 'error'); return; }
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptchaContainer', { size: 'invisible' });
            }
            document.getElementById('sendOtpBtn').disabled = true;
            document.getElementById('sendOtpBtn').textContent = 'Sending...';
            auth.signInWithPhoneNumber(phone, window.recaptchaVerifier).then(result => {
                confirmationResult = result;
                document.getElementById('otpSection').style.display = 'block';
                document.getElementById('sendOtpBtn').textContent = 'Resend';
                document.getElementById('sendOtpBtn').disabled = false;
                showToast('OTP sent!', 'success');
            }).catch(err => {
                console.error(err);
                showToast('Failed to send OTP: ' + err.message, 'error');
                document.getElementById('sendOtpBtn').textContent = 'Send OTP';
                document.getElementById('sendOtpBtn').disabled = false;
                if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
            });
        }

        function verifyOTP() {
            const code = document.getElementById('otpInput').value.trim();
            if (code.length !== 6) { showToast('Enter 6-digit OTP', 'error'); return; }
            confirmationResult.confirm(code).then(() => {
                closeAuthModal();
                showToast('Phone verified!', 'success');
            }).catch(err => {
                showToast('Invalid OTP', 'error');
            });
        }

        function signOutUser() {
            auth.signOut().then(() => {
                document.getElementById('userDropdown').classList.remove('show');
                showToast('Signed out', 'info');
            });
        }

        function toggleUserDropdown() {
            document.getElementById('userDropdown').classList.toggle('show');
        }

        // Close dropdown on outside click
        document.addEventListener('click', e => {
            const menu = document.getElementById('userMenu');
            if (menu && !menu.contains(e.target)) document.getElementById('userDropdown').classList.remove('show');
        });

        // ===== CORE APP =====
        document.addEventListener('DOMContentLoaded', () => {
            generateAPMCPrices();
            setupEventListeners();
            renderProducts(currentCategory);
            updateUI();
        });

        function setupEventListeners() {
            document.getElementById('openEnquiryBtn').addEventListener('click', openEnquiryModal);
            document.getElementById('closeEnquiryBtn').addEventListener('click', closeEnquiryModal);
            document.getElementById('enquiryModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEnquiryModal(); });
            document.querySelector('.modal-content').addEventListener('click', e => e.stopPropagation());
            document.querySelector('.filter-bar').addEventListener('click', onFilterBarClick);
            document.getElementById('productsGrid').addEventListener('click', onProductGridClick);
            document.getElementById('productsGrid').addEventListener('change', onProductQtyChange);
            document.getElementById('enquiryForm').addEventListener('submit', submitEnquiryForm);
            document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeEnquiryModal(); closeAuthModal(); closeBuyerDashboard(); const ap = document.getElementById('adminPanel'); if (ap.classList.contains('open')) toggleAdmin(); } });
        }

        function handleSearch(v) { searchTerm = v.toLowerCase().trim(); renderProducts(currentCategory); }

        function renderProducts(category) {
            const grid = document.getElementById('productsGrid');
            grid.innerHTML = '';
            let filtered = category === 'all' ? products : products.filter(p => p.category === category);
            if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || p.telugu.includes(searchTerm) || p.hindi.toLowerCase().includes(searchTerm));
            if (!filtered.length) { grid.innerHTML = '<div class="no-results"><div class="nr-icon">\uD83D\uDD0D</div><h3>No vegetables found</h3><p>Try a different search or category</p></div>'; return; }
            filtered.forEach((product, index) => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.id = 'card-' + product.id;
                const ci = cart[product.id], qty = ci ? ci.qty : 0, isIn = qty > 0, isValid = qty >= product.moq;
                if (isIn) { card.classList.add('selected'); if (!isValid) card.classList.add('invalid'); }
                const sp = getSellingPrice(product);
                const apmcP = apmcPrices ? apmcPrices.find(a => a.commodity === product.name) : null;
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
                                <div class="price">\u20B9${sp}${apmcP ? '<span class="apmc-live">APMC+' + commissionPercent + '%</span>' : ''}</div>
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
                card.style.opacity = '0'; card.style.transform = 'translateY(20px)'; card.style.transition = 'all 0.3s ease';
                requestAnimationFrame(() => { setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, index * 50); });
            });
        }

        function handleAddClick(id) {
            if (!currentUser) { openAuthModal(); showToast('Please sign in to add items', 'info'); return; }
            const p = products.find(x => x.id === id); if (!p) return;
            const sp = getSellingPrice(p);
            cart[id] = { ...p, price: sp, qty: p.moq };
            showToast(`Added ${p.name} (\u00D7${p.moq})`, 'success');
            updateUI(); renderProducts(currentCategory);
        }

        function updateQty(id, change) {
            if (!cart[id]) return;
            const nq = cart[id].qty + change;
            if (nq < cart[id].moq) { showToast(`Min order: ${cart[id].moq} ${cart[id].unit}`, 'error'); return; }
            cart[id].qty = nq; updateUI(); renderProducts(currentCategory);
        }

        function handleQtyChange(id, value) {
            const qty = parseInt(value, 10) || 0;
            const p = products.find(x => x.id === id); if (!p) return;
            if (qty <= 0) { delete cart[id]; }
            else if (qty < p.moq) { showToast(`Set to minimum: ${p.moq} ${p.unit}`, 'info'); cart[id] = { ...p, price: getSellingPrice(p), qty: p.moq }; }
            else { cart[id] = { ...p, price: getSellingPrice(p), qty }; }
            updateUI(); renderProducts(currentCategory);
        }

        function removeItem(id) { delete cart[id]; showToast('Item removed', 'info'); updateUI(); renderProducts(currentCategory); }

        function onProductGridClick(e) {
            const btn = e.target.closest('button[data-action][data-product-id]'); if (!btn) return;
            const id = Number(btn.dataset.productId); if (!Number.isFinite(id)) return;
            const a = btn.dataset.action;
            if (a === 'add') handleAddClick(id); if (a === 'decrease') updateQty(id, -1); if (a === 'increase') updateQty(id, 1); if (a === 'remove') removeItem(id);
        }
        function onProductQtyChange(e) { const i = e.target.closest('input[data-action="set-qty"]'); if (i) handleQtyChange(Number(i.dataset.productId), i.value); }
        function onFilterBarClick(e) { const b = e.target.closest('.filter-btn[data-category]'); if (b) filterCategory(b.dataset.category); }
        function filterCategory(c) { currentCategory = c || 'all'; document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.category === currentCategory)); renderProducts(currentCategory); }

        function updateUI() {
            const count = Object.keys(cart).length;
            const badge = document.getElementById('cartCount');
            badge.textContent = count; badge.classList.toggle('show', count > 0);
            const total = Object.values(cart).reduce((s, i) => s + (i.price * i.qty), 0);
            const el = document.getElementById('orderTotal');
            if (el) { el.textContent = '\u20B9' + total.toLocaleString('en-IN'); el.classList.toggle('show', total > 0); }
        }

        function validateCart() { return Object.values(cart).every(i => i.qty >= i.moq); }

        function openEnquiryModal() {
            if (!currentUser) { openAuthModal(); showToast('Please sign in first', 'info'); return; }
            const items = Object.values(cart);
            const list = document.getElementById('selectedItemsList');
            const ve = document.getElementById('validationError');
            const sb = document.getElementById('submitBtn');
            if (!items.length) { list.innerHTML = '<span style="color:#64748b;font-size:0.9rem">No items added.</span>'; sb.disabled = true; }
            else {
                const valid = validateCart(); ve.style.display = valid ? 'none' : 'block'; sb.disabled = !valid;
                const totalValue = items.reduce((s, i) => s + (i.price * i.qty), 0);
                const totalItems = items.reduce((s, i) => s + i.qty, 0);
                let html = items.map(i => { const iv = i.qty >= i.moq; const tp = i.price * i.qty; return `<div class="item-row ${!iv ? 'moq-warning' : ''}"><div class="item-info"><div class="item-name">${i.name} <span style="color:#64748b;font-size:0.8rem">(${i.telugu})</span></div><div class="item-qty" style="color:${iv ? 'var(--primary)' : 'var(--danger)'}">Qty: ${i.qty} ${i.unit} ${!iv ? '\u26A0\uFE0F Below MOQ!' : ''}</div></div><div style="text-align:right"><div class="item-price">\u20B9${tp}</div><div style="font-size:0.75rem;color:#64748b">\u20B9${i.price}/${i.unit}</div></div></div>`; }).join('');

                // Grand Total Row
                html += `<div style="background:var(--primary);color:white;padding:1rem;border-radius:10px;margin-top:1rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 15px rgba(5,150,105,0.3)">
                            <div>
                                <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;opacity:0.9">Checkout Total</div>
                                <div style="font-size:0.9rem;font-weight:600">${items.length} Products \u00B7 ${totalItems} Items</div>
                            </div>
                            <div style="font-size:1.5rem;font-weight:800">\u20B9${totalValue.toLocaleString('en-IN')}</div>
                         </div>`;

                list.innerHTML = html;
            }
            populateSavedAddresses();
            document.getElementById('enquiryModal').style.display = 'flex';
            setTimeout(() => { if (!window.deliveryMap) initMap(); else window.deliveryMap.invalidateSize(); }, 300);
            document.body.style.overflow = 'hidden';
        }
        function closeEnquiryModal() { document.getElementById('enquiryModal').style.display = 'none'; document.body.style.overflow = 'auto'; }

        function showToast(msg, type = 'info') { const c = document.getElementById('toastContainer'); if (!c) return; const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; c.appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 3000); }

        // ===== MAP & LOCATION =====
        function initMap() {
            if (window.deliveryMap) return;
            L.Icon.Default.imagePath = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/';
            const defaultLoc = [17.4065, 78.4772]; // Hyderabad
            window.deliveryMap = L.map('deliveryMap').setView(defaultLoc, 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(window.deliveryMap);
            window.deliveryMarker = L.marker(defaultLoc, { draggable: true }).addTo(window.deliveryMap);
            window.deliveryMarker.on('dragend', function (e) { reverseGeocode(e.target.getLatLng()); });
            window.deliveryMap.on('click', function (e) { window.deliveryMarker.setLatLng(e.latlng); reverseGeocode(e.latlng); });
        }
        function getCurrentLocation() {
            const btn = document.getElementById('locateBtn'); btn.textContent = '📍 Locating...'; btn.disabled = true;
            if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); btn.textContent = '📍 Use Current Location'; btn.disabled = false; return; }
            navigator.geolocation.getCurrentPosition(pos => {
                const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                initMap(); window.deliveryMap.setView(latlng, 16); window.deliveryMarker.setLatLng(latlng);
                reverseGeocode(latlng);
                btn.textContent = '📍 Use Current Location'; btn.disabled = false;
            }, err => {
                showToast('Location access denied', 'error'); btn.textContent = '📍 Use Current Location'; btn.disabled = false;
            });
        }
        async function reverseGeocode(latlng) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`);
                const data = await res.json();
                if (data && data.display_name) {
                    document.getElementById('deliveryLocation').value = data.display_name;
                    if (data.address && data.address.postcode) document.getElementById('pincode').value = data.address.postcode;
                }
            } catch (e) { console.error('Geocode err', e); showToast('Failed to auto-fetch address details', 'error'); }
        }

        // ===== SAVED ADDRESSES =====
        function populateSavedAddresses() {
            if (!currentUser) return;
            const list = JSON.parse(localStorage.getItem('kkr_addrs_' + currentUser.uid) || '[]');
            let dd = document.getElementById('savedAddrSelect');
            if (!dd && list.length > 0) {
                dd = document.createElement('select'); dd.id = 'savedAddrSelect';
                dd.style = 'width:100%;margin-bottom:0.75rem;padding:0.6rem;border:2px solid #e2e8f0;border-radius:8px';
                dd.addEventListener('change', e => {
                    if (!e.target.value) return; const a = list[e.target.value];
                    document.getElementById('customerName').value = a.name || '';
                    document.getElementById('customerPhone').value = a.phone || '';
                    document.getElementById('deliveryLocation').value = a.loc;
                    document.getElementById('pincode').value = a.pin;
                    if (a.coords && window.deliveryMap) { window.deliveryMap.setView(a.coords, 16); window.deliveryMarker.setLatLng(a.coords); window.deliveryMap.invalidateSize(); }
                });
                document.getElementById('customerName').parentNode.parentNode.insertBefore(dd, document.getElementById('customerName').parentNode);
            }
            if (dd) {
                dd.innerHTML = '<option value="">-- Choose a saved profile --</option>' + list.map((a, i) => `<option value="${i}">${a.name || 'Profile'} - ${a.loc.substring(0, 30)}... (${a.pin})</option>`).join('');
                dd.style.display = list.length ? 'block' : 'none';
            }
        }
        function saveAddressIfRequested() {
            if (!currentUser || !document.getElementById('saveAddress').checked) return;
            const name = document.getElementById('customerName').value.trim();
            const phone = document.getElementById('customerPhone').value.trim();
            const loc = document.getElementById('deliveryLocation').value.trim();
            const pin = document.getElementById('pincode').value.trim();
            if (!loc || !pin || !name || !phone) { showToast('Please completely fill contact info to save profile', 'error'); return; }

            const k = 'kkr_addrs_' + currentUser.uid;
            const list = JSON.parse(localStorage.getItem(k) || '[]');
            const exists = list.some(a => a.loc.toLowerCase() === loc.toLowerCase() && a.name.toLowerCase() === name.toLowerCase() && a.phone === phone);
            if (!exists) {
                const coords = window.deliveryMarker ? window.deliveryMarker.getLatLng() : null;
                list.push({ name, phone, loc, pin, coords });
                localStorage.setItem(k, JSON.stringify(list));
                showToast('Profile and address saved!', 'success');
            }
        }

        function saveOrder(data) { const orders = JSON.parse(localStorage.getItem('kkr_orders') || '[]'); orders.unshift({ id: 'ORD-' + Date.now().toString(36).toUpperCase(), status: 'Pending', ...data }); if (orders.length > 50) orders.length = 50; localStorage.setItem('kkr_orders', JSON.stringify(orders)); }

        async function submitEnquiryForm(e) {
            e.preventDefault();
            if (!validateCart()) { showToast('Fix MOQ quantities', 'error'); return; }
            const items = Object.values(cart); if (!items.length) { showToast('Add items first', 'error'); return; }
            const totalValue = items.reduce((s, i) => s + (i.price * i.qty), 0);
            const formData = {
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                customerName: document.getElementById('customerName').value,
                phone: document.getElementById('customerPhone').value,
                location: document.getElementById('deliveryLocation').value,
                pincode: document.getElementById('pincode').value,
                businessType: document.getElementById('businessType').value || 'Not specified',
                itemDetails: items.map(i => `${i.name}: ${i.qty}${i.unit} @\u20B9${i.price} = \u20B9${i.price * i.qty}`).join(' | '),
                orderSummary: items.map(i => `${i.name} x${i.qty}`).join(', '),
                moqCompliant: 'YES', totalItems: items.reduce((s, i) => s + i.qty, 0),
                totalValue: '\u20B9' + totalValue, productCount: items.length,
                userId: currentUser ? currentUser.uid : 'anonymous',
                source: 'KKR Groceries B2B'
            };

            if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                // Save locally only
                saveOrder(formData); saveAddressIfRequested();
                document.getElementById('successMsg').style.display = 'block';
                showToast('Order saved locally!', 'success');
                setTimeout(() => { closeEnquiryModal(); cart = {}; updateUI(); renderProducts(currentCategory); document.getElementById('enquiryForm').reset(); document.getElementById('successMsg').style.display = 'none'; }, 2000);
                return;
            }

            const sb = document.getElementById('submitBtn'); const spinner = document.getElementById('spinner');
            sb.disabled = true; sb.querySelector('span').textContent = 'Sending...'; spinner.style.display = 'block';
            try {
                // Fixed: using mode no-cors for Google Apps Script without returning complex JSON
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(formData)
                });

                saveOrder(formData); saveAddressIfRequested();
                document.getElementById('successMsg').style.display = 'block';
                setTimeout(() => { closeEnquiryModal(); cart = {}; updateUI(); renderProducts(currentCategory); document.getElementById('enquiryForm').reset(); document.getElementById('successMsg').style.display = 'none'; sb.disabled = false; sb.querySelector('span').textContent = 'Send Enquiry'; spinner.style.display = 'none'; }, 2000);
            } catch (err) {
                document.getElementById('errorMsg').style.display = 'block';
                showToast('Network error, but saved locally.', 'error');
                saveOrder(formData); saveAddressIfRequested();
                sb.disabled = false; sb.querySelector('span').textContent = 'Send Enquiry'; spinner.style.display = 'none';
            }
        }

        // ===== BUYER DASHBOARD =====
        function openBuyerDashboard() { document.getElementById('userDropdown').classList.remove('show'); document.getElementById('buyerPanel').classList.add('open'); document.body.style.overflow = 'hidden'; renderBuyerOverview(); }
        function closeBuyerDashboard() { document.getElementById('buyerPanel').classList.remove('open'); document.body.style.overflow = 'auto'; }
        function switchBuyerTab(tab, btn) {
            document.querySelectorAll('#buyerPanel .admin-tab').forEach(t => t.classList.remove('active')); btn.classList.add('active');
            ['Overview', 'Orders', 'Addresses'].forEach(t => { document.getElementById('buyer' + t + 'Tab').style.display = tab === t.toLowerCase() ? 'block' : 'none'; });
            if (tab === 'overview') renderBuyerOverview();
            if (tab === 'orders') renderBuyerOrders();
            if (tab === 'addresses') renderBuyerAddresses();
        }

        function renderBuyerOverview() {
            const orders = JSON.parse(localStorage.getItem('kkr_orders') || '[]');
            const uid = currentUser ? currentUser.uid : null;
            const myOrders = uid ? orders.filter(o => o.userId === uid) : orders;
            const totalSpent = myOrders.reduce((s, o) => s + parseInt((o.totalValue || '0').replace(/[^0-9]/g, ''), 10), 0);
            const pop = {}; myOrders.forEach(o => { if (o.orderSummary) o.orderSummary.split(', ').forEach(x => { const n = x.split(' x')[0]; pop[n] = (pop[n] || 0) + 1; }); });
            const top3 = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 3);
            let h = `<div class="dash-stats"><div class="dash-stat" style="background:#f0fdf4"><div class="val" style="color:#059669">${myOrders.length}</div><div class="lbl">My Orders</div></div><div class="dash-stat" style="background:#eff6ff"><div class="val" style="color:#2563eb">\u20B9${totalSpent.toLocaleString('en-IN')}</div><div class="lbl">Total Spent</div></div><div class="dash-stat" style="background:#fef3c7"><div class="val" style="color:#d97706">${Object.keys(pop).length}</div><div class="lbl">Products Ordered</div></div></div>`;
            if (top3.length) { h += '<h4 style="margin-bottom:0.75rem;color:#334155;font-size:0.9rem">\uD83C\uDFC6 Most Ordered</h4>'; top3.forEach(([n, c], i) => { h += `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f1f5f9"><span style="font-weight:600">${i + 1}. ${n}</span><span style="color:#059669;font-weight:700">${c}\u00D7</span></div>`; }); }
            document.getElementById('buyerOverviewTab').innerHTML = h;
        }

        function renderBuyerOrders() {
            const orders = JSON.parse(localStorage.getItem('kkr_orders') || '[]');
            const uid = currentUser ? currentUser.uid : null;
            const myOrders = uid ? orders.filter(o => o.userId === uid) : orders;
            if (!myOrders.length) {
                document.getElementById('buyerOrdersTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\uD83D\uDCE6 No orders yet</div>'; return;
            }
            document.getElementById('buyerOrdersTab').innerHTML = myOrders.map(o => {
                const sColor = o.status === 'Fulfilled' ? '#10b981' : (o.status === 'Accepted' ? '#3b82f6' : (o.status === 'Rejected' ? '#ef4444' : '#f59e0b'));
                return `<div class="history-card">
                    <div class="h-header">
                        <div>
                            <span class="h-date">${o.timestamp}</span>
                            <span class="h-id" style="display:block">${o.id}</span>
                        </div>
                        <span style="background:${sColor}20;color:${sColor};padding:0.25rem 0.5rem;border-radius:12px;font-size:0.75rem;font-weight:700">${o.status || 'Pending'}</span>
                    </div>
                    <div class="h-items" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f1f5f9">${o.orderSummary || ''}</div>
                    <div class="h-total" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
                        <span>${o.productCount || 0} items</span>
                        <span style="font-size:1.1rem;font-weight:800;color:#0f172a">${o.totalValue || ''}</span>
                    </div>
                </div>`;
            }).join('');
        }

        function renderBuyerAddresses() {
            if (!currentUser) { document.getElementById('buyerAddressesTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">Please sign in to view addresses</div>'; return; }
            const k = 'kkr_addrs_' + currentUser.uid;
            const list = JSON.parse(localStorage.getItem(k) || '[]');
            if (!list.length) { document.getElementById('buyerAddressesTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">📍 No saved addresses</div>'; return; }

            document.getElementById('buyerAddressesTab').innerHTML = list.map((a, i) => `
                <div class="history-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="font-weight:700;color:#0f172a;margin-bottom:0.25rem">${a.name || 'Contact'} <span style="font-weight:400;color:#475569">- ${a.phone || ''}</span></div>
                        <div style="font-size:0.9rem;color:#334155;margin-bottom:0.25rem">${a.loc}</div>
                        <div style="font-size:0.8rem;color:#64748b">Pincode: ${a.pin}</div>
                    </div>
                    <button onclick="deleteSavedAddress(${i})" style="background:#fee2e2;color:#ef4444;border:none;padding:0.5rem;border-radius:8px;cursor:pointer;font-size:1rem" title="Delete Address">🗑️</button>
                </div>
            `).join('');
        }

        function deleteSavedAddress(idx) {
            if (!currentUser) return;
            const k = 'kkr_addrs_' + currentUser.uid;
            const list = JSON.parse(localStorage.getItem(k) || '[]');
            list.splice(idx, 1);
            localStorage.setItem(k, JSON.stringify(list));
            renderBuyerAddresses();
            showToast('Address deleted', 'info');
        }

        // ===== ADMIN PANEL =====
        function toggleAdmin() {
            if (!isAdmin()) { showToast('Admin access restricted', 'error'); return; }
            const p = document.getElementById('adminPanel');
            p.classList.toggle('open');
            if (p.classList.contains('open')) { renderPricesTab(); document.body.style.overflow = 'hidden'; }
            else { document.body.style.overflow = 'auto'; }
        }
        function switchAdminTab(tab, btn) { document.querySelectorAll('#adminPanel .admin-tab').forEach(t => t.classList.remove('active')); btn.classList.add('active');['Prices', 'Apmc', 'History', 'Stats'].forEach(t => { document.getElementById('admin' + t + 'Tab').style.display = tab === t.toLowerCase() ? 'block' : 'none'; }); if (tab === 'prices') renderPricesTab(); if (tab === 'apmc') renderApmcTab(); if (tab === 'history') renderHistoryTab(); if (tab === 'stats') renderStatsTab(); }

        function renderPricesTab() {
            let h = `<div class="commission-global"><label>\uD83D\uDCB0 Commission %:</label><input type="number" class="commission-input" id="globalCommission" value="${commissionPercent}" min="0" max="100" step="0.5" style="width:80px"><span style="font-size:0.8rem;color:#64748b">Applied to APMC base prices</span></div>`;
            h += '<table class="price-table"><thead><tr><th>Product</th><th>APMC \u20B9</th><th>Sell \u20B9</th><th>MOQ</th><th>Unit</th></tr></thead><tbody>';
            products.forEach(p => {
                const apmc = apmcPrices ? apmcPrices.find(a => a.commodity === p.name) : null;
                const apmcP = apmc ? apmc.modalPrice : '-';
                const sp = getSellingPrice(p);
                h += `<tr><td><strong>${p.name}</strong><br><span style="color:#64748b;font-size:0.75rem">${p.telugu}</span></td><td style="color:#3b82f6;font-weight:700">\u20B9${apmcP}</td><td style="color:#059669;font-weight:800">\u20B9${sp}</td><td><input type="number" class="moq-input" id="moq-${p.id}" value="${p.moq}" min="1"></td><td>${p.unit}</td></tr>`;
            });
            h += '</tbody></table><button class="save-btn" onclick="saveAdminSettings()">\u2705 Save Settings</button><p style="margin-top:0.5rem;font-size:0.8rem;color:#64748b">MOQ changes are saved locally.</p>';
            document.getElementById('adminPricesTab').innerHTML = h;
        }

        function renderApmcTab() {
            if (!apmcPrices) generateAPMCPrices(selectedApmcMarket);
            const d = apmcPrices[0] ? apmcPrices[0].date : 'N/A';
            let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
                        <div>
                            <select id="apmcMarketSelect" onchange="generateAPMCPrices(this.value);renderApmcTab();renderProducts(currentCategory);" style="padding:0.4rem;font-weight:700;border:2px solid #e2e8f0;border-radius:8px;margin-bottom:0.25rem">
                                <option value="Bowenpally" ${selectedApmcMarket === 'Bowenpally' ? 'selected' : ''}>Hyderabad (Bowenpally)</option>
                                <option value="Gaddiannaram" ${selectedApmcMarket === 'Gaddiannaram' ? 'selected' : ''}>Hyderabad (Gaddiannaram)</option>
                                <option value="Gudimalkapur" ${selectedApmcMarket === 'Gudimalkapur' ? 'selected' : ''}>Hyderabad (Gudimalkapur)</option>
                                <option value="Monda" ${selectedApmcMarket === 'Monda' ? 'selected' : ''}>Secunderabad (Monda Market)</option>
                            </select>
                            <p style="font-size:0.8rem;color:#64748b">Date: ${d} | Unit: \u20B9/Quintal</p>
                        </div>
                        <button onclick="generateAPMCPrices(document.getElementById('apmcMarketSelect').value);renderApmcTab();renderProducts(currentCategory);showToast('Prices refreshed!','success')" style="padding:0.5rem 1rem;background:#3b82f6;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem">\u21BB Refresh</button>
                    </div>`;
            h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.5rem;margin-bottom:1rem;text-align:center"><div style="padding:0.5rem;background:#dbeafe;border-radius:8px"><div style="font-size:0.7rem;color:#1e40af;font-weight:700">MIN</div></div><div style="padding:0.5rem;background:#d1fae5;border-radius:8px"><div style="font-size:0.7rem;color:#065f46;font-weight:700">MODAL</div></div><div style="padding:0.5rem;background:#fee2e2;border-radius:8px"><div style="font-size:0.7rem;color:#991b1b;font-weight:700">MAX</div></div></div>';
            apmcPrices.forEach(p => {
                h += `<div class="apmc-rate-row"><div class="apmc-rate-name">${p.commodity}</div><div class="apmc-rate-prices"><span class="apmc-min">\u20B9${p.minPrice}</span><span class="apmc-modal">\u20B9${p.modalPrice}</span><span class="apmc-max">\u20B9${p.maxPrice}</span></div></div>`;
            });
            document.getElementById('adminApmcTab').innerHTML = h;
        }

        function saveAdminSettings() {
            // Save commission
            const ce = document.getElementById('globalCommission');
            if (ce) commissionPercent = parseFloat(ce.value) || 15;
            localStorage.setItem('kkr_commission', commissionPercent);
            // Save MOQs
            const moqs = JSON.parse(localStorage.getItem('kkr_moqs') || '{}');
            products.forEach(p => { const i = document.getElementById('moq-' + p.id); if (i) { const v = parseInt(i.value, 10); if (v > 0) { p.moq = v; moqs[p.id] = v; } } });
            localStorage.setItem('kkr_moqs', JSON.stringify(moqs));
            renderProducts(currentCategory); updateUI();
            showToast('Settings saved!', 'success');
        }

        function updateOrderStatus(id, newStatus) {
            const orders = JSON.parse(localStorage.getItem('kkr_orders') || '[]');
            const idx = orders.findIndex(o => o.id === id);
            if (idx > -1) {
                orders[idx].status = newStatus;
                localStorage.setItem('kkr_orders', JSON.stringify(orders));
                showToast(`Order ${id} marked as ${newStatus}`, 'success');
                renderOrdersTab();
            }
        }

        function renderOrdersTab() {
            const orders = JSON.parse(localStorage.getItem('kkr_orders') || '[]');
            if (!orders.length) { document.getElementById('adminOrdersTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\uD83D\uDCE6 No orders yet</div>'; return; }
            document.getElementById('adminOrdersTab').innerHTML = orders.map(o => {
                const sColor = o.status === 'Fulfilled' ? '#10b981' : (o.status === 'Accepted' ? '#3b82f6' : (o.status === 'Rejected' ? '#ef4444' : '#f59e0b'));
                let actions = '';
                if (o.status === 'Pending' || !o.status) {
                    actions = `<div style="margin-top:0.5rem;display:flex;gap:0.5rem"><button onclick="updateOrderStatus('${o.id}', 'Accepted')" style="flex:1;background:#3b82f6;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Accept</button><button onclick="updateOrderStatus('${o.id}', 'Rejected')" style="flex:1;background:#fee2e2;color:#ef4444;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Reject</button></div>`;
                } else if (o.status === 'Accepted') {
                    actions = `<div style="margin-top:0.5rem"><button onclick="updateOrderStatus('${o.id}', 'Fulfilled')" style="width:100%;background:#10b981;color:white;border:none;padding:0.4rem;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.8rem">Mark as Fulfilled</button></div>`;
                }

                return `<div class="history-card">
                    <div class="h-header" style="align-items:flex-start">
                        <div>
                            <span class="h-date">${o.timestamp}</span>
                            <div class="h-id">${o.id}</div>
                            <div style="font-size:0.85rem;color:#475569;margin-top:2px">${o.customerName} - ${o.phone}</div>
                        </div>
                        <span style="background:${sColor}20;color:${sColor};padding:0.25rem 0.5rem;border-radius:12px;font-size:0.75rem;font-weight:700">${o.status || 'Pending'}</span>
                    </div>
                    <div class="h-items" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f1f5f9">${o.orderSummary || ''}</div>
                    <div class="h-total" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
                        <span>${o.productCount || 0} items</span>
                        <span style="font-size:1.1rem;font-weight:800;color:#0f172a">${o.totalValue || ''}</span>
                    </div>
                    ${actions}
                </div>`;
            }).join('');
        }

        function renderHistoryTab() { document.getElementById('adminHistoryTab').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem">\u23F3 Order history will appear here</div>'; }

        function renderStatsTab() {
            const orders = JSON.parse(localStorage.getItem('kkr_orders') || '[]');
            const rev = orders.reduce((s, o) => s + parseInt((o.totalValue || '0').replace(/[^0-9]/g, ''), 10), 0);
            const pop = {}; orders.forEach(o => { if (o.orderSummary) o.orderSummary.split(', ').forEach(x => { const n = x.split(' x')[0]; pop[n] = (pop[n] || 0) + 1; }); });
            const top5 = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const customers = new Set(orders.map(o => o.customerName || o.userId)).size;
            let h = `<div class="dash-stats"><div class="dash-stat" style="background:#f0fdf4"><div class="val" style="color:#059669">${orders.length}</div><div class="lbl">Total Orders</div></div><div class="dash-stat" style="background:#eff6ff"><div class="val" style="color:#2563eb">\u20B9${rev.toLocaleString('en-IN')}</div><div class="lbl">Revenue</div></div><div class="dash-stat" style="background:#fef3c7"><div class="val" style="color:#d97706">${customers}</div><div class="lbl">Customers</div></div><div class="dash-stat" style="background:#fce7f3"><div class="val" style="color:#db2777">${products.length}</div><div class="lbl">Products</div></div></div>`;
            if (top5.length) { h += '<h4 style="margin-bottom:0.75rem;color:#334155;font-size:0.9rem">\uD83C\uDFC6 Top Products</h4>'; top5.forEach(([n, c], i) => { h += `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f1f5f9"><span style="font-weight:600">${i + 1}. ${n}</span><span style="color:#059669;font-weight:700">${c} orders</span></div>`; }); }
            // Recent orders
            if (orders.length) { h += '<h4 style="margin:1rem 0 0.75rem;color:#334155;font-size:0.9rem">\uD83D\uDD52 Recent Orders</h4>'; orders.slice(0, 5).forEach(o => { h += `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem"><span style="color:#64748b">${o.timestamp}</span><span style="font-weight:700;color:#059669">${o.totalValue}</span></div>`; }); }
            document.getElementById('adminStatsTab').innerHTML = h;
        }

        // PWA
        if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => { }); }
    