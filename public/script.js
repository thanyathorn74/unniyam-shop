const app = {
    mockProducts: [], 
    dbCategories: [], // Stores real categories from DB
    // Add these inside the app object at the top
    map: null,
    marker: null,
    
    // Mock Vouchers (Required for the homepage to look good)
    mockVouchers: [
        { code: "NEWUSER", type: "fixed_amount", value: 50, desc: "฿50 Off (New User)" },
        { code: "SALE10", type: "percentage", value: 10, desc: "10% Discount" },
        { code: "FREESHIP", type: "fixed_amount", value: 40, desc: "Free Shipping" },
        { code: "PAYDAY25", type: "percentage", value: 25, desc: "25% Off" },
        { code: "FLASH50", type: "fixed_amount", value: 50, desc: "Flash Sale ฿50" },
        { code: "WELCOME100", type: "fixed_amount", value: 100, desc: "Welcome Gift ฿100" }
    ],
    activeCoupon: null,
    currentCategory: 'All', 
    currentSearch: '', 

// --- 1. INIT: WITH STRICT SESSION RESTORE ---
    init: async function() {
        console.log("🚀 App initializing...");

        // 1. Always try to restore session first (Critical Step)
        // We wait here so no other code runs until we know who the user is.
        if (!localStorage.getItem('user')) {
            try {
                const res = await fetch('/api/user/me');
                const data = await res.json();
                if (data.user) {
                    console.log("✅ Session Restored for:", data.user.display_name);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    console.log("⚠️ No active session found on server.");
                }
            } catch (e) { 
                console.error("❌ Session check failed:", e); 
            }
        }

        // 2. NOW we load data (Safe because user is restored)
        this.checkLoginStatus(); // Update UI header (Login/Profile)
        this.fetchProducts();
        this.updateCartCount(); 
        this.loadNotifications(); 

        // 3. Route Handling (Page Specific Logic)
        if (window.location.hash === '#login') {
            this.showPage('login');
        }

        // Home Page Logic
        if (document.getElementById('product-container')) {
            this.renderVouchersOnHome(); 
        }

        // Cart Page Logic - NOW SAFE
        if (document.getElementById('cart-items-container')) {
            console.log("🛒 Loading Cart Page...");
            this.renderCartPage();
            this.renderCartVouchers(); 
            setTimeout(() => this.togglePaymentDetails(), 100);
        }

        // Checkout Page Logic
        if (document.getElementById('address-list')) {
            this.renderCheckoutPage();
        }

        // 4. Global Event Listeners
        document.getElementById('login-form')?.addEventListener('submit', this.handleLogin);
        document.getElementById('address-form')?.addEventListener('submit', this.handleSaveAddress);

        window.onclick = function(event) {
            if (!event.target.matches('#nav-profile-pic')) {
                const dropdown = document.getElementById("profile-menu");
                if (dropdown && !dropdown.classList.contains('hidden')) dropdown.classList.add('hidden');
            }
            if (!event.target.closest('.nav-noti-container')) {
                const notiMenu = document.getElementById('noti-menu');
                if (notiMenu && !notiMenu.classList.contains('hidden')) notiMenu.classList.add('hidden');
            }
        }

        // Order History Page Logic
        if (document.getElementById('order-history-container')) {
            this.loadOrderHistory();
        }

        // Add this inside init: async function() { ... }
        // D. Event Listeners section
        document.getElementById('edit-profile-form')?.addEventListener('submit', this.handleEditProfileSubmit);

    },

    // --- FETCH DATA ---
    fetchProducts: async function() {
        try {
            // 1. Fetch Categories First
            const catRes = await fetch('/api/categories');
            if (catRes.ok) {
                this.dbCategories = await catRes.json();
                if (document.getElementById('cat-container')) {
                    this.renderCategories(); 
                }
            }

            // 2. Fetch Products
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Failed to fetch');
            
            const dbProducts = await response.json();
            
            this.mockProducts = dbProducts.map(p => {
                // Find category name by ID
                const catObj = this.dbCategories.find(c => c.category_id === p.category_id);
                return {
                    product_id: p.product_id,
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    stock_quantity: p.stock_quantity,
                    image_url: p.image_url ? `/uploads/${p.image_url.split(',')[0]}` : 'https://via.placeholder.com/200',
                    all_images: p.image_url,
                    category: catObj ? catObj.name : 'All', 
                    is_flash_sale: false 
                };
            });
            
            if (document.getElementById('product-container')) {
                this.renderProducts();
            }
            
            if (document.getElementById('detail-name')) {
                this.loadProductDetails();
            }

        } catch (err) {
            console.error("Error fetching data:", err);
        }
    },

// --- PRODUCT DETAILS (FIXED) ---
   // --- PRODUCT DETAILS (FIXED) ---
    loadProductDetails: async function() { // Added async
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id'); // Removed parseInt to ensure it sends string or number correctly

        if (!productId) {
            console.error("No product ID found in URL");
            return;
        }

        try {
            // DIRECTLY fetch this specific product from the server
            const res = await fetch(`/api/products/${productId}`);
            
            if (!res.ok) {
                document.getElementById('detail-name').innerText = "Product Not Found";
                return;
            }

            const product = await res.json();

            // 1. Fill Text Data
            document.getElementById('detail-name').innerText = product.name;
            document.getElementById('detail-price').innerText = '฿' + parseFloat(product.price).toLocaleString();
            document.getElementById('detail-stock').innerText = product.stock_quantity;
            
            const descEl = document.getElementById('detail-desc');
            if(descEl) descEl.innerText = product.description || "No description provided.";

            // 2. Handle Images
            const mainImg = document.getElementById('main-img');
            const thumbContainer = document.getElementById('thumbnail-container');
            
            let imageUrls = [];
            if (product.image_url && product.image_url !== 'default.png') {
                // Handle comma separated images
                imageUrls = product.image_url.split(',').map(img => `/uploads/${img}`);
            } else {
                imageUrls = ['https://via.placeholder.com/600x400?text=No+Image'];
            }

            // Set Main Image
            if(mainImg) mainImg.src = imageUrls[0];
            
            // Set Thumbnails
            if(thumbContainer) {
                thumbContainer.innerHTML = imageUrls.map((img, index) => `
                    <img src="${img}" class="thumb-img ${index === 0 ? 'active' : ''}" 
                    onclick="app.switchImage('${img}', this)" 
                    onerror="this.src='https://via.placeholder.com/80'">
                `).join('');
            }

            // 3. Setup "Add to Cart" Button
            const btn = document.getElementById('add-cart-btn');
            const newBtn = btn.cloneNode(true); // Clear old listeners
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.onclick = () => { this.addToCart(product); };

        } catch (err) {
            console.error("Error loading product details:", err);
            document.getElementById('detail-name').innerText = "Error Loading Product";
        }
    },
    
    // Helper to switch main image when clicking a thumbnail
    switchImage: function(src, thumbElement) { 
        document.getElementById('main-img').src = src; 
        document.querySelectorAll('.thumb-img').forEach(img => img.classList.remove('active')); 
        thumbElement.classList.add('active'); 
    },

    // --- RENDER CATEGORIES ---
    renderCategories: function() {
        const container = document.getElementById('cat-container');
        if(!container) return;
        
        // Icon Map matched to your EXACT folders
        const iconMap = {
            "Accessories": "fa-glasses",
            "Bag": "fa-shopping-bag",
            "Bottom": "fa-columns",       
            "Shirts": "fa-tshirt",        
            "Shoe": "fa-shoe-prints",     
            "All": "fa-th-large"
        };

        // Render 'All'
        let html = `
            <div class="category-card ${this.currentCategory === 'All' ? 'active' : ''}" onclick="app.selectCategory('All')">
                <i class="fas ${iconMap['All']} category-icon"></i>
                <div class="category-name">All</div>
            </div>
        `;
        
        // Render Database Categories
        this.dbCategories.forEach(cat => {
            const iconClass = iconMap[cat.name] || "fa-tag";
            html += `
                <div class="category-card ${this.currentCategory === cat.name ? 'active' : ''}" onclick="app.selectCategory('${cat.name}')">
                    <i class="fas ${iconClass} category-icon"></i>
                    <div class="category-name">${cat.name}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    // --- CART LOGIC ---
    getCartKey: function() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            return (user && user.user_id) ? `unniyam_cart_${user.user_id}` : null;
        } catch (e) { return null; }
    },
    
    requireLogin: function() {
        alert("🔒 You need to login first!");
        // Save current URL to redirect back
        localStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = "index.html#login";
    },
    
    addToCart: function(product) { 
        const cartKey = this.getCartKey();
        if (!cartKey) { 
            this.requireLogin();
            return; 
        }
        let cart = JSON.parse(localStorage.getItem(cartKey)) || []; 
        let existingItem = cart.find(item => item.product_id === product.product_id); 
        if (existingItem) existingItem.quantity += 1; else cart.push({ ...product, quantity: 1 }); 
        localStorage.setItem(cartKey, JSON.stringify(cart)); 
        this.updateCartCount(); 
        alert("Added " + product.name + " to cart!"); 
    },

    updateCartCount: function() { 
        const cartKey = this.getCartKey();
        const badge = document.getElementById('cart-count'); 
        if (!cartKey || !badge) { if(badge) badge.innerText = '0'; return; }
        let cart = JSON.parse(localStorage.getItem(cartKey)) || []; 
        badge.innerText = cart.reduce((acc, item) => acc + item.quantity, 0); 
    },

    // --- RENDER CART (Restored Full Logic) ---
    renderCartPage: function() {
        const container = document.getElementById('cart-items-container'); 
        if (!container) return; 
        
        const cartKey = this.getCartKey();
        if (!cartKey) { 
            container.innerHTML = `<div style="text-align:center; padding: 3rem;"><p>Please Login to view cart.</p><a href="index.html#login" style="color:var(--primary-color)">Go Login</a></div>`; 
            this.updateCartSummary(0); 
            return; 
        }
        
        let cart = JSON.parse(localStorage.getItem(cartKey)) || [];
        if (cart.length === 0) { 
            container.innerHTML = `<div style="text-align:center; padding: 3rem;"><p>Your cart is empty.</p><a href="index.html" style="color:var(--primary-color)">Go Shop Now</a></div>`; 
            this.updateCartSummary(0); 
            return; 
        }
        
        container.innerHTML = ''; 
        let subtotal = 0;
        cart.forEach((item, index) => { 
            subtotal += item.price * item.quantity; 
            container.innerHTML += `
            <div class="cart-item-card">
                <div style="display:flex; gap:15px; align-items:center;">
                    <div class="cart-img"><img src="${item.image_url}" onerror="this.src='https://via.placeholder.com/80'"></div>
                    <div class="cart-details"><h4>${item.name}</h4><div class="price">฿${parseFloat(item.price).toLocaleString()}</div></div>
                </div>
                <div style="text-align: right;">
                    <div class="qty-control">
                        <button onclick="app.changeCartQty(${index}, -1)">-</button>
                        <input type="text" value="${item.quantity}" readonly>
                        <button onclick="app.changeCartQty(${index}, 1)">+</button>
                    </div>
                    <button class="remove-btn" onclick="app.removeCartItem(${index})"><i class="fas fa-trash"></i> Remove</button>
                </div>
            </div>`; 
        });
        this.updateCartSummary(subtotal);
    },

    changeCartQty: function(index, change) { 
        const k = this.getCartKey(); if (!k) return; 
        let cart = JSON.parse(localStorage.getItem(k)) || []; 
        if (cart[index].quantity + change > 0) { 
            cart[index].quantity += change; 
            localStorage.setItem(k, JSON.stringify(cart)); 
            this.renderCartPage(); 
            this.updateCartCount(); 
        } 
    },

    removeCartItem: function(index) { 
        const k = this.getCartKey(); if (!k) return; 
        if(confirm('Remove item?')) { 
            let cart = JSON.parse(localStorage.getItem(k)) || []; 
            cart.splice(index, 1); 
            localStorage.setItem(k, JSON.stringify(cart)); 
            this.renderCartPage(); 
            this.updateCartCount(); 
        } 
    },

    // --- CHECKOUT ---
    goToCheckout: function() { 
        const k = this.getCartKey(); 
        if(!k) { this.requireLogin(); return; } 
        let cart = JSON.parse(localStorage.getItem(k)) || []; 
        if(cart.length === 0) { alert("Cart is empty!"); return; } 
        window.location.href = 'checkout.html'; 
    },
    
    mockAddresses: [ { id: 1, name: "Home", detail: "123/45 Sukhumvit Rd, Bangkok", phone: "081-234-5678" }, { id: 2, name: "Office", detail: "999 Rama 9, Bangkok", phone: "089-999-8888" } ],
    
    renderCheckoutPage: function() {
        const addrContainer = document.getElementById('address-list'); 
        const itemsContainer = document.getElementById('checkout-items-summary'); 
        if(!addrContainer || !itemsContainer) return;
        
        addrContainer.innerHTML = this.mockAddresses.map((addr, index) => `<div class="address-card" onclick="app.selectAddress(this)"><input type="radio" name="shipping_addr" value="${addr.id}" class="address-radio" ${index===0?'checked':''}><div class="address-details"><h4>${addr.name} (${addr.phone})</h4><p>${addr.detail}</p></div></div>`).join('');
        if(addrContainer.children.length > 0) addrContainer.children[0].classList.add('selected');
        
        const k = this.getCartKey(); 
        let cart = JSON.parse(localStorage.getItem(k)) || []; 
        let subtotal = 0; itemsContainer.innerHTML = '';
        
        cart.forEach(item => { 
            let itemTotal = item.price * item.quantity; 
            subtotal += itemTotal; 
            itemsContainer.innerHTML += `<div class="checkout-item-mini"><span class="mini-name">${item.quantity}x ${item.name}</span><span>฿${itemTotal.toLocaleString()}</span></div>`; 
        });
        
        const savedCouponCode = localStorage.getItem('unniyam_active_coupon_code'); 
        if(savedCouponCode) this.activeCoupon = this.mockVouchers.find(v => v.code === savedCouponCode);
        
        let discount = 0; 
        if(this.activeCoupon) { 
            discount = this.activeCoupon.type === 'percentage' ? subtotal * (this.activeCoupon.value / 100) : this.activeCoupon.value; 
            if(discount > subtotal) discount = subtotal; 
        }
        
        document.getElementById('checkout-subtotal').innerText = '฿' + subtotal.toLocaleString(); 
        document.getElementById('checkout-discount').innerText = '-฿' + discount.toLocaleString(); 
        document.getElementById('checkout-total').innerText = '฿' + (subtotal - discount).toLocaleString();

        let finalTotal = subtotal - discount;
        
        // Update Text
        document.getElementById('checkout-subtotal').innerText = '฿' + subtotal.toLocaleString(); 
        document.getElementById('checkout-discount').innerText = '-฿' + discount.toLocaleString(); 
        document.getElementById('checkout-total').innerText = '฿' + finalTotal.toLocaleString();

        // --- NEW: UPDATE REAL QR CODE ---
        const qrImg = document.getElementById('promptpay-qr');
        if (qrImg) {
            // Replace '0812345678' with your REAL PromptPay Number (Mobile or ID Card)
            const merchantId = "0812345678"; // example number: put your own PromptPay number here 
            
            // This API generates a valid Thai PromptPay QR
            qrImg.src = `https://promptpay.io/${merchantId}/${finalTotal}`;
        }

    },

    selectAddress: function(card) { 
        document.querySelectorAll('.address-card').forEach(c => c.classList.remove('selected')); 
        const radio = card.querySelector('input[type="radio"]'); 
        if(radio) radio.checked = true; 
        card.classList.add('selected'); 
    },

    confirmOrder: async function() {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) { alert("Please login to place an order."); return; }
        
        const selectedAddr = document.querySelector('input[name="shipping_addr"]:checked'); 
        if(!selectedAddr) { alert("Please select a shipping address."); return; } 
        
        const selectedPay = document.querySelector('input[name="payment"]:checked'); 
        const paymentMethod = selectedPay ? selectedPay.value : "Unknown"; 
        
        const totalAmount = parseFloat(document.getElementById('checkout-total').innerText.replace(/[^\d.]/g, ''));
        const k = this.getCartKey(); 
        const cart = JSON.parse(localStorage.getItem(k)) || [];
        
        const payload = { user_id: user.user_id, cartItems: cart, total: totalAmount, address_id: selectedAddr.value, payment_method: paymentMethod };
        
        try {
            const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Order Confirmed! ID: ${data.orderId}\nTotal: ฿${totalAmount}\nPayment: ${paymentMethod}`);
                localStorage.removeItem(k); 
                localStorage.removeItem('unniyam_active_coupon_code'); 
                window.location.href = 'index.html';
            } else { alert("Order failed: " + data.message); }
        } catch (err) { console.error(err); alert("Error placing order. Check console."); }
    },

    // --- PRODUCT DETAILS ---
    loadProductDetails: function() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = parseInt(urlParams.get('id'));
        
        if (this.mockProducts.length === 0) {
            setTimeout(() => this.loadProductDetails(), 300);
            return;
        }

        const product = this.mockProducts.find(p => p.product_id === productId);
        if (!product) { 
            document.getElementById('detail-name').innerText = "Product Not Found"; 
            return; 
        }

        document.getElementById('detail-name').innerText = product.name;
        document.getElementById('detail-price').innerText = '฿' + parseFloat(product.price).toLocaleString();
        document.getElementById('detail-stock').innerText = product.stock_quantity;
        
        const descEl = document.getElementById('detail-desc');
        if(descEl) descEl.innerText = product.description || "No description provided by seller.";

        const mainImg = document.getElementById('main-img');
        const thumbContainer = document.getElementById('thumbnail-container');
        
        let imageUrls = [];
        if (product.all_images) {
            imageUrls = product.all_images.split(',').map(img => `/uploads/${img}`);
        } else {
            imageUrls = ['https://via.placeholder.com/600'];
        }

        mainImg.src = imageUrls[0];
        
        if(thumbContainer) {
            thumbContainer.innerHTML = imageUrls.map((img, index) => `
                <img src="${img}" class="thumb-img ${index === 0 ? 'active' : ''}" 
                onclick="app.switchImage('${img}', this)" 
                onerror="this.src='https://via.placeholder.com/80'">
            `).join('');
        }

        document.getElementById('add-cart-btn').onclick = () => { this.addToCart(product); };
    },
    
    switchImage: function(src, thumbElement) { 
        document.getElementById('main-img').src = src; 
        document.querySelectorAll('.thumb-img').forEach(img => img.classList.remove('active')); 
        thumbElement.classList.add('active'); 
    },

    // --- VOUCHERS ---
    renderVouchersOnHome: function() {
        const container = document.getElementById('voucher-container');
        if(!container) return;
        let collectedVouchers = JSON.parse(localStorage.getItem('unniyam_my_vouchers')) || [];
        container.innerHTML = this.mockVouchers.map(v => {
            const isCollected = collectedVouchers.includes(v.code);
            return `
            <div class="voucher-card">
                <div class="voucher-left"><div class="voucher-amount">${v.type === 'percentage' ? v.value + '%' : '฿' + v.value}</div><div class="voucher-desc">${v.desc}</div><div style="font-size:0.7rem;">Code: ${v.code}</div></div>
                <div class="voucher-right"><button class="collect-btn ${isCollected ? 'collected' : ''}" onclick="app.collectVoucher('${v.code}')">${isCollected ? 'Cancel' : 'Collect'}</button></div>
            </div>`;
        }).join('');
    },
    
    collectVoucher: function(code) {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) { this.requireLogin(); return; }
        let collected = JSON.parse(localStorage.getItem('unniyam_my_vouchers')) || [];
        if(!collected.includes(code)) collected.push(code); else collected = collected.filter(c => c !== code);
        localStorage.setItem('unniyam_my_vouchers', JSON.stringify(collected));
        this.renderVouchersOnHome(); 
    },

    renderCartVouchers: function() {
        const select = document.getElementById('saved-coupons');
        if(!select) return;
        let collected = JSON.parse(localStorage.getItem('unniyam_my_vouchers')) || [];
        if(collected.length === 0) { select.innerHTML = '<option value="">No vouchers collected</option>'; select.disabled = true; return; }
        let html = '<option value="">-- Select Collected Voucher --</option>';
        collected.forEach(code => { const v = this.mockVouchers.find(v => v.code === code); if(v) html += `<option value="${code}">${code} - ${v.desc}</option>`; });
        select.innerHTML = html; select.disabled = false;
    },
    
    selectSavedCoupon: function() { const s = document.getElementById('saved-coupons'); const i = document.getElementById('coupon-code'); if(s.value) i.value = s.value; else i.value = ""; },
    
    applyCoupon: function() { 
        const codeInput = document.getElementById('coupon-code').value.trim().toUpperCase(); 
        const msg = document.getElementById('coupon-message'); 
        const coupon = this.mockVouchers.find(v => v.code === codeInput); 
        if (coupon) { 
            this.activeCoupon = coupon; 
            localStorage.setItem('unniyam_active_coupon_code', coupon.code); 
            msg.innerText = "✅ Coupon Applied"; msg.style.color = "green"; 
            this.renderCartPage(); 
        } else { 
            this.activeCoupon = null; 
            localStorage.removeItem('unniyam_active_coupon_code'); 
            msg.innerText = "❌ Invalid Coupon"; msg.style.color = "red"; 
            this.renderCartPage(); 
        } 
    },
    
    updateCartSummary: function(subtotal) { 
        const subtotalEl = document.getElementById('subtotal-price'); 
        const discountEl = document.getElementById('discount-amount'); 
        const totalEl = document.getElementById('total-price'); 
        if(!subtotalEl) return; 
        
        let discount = 0; 
        if (this.activeCoupon) { 
            discount = this.activeCoupon.type === 'percentage' ? subtotal * (this.activeCoupon.value / 100) : this.activeCoupon.value; 
            if(discount > subtotal) discount = subtotal; 
        } 
        
        subtotalEl.innerText = '฿' + subtotal.toLocaleString(); 
        discountEl.innerText = '-฿' + discount.toLocaleString(); 
        totalEl.innerText = '฿' + (subtotal - discount).toLocaleString(); 
    },
    
    togglePaymentDetails: function() { const methods = document.getElementsByName('payment'); let selected = 'QR PromptPay'; for (let r of methods) { if (r.checked) { selected = r.value; break; } } const qrBox = document.getElementById('payment-qr'), codBox = document.getElementById('payment-cod'), cardBox = document.getElementById('payment-card'); if(qrBox) qrBox.classList.add('hidden'); if(codBox) codBox.classList.add('hidden'); if(cardBox) cardBox.classList.add('hidden'); if (selected === 'QR PromptPay' && qrBox) qrBox.classList.remove('hidden'); else if (selected === 'COD' && codBox) codBox.classList.remove('hidden'); else if (selected === 'CreditCard' && cardBox) cardBox.classList.remove('hidden'); },

    // --- HELPERS ---
    selectCategory: function(catName) {
        this.currentCategory = catName;
        this.currentSearch = ''; 
        if(document.getElementById('search-input')) document.getElementById('search-input').value = '';
        this.renderCategories(); 
        this.renderProducts();
    },

    renderProducts: function() {
        const flashSection = document.querySelector('.flash-sale-container');
        const flashContainer = document.getElementById('flash-sale-list');
        const mainContainer = document.getElementById('product-container');
        const sectionTitle = document.getElementById('main-product-title');
        
        if (!mainContainer) return;

        if (this.currentCategory === 'All' && this.currentSearch === '') {
            if(flashSection) flashSection.style.display = 'block';
            if(sectionTitle) sectionTitle.innerText = "All Products";
        } else {
            if(flashSection) flashSection.style.display = 'none';
            if(this.currentSearch !== '') {
                if(sectionTitle) sectionTitle.innerText = `Search Results for "${this.currentSearch}"`;
            } else {
                if(sectionTitle) sectionTitle.innerText = this.currentCategory;
            }
        }

        let filteredProducts = this.mockProducts.filter(p => {
            let catMatch = (this.currentCategory === 'All') || (p.category === this.currentCategory);
            let searchMatch = (this.currentSearch === '') || (p.name.toLowerCase().includes(this.currentSearch));
            return catMatch && searchMatch;
        });

        if (this.currentCategory === 'All' && this.currentSearch === '' && flashContainer) {
            flashContainer.innerHTML = '';
            const flashItems = this.mockProducts.filter(p => p.is_flash_sale);
            if(flashItems.length === 0 && flashSection) flashSection.style.display = 'none';
            flashItems.forEach(p => flashContainer.innerHTML += this.createCardHtml(p));
        }

        mainContainer.innerHTML = '';
        if (filteredProducts.length === 0) {
            mainContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem;">No products found.</div>`;
            return;
        }
        filteredProducts.forEach(p => {
            if (this.currentCategory === 'All' && this.currentSearch === '' && p.is_flash_sale) return; 
            mainContainer.innerHTML += this.createCardHtml(p);
        });
    },

    createCardHtml: function(p) {
        const productString = JSON.stringify(p).replace(/"/g, "&quot;");
        return `
            <div class="product-card" onclick="window.location.href='product-detail.html?id=${p.product_id}'">
                ${p.is_flash_sale ? '<div class="sale-badge">SALE</div>' : ''}
                <div class="product-image"><img src="${p.image_url}" onerror="this.src='https://via.placeholder.com/200'"></div>
                <div class="product-info">
                    <div class="product-name">${p.name}</div>
                    <div class="price-container"><span class="product-price">฿${parseFloat(p.price).toLocaleString()}</span></div>
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 5px;">${p.stock_quantity} left</div>
                    <button class="add-to-cart" onclick="event.stopPropagation(); app.addToCart(${productString})">Add to Cart</button>
                </div>
            </div>`;
    },

    handleSearch: function() {
        const input = document.getElementById('search-input');
        if(input) {
            this.currentSearch = input.value.trim().toLowerCase();
            this.renderProducts(); 
        }
    },
    handleSearchEnter: function(event) { if (event.key === 'Enter') this.handleSearch(); },

    // --- NOTIFICATIONS ---
    loadNotifications: async function() {
        const notiBadge = document.getElementById('nav-noti-count');
        const notiDropdown = document.getElementById('noti-dropdown-content');
        
        if (!notiBadge || !notiDropdown) return;

        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            const myNotis = data.filter(n => n.type !== 'admin_alert');
            
            if (myNotis.length > 0) {
                notiBadge.innerText = myNotis.length;
                notiBadge.style.display = 'flex';
            } else {
                notiBadge.style.display = 'none';
            }

            if (myNotis.length === 0) {
                notiDropdown.innerHTML = '<div class="noti-item-empty">No notifications</div>';
            } else {
                notiDropdown.innerHTML = myNotis.map(n => `
                    <div class="noti-item">
                        <i class="fas fa-info-circle" style="color:#4361ee; margin-top:2px;"></i>
                        <div><div class="noti-msg">${n.message}</div></div>
                    </div>
                `).join('');
            }
        } catch(err) { console.error(err); }
    },
    toggleNotiDropdown: function() {
        document.getElementById('noti-menu').classList.toggle('hidden');
    },
    requestSeller: async function() {
        if(!confirm("Send a request to Admin to become a Seller?")) return;
        try {
            const res = await fetch('/api/request-seller', { method: 'POST' });
            const data = await res.json();
            if(data.success) alert("✅ Request Sent!"); else alert(data.message);
        } catch(err) { console.error(err); }
    },

    // --- AUTH & PAGE ---
    showPage: function(pageId) { 
        ['home-page', 'login-page', 'register-page'].forEach(id => { 
            const el = document.getElementById(id); 
            if(el) { el.classList.add('hidden'); el.classList.remove('active-page'); } 
        }); 
        const active = document.getElementById(pageId + '-page'); 
        if(active) { active.classList.remove('hidden'); active.classList.add('active-page'); } 
    },
    toggleDropdown: function() { document.getElementById("profile-menu").classList.toggle("hidden"); },
    toggleModal: function(modalId) { document.getElementById(modalId).classList.toggle('hidden'); },
    previewImage: function(event) { const reader = new FileReader(); reader.onload = function(){ document.getElementById('profile-preview').src = reader.result; document.getElementById('profile-preview').style.display='block'; }; reader.readAsDataURL(event.target.files[0]); },
    
checkLoginStatus: function() {
        const user = JSON.parse(localStorage.getItem("user"));
        
        const loginLink = document.getElementById('login-link');
        const profileLink = document.getElementById('profile-link');
        const profilePic = document.getElementById('nav-profile-pic');
        const menu = document.getElementById('profile-menu');

        if (user) {
            // 1. UI Updates
            if (loginLink) loginLink.style.display = 'none';
            if (profileLink) {
                profileLink.classList.remove('hidden');
                profileLink.style.display = 'flex'; 
            }
            if (profilePic && user.profile_pic_url) {
                profilePic.src = "/uploads/" + user.profile_pic_url;
            }

            // 2. DYNAMIC DROPDOWN MENU
            if (menu) {
                let menuHtml = '';

                // --- A. ADMIN DASHBOARD (At the Top) ---
                if (user.role === 'admin') {
                    menuHtml += `<a href="admin/admin-dashboard.html" style="color: #d90429; font-weight: bold; border-bottom: 1px solid #eee;">Admin Dashboard</a>`;
                } 

                // --- B. SELLER DASHBOARD (Visible for Sellers AND Admins) ---
                if (user.role === 'seller' || user.role === 'admin') {
                    menuHtml += `<a href="seller-dashboard.html" style="color: #4361ee; font-weight: bold;">Seller Dashboard</a>`;
                }

                // --- C. STANDARD LINKS ---
                menuHtml += `
                    <a href="#" onclick="app.openEditProfile()">Edit Profile</a>
                    <a href="order-history.html">Order History</a>
                    <a href="#" onclick="app.logout()">Logout</a>
                `;
                
                menu.innerHTML = menuHtml;
            }

        } else {
            // User is Logged Out
            if (loginLink) loginLink.style.display = 'block';
            if (profileLink) profileLink.classList.add('hidden');
        }
    },

    // --- ORDER HISTORY ---
    loadOrderHistory: async function() {
        const container = document.getElementById('order-history-container');
        if (!container) return;

        try {
            const res = await fetch('/api/my-orders');
            if (res.status === 401) {
                this.requireLogin();
                return;
            }
            
            const orders = await res.json();

            if (orders.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:2rem;">No orders found. <a href="index.html" style="color:var(--primary-color)">Start Shopping</a></div>`;
                return;
            }

            container.innerHTML = orders.map(o => {
                const date = new Date(o.order_date).toLocaleDateString() + ' ' + new Date(o.order_date).toLocaleTimeString();
                const statusClass = 'status-' + o.order_status.toLowerCase();
                
                return `
                <div class="order-card">
                    <div class="order-header">
                        <span>Order #${o.order_id}</span>
                        <span>${date}</span>
                    </div>
                    <div class="order-body">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h4>Items: ${o.product_names}</h4>
                                <p style="font-size:0.9rem; color:#666;">Total Items: ${o.total_items}</p>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:1.2rem; font-weight:bold; color:var(--primary-color); margin-bottom:5px;">
                                    ฿${parseFloat(o.total_amount).toLocaleString()}
                                </div>
                                <span class="order-status ${statusClass}">${o.order_status}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

        } catch (err) {
            console.error(err);
            container.innerHTML = '<p style="color:red; text-align:center;">Failed to load orders.</p>';
        }
    },

    // --- Add this inside the 'app' object ---
    clearSearch: function() {
        const input = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-search');
        
        input.value = ''; // Clear text
        clearBtn.classList.add('hidden'); // Hide X
        input.focus(); // Keep focus on input
        
        // Optional: Reset the product list to "All" immediately
        this.currentSearch = '';
        this.renderProducts();
    },

    // --- EDIT PROFILE ---
    openEditProfile: function() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;

        // 1. Fill the form with current data
        document.getElementById('edit-fname').value = user.first_name || '';
        document.getElementById('edit-lname').value = user.last_name || '';
        document.getElementById('edit-username').value = user.display_name || '';
        
        // 2. Show current image
        const img = document.getElementById('edit-profile-preview');
        if (user.profile_pic_url) {
            img.src = `/uploads/${user.profile_pic_url}`;
        } else {
            img.src = 'https://via.placeholder.com/150';
        }

        // 3. Show Modal
        this.toggleModal('edit-profile-modal');
    },

    previewEditImage: function(event) {
        const reader = new FileReader();
        reader.onload = function() {
            document.getElementById('edit-profile-preview').src = reader.result;
        };
        reader.readAsDataURL(event.target.files[0]);
    },

    handleEditProfileSubmit: async function(e) {
        e.preventDefault();
        const form = document.getElementById('edit-profile-form');
        const formData = new FormData(form);

        try {
            const res = await fetch('/api/user/update', {
                method: 'PUT',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                // Update Local Storage
                let currentUser = JSON.parse(localStorage.getItem('user'));
                // Merge new data into existing user object (preserves other fields like ID/Role)
                const updatedUser = { ...currentUser, ...data.user };
                
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                alert("✅ Profile Updated!");
                app.toggleModal('edit-profile-modal');
                
                // Refresh UI (Nav bar image/name)
                app.checkLoginStatus(); 
            } else {
                alert("Update failed: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Error updating profile.");
        }
    },

    openAddressModal: function() {
        this.toggleModal('address-modal');

        // Leaflet needs a moment to realize the modal is visible before rendering correctly
        setTimeout(() => {
            if (!this.map) {
                // Initialize Map (Default: KMUTT coordinates)
                this.map = L.map('map').setView([13.6513, 100.4964], 15);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                // Click Event: Move marker & Auto-fill address
                this.map.on('click', async (e) => {
                    const { lat, lng } = e.latlng;
                    app.updateMarker(lat, lng);
                    await app.reverseGeocode(lat, lng);
                });
            } else {
                this.map.invalidateSize(); // Fixes grey map issue if reopened
            }
        }, 300);
    },

// --- AUTH & LOGOUT ---
    updateUIForUser: function(u, p) { 
        if(u) { 
            document.getElementById('login-link').classList.add('hidden'); 
            document.getElementById('profile-link').classList.remove('hidden'); 
        } 
    },

    logout: async function() {
        try {
            // 1. Tell server to delete the cookie
            await fetch('/logout'); 
            
            // 2. Clear frontend storage
            localStorage.removeItem("user"); 
            localStorage.removeItem("unniyam_cart_" + (JSON.parse(localStorage.getItem("user"))?.user_id || ""));
            
            alert("Logged out successfully"); 
            
            // 3. Force reload to index
            window.location.href = "index.html"; 
        } catch (err) {
            console.error("Logout failed", err);
            // Fallback if server fails
            localStorage.removeItem("user");
            window.location.href = "index.html";
        }
    },

    // --- MAP & ADDRESS FUNCTIONS ---
    openAddressModal: function() {
        this.toggleModal('address-modal');

        // Leaflet needs a moment to realize the modal is visible before rendering correctly
        setTimeout(() => {
            if (!this.map) {
                // Initialize Map (Default: KMUTT coordinates)
                this.map = L.map('map').setView([13.6513, 100.4964], 15);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                // Click Event: Move marker & Auto-fill address
                this.map.on('click', async (e) => {
                    const { lat, lng } = e.latlng;
                    app.updateMarker(lat, lng);
                    await app.reverseGeocode(lat, lng);
                });
            } else {
                this.map.invalidateSize(); // Fixes grey map issue if reopened
            }
        }, 300);
    },

    updateMarker: function(lat, lng) {
        if (this.marker) {
            this.marker.setLatLng([lat, lng]);
        } else {
            this.marker = L.marker([lat, lng]).addTo(this.map);
        }
    },

    reverseGeocode: async function(lat, lng) {
        // Use OpenStreetMap Nominatim API (Free)
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.address) {
                const addr = data.address;
                const city = addr.city || addr.state || addr.province || "";
                const zip = addr.postcode || "";

                // Construct address line
                let detail = "";
                if(addr.road) detail += addr.road + ", ";
                if(addr.suburb) detail += addr.suburb + ", ";
                if(addr.neighbourhood) detail += addr.neighbourhood;

                // Auto-fill inputs
                document.getElementById('new-addr-detail').value = detail || data.display_name.split(',')[0];
                document.getElementById('new-addr-city').value = city;
                document.getElementById('new-addr-zip').value = zip;
            }
        } catch (err) {
            console.error("Geocoding failed", err);
        }
    },

    handleSaveAddress: function(e) {
            // 1. STOP the page from reloading
            if(e) e.preventDefault();
            
            console.log("💾 Saving Address...");

            // 2. Get values
            const detail = document.getElementById('new-addr-detail').value;
            const city = document.getElementById('new-addr-city').value;
            const phone = document.getElementById('new-addr-phone').value;

            // 3. Create New Address Object
            const newAddress = {
                id: Date.now(), // Unique ID
                name: "New Location",
                detail: `${detail}, ${city}`,
                phone: phone
            };

            // 4. Add to the TOP of the list (Index 0)
            app.mockAddresses.unshift(newAddress);

            // 5. Refresh the list immediately
            app.renderCheckoutPage(); 
            
            // 6. Close Modal & Reset Form
            app.toggleModal('address-modal');
            document.getElementById('address-form').reset(); 
            
            console.log("✅ Address saved and list updated.");
    },

    

    

}; // <--- END OF APP OBJECT

// --- OUTSIDE APP OBJECT ---
app.handleLogin = async function(e) {
    e.preventDefault();
    const form = document.getElementById("login-form");
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    try {
        const res = await fetch("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("user", JSON.stringify(data.user));
            alert("✅ Login success");
            
            const redirectUrl = localStorage.getItem('redirect_after_login');
            if (redirectUrl) {
                localStorage.removeItem('redirect_after_login');
                window.location.href = redirectUrl;
            } else {
                window.location.href = "index.html";
            }
        } else { alert(data.message); }
    } catch (err) { alert("Server error"); }
};

window.onload = () => app.init();