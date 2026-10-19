// Add this to the top, inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCategories(); // <--- Add this call
});

// Add this function anywhere in seller.js
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const categories = await res.json();
        
        const addSelect = document.getElementById('add_category');
        const editSelect = document.getElementById('edit_category');
        
        const populate = (selectEl) => {
            if (!selectEl) return;
            selectEl.innerHTML = '';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.category_id;
                option.textContent = cat.name;
                selectEl.appendChild(option);
            });
        };

        populate(addSelect);
        populate(editSelect);
    } catch (err) { console.error("Error loading categories", err); }
}

const user = JSON.parse(localStorage.getItem('user'));

// Security Check
if (!user || (user.role !== 'seller' && user.role !== 'admin')) {
    alert("Access Denied: Sellers Only");
    window.location.href = 'index.html';
}

// Display Seller Info
if(document.getElementById('seller-name')) {
    document.getElementById('seller-name').innerText = user.display_name;
    document.getElementById('seller_id').value = user.user_id;
}

// ========================
// 1. ADD PRODUCT LOGIC
// ========================
let addFiles = []; 
const addInput = document.getElementById('add-image-input');
const addPreview = document.getElementById('add-image-preview');

if (addInput) {
    addInput.addEventListener('change', function (e) {
        const files = Array.from(e.target.files);
        // Combine new files with existing ones
        addFiles = addFiles.concat(files);
        
        // Update Preview
        renderPreview(addFiles, addPreview, 'add');
        
        // Update the Input files (Crucial for Form Submit)
        updateInputFiles(addInput, addFiles);
    });
}

function renderPreview(fileArray, container, mode) {
    container.innerHTML = '';
    fileArray.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const div = document.createElement('div');
            div.className = 'preview-box';
            div.innerHTML = `
                <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
                <button type="button" class="remove-img-btn" onclick="removeFile(${index}, '${mode}')">×</button>
            `;
            container.appendChild(div);
        }
        reader.readAsDataURL(file);
    });
}

window.removeFile = function (index, mode) {
    if (mode === 'add') {
        addFiles.splice(index, 1);
        renderPreview(addFiles, addPreview, 'add');
        updateInputFiles(addInput, addFiles);
    } else if (mode === 'editNew') {
        editNewFiles.splice(index, 1);
        renderPreview(editNewFiles, document.getElementById('edit-new-image-preview'), 'editNew');
        updateInputFiles(document.getElementById('edit-new-image-input'), editNewFiles);
    }
};

function updateInputFiles(inputElement, fileArray) {
    const dt = new DataTransfer();
    fileArray.forEach(file => dt.items.add(file));
    inputElement.files = dt.files;
}

// Submit Handler
const addForm = document.getElementById('add-product-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Submitting Add Form..."); // Debug log

        const formData = new FormData(addForm);

        try {
            const res = await fetch('/api/products', { 
                method: 'POST', 
                body: formData 
            });
            const data = await res.json();
            
            if (data.success) {
                alert("✅ Product Added Successfully!");
                addForm.reset();
                addFiles = []; // Clear file array
                addPreview.innerHTML = '';
                loadProducts();
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Server Error. Check console.");
        }
    });
}

// ========================
// 2. LOAD & TABLE LOGIC
// ========================
async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        const products = await res.json();
        const tbody = document.getElementById('product-table-body');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        products.forEach(p => {
            // Handle Image Display
            let imagesHtml = '<span style="color:#999; font-size:0.8rem;">No Image</span>';
            
            if (p.image_url && p.image_url !== 'default.png' && p.image_url !== '') {
                const imgs = p.image_url.split(',');
                imagesHtml = ''; // Reset
                // Show up to 3 images
                imgs.slice(0, 3).forEach(img => {
                    // Force the image tag to render properly
                    imagesHtml += `<img src="/uploads/${img}" class="product-thumb" alt="prod" onerror="this.src='https://via.placeholder.com/50'">`;
                });
                if (imgs.length > 3) {
                    imagesHtml += `<span style="font-size:0.8rem; vertical-align:top; color:#666;"> +${imgs.length - 3}</span>`;
                }
            }

            tbody.innerHTML += `
                <tr>
                    <td>${imagesHtml}</td>
                    <td>${p.name}</td>
                    <td>฿${parseFloat(p.price).toLocaleString()}</td>
                    <td>${p.stock_quantity}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="openEditModal(${p.product_id})">Edit</button>
                        <button class="action-btn delete-btn" onclick="deleteProduct(${p.product_id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) { console.error("Error loading products", err); }
}

window.deleteProduct = async function(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    loadProducts();
};

window.logout = function() {
    localStorage.removeItem('user');
    document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = 'index.html';
};

// ========================
// 3. EDIT LOGIC
// ========================
let editOldImages = []; 
let editNewFiles = []; 

window.openEditModal = async function(id) {
    const res = await fetch(`/api/products/${id}`);
    const p = await res.json();

    document.getElementById('edit_product_id').value = p.product_id;
    document.getElementById('edit_name').value = p.name;
    document.getElementById('edit_price').value = p.price;
    document.getElementById('edit_stock').value = p.stock_quantity;
    document.getElementById('edit_desc').value = p.description;
    document.getElementById('edit_category').value = p.category_id || 1;

    // Load Old Images
    editOldImages = (p.image_url && p.image_url !== 'default.png') ? p.image_url.split(',') : [];
    renderOldImages();

    // Reset New Images
    editNewFiles = [];
    document.getElementById('edit-new-image-preview').innerHTML = '';
    document.getElementById('edit-new-image-input').value = '';

    document.getElementById('editModal').style.display = 'flex';
};

function renderOldImages() {
    const container = document.getElementById('edit-current-images');
    container.innerHTML = '';
    if (editOldImages.length === 0) {
        container.innerHTML = '<span style="font-size:0.8rem; color:#888;">No current images</span>';
        return;
    }
    editOldImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = 'preview-box';
        div.innerHTML = `
            <img src="/uploads/${img}" onerror="this.src='https://via.placeholder.com/80'">
            <button type="button" class="remove-img-btn" onclick="removeOldImage(${index})">×</button>
        `;
        container.appendChild(div);
    });
}

window.removeOldImage = function(index) {
    editOldImages.splice(index, 1);
    renderOldImages();
};

window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

// Edit New Images Input
const editInput = document.getElementById('edit-new-image-input');
if (editInput) {
    editInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        editNewFiles = editNewFiles.concat(files);
        renderPreview(editNewFiles, document.getElementById('edit-new-image-preview'), 'editNew');
        updateInputFiles(editInput, editNewFiles);
    });
}

const editForm = document.getElementById('edit-product-form');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit_product_id').value;
        const formData = new FormData();
        
        formData.append('name', document.getElementById('edit_name').value);
        formData.append('price', document.getElementById('edit_price').value);
        formData.append('stock', document.getElementById('edit_stock').value);
        formData.append('description', document.getElementById('edit_desc').value);
        formData.append('category_id', document.getElementById('edit_category').value);
        formData.append('seller_id', user.user_id);

        // Send remaining old images
        formData.append('kept_images', editOldImages.join(','));

        // Send new files
        editNewFiles.forEach(file => {
            formData.append('product_images', file);
        });

        try {
            const res = await fetch(`/api/products/${id}`, { method: 'PUT', body: formData });
            const data = await res.json();
            if (data.success) {
                alert("✅ Product Updated!");
                closeEditModal();
                loadProducts();
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) { console.error(err); }
    });
}
// ========================
// NEW: LOAD CATEGORIES
// ========================
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const categories = await res.json();

        const addSelect = document.getElementById('add_category');
        const editSelect = document.getElementById('edit_category');

        // Helper function to populate a select element
        const populate = (selectEl) => {
            if (!selectEl) return;
            selectEl.innerHTML = ''; // Clear "Loading..."
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.category_id;
                option.textContent = cat.name;
                selectEl.appendChild(option);
            });
        };

        populate(addSelect);
        populate(editSelect);

    } catch (err) {
        console.error("Error loading categories:", err);
    }
}