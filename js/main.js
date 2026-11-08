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

/**
 * Student Market — Main JavaScript Bundle (js/main.js)
 * โค้ดต้นฉบับ Vanilla JavaScript สำหรับโปรเจกต์ Smart Campus
 */

const JSON_URL = 'data/products.json';
const LOCAL_MINE_KEY = 'sm-mine';
const LOCAL_WISH_KEY = 'sm-wish';

// ===== 1. Helper Functions & Security (T6, T7, Cybersecurity XSS Prevention) =====

// ป้องกัน XSS Attack โดยแปลงอักขระพิเศษในสตริงก่อนแสดงผลผ่าน DOM
const escapeHtml = (str) => {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ฟังก์ชัน Debounce สำหรับชะลอการทำงานของ Event Handler ค้นหา เพื่อประสิทธิภาพสูงสุด
const debounce = (func, wait) => {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// โหลดข้อมูลจาก localStorage พร้อมการจัดการ Error
const loadStorage = (key, defaultVal) => {
  try {
    const val = localStorage.getItem(key);
    return val === null ? defaultVal : JSON.parse(val);
  } catch (e) {
    return defaultVal;
  }
};

// บันทึกข้อมูลลง localStorage
const saveStorage = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    alert('ไม่สามารถบันทึกข้อมูลได้ หน่วยความจำเต็ม');
    return false;
  }
};

// แสดงระยะเวลาที่ลงประกาศ เช่น "2 ชั่วโมงที่แล้ว" (ฟีเจอร์เสริม)
const timeAgo = (isoString) => {
  if (!isoString) return 'เมื่อสักครู่';
  const date = new Date(isoString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 0 || isNaN(seconds)) return 'เมื่อสักครู่';
  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

// แปลงตัวเลขเป็นสกุลเงินบาท
const formatBaht = (num) => Number(num || 0).toLocaleString('th-TH') + ' บาท';

// F1: Fetch ข้อมูลจากไฟล์ JSON ของกลุ่ม รวมกับประกาศใหม่ใน localStorage
async function fetchAllProducts() {
  let jsonProducts = [];
  try {
    const res = await fetch(JSON_URL);
    if (res.ok) {
      jsonProducts = await res.json();
    }
  } catch (e) {
    console.warn('ไม่สามารถโหลดข้อมูลจาก products.json ได้:', e);
  }

  const myProducts = loadStorage(LOCAL_MINE_KEY, []);
  
  // รวมประกาศจาก localStorage เข้ากับไฟล์ JSON และเรียงลำดับจากล่าสุด
  const combined = [...myProducts, ...jsonProducts];
  return combined.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));
}

// คำนวณราคาเฉลี่ยของหมวดหมู่ เพื่อติดป้าย "ราคาดี" (ฟีเจอร์เสริม)
function getCategoryAveragePrice(products, category) {
  const list = products.filter(p => p.category === category && p.price > 0);
  if (!list.length) return 0;
  const total = list.reduce((sum, p) => sum + Number(p.price), 0);
  return total / list.length;
}

// ===== 2. Component สร้างการ์ดสินค้า (DOM Manipulation) =====

function createProductCard(product, allProducts, mode = 'normal') {
  const wishlist = loadStorage(LOCAL_WISH_KEY, []);
  const isWishlisted = wishlist.includes(product.id);
  const avgPrice = getCategoryAveragePrice(allProducts, product.category);
  
  const isGoodPrice = !product.sold && product.price > 0 && avgPrice > 0 && product.price < avgPrice;
  const isSold = Boolean(product.sold);

  // Fallback รูปภาพกรณีไม่มีรูปหรือโหลดไม่ขึ้น
  const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/></svg>";
  const imgSrc = product.image ? escapeHtml(product.image) : placeholderImg;

  const article = document.createElement('article');
  article.className = `product-card ${isSold ? 'sold-out' : ''}`;

  article.innerHTML = `
    <div class="card-img-wrap">
      ${isSold ? '<span class="sold-badge">ขายแล้ว</span>' : ''}
      ${isGoodPrice ? '<span class="good-price-badge">ราคาดี 🔥</span>' : ''}
      <img src="${imgSrc}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.src='${placeholderImg}'">
      ${mode !== 'preview' ? `
        <button type="button" class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${escapeHtml(product.id)}" aria-label="บันทึกสินค้าที่สนใจ">
          ${isWishlisted ? '★' : '☆'}
        </button>
      ` : ''}
    </div>
    <div class="card-body">
      <span class="category-tag">${escapeHtml(product.category)}</span>
      <h3 class="card-title">
        ${mode === 'preview' 
          ? escapeHtml(product.title) 
          : `<a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.title)}</a>`
        }
      </h3>
      <p class="card-price">${formatBaht(product.price)} <span class="condition-badge">สภาพ${escapeHtml(product.condition)}</span></p>
      <p class="card-location">📍 ${escapeHtml(product.meetPoint)}</p>
      <p class="card-time">🕒 <time datetime="${escapeHtml(product.postedAt)}">${timeAgo(product.postedAt)}</time></p>
      
      ${mode === 'mine' ? `
        <div class="owner-controls" style="margin-top: 12px; display: flex; gap: 8px;">
          <button type="button" class="btn-sold btn-secondary" data-id="${escapeHtml(product.id)}" style="flex:1; padding:6px 12px; font-size:0.85rem;">
            ${isSold ? 'ยกเลิกขายแล้ว' : 'ทำเครื่องหมาย "ขายแล้ว"'}
          </button>
          <button type="button" class="btn-delete" data-id="${escapeHtml(product.id)}" style="background:#ef4444; color:white; border:none; border-radius:999px; padding:6px 12px; font-size:0.85rem; cursor:pointer;">
            ลบ
          </button>
        </div>
      ` : ''}
    </div>
  `;

  return article;
}

// ===== 3. Global Event Delegation (Wishlist, Sold, Delete) =====

function setupGlobalEvents() {
  // ใช้ querySelector และ Event Delegation ตามหลักการ Vanilla ที่มีประสิทธิภาพ
  document.addEventListener('click', (e) => {
    // F6: Wishlist toggle
    const wishBtn = e.target.closest('.wishlist-btn');
    if (wishBtn) {
      const id = wishBtn.dataset.id;
      let wishlist = loadStorage(LOCAL_WISH_KEY, []);
      if (wishlist.includes(id)) {
        wishlist = wishlist.filter(x => x !== id);
      } else {
        wishlist.push(id);
      }
      saveStorage(LOCAL_WISH_KEY, wishlist);
      refreshCurrentPage();
      return;
    }

    // F5: Toggle Sold Status
    const soldBtn = e.target.closest('.btn-sold');
    if (soldBtn) {
      const id = soldBtn.dataset.id;
      let myProducts = loadStorage(LOCAL_MINE_KEY, []);
      myProducts = myProducts.map(p => p.id === id ? { ...p, sold: !p.sold } : p);
      saveStorage(LOCAL_MINE_KEY, myProducts);
      refreshCurrentPage();
      return;
    }

    // F5: Delete Listing (พร้อมถามยืนยันก่อนลบ)
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('คุณต้องการลบประกาศนี้ใช่หรือไม่?')) {
        let myProducts = loadStorage(LOCAL_MINE_KEY, []);
        let wishlist = loadStorage(LOCAL_WISH_KEY, []);
        
        myProducts = myProducts.filter(p => p.id !== id);
        wishlist = wishlist.filter(x => x !== id);
        
        saveStorage(LOCAL_MINE_KEY, myProducts);
        saveStorage(LOCAL_WISH_KEY, wishlist);
        refreshCurrentPage();
      }
      return;
    }
  });

  // อัปเดตเวลาแบบ Real-time ทุก 30 วินาที
  setInterval(() => {
    document.querySelectorAll('time').forEach(t => {
      const datetime = t.getAttribute('datetime');
      if (datetime) t.textContent = timeAgo(datetime);
    });
  }, 30000);
}

// ===== 4. Page Controller (ควบคุมการเรนเดอร์แต่ละหน้า) =====

async function refreshCurrentPage() {
  await renderIndexPage();
  await renderProductsPage();
  await renderDetailPage();
  await renderMyListingsPage();
}

// หน้าที่ 1: index.html (หน้าแรก: ประกาศล่าสุด)
async function renderIndexPage() {
  const container = document.querySelector('#latest-products');
  if (!container) return;

  const products = await fetchAllProducts();
  const latest = products.slice(0, 8);

  container.replaceChildren();
  if (!latest.length) {
    container.innerHTML = '<p class="loading">ยังไม่มีประกาศสินค้าในระบบ</p>';
    return;
  }

  latest.forEach(p => {
    container.appendChild(createProductCard(p, products, 'normal'));
  });
}

// หน้าที่ 2: products.html (สินค้าทั้งหมด พร้อมค้นหา/ตัวกรอง/เรียงลำดับ F2)
async function renderProductsPage() {
  const container = document.querySelector('#product-grid');
  if (!container) return;

  const allProducts = await fetchAllProducts();
  const form = document.querySelector('#filter-form');
  const searchInput = document.querySelector('#search-input');
  const categorySelect = document.querySelector('#category-select');
  const conditionSelect = document.querySelector('#condition-select');
  const minPriceInput = document.querySelector('#min-price');
  const maxPriceInput = document.querySelector('#max-price');
  const sortSelect = document.querySelector('#sort-select');
  const resultCount = document.querySelector('#result-count');

  // ตรวจสอบ Query Parameter จาก URL หากมีการกดเลือกหมวดหมู่จากหน้าอื่น
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('category') && categorySelect) {
    categorySelect.value = urlParams.get('category');
  }

  function applyFilter() {
    let list = [...allProducts];
    const q = (searchInput?.value || '').trim().toLowerCase();
    const cat = categorySelect?.value || '';
    const cond = conditionSelect?.value || '';
    const min = parseFloat(minPriceInput?.value) || 0;
    const max = parseFloat(maxPriceInput?.value) || Infinity;
    const sort = sortSelect?.value || 'latest';

    // กรองตามชื่อ, หมวดหมู่, สภาพ, ช่วงราคา
    if (q) list = list.filter(p => p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    if (cat) list = list.filter(p => p.category === cat);
    if (cond) list = list.filter(p => p.condition === cond);
    list = list.filter(p => Number(p.price) >= min && Number(p.price) <= max);

    // เรียงลำดับ
    if (sort === 'low') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === 'high') {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    } else {
      list.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));
    }

    if (resultCount) {
      resultCount.textContent = `พบสินค้าทั้งหมด ${list.length} รายการ`;
    }

    container.replaceChildren();
    if (!list.length) {
      container.innerHTML = '<p class="loading">ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>';
      return;
    }

    list.forEach(p => {
      container.appendChild(createProductCard(p, allProducts, 'normal'));
    });
  }

  if (form && !form.dataset.initialized) {
    form.dataset.initialized = 'true';
    form.addEventListener('input', debounce(applyFilter, 200));
    form.addEventListener('change', applyFilter);
    form.addEventListener('reset', () => setTimeout(applyFilter, 10));
  }

  applyFilter();
}

// หน้าที่ 3: product.html (รายละเอียดสินค้าเดี่ยว)
async function renderDetailPage() {
  const container = document.querySelector('#product-detail-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const products = await fetchAllProducts();
  const product = products.find(p => p.id === id);

  if (!product) {
    container.innerHTML = '<h2>ไม่พบข้อมูลสินค้า</h2><p><a href="products.html">← กลับไปหน้าสินค้าทั้งหมด</a></p>';
    return;
  }

  const wishlist = loadStorage(LOCAL_WISH_KEY, []);
  const isWishlisted = wishlist.includes(product.id);
  const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23e2e8f0'/></svg>";
  const imgSrc = product.image ? escapeHtml(product.image) : placeholderImg;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; align-items: start;">
      <div class="card-img-wrap" style="height: 320px; border-radius: 12px;">
        ${product.sold ? '<span class="sold-badge">ขายแล้ว</span>' : ''}
        <img src="${imgSrc}" alt="${escapeHtml(product.title)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${placeholderImg}'">
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <span class="category-tag">${escapeHtml(product.category)}</span>
        <h1 style="font-size: 1.8rem; margin: 0;">${escapeHtml(product.title)}</h1>
        <p class="card-price" style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">
          ${formatBaht(product.price)} <span class="condition-badge" style="font-size:0.9rem;">สภาพ${escapeHtml(product.condition)}</span>
        </p>
        <p><strong>📍 จุดนัดรับจริงในมหาวิทยาลัย:</strong> ${escapeHtml(product.meetPoint)}</p>
        <p><strong>📞 ช่องทางติดต่อ:</strong> ${escapeHtml(product.contact)}</p>
        <p><strong>🕒 เวลาลงประกาศ:</strong> <time datetime="${escapeHtml(product.postedAt)}">${timeAgo(product.postedAt)}</time></p>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
        <p><strong>รายละเอียดสินค้า:</strong></p>
        <p style="white-space: pre-line; color: var(--text-light);">${escapeHtml(product.description)}</p>
        
        <button type="button" class="btn-main wishlist-btn" data-id="${escapeHtml(product.id)}" style="margin-top: 16px; width: fit-content;">
          ${isWishlisted ? '★ เอาออกจากรายการที่สนใจ' : '☆ บันทึกเป็นรายการที่สนใจ (Wishlist)'}
        </button>
      </div>
    </div>
  `;
}

// หน้าที่ 4: sell.html (ฟอร์มลงประกาศ พร้อม FileReader และ Real-time Preview F3, F4)
function renderSellPage() {
  const form = document.querySelector('#sell-form');
  const previewBox = document.querySelector('#preview-card');
  const errBox = document.querySelector('#error-message');
  if (!form || !previewBox) return;

  let imageBase64 = '';
  const imgInput = document.querySelector('#image-file');

  // อ่านไฟล์ภาพด้วย FileReader (ฟีเจอร์เสริม)
  if (imgInput && !imgInput.dataset.listener) {
    imgInput.dataset.listener = 'true';
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          imageBase64 = evt.target.result;
          updatePreview();
        };
        reader.readAsDataURL(file);
      } else {
        imageBase64 = '';
        updatePreview();
      }
    });
  }

  // F4: พรีวิวการ์ดประกาศแบบ Real-time ขณะกรอกฟอร์ม
  function updatePreview() {
    const formData = new FormData(form);
    const mockProduct = {
      id: 'preview',
      title: formData.get('title') || 'ชื่อสินค้าตัวอย่าง',
      category: formData.get('category') || 'หมวดหมู่',
      price: formData.get('price') || 0,
      condition: formData.get('condition') || 'ดี',
      meetPoint: formData.get('meetPoint') || 'จุดนัดรับ',
      postedAt: new Date().toISOString(),
      image: imageBase64,
      sold: false
    };

    previewBox.replaceChildren(createProductCard(mockProduct, [], 'preview'));
  }

  if (!form.dataset.previewInit) {
    form.dataset.previewInit = 'true';
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);
  }
  updatePreview();

  // F3: Form Validation & Submit Handler
  if (!form.dataset.submitInit) {
    form.dataset.submitInit = 'true';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (errBox) errBox.textContent = '';

      const formData = new FormData(form);
      const title = formData.get('title')?.trim();
      const category = formData.get('category');
      const price = formData.get('price');
      const condition = formData.get('condition');
      const description = formData.get('description')?.trim();
      const meetPoint = formData.get('meetPoint');
      const contact = formData.get('contact')?.trim();

      // ตรวจสอบ Validation เบื้องต้นด้วย JavaScript
      if (!title || title.length < 3) {
        if (errBox) errBox.textContent = 'กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษร';
        return;
      }
      if (!category) {
        if (errBox) errBox.textContent = 'กรุณาเลือกหมวดหมู่สินค้า';
        return;
      }
      if (price === '' || Number(price) < 0) {
        if (errBox) errBox.textContent = 'กรุณากรอกราคาตั้งแต่ 0 บาทขึ้นไป';
        return;
      }
      if (!condition) {
        if (errBox) errBox.textContent = 'กรุณาเลือกสภาพสินค้า';
        return;
      }
      if (!description) {
        if (errBox) errBox.textContent = 'กรุณากรอกรายละเอียดสินค้า';
        return;
      }
      if (!meetPoint) {
        if (errBox) errBox.textContent = 'กรุณาเลือกจุดนัดรับจริงในมหาวิทยาลัย';
        return;
      }
      if (!contact) {
        if (errBox) errBox.textContent = 'กรุณากรอกช่องทางติดต่อ';
        return;
      }

      const newProduct = {
        id: 'usr_' + Date.now(),
        title,
        category,
        price: Number(price),
        condition,
        description,
        meetPoint,
        contact,
        postedAt: new Date().toISOString(),
        sold: false,
        image: imageBase64 || ''
      };

      const myProducts = loadStorage(LOCAL_MINE_KEY, []);
      myProducts.unshift(newProduct);

      if (saveStorage(LOCAL_MINE_KEY, myProducts)) {
        alert('ลงประกาศขายสินค้าสำเร็จ!');
        window.location.href = 'mylistings.html';
      }
    });
  }
}

// หน้าที่ 5: mylistings.html (ประกาศของฉัน และรายการที่สนใจ Wishlist F5, F6)
async function renderMyListingsPage() {
  const myGrid = document.querySelector('#my-listings-grid');
  const wishlistGrid = document.querySelector('#wishlist-grid');
  if (!myGrid && !wishlistGrid) return;

  const allProducts = await fetchAllProducts();
  const myProducts = loadStorage(LOCAL_MINE_KEY, []);
  const wishlistIds = loadStorage(LOCAL_WISH_KEY, []);

  // เรนเดอร์ประกาศของฉัน (พร้อมปุ่มจัดการ ขายแล้ว / ลบ)
  if (myGrid) {
    myGrid.replaceChildren();
    if (!myProducts.length) {
      myGrid.innerHTML = '<p class="loading">ยังไม่มีประกาศที่คุณลงขาย</p>';
    } else {
      myProducts.forEach(p => {
        myGrid.appendChild(createProductCard(p, allProducts, 'mine'));
      });
    }
  }

  // เรนเดอร์รายการที่สนใจ (Wishlist F6)
  if (wishlistGrid) {
    const wishProducts = allProducts.filter(p => wishlistIds.includes(p.id));
    wishlistGrid.replaceChildren();
    if (!wishProducts.length) {
      wishlistGrid.innerHTML = '<p class="loading">ยังไม่มีรายการที่สนใจในขณะนี้</p>';
    } else {
      wishProducts.forEach(p => {
        wishlistGrid.appendChild(createProductCard(p, allProducts, 'normal'));
      });
    }
  }
}

// ===== 5. App Initializer =====

document.addEventListener('DOMContentLoaded', () => {
  setupGlobalEvents();
  renderIndexPage();
  renderProductsPage();
  renderDetailPage();
  renderSellPage();
  renderMyListingsPage();
});
