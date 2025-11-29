require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup
const dbPath = path.join(__dirname, 'db', 'app.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

function createTables() {
    // Categories table
    const categoriesSql = `
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ebay_category_id TEXT UNIQUE,
            category_name TEXT NOT NULL,
            category_path TEXT,
            parent_id INTEGER,
            is_leaf BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES categories(id)
        )
    `;
    
    // Products table
    const productsSql = `
        CREATE TABLE IF NOT EXISTS products (
            sku TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            price REAL,
            description TEXT,
            ebay_item_id TEXT,
            category_id INTEGER,
            aspects TEXT,
            image_url TEXT,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    `;
    
    db.run(categoriesSql, (err) => {
        if (err) {
            console.error('Categories table creation error:', err.message);
        } else {
            console.log("'categories' table is ready.");
        }
    });
    
    db.run(productsSql, (err) => {
        if (err) {
            console.error('Products table creation error:', err.message);
        } else {
            console.log("'products' table is ready.");
            
            // Add category_id column to existing table (if it doesn't exist)
            db.all(`PRAGMA table_info(products)`, (err, columns) => {
                if (err) {
                    console.error('Could not get table info:', err);
                    return;
                }
                
                const hasCategoryId = columns.some(col => col.name === 'category_id');
                const hasAspects = columns.some(col => col.name === 'aspects');
                const hasImageUrl = columns.some(col => col.name === 'image_url');
                
                if (!hasCategoryId) {
                    console.log('Adding category_id column...');
                    db.run(`ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)`, (err) => {
                        if (err) console.error('category_id column could not be added:', err);
                        else console.log('category_id column added successfully!');
                    });
                }

                if (!hasAspects) {
                    console.log('Adding aspects column...');
                    db.run(`ALTER TABLE products ADD COLUMN aspects TEXT`, (err) => {
                        if (err) console.error('aspects column could not be added:', err);
                        else console.log('aspects column added successfully!');
                    });
                }

                if (!hasImageUrl) {
                    console.log('Adding image_url column...');
                    db.run(`ALTER TABLE products ADD COLUMN image_url TEXT`, (err) => {
                        if (err) console.error('image_url column could not be added:', err);
                        else console.log('image_url column added successfully!');
                    });
                }
                
                seedData(); // Add test data
            });
        }
    });
}

// Add Test Data (For Development)
function seedData() {
    console.log("Seeding database with LinkedIn-friendly demo data...");
    // Clear existing data
    db.run("DELETE FROM products", [], (err) => {
        if (err) console.error("Error clearing products:", err.message);
    });
    db.run("DELETE FROM categories", [], (err) => {
        if (err) console.error("Error clearing categories:", err.message);
    });

    // Insert demo categories sequentially
    const categorySql = "INSERT INTO categories (category_name, parent_id, is_leaf) VALUES (?, ?, ?)";
    const categories = [
        ['Electronics', null, 0],
        ['Computers & Laptops', 1, 0],
        ['Smartphones & Accessories', 1, 0],
        ['Audio & Headphones', 1, 1],
        ['Wearables', 1, 1],
        ['Computer Accessories', 2, 1]
    ];

    let categoryIndex = 0;
    function insertNextCategory() {
        if (categoryIndex >= categories.length) {
            // All categories inserted, now insert products
            insertProducts();
            return;
        }
        const cat = categories[categoryIndex];
        db.run(categorySql, cat, function(err) {
            if (err) {
                console.error("Category insertion error: " + err.message);
            } else {
                console.log(`Inserted category: ${cat[0]}`);
            }
            categoryIndex++;
            insertNextCategory();
        });
    }
    insertNextCategory();

    function insertProducts() {
        // Insert demo products with category assignments
        const productSql = "INSERT INTO products (sku, title, price, description, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?)";
        const products = [
            ['TECH-001', 'MacBook Pro 16-inch M3', 2499.00, 'Latest MacBook Pro with M3 chip, 16GB RAM, 512GB SSD. Perfect for professional development and content creation.', 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=500', 2],
            ['TECH-002', 'iPhone 15 Pro Max', 1399.00, 'Premium smartphone with Pro camera system, titanium design, and A17 Pro chip. Ideal for photography and mobile productivity.', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500', 3],
            ['TECH-003', 'Sony WH-1000XM5 Headphones', 399.00, 'Industry-leading noise canceling wireless headphones with 30-hour battery life. Essential for remote work and travel.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', 4],
            ['TECH-004', 'Dell XPS 13 Laptop', 1299.00, 'Ultra-portable laptop with Intel Core i7, 16GB RAM, 512GB SSD. Great for business professionals on the go.', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', 2],
            ['TECH-005', 'Apple Watch Series 9', 429.00, 'Advanced smartwatch with health monitoring, GPS, and cellular connectivity. Stay connected and healthy.', 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500', 5],
            ['TECH-006', 'Logitech MX Master 3S Mouse', 99.00, 'Premium wireless mouse with customizable buttons and ultra-fast scrolling. Boost your productivity.', 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500', 6]
        ];

        let productIndex = 0;
        function insertNextProduct() {
            if (productIndex >= products.length) {
                console.log("Demo data seeded successfully.");
                return;
            }
            const prod = products[productIndex];
            db.run(productSql, prod, (err) => {
                if (err) {
                    console.error("Product insertion error: " + err.message);
                } else {
                    console.log(`Inserted product: ${prod[1]}`);
                }
                productIndex++;
                insertNextProduct();
            });
        }
        insertNextProduct();
    }
}

// eBay Config
const EBAY_ENV = process.env.EBAY_ENV || 'SANDBOX'; // SANDBOX or PRODUCTION
const EBAY_AUTH_URL = EBAY_ENV === 'PRODUCTION'
    ? 'https://auth.ebay.com/oauth2/authorize'
    : 'https://auth.sandbox.ebay.com/oauth2/authorize';
const EBAY_API_URL = EBAY_ENV === 'PRODUCTION'
    ? 'https://api.ebay.com'
    : 'https://api.sandbox.ebay.com';
const EBAY_COMMERCE_API_URL = EBAY_ENV === 'PRODUCTION'
    ? 'https://apiz.ebay.com'
    : 'https://apiz.sandbox.ebay.com';

const SCOPES = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
].join(' ');

// Routes

// API: List Local Products
app.get('/api/local-products', (req, res) => {
    const sql = "SELECT * FROM products";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Auth Routes
app.get('/auth/ebay', (req, res) => {
    const baseAuthUrl = process.env.EBAY_ENV === 'PRODUCTION'
        ? 'https://auth.ebay.com/oauth2/authorize'
        : 'https://auth.sandbox.ebay.com/oauth2/authorize';

    const params = new URLSearchParams({
        client_id: process.env.EBAY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.EBAY_RU_NAME,
        scope: SCOPES
    });
    res.redirect(`${baseAuthUrl}?${params.toString()}`);
});

app.get('/auth/ebay/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Authorization code missing');
    }

    try {
        const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post(`${EBAY_API_URL}/identity/v1/oauth2/token`, 
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.EBAY_RU_NAME
            }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`
            }
        });

        // Save token to session
        req.session.ebay_token = response.data.access_token;
        req.session.ebay_refresh_token = response.data.refresh_token;

        // Get user information and save to session
        try {
            const userResponse = await axios.get(`${EBAY_COMMERCE_API_URL}/commerce/identity/v1/user/`, {
                headers: {
                    'Authorization': `Bearer ${response.data.access_token}`,
                    'Content-Type': 'application/json',
                    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU'
                }
            });
            const userData = userResponse.data;
            req.session.ebay_user = userData;
            console.log(userData);

        } catch (userError) {
            console.log('User info fetch failed during auth, will try later:', userError.message);
        }

        res.redirect('/products.html');
    } catch (error) {
        console.error('eBay Auth Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication Failed');
    }
});

// Middleware: eBay Token Check
const requireEbayAuth = (req, res, next) => {
    if (!req.session.ebay_token) {
        return res.status(401).json({ error: 'eBay session required' });
    }
    next();
};

// API: eBay Status Check
app.get('/api/ebay-status/:sku', requireEbayAuth, async (req, res) => {
    const { sku } = req.params;
    try {
        await axios.get(`${EBAY_API_URL}/sell/inventory/v1/inventory_item/${sku}`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ listed: true });
    } catch (error) {
        if (error.response && error.response.status === 404) {
            res.json({ listed: false });
        } else {
            console.error(`Status Check Error (${sku}):`, error.message);
            res.status(500).json({ error: 'eBay API Error' });
        }
    }
});

// API: Send Product to eBay (MOCK - Not Implemented)
app.post('/api/send-to-ebay', requireEbayAuth, async (req, res) => {
    const { sku, title, price, description, category_id } = req.body;
    
    console.log(`MOCK: Send to eBay request received for SKU: ${sku}`);
    console.log(`MOCK: Product details:`, { title, price, description, category_id });
    
    // Mock response - This feature is not implemented yet
    res.json({
        success: false,
        message: 'This feature is not implemented yet. Under development...',
        mock: true,
        product_info: {
            sku: sku,
            title: title,
            price: price,
            description: description,
            category_id: category_id
        }
    });
});

// API: Get Policies
app.get('/api/ebay-policies', requireEbayAuth, async (req, res) => {
    try {
        const [fulfillment, payment, returnPolicy] = await Promise.all([
            axios.get(`${EBAY_API_URL}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_AU`, { headers: { 'Authorization': `Bearer ${req.session.ebay_token}` } }),
            axios.get(`${EBAY_API_URL}/sell/account/v1/payment_policy?marketplace_id=EBAY_AU`, { headers: { 'Authorization': `Bearer ${req.session.ebay_token}` } }),
            axios.get(`${EBAY_API_URL}/sell/account/v1/return_policy?marketplace_id=EBAY_AU`, { headers: { 'Authorization': `Bearer ${req.session.ebay_token}` } })
        ]);

        res.json({
            fulfillment: fulfillment.data.fulfillmentPolicies || [],
            payment: payment.data.paymentPolicies || [],
            return: returnPolicy.data.returnPolicies || []
        });
    } catch (error) {
        console.error('Policy Fetch Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch policies' });
    }
});

// API: Update Policy (Enhanced policy payload handling)
app.put('/api/ebay-policies/:type/:id', requireEbayAuth, async (req, res) => {
    const { type, id } = req.params;
    const { name, description, fulfillmentInstructions, paymentInstructions, returnPolicyDetails } = req.body;
    
    // Type mapping: fulfillment -> fulfillment_policy, etc.
    const typeMap = {
        'fulfillment': 'fulfillment_policy',
        'payment': 'payment_policy',
        'return': 'return_policy'
    };

    if (!typeMap[type]) return res.status(400).json({ error: 'Invalid policy type' });

    try {
        // First get the existing policy
        const getResponse = await axios.get(`${EBAY_API_URL}/sell/account/v1/${typeMap[type]}/${id}`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json'
            }
        });

        // Use existing policy as base
        const currentPolicy = getResponse.data;
        const updatedPolicy = { ...currentPolicy };

        // Update basic fields
        if (name) updatedPolicy.name = name;
        if (description !== undefined) updatedPolicy.description = description;

        // Update policy-specific fields
        switch(type) {
            case 'fulfillment':
                if (fulfillmentInstructions) {
                    updatedPolicy.fulfillmentInstructions = {
                        ...currentPolicy.fulfillmentInstructions,
                        ...fulfillmentInstructions
                    };
                }
                break;
            case 'payment':
                if (paymentInstructions) {
                    updatedPolicy.paymentInstructions = {
                        ...currentPolicy.paymentInstructions,
                        ...paymentInstructions
                    };
                }
                break;
            case 'return':
                if (returnPolicyDetails) {
                    updatedPolicy.returnPolicyDetails = {
                        ...currentPolicy.returnPolicyDetails,
                        ...returnPolicyDetails
                    };
                }
                break;
        }

        // Remove read-only fields
        delete updatedPolicy[`${type}PolicyId`];
        delete updatedPolicy.paymentPolicyId;
        delete updatedPolicy.returnPolicyId;
        delete updatedPolicy.fulfillmentPolicyId;
        delete updatedPolicy.href;
        delete updatedPolicy.warnings;

        // Update policy
        const response = await axios.put(`${EBAY_API_URL}/sell/account/v1/${typeMap[type]}/${id}`, updatedPolicy, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({ 
            success: true, 
            message: 'Policy updated successfully',
            data: response.data 
        });
    } catch (error) {
        console.error('Policy Update Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'Policy could not be updated',
            details: error.response?.data 
        });
    }
});

// API: Create Policy
app.post('/api/ebay-policies/:type', requireEbayAuth, async (req, res) => {
    const { type } = req.params;
    const policyData = req.body;
    
    const typeMap = {
        'fulfillment': 'fulfillment_policy',
        'payment': 'payment_policy',
        'return': 'return_policy'
    };

    if (!typeMap[type]) return res.status(400).json({ error: 'Invalid policy type' });

    // Validate required fields
    if (!policyData.name) {
        return res.status(400).json({ error: 'Policy name is required' });
    }

    // Ensure marketplaceId is set
    if (!policyData.marketplaceId) {
        policyData.marketplaceId = 'EBAY_AU';
    }

    console.log(`Creating ${type} policy:`, JSON.stringify(policyData, null, 2));

    try {

        const response = await axios.post(`${EBAY_API_URL}/sell/account/v1/${typeMap[type]}`, JSON.stringify(policyData), {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json',
                'X-EBAY-C-MARKETPLACE-ID': policyData.marketplaceId
            }
        });
        
        console.log('Policy created successfully:', response.data);
        res.status(201).json({
            success: true,
            message: 'Policy created successfully',
            data: response.data
        });
    } catch (error) {
        console.error('Policy Create Error:', error.response ? error.response.data : error.message);
        
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors.map(err => err.message).join(', ');
            res.status(500).json({ 
                error: 'Policy could not be created: ' + errorMessages,
                details: error.response.data 
            });
        } else {
            res.status(500).json({ 
                error: 'Policy could not be created',
                details: error.response?.data || error.message
            });
        }
    }
});

// API: Get Single Policy Details
app.get('/api/ebay-policies/:type/:id', requireEbayAuth, async (req, res) => {
    const { type, id } = req.params;
    
    const typeMap = {
        'fulfillment': 'fulfillment_policy',
        'payment': 'payment_policy',
        'return': 'return_policy'
    };

    if (!typeMap[type]) return res.status(400).json({ error: 'Invalid policy type' });

    try {
        const response = await axios.get(`${EBAY_API_URL}/sell/account/v1/${typeMap[type]}/${id}`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            data: response.data,
            type: type,
            id: id
        });
    } catch (error) {
        console.error('Policy Details Error:', error.response ? error.response.data : error.message);
        
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'Policy not found' });
        } else {
            res.status(500).json({ 
                error: 'Policy details could not be retrieved',
                details: error.response?.data 
            });
        }
    }
});

// API: Delete Policy
app.delete('/api/ebay-policies/:type/:id', requireEbayAuth, async (req, res) => {
    const { type, id } = req.params;

    const typeMap = {
        'fulfillment': 'fulfillment_policy',
        'payment': 'payment_policy',
        'return': 'return_policy'
    };

    if (!typeMap[type]) return res.status(400).json({ error: 'Invalid policy type' });

    try {
        console.log(`Deleting ${type} policy with ID: ${id}`);
        console.log(`API URL: ${EBAY_API_URL}/sell/account/v1/${typeMap[type]}/${id}`);
        console.log(`Type mapping: ${type} -> ${typeMap[type]}`);

        // First check the policy
        console.log(`Fetching policy before delete...`);
        const policyResponse = await axios.get(`${EBAY_API_URL}/sell/account/v1/${typeMap[type]}/${id}`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`
            }
        });

        const policy = policyResponse.data;
        console.log(`Policy found:`, policy.name);
        console.log(`Policy ID from eBay:`, policy[`${type}PolicyId`] || 'Not found');

        // Special check for fulfillment policy
        if (type === 'fulfillment') {
            console.log('This is a fulfillment policy - may have special constraints');
            // Check if this policy is a default or in use
            if (policy.categoryTypes && policy.categoryTypes.length > 0) {
                console.log('Category types:', policy.categoryTypes);
            }
        }

        // Perform delete operation
        console.log(`Attempting to delete policy...`);
        const deleteResponse = await axios.delete(`${EBAY_API_URL}/sell/account/v1/${typeMap[type]}/${id}`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`
            }
        });

        console.log(`Delete response:`, deleteResponse.data);

        res.json({
            success: true,
            message: `"${policy.name}" policy deleted successfully`,
            deletedPolicy: {
                name: policy.name,
                type: type,
                id: id
            }
        });
    } catch (error) {
        console.error('Policy Delete Error:', error.response ? error.response.data : error.message);

        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'Policy not found' });
        } else if (error.response && error.response.status === 409) {
            res.status(409).json({
                error: 'This policy is in use and cannot be deleted. Please remove associated offers first.'
            });
        } else if (error.response && error.response.data && error.response.data.errors) {
            const isUsageError = error.response.data.errors.some(err =>
                err.message && err.message.toLowerCase().includes('usage') ||
                err.message && err.message.toLowerCase().includes('associated')
            );

            if (isUsageError) {
                res.status(409).json({
                    error: 'This policy is being used by active offers or products. You need to remove its usage first.'
                });
            } else {
                res.status(500).json({
                    error: 'Policy could not be deleted: ' + error.response.data.errors.map(e => e.message).join(', '),
                    details: error.response.data
                });
            }
        } else {
            res.status(500).json({
                error: 'Policy could not be deleted',
                details: error.response?.data
            });
        }
    }
});

// API: Get eBay Orders
app.get('/api/ebay-orders', requireEbayAuth, async (req, res) => {
    try {
        // eBay Fulfillment API - Get Orders
        // Default: last 90 days
        const response = await axios.get(`${EBAY_API_URL}/sell/fulfillment/v1/order`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json'
            },
            params: {
                limit: 50, // Fetch up to 50 orders
                offset: 0
            }
        });

        let orders = response.data.orders || [];

        // MOCK DATA FALLBACK
        if (orders.length === 0) {
            console.log('No orders found from eBay, returning mock data.');
            orders = [{
                orderId: 'MOCK-12345-67890',
                creationDate: new Date().toISOString(),
                lastModifiedDate: new Date().toISOString(),
                orderFulfillmentStatus: 'NOT_STARTED',
                orderPaymentStatus: 'PAID',
                sellerId: 'mock_seller',
                buyer: {
                    username: 'mock_buyer_01',
                    taxAddress: {
                        stateOrProvince: 'CA',
                        postalCode: '90210',
                        countryCode: 'US'
                    }
                },
                pricingSummary: {
                    total: {
                        value: '125.50',
                        currency: 'USD'
                    }
                },
                cancelStatus: {
                    cancelState: 'NONE_REQUESTED'
                },
                lineItems: [
                    {
                        lineItemId: '10001',
                        sku: 'DS-001',
                        title: '1927 Canberra Florin - Mock Item',
                        quantity: 1,
                        lineItemCost: {
                            value: '115.00',
                            currency: 'USD'
                        },
                        total: {
                            value: '115.00',
                            currency: 'USD'
                        },
                        image: {
                            imageUrl: 'https://i.ebayimg.com/images/g/mock-image/s-l500.jpg'
                        }
                    }
                ]
            }];
            
            // Mock response structure wrapper
            res.json({
                success: true,
                data: {
                    href: "mock-href",
                    total: 1,
                    limit: 50,
                    offset: 0,
                    orders: orders
                },
                isMock: true
            });
            return;
        }

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('eBay Orders Error:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Orders could not be retrieved',
            details: error.response?.data
        });
    }
});

// API: Get Single Order Details
app.get('/api/ebay-orders/:orderId', requireEbayAuth, async (req, res) => {
    const { orderId } = req.params;

    // Handle Mock Data Detail
    if (orderId.startsWith('MOCK-')) {
        res.json({
            success: true,
            data: {
                orderId: 'MOCK-12345-67890',
                creationDate: new Date().toISOString(),
                lastModifiedDate: new Date().toISOString(),
                orderFulfillmentStatus: 'NOT_STARTED',
                orderPaymentStatus: 'PAID',
                sellerId: 'mock_seller',
                buyer: {
                    username: 'mock_buyer_01',
                    taxAddress: {
                        stateOrProvince: 'CA',
                        postalCode: '90210',
                        countryCode: 'US'
                    }
                },
                pricingSummary: {
                    total: {
                        value: '125.50',
                        currency: 'USD'
                    },
                    deliveryCost: {
                        value: '10.50',
                        currency: 'USD'
                    },
                    tax: {
                        value: '0.00',
                        currency: 'USD'
                    }
                },
                cancelStatus: {
                    cancelState: 'NONE_REQUESTED'
                },
                fulfillmentStartInstructions: [{
                    shippingStep: {
                        shipTo: {
                            fullName: 'John Doe',
                            contactAddress: {
                                addressLine1: '123 Mock St',
                                city: 'Beverly Hills',
                                stateOrProvince: 'CA',
                                postalCode: '90210',
                                countryCode: 'US'
                            },
                            primaryPhone: {
                                phoneNumber: '555-0199'
                            },
                            email: 'mock@example.com'
                        }
                    }
                }],
                lineItems: [
                    {
                        lineItemId: '10001',
                        sku: 'DS-001',
                        title: '1927 Canberra Florin - Mock Item',
                        quantity: 1,
                        lineItemCost: {
                            value: '115.00',
                            currency: 'USD'
                        },
                        total: {
                            value: '115.00',
                            currency: 'USD'
                        },
                        image: {
                            imageUrl: 'https://via.placeholder.com/150'
                        }
                    }
                ]
            }
        });
        return;
    }

    try {
        const response = await axios.get(`${EBAY_API_URL}/sell/fulfillment/v1/order/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${req.session.ebay_token}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('eBay Order Detail Error:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Order details could not be retrieved',
            details: error.response?.data
        });
    }
});

// API: Get User Info
app.get('/api/user-info', requireEbayAuth, async (req, res) => {
    // Return user info from session
    if (req.session.ebay_user) {
        res.json({
            success: true,
            user: req.session.ebay_user
        });
    } else {
        // Fallback
        res.json({
            success: true,
            user: { username: 'eBay User' }
        });
    }
});

// ============================================
// CATEGORY MANAGEMENT APIs
// ============================================

// API: List Local Categories
app.get('/api/categories', (req, res) => {
    const sql = "SELECT * FROM categories ORDER BY category_name";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// API: Category Details
app.get('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM categories WHERE id = ?";
    db.get(sql, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        res.json({ data: row });
    });
});

// API: Add New Category
app.post('/api/categories', (req, res) => {
    const { ebay_category_id, category_name, category_path, parent_id, is_leaf } = req.body;
    
    if (!category_name) {
        return res.status(400).json({ error: 'Category name is required' });
    }
    
    const sql = `INSERT INTO categories (ebay_category_id, category_name, category_path, parent_id, is_leaf) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [ebay_category_id, category_name, category_path, parent_id || null, is_leaf || 0], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ error: 'This eBay category ID already exists' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.status(201).json({ 
            message: 'Category added',
            data: { id: this.lastID }
        });
    });
});

// API: Update Category
app.put('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const { ebay_category_id, category_name, category_path, parent_id, is_leaf } = req.body;
    
    if (!category_name) {
        return res.status(400).json({ error: 'Category name is required' });
    }
    
    const sql = `UPDATE categories 
                 SET ebay_category_id = ?, category_name = ?, category_path = ?, parent_id = ?, is_leaf = ?
                 WHERE id = ?`;
    
    db.run(sql, [ebay_category_id, category_name, category_path, parent_id || null, is_leaf || 0, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        res.json({ message: 'Category updated' });
    });
});

// API: Delete Category
app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    
    // First check if there are products linked to this category
    const checkSql = "SELECT COUNT(*) as count FROM products WHERE category_id = ?";
    db.get(checkSql, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row.count > 0) {
            res.status(409).json({ 
                error: 'There are products linked to this category. Please change the category of the products first.' 
            });
            return;
        }
        
        const deleteSql = "DELETE FROM categories WHERE id = ?";
        db.run(deleteSql, [id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }
            res.json({ message: 'Category deleted' });
        });
    });
});

// ============================================
// eBay TAXONOMY API ENDPOINTS
// ============================================

// API: eBay Category Search
app.get('/api/ebay/categories/search', requireEbayAuth, async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: 'Search term must be at least 2 characters' });
    }
    
    try {
        // eBay Taxonomy API - Category Tree marketplace ID
        const categoryTreeId = '15'; // EBAY_AU
        
        const response = await axios.get(
            `${EBAY_API_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_category_suggestions`,
            {
                params: { q: q },
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json({ data: response.data.categorySuggestions || [] });
    } catch (error) {
        console.error('eBay Category Search Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'eBay category search failed',
            details: error.response?.data 
        });
    }
});

// API: eBay Category Details
app.get('/api/ebay/categories/:categoryId', requireEbayAuth, async (req, res) => {
    const { categoryId } = req.params;
    
    try {
        const categoryTreeId = '15'; // EBAY_AU
        
        const response = await axios.get(
            `${EBAY_API_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_category_subtree`,
            {
                params: { category_id: categoryId },
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json({ data: response.data });
    } catch (error) {
        console.error('eBay Category Detail Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'eBay category details could not be retrieved',
            details: error.response?.data 
        });
    }
});

// API: Import eBay Category to Local DB
app.post('/api/categories/import-from-ebay', requireEbayAuth, async (req, res) => {
    const { categoryId } = req.body;
    
    if (!categoryId) {
        return res.status(400).json({ error: 'Category ID is required' });
    }
    
    try {
        const categoryTreeId = '15'; // EBAY_AU
        
        // Get category details from eBay
        const response = await axios.get(
            `${EBAY_API_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_category_subtree`,
            {
                params: { category_id: categoryId },
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('eBay Category Response:', JSON.stringify(response.data, null, 2));
        
        // Check response structure - eBay API uses categorySubtreeNode
        const categoryData = response.data.categorySubtreeNode || response.data.rootCategoryNode || response.data;
        
        if (!categoryData || !categoryData.category) {
            return res.status(500).json({ 
                error: 'Invalid category data received from eBay',
                details: response.data 
            });
        }
        
        // Save to local DB
        const sql = `INSERT INTO categories (ebay_category_id, category_name, category_path, is_leaf) 
                     VALUES (?, ?, ?, ?)`;
        
        // Create category path
        let categoryPath = categoryData.category.categoryName;
        if (categoryData.categoryTreeNodeAncestors && categoryData.categoryTreeNodeAncestors.length > 0) {
            const ancestorPath = categoryData.categoryTreeNodeAncestors.map(a => a.categoryName).join(' > ');
            categoryPath = ancestorPath + ' > ' + categoryData.category.categoryName;
        }
        
        db.run(sql, [
            categoryData.category.categoryId,
            categoryData.category.categoryName,
            categoryPath,
            categoryData.leafCategoryTreeNode ? 1 : 0
        ], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(409).json({ error: 'This category already exists' });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }
            res.status(201).json({ 
                message: 'Category imported from eBay',
                data: { id: this.lastID, ebay_category_id: categoryData.category.categoryId }
            });
        });
        
    } catch (error) {
        console.error('eBay Category Import Error:', error.message);
        if (error.response) {
            console.error('eBay API Response:', error.response.data);
        }
        res.status(500).json({ 
            error: 'eBay category could not be imported',
            details: error.response?.data || error.message
        });
    }
});

// API: Get Aspects for Category
app.get('/api/ebay/aspects/:categoryId', requireEbayAuth, async (req, res) => {
    const { categoryId } = req.params;

    try {
        const categoryTreeId = '15'; // EBAY_AU
        
        const response = await axios.get(
            `${EBAY_API_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_item_aspects_for_category`,
            {
                params: { category_id: categoryId },
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({ 
            aspects: response.data.aspects || [] 
        });
    } catch (error) {
        console.error('Aspect Fetch Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'Aspects could not be retrieved',
            details: error.response?.data 
        });
    }
});

// API: Update Product (with category support)
app.put('/api/products/:sku', (req, res) => {
    const { sku } = req.params;
    const { title, price, description, category_id, image_url, ebay_item_id } = req.body;

    const sql = `UPDATE products
                 SET title = ?, price = ?, description = ?, category_id = ?, image_url = ?, ebay_item_id = ?
                 WHERE sku = ?`;

    db.run(sql, [title, price, description, category_id || null, image_url || null, ebay_item_id || null, sku], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        res.json({ message: 'Product updated', changes: this.changes });
    });
});

// API: Delete Product
app.delete('/api/products/:sku', (req, res) => {
    const { sku } = req.params;

    const sql = "DELETE FROM products WHERE sku = ?";
    db.run(sql, [sku], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        res.json({ message: 'Product deleted' });
    });
});

// API: Create/Update Inventory Item
app.put('/api/ebay/inventory/:sku', requireEbayAuth, async (req, res) => {
    const { sku } = req.params;
    const { product } = req.body;

    if (!product) return res.status(400).json({ error: 'Product data required' });

    try {
        // Construct payload for eBay Inventory API
        const inventoryPayload = {
            availability: {
                shipToLocationAvailability: {
                    quantity: 1
                }
            },
            condition: 'NEW',
            product: {
                title: product.title,
                description: product.description,
                aspects: product.aspects,
                imageUrls: product.imageUrls && product.imageUrls.length > 0 
                    ? product.imageUrls 
                    : ['https://via.placeholder.com/500x500.png?text=No+Image']
            }
        };

        // Save aspects locally as well
        if (product.aspects) {
            db.run("UPDATE products SET aspects = ? WHERE sku = ?", [JSON.stringify(product.aspects), sku], (err) => {
                if (err) console.error('Failed to save aspects locally:', err);
            });
        }

        const response = await axios.put(
            `${EBAY_API_URL}/sell/inventory/v1/inventory_item/${sku}`,
            inventoryPayload,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-AU'
                }
            }
        );

        res.json({ success: true, message: 'Inventory Item created/updated', data: response.data });
    } catch (error) {
        console.error('Inventory Item Create Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'Inventory Item could not be created',
            details: error.response?.data 
        });
    }
});

// API: Get Inventory Locations
app.get('/api/ebay/locations', requireEbayAuth, async (req, res) => {
    try {
        const response = await axios.get(
            `${EBAY_API_URL}/sell/inventory/v1/location`,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({ locations: response.data.locations || [] });
    } catch (error) {
        console.error('Location Fetch Error:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Locations could not be retrieved',
            details: error.response?.data
        });
    }
});

// API: Get Existing Offers for SKU
app.get('/api/ebay/offers/:sku', requireEbayAuth, async (req, res) => {
    const { sku } = req.params;
    
    try {
        const response = await axios.get(
            `${EBAY_API_URL}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            offers: response.data.offers || [],
            total: response.data.total || 0
        });
    } catch (error) {
        console.error('Get Offers Error:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Offers could not be retrieved',
            details: error.response?.data
        });
    }
});


// API: Create Offer
app.post('/api/ebay/offer', requireEbayAuth, async (req, res) => {
    const { sku, categoryId, price, quantity, listingPolicies, merchantLocationKey } = req.body;

    if (!sku || !categoryId || !price || !listingPolicies) {
        return res.status(400).json({ error: 'Missing required fields for offer' });
    }

    try {
        const offerPayload = {
            sku: sku,
            marketplaceId: 'EBAY_AU',
            format: 'FIXED_PRICE',
            availableQuantity: parseInt(quantity) || 1,
            categoryId: categoryId,
            listingDescription: 'Listed via eBay Side Panel',
            listingPolicies: {
                fulfillmentPolicyId: listingPolicies.fulfillmentPolicyId,
                paymentPolicyId: listingPolicies.paymentPolicyId,
                returnPolicyId: listingPolicies.returnPolicyId
            },
            pricingSummary: {
                price: {
                    currency: 'AUD',
                    value: price.toString()
                }
            },
            merchantLocationKey: merchantLocationKey || 'default' // User needs to have this set up
        };

        const response = await axios.post(
            `${EBAY_API_URL}/sell/inventory/v1/offer`,
            offerPayload,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-AU'
                }
            }
        );

        res.json({ success: true, offerId: response.data.offerId });
    } catch (error) {
        console.error('Offer Create Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'Offer could not be created',
            details: error.response?.data 
        });
    }
});

// API: Publish Offer
app.post('/api/ebay/offer/:offerId/publish', requireEbayAuth, async (req, res) => {
    const { offerId } = req.params;

    try {
        const response = await axios.post(
            `${EBAY_API_URL}/sell/inventory/v1/offer/${offerId}/publish`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${req.session.ebay_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({ success: true, listingId: response.data.listingId });
    } catch (error) {
        console.error('Publish Offer Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'Listing could not be published',
            details: error.response?.data 
        });
    }
});

// API: Add New Product (with category support)
app.post('/api/products', (req, res) => {
    const { sku, title, price, description, category_id, image_url } = req.body;
    
    if (!sku || !title) {
        return res.status(400).json({ error: 'SKU and title are required' });
    }
    
    const sql = `INSERT INTO products (sku, title, price, description, category_id, image_url) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [sku, title, price, description, category_id || null, image_url || null], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ error: 'This SKU already exists' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.status(201).json({ 
            message: 'Product added',
            data: { sku: sku }
        });
    });
});

// Logout Route
app.get('/logout', (req, res) => {
    // Clear session
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        // Redirect to main page
        res.redirect('/');
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});
