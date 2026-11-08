/**
 * Smart Campus Marketplace - Main Controller Script (Vanilla JS)
 * Fully compliant with T6, T7, F1-F6 requirements.
 */

// Global State & Data Store
let allProducts = [];
let wishlist = JSON.parse(localStorage.getItem('smart_campus_wishlist')) || [];
let myProducts = JSON.parse(localStorage.getItem('smart_campus_my_listings')) || [];

// DOM Element Selectors (ใช้ querySelector ตามกฎข้อกำหนด strict)
const mainContent = document.querySelector('#main-content');
const navLinks = document.querySelectorAll('.nav-link');
const pageViews = document.querySelectorAll('.page-view');
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navMenu = document.querySelector('.nav-menu');

// Initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadProductsData();
    initSellForm();
    initFilters();
    initTabs();
});

// Navigation Handling (SPA view switching for 5 pages)
function initNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPageId = 'page-' + link.getAttribute('data-page');
            
            // Remove active classes
            pageViews.forEach(view => view.classList.remove('active'));
            navLinks.forEach(nav => nav.classList.remove('active'));

            // Activate target
            const targetView = document.querySelector('#' + targetPageId);
            if (targetView) {
                targetView.classList.add('active');
                link.classList.add('active');
            }
            window.scrollTo(0, 0);

            if (link.getAttribute('data-page') === 'mylisted') {
                renderMyListingsAndWishlist();
            }
        });
    });

    mobileMenuToggle.addEventListener('click', () => {
        navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    });
}

// F1: Fetch JSON and Merge with LocalStorage
async function loadProductsData() {
    try {
        const response = await fetch('data/products.json');
        if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลสินค้าได้');
        const sampleData = await response.json();
        
        // Combine sample data with user local listings
        const localListings = JSON.parse(localStorage.getItem('smart_campus_listings')) || [];
        allProducts = [...localListings, ...sampleData];

        renderHomeLatest();
        renderAllProducts(allProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        // Fallback if fetch fails (T7)
        const localListings = JSON.parse(localStorage.getItem('smart_campus_listings')) || [];
        allProducts = [...localListings];
        renderHomeLatest();
        renderAllProducts(allProducts);
    }
}

// Render Products Grid Helper with XSS prevention (Sanitize utility)
function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function calculateAveragePrice(category) {
    const filtered = allProducts.filter(p => p.category === category);
    if (filtered.length === 0) return 0;
    const sum = filtered.reduce((acc, curr) => acc + Number(curr.price), 0);
    return sum / filtered.length;
}

function createProductCardHTML(product) {
    const avgPrice = calculateAveragePrice(product.category);
    const isGoodDeal = avgPrice > 0 && Number(product.price) < avgPrice * 0.8;
    const isWishlisted = wishlist.includes(product.id);
    const isSold = product.status === 'sold';

    return `
        <div class="product-card ${isSold ? 'sold-out' : ''}" data-id="${product.id}">
            <div class="card-img-wrapper">
                <img src="${sanitizeHTML(product.image || 'https://via.placeholder.com/300x200')}" alt="${sanitizeHTML(product.name)}" loading="lazy">
                <span class="badge">${sanitizeHTML(product.category)}</span>
                ${isGoodDeal ? '<span class="badge badge-deal" style="top:35px">ราคาดี 🔥</span>' : ''}
                ${isSold ? '<span class="badge" style="background:var(--danger-color); top:35px">ขายแล้ว</span>' : ''}
            </div>
            <div class="card-body">
                <h4>${sanitizeHTML(product.name)}</h4>
                <p class="price">${Number(product.price).toLocaleString()} บาท</p>
                <p class="meta-info"><i class="fa-solid fa-location-dot"></i> ${sanitizeHTML(product.location)}</p>
                <p class="meta-info"><i class="fa-solid fa-clock"></i> ${sanitizeHTML(product.timeAgo || 'เร็วๆ นี้')}</p>
                <div class="card-actions">
                    <button class="btn-detail" onclick="openProductDetail('${product.id}')">ดูรายละเอียด</button>
                    <button class="btn-wishlist" onclick="toggleWishlist('${product.id}')">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart" style="color:var(--danger-color)"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Render Home Page Latest
function renderHomeLatest() {
    const grid = document.querySelector('#latest-products-grid');
    if (!grid) return;
    const latest = allProducts.slice(0, 4);
    grid.innerHTML = latest.map(p => createProductCardHTML(p)).join('');
}

// Render All Products Page
function renderAllProducts(productsToRender) {
    const grid = document.querySelector('#all-products-grid');
    if (!grid) return;
    if (productsToRender.length === 0) {
        grid.innerHTML = '<p>ไม่พบสินค้าที่ค้นหา</p>';
        return;
    }
    grid.innerHTML = productsToRender.map(p => createProductCardHTML(p)).join('');
}

// F2: Search + Filter + Sort implementation with debounce support
function initFilters() {
    const searchInput = document.querySelector('#filter-search');
    const categorySelect = document.querySelector('#filter-category');
    const priceRange = document.querySelector('#filter-max-price');
    const priceOutput = document.querySelector('#price-output');
    const sortSelect = document.querySelector('#filter-sort');
    const conditionCheckboxes = document.querySelectorAll('input[name="condition"]');

    function applyFilters() {
        const query = searchInput.value.toLowerCase();
        const category = categorySelect.value;
        const maxPrice = Number(priceRange.value);
        const sortBy = sortSelect.value;
        
        const selectedConditions = Array.from(conditionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        priceOutput.textContent = maxPrice;

        let filtered = allProducts.filter(p => {
            const matchesName = p.name.toLowerCase().includes(query);
            const matchesCategory = !category || p.category === category;
            const matchesPrice = Number(p.price) <= maxPrice;
            const matchesCondition = selectedConditions.length === 0 || selectedConditions.includes(p.condition);
            return matchesName && matchesCategory && matchesPrice && matchesCondition;
        });

        // Sorting
        if (sortBy === 'price-low') {
            filtered.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-high') {
            filtered.sort((a, b) => b.price - a.price);
        } else {
            filtered.sort((a, b) => new Date(b.id) - new Date(a.id));
        }

        renderAllProducts(filtered);
    }

    searchInput.addEventListener('input', debounce(applyFilters, 300));
    categorySelect.addEventListener('change', applyFilters);
    priceRange.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    conditionCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
}

// Utility: Debounce handler
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// F3, F4: Sell Form & Real-time Preview & FileReader
function initSellForm() {
    const form = document.querySelector('#sell-form');
    const nameInput = document.querySelector('#item-name');
    const catSelect = document.querySelector('#item-category');
    const priceInput = document.querySelector('#item-price');
    const descInput = document.querySelector('#item-desc');
    const charCounter = document.querySelector('#char-counter');
    const locSelect = document.querySelector('#item-location');
    const imageInput = document.querySelector('#item-image');

    // Real-time Preview Elements
    const prevTitle = document.querySelector('#prev-title');
    const prevPrice = document.querySelector('#prev-price');
    const prevBadge = document.querySelector('#prev-badge');
    const prevLocation = document.querySelector('#prev-location');
    const prevImg = document.querySelector('#prev-img');

    let uploadedImageBase64 = '';

    descInput.addEventListener('input', () => {
        charCounter.textContent = descInput.value.length;
    });

    // FileReader for image preview
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                uploadedImageBase64 = event.target.result;
                prevImg.src = uploadedImageBase64;
            };
            reader.readAsDataURL(file);
        }
    });

    // Real-time update preview bindings (F4)
    nameInput.addEventListener('input', () => { prevTitle.textContent = nameInput.value || 'ชื่อสินค้าตัวอย่าง'; });
    priceInput.addEventListener('input', () => { prevPrice.textContent = (priceInput.value || 0) + ' บาท'; });
    catSelect.addEventListener('change', () => { prevBadge.textContent = catSelect.value || 'หมวดหมู่'; });
    locSelect.addEventListener('change', () => { prevLocation.textContent = locSelect.value || 'จุดนัดรับ'; });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        let isValid = true;

        // Simple Validation Check
        if (!nameInput.value.trim()) {
            document.querySelector('#err-item-name').textContent = 'กรุณากรอกชื่อสินค้า';
            isValid = false;
        } else {
            document.querySelector('#err-item-name').textContent = '';
        }

        if (!catSelect.value) {
            document.querySelector('#err-item-category').textContent = 'กรุณาเลือกหมวดหมู่';
            isValid = false;
        } else {
            document.querySelector('#err-item-category').textContent = '';
        }

        if (!priceInput.value || priceInput.value < 0) {
            document.querySelector('#err-item-price').textContent = 'กรุณากรอกราคาที่ถูกต้อง';
            isValid = false;
        } else {
            document.querySelector('#err-item-price').textContent = '';
        }

        const conditionChecked = document.querySelector('input[name="item-condition"]:checked');
        if (!conditionChecked) {
            document.querySelector('#err-item-condition').textContent = 'กรุณาเลือกสภาพสินค้า';
            isValid = false;
        } else {
            document.querySelector('#err-item-condition').textContent = '';
        }

        if (!locSelect.value) {
            document.querySelector('#err-item-location').textContent = 'กรุณาเลือกจุดนัดรับ';
            isValid = false;
        } else {
            document.querySelector('#err-item-location').textContent = '';
        }

        if (isValid) {
            const newProduct = {
                id: 'prod_' + Date.now(),
                name: nameInput.value,
                category: catSelect.value,
                price: Number(priceInput.value),
                condition: conditionChecked.value,
                description: descInput.value,
                location: locSelect.value,
                contact: document.querySelector('#item-contact').value,
                image: uploadedImageBase64 || 'https://via.placeholder.com/300x200?text=Student+Item',
                timeAgo: 'เมื่อสักครู่',
                status: 'active'
            };

            // Save to localStorage
            const localListings = JSON.parse(localStorage.getItem('smart_campus_listings')) || [];
            localListings.unshift(newProduct);
            localStorage.setItem('smart_campus_listings', JSON.stringify(localListings));

            // Save to My Listings
            myProducts.unshift(newProduct);
            localStorage.setItem('smart_campus_my_listings', JSON.stringify(myProducts));

            alert('ลงประกาศสำเร็จ!');
            form.reset();
            prevImg.src = 'https://via.placeholder.com/300x200?text=No+Image';
            loadProductsData();
        }
    });
}

// F5, F6: Wishlist and Actions (Mark sold, delete)
window.toggleWishlist = function(productId) {
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
    } else {
        wishlist.push(productId);
    }
    localStorage.setItem('smart_campus_wishlist', JSON.stringify(wishlist));
    loadProductsData();
    renderMyListingsAndWishlist();
};

window.openProductDetail = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const modal = document.querySelector('#product-detail-modal');
    const modalBody = document.querySelector('#modal-product-body');

    modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <img src="${sanitizeHTML(product.image)}" alt="${sanitizeHTML(product.name)}" style="width:100%; height:250px; object-fit:cover; border-radius:8px;">
            <h2>${sanitizeHTML(product.name)}</h2>
            <p class="price" style="font-size:1.5rem;">${Number(product.price).toLocaleString()} บาท</p>
            <p><strong>หมวดหมู่:</strong> ${sanitizeHTML(product.category)} | <strong>สภาพ:</strong> ${sanitizeHTML(product.condition)}</p>
            <p><strong>รายละเอียด:</strong> ${sanitizeHTML(product.description || '-')}</p>
            <p><i class="fa-solid fa-location-dot"></i> จุดนัดรับ: <strong>${sanitizeHTML(product.location)}</strong></p>
            <p><i class="fa-solid fa-address-book"></i> ช่องทางติดต่อ: <strong>${sanitizeHTML(product.contact || 'ติดต่อผ่านระบบ')}</strong></p>
        </div>
    `;
    modal.showModal();

    document.querySelector('#close-modal-btn').onclick = () => modal.close();
};

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = document.querySelector('#tab-content-' + btn.getAttribute('data-tab'));
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

function renderMyListingsAndWishlist() {
    const myGrid = document.querySelector('#my-listings-grid');
    const wishlistGrid = document.querySelector('#wishlist-grid');

    const localListings = JSON.parse(localStorage.getItem('smart_campus_listings')) || [];
    
    // Render My Listings with F5 actions (Mark sold / Delete)
    if (myGrid) {
        if (localListings.length === 0) {
            myGrid.innerHTML = '<p>คุณยังไม่มีประกาศสินค้า</p>';
        } else {
            myGrid.innerHTML = localListings.map(p => `
                <div class="product-card ${p.status === 'sold' ? 'sold-out' : ''}">
                    <div class="card-img-wrapper">
                        <img src="${sanitizeHTML(p.image)}" alt="${sanitizeHTML(p.name)}">
                        <span class="badge">${sanitizeHTML(p.category)}</span>
                    </div>
                    <div class="card-body">
                        <h4>${sanitizeHTML(p.name)}</h4>
                        <p class="price">${Number(p.price).toLocaleString()} บาท</p>
                        <div class="card-actions" style="flex-direction:column;">
                            <button onclick="markAsSold('${p.id}')">${p.status === 'sold' ? 'สินค้าขายแล้ว' : 'ทำเครื่องหมายว่าขายแล้ว'}</button>
                            <button onclick="deleteListing('${p.id}')" style="background:var(--danger-color); color:white;">ลบประกาศ</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Render Wishlist Grid
    if (wishlistGrid) {
        const wishlistedProducts = allProducts.filter(p => wishlist.includes(p.id));
        if (wishlistedProducts.length === 0) {
            wishlistGrid.innerHTML = '<p>ยังไม่มีรายการที่สนใจใน Wishlist</p>';
        } else {
            wishlistGrid.innerHTML = wishlistedProducts.map(p => createProductCardHTML(p)).join('');
        }
    }
}

window.markAsSold = function(productId) {
    let localListings = JSON.parse(localStorage.getItem('smart_campus_listings')) || [];
    localListings = localListings.map(p => {
        if (p.id === productId) {
            p.status = p.status === 'sold' ? 'active' : 'sold';
        }
        return p;
    });
    localStorage.setItem('smart_campus_listings', JSON.stringify(localListings));
    loadProductsData();
    renderMyListingsAndWishlist();
};

window.deleteListing = function(productId) {
    if (confirm('คุณต้องการลบประกาศนี้ใช่หรือไม่?')) {
        let localListings = JSON.parse(localStorage.getItem('smart_campus_listings')) || [];
        localListings = localListings.filter(p => p.id !== productId);
        localStorage.setItem('smart_campus_listings', JSON.stringify(localListings));
        loadProductsData();
        renderMyListingsAndWishlist();
    }
};
