$(document).ready(function() {
    loadOrders();

    $('#refreshOrdersBtn').click(function() {
        loadOrders();
    });
});

function loadOrders() {
    const tbody = $('#ordersTableBody');
    tbody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500 italic"><i class="fas fa-spinner fa-spin mr-2"></i>Loading orders...</td></tr>');

    $.ajax({
        url: '/api/ebay-orders',
        method: 'GET',
        success: function(response) {
            if (response.success && response.data && response.data.orders) {
                displayOrders(response.data.orders);
            } else {
                tbody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500 italic">No orders found.</td></tr>');
                $('#orderCount').text(0);
            }
        },
        error: function(xhr) {
            console.error('Order loading error:', xhr);
            let errorMsg = 'An error occurred while loading orders.';
            if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMsg = xhr.responseJSON.error;
            }
            tbody.html(`<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">${errorMsg}</td></tr>`);
        }
    });
}

function displayOrders(orders) {
    const tbody = $('#ordersTableBody');
    tbody.empty();
    
    $('#orderCount').text(orders.length);

    if (orders.length === 0) {
        tbody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500 italic">No orders found.</td></tr>');
        return;
    }

    orders.forEach(order => {
        const orderId = order.orderId;
        const creationDate = new Date(order.creationDate).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const buyer = order.buyer ? order.buyer.username : 'Unknown';
        
        // Fiyat formatlama
        let totalAmount = '-';
        if (order.pricingSummary && order.pricingSummary.total) {
            totalAmount = `${order.pricingSummary.total.value} ${order.pricingSummary.total.currency}`;
        }

        // Durum çevirisi ve renkler
        let status = order.orderFulfillmentStatus || 'UNKNOWN';
        let statusClass = 'bg-gray-100 text-gray-800';
        let statusText = status;

        if (status === 'FULFILLED') {
            statusClass = 'bg-green-100 text-green-800';
            statusText = 'Completed';
        } else if (status === 'NOT_STARTED') {
            statusClass = 'bg-yellow-100 text-yellow-800';
            statusText = 'Not Started';
        } else if (status === 'IN_PROGRESS') {
            statusClass = 'bg-blue-100 text-blue-800';
            statusText = 'In Progress';
        }

        // Payment Status
        let paymentStatus = order.orderPaymentStatus || 'UNKNOWN';
        let paymentIcon = '';
        if (paymentStatus === 'PAID') {
            paymentIcon = '<span class="text-green-600 ml-2" title="Paid"><i class="fas fa-check-circle"></i></span>';
        } else {
            paymentIcon = '<span class="text-red-500 ml-2" title="Unpaid"><i class="fas fa-times-circle"></i></span>';
        }

        const row = `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                    ${orderId}
                    <div class="text-xs text-gray-500 mt-1">Sales Rec: ${order.salesRecordReference || '-'}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">${creationDate}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${buyer}</td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900">
                    ${totalAmount}
                    ${paymentIcon}
                </td>
                <td class="px-4 py-3 text-sm">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm">
                    <button onclick="showOrderDetails('${orderId}')" class="text-blue-600 hover:text-blue-800 font-medium">
                        Details
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

// Modal Controls
$('.close-modal').click(function() {
    $('#orderModal').addClass('hidden');
});

// Close modal when clicking outside
$('#orderModal').click(function(e) {
    if (e.target === this) {
        $(this).addClass('hidden');
    }
});

// Show Order Details
window.showOrderDetails = function(orderId) {
    $('#orderModal').removeClass('hidden');
    
    // Reset modal content to loading state
    $('#modalContent').html(`
        <div class="text-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-600">Loading details...</p>
        </div>
    `);

    $.ajax({
        url: `/api/ebay-orders/${orderId}`,
        method: 'GET',
        success: function(response) {
            if (response.success && response.data) {
                renderOrderDetails(response.data);
            } else {
                $('#modalContent').html('<p class="text-red-500 text-center">Order details not found.</p>');
            }
        },
        error: function(xhr) {
            console.error('Detail loading error:', xhr);
            $('#modalContent').html('<p class="text-red-500 text-center">An error occurred while loading details.</p>');
        }
    });
};

function renderOrderDetails(order) {
    const creationDate = new Date(order.creationDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const lastModifiedDate = new Date(order.lastModifiedDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Shipping Address & Fulfillment Instructions
    let fulfillmentHtml = '';
    if (order.fulfillmentStartInstructions && order.fulfillmentStartInstructions.length > 0) {
        order.fulfillmentStartInstructions.forEach((instruction, index) => {
            const shipTo = instruction.shippingStep.shipTo;
            let addressHtml = '<p class="text-gray-500 italic">No address information</p>';
            
            if (shipTo) {
                addressHtml = `
                    <p class="font-semibold text-gray-800">${shipTo.fullName || ''}</p>
                    <p>${shipTo.contactAddress.addressLine1 || ''}</p>
                    ${shipTo.contactAddress.addressLine2 ? `<p>${shipTo.contactAddress.addressLine2}</p>` : ''}
                    <p>${shipTo.contactAddress.city || ''}, ${shipTo.contactAddress.stateOrProvince || ''} ${shipTo.contactAddress.postalCode || ''}</p>
                    <p>${shipTo.contactAddress.countryCode || ''}</p>
                    <p class="mt-2 text-sm text-gray-600"><i class="fas fa-phone mr-1"></i> ${shipTo.primaryPhone ? shipTo.primaryPhone.phoneNumber : '-'}</p>
                    <p class="text-sm text-gray-600"><i class="fas fa-envelope mr-1"></i> ${shipTo.email || '-'}</p>
                `;
            }

            fulfillmentHtml += `
                <div class="mb-4 pb-4 border-b border-blue-200 last:border-0 last:pb-0">
                    ${order.fulfillmentStartInstructions.length > 1 ? `<h4 class="font-semibold text-blue-800 mb-2">Package ${index + 1}</h4>` : ''}
                    <div class="text-sm text-gray-700 mb-3">
                        ${addressHtml}
                    </div>
                    <div class="text-xs text-blue-800 bg-blue-100 p-2 rounded">
                        <p><strong>Shipping Service:</strong> ${instruction.shippingStep.shippingServiceCode || '-'}</p>
                        <p><strong>Carrier:</strong> ${instruction.shippingStep.shippingCarrierCode || '-'}</p>
                        <p><strong>Estimated Delivery:</strong> ${new Date(instruction.minEstimatedDeliveryDate).toLocaleDateString('en-US')} - ${new Date(instruction.maxEstimatedDeliveryDate).toLocaleDateString('en-US')}</p>
                        <p><strong>eBay Supported:</strong> ${instruction.ebaySupportedFulfillment ? 'Yes' : 'No'}</p>
                        <p><strong>Type:</strong> ${instruction.fulfillmentInstructionsType || '-'}</p>
                    </div>
                </div>
            `;
        });
    } else {
        fulfillmentHtml = '<p class="text-gray-500 italic">No delivery information found.</p>';
    }

    // Fulfillment Hrefs
    let fulfillmentHrefsHtml = '';
    if (order.fulfillmentHrefs && order.fulfillmentHrefs.length > 0) {
        fulfillmentHrefsHtml = `
            <div class="mt-3 pt-2 border-t border-blue-200 text-xs text-blue-800">
                <p><strong>Fulfillment Links:</strong></p>
                ${order.fulfillmentHrefs.map(href => `<a href="${href}" target="_blank" class="text-blue-600 hover:underline break-all">${href}</a>`).join('<br>')}
            </div>
        `;
    }

    // Buyer Info (Registration & Tax)
    let buyerInfoHtml = '';
    if (order.buyer) {
        if (order.buyer.taxAddress) {
            const ta = order.buyer.taxAddress;
            buyerInfoHtml += `
                <div class="mt-3 pt-2 border-t border-blue-200 text-xs text-blue-800">
                    <p><strong>Buyer Tax Address:</strong></p>
                    <p>${ta.stateOrProvince || ''} ${ta.postalCode || ''}, ${ta.countryCode || ''}</p>
                </div>
            `;
        }
        if (order.buyer.buyerRegistrationAddress) {
            const ba = order.buyer.buyerRegistrationAddress;
            buyerInfoHtml += `
                <div class="mt-3 pt-2 border-t border-blue-200 text-xs text-blue-800">
                    <p><strong>Registered Address:</strong></p>
                    <p>${ba.fullName || ''}</p>
                    <p>${ba.contactAddress ? ba.contactAddress.city : ''}, ${ba.contactAddress ? ba.contactAddress.countryCode : ''}</p>
                    <p>${ba.email || ''}</p>
                </div>
            `;
        }
    }

    // Line Items
    let lineItemsHtml = '';
    if (order.lineItems) {
        lineItemsHtml = order.lineItems.map(item => {
            console.log(item);
            
            const imageUrl = item.image ? item.image.imageUrl : 'https://placehold.co/600x400';
            const itemLocation = item.itemLocation ? `${item.itemLocation.location}, ${item.itemLocation.countryCode}` : '-';
            
            // Taxes & Fees
            let taxesHtml = '';
            if (item.ebayCollectAndRemitTaxes && item.ebayCollectAndRemitTaxes.length > 0) {
                taxesHtml += item.ebayCollectAndRemitTaxes.map(tax => 
                    `<div class="text-xs text-gray-500">eBay Tax (${tax.taxType}): ${tax.amount.value} ${tax.amount.currency}</div>`
                ).join('');
            }
            if (item.taxes && item.taxes.length > 0) {
                taxesHtml += item.taxes.map(tax => 
                    `<div class="text-xs text-gray-500">Tax: ${tax.amount.value} ${tax.amount.currency}</div>`
                ).join('');
            }

            // Promotions
            let promoHtml = '';
            if (item.appliedPromotions && item.appliedPromotions.length > 0) {
                promoHtml = item.appliedPromotions.map(p => 
                    `<div class="text-xs text-green-600">Promo: ${p.description}</div>`
                ).join('');
            }

            // Fulfillment Instructions
            let fulfillHtml = '';
            if (item.lineItemFulfillmentInstructions) {
                const fi = item.lineItemFulfillmentInstructions;
                fulfillHtml = `
                    <div class="text-xs text-gray-500 mt-1">
                        ${fi.shipByDate ? `<div>Ship By: ${new Date(fi.shipByDate).toLocaleDateString('en-US')}</div>` : ''}
                        ${fi.maxEstimatedDeliveryDate ? `<div>Est. Delivery: ${new Date(fi.maxEstimatedDeliveryDate).toLocaleDateString('en-US')}</div>` : ''}
                        ${fi.guaranteedDelivery ? '<div class="text-green-600 font-bold">Guaranteed Delivery</div>' : ''}
                    </div>
                `;
            }

            return `
                <div class="flex items-start gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <img src="${imageUrl}" alt="Product" class="w-20 h-20 object-cover rounded border border-gray-200">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-800 text-sm mb-1">${item.title}</h4>
                        <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-2">
                            <div>SKU: ${item.sku || '-'}</div>
                            <div>Item ID: ${item.lineItemId}</div>
                            <div>Legacy ID: ${item.legacyItemId || '-'}</div>
                            <div>Location: ${itemLocation}</div>
                            <div>Format: ${item.soldFormat || '-'}</div>
                            <div>Marketplace: ${item.listingMarketplaceId || '-'}</div>
                            <div>Purchase Market: ${item.purchaseMarketplaceId || '-'}</div>
                            <div>Status: ${item.lineItemFulfillmentStatus || '-'}</div>
                            ${item.properties && item.properties.buyerProtection ? '<div class="text-green-600">Buyer Protection: Yes</div>' : ''}
                        </div>
                        ${taxesHtml}
                        ${promoHtml}
                        ${fulfillHtml}
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-sm text-gray-600">Quantity: <strong>${item.quantity}</strong></span>
                            <div class="text-right">
                                <span class="font-semibold text-gray-900 block">${item.lineItemCost.value} ${item.lineItemCost.currency}</span>
                                ${item.deliveryCost && item.deliveryCost.shippingCost ? 
                                    `<span class="text-xs text-gray-500">+ Shipping: ${item.deliveryCost.shippingCost.value} ${item.deliveryCost.shippingCost.currency}</span>` : ''}
                                ${item.total ? `<div class="text-xs font-bold text-gray-700 mt-1">Total: ${item.total.value} ${item.total.currency}</div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Pricing Summary
    const pricing = order.pricingSummary;
    const paymentSummary = order.paymentSummary || {};
    
    // Payments List
    let paymentsHtml = '';
    if (paymentSummary.payments && paymentSummary.payments.length > 0) {
        paymentsHtml = '<div class="mt-3 pt-2 border-t border-gray-200"><p class="text-xs font-semibold text-gray-700 mb-1">Payments:</p>';
        paymentSummary.payments.forEach(payment => {
            paymentsHtml += `
                <div class="text-xs text-gray-600 mb-1">
                    ${new Date(payment.paymentDate).toLocaleDateString('en-US')} - 
                    ${payment.paymentMethod} (${payment.paymentStatus}) - 
                    ${payment.amount.value} ${payment.amount.currency}
                    ${payment.paymentReferenceId ? `<br>Ref: ${payment.paymentReferenceId}` : ''}
                </div>
            `;
            
            // Holds
            if (payment.paymentHolds && payment.paymentHolds.length > 0) {
                payment.paymentHolds.forEach(hold => {
                    paymentsHtml += `
                        <div class="bg-yellow-50 text-yellow-800 p-2 rounded text-xs mt-1 mb-1">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            <strong>Payment On Hold:</strong> ${hold.holdReason} (${hold.holdAmount.value} ${hold.holdAmount.currency})
                            <br>Estimated Release: ${new Date(hold.releaseDate).toLocaleDateString('en-US')}
                        </div>
                    `;
                });
            }
        });
        paymentsHtml += '</div>';
    }

    // Refunds
    if (paymentSummary.refunds && paymentSummary.refunds.length > 0) {
        paymentsHtml += '<div class="mt-3 pt-2 border-t border-red-100"><p class="text-xs font-semibold text-red-700 mb-1">Refunds:</p>';
        paymentSummary.refunds.forEach(refund => {
            paymentsHtml += `
                <div class="text-xs text-red-600 mb-1">
                    ${new Date(refund.refundDate).toLocaleDateString('en-US')} - 
                    ${refund.refundStatus} - 
                    ${refund.amount.value} ${refund.amount.currency}
                </div>
            `;
        });
        paymentsHtml += '</div>';
    }

    // Cancel Status
    let cancelStatusHtml = '';
    if (order.cancelStatus) {
        if (order.cancelStatus.cancelState !== 'NONE_REQUESTED') {
            cancelStatusHtml = `
                <div class="bg-red-50 text-red-800 p-3 rounded mb-4">
                    <strong>Cancel Status:</strong> ${order.cancelStatus.cancelState}
                </div>
            `;
        }
        if (order.cancelStatus.cancelRequests && order.cancelStatus.cancelRequests.length > 0) {
            cancelStatusHtml += order.cancelStatus.cancelRequests.map(req => `
                <div class="bg-red-50 text-red-800 p-3 rounded mb-4 text-sm">
                    <strong>Cancel Request:</strong> ${req.cancelRequestId} (${req.cancelRequestState})<br>
                    Date: ${new Date(req.cancelRequestDate).toLocaleDateString('en-US')}
                </div>
            `).join('');
        }
    }

    const html = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left Column: Order Information -->
            <div class="space-y-6">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">Order Summary</h3>
                    ${cancelStatusHtml}
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-600">Order ID:</span> <span class="font-medium select-all">${order.orderId}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Legacy ID:</span> <span class="font-medium select-all">${order.legacyOrderId}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Sales Record:</span> <span class="font-medium">${order.salesRecordReference || '-'}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Created:</span> <span class="font-medium">${creationDate}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Last Updated:</span> <span class="font-medium">${lastModifiedDate}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Status:</span> <span class="font-medium px-2 py-0.5 rounded bg-gray-200">${order.orderFulfillmentStatus}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Payment Status:</span> <span class="font-medium px-2 py-0.5 rounded ${order.orderPaymentStatus === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${order.orderPaymentStatus}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Buyer:</span> <span class="font-medium">${order.buyer.username}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Seller ID:</span> <span class="font-medium">${order.sellerId}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">eBay Collect Tax:</span> <span class="font-medium">${order.ebayCollectAndRemitTax ? 'Yes' : 'No'}</span></div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-gray-200">
                        <a href="https://www.ebay.com/sh/ord/details?orderid=${order.legacyOrderId}" target="_blank" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium">
                            <i class="fas fa-external-link-alt"></i>
                            View on eBay
                        </a>
                    </div>
                </div>

                <div class="bg-blue-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-blue-900 mb-3 border-b border-blue-200 pb-2">Delivery Information</h3>
                    ${fulfillmentHtml}
                    ${buyerInfoHtml}
                    ${fulfillmentHrefsHtml}
                </div>
            </div>

            <!-- Right Column: Payment and Products -->
            <div class="space-y-6">
                <div class="bg-white border border-gray-200 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Products (${order.lineItems ? order.lineItems.length : 0})</h3>
                    <div class="space-y-4 max-h-80 overflow-y-auto pr-2">
                        ${lineItemsHtml}
                    </div>
                </div>

                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">Payment Details</h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-600">Subtotal:</span> <span>${pricing.priceSubtotal.value} ${pricing.priceSubtotal.currency}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Shipping:</span> <span>${pricing.deliveryCost ? pricing.deliveryCost.value : '0.00'} ${pricing.total.currency}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Tax:</span> <span>${pricing.tax ? pricing.tax.value : '0.00'} ${pricing.total.currency}</span></div>
                        
                        ${order.totalMarketplaceFee ? `
                        <div class="flex justify-between text-red-600"><span class="text-gray-600">Marketplace Fee:</span> <span>-${order.totalMarketplaceFee.value} ${order.totalMarketplaceFee.currency}</span></div>
                        ` : ''}
                        
                        ${order.totalFeeBasisAmount ? `
                        <div class="flex justify-between text-gray-500 text-xs"><span class="text-gray-500">Fee Basis:</span> <span>${order.totalFeeBasisAmount.value} ${order.totalFeeBasisAmount.currency}</span></div>
                        ` : ''}

                        <div class="flex justify-between border-t border-gray-300 pt-2 mt-2 font-bold text-lg">
                            <span>Total:</span> <span>${pricing.total.value} ${pricing.total.currency}</span>
                        </div>
                        
                        ${paymentSummary.totalDueSeller ? `
                        <div class="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                            <div class="flex justify-between"><span>Amount Due to Seller:</span> <span>${paymentSummary.totalDueSeller.value} ${paymentSummary.totalDueSeller.currency}</span></div>
                            ${paymentSummary.totalDueSeller.convertedFromValue ? `<div class="text-right text-gray-400">(${paymentSummary.totalDueSeller.convertedFromValue} ${paymentSummary.totalDueSeller.convertedFromCurrency})</div>` : ''}
                        </div>
                        ` : ''}
                    </div>
                    ${paymentsHtml}
                </div>
            </div>
        </div>
    `;

    $('#modalContent').html(html);
}
