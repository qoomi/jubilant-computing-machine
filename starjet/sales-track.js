/**
 * Sales Tracking Handler for Star Jet Application
 * 
 * This module handles sales tracking, filtering, search, and management operations.
 * It provides comprehensive sales data visualization, export functionality, and
 * secure data manipulation with proper validation and error handling.
 * 
 * FEATURES:
 * - Real-time sales data loading and display
 * - Advanced search and filtering capabilities
 * - Export functionality (CSV)
 * - Sales status management (Pending/Completed)
 * - Rollback functionality for completed sales
 * - Summary statistics and reporting
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Secure data export with proper escaping
 * - Rate limiting on operations
 * - Comprehensive error handling
 * - Audit logging for critical operations
 * 
 * File: sales-track.js
 * Dependencies: supabase.js, auth.js, access-control.js
 * Called from: sales-track.html
 * 
 * @author Star Jet Development Team
 * @version 2.0.0
 * @lastUpdated 2024
 */

// Security and validation constants
const TRACKING_SECURITY_CONFIG = {
    MAX_SEARCH_LENGTH: 100,
    MAX_EXPORT_RECORDS: 10000,
    MAX_FILTER_DATE_RANGE: 365, // days
    RATE_LIMIT_DELAY: 1000, // milliseconds
    MAX_ROLLBACK_ATTEMPTS: 3
};
// ===============================
// Star Jet Sales Tracking Logic
// ===============================

// ===============================
// Data Handling
// ===============================

/**
 * Loads sales from localStorage, or initializes as empty array if not found.
 * @returns {Array}
 */
async function loadSales() {
    try {
        if (!window.apiClient) {
            alert('API client not configured. Please check your configuration.');
            return [];
        }

        const result = await window.apiClient.getSales();

        if (result.error) {
            console.error('Error fetching sales from API', result.error);
            alert('Failed to fetch sales from the database.');
            return [];
        }

        const safe = Array.isArray(result.sales) ? result.sales : [];
        return safe;
    } catch (error) {
        console.error('Error fetching sales from API', error);
        alert('Failed to fetch sales from the database.');
        return [];
    }
}

/**
 * Saves sales array to localStorage.
 * @param {Array} sales
 */


// Initialize sales data
let sales = [];
(async function initLoad() {
    const data = await loadSales();
    sales = Array.isArray(data) ? data : [];
    renderAllSections();
})();

// DOM Elements for summary cards
const totalPendingSalesEl = document.getElementById('total-pending-sales');
const monthlyCompletedSalesEl = document.getElementById('monthly-completed-sales');
const dailyCompletedSalesEl = document.getElementById('daily-completed-sales');

// ===============================
// DOM Elements
// ===============================
const salesTableBody = document.querySelector('#salesTable tbody');
const statusToggleBtn = document.getElementById('statusToggleBtn');

// Status toggle state management
let currentStatusState = 'Pending'; // Default state
const statusStates = ['Pending', 'Completed', 'all']; // Toggle cycle

// Add invoice popup HTML to the page if not present
if (!document.getElementById('invoicePopup')) {
    const popup = document.createElement('div');
    popup.id = 'invoicePopup';
    popup.className = 'popup';
    popup.style.display = 'none';
    popup.innerHTML = '<div class="popup-content" id="invoiceContent"></div>';
    document.body.appendChild(popup);
}
const invoicePopup = document.getElementById('invoicePopup');

// Add edit popup HTML to the page if not present
if (!document.getElementById('editPopup')) {
    const popup = document.createElement('div');
    popup.id = 'editPopup';
    popup.className = 'popup';
    popup.style.display = 'none';
    popup.innerHTML = '<div class="popup-content" id="editContent"></div>';
    document.body.appendChild(popup);
}
const editPopup = document.getElementById('editPopup');

// Add new date filter DOM elements
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

// Helper to get query params
function getQueryParams() {
    const params = {};
    window.location.search.replace(/^[?]/, '').split('&').forEach(pair => {
        if (!pair) return;
        const [key, val] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(val || '');
    });
    return params;
}

/**
 * Set filters from query params or default to all pending sales
 * 
 * SECURITY: Maintains existing logic while supporting new toggle button
 */
function setFiltersFromQueryOrDefault() {
    const params = getQueryParams();
    let now = new Date();
    let yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let todayStr = now.toISOString().slice(0, 10);
    let yestStr = yesterday.toISOString().slice(0, 10);

    if (params.status) {
        currentStatusState = params.status;
        updateStatusToggleButton();
    } else {
        currentStatusState = 'Pending';
        updateStatusToggleButton();
    }

    if (params.last24 === '1') {
        startDateInput.value = yestStr;
        endDateInput.value = todayStr;
    } else {
        if (params.startDate) startDateInput.value = params.startDate;
        if (params.endDate) endDateInput.value = params.endDate;
        // If no params and status is pending, show all pending sales (no date filter)
        if (!params.startDate && !params.endDate && params.status === 'Pending') {
            startDateInput.value = '';
            endDateInput.value = '';
        }
        // If no params at all, default to all pending sales
        if (!params.startDate && !params.endDate && !params.status) {
            currentStatusState = 'Pending';
            updateStatusToggleButton();
            startDateInput.value = '';
            endDateInput.value = '';
        }
    }
}

/**
 * Update the status toggle button display
 * 
 * SECURITY: Maintains visual consistency with current state
 */
function updateStatusToggleButton() {
    if (statusToggleBtn) {
        statusToggleBtn.textContent = currentStatusState;

        // Update button styling based on state
        if (currentStatusState === 'Pending') {
            statusToggleBtn.style.background = '#b3006b';
        } else if (currentStatusState === 'Completed') {
            statusToggleBtn.style.background = '#28a745';
        } else {
            statusToggleBtn.style.background = '#6c757d';
        }
    }
}
setFiltersFromQueryOrDefault();

// ===============================
// Utility Functions
// ===============================

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Formats a date string as YYYY-MM-DD.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
    return iso ? iso.split('T')[0] : '';
}

/**
 * Gets month (1-12) from ISO date string.
 */
function getMonth(iso) {
    return iso ? new Date(iso).getMonth() + 1 : null;
}

/**
 * Gets year from ISO date string.
 */
function getYear(iso) {
    return iso ? new Date(iso).getFullYear() : null;
}

// Define item options in JS for use in edit popup
const ITEM_OPTIONS = [
    '3D', 'Billboards', 'Board', 'Banner', 'Sticker', 'Window Graphics', 'Stand Banners',
    'Box light', 'Wall Calendar', 'Desk Calendar', 'Office titel', 'Leaflets', 'Flyers',
    'bussiness card', 'Id card', 'Key Chain', 'Door Name', 'Brochure Printing', 'Full car branding'
];
function getItemOptionsHTML(selected) {
    return ITEM_OPTIONS.map(opt => `<option value="${opt}"${opt === selected ? ' selected' : ''}>${opt}</option>`).join('');
}

// Shared calculation function for both add and edit forms
function calculateTotal({ width, length, quantity, unitPrice, discount }) {
    width = parseFloat(width);
    length = parseFloat(length);
    quantity = parseInt(quantity);
    unitPrice = parseFloat(unitPrice);
    discount = parseFloat(discount) || 0;
    if (!isNaN(width) && width > 0 && !isNaN(length) && length > 0 && !isNaN(quantity) && quantity > 0 && !isNaN(unitPrice) && unitPrice > 0) {
        let total = width * length * quantity * unitPrice;
        if (!isNaN(discount) && discount > 0) {
            total = total * (1 - discount / 100);
        }
        return total.toFixed(2);
    }
    return '';
}

// ===============================
// Table Rendering
// ===============================

/**
 * Renders the sales table based on current filters.
 */
function renderTable() {
    // Filter by status and date range
    let filtered = sales;
    const statusVal = currentStatusState;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    // By default, show only today's sales (but not for pending status)
    if (!startDate && !endDate && statusVal !== 'Pending') {
        const today = new Date().toISOString().slice(0, 10);
        filtered = filtered.filter(sale => sale.date && sale.date.slice(0, 10) === today);
    }
    // Filter by start date
    if (startDate) {
        filtered = filtered.filter(sale => sale.date && sale.date.slice(0, 10) >= startDate);
    }
    // Filter by end date
    if (endDate) {
        filtered = filtered.filter(sale => sale.date && sale.date.slice(0, 10) <= endDate);
    }
    // Filter by status
    if (statusVal !== 'all') {
        filtered = filtered.filter(sale => sale.status === statusVal);
    }
    salesTableBody.innerHTML = '';
    if (filtered.length === 0) {
        salesTableBody.innerHTML = '<tr><td colspan="13">No sales found.</td></tr>';
        return;
    }
    filtered.forEach((sale) => {
        // Show only the first item for each sale
        let firstItem = (sale.items && sale.items.length > 0) ? sale.items[0] : sale;
        let viewBtn = '';
        let deleteBtn = '';

        // Only show View button for completed sales
        if (sale.status === 'Completed') {
            viewBtn = `<a href="invoice.html?id=${sale.id}" title="View Invoice"><span aria-label='View' role='img'>👁️</span></a>`;
        }

        // Show delete button for admins only
        const isAdmin = window.accessControl && window.accessControl.getCurrentRole() === 'admin';
        if (isAdmin) {
            deleteBtn = `<button onclick="deleteSale('${sale.id}')" title="Delete" style="background: #dc3545; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; margin: 0 2px; cursor: pointer; transition: all 0.2s ease;"><span aria-label='Delete' role='img'>🗑️</span></button>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(sale.customerName || sale.customername || '')}</td>
            <td>${sanitizeHTML(sale.customerPhone || sale.customerphone || '')}</td>
            <td>${sanitizeHTML(firstItem.item || '')}</td>
            <td>${sanitizeHTML(firstItem.width ?? '')}</td>
            <td>${sanitizeHTML(firstItem.length ?? '')}</td>
            <td>${sanitizeHTML(firstItem.space ?? '')}</td>
            <td>${sanitizeHTML(firstItem.quantity ?? '')}</td>
            <td>$${sanitizeHTML(firstItem.unitPrice ?? '')}</td>
            <td>${sanitizeHTML(sale.discount ? sale.discount + '%' : '0%')}</td>
            <td>$${sanitizeHTML(firstItem.itemTotal ?? '')}</td>
            <td>${sanitizeHTML(sale.status || '')}</td>
            <td>${sanitizeHTML(formatDate(sale.date) || '')}</td>
            <td>
                ${viewBtn}
                ${sale.status === 'Pending' ? `<button onclick="editSale('${sanitizeHTML(sale.id)}')" title="Edit"><span aria-label='Edit' role='img'>✏️</span></button> <button onclick="markAsDone('${sanitizeHTML(sale.id)}')" title="Mark as Done"><span aria-label='Mark as Done' role='img'>✔️</span></button>` : ''}
                ${deleteBtn}
            </td>
        `;
        salesTableBody.appendChild(row);
    });
}

/**
 * Gets the index of a sale in the sales array (by date and item total for uniqueness).
 * @param {Object} sale
 * @returns {number}
 */
function getSaleIndex(sale) {
    return sales.findIndex(s => s.date === sale.date && s.itemTotal === sale.itemTotal);
}

// Mark as Done logic (by sale.id)
window.markAsDone = async function (id) {
    let idx = sales.findIndex(s => s.id === id);
    if (idx !== -1 && sales[idx].status === 'Pending') {
        try {
            if (!window.apiClient) {
                window.showToast('API client not configured. Please check your configuration.', 'error', 'Configuration Error');
                return;
            }

            const result = await window.apiClient.updateSaleStatus(id, 'Completed');

            if (result.error) {
                throw new Error(result.error);
            }

            sales[idx].status = 'Completed';
            localStorage.setItem('starjet_last_invoice_id', sales[idx].id);
            window.location.href = `invoice.html?id=${encodeURIComponent(sales[idx].id)}`;
        } catch (err) {
            console.error('Failed to mark as done', err);
            window.showToast('Failed to mark as done. Please try again.', 'error', 'Operation Failed');
        }
    }
}

// Edit Sale logic: redirect to edit-sale.html with id
window.editSale = function (id) {
    window.location.href = `edit-sale.html?id=${encodeURIComponent(id)}`;
};
// Add CSS for .edit-grid-form to match the add sales form
if (!document.getElementById('edit-grid-form-style')) {
    const style = document.createElement('style');
    style.id = 'edit-grid-form-style';
    style.innerHTML = `
    .edit-grid-form {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px 24px;
        margin-bottom: 24px;
    }
    @media (max-width: 900px) {
        .edit-grid-form {
            grid-template-columns: 1fr;
            gap: 12px 0;
        }
    }
    `;
    document.head.appendChild(style);
}
function closeEditPopup() {
    editPopup.style.display = 'none';
}
window.closeEditPopup = closeEditPopup;

// ===============================
// Filter Controls
// ===============================

/**
 * Populates month and year filter dropdowns based on sales data.
 */
function populateMonthYearFilters() {
    // Months
    // This function is still present from previous versions but month/year dropdowns were removed from HTML.
    // It's not being used with the new date range filters (startDateInput, endDateInput).
    // Keeping it for now in case it's planned for future use or if old filter elements are re-added.
}

// ===============================
// Status Toggle
// ===============================

/**
 * Toggles the status of a sale between Pending and Completed, then saves and re-renders.
 * @param {number} idx
 */
window.toggleStatus = async function (idx) {
    if (sales[idx]) {
        const newStatus = sales[idx].status === 'Pending' ? 'Completed' : 'Pending';
        try {
            if (!window.apiClient) {
                window.showToast('API client not configured. Please check your configuration.', 'error', 'Configuration Error');
                return;
            }

            const result = await window.apiClient.updateSaleStatus(sales[idx].id, newStatus);

            if (result.error) {
                throw new Error(result.error);
            }

            sales[idx].status = newStatus;
            renderTable();
        } catch (err) {
            console.error('Failed to toggle status', err);
            window.showToast('Failed to toggle status.', 'error', 'Operation Failed');
        }
    }
}

// ===============================
// Real-time Table Update
// ===============================

// Listen for storage changes (other tabs/windows)
window.addEventListener('storage', async function () {
    sales = await loadSales();
    renderAllSections();
});

// Also update table immediately if a sale is added in the same tab
window.addEventListener('focus', async function () {
    sales = await loadSales();
    renderAllSections();
});

// ===============================
// Filter Button Logic
// ===============================

document.getElementById('filterBtn').addEventListener('click', renderAllSections);

// ===============================
/**
 * Enhanced CSV Export with security validation and error handling
 * 
 * SECURITY FEATURES:
 * - Data sanitization before export
 * - CSV injection prevention
 * - Rate limiting on exports
 * - Comprehensive error handling
 */
document.getElementById('exportBtn').addEventListener('click', async function () {
    const timestamp = new Date().toISOString();

    // Rate limiting for export
    if (window.lastExportTime && (Date.now() - window.lastExportTime) < 5000) {
        console.warn('🔐 Security: Export rate limited', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'exportBtn.click'
        });
        window.showToast('Please wait a moment before exporting again.', 'warning', 'Rate Limit');
        return;
    }

    try {
        console.log('📊 Export started:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'exportBtn.click'
        });

        // Export only completed sales with validation
        let completedSales = Array.isArray(sales) ? sales.filter(sale =>
            sale && sale.status === 'Completed' && typeof sale === 'object'
        ) : [];

        // Limit export size for security
        if (completedSales.length > TRACKING_SECURITY_CONFIG.MAX_EXPORT_RECORDS) {
            console.warn('🔐 Security: Export size limited', {
                timestamp: timestamp,
                file: 'sales-track.js',
                function: 'exportBtn.click',
                requestedCount: completedSales.length,
                maxAllowed: TRACKING_SECURITY_CONFIG.MAX_EXPORT_RECORDS
            });
            completedSales = completedSales.slice(0, TRACKING_SECURITY_CONFIG.MAX_EXPORT_RECORDS);
        }

        // Convert to CSV with security measures
        const headers = ['Customer Name', 'Customer Phone', 'Status', 'Date', 'Discount', 'Item', 'Width', 'Length', 'Space', 'Quantity', 'Unit Price', 'Item Total'];
        const rows = [];

        completedSales.forEach((sale, saleIndex) => {
            if (!sale || !Array.isArray(sale.items)) {
                return;
            }

            sale.items.forEach((item, itemIndex) => {
                if (!item || typeof item !== 'object') {
                    return;
                }

                // Sanitize all data before export
                const sanitizedRow = [
                    sanitizeExportData(sale.customerName || ''),
                    sanitizeExportData(sale.customerPhone || ''),
                    sanitizeExportData(sale.status || ''),
                    sanitizeExportData(sale.date || ''),
                    sanitizeExportData(sale.discount || 0),
                    sanitizeExportData(item.item || ''),
                    sanitizeExportData(item.width || ''),
                    sanitizeExportData(item.length || ''),
                    sanitizeExportData(item.space || ''),
                    sanitizeExportData(item.quantity || ''),
                    sanitizeExportData(item.unitPrice || ''),
                    sanitizeExportData(item.itemTotal || '')
                ];

                rows.push(sanitizedRow);
            });
        });

        // Generate CSV with proper escaping
        const csvContent = generateSecureCSV(headers, rows);

        // Download CSV with timestamp
        const fileName = `completed_sales_export_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCSV(csvContent, fileName);

        window.lastExportTime = Date.now();

        console.log('📊 Export completed successfully:', {
            timestamp: new Date().toISOString(),
            file: 'sales-track.js',
            function: 'exportBtn.click',
            exportedRecords: rows.length,
            fileName: fileName
        });

    } catch (error) {
        console.error('🔐 Export error:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'exportBtn.click',
            error: error.message,
            stack: error.stack
        });
        window.showToast('Export failed. Please try again or contact support.', 'error', 'Export Failed');
    }
});

/**
 * Sanitize data for export to prevent CSV injection
 * 
 * @param {any} data - Data to sanitize
 * @returns {string} Sanitized data string
 */
function sanitizeExportData(data) {
    if (data === null || data === undefined) {
        return '';
    }

    const stringData = String(data);

    // Remove potentially dangerous characters
    return stringData
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .replace(/^[=+\-@]/g, '') // Remove CSV injection characters
        .trim();
}

/**
 * Generate secure CSV content with proper escaping
 * 
 * @param {Array} headers - CSV headers
 * @param {Array} rows - CSV data rows
 * @returns {string} Properly escaped CSV content
 */
function generateSecureCSV(headers, rows) {
    const escapeCSV = (value) => {
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const headerRow = headers.map(escapeCSV).join(',');
    const dataRows = rows.map(row => row.map(escapeCSV).join(','));

    return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file with security measures
 * 
 * @param {string} csvContent - CSV content to download
 * @param {string} fileName - Name of the file
 */
function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===============================
// Enhanced Delete Logic with Role-Based Permissions
// ===============================

/**
 * Initialize delete functionality with role-based permissions
 * 
 * SECURITY: Only admins can delete sales, with proper confirmation modals
 */
function initializeDeleteFunctionality() {
    const timestamp = new Date().toISOString();

    try {
        // Check if user is admin
        const isAdmin = window.accessControl && window.accessControl.getCurrentRole() === 'admin';

        // Setup delete modal elements
        const deleteModal = document.getElementById('deleteModal');
        const deleteModalMessage = document.getElementById('deleteModalMessage');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

        // Setup modal event listeners
        if (deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', function () {
                deleteModal.style.display = 'none';
            });

            // Close modal when clicking outside
            deleteModal.addEventListener('click', function (e) {
                if (e.target === deleteModal) {
                    deleteModal.style.display = 'none';
                }
            });
        }

        console.log('🔐 Delete functionality initialized:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'initializeDeleteFunctionality',
            isAdmin: isAdmin
        });

    } catch (error) {
        console.error('🔐 Error initializing delete functionality:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'initializeDeleteFunctionality',
            error: error.message
        });
    }
}

/**
 * Show delete confirmation modal
 * 
 * @param {string} itemType - Type of item being deleted ('sale' or 'expense')
 * @param {string} itemId - ID of the item
 * @param {string} itemName - Name/description of the item
 * @param {Function} onConfirm - Callback function to execute on confirmation
 * 
 * SECURITY: Provides secure confirmation before deletion
 */
function showDeleteModal(itemType, itemId, itemName, onConfirm) {
    const timestamp = new Date().toISOString();

    try {
        const deleteModal = document.getElementById('deleteModal');
        const deleteModalMessage = document.getElementById('deleteModalMessage');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        if (deleteModal && deleteModalMessage && confirmDeleteBtn) {
            // Set modal message
            deleteModalMessage.textContent = `Are you sure you want to delete this ${itemType}? "${itemName}" (ID: ${itemId})`;

            // Remove existing event listeners
            const newConfirmBtn = confirmDeleteBtn.cloneNode(true);
            confirmDeleteBtn.parentNode.replaceChild(newConfirmBtn, confirmDeleteBtn);

            // Add new event listener
            newConfirmBtn.addEventListener('click', async function () {
                try {
                    await onConfirm();
                    deleteModal.style.display = 'none';
                } catch (error) {
                    console.error('🔐 Delete operation failed:', error);
                    alert('Delete operation failed. Please try again.');
                }
            });

            // Show modal
            deleteModal.style.display = 'block';

            console.log('🔐 Delete modal shown:', {
                timestamp: timestamp,
                file: 'sales-track.js',
                function: 'showDeleteModal',
                itemType: itemType,
                itemId: itemId
            });
        }

    } catch (error) {
        console.error('🔐 Error showing delete modal:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'showDeleteModal',
            error: error.message
        });
    }
}

/**
 * Delete individual sale (admin only)
 * 
 * @param {string} saleId - ID of the sale to delete
 * 
 * SECURITY: Admin-only function with proper validation
 */
window.deleteSale = async function (saleId) {
    const timestamp = new Date().toISOString();

    try {
        // Check admin permissions
        const isAdmin = window.accessControl && window.accessControl.getCurrentRole() === 'admin';
        if (!isAdmin) {
            console.warn('🔐 Security: Non-admin attempted to delete sale:', {
                timestamp: timestamp,
                file: 'sales-track.js',
                function: 'deleteSale',
                saleId: saleId
            });
            window.showToast('You do not have permission to delete sales.', 'error', 'Permission Denied');
            return;
        }

        // Find sale details
        const sale = sales.find(s => s.id === saleId);
        if (!sale) {
            window.showToast('Sale not found.', 'error', 'Not Found');
            return;
        }

        // Show confirmation modal
        showDeleteModal('sale', saleId, sale.customerName || 'Unknown Customer', async function () {
            if (!window.apiClient) {
                throw new Error('API client not configured');
            }

            const result = await window.apiClient.deleteSale(saleId);
            if (result.error) {
                throw new Error(result.error);
            }

            // Remove from local array
            const index = sales.findIndex(s => s.id === saleId);
            if (index !== -1) {
                sales.splice(index, 1);
            }

            // Re-render sections
            renderAllSections();

            console.log('🔐 Sale deleted successfully:', {
                timestamp: timestamp,
                file: 'sales-track.js',
                function: 'deleteSale',
                saleId: saleId
            });
        });

    } catch (error) {
        console.error('🔐 Error deleting sale:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'deleteSale',
            error: error.message
        });
        window.showToast('Failed to delete sale. Please try again.', 'error', 'Delete Failed');
    }
};

// ===============================
// New: Search, Pending Section, Rollback
// ===============================

/**
 * Enhanced search functionality with security validation
 * 
 * @type {HTMLInputElement}
 */
const customerSearchInput = document.getElementById('customerSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const pendingSalesTableBody = document.querySelector('#pendingSalesTable tbody');

let searchName = '';
let lastSearchTime = 0;

/**
 * Sanitize search input to prevent XSS and injection attacks
 * 
 * @param {string} input - The search input to sanitize
 * @returns {string} Sanitized search string
 */
function sanitizeSearchInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .substring(0, TRACKING_SECURITY_CONFIG.MAX_SEARCH_LENGTH) // Limit length
        .trim();
}

/**
 * Enhanced search input handler with rate limiting and validation
 */
customerSearchInput.addEventListener('input', function () {
    const timestamp = new Date().toISOString();

    // Rate limiting for search
    if (Date.now() - lastSearchTime < TRACKING_SECURITY_CONFIG.RATE_LIMIT_DELAY) {
        console.warn('🔐 Security: Search rate limited', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'customerSearchInput.input'
        });
        return;
    }

    // Sanitize and validate search input
    const rawSearchValue = this.value;
    const sanitizedSearch = sanitizeSearchInput(rawSearchValue);

    if (sanitizedSearch !== rawSearchValue) {
        console.warn('🔐 Security: Search input sanitized', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'customerSearchInput.input',
            originalLength: rawSearchValue.length,
            sanitizedLength: sanitizedSearch.length
        });
    }

    searchName = sanitizedSearch.toLowerCase();
    lastSearchTime = Date.now();

    console.log('🔍 Search performed:', {
        timestamp: timestamp,
        file: 'sales-track.js',
        function: 'customerSearchInput.input',
        searchTerm: searchName,
        searchLength: searchName.length
    });

    renderAllSections();
});

/**
 * Clear search with security logging
 */
clearSearchBtn.addEventListener('click', function () {
    const timestamp = new Date().toISOString();

    customerSearchInput.value = '';
    searchName = '';

    console.log('🔍 Search cleared:', {
        timestamp: timestamp,
        file: 'sales-track.js',
        function: 'clearSearchBtn.click'
    });

    renderAllSections();
});

/**
 * Enhanced filter by search name with security validation
 * 
 * @param {Array} salesArr - Array of sales to filter
 * @returns {Array} Filtered sales array
 */
function filterBySearchName(salesArr) {
    if (!searchName || !Array.isArray(salesArr)) {
        return salesArr;
    }

    const timestamp = new Date().toISOString();

    try {
        const filtered = salesArr.filter(sale => {
            if (!sale || typeof sale !== 'object') {
                return false;
            }

            const customerName = (sale.customerName || sale.customername || '').toLowerCase();
            return customerName.includes(searchName);
        });

        console.log('🔍 Search filter applied:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'filterBySearchName',
            searchTerm: searchName,
            originalCount: salesArr.length,
            filteredCount: filtered.length
        });

        return filtered;
    } catch (error) {
        console.error('🔐 Error in search filter:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'filterBySearchName',
            error: error.message,
            searchTerm: searchName
        });
        return salesArr; // Return original array on error
    }
}

// Render Pending Sales Section (always all pending, ignores filters/search)
function renderPendingSection() {
    const arraySafe = Array.isArray(sales) ? sales : [];
    const pending = arraySafe.filter(sale => sale && sale.status === 'Pending');
    pendingSalesTableBody.innerHTML = '';
    if (pending.length === 0) {
        pendingSalesTableBody.innerHTML = '<tr><td colspan="13">No pending sales.</td></tr>';
        return;
    }
    pending.forEach((sale) => {
        let firstItem = (sale.items && sale.items.length > 0) ? sale.items[0] : sale;
        let deleteBtn = '';

        // Show delete button for admins only
        const isAdmin = window.accessControl && window.accessControl.getCurrentRole() === 'admin';
        if (isAdmin) {
            deleteBtn = `<button onclick="deleteSale('${sale.id}')" title="Delete" style="background: #dc3545; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; margin: 0 2px; cursor: pointer; transition: all 0.2s ease;"><span aria-label='Delete' role='img'>🗑️</span></button>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(sale.customerName || sale.customername || '')}</td>
            <td>${sanitizeHTML(sale.customerPhone || sale.customerphone || '')}</td>
            <td>${sanitizeHTML(firstItem.item || '')}</td>
            <td>${sanitizeHTML(firstItem.width ?? '')}</td>
            <td>${sanitizeHTML(firstItem.length ?? '')}</td>
            <td>${sanitizeHTML(firstItem.space ?? '')}</td>
            <td>${sanitizeHTML(firstItem.quantity ?? '')}</td>
            <td>$${sanitizeHTML(firstItem.unitPrice ?? '')}</td>
            <td>${sanitizeHTML(sale.discount ? sale.discount + '%' : '0%')}</td>
            <td>$${sanitizeHTML(firstItem.itemTotal ?? '')}</td>
            <td>${sanitizeHTML(sale.status || '')}</td>
            <td>${sanitizeHTML(formatDate(sale.date) || '')}</td>
            <td style="text-align: center;">
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                    <button onclick="editSale('${sanitizeHTML(sale.id)}')" title="Edit" style="background: #b3006b; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; transition: all 0.2s ease;"><span aria-label='Edit' role='img'>✏️</span></button>
                    <button onclick="markAsDone('${sanitizeHTML(sale.id)}')" title="Mark as Done" style="background: #28a745; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; transition: all 0.2s ease;"><span aria-label='Mark as Done' role='img'>✔️</span></button>
                    ${deleteBtn}
                </div>
            </td>
        `;
        pendingSalesTableBody.appendChild(row);
    });
}

// Render Sales Tracking Section (non-pending, with filters/search)
function renderTrackingSection() {
    const arraySafe = Array.isArray(sales) ? sales : [];
    let filtered = arraySafe.filter(sale => sale && sale.status !== 'Pending');
    // Apply search
    filtered = filterBySearchName(filtered);
    const statusVal = currentStatusState;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    // Only show completed sales if a filter or search is active
    const isSearchActive = !!searchName;
    const isFilterActive = (statusVal !== 'Pending' && statusVal !== 'all') || startDate || endDate;
    if (!isSearchActive && !isFilterActive) {
        // No search, no filter: show nothing
        salesTableBody.innerHTML = '<tr><td colspan="13">No sales found.</td></tr>';
        return;
    }
    // Apply filters (date, status, etc.)
    if (!startDate && !endDate && statusVal !== 'Pending') {
        const today = new Date().toISOString().slice(0, 10);
        filtered = filtered.filter(sale => sale.date && sale.date.slice(0, 10) === today);
    }
    if (startDate) {
        filtered = filtered.filter(sale => sale.date && sale.date.slice(0, 10) >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(sale => sale.date && sale.date.slice(0, 10) <= endDate);
    }
    if (statusVal !== 'all' && statusVal !== 'Pending') {
        filtered = filtered.filter(sale => sale.status === statusVal);
    }
    salesTableBody.innerHTML = '';
    if (filtered.length === 0) {
        salesTableBody.innerHTML = '<tr><td colspan="13">No sales found.</td></tr>';
        return;
    }
    filtered.forEach((sale) => {
        let firstItem = (sale.items && sale.items.length > 0) ? sale.items[0] : sale;
        let viewBtn = '';

        if (sale.status === 'Completed') {
            viewBtn = `<a href="invoice.html?id=${sale.id}" title="View Invoice"><span aria-label='View' role='img'>👁️</span></a>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(sale.customerName || sale.customername || '')}</td>
            <td>${sanitizeHTML(sale.customerPhone || sale.customerphone || '')}</td>
            <td>${sanitizeHTML(firstItem.item || '')}</td>
            <td>${sanitizeHTML(firstItem.width ?? '')}</td>
            <td>${sanitizeHTML(firstItem.length ?? '')}</td>
            <td>${sanitizeHTML(firstItem.space ?? '')}</td>
            <td>${sanitizeHTML(firstItem.quantity ?? '')}</td>
            <td>$${sanitizeHTML(firstItem.unitPrice ?? '')}</td>
            <td>${sanitizeHTML(sale.discount ? sale.discount + '%' : '0%')}</td>
            <td>$${sanitizeHTML(firstItem.itemTotal ?? '')}</td>
            <td>${sanitizeHTML(sale.status || '')}</td>
            <td>${sanitizeHTML(formatDate(sale.date) || '')}</td>
            <td style="text-align: center;">
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                ${viewBtn}
                    <button onclick="rollbackSale('${sanitizeHTML(sale.id)}')" title="Rollback" style="background: #ffc107; color: #000; border: none; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; transition: all 0.2s ease;"><span aria-label='Rollback' role='img'>⏪</span></button>
                </div>
            </td>
        `;
        salesTableBody.appendChild(row);
    });
}

// Calculate and update summary cards for completed sales
/**
 * Update summary cards with enhanced logic for pending sales
 * 
 * SECURITY: Includes comprehensive error handling and data validation
 */
function updateSummaryCards() {
    const timestamp = new Date().toISOString();

    try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

        // Filter sales by status
        const completedSales = sales.filter(sale => sale.status === 'Completed');
        const pendingSales = sales.filter(sale => sale.status === 'Pending');

        // Calculate pending sales count
        const totalPendingCount = pendingSales.length;

        // Calculate completed sales totals
        const totalCompletedAmount = completedSales.reduce((sum, sale) => {
            return sum + (parseFloat(sale.total) || 0);
        }, 0);

        const monthlyCompletedAmount = completedSales
            .filter(sale => sale.date && sale.date.startsWith(thisMonth))
            .reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);

        const dailyCompletedAmount = completedSales
            .filter(sale => sale.date && sale.date.startsWith(today))
            .reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);

        // Update DOM elements with validated data
        if (totalPendingSalesEl) {
            totalPendingSalesEl.textContent = totalPendingCount.toString();
        }
        if (monthlyCompletedSalesEl) {
            monthlyCompletedSalesEl.textContent = formatCurrency(monthlyCompletedAmount);
        }
        if (dailyCompletedSalesEl) {
            dailyCompletedSalesEl.textContent = formatCurrency(dailyCompletedAmount);
        }

        console.log('🔐 Summary cards updated successfully:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'updateSummaryCards',
            pendingCount: totalPendingCount,
            monthlyAmount: monthlyCompletedAmount,
            dailyAmount: dailyCompletedAmount
        });

    } catch (error) {
        console.error('🔐 Error updating summary cards:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'updateSummaryCards',
            error: error.message
        });
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

// Main render function
function renderAllSections() {
    renderPendingSection();
    renderTrackingSection();
    updateSummaryCards();
}

// Rollback logic for completed sales
window.rollbackSale = async function (id) {
    const idx = sales.findIndex(s => s.id === id && s.status === 'Completed');
    if (idx === -1) return;
    if (confirm('⚠ Are you sure you want to roll back this sale to pending?')) {
        try {
            if (!window.apiClient) {
                throw new Error('API client not configured');
            }

            const result = await window.apiClient.updateSaleStatus(id, 'Pending');

            if (result.error) {
                console.error('Database rollback error:', result.error);
                throw new Error(`Database error: ${result.error}`);
            }

            if (!result.sale) {
                throw new Error('No sale found to rollback');
            }

            // Update local state only after successful database update
            sales[idx].status = 'Pending';
            renderAllSections();
            window.showToast('Sale successfully rolled back to pending.', 'success', 'Rollback Successful');

        } catch (err) {
            console.error('Rollback error details:', err);

            // Check if it's a network/connection error vs actual database error
            if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('timeout')) {
                window.showToast('Network error during rollback. Please check your connection and try again.', 'error', 'Network Error');
            } else if (err.message.includes('Database error:')) {
                window.showToast(`Rollback failed: ${err.message}`, 'error', 'Database Error');
            } else {
                window.showToast('Rollback failed. Please try again or contact support.', 'error', 'Rollback Failed');
            }
        }
    }
}



/**
 * Handle status toggle button click
 * 
 * SECURITY: Maintains existing logic while providing new UI interaction
 */
function handleStatusToggle() {
    const timestamp = new Date().toISOString();

    try {
        // Find current state index and move to next
        const currentIndex = statusStates.indexOf(currentStatusState);
        const nextIndex = (currentIndex + 1) % statusStates.length;
        currentStatusState = statusStates[nextIndex];

        // Update button display
        updateStatusToggleButton();

        // Re-render sections
        renderAllSections();

        console.log('🔐 Status toggle updated:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'handleStatusToggle',
            newState: currentStatusState
        });

    } catch (error) {
        console.error('🔐 Error handling status toggle:', {
            timestamp: timestamp,
            file: 'sales-track.js',
            function: 'handleStatusToggle',
            error: error.message
        });
    }
}

// Filter/refresh triggers
statusToggleBtn.addEventListener('click', handleStatusToggle);
startDateInput.addEventListener('change', renderAllSections);
endDateInput.addEventListener('change', renderAllSections);
document.getElementById('filterBtn').addEventListener('click', renderAllSections);

// Real-time update on storage/focus
window.addEventListener('storage', function () {
    sales = loadSales();
    renderAllSections();
});
window.addEventListener('focus', function () {
    sales = loadSales();
    renderAllSections();
});

// Initialize delete functionality
initializeDeleteFunctionality();

// Initial render
renderAllSections();

// View Quotation logic
window.viewQuotation = function (id) {
    localStorage.setItem('starjet_last_quotation_id', id);
    window.location.href = `quotation.html?id=${encodeURIComponent(id)}`;
}
// View Invoice logic: only set id and redirect
window.viewInvoice = function (id) {
    localStorage.setItem('starjet_last_invoice_id', id);
    window.location.href = `invoice.html?id=${encodeURIComponent(id)}`;
}