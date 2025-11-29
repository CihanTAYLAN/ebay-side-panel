# eBay Side Panel - Quick Reference

## Quick Overview
eBay integrated inventory management system. Synchronizes local products to eBay marketplace.

## Project Structure
```
server.js                 # Express server + eBay API
public/
├── index.html           # Login page
├── products.html        # Product management
├── categories.html      # Category management
├── policies.html        # Policy management
├── orders.html          # Order management
└── js/
    ├── products.js      # Product CRUD
    ├── categories.js    # Category tree
    ├── orders.js        # Order listing and details
    └── session.js       # Auth management
```

## Key Features
- ✅ eBay OAuth 2.0 integration
- ✅ Product management (CRUD)
- ✅ Send products to eBay (With taxonomy and aspects)
- ✅ Category management (hierarchical + eBay mapping)
- ✅ Policy management (fulfillment/payment/return)
- ✅ Order management (Display + Details)

## Quick Commands
```bash
npm start                # Start application
npm run start            # Development mode with nodemon
```

## Main API Endpoints
```javascript
// Auth
GET  /auth/ebay                    # Start OAuth
GET  /auth/ebay/callback           # OAuth callback
GET  /logout                       # Logout

// Products  
GET    /api/local-products         # All products
POST   /api/products               # New product
PUT    /api/products/:sku          # Update product
DELETE /api/products/:sku          # Delete product
POST   /api/send-to-ebay           # Send to eBay

// Orders
GET    /api/ebay-orders            # List orders (Last 90 days)
GET    /api/ebay-orders/:orderId   # Order details

// Categories
GET    /api/categories             # All categories (tree)
POST   /api/categories             # New category
PUT    /api/categories/:id         # Update category
DELETE /api/categories/:id         # Delete category
GET    /api/ebay/categories/search # Search in eBay

// Policies
GET    /api/ebay-policies          # All policies
GET    /api/ebay-policies/:type/:id # Single policy details
PUT    /api/ebay-policies/:type/:id # Update policy
POST   /api/ebay-policies/:type    # New policy
DELETE /api/ebay-policies/:type/:id # Delete policy
```

## Database
```sql
-- Categories (parent-child tree)
CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    ebay_category_id TEXT,
    category_name TEXT,
    category_path TEXT,
    parent_id INTEGER
);

-- Products
CREATE TABLE products (
    sku TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price REAL,
    description TEXT,
    ebay_item_id TEXT,
    category_id INTEGER
);
```

## Configuration
```bash
# .env file
PORT=8080
EBAY_ENV=SANDBOX
EBAY_CLIENT_ID=your_client_id
EBAY_CLIENT_SECRET=your_secret
EBAY_RU_NAME=your_redirect_uri
SESSION_SECRET=your_secret
```

## eBay Marketplace
- **Marketplace**: EBAY_AU (Australia)
- **API Version**: v1
- **Scopes**: sell.inventory, sell.account, sell.fulfillment, commerce.taxonomy.readonly

## Development Notes
- SQLite automatically creates db/app.db
- Session in memory (Redis required for production)
- Tailwind CSS + jQuery frontend
- Test data added automatically

---
**Last Updated**: 2025-11-27  
**Repo**: https://github.com/CihanTAYLAN/ebay-side-panel