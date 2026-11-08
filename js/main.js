/* =========================================================
   Smart Campus / Student Market — Consolidated Master Script (main.js)
   รวมระบบ SPA Navigation, Filter/Search, Storage, Wishlist, Real-time Preview และ FileReader
   ========================================================= */

// Configuration & Storage Keys
const JSON_URL = 'Data/products.json';
const LOCAL_LISTINGS_KEY = 'smart_campus_listings';
const LOCAL_MINE_KEY = 'sm-mine';
const LOCAL_WISH_KEY = 'smart_campus_wishlist';
const LOCAL_MY_PRODUCTS_KEY = 'smart_campus_my_listings';

// Global State
let allProducts = [];
let wishlist = loadStorage(LOCAL_WISH_KEY, []);
let myProducts = loadStorage(LOCAL_MINE_KEY, loadStorage(LOCAL_MY_PRODUCTS_KEY, []));

// ===== 1. Helper Functions & Utilities =====

// Prevent XSS / HTML Escaping
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const sanitizeHTML = escapeHtml;

// Storage Management
function loadStorage(key, defaultVal) {
  try {
    const val = localStorage.getItem(key);
    return val === null ? defaultVal : JSON.parse(val);
  } catch (e) {
    return defaultVal;
  }
}

function saveStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    alert('ไม่สามารถบันทึกข้อมูลได้ (หน่วยความจำเต็ม)');
    return false;
  }
}

// Time Format Helper (กี่นาทีที่แล้ว / กี่ชั่วโมงที่แล้ว)
function timeAgo(isoString) {
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
}

// Format Currency
function formatBaht(num) {
  return Number(num || 0).toLocaleString('th-TH') + ' บาท';
}

// Debounce Handler
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Calculate Category Average Price (ป้ายราคาดี)
function getCategoryAveragePrice(products, category) {
  const filtered = products.filter(p => p.category === category && Number(p.price) > 0);
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((acc, curr) => acc + Number(curr.price), 0);
  return sum / filtered.length;
}

function calculateAveragePrice(category) {
  return getCategoryAveragePrice(allProducts, category);
}

// ===== 2. Data Fetching & State Synchronization =====

async function fetchAllProducts() {
  let jsonProducts = [];
  try {
    const res = await fetch(JSON_URL);
    if (!res.ok) {
      const resAlt = await fetch('data/products.json');
      if (resAlt.ok) jsonProducts = await resAlt.json();
    } else {
      jsonProducts = await res.json();
    }
  } catch (e) {
    console.warn('ไม่สามารถโหลดข้อมูลจาก products.json ได้:', e);
  }

  const localListings = loadStorage(LOCAL_LISTINGS_KEY, []);
  const myLocalProducts = loadStorage(LOCAL_MINE_KEY, loadStorage(LOCAL_MY_PRODUCTS_KEY, []));

  // Merge unique user listings
  const userListingsMap = new Map();
  [...localListings, ...myLocalProducts].forEach(p => userListingsMap.set(p.id, p));
  const userListings = Array.from(userListingsMap.values());

  const combined = [...userListings, ...jsonProducts];
  combined.sort((a, b) => new Date(b.postedAt || b.id || 0) - new Date(a.postedAt || a.id || 0));

  allProducts = combined;
  return combined;
}

async function loadProductsData() {
  await fetchAllProducts();
  renderHomeLatest();
  renderAllProducts(allProducts);
  renderIndexPage();
  renderProductsPage();
  renderMyListingsAndWishlist();
}

// ===== 3. Card Component Generator =====

function createProductCardHTML(product, mode = 'normal') {
  const avgPrice = getCategoryAveragePrice(allProducts, product.category);
  const isGoodDeal = !product.sold && product.status !== 'sold' && Number(product.price) > 0 && avgPrice > 0 && (Number(product.price) < avgPrice * 0.8 || Number(product.price) < avgPrice);
  const isWishlisted = wishlist.includes(product.id);
  const isSold = product.status === 'sold' || Boolean(product.sold);

  const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/></svg>";
  const imgSrc = product.image ? escapeHtml(product.image) : placeholderImg;
  const titleText = product.name || product.title || 'ไม่มีชื่อสินค้า';
  const locationText = product.location || product.meetPoint || 'ไม่ระบุ';
  const postedTime = product.timeAgo || timeAgo(product.postedAt);

  return `
    <div class="product-card ${isSold ? 'sold-out' : ''}" data-id="${escapeHtml(product.id)}" style="${isSold ? 'opacity:0.65;' : ''}">
      <div class="card-img-wrapper card-img-wrap">
        <img src="${imgSrc}" alt="${escapeHtml(titleText)}" loading="lazy" onerror="this.src='${placeholderImg}'">
        <span class="badge category-tag">${escapeHtml(product.category || 'หมวดหมู่')}</span>
        ${isGoodDeal ? '<span class="badge badge-deal good-price-badge">ราคาดี 🔥</span>' : ''}
        ${isSold ? '<span class="badge sold-badge" style="background:var(--danger-color, #ef4444); top:35px">ขายแล้ว</span>' : ''}
        ${mode !== 'preview' ? `
          <button type="button" class="btn-wishlist wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${escapeHtml(product.id)}" onclick="toggleWishlist('${escapeHtml(product.id)}')" title="${isWishlisted ? 'เอาออกจากรายการที่สนใจ' : 'บันทึกไว้ดูภายหลัง'}">
            <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart" style="color:var(--danger-color, #ef4444)"></i>
            ${isWishlisted ? '★' : '☆'}
          </button>
        ` : ''}
      </div>
      <div class="card-body">
        <h4 class="card-title">
          ${mode === 'preview'
            ? escapeHtml(titleText)
            : `<a href="product.html?id=${encodeURIComponent(product.id)}" onclick="if(document.querySelector('#product-detail-modal')){ openProductDetail('${escapeHtml(product.id)}'); return false; }">${isSold ? `<del>${escapeHtml(titleText)}</del>` : escapeHtml(titleText)}</a>`
          }
        </h4>
        <p class="price card-price">${formatBaht(product.price)} ${product.condition ? `<span class="condition-badge">สภาพ ${escapeHtml(product.condition)}</span>` : ''}</p>
        <p class="meta-info card-location"><i class="fa-solid fa-location-dot"></i> 📍 ${escapeHtml(locationText)}</p>
        <p class="meta-info card-time"><i class="fa-solid fa-clock"></i> 🕒 <time datetime="${escapeHtml(product.postedAt || '')}">${postedTime}</time></p>
        
        ${mode === 'mine' ? `
          <div class="owner-controls card-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-direction: column;">
            <button type="button" class="btn-sold btn-secondary" onclick="markAsSold('${escapeHtml(product.id)}')">
              ${isSold ? 'ยกเลิกป้ายขายแล้ว' : 'ทำเครื่องหมายว่าขายแล้ว'}
            </button>
            <button type="button" class="btn-delete" onclick="deleteListing('${escapeHtml(product.id)}')" style="background:var(--danger-color, #ef4444); color:white;">ลบประกาศ</button>
          </div>
        ` : `
          <div class="card-actions">
            <button type="button" class="btn-detail" onclick="openProductDetail('${escapeHtml(product.id)}')">ดูรายละเอียด</button>
          </div>
        `}
      </div>
    </div>
  `;
}

function createProductCard(product, allProductsList = [], mode = 'normal') {
  const article = document.createElement('article');
  article.innerHTML = createProductCardHTML(product, mode);
  return article.firstElementChild;
}

// ===== 4. Navigation & View Switcher (SPA & Multi-page support) =====

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const pageViews = document.querySelectorAll('.page-view');
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (navLinks.length > 0) {
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const pageAttr = link.getAttribute('data-page');
        if (!pageAttr) return;
        e.preventDefault();
        const targetPageId = 'page-' + pageAttr;

        pageViews.forEach(view => view.classList.remove('active'));
        navLinks.forEach(nav => nav.classList.remove('active'));

        const targetView = document.querySelector('#' + targetPageId);
        if (targetView) {
          targetView.classList.add('active');
          link.classList.add('active');
        }
        window.scrollTo(0, 0);

        if (pageAttr === 'mylisted') {
          renderMyListingsAndWishlist();
        }
      });
    });
  }

  if (mobileMenuToggle && navMenu) {
    mobileMenuToggle.addEventListener('click', () => {
      navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }
}

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

// ===== 5. Render Views & Pages =====

// Home / Index
function renderHomeLatest() {
  const grid = document.querySelector('#latest-products-grid') || document.querySelector('#latest-products');
  if (!grid) return;
  const latest = allProducts.slice(0, 6);
  if (latest.length === 0) {
    grid.innerHTML = '<p class="no-data">ยังไม่มีรายการประกาศ</p>';
    return;
  }
  grid.innerHTML = latest.map(p => createProductCardHTML(p)).join('');
}

function renderIndexPage() {
  renderHomeLatest();
}

// All Products Grid & Search/Filter
function renderAllProducts(productsToRender) {
  const grid = document.querySelector('#all-products-grid') || document.querySelector('#product-grid');
  if (!grid) return;
  if (productsToRender.length === 0) {
    grid.innerHTML = '<p class="no-data">ไม่พบสินค้าที่ค้นหา</p>';
    return;
  }
  grid.innerHTML = productsToRender.map(p => createProductCardHTML(p)).join('');
}

function initFilters() {
  const searchInput = document.querySelector('#filter-search') || document.querySelector('#search-input');
  const categorySelect = document.querySelector('#filter-category') || document.querySelector('#category-select');
  const priceRange = document.querySelector('#filter-max-price');
  const priceOutput = document.querySelector('#price-output');
  const sortSelect = document.querySelector('#filter-sort') || document.querySelector('#sort-select');
  const conditionCheckboxes = document.querySelectorAll('input[name="condition"]');
  const condSelect = document.querySelector('#condition-select');
  const minInput = document.querySelector('#min-price');
  const maxInput = document.querySelector('#max-price');
  const filterForm = document.querySelector('#filter-form');
  const resultCount = document.querySelector('#result-count');

  if (!searchInput && !categorySelect && !filterForm) return;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('category') && categorySelect) {
    categorySelect.value = urlParams.get('category');
  }

  function applyFilters() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const category = categorySelect ? categorySelect.value : '';
    const maxPrice = priceRange ? Number(priceRange.value) : (maxInput && maxInput.value ? parseFloat(maxInput.value) : Infinity);
    const minPrice = minInput && minInput.value ? parseFloat(minInput.value) : 0;
    const sortBy = sortSelect ? sortSelect.value : '';
    const singleCond = condSelect ? condSelect.value : '';

    const selectedConditions = Array.from(conditionCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    if (priceOutput && priceRange) {
      priceOutput.textContent = priceRange.value;
    }

    let filtered = allProducts.filter(p => {
      const nameStr = (p.name || p.title || '').toLowerCase();
      const matchesName = !query || nameStr.includes(query);
      const matchesCategory = !category || p.category === category;
      const pPrice = Number(p.price || 0);
      const matchesPrice = pPrice >= minPrice && pPrice <= maxPrice;

      let matchesCondition = true;
      if (selectedConditions.length > 0) {
        matchesCondition = selectedConditions.includes(p.condition);
      } else if (singleCond) {
        matchesCondition = p.condition === singleCond;
      }

      return matchesName && matchesCategory && matchesPrice && matchesCondition;
    });

    if (sortBy === 'price-low' || sortBy === 'low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high' || sortBy === 'high') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      filtered.sort((a, b) => new Date(b.postedAt || b.id || 0) - new Date(a.postedAt || a.id || 0));
    }

    if (resultCount) {
      resultCount.textContent = `พบสินค้า ${filtered.length} รายการ`;
    }

    renderAllProducts(filtered);
  }

  const debouncedFilter = debounce(applyFilters, 300);

  if (searchInput) searchInput.addEventListener('input', debouncedFilter);
  if (categorySelect) categorySelect.addEventListener('change', applyFilters);
  if (priceRange) priceRange.addEventListener('input', applyFilters);
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);
  if (minInput) minInput.addEventListener('input', debouncedFilter);
  if (maxInput) maxInput.addEventListener('input', debouncedFilter);
  if (condSelect) condSelect.addEventListener('change', applyFilters);
  conditionCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));

  if (filterForm) {
    filterForm.addEventListener('input', applyFilters);
    filterForm.addEventListener('reset', () => setTimeout(applyFilters, 10));
  }

  applyFilters();
}

function renderProductsPage() {
  initFilters();
}

// Product Detail Page / Modal
window.openProductDetail = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const modal = document.querySelector('#product-detail-modal');
  const modalBody = document.querySelector('#modal-product-body');
  const detailContainer = document.querySelector('#product-detail-container');

  const titleText = product.name || product.title || 'ไม่มีชื่อสินค้า';
  const locationText = product.location || product.meetPoint || 'ไม่ระบุ';
  const contactText = product.contact || 'ติดต่อผ่านระบบ';
  const descText = product.description || '-';
  const postedTime = product.timeAgo || timeAgo(product.postedAt);

  const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23e2e8f0'/></svg>";
  const imgSrc = product.image ? escapeHtml(product.image) : placeholderImg;

  const detailHTML = `
    <div class="product-detail-layout" style="display: flex; flex-direction: column; gap: 1rem;">
      <img src="${imgSrc}" alt="${escapeHtml(titleText)}" style="width:100%; height:250px; object-fit:cover; border-radius:8px;" onerror="this.src='${placeholderImg}'">
      <h2>${escapeHtml(titleText)}</h2>
      <p class="price card-price" style="font-size:1.5rem; font-weight:bold; color:var(--primary, #2563eb);">${formatBaht(product.price)}</p>
      <p><strong>หมวดหมู่:</strong> ${escapeHtml(product.category)} | <strong>สภาพ:</strong> ${escapeHtml(product.condition)}</p>
      <p><i class="fa-solid fa-location-dot"></i> 📍 จุดนัดรับ: <strong>${escapeHtml(locationText)}</strong></p>
      <p><i class="fa-solid fa-address-book"></i> 💬 ช่องทางติดต่อ: <strong>${escapeHtml(contactText)}</strong></p>
      <p><i class="fa-solid fa-clock"></i> 🕒 เวลาลงประกาศ: <strong>${postedTime}</strong></p>
      <hr style="margin: 12px 0; border: 0; border-top: 1px solid #e2e8f0;">
      <p><strong>รายละเอียดสินค้า:</strong></p>
      <p style="white-space: pre-line;">${escapeHtml(descText)}</p>
    </div>
  `;

  if (modal && modalBody) {
    modalBody.innerHTML = detailHTML;
    modal.showModal();
    const closeBtn = document.querySelector('#close-modal-btn');
    if (closeBtn) closeBtn.onclick = () => modal.close();
  } else if (detailContainer) {
    detailContainer.innerHTML = detailHTML;
  }
};

function renderDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  if (id) {
    openProductDetail(id);
  }
}

// Form & FileReader (Sell Page & Preview)
function initSellForm() {
  const form = document.querySelector('#sell-form');
  const previewBox = document.querySelector('#preview-card');

  if (!form) return;

  const nameInput = document.querySelector('#item-name') || document.querySelector('input[name="title"]');
  const catSelect = document.querySelector('#item-category') || document.querySelector('select[name="category"]');
  const priceInput = document.querySelector('#item-price') || document.querySelector('input[name="price"]');
  const descInput = document.querySelector('#item-desc') || document.querySelector('textarea[name="description"]');
  const charCounter = document.querySelector('#char-counter');
  const locSelect = document.querySelector('#item-location') || document.querySelector('input[name="meetPoint"]');
  const contactInput = document.querySelector('#item-contact') || document.querySelector('input[name="contact"]');
  const imageInput = document.querySelector('#item-image') || document.querySelector('#image-file');

  const prevTitle = document.querySelector('#prev-title');
  const prevPrice = document.querySelector('#prev-price');
  const prevBadge = document.querySelector('#prev-badge');
  const prevLocation = document.querySelector('#prev-location');
  const prevImg = document.querySelector('#prev-img');

  let uploadedImageBase64 = '';

  if (descInput && charCounter) {
    descInput.addEventListener('input', () => {
      charCounter.textContent = descInput.value.length;
    });
  }

  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          uploadedImageBase64 = evt.target.result;
          if (prevImg) prevImg.src = uploadedImageBase64;
          updatePreview();
        };
        reader.readAsDataURL(file);
      } else {
        uploadedImageBase64 = '';
        updatePreview();
      }
    });
  }

  function updatePreview() {
    const formData = new FormData(form);
    const titleVal = nameInput ? nameInput.value : (formData.get('title') || 'ชื่อสินค้าตัวอย่าง');
    const priceVal = priceInput ? priceInput.value : (formData.get('price') || 0);
    const catVal = catSelect ? catSelect.value : (formData.get('category') || 'หมวดหมู่');
    const locVal = locSelect ? locSelect.value : (formData.get('meetPoint') || 'จุดนัดรับ');

    if (prevTitle) prevTitle.textContent = titleVal || 'ชื่อสินค้าตัวอย่าง';
    if (prevPrice) prevPrice.textContent = (priceVal || 0) + ' บาท';
    if (prevBadge) prevBadge.textContent = catVal || 'หมวดหมู่';
    if (prevLocation) prevLocation.textContent = locVal || 'จุดนัดรับ';

    if (previewBox) {
      const mockProduct = {
        id: 'preview',
        name: titleVal,
        title: titleVal,
        category: catVal,
        price: priceVal,
        condition: formData.get('condition') || 'ดี',
        location: locVal,
        meetPoint: locVal,
        postedAt: new Date().toISOString(),
        image: uploadedImageBase64,
        sold: false
      };
      previewBox.replaceChildren(createProductCard(mockProduct, [], 'preview'));
    }
  }

  form.addEventListener('input', updatePreview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;
    const errorMsg = document.querySelector('#error-message');

    if (form.checkValidity && !form.checkValidity()) {
      if (errorMsg) errorMsg.textContent = 'กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน';
      return;
    }

    const titleVal = nameInput ? nameInput.value.trim() : form.querySelector('input[name="title"]')?.value;
    const catVal = catSelect ? catSelect.value : form.querySelector('select[name="category"]')?.value;
    const priceVal = priceInput ? priceInput.value : form.querySelector('input[name="price"]')?.value;
    const locVal = locSelect ? locSelect.value : form.querySelector('input[name="meetPoint"]')?.value;

    const conditionChecked = document.querySelector('input[name="item-condition"]:checked') || document.querySelector('input[name="condition"]:checked');

    if (!titleVal) {
      if (document.querySelector('#err-item-name')) document.querySelector('#err-item-name').textContent = 'กรุณากรอกชื่อสินค้า';
      isValid = false;
    }
    if (!catVal) {
      if (document.querySelector('#err-item-category')) document.querySelector('#err-item-category').textContent = 'กรุณาเลือกหมวดหมู่';
      isValid = false;
    }
    if (!priceVal || priceVal < 0) {
      if (document.querySelector('#err-item-price')) document.querySelector('#err-item-price').textContent = 'กรุณากรอกราคาที่ถูกต้อง';
      isValid = false;
    }

    if (!isValid) return;

    const newProduct = {
      id: 'prod_' + Date.now(),
      name: titleVal,
      title: titleVal,
      category: catVal,
      price: Number(priceVal),
      condition: conditionChecked ? conditionChecked.value : 'ดี',
      description: descInput ? descInput.value : '',
      location: locVal || 'ไม่ระบุ',
      meetPoint: locVal || 'ไม่ระบุ',
      contact: contactInput ? contactInput.value : '',
      image: uploadedImageBase64 || 'https://via.placeholder.com/300x200?text=Student+Item',
      postedAt: new Date().toISOString(),
      timeAgo: 'เมื่อสักครู่',
      status: 'active',
      sold: false
    };

    const localListings = loadStorage(LOCAL_LISTINGS_KEY, []);
    localListings.unshift(newProduct);
    saveStorage(LOCAL_LISTINGS_KEY, localListings);

    myProducts.unshift(newProduct);
    saveStorage(LOCAL_MINE_KEY, myProducts);
    saveStorage(LOCAL_MY_PRODUCTS_KEY, myProducts);

    alert('ลงประกาศสำเร็จ!');
    form.reset();
    if (prevImg) prevImg.src = 'https://via.placeholder.com/300x200?text=No+Image';
    loadProductsData();
  });
}

function renderSellPage() {
  initSellForm();
}

// My Listings & Wishlist
function renderMyListingsAndWishlist() {
  const myGrid = document.querySelector('#my-listings-grid');
  const wishlistGrid = document.querySelector('#wishlist-grid');

  const localListings = loadStorage(LOCAL_LISTINGS_KEY, []);
  const myLocalProducts = loadStorage(LOCAL_MINE_KEY, loadStorage(LOCAL_MY_PRODUCTS_KEY, []));

  const userListingsMap = new Map();
  [...localListings, ...myLocalProducts].forEach(p => userListingsMap.set(p.id, p));
  const combinedMyListings = Array.from(userListingsMap.values());

  if (myGrid) {
    if (combinedMyListings.length === 0) {
      myGrid.innerHTML = '<p class="no-data">คุณยังไม่มีประกาศสินค้า</p>';
    } else {
      myGrid.innerHTML = combinedMyListings.map(p => createProductCardHTML(p, 'mine')).join('');
    }
  }

  if (wishlistGrid) {
    const wishlistedProducts = allProducts.filter(p => wishlist.includes(p.id));
    if (wishlistedProducts.length === 0) {
      wishlistGrid.innerHTML = '<p class="no-data">ยังไม่มีรายการที่สนใจใน Wishlist</p>';
    } else {
      wishlistGrid.innerHTML = wishlistedProducts.map(p => createProductCardHTML(p)).join('');
    }
  }
}

function renderMyListingsPage() {
  renderMyListingsAndWishlist();
}

// ===== 6. Wishlist, Mark Sold, and Delete Actions =====

window.toggleWishlist = function(productId) {
  wishlist = loadStorage(LOCAL_WISH_KEY, []);
  const index = wishlist.indexOf(productId);
  if (index > -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push(productId);
  }
  saveStorage(LOCAL_WISH_KEY, wishlist);
  loadProductsData();
};

window.markAsSold = function(productId) {
  let localListings = loadStorage(LOCAL_LISTINGS_KEY, []);
  let myLocalProducts = loadStorage(LOCAL_MINE_KEY, loadStorage(LOCAL_MY_PRODUCTS_KEY, []));

  const updateItem = p => {
    if (p.id === productId) {
      const nextStatus = (p.status === 'sold' || p.sold) ? 'active' : 'sold';
      return { ...p, status: nextStatus, sold: nextStatus === 'sold' };
    }
    return p;
  };

  localListings = localListings.map(updateItem);
  myLocalProducts = myLocalProducts.map(updateItem);

  saveStorage(LOCAL_LISTINGS_KEY, localListings);
  saveStorage(LOCAL_MINE_KEY, myLocalProducts);
  saveStorage(LOCAL_MY_PRODUCTS_KEY, myLocalProducts);

  loadProductsData();
};

window.deleteListing = function(productId) {
  if (confirm('คุณต้องการลบประกาศนี้ใช่หรือไม่?')) {
    let localListings = loadStorage(LOCAL_LISTINGS_KEY, []);
    let myLocalProducts = loadStorage(LOCAL_MINE_KEY, loadStorage(LOCAL_MY_PRODUCTS_KEY, []));
    wishlist = loadStorage(LOCAL_WISH_KEY, []);

    localListings = localListings.filter(p => p.id !== productId);
    myLocalProducts = myLocalProducts.filter(p => p.id !== productId);
    wishlist = wishlist.filter(id => id !== productId);

    saveStorage(LOCAL_LISTINGS_KEY, localListings);
    saveStorage(LOCAL_MINE_KEY, myLocalProducts);
    saveStorage(LOCAL_MY_PRODUCTS_KEY, myLocalProducts);
    saveStorage(LOCAL_WISH_KEY, wishlist);

    loadProductsData();
  }
};

// Global Event Listener for Wishlist/Delete/Sold buttons
function setupGlobalEvents() {
  document.addEventListener('click', (e) => {
    const target = e.target;

    if (target.classList.contains('wishlist-btn') && target.dataset.id) {
      window.toggleWishlist(target.dataset.id);
    }

    if (target.classList.contains('btn-sold') && target.dataset.id) {
      window.markAsSold(target.dataset.id);
    }

    if (target.classList.contains('btn-delete') && target.dataset.id) {
      window.deleteListing(target.dataset.id);
    }
  });

  // อัปเดตเวลา "กี่นาทีที่แล้ว" ทุก 30 วินาทีแบบ Real-time
  setInterval(() => {
    document.querySelectorAll('time').forEach(t => {
      const datetime = t.getAttribute('datetime');
      if (datetime) t.textContent = timeAgo(datetime);
    });
  }, 30000);
}

// ===== 7. Main Initializer =====

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initTabs();
  setupGlobalEvents();
  loadProductsData();
});
