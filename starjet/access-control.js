/**
 * Role-Based Access Control (RBAC) System for Star Jet
 * 
 * This module provides centralized role-based access control for the application.
 * It defines which pages each user role can access and provides utilities for
 * checking permissions and handling unauthorized access.
 * 
 * UI ENHANCEMENTS:
 * - Professional compact sidebar design
 * - Icon-based navigation for better UX
 * - Removed collapse functionality for simplicity
 * - Enhanced visual feedback and hover effects
 * 
 * @version 2.2.0 - Updated to use API client instead of direct Supabase access
 */

class AccessControl {
    constructor() {
        this.apiClient = window.apiClient;
        this.currentUser = null;
        this.currentRole = null;

        // Define page permissions for each role
        this.rolePages = {
            // Salesman can only access sales-related pages
            salesman: [
                'sales.html',           // Add Sale (Landing page)
                'sales-track.html',     // Sales Tracking
                'quotation.html',       // View Quotations
                'invoice.html',         // View Invoices
                'edit-sale.html'        // Edit Sales
            ],

            // Accountant can only access accounting-related pages
            accountant: [
                'expenses.html',        // Add Expense (Landing page)
                'expenses-history.html', // Expense History
                'statistics.html'       // View Statistics
            ],

            // Admin has access to all pages
            admin: ['*'] // Special wildcard for full access
        };

        // Define page categories for navigation (quotation.html, invoice.html, and edit-sale.html are NOT in navigation)
        this.pageCategories = {
            'Admin/Management': ['index.html', 'capital-setup.html'],
            'Sales': ['sales.html', 'sales-track.html'],
            'Accounting': ['expenses.html', 'expenses-history.html', 'statistics.html']
        };

        this.init();
    }

    /**
     * Initialize the access control system
     */
    async init() {
        // Wait for API client to be available
        await this.waitForApiClient();

        await this.loadCurrentUser();
        this.setupRouteProtection();

        // Dispatch event when access control is ready
        this.dispatchReadyEvent();
    }

    /**
     * Wait for API client to be available
     */
    async waitForApiClient() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait

        while (!this.apiClient && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            this.apiClient = window.apiClient;
            attempts++;
        }

        if (!this.apiClient) {
            throw new Error('API client not available after waiting');
        }
    }

    /**
     * Dispatch ready event when user role is loaded
     */
    dispatchReadyEvent() {
        const event = new CustomEvent('accessControlReady', {
            detail: { accessControl: this }
        });
        document.dispatchEvent(event);
    }

    /**
     * Load current user and role from API
     */
    async loadCurrentUser() {
        try {
            // Check if API client is available
            if (!this.apiClient) {
                console.error('Access Control: API client not available');
                this.handleUnauthorizedAccess('API client not configured');
                return;
            }

            // Get user profile from API
            const result = await this.apiClient.getUserProfile();

            if (result.error) {
                console.error('Error getting user profile:', result.error);
                this.handleUnauthorizedAccess('Failed to load user profile');
                return;
            }

            this.currentUser = result.profile;
            this.currentRole = result.profile.role;
            console.log(`Access Control: User ${result.profile.name} (${result.profile.role}) loaded`);

        } catch (error) {
            console.error('Error in loadCurrentUser:', error);
            this.handleUnauthorizedAccess('Failed to load user data');
        }
    }

    /**
     * Get the current user's role
     * @returns {string|null} The user's role or null if not loaded
     */
    getCurrentRole() {
        return this.currentRole;
    }

    /**
     * Get the current user's data
     * @returns {object|null} The user's data or null if not loaded
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if a user has access to a specific page
     * @param {string} pageName - The page name to check (e.g., 'sales.html')
     * @param {string} role - Optional role to check (defaults to current user's role)
     * @returns {boolean} True if access is allowed, false otherwise
     */
    hasAccess(pageName, role = null) {
        const userRole = role || this.currentRole;

        if (!userRole) {
            console.warn('Access Control: No role available for access check');
            return false;
        }

        // Admin has access to everything
        if (userRole === 'admin') {
            return true;
        }

        // Check if the role exists in our permissions
        if (!this.rolePages[userRole]) {
            console.warn(`Access Control: Unknown role '${userRole}'`);
            return false;
        }

        // Check if the page is in the allowed pages for this role
        const allowedPages = this.rolePages[userRole];
        return allowedPages.includes(pageName);
    }

    /**
     * Get all pages that the current user can access
     * @returns {Array} Array of page names the user can access
     */
    getVisiblePages() {
        if (!this.currentRole) {
            return [];
        }

        if (this.currentRole === 'admin') {
            // Admin gets all pages from all categories
            return Object.values(this.pageCategories).flat();
        }

        return this.rolePages[this.currentRole] || [];
    }

    /**
     * Get visible navigation items based on user role
     * @returns {object} Object with category names as keys and arrays of visible pages as values
     */
    getVisibleNavigation() {
        // Check if user role is loaded
        if (!this.currentRole) {
            console.warn('Access Control: User role not loaded yet, cannot determine navigation');
            return {};
        }

        const visiblePages = this.getVisiblePages();
        console.log('Access Control: Current role:', this.currentRole);
        console.log('Access Control: Visible pages:', visiblePages);

        const visibleNavigation = {};

        // If admin, show all categories
        if (this.currentRole === 'admin') {
            console.log('Access Control: Admin user - showing all categories');
            return this.pageCategories;
        }

        // For other roles, only show categories that contain their allowed pages
        for (const [category, pages] of Object.entries(this.pageCategories)) {
            const categoryPages = pages.filter(page => visiblePages.includes(page));
            console.log('Access Control: Category', category, 'pages:', pages, 'filtered to:', categoryPages);
            if (categoryPages.length > 0) {
                visibleNavigation[category] = categoryPages;
            }
        }

        console.log('Access Control: Final visible navigation:', visibleNavigation);
        return visibleNavigation;
    }

    /**
     * Setup route protection for the current page
     */
    setupRouteProtection() {
        const currentPage = this.getCurrentPageName();

        if (!currentPage) {
            console.warn('Access Control: Could not determine current page');
            return;
        }

        // Check if user has access to current page
        if (!this.hasAccess(currentPage)) {
            this.handleUnauthorizedAccess(`Role '${this.currentRole}' attempted to access '${currentPage}'`);
        }
    }

    /**
     * Get the current page name from the URL
     * @returns {string} The current page name
     */
    getCurrentPageName() {
        const path = window.location.pathname;
        const pageName = path.split('/').pop() || 'index.html';
        return pageName;
    }

    /**
     * Handle unauthorized access attempts
     * @param {string} reason - The reason for the access denial
     */
    handleUnauthorizedAccess(reason) {
        console.error(`Access Control: Unauthorized access blocked — ${reason}`);

        // Show access denied message
        this.showAccessDeniedMessage();

        // Redirect to appropriate page based on role
        setTimeout(() => {
            if (this.currentRole === 'accountant') {
                window.location.href = 'expenses.html';
            } else if (this.currentRole === 'salesman') {
                window.location.href = 'sales.html';
            } else if (this.currentRole === 'admin') {
                window.location.href = 'index.html';
            } else {
                // Default to login page for unknown roles
                window.location.href = 'login.html';
            }
        }, 3000);
    }

    /**
     * Show access denied message to the user
     */
    showAccessDeniedMessage() {
        // Remove existing message if any
        const existingMessage = document.getElementById('accessDeniedMessage');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create access denied message
        const messageDiv = document.createElement('div');
        messageDiv.id = 'accessDeniedMessage';
        messageDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                border: 2px solid #dc3545;
                border-radius: 8px;
                padding: 30px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                font-family: Arial, sans-serif;
            ">
                <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
                <h2 style="color: #dc3545; margin-bottom: 15px;">Access Denied</h2>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    Your account does not have permission to view this page.
                </p>
                <p style="color: #999; font-size: 14px;">
                    Redirecting you to an authorized page...
                </p>
            </div>
        `;

        document.body.appendChild(messageDiv);
    }

    /**
     * Render navigation menu based on user role
     * @param {HTMLElement} navElement - The navigation element to render
     */
    renderNavigation(navElement) {
        if (!navElement) {
            console.error('Access Control: No navigation element provided');
            return;
        }

        const visibleNavigation = this.getVisibleNavigation();
        const navMenu = navElement.querySelector('.nav-menu');

        if (!navMenu) {
            console.error('Access Control: No nav-menu found in navigation element');
            return;
        }

        // Clear existing navigation
        navMenu.innerHTML = '';

        // Add logo
        const logoDiv = document.createElement('div');
        logoDiv.className = 'nav-logo';
        logoDiv.innerHTML = '<img src="star jet.png" alt="Star Jet Logo">';
        navMenu.appendChild(logoDiv);

        // Render each visible category
        for (const [category, pages] of Object.entries(visibleNavigation)) {
            const categorySection = this.createCategorySection(category, pages);
            navMenu.appendChild(categorySection);
        }

        // Reinitialize navigation functionality
        this.initializeNavigationFunctionality();
    }

    /**
     * Create a navigation category section
     * @param {string} category - The category name
     * @param {Array} pages - Array of pages in this category
     * @returns {HTMLElement} The category section element
     */
    createCategorySection(category, pages) {
        const section = document.createElement('li');
        section.className = 'nav-section';

        const header = document.createElement('div');
        header.className = 'nav-section-header';
        header.innerHTML = `
            <span>${category}</span>
        `;

        const submenu = document.createElement('ul');
        submenu.className = 'nav-submenu';

        // Add pages to submenu with icons
        pages.forEach(page => {
            const pageInfo = this.getPageDisplayInfo(page);
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = page;

            // Create icon span
            const iconSpan = document.createElement('span');
            iconSpan.className = 'nav-icon';
            iconSpan.textContent = pageInfo.icon;

            // Create text span
            const textSpan = document.createElement('span');
            textSpan.textContent = pageInfo.name;

            // Append icon and text to link
            link.appendChild(iconSpan);
            link.appendChild(textSpan);

            // Mark current page as active
            if (page === this.getCurrentPageName()) {
                link.classList.add('active');
            }

            listItem.appendChild(link);
            submenu.appendChild(listItem);
        });

        section.appendChild(header);
        section.appendChild(submenu);

        return section;
    }

    /**
     * Get display name and icon for a page
     * @param {string} pageName - The page filename
     * @returns {object} Object containing display name and icon
     */
    getPageDisplayInfo(pageName) {
        const pageInfo = {
            'index.html': { name: 'Dashboard', icon: '📊' },
            'sales.html': { name: 'Add Sale', icon: '➕' },
            'sales-track.html': { name: 'Sales Tracking', icon: '📈' },
            'expenses.html': { name: 'Add Expense', icon: '💰' },
            'expenses-history.html': { name: 'Expense History', icon: '📋' },
            'statistics.html': { name: 'Statistics', icon: '📊' },
            'capital-setup.html': { name: 'Capital Management', icon: '⚙️' },
            'quotation.html': { name: 'View Quotation', icon: '📄' },
            'invoice.html': { name: 'View Invoice', icon: '🧾' },
            'edit-sale.html': { name: 'Edit Sale', icon: '✏️' }
        };

        return pageInfo[pageName] || { name: pageName, icon: '📄' };
    }

    /**
     * Get display name for a page (backward compatibility)
     * @param {string} pageName - The page filename
     * @returns {string} The display name for the page
     */
    getPageDisplayName(pageName) {
        return this.getPageDisplayInfo(pageName).name;
    }

    /**
     * Initialize navigation functionality (static sections - no collapse)
     */
    initializeNavigationFunctionality() {
        // All sections are now always visible - no collapse functionality
        console.log('🔐 Navigation initialized with static sections');
    }
}

// Initialize access control when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on pages that are not the login page
    if (!window.location.pathname.includes('login.html')) {
        window.accessControl = new AccessControl();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessControl;
}
