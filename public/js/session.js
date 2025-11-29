// Session Control and Session Management Module

// Check session on page load
$(document).ready(function() {
    checkSession();
});

// Check session status
function checkSession() {
    // Check eBay session using policies API
    // This uses requireEbayAuth middleware, checks real session status
    $.ajax({
        url: '/api/ebay-policies',
        method: 'GET',
        success: function(response) {
            // Success - eBay session exists
            showLoggedInState();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                // Unauthorized - No eBay session
                showLoggedOutState();
            } else {
                // Other errors - assume session exists
                showLoggedInState();
            }
        }
    });
}

// Show logged in state
function showLoggedInState() {
    // Show dashboard link if on home page
    if (isHomePage()) {
        showHomePageLoggedIn();
    } else {
        // Update navigation for other pages
        updateNavigationForLoggedIn();
        // Load user information
        loadUserInfo();
    }
    updateLogoutButton();
}

// Show logged out state
function showLoggedOutState() {
    // Show Connect to eBay button if on home page
    if (isHomePage()) {
        showHomePageLoggedOut();
    } else {
        // Update navigation for other pages
        updateNavigationForLoggedOut();
    }
    updateLogoutButton();
}

// Check if on home page
function isHomePage() {
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
}

// Home page - logged in state
function showHomePageLoggedIn() {
    const authButtons = $('#auth-buttons');
    authButtons.html(`
        <div class="space-y-4">
            <a href="/products.html" class="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300">
                Go to Dashboard
            </a>
            <p class="text-green-600 font-semibold">✓ eBay connection active</p>
        </div>
    `);
}

// Home page - logged out state
function showHomePageLoggedOut() {
    const authButtons = $('#auth-buttons');
    authButtons.html(`
        <a href="/auth/ebay" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300">
            Connect to eBay
        </a>
    `);
}

// Update navigation for logged in
function updateNavigationForLoggedIn() {
    // Find existing "Logout" or "Connect to eBay" link
    const nav = $('nav');
    let existingLink = nav.find('a[href="/"]').last(); // "Logout" link
    let connectLink = nav.find('.connect-ebay-btn');
    
    // If Connect to eBay button exists, replace it with Logout
    if (connectLink.length > 0) {
        connectLink.replaceWith(`
            <a href="/logout" class="logout-btn text-gray-600 hover:bg-gray-100 px-3 py-2 rounded transition">Logout</a>
        `);
        // Add event to newly added logout button
        nav.find('.logout-btn').on('click', function(e) {
            e.preventDefault();
            logout();
        });
    } else if (existingLink.length > 0 && !existingLink.hasClass('logout-btn')) {
        // Update existing "Logout" link with logout-btn class
        existingLink.addClass('logout-btn').attr('href', '/logout');
        existingLink.off('click').on('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

// Update navigation for logged out
function updateNavigationForLoggedOut() {
    // Find existing logout button or Logout link
    const nav = $('nav');
    let logoutButton = nav.find('.logout-btn');
    let exitLink = nav.find('a[href="/"]').last();
    
    if (logoutButton.length > 0) {
        // If logout-btn exists, replace it with Connect to eBay
        logoutButton.replaceWith(`
            <a href="/auth/ebay" class="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded transition connect-ebay-btn">
                Connect to eBay
            </a>
        `);
    } else if (exitLink.length > 0) {
        // If normal "Logout" link exists, replace it with Connect to eBay
        exitLink.replaceWith(`
            <a href="/auth/ebay" class="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded transition connect-ebay-btn">
                Connect to eBay
            </a>
        `);
    }
}

// Update logout button
function updateLogoutButton() {
    // This function is called by showLoggedInState and showLoggedOutState
    // May not require additional action
}

// Logout process
function logout() {
    $.ajax({
        url: '/logout',
        method: 'GET',
        success: function() {
            // Logout successful, reload page
            location.reload();
        },
        error: function() {
            // Reload page even if logout failed
            location.reload();
        }
    });
}

// Get user information and show in menu
function loadUserInfo() {
    $.ajax({
        url: '/api/user-info',
        method: 'GET',
        success: function(response) {
            if (response.success && response.user) {
                displayUserInfo(response.user);
            }
        },
        error: function(xhr) {
            console.log('User info not available:', xhr.status);
        }
    });
}

// Recheck session (e.g. when a button is clicked)
function refreshSession() {
    checkSession();
}


// Show user information in menu
function displayUserInfo(user) {
    const nav = $('nav');
    // Remove existing user info element (if exists)
    nav.find('.user-info').remove();

    // Show user information
    let displayText = 'eBay User';

    if (user.username) {
        displayText = user.username;
        if (user.registrationMarketplaceId) {
            displayText += ` (${user.registrationMarketplaceId})`;
        }
    }

    // Add user information to menu
    const userInfoHtml = `
        <span class="user-info text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded">
            <i class="fas fa-user"></i> ${displayText}
        </span>
    `;

    // Add to beginning of nav
    nav.prepend(userInfoHtml);
}