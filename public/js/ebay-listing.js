// eBay Listing Flow Logic

let currentProduct = null;
let selectedCategory = null;
let selectedPolicies = {
    payment: null,
    return: null,
    fulfillment: null
};

$(document).ready(function() {
    // Initialize event listeners
    initEbayListingEvents();
});

function initEbayListingEvents() {
    // "List on eBay" button click (delegated)
    $(document).on('click', '.list-ebay-btn', function() {
        const sku = $(this).data('sku');
        openEbayModal(sku);
    });

    // Close modal buttons
    $(document).on('click', '#ebayModal .close, #cancelEbayBtn', function() {
        closeEbayModal();
    });

    // Close modal on outside click
    $(document).on('click', '#ebayModal', function(e) {
        if ($(e.target).is('#ebayModal')) {
            closeEbayModal();
        }
    });

    // Category Search
    $('#ebayCategorySearch').on('input', debounce(function() {
        const query = $(this).val();
        if (query.length >= 2) {
            searchEbayCategories(query);
        }
    }, 500));

    // Category Selection
    $(document).on('click', '.ebay-category-item', function() {
        const categoryId = $(this).data('id');
        const categoryName = $(this).data('name');
        selectEbayCategory(categoryId, categoryName);
    });

    // Publish Button
    $('#publishEbayBtn').on('click', function() {
        publishToEbay();
    });
}

async function openEbayModal(sku) {
    // Fetch product details
    try {
        const response = await $.get(`/api/local-products`);
        const product = response.data.find(p => p.sku === sku);
        
        if (!product) {
            alert('Product not found');
            return;
        }

        currentProduct = product;
        $('#ebayModal').removeClass('hidden');
        $('#ebayProductDetails').html(`
            <div class="bg-gray-50 p-4 rounded mb-4">
                <h3 class="font-bold text-lg">${product.title}</h3>
                <p class="text-gray-600">SKU: ${product.sku} | Price: ${product.price}</p>
            </div>
            
            <!-- Step 1: Category Selection -->
            <div id="step1-category" class="mb-6">
                <h4 class="font-semibold mb-2">1. Category Selection</h4>
                <div id="manualCategorySearch">
                    <input type="text" id="ebayCategorySearch" placeholder="Search category (e.g: Coin)..." 
                        class="w-full px-3 py-2 border rounded mb-2">
                    <div id="ebayCategoryResults" class="max-h-40 overflow-y-auto border rounded hidden"></div>
                </div>
                <div id="selectedCategoryDisplay" class="hidden text-green-600 font-medium mt-2"></div>
            </div>

            <!-- Step 2: Policies -->
            <div id="step2-policies" class="mb-6 hidden">
                <h4 class="font-semibold mb-2">2. Policies</h4>
                <div class="grid grid-cols-1 gap-3">
                    <select id="paymentPolicySelect" class="w-full border p-2 rounded"></select>
                    <select id="returnPolicySelect" class="w-full border p-2 rounded"></select>
                    <select id="fulfillmentPolicySelect" class="w-full border p-2 rounded"></select>
                </div>
            </div>

            <!-- Step 3: Aspects -->
            <div id="step3-aspects" class="mb-6 hidden">
                <h4 class="font-semibold mb-2">3. Attributes (Aspects)</h4>
                <div id="aspectsForm" class="space-y-3 max-h-60 overflow-y-auto p-2 border rounded">
                    <p class="text-gray-500 italic">Will load after category is selected...</p>
                </div>
            </div>
        `);

        // Re-attach search event since we replaced HTML
        $('#ebayCategorySearch').on('input', debounce(function() {
            const query = $(this).val();
            if (query.length >= 2) {
                searchEbayCategories(query);
            }
        }, 500));

        // Load Policies
        loadPolicies();

        // Check for existing category mapping
        if (product.category_id) {
            try {
                const catResponse = await $.get(`/api/categories/${product.category_id}`);
                const category = catResponse.data;
                
                if (category && category.ebay_category_id) {
                    console.log('Auto-selecting eBay category:', category.ebay_category_id);
                    // Hide manual search
                    $('#manualCategorySearch').addClass('hidden');
                    // Auto-select
                    selectEbayCategory(category.ebay_category_id, category.category_name);
                }
            } catch (err) {
                console.error('Auto-select category error:', err);
            }
        }

    } catch (error) {
        console.error('Error opening modal:', error);
        alert('Product details could not be retrieved');
    }
}

async function searchEbayCategories(query) {
    try {
        const response = await $.get(`/api/ebay/categories/search?q=${query}`);
        const categories = response.data;
        
        let html = '';
        if (categories.length === 0) {
            html = '<div class="p-2 text-gray-500">No results found</div>';
        } else {
            categories.forEach(cat => {
                // Only allow leaf categories
                if (cat.category.leafCategoryTreeNode) {
                    html += `
                        <div class="ebay-category-item p-2 hover:bg-blue-50 cursor-pointer border-b" 
                             data-id="${cat.category.categoryId}" 
                             data-name="${cat.category.categoryName}">
                            ${cat.category.categoryName} 
                            <span class="text-xs text-gray-400">(${cat.categoryTreeNodeAncestors.map(a => a.categoryName).join(' > ')})</span>
                        </div>
                    `;
                }
            });
        }
        
        $('#ebayCategoryResults').html(html).removeClass('hidden');
    } catch (error) {
        console.error('Category search error:', error);
    }
}

async function selectEbayCategory(categoryId, categoryName) {
    selectedCategory = { id: categoryId, name: categoryName };
    
    $('#ebayCategoryResults').addClass('hidden');
    $('#selectedCategoryDisplay').text(`Selected: ${categoryName} (${categoryId})`).removeClass('hidden');
    $('#step2-policies').removeClass('hidden');
    $('#step3-aspects').removeClass('hidden');
    
    // Fetch Aspects
    loadAspects(categoryId);
}

async function loadPolicies() {
    try {
        const response = await $.get('/api/ebay-policies');
        
        const populateSelect = (id, policies, label) => {
            let html = `<option value="">Select ${label}</option>`;
            policies.forEach(p => {
                html += `<option value="${p[`${label.toLowerCase()}PolicyId`]}">${p.name}</option>`;
            });
            $(`#${id}`).html(html);
        };

        populateSelect('paymentPolicySelect', response.payment, 'Payment');
        populateSelect('returnPolicySelect', response.return, 'Return');
        populateSelect('fulfillmentPolicySelect', response.fulfillment, 'Fulfillment');

    } catch (error) {
        console.error('Error loading policies:', error);
    }
}

async function loadAspects(categoryId) {
    $('#aspectsForm').html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>');
    
    try {
        const response = await $.get(`/api/ebay/aspects/${categoryId}`);
        const aspects = response.aspects;
        
        let html = '';
        aspects.forEach(aspect => {
            const isRequired = aspect.aspectConstraint.aspectRequired;
            const aspectName = aspect.localizedAspectName;
            const values = aspect.aspectValues ? aspect.aspectValues.map(v => v.localizedValue) : [];
            
            html += `
                <div class="aspect-item">
                    <label class="block text-sm font-medium mb-1 ${isRequired ? 'text-red-700 font-bold' : 'text-gray-700'}">
                        ${isRequired ? '★ ' : ''}${aspectName}${isRequired ? ' (REQUIRED)' : ''}
                    </label>
            `;
            
            if (values.length > 0 && values.length < 20) {
                // Select box for limited values
                html += `
                    <select name="aspect_${aspectName}" class="aspect-input w-full border rounded p-2" ${isRequired ? 'required' : ''}>
                        <option value="">Select</option>
                        ${values.map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>
                `;
            } else {
                // Text input for open values or many values
                html += `
                    <input type="text" name="aspect_${aspectName}" class="aspect-input w-full border rounded p-2" 
                        ${isRequired ? 'required' : ''} placeholder="Enter ${aspectName}">
                `;
            }
            
            html += `</div>`;
        });
        
        $('#aspectsForm').html(html);
        
        // Show Publish Button
        $('#sendToEbayBtn').replaceWith(`
            <button type="button" id="publishEbayBtn" 
                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition">
                Publish
            </button>
        `);
        
        // Re-attach click event for the new button
        $('#publishEbayBtn').on('click', publishToEbay);

    } catch (error) {
        console.error('Error loading aspects:', error);
        $('#aspectsForm').html('<div class="text-red-500">Attributes could not be loaded.</div>');
    }
}

async function publishToEbay() {
    if (!currentProduct || !selectedCategory) return;

    // Validate Policies
    const policies = {
        paymentPolicyId: $('#paymentPolicySelect').val(),
        returnPolicyId: $('#returnPolicySelect').val(),
        fulfillmentPolicyId: $('#fulfillmentPolicySelect').val()
    };

    if (!policies.paymentPolicyId || !policies.returnPolicyId || !policies.fulfillmentPolicyId) {
        alert('Please select all policies.');
        return;
    }

    // Collect Aspects
    const aspects = {};
    let isValid = true;
    
    $('.aspect-input').each(function() {
        const name = $(this).attr('name').replace('aspect_', '');
        const value = $(this).val();
        const required = $(this).prop('required');
        
        if (required && !value) {
            isValid = false;
            $(this).addClass('border-red-500');
        } else {
            $(this).removeClass('border-red-500');
            if (value) {
                aspects[name] = [value]; // eBay expects array of strings
            }
        }
    });

    if (!isValid) {
        alert('Please fill in required fields.');
        return;
    }

    // Start Process
    const btn = $('#publishEbayBtn');
    const originalText = btn.text();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Processing...');
    $('#ebayLoading').removeClass('hidden');

    try {
        // Prepare imageUrls from product
        const imageUrls = currentProduct.image_url ? [currentProduct.image_url] : [];

        // 0. Get Merchant Location
        let merchantLocationKey = 'default';
        try {
            const locResponse = await $.get('/api/ebay/locations');
            if (locResponse.locations && locResponse.locations.length > 0) {
                merchantLocationKey = locResponse.locations[0].merchantLocationKey;
                console.log('Using merchant location:', merchantLocationKey);
            }
        } catch (locError) {
            console.warn('Could not fetch locations, using default:', locError);
        }

        // 1. Create/Update Inventory Item
        await $.ajax({
            url: `/api/ebay/inventory/${currentProduct.sku}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                product: {
                    ...currentProduct,
                    aspects: aspects,
                    imageUrls: imageUrls
                }
            })
        });

        // 2. Check for existing offers and create/use
        let offerId;
        try {
            // Check if offer already exists
            const existingOffersResponse = await $.get(`/api/ebay/offers/${currentProduct.sku}`);
            const existingOffers = existingOffersResponse.offers;
            
            if (existingOffers && existingOffers.length > 0) {
                // Use first existing offer
                offerId = existingOffers[0].offerId;
                console.log('Using existing offer:', offerId);
            } else {
                // Create new offer
                const offerResponse = await $.ajax({
                    url: '/api/ebay/offer',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        sku: currentProduct.sku,
                        categoryId: selectedCategory.id,
                        price: currentProduct.price,
                        quantity: 1, // Default
                        listingPolicies: policies,
                        merchantLocationKey: merchantLocationKey
                    })
                });
                offerId = offerResponse.offerId;
                console.log('Created new offer:', offerId);
            }
        } catch (offerError) {
            // If get offers fails (404), create new offer
            console.log('No existing offers found, creating new offer');
            const offerResponse = await $.ajax({
                url: '/api/ebay/offer',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    sku: currentProduct.sku,
                    categoryId: selectedCategory.id,
                    price: currentProduct.price,
                    quantity: 1, // Default
                    listingPolicies: policies,
                    merchantLocationKey: merchantLocationKey
                })
            });
            offerId = offerResponse.offerId;
        }

        // 3. Publish Offer
        const publishResponse = await $.ajax({
            url: `/api/ebay/offer/${offerId}/publish`,
            method: 'POST'
        });

        // 4. Update local product with eBay listing ID
        if (publishResponse.listingId) {
            await $.ajax({
                url: `/api/products/${currentProduct.sku}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify({
                    ...currentProduct,
                    ebay_item_id: publishResponse.listingId
                })
            });
        }

        alert('Product successfully published on eBay AU!');
        $('#ebayModal').addClass('hidden');
        location.reload(); // Refresh to update status

    } catch (error) {
        console.error('Publishing failed:', error);
        alert('Publishing failed: ' + (error.responseJSON?.error || error.message));
    } finally {
        btn.prop('disabled', false).text(originalText);
        $('#ebayLoading').addClass('hidden');
    }
}

function closeEbayModal() {
    $('#ebayModal').addClass('hidden');
    currentProduct = null;
    selectedCategory = null;
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
