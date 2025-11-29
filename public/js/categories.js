// Category Management JavaScript Module

let categories = [];
let searchTimeout = null;

// On page load
$(document).ready(function() {
    loadCategories();
    initializeEventListeners();
});

// Initialize event listeners
function initializeEventListeners() {
    // New category button
    $('#addCategoryBtn').on('click', function() {
        openCategoryModal();
    });

    // Close modal
    $('.close, #cancelBtn').on('click', function() {
        closeCategoryModal();
    });

    // Form submit
    $('#categoryForm').on('submit', function(e) {
        e.preventDefault();
        saveCategory();
    });

    // eBay search
    $('#ebaySearchInput').on('input', function() {
        const query = $(this).val().trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            $('#ebaySearchResults').addClass('hidden').empty();
            return;
        }

        searchTimeout = setTimeout(() => {
            searchEbayCategories(query);
        }, 500);
    });

    // Close modal when clicking outside
    $(window).on('click', function(e) {
        if ($(e.target).is('#categoryModal')) {
            closeCategoryModal();
        }
    });

    // eBay search in modal
    let modalSearchTimeout = null;
    $('#ebaySearchModal').on('input', function() {
        const query = $(this).val().trim();
        
        clearTimeout(modalSearchTimeout);
        
        if (query.length < 2) {
            $('#ebaySearchModalResults').addClass('hidden').empty();
            return;
        }

        modalSearchTimeout = setTimeout(() => {
            searchEbayCategoriesInModal(query);
        }, 500);
    });

    // Clear eBay category selection
    $('#clearEbayCategory').on('click', function() {
        clearSelectedEbayCategory();
    });
}

// Load categories
function loadCategories() {
    $.ajax({
        url: '/api/categories',
        method: 'GET',
        success: function(response) {
            categories = response.data || [];
            renderCategoriesTable();
        },
        error: function(xhr) {
            showError('Categories could not be loaded: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

// Render categories table (in tree structure)
function renderCategoriesTable() {
    const tbody = $('#categoriesTableBody');
    tbody.empty();

    if (categories.length === 0) {
        tbody.append('<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 italic">No categories added yet</td></tr>');
        return;
    }

    // Organize categories in tree structure
    const categoryTree = buildCategoryTree(categories);
    renderCategoryTree(categoryTree, tbody, 0);
}

// Build category tree
function buildCategoryTree(categories) {
    const categoryMap = {};
    const rootCategories = [];

    // First add all categories to map
    categories.forEach(cat => {
        categoryMap[cat.id] = { ...cat, children: [] };
    });

    // Establish parent-child relationships
    categories.forEach(cat => {
        if (cat.parent_id && categoryMap[cat.parent_id]) {
            categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
        } else {
            rootCategories.push(categoryMap[cat.id]);
        }
    });

    return rootCategories;
}

// Render tree recursively
function renderCategoryTree(nodes, container, level) {
    nodes.forEach(category => {
        const indent = '&nbsp;'.repeat(level * 4);
        const icon = category.children && category.children.length > 0 ? '📁' : '📄';
        
        const row = `
            <tr data-id="${category.id}" class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 border-b">
                    ${indent}${icon} <strong>${escapeHtml(category.category_name)}</strong>
                </td>
                <td class="px-4 py-3 border-b">${category.ebay_category_id || '-'}</td>
                <td class="px-4 py-3 border-b whitespace-nowrap">
                    <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2 transition" onclick="editCategory(${category.id})">Edit</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition" onclick="deleteCategory(${category.id})">Delete</button>
                </td>
            </tr>
        `;
        container.append(row);

        // Render subcategories
        if (category.children && category.children.length > 0) {
            renderCategoryTree(category.children, container, level + 1);
        }
    });
}

// Search for category on eBay
function searchEbayCategories(query) {
    $('#ebaySearchResults').html('<div class="p-4 text-center text-gray-600">Searching...</div>').removeClass('hidden');

    $.ajax({
        url: '/api/ebay/categories/search',
        method: 'GET',
        data: { q: query },
        success: function(response) {
            renderEbaySearchResults(response.data || []);
        },
        error: function(xhr) {
            $('#ebaySearchResults').html(
                '<div class="p-4 text-center text-red-600 text-sm">Search failed: ' + 
                (xhr.responseJSON?.error || 'Bilinmeyen hata') + 
                '</div>'
            );
        }
    });
}

// Render eBay search results
function renderEbaySearchResults(results) {
    const container = $('#ebaySearchResults');
    container.empty();

    if (results.length === 0) {
        container.html('<div class="p-4 text-center text-gray-500 italic">No results found</div>');
        return;
    }

    results.forEach(result => {
        const categoryPath = result.category?.categoryTreeNodeAncestors
            ? result.category.categoryTreeNodeAncestors.map(a => a.categoryName).join(' > ') + ' > ' + result.category.categoryName
            : result.category.categoryName;

        const item = $(`
            <div class="p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                <div class="font-semibold text-gray-800 mb-1">${escapeHtml(result.category.categoryName)}</div>
                <div class="text-sm text-gray-600 mb-1">${escapeHtml(categoryPath)}</div>
                <div class="text-xs text-gray-500">ID: ${result.category.categoryId}</div>
            </div>
        `);

        item.on('click', function() {
            importFromEbay(result.category);
        });

        container.append(item);
    });

    container.removeClass('hidden');
}

// Search for category on eBay in modal
function searchEbayCategoriesInModal(query) {
    $('#ebaySearchModalResults').html('<div class="p-4 text-center text-gray-600">Searching...</div>').removeClass('hidden');

    $.ajax({
        url: '/api/ebay/categories/search',
        method: 'GET',
        data: { q: query },
        success: function(response) {
            renderEbaySearchResultsInModal(response.data || []);
        },
        error: function(xhr) {
            $('#ebaySearchModalResults').html(
                '<div class="p-4 text-center text-red-600 text-sm">Search failed: ' + 
                (xhr.responseJSON?.error || 'Bilinmeyen hata') + 
                '</div>'
            );
        }
    });
}

// Render eBay search results in modal
function renderEbaySearchResultsInModal(results) {
    const container = $('#ebaySearchModalResults');
    container.empty();

    if (results.length === 0) {
        container.html('<div class="p-4 text-center text-gray-500 italic">No results found</div>');
        return;
    }

    results.forEach(result => {
        const categoryPath = result.category?.categoryTreeNodeAncestors
            ? result.category.categoryTreeNodeAncestors.map(a => a.categoryName).join(' > ') + ' > ' + result.category.categoryName
            : result.category.categoryName;

        const item = $(`
            <div class="p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                <div class="font-semibold text-gray-800 mb-1">${escapeHtml(result.category.categoryName)}</div>
                <div class="text-sm text-gray-600 mb-1">${escapeHtml(categoryPath)}</div>
                <div class="text-xs text-gray-500">ID: ${result.category.categoryId}</div>
            </div>
        `);

        item.on('click', function() {
            selectEbayCategoryInModal(result.category);
        });

        container.append(item);
    });

    container.removeClass('hidden');
}

// Select eBay category in modal
function selectEbayCategoryInModal(categoryData) {
    $('#ebayCategoryId').val(categoryData.categoryId);
    $('#selectedEbayCategoryName').text(categoryData.categoryName);
    $('#selectedEbayCategoryId').text('eBay ID: ' + categoryData.categoryId);
    $('#selectedEbayCategory').removeClass('hidden');
    $('#ebaySearchModal').val('');
    $('#ebaySearchModalResults').addClass('hidden').empty();
}

// Clear selected eBay category
function clearSelectedEbayCategory() {
    $('#ebayCategoryId').val('');
    $('#selectedEbayCategory').addClass('hidden');
    $('#selectedEbayCategoryName').text('');
    $('#selectedEbayCategoryId').text('');
}

// Import category from eBay
function importFromEbay(categoryData) {
    if (confirm(`"${categoryData.categoryName}" kategorisini eklemek istiyor musunuz?`)) {
        $.ajax({
            url: '/api/categories/import-from-ebay',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ categoryId: categoryData.categoryId }),
            success: function(response) {
                showSuccess('Category added from eBay!');
                $('#ebaySearchInput').val('');
                $('#ebaySearchResults').addClass('hidden').empty();
                loadCategories();
            },
            error: function(xhr) {
                showError('Import failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
            }
        });
    }
}

// Open modal
function openCategoryModal(category = null) {
    // Populate parent category dropdown
    populateParentDropdown(category?.id);
    
    // Clear modal eBay search results
    $('#ebaySearchModal').val('');
    $('#ebaySearchModalResults').addClass('hidden').empty();
    clearSelectedEbayCategory();
    
    if (category) {
        $('#modalTitle').text('Edit Category');
        $('#categoryId').val(category.id);
        $('#categoryName').val(category.category_name);
        $('#parentCategory').val(category.parent_id || '');
        $('#categoryPath').val(category.category_path || '');
        
        // Show eBay category if exists
        if (category.ebay_category_id) {
            $('#ebayCategoryId').val(category.ebay_category_id);
            $('#selectedEbayCategoryName').text(category.category_name);
            $('#selectedEbayCategoryId').text('eBay ID: ' + category.ebay_category_id);
            $('#selectedEbayCategory').removeClass('hidden');
        }
    } else {
        $('#modalTitle').text('New Category');
        $('#categoryForm')[0].reset();
        $('#categoryId').val('');
    }
    
    // Update path when parent changes
    updateCategoryPath();
    
    $('#categoryModal').removeClass('hidden');
}

// Populate parent category dropdown
function populateParentDropdown(excludeId = null) {
    const dropdown = $('#parentCategory');
    dropdown.empty();
    dropdown.append('<option value="">-- Main Category (No Parent) --</option>');
    
    categories.forEach(cat => {
        // Cannot be its own parent
        if (cat.id !== excludeId) {
            const indent = cat.parent_id ? '&nbsp;&nbsp;&nbsp;&nbsp;' : '';
            dropdown.append(`<option value="${cat.id}">${indent}${escapeHtml(cat.category_name)}</option>`);
        }
    });
    
    // Update path when parent changes
    $('#parentCategory').off('change').on('change', updateCategoryPath);
}

// Auto-generate category path
function updateCategoryPath() {
    const parentId = $('#parentCategory').val();
    const categoryName = $('#categoryName').val().trim();
    
    if (!categoryName) {
        $('#categoryPath').val('');
        return;
    }
    
    if (parentId) {
        const parent = categories.find(c => c.id == parentId);
        if (parent) {
            const parentPath = parent.category_path || parent.category_name;
            $('#categoryPath').val(parentPath + ' > ' + categoryName);
        }
    } else {
        $('#categoryPath').val(categoryName);
    }
}

// Update path when category name changes too
$('#categoryName').on('input', updateCategoryPath);

// Close modal
function closeCategoryModal() {
    $('#categoryModal').addClass('hidden');
    $('#categoryForm')[0].reset();
}

// Save category
function saveCategory() {
    const id = $('#categoryId').val();
    const data = {
        category_name: $('#categoryName').val().trim(),
        parent_id: $('#parentCategory').val() || null,
        ebay_category_id: $('#ebayCategoryId').val() || null,
        category_path: $('#categoryPath').val().trim() || null
    };

    if (!data.category_name) {
        showError('Category name is required!');
        return;
    }

    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';

    $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            showSuccess(id ? 'Category updated!' : 'Category added!');
            closeCategoryModal();
            loadCategories();
        },
        error: function(xhr) {
            showError('Save failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

// Edit category
function editCategory(id) {
    const category = categories.find(c => c.id === id);
    if (category) {
        openCategoryModal(category);
    }
}

// Delete category
function deleteCategory(id) {
    const category = categories.find(c => c.id === id);
    if (!category) return;

    if (confirm(`"${category.category_name}" kategorisini silmek istediğinize emin misiniz?`)) {
        $.ajax({
            url: `/api/categories/${id}`,
            method: 'DELETE',
            success: function(response) {
                showSuccess('Category deleted!');
                loadCategories();
            },
            error: function(xhr) {
                showError('Delete failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
            }
        });
    }
}

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    alert(message); // Simple version, toast notification can be added later
}

function showError(message) {
    alert('ERROR: ' + message);
}
