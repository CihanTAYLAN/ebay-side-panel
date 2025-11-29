// Product Management JavaScript Module

let products = [];
let categories = [];

// On page load
$(document).ready(function() {
    initializeEventListeners();
    // Load categories first, then products
    loadCategories().then(() => {
        loadProducts();
    });
});

// Initialize event listeners
function initializeEventListeners() {
    // New product button
    $('#addProductBtn').on('click', function() {
        openProductModal();
    });

    // Close modal
    $('.close, #cancelBtn').on('click', function() {
        closeProductModal();
    });

    // Form submit
    $('#productForm').on('submit', function(e) {
        e.preventDefault();
        saveProduct();
    });

    // Close modal when clicking outside
    $(window).on('click', function(e) {
        if ($(e.target).is('#productModal')) {
            closeProductModal();
        }
        // ebayModal listeners are handled in ebay-listing.js
    });
}

// Load categories
function loadCategories() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/api/categories',
            method: 'GET',
            success: function(response) {
                categories = response.data || [];
                populateCategoryDropdown();
                resolve();
            },
            error: function(xhr) {
                console.error('Categories could not be loaded:', xhr);
                reject(xhr);
            }
        });
    });
}

// Populate category dropdown
function populateCategoryDropdown() {
    const dropdown = $('#productCategory');
    dropdown.empty();
    dropdown.append('<option value="">-- Select Category --</option>');
    
    // Keep tree structure and render recursively
    const categoryTree = buildCategoryTree(categories);
    renderCategoryOptions(categoryTree, dropdown, 0);
}

// Render category options recursively
function renderCategoryOptions(nodes, dropdown, level) {
    nodes.forEach(cat => {
        // Indented view using Unicode characters
        const indent = level > 0 ? '│  '.repeat(level - 1) + '├─ ' : '';
        const icon = cat.children && cat.children.length > 0 ? '📁 ' : '📄 ';
        const displayName = indent + icon + cat.category_name;
        
        dropdown.append(`<option value="${cat.id}">${displayName}</option>`);
        
        // Add subcategories
        if (cat.children && cat.children.length > 0) {
            renderCategoryOptions(cat.children, dropdown, level + 1);
        }
    });
}

// Convert categories from tree to flat list - No longer used but kept as backup
function flattenCategories(cats, level = 0, result = []) {
    cats.forEach(cat => {
        result.push({ ...cat, level: level });
        if (cat.children && cat.children.length > 0) {
            flattenCategories(cat.children, level + 1, result);
        }
    });
    return result;
}

// Load products
function loadProducts() {
    $.ajax({
        url: '/api/local-products',
        method: 'GET',
        success: function(response) {
            products = response.data || [];
            renderProductsTable();
            $('#productCount').text(products.length);
        },
        error: function(xhr) {
            showError('Products could not be loaded: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

// Render products table
function renderProductsTable() {
    const tbody = $('#productsTableBody');
    tbody.empty();

    if (products.length === 0) {
        tbody.append('<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500 italic">No products added yet</td></tr>');
        return;
    }

    products.forEach(product => {
        const categoryName = getCategoryName(product.category_id);
        
        // eBay Status with link
        let ebayStatus;
        if (product.ebay_item_id) {
            const ebayUrl = `https://www.ebay.com.au/itm/${product.ebay_item_id}`;
            ebayStatus = `
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Active
                    </span>
                    <a href="${ebayUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-xs" title="View on eBay">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </a>
                </div>
            `;
        } else {
            ebayStatus = '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Not Listed</span>';
        }
        
        const imageHtml = product.image_url 
            ? `<img src="${escapeHtml(product.image_url)}" alt="Product" class="w-12 h-12 object-cover rounded border" onerror="this.src='https://via.placeholder.com/48x48?text=?'">`
            : '<div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">No Image</div>';
        
        const row = `
            <tr data-sku="${product.sku}" class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 border-b"><strong>${escapeHtml(product.sku)}</strong></td>
                <td class="px-4 py-3 border-b">${imageHtml}</td>
                <td class="px-4 py-3 border-b">${escapeHtml(product.title)}</td>
                <td class="px-4 py-3 border-b">${product.price ? product.price.toFixed(2) : '-'}</td>
                <td class="px-4 py-3 border-b">${categoryName}</td>
                <td class="px-4 py-3 border-b">${ebayStatus}</td>
                <td class="px-4 py-3 border-b whitespace-nowrap">
                    <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2 transition" onclick="editProduct('${product.sku}')">Edit</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition" onclick="deleteProduct('${product.sku}')">Delete</button>
                    ${!product.ebay_item_id ? `<button class="list-ebay-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm ml-2 transition" data-sku="${product.sku}">List on eBay AU</button>` : ''}
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

// Get category name
function getCategoryName(categoryId) {
    if (!categoryId) return '<span class="text-gray-400 italic">Uncategorized</span>';
    
    const flatCats = flattenCategories(buildCategoryTree(categories));
    const category = flatCats.find(c => c.id == categoryId);
    return category ? escapeHtml(category.category_name) : '<span class="text-gray-400 italic">Unknown</span>';
}

// Build category tree (copied from categories.js)
function buildCategoryTree(categories) {
    const categoryMap = {};
    const rootCategories = [];

    categories.forEach(cat => {
        categoryMap[cat.id] = { ...cat, children: [] };
    });

    categories.forEach(cat => {
        if (cat.parent_id && categoryMap[cat.parent_id]) {
            categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
        } else {
            rootCategories.push(categoryMap[cat.id]);
        }
    });

    return rootCategories;
}

// Open modal
function openProductModal(product = null) {
    if (product) {
        $('#modalTitle').text('Edit Product');
        $('#productId').val(product.sku);
        $('#productSku').val(product.sku).prop('readonly', true);
        $('#productTitle').val(product.title);
        $('#productPrice').val(product.price);
        $('#productDescription').val(product.description || '');
        $('#productImageUrl').val(product.image_url || '');
        $('#productCategory').val(product.category_id || '');
    } else {
        $('#modalTitle').text('New Product');
        $('#productForm')[0].reset();
        $('#productId').val('');
        $('#productSku').prop('readonly', false);
    }
    
    $('#productModal').removeClass('hidden');
}

// Close modal
function closeProductModal() {
    $('#productModal').addClass('hidden');
    $('#productForm')[0].reset();
}

// Save product
function saveProduct() {
    const isEdit = $('#productId').val() !== '';
    const sku = $('#productSku').val().trim();
    const data = {
        sku: sku,
        title: $('#productTitle').val().trim(),
        price: parseFloat($('#productPrice').val()),
        description: $('#productDescription').val().trim() || null,
        image_url: $('#productImageUrl').val().trim() || null,
        category_id: $('#productCategory').val() || null
    };

    if (!data.sku || !data.title || !data.price) {
        showError('SKU, Title and Price fields are required!');
        return;
    }

    const url = isEdit ? `/api/products/${sku}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';

    $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            showSuccess(isEdit ? 'Product updated!' : 'Product added!');
            closeProductModal();
            loadProducts();
        },
        error: function(xhr) {
            showError('Save failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

// Edit product
function editProduct(sku) {
    const product = products.find(p => p.sku === sku);
    if (product) {
        openProductModal(product);
    }
}

// Delete product
function deleteProduct(sku) {
    const product = products.find(p => p.sku === sku);
    if (!product) return;

    if (confirm(`Are you sure you want to delete the "${product.title}" product?`)) {
        $.ajax({
            url: `/api/products/${sku}`,
            method: 'DELETE',
            success: function(response) {
                showSuccess('Product deleted!');
                loadProducts();
            },
            error: function(xhr) {
                showError('Delete failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
            }
        });
    }
}

// eBay functions removed - moved to ebay-listing.js

// Get category object
function getCategoryObject(categoryId) {
    if (!categoryId) return null;
    const flatCats = flattenCategories(buildCategoryTree(categories));
    return flatCats.find(c => c.id == categoryId);
}

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    alert(message);
}

function showError(message) {
    alert('ERROR: ' + message);
}

function showInfo(message) {
    alert('INFO: ' + message);
}
