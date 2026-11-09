const JSON_URL = 'Data/products.json';
const LOCAL_MINE_KEY = 'sm-mine';
const LOCAL_WISH_KEY = 'sm-wish';

const escapeHtml = (str) => {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const loadStorage = (key, defaultVal) => {
  try {
    const val = localStorage.getItem(key);
    return val === null ? defaultVal : JSON.parse(val);
  } catch (e) {
    return defaultVal;
  }
};

const saveStorage = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    alert('ไม่สามารถบันทึกข้อมูลได้ (หน่วยความจำเต็ม)');
    return false;
  }
};

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

const formatBaht = (num) => Number(num || 0).toLocaleString('th-TH') + ' บาท';

async function fetchAllProducts() {
  let jsonProducts = [];
  try {
    const res = await fetch(JSON_URL);
    if (res.ok) {
      jsonProducts = await res.json();
    }
  } catch (e) {
    console.warn('ดึงข้อมูลจาก products.json ไม่สำเร็จ:', e);
  }

  const myProducts = loadStorage(LOCAL_MINE_KEY, []);
  
  const combined = [...myProducts, ...jsonProducts];
  return combined.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));
}

function getCategoryAveragePrice(products, category) {
  const list = products.filter(p => p.category === category && p.price > 0);
  if (!list.length) return 0;
  const total = list.reduce((sum, p) => sum + Number(p.price), 0);
  return total / list.length;
}

function createProductCard(product, allProducts, mode = 'normal') {
  const wishlist = loadStorage(LOCAL_WISH_KEY, []);
  const isWishlisted = wishlist.includes(product.id);
  const avgPrice = getCategoryAveragePrice(allProducts, product.category);
  
  const isGoodPrice = !product.sold && product.price > 0 && avgPrice > 0 && product.price < avgPrice;
  const isSold = Boolean(product.sold);

  const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/></svg>";
  const imgSrc = product.image ? escapeHtml(product.image) : placeholderImg;

  const article = document.createElement('article');
  article.className = `product-card ${isSold ? 'sold-out' : ''}`;
  if (isSold) article.style.opacity = '0.65';

  article.innerHTML = `
    <div class="card-img-wrap">
      ${isSold ? '<span class="sold-badge">ขายแล้ว</span>' : ''}
      ${isGoodPrice ? '<span class="badge good-price-badge">ราคาดี</span>' : ''}
      <img src="${imgSrc}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.src='${placeholderImg}'">
      ${mode !== 'preview' ? `
        <button type="button" class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${product.id}" title="${isWishlisted ? 'เอาออกจากรายการที่สนใจ' : 'บันทึกไว้ดูภายหลัง'}">
          ${isWishlisted ? '★' : '☆'}
        </button>
      ` : ''}
    </div>
    <div class="card-body">
      <span class="category-tag">${escapeHtml(product.category)}</span>
      <h3 class="card-title">
        ${mode === 'preview' 
          ? escapeHtml(product.title) 
          : `<a href="product.html?id=${encodeURIComponent(product.id)}">${isSold ? `<del>${escapeHtml(product.title)}</del>` : escapeHtml(product.title)}</a>`
        }
      </h3>
      <p class="card-price">${formatBaht(product.price)} <span class="condition-badge">สภาพ${escapeHtml(product.condition)}</span></p>
      <p class="card-location">📍 ${escapeHtml(product.meetPoint)}</p>
      <p class="card-time">🕒 <time datetime="${escapeHtml(product.postedAt)}">${timeAgo(product.postedAt)}</time></p>
      
      ${mode === 'mine' ? `
        <div class="owner-controls" style="margin-top: 10px; display: flex; gap: 8px;">
          <button type="button" class="btn-sold btn-secondary" data-id="${product.id}">
            ${isSold ? 'ยกเลิกป้ายขายแล้ว' : 'ทำเครื่องหมายขายแล้ว'}
          </button>
          <button type="button" class="btn-delete" data-id="${product.id}">ลบประกาศ</button>
        </div>
      ` : ''}
    </div>
  `;

  return article;
}

function setupGlobalEvents() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('wishlist-btn')) {
      const id = e.target.dataset.id;
      let wishlist = loadStorage(LOCAL_WISH_KEY, []);
      if (wishlist.includes(id)) {
        wishlist = wishlist.filter(x => x !== id);
      } else {
        wishlist.push(id);
      }
      saveStorage(LOCAL_WISH_KEY, wishlist);
      window.location.reload();
    }

    if (e.target.classList.contains('btn-sold')) {
      const id = e.target.dataset.id;
      let myProducts = loadStorage(LOCAL_MINE_KEY, []);
      myProducts = myProducts.map(p => p.id === id ? { ...p, sold: !p.sold } : p);
      saveStorage(LOCAL_MINE_KEY, myProducts);
      window.location.reload();
    }

    if (e.target.classList.contains('btn-delete')) {
      const id = e.target.dataset.id;
      if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบประกาศนี้?')) {
        let myProducts = loadStorage(LOCAL_MINE_KEY, []);
        let wishlist = loadStorage(LOCAL_WISH_KEY, []);
        
        myProducts = myProducts.filter(p => p.id !== id);
        wishlist = wishlist.filter(x => x !== id);
        
        saveStorage(LOCAL_MINE_KEY, myProducts);
        saveStorage(LOCAL_WISH_KEY, wishlist);
        window.location.reload();
      }
    }
  });

  setInterval(() => {
    document.querySelectorAll('time').forEach(t => {
      const datetime = t.getAttribute('datetime');
      if (datetime) t.textContent = timeAgo(datetime);
    });
  }, 30000);
}

async function renderIndexPage() {
  const container = document.querySelector('#latest-products');
  if (!container) return;

  const products = await fetchAllProducts();
  const latestSix = products.slice(0, 6);

  container.replaceChildren();
  if (!latestSix.length) {
    container.innerHTML = '<p class="no-data">ยังไม่มีรายการประกาศ</p>';
    return;
  }

  latestSix.forEach(p => {
    container.appendChild(createProductCard(p, products, 'normal'));
  });
}

async function renderProductsPage() {
  const container = document.querySelector('#product-grid');
  if (!container) return;

  const allProducts = await fetchAllProducts();
  const form = document.querySelector('#filter-form');
  const searchInput = document.querySelector('#search-input');
  const catSelect = document.querySelector('#category-select');
  const condSelect = document.querySelector('#condition-select');
  const minInput = document.querySelector('#min-price');
  const maxInput = document.querySelector('#max-price');
  const sortSelect = document.querySelector('#sort-select');
  const resultCount = document.querySelector('#result-count');

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('category')) {
    catSelect.value = urlParams.get('category');
  }

  function applyFilter() {
    let list = [...allProducts];
    const q = searchInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    const cond = condSelect.value;
    const min = parseFloat(minInput.value) || 0;
    const max = parseFloat(maxInput.value) || Infinity;
    const sort = sortSelect.value;

    if (q) list = list.filter(p => p.title.toLowerCase().includes(q));
    if (cat) list = list.filter(p => p.category === cat);
    if (cond) list = list.filter(p => p.condition === cond);
    list = list.filter(p => p.price >= min && p.price <= max);

    if (sort === 'low') list.sort((a, b) => a.price - b.price);
    else if (sort === 'high') list.sort((a, b) => b.price - a.price);

    if (resultCount) resultCount.textContent = `พบสินค้า ${list.length} รายการ`;

    container.replaceChildren();
    if (!list.length) {
      container.innerHTML = '<p class="no-data">ไม่พบสินค้าตรงตามเงื่อนไขที่ระบุ</p>';
      return;
    }

    list.forEach(p => {
      container.appendChild(createProductCard(p, allProducts, 'normal'));
    });
  }

  if (form) {
    form.addEventListener('input', applyFilter);
    form.addEventListener('reset', () => setTimeout(applyFilter, 10));
  }
  applyFilter();
}

async function renderDetailPage() {
  const container = document.querySelector('#product-detail-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const products = await fetchAllProducts();
  const product = products.find(p => p.id === id);

  if (!product) {
    container.innerHTML = '<p class="no-data">ไม่พบข้อมูลสินค้าชิ้นนี้</p>';
    return;
  }

  const placeholderImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23e2e8f0'/></svg>";
  const imgSrc = product.image ? escapeHtml(product.image) : placeholderImg;

  container.innerHTML = `
    <div class="product-detail-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
      <div class="detail-img">
        <img src="${imgSrc}" alt="${escapeHtml(product.title)}" style="width: 100%; border-radius: 12px; object-fit: cover;" onerror="this.src='${placeholderImg}'">
      </div>
      <div class="detail-info">
        <span class="category-tag">${escapeHtml(product.category)}</span>
        <h1 style="font-size: 1.8rem; margin: 8px 0;">${escapeHtml(product.title)}</h1>
        <p class="card-price" style="font-size: 1.6rem; color: var(--primary); font-weight: bold; margin-bottom: 12px;">
          ${formatBaht(product.price)}
        </p>
        <p><strong>สภาพสินค้า:</strong> สภาพ${escapeHtml(product.condition)}</p>
        <p><strong>จุดนัดรับ:</strong> 📍 ${escapeHtml(product.meetPoint)}</p>
        <p><strong>ช่องทางติดต่อ:</strong> 💬 ${escapeHtml(product.contact)}</p>
        <p><strong>เวลาลงประกาศ:</strong> 🕒 <time datetime="${escapeHtml(product.postedAt)}">${timeAgo(product.postedAt)}</time></p>
        <hr style="margin: 16px 0; border: 0; border-top: 1px solid #e2e8f0;">
        <p><strong>รายละเอียดสินค้า:</strong></p>
        <p style="white-space: pre-line; color: #475569;">${escapeHtml(product.description)}</p>
      </div>
    </div>
  `;
}

function renderSellPage() {
  const form = document.querySelector('#sell-form');
  const previewBox = document.querySelector('#preview-card');
  if (!form || !previewBox) return;

  let imageBase64 = '';
  const imgInput = document.querySelector('#image-file');

  if (imgInput) {
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

  form.addEventListener('input', updatePreview);
  updatePreview();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errorMsg = document.querySelector('#error-message');
    const formData = new FormData(form);

    if (!form.checkValidity()) {
      if (errorMsg) errorMsg.textContent = 'กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน';
      return;
    }

    const newProduct = {
      id: 'p_' + Date.now(),
      title: formData.get('title'),
      category: formData.get('category'),
      price: Number(formData.get('price')),
      condition: formData.get('condition'),
      description: formData.get('description'),
      meetPoint: formData.get('meetPoint'),
      contact: formData.get('contact'),
      postedAt: new Date().toISOString(),
      sold: false,
      image: imageBase64 || 'images/p001.jpg'
    };

    const myProducts = loadStorage(LOCAL_MINE_KEY, []);
    myProducts.unshift(newProduct);
    
    if (saveStorage(LOCAL_MINE_KEY, myProducts)) {
      alert('ลงประกาศขายสินค้าเรียบร้อยแล้ว!');
      window.location.href = 'mylistings.html';
    }
  });
}

async function renderMyListingsPage() {
  const myGrid = document.querySelector('#my-listings-grid');
  const wishGrid = document.querySelector('#wishlist-grid');
  if (!myGrid && !wishGrid) return;

  const allProducts = await fetchAllProducts();
  const myProducts = loadStorage(LOCAL_MINE_KEY, []);
  const wishIds = loadStorage(LOCAL_WISH_KEY, []);

  if (myGrid) {
    myGrid.replaceChildren();
    if (!myProducts.length) {
      myGrid.innerHTML = '<p class="no-data">คุณยังไม่มีประกาศที่ลงขาย</p>';
    } else {
      myProducts.forEach(p => {
        myGrid.appendChild(createProductCard(p, allProducts, 'mine'));
      });
    }
  }

  if (wishGrid) {
    const wishedProducts = allProducts.filter(p => wishIds.includes(p.id));
    wishGrid.replaceChildren();
    if (!wishedProducts.length) {
      wishGrid.innerHTML = '<p class="no-data">ยังไม่มีรายการที่สนใจ</p>';
    } else {
      wishedProducts.forEach(p => {
        wishGrid.appendChild(createProductCard(p, allProducts, 'normal'));
      });
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  setupGlobalEvents();
  renderIndexPage();
  renderProductsPage();
  renderDetailPage();
  renderSellPage();
  renderMyListingsPage();
});
