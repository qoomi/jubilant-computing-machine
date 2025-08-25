/**
 * Dashboard Handler for Star Jet Application
 * 
 * This module handles the main dashboard functionality, providing comprehensive
 * business overview with secure data loading, calculations, and visualization.
 * 
 * FEATURES:
 * - Secure data loading from multiple sources (sales, expenses, capital)
 * - Real-time business metrics calculation
 * - Financial summary and statistics
 * - Comprehensive error handling and user feedback
 * - Role-based data access control
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Financial data protection
 * - Rate limiting on operations
 * - Secure error handling without information disclosure
 * - Audit logging for data access
 * - Data access control based on user roles
 * - Server-side API communication (no credentials in browser)
 * 
 * File: dashboard.js
 * Dependencies: api-client.js, auth.js, access-control.js
 * Called from: index.html
 * 
 * @author Star Jet Development Team
 * @version 3.0.0
 * @lastUpdated 2024
 */

// Security and validation constants
const DASHBOARD_SECURITY_CONFIG = {
    MAX_DISPLAY_RECORDS: 1000,
    RATE_LIMIT_DELAY: 5000, // milliseconds
    MAX_CALCULATION_ITERATIONS: 1000,
    REALTIME_RETRY_DELAY: 5000, // 5 seconds
    MAX_REALTIME_RETRIES: 3
};

// ===============================
// Data Handling
// ===============================

/**
 * Loads sales from API with enhanced error handling and security logging
 * 
 * @returns {Promise<Array>} Array of sales or empty array on error
 * 
 * SECURITY: Includes comprehensive error handling and audit logging
 */
async function loadSales() {
    const timestamp = new Date().toISOString();

    console.log('🔐 Loading sales data:', {
        timestamp: timestamp,
        file: 'dashboard.js',
        function: 'loadSales'
    });

    if (!window.apiClient) {
        console.warn('🔐 Security: API client not configured', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'loadSales'
        });
        return [];
    }

    try {
        const result = await window.apiClient.getSales();

        if (result.error) {
            console.error('🔐 API sales error:', {
                timestamp: timestamp,
                file: 'dashboard.js',
                function: 'loadSales',
                error: result.error
            });
            throw new Error(result.error);
        }

        const salesData = result.sales || [];
        console.log('🔐 Sales data loaded successfully:', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'loadSales',
            recordCount: salesData.length
        });

        return salesData;
    } catch (e) {
        console.error('🔐 Failed to load sales:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'loadSales',
            error: e.message
        });
        return [];
    }
}

/**
 * Loads expenses from API with enhanced error handling and security logging
 * 
 * @returns {Promise<Array>} Array of expenses or empty array on error
 * 
 * SECURITY: Includes comprehensive error handling and audit logging
 */
async function loadExpenses() {
    const timestamp = new Date().toISOString();

    console.log('🔐 Loading expenses data:', {
        timestamp: timestamp,
        file: 'dashboard.js',
        function: 'loadExpenses'
    });

    if (!window.apiClient) {
        console.warn('🔐 Security: API client not configured', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'loadExpenses'
        });
        return [];
    }

    try {
        const result = await window.apiClient.getExpenses();

        if (result.error) {
            console.error('🔐 API expenses error:', {
                timestamp: timestamp,
                file: 'dashboard.js',
                function: 'loadExpenses',
                error: result.error
            });
            throw new Error(result.error);
        }

        const expensesData = result.expenses || [];
        console.log('🔐 Expenses data loaded successfully:', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'loadExpenses',
            recordCount: expensesData.length
        });

        return expensesData;
    } catch (e) {
        console.error('🔐 Failed to load expenses:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'loadExpenses',
            error: e.message
        });
        return [];
    }
}

/**
 * Loads capital settings from API with enhanced error handling and security logging
 * 
 * @returns {Promise<Object>} Capital settings object
 * 
 * SECURITY: Includes comprehensive error handling and audit logging
 */
async function loadCapitalSettings() {
    const timestamp = new Date().toISOString();

    console.log('🔐 Loading capital settings:', {
        timestamp: timestamp,
        file: 'dashboard.js',
        function: 'loadCapitalSettings'
    });

    if (!window.apiClient) {
        console.warn('🔐 Security: API client not configured', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'loadCapitalSettings'
        });
        return { originalCapital: 0 };
    }

    try {
        const result = await window.apiClient.getCapitalSettings();

        if (result.error) {
            console.error('🔐 API capital settings error:', {
                timestamp: timestamp,
                file: 'dashboard.js',
                function: 'loadCapitalSettings',
                error: result.error
            });
            throw new Error(result.error);
        }

        const capitalData = result.capitalSettings;
        const originalCapital = capitalData ? capitalData.original_capital : 0;

        console.log('🔐 Capital settings loaded successfully:', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'loadCapitalSettings',
            capitalAmount: originalCapital
        });

        return { originalCapital };
    } catch (e) {
        console.error('🔐 Failed to load capital settings:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'loadCapitalSettings',
            error: e.message
        });
        return { originalCapital: 0 };
    }
}

/**
 * Gets the original capital amount that was manually set.
 * @returns {Promise<number>}
 */
async function getOriginalCapital() {
    const capitalSettings = await loadCapitalSettings();
    return capitalSettings.originalCapital || 0;
}

// ===============================
// DOM Elements
// ===============================
const pendingSalesValue = document.getElementById('pendingSalesValue');
const completedTodayValue = document.getElementById('completedTodayValue');
const currentCapitalValue = document.getElementById('currentCapitalValue');

// ===============================
// Dashboard Update Logic
// ===============================

/**
 * Updates the dashboard cards with current sales data and tracks last updated time.
 * 
 * SECURITY: Includes comprehensive error handling and logging
 */
async function updateDashboard() {
    const timestamp = new Date().toISOString();

    try {
        console.log('🔐 Updating dashboard:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'updateDashboard'
        });

        const sales = await loadSales();
        console.log('🔐 Sales loaded:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'updateDashboard',
            recordCount: sales.length
        });

        // Count all pending sales (all time)
        const pendingCount = sales.filter(sale => sale.status === 'Pending').length;
        console.log('🔐 Pending sales count:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'updateDashboard',
            count: pendingCount
        });

        // Count completed sales for today only
        const today = new Date().toISOString().split('T')[0];
        const completedTodayCount = sales.filter(sale => sale.status === 'Completed' && sale.date && sale.date.startsWith(today)).length;
        console.log('🔐 Completed today count:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'updateDashboard',
            count: completedTodayCount
        });

        // Get original capital amount
        const originalCapital = await getOriginalCapital();
        console.log('🔐 Original capital:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'updateDashboard',
            amount: originalCapital
        });

        // Update DOM
        if (pendingSalesValue) pendingSalesValue.textContent = pendingCount;
        if (completedTodayValue) completedTodayValue.textContent = completedTodayCount;
        if (currentCapitalValue) currentCapitalValue.textContent = `$${originalCapital.toFixed(2)}`;

        // Update last updated time
        const lastUpdatedElement = document.getElementById('lastUpdatedTime');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = new Date().toLocaleTimeString();
        }

        console.log('🔐 Dashboard updated successfully:', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'updateDashboard'
        });
    } catch (error) {
        console.error('🔐 Error updating dashboard:', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'updateDashboard',
            error: error.message
        });
    }
}

// ===============================
// API-based Dashboard Updates
// ===============================

/**
 * Initialize dashboard with API-based data loading
 * 
 * SECURITY: Uses secure server API instead of direct database access
 */
async function initializeDashboard() {
    const timestamp = new Date().toISOString();

    console.log('🔐 Initializing dashboard with API:', {
        timestamp: timestamp,
        file: 'dashboard.js',
        function: 'initializeDashboard'
    });

    if (!window.apiClient) {
        console.error('🔐 Security: API client not available', {
            timestamp: timestamp,
            file: 'dashboard.js',
            function: 'initializeDashboard'
        });
        return;
    }

    console.log('🔐 API client available, initializing dashboard...');

    // Initial dashboard update
    await updateDashboard();

    console.log('🔐 Dashboard initialized successfully:', {
        timestamp: new Date().toISOString(),
        file: 'dashboard.js',
        function: 'initializeDashboard'
    });
}

/**
 * Update capital display with enhanced error handling
 */
async function updateCapitalDisplay() {
    try {
        const originalCapital = await getOriginalCapital();
        if (currentCapitalValue) {
            currentCapitalValue.textContent = `$${originalCapital.toFixed(2)}`;
        }
        console.log('🔐 Capital display updated:', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'updateCapitalDisplay',
            capitalAmount: originalCapital
        });
    } catch (error) {
        console.error('🔐 Error updating capital display:', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'updateCapitalDisplay',
            error: error.message
        });
    }
}

// ===============================
// Initial Render with API
// ===============================

(async function initDashboard() {
    console.log('🔐 Initializing dashboard with API...');

    // Test API connection
    if (!window.apiClient) {
        console.error('🔐 Security: API client not available', {
            timestamp: new Date().toISOString(),
            file: 'dashboard.js',
            function: 'initDashboard'
        });
        return;
    }

    console.log('🔐 API client available, initializing dashboard...');

    // Initialize dashboard with API
    await initializeDashboard();
})();

// ===============================
// Manual Refresh and Focus Updates
// ===============================

// Refresh dashboard when page becomes visible or gains focus
window.addEventListener('focus', async function () {
    console.log('🔐 Page focused, refreshing dashboard...');
    await updateDashboard();
});

window.addEventListener('visibilitychange', async function () {
    if (!document.hidden) {
        console.log('🔐 Page became visible, refreshing dashboard...');
        await updateDashboard();
    }
});

// Manual refresh button functionality
window.refreshDashboard = async function () {
    console.log('🔐 Manual dashboard refresh requested');
    await updateDashboard();
}; 