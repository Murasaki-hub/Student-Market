// ==========================================
// 1. Initial State & Data Fetching (F1 & T7)
// ==========================================
const LOCAL_STORAGE_KEY = 'student_market_products';
const WISHLIST_KEY = 'student_market_wishlist';

let allProducts = [];
let wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];

// ดึงข้อมูลทั้ง JSON และ LocalStorage รวมเป็น Array เดียว
async function loadProducts() {
  try {
    const res = await fetch('data/products.json');
    const jsonProducts = await res.json();
    const localProducts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
    
    // รวมรายการ JSON + LocalStorage โดยไม่ให้ ID ซ้ำกัน
    allProducts = [...localProducts, ...jsonProducts.filter(jp => !localProducts.some(lp => lp.id === jp.id))];
    
    // เรียกใช้ Render ตามแต่ละหน้าเว็บ
    initCurrentPage();
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการโหลดข้อมูล JSON:", err);
    // หาก fetch ไม่สำเร็จ ใช้งานข้อมูลจาก LocalStorage
    allProducts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
    initCurrentPage();
  }
}

// เช็คหน้าปัจจุบันเพื่อ Render DOM
function initCurrentPage() {
  const path = window.location.pathname;
  
  if (path.includes('index.html') || path.endsWith('/')) {
    renderGrid(allProducts.slice(0, 4), 'latest-products-grid');
  } else if (path.includes('products.html')) {
    renderProductsPage();
  } else if (path.includes('product.html')) {
    renderProductDetailPage();
  } else if (path.includes('sell.html')) {
    setupSellForm();
  } else if (path.includes('mylistings.html')) {
    renderMyListingsPage();
  }
}

// ==========================================
// 2. Render Functions & DOM Generation
// ==========================================
function renderGrid(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = `<p class="no-data">ไม่พบรายการสินค้า</p>`;
    return;
  }

  products.forEach(item => {
    const isFav = wishlist.includes(item.id);
    const card = document.createElement('article');
    card.className = `product-card ${item.sold ? 'sold-out' : ''}`;
    
    card.innerHTML = `
      ${item.sold ? '<div class="badge-sold">ขายแล้ว</div>' : ''}
      <div class="card-img-box">
        <img src="${item.image}" alt="${item.title}">
        <span class="card-tag">${item.category}</span>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}" aria-label="เก็บไว้ในรายการโปรด">
          ${isFav ? '★' : '☆'}
        </button>
      </div>
      <div class="card-body">
        <h3 class="card-title">${item.title}</h3>
        <div class="card-price-row">
          <span class="card-price">${item.price.toLocaleString()} บาท</span>
          <span class="card-condition">สภาพ${item.condition}</span>
        </div>
        <p class="card-location">📍 ${item.meetPoint}</p>
      </div>
    `;

    // Click Card to View Detail
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-btn')) return; // เว้นปุ่มกดกดหัวใจ
      window.location.href = `product.html?id=${item.id}`;
    });

    // Toggle Wishlist Button (F6)
    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlist(item.id);
    });

    container.appendChild(card);
  });
}

// Wishlist Logic (F6)
function toggleWishlist(id) {
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(item => item !== id);
  } else {
    wishlist.push(id);
  }
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  initCurrentPage();
}

// ==========================================
// 3. Products Filter & Search (F2)
// ==========================================
function renderProductsPage() {
  const searchInput = document.getElementById('search-input');
  const catFilter = document.getElementById('category-filter');
  const condFilter = document.getElementById('condition-filter');
  const sortFilter = document.getElementById('sort-filter');

  function filterAndRender() {
    let result = [...allProducts];

    // ค้นตามชื่อ
    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      result = result.filter(p => p.title.toLowerCase().includes(q));
    }
    // กรองหมวดหมู่
    if (catFilter.value !== 'all') {
      result = result.filter(p => p.category === catFilter.value);
    }
    // กรองสภาพ
    if (condFilter.value !== 'all') {
      result = result.filter(p => p.condition === condFilter.value);
    }
    // เรียงลำดับ
    if (sortFilter.value === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortFilter.value === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else {
      // ล่าสุด
      result.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
    }

    renderGrid(result, 'all-products-grid');
  }

  // Bind Event Listeners แบบไม่ใช้ inline (T6)
  searchInput.addEventListener('input', filterAndRender);
  catFilter.addEventListener('change', filterAndRender);
  condFilter.addEventListener('change', filterAndRender);
  sortFilter.addEventListener('change', filterAndRender);

  filterAndRender();
}

// ==========================================
// 4. Single Product Detail Page
// ==========================================
function renderProductDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const container = document.getElementById('product-detail-container');

  const item = allProducts.find(p => p.id === productId);
  if (!item) {
    container.innerHTML = `<p>ไม่พบสินค้าที่คุณต้องการ</p>`;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <img src="${item.image}" alt="${item.title}" style="width: 100%; border-radius: 8px;">
      </div>
      <div>
        <h2>${item.title} ${item.sold ? '<span style="color:red;">(ขายแล้ว)</span>' : ''}</h2>
        <h3 style="color: var(--primary-color); font-size: 1.8rem; margin: 1rem 0;">${item.price.toLocaleString()} บาท</h3>
        <p><strong>หมวดหมู่:</strong> ${item.category}</p>
        <p><strong>สภาพสินค้า:</strong> ${item.condition}</p>
        <p><strong>สถานที่นัดรับ:</strong> ${item.meetPoint}</p>
        <p><strong>ช่องทางติดต่อ:</strong> ${item.contact}</p>
        <hr style="margin: 1rem 0;">
        <p><strong>รายละเอียด:</strong></p>
        <p>${item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
      </div>
    </div>
  `;
}

// ==========================================
// 5. Sell Form & Real-time Preview (F3, F4, Bonus)
// ==========================================
function setupSellForm() {
  const form = document.getElementById('sell-form');
  const titleInput = document.getElementById('title');
  const catInput = document.getElementById('category');
  const priceInput = document.getElementById('price');
  const meetInput = document.getElementById('meetPoint');
  const imageInput = document.getElementById('image-file');

  // Preview elements
  const prevTitle = document.getElementById('prev-title');
  const prevCategory = document.getElementById('prev-category');
  const prevPrice = document.getElementById('prev-price');
  const prevCondition = document.getElementById('prev-condition');
  const prevLocation = document.getElementById('prev-location');
  const prevImg = document.getElementById('prev-img');

  // Real-time Update (F4)
  function updatePreview() {
    prevTitle.textContent = titleInput.value || 'ชื่อสินค้าจะแสดงที่นี่';
    prevCategory.textContent = catInput.value || 'หมวดหมู่';
    prevPrice.textContent = (priceInput.value ? Number(priceInput.value).toLocaleString() : '0') + ' บาท';
    
    const checkedCond = document.querySelector('input[name="condition"]:checked');
    prevCondition.textContent = 'สภาพ ' + (checkedCond ? checkedCond.value : '-');
    prevLocation.textContent = '📍 ' + (meetInput.value || 'จุดนัดรับ...');
  }

  // อ่านไฟล์ภาพด้วย FileReader (ฟีเจอร์เสริมใน PDF)
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { prevImg.src = event.target.result; };
      reader.readAsDataURL(file);
    }
  });

  form.addEventListener('input', updatePreview);

  // Form Submit Validation (F3)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;

    // Reset error text
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');

    if (!titleInput.value.trim()) {
      document.getElementById('err-title').textContent = 'กรุณากรอกชื่อสินค้า';
      isValid = false;
    }
    if (!catInput.value) {
      document.getElementById('err-category').textContent = 'กรุณาเลือกหมวดหมู่';
      isValid = false;
    }
    if (!priceInput.value || Number(priceInput.value) < 0) {
      document.getElementById('err-price').textContent = 'กรุณากรอกราคาให้ถูกต้อง';
      isValid = false;
    }
    const condChecked = document.querySelector('input[name="condition"]:checked');
    if (!condChecked) {
      document.getElementById('err-condition').textContent = 'กรุณาเลือกสภาพสินค้า';
      isValid = false;
    }
    if (!meetInput.value) {
      document.getElementById('err-meetPoint').textContent = 'กรุณาเลือกสถานที่นัดรับ';
      isValid = false;
    }

    if (!isValid) return;

    // บันทึกลง LocalStorage
    const newProduct = {
      id: 'p_' + Date.now(),
      title: titleInput.value.trim(),
      category: catInput.value,
      price: Number(priceInput.value),
      condition: condChecked.value,
      description: document.getElementById('description').value.trim(),
      meetPoint: meetInput.value,
      contact: document.getElementById('contact').value.trim(),
      postedAt: new Date().toISOString(),
      sold: false,
      image: prevImg.src.startsWith('data:') ? prevImg.src : 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500'
    };

    const localData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
    localData.unshift(newProduct);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localData));

    alert('ลงประกาศขายสำเร็จ!');
    window.location.href = 'mylistings.html';
  });
}

// ==========================================
// 6. My Listings & Mark Sold / Delete (F5)
// ==========================================
function renderMyListingsPage() {
  const container = document.getElementById('my-products-grid');
  const wishlistContainer = document.getElementById('wishlist-grid');

  const localData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
  container.innerHTML = '';

  if (localData.length === 0) {
    container.innerHTML = `<p>คุณยังไม่มีรายการประกาศขาย</p>`;
  } else {
    localData.forEach(item => {
      const card = document.createElement('div');
      card.className = `product-card ${item.sold ? 'sold-out' : ''}`;
      card.innerHTML = `
        ${item.sold ? '<div class="badge-sold">ขายแล้ว</div>' : ''}
        <div class="card-img-box">
          <img src="${item.image}" alt="${item.title}">
        </div>
        <div class="card-body">
          <h3>${item.title}</h3>
          <p style="color:var(--primary-color); font-weight:bold;">${item.price.toLocaleString()} บาท</p>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            ${!item.sold ? `<button class="btn btn-primary mark-sold-btn">ทำเป็นขายแล้ว</button>` : ''}
            <button class="btn btn-danger delete-btn">ลบประกาศ</button>
          </div>
        </div>
      `;

      // Mark Sold (F5)
      const markBtn = card.querySelector('.mark-sold-btn');
      if (markBtn) {
        markBtn.addEventListener('click', () => {
          item.sold = true;
          saveAndReloadMyListings(localData);
        });
      }

      // Delete (F5)
      const deleteBtn = card.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => {
        if (confirm(`คุณต้องการลบประกาศ "${item.title}" ใช่หรือไม่?`)) {
          const updated = localData.filter(p => p.id !== item.id);
          saveAndReloadMyListings(updated);
        }
      });

      container.appendChild(card);
    });
  }

  // Render Wishlist items
  const favItems = allProducts.filter(p => wishlist.includes(p.id));
  renderGrid(favItems, 'wishlist-grid');
}

function saveAndReloadMyListings(data) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  location.reload();
}

// โหลดข้อมูลเริ่มต้นเมื่อเปิดเว็บ
document.addEventListener('DOMContentLoaded', loadProducts);
