$(document).ready(function() {
    // List Products
    if ($('#products-table').length) {
        loadProducts();
    }

    function loadProducts() {
        $.getJSON('/api/local-products', function(response) {
            const products = response.data;
            const tbody = $('#products-table tbody');
            tbody.empty();

            products.forEach(product => {
                const row = `
                    <tr>
                        <td>${product.sku}</td>
                        <td>${product.title}</td>
                        <td>${product.price} </td>
                        <td id="status-${product.sku}">Checking...</td>
                        <td>
                            <button class="btn-secondary view-details" data-sku="${product.sku}">Details</button>
                        </td>
                    </tr>
                `;
                tbody.append(row);
                
                // eBay Status Check (Simulation)
                checkEbayStatus(product.sku);
            });
        });
    }

    function checkEbayStatus(sku) {
        $.getJSON(`/api/ebay-status/${sku}`, function(response) {
            const statusCell = $(`#status-${sku}`);
            if (response.listed) {
                statusCell.html('<span style="color:green; font-weight:bold;">eBay Live</span>');
            } else {
                statusCell.html('<span style="color:red;">Not Listed</span> <button class="btn-secondary" style="font-size:0.8em;">Add to eBay</button>');
            }
        }).fail(function() {
            $(`#status-${sku}`).text('Connection Error');
        });
    }

    // Modal Operations
    $(document).on('click', '.view-details', function() {
        const sku = $(this).data('sku');
        // Fetch details (static for now)
        $('#modal-title').text(sku + ' Details');
        $('#modal-body').html('<p>Loading details...</p>');
        $('#product-modal').show();
    });

    $('.close').click(function() {
        $('#product-modal').hide();
    });

    $(window).click(function(event) {
        if ($(event.target).is('#product-modal')) {
            $('#product-modal').hide();
        }
    });
});
