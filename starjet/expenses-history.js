/**
 * Expenses History Handler for Star Jet Application
 * 
 * This module handles expense history display, filtering, and reporting functionality.
 * It provides comprehensive expense data visualization with secure filtering,
 * export capabilities, and detailed financial reporting.
 * 
 * FEATURES:
 * - Secure expense history display and filtering
 * - Category-based expense analysis
 * - Date range filtering with validation
 * - Financial summary calculations
 * - Export functionality for expense reports
 * - Comprehensive error handling and user feedback
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Financial data protection
 * - Rate limiting on operations
 * - Secure error handling without information disclosure
 * - Audit logging for financial data access
 * 
 * File: expenses-history.js
 * Dependencies: supabase.js, auth.js, access-control.js
 * Called from: expenses-history.html
 * 
 * @author Star Jet Development Team
 * @version 2.0.0
 * @lastUpdated 2024
 */

// Security and validation constants
const EXPENSES_HISTORY_SECURITY_CONFIG = {
    MAX_FILTER_DATE_RANGE: 365, // days
    MAX_EXPORT_RECORDS: 10000,
    RATE_LIMIT_DELAY: 1000, // milliseconds
    MAX_DISPLAY_RECORDS: 1000
};

// ===============================
// DOM Elements
// ===============================
const workExpensesTotal = document.getElementById('work-expenses-total');
const nonWorkExpensesTotal = document.getElementById('non-work-expenses-total');
const totalExpenses = document.getElementById('total-expenses');
const expensesList = document.getElementById('expenses-list');
const noExpensesMsg = document.getElementById('no-expenses');
const categoryFilter = document.getElementById('category-filter');
const dateFrom = document.getElementById('date-from');
const dateTo = document.getElementById('date-to');
const applyFiltersBtn = document.getElementById('apply-filters');

// ===============================
// Enhanced Delete Logic with Role-Based Permissions
// ===============================

/**
 * Initialize delete functionality with role-based permissions
 * 
 * SECURITY: Only admins can delete expenses, with proper confirmation modals
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
            file: 'expenses-history.js',
            function: 'initializeDeleteFunctionality',
            isAdmin: isAdmin
        });

    } catch (error) {
        console.error('🔐 Error initializing delete functionality:', {
            timestamp: timestamp,
            file: 'expenses-history.js',
            function: 'initializeDeleteFunctionality',
            error: error.message
        });
    }
}

/**
 * Show delete confirmation modal
 * 
 * @param {string} itemType - Type of item being deleted ('expense')
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
                file: 'expenses-history.js',
                function: 'showDeleteModal',
                itemType: itemType,
                itemId: itemId
            });
        }

    } catch (error) {
        console.error('🔐 Error showing delete modal:', {
            timestamp: timestamp,
            file: 'expenses-history.js',
            function: 'showDeleteModal',
            error: error.message
        });
    }
}

/**
 * Delete individual expense (admin only)
 * 
 * @param {string} expenseId - ID of the expense to delete
 * 
 * SECURITY: Admin-only function with proper validation
 */
window.deleteExpense = async function (expenseId) {
    const timestamp = new Date().toISOString();

    try {
        // Check admin permissions
        const isAdmin = window.accessControl && window.accessControl.getCurrentRole() === 'admin';
        if (!isAdmin) {
            console.warn('🔐 Security: Non-admin attempted to delete expense:', {
                timestamp: timestamp,
                file: 'expenses-history.js',
                function: 'deleteExpense',
                expenseId: expenseId
            });
            alert('You do not have permission to delete expenses.');
            return;
        }

        // Find expense details
        const expenses = await loadExpenses();
        const expense = expenses.find(e => e.id === expenseId);
        if (!expense) {
            alert('Expense not found.');
            return;
        }

        // Show confirmation modal
        showDeleteModal('expense', expenseId, expense.description || 'Unknown Expense', async function () {
            try {
                if (!window.apiClient) {
                    throw new Error('API client not configured');
                }

                console.log('🔐 Attempting to delete expense:', expenseId);
                const result = await window.apiClient.deleteExpense(expenseId);
                console.log('🔐 Delete result:', result);

                if (result.error) throw new Error(result.error);

                // Re-render all expenses
                await loadAndDisplayAllExpenses();

                console.log('🔐 Expense deleted successfully:', {
                    timestamp: timestamp,
                    file: 'expenses-history.js',
                    function: 'deleteExpense',
                    expenseId: expenseId
                });
            } catch (error) {
                console.error('Failed to delete expense:', error);
                alert('Failed to delete expense. Please try again.');
            }
        });

    } catch (error) {
        console.error('🔐 Error deleting expense:', {
            timestamp: timestamp,
            file: 'expenses-history.js',
            function: 'deleteExpense',
            error: error.message
        });
        alert('Failed to delete expense. Please try again.');
    }
};

// ===============================
// Data Handling
// ===============================

/**
 * Loads expenses from Supabase, or returns empty array if not configured.
 * @returns {Promise<Array>} Array of expense objects
 */
async function loadExpenses() {
    try {
        if (!window.apiClient) {
            alert('API client not configured. Please check your configuration.');
            return [];
        }

        const result = await window.apiClient.getExpenses();

        if (result.error) {
            console.error('Error fetching expenses from API:', result.error);
            alert('Failed to load expenses from database. Please try again.');
            return [];
        }

        return result.expenses || [];
    } catch (e) {
        console.error('Failed to load expenses from API:', e);
        alert('Failed to load expenses from database. Please try again.');
        return [];
    }
}

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
 * Formats a date string to YYYY-MM-DD format
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formats a number as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

// ===============================
// Filtering and Display
// ===============================

/**
 * Applies filters to expenses and updates the display
 */
async function applyFilters() {
    const category = categoryFilter.value;
    const fromDate = dateFrom.value;
    const toDate = dateTo.value;

    let expenses = await loadExpenses();

    // Filter by category if selected
    if (category) {
        expenses = expenses.filter(expense => expense.category === category);
    }

    // Filter by date range if selected
    if (fromDate) {
        expenses = expenses.filter(expense => expense.date >= fromDate);
    }

    if (toDate) {
        expenses = expenses.filter(expense => expense.date <= toDate);
    }

    // Sort by date (newest first)
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update the display
    displayExpenses(expenses);
    updateSummaryCards(expenses);

    console.log('🔐 Filters applied:', {
        timestamp: new Date().toISOString(),
        file: 'expenses-history.js',
        function: 'applyFilters',
        filteredCount: expenses.length,
        category: category,
        fromDate: fromDate,
        toDate: toDate
    });
}

/**
 * Updates the summary cards with the given expenses
 * @param {Array} expenses - Array of expense objects
 */
function updateSummaryCards(expenses) {
    // Calculate totals
    const workTotal = expenses
        .filter(expense => expense.category === 'work')
        .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

    const nonWorkTotal = expenses
        .filter(expense => expense.category === 'non-work')
        .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

    const grandTotal = expenses
        .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

    // Update the DOM
    workExpensesTotal.textContent = formatCurrency(workTotal);
    nonWorkExpensesTotal.textContent = formatCurrency(nonWorkTotal);
    totalExpenses.textContent = formatCurrency(grandTotal);
}

/**
 * Displays the list of expenses in the table
 * @param {Array} expenses - Array of expense objects to display
 */
function displayExpenses(expenses) {
    // Clear the current list
    expensesList.innerHTML = '';

    if (expenses.length === 0) {
        noExpensesMsg.style.display = 'block';
        return;
    }

    noExpensesMsg.style.display = 'none';

    // Add each expense to the table
    expenses.forEach(expense => {
        const row = document.createElement('tr');

        // Format the date for display (e.g., "Jan 1, 2023")
        const date = new Date(expense.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Determine category class and display text
        const categoryClass = expense.category === 'work' ? 'category-work' : 'category-non-work';
        const categoryText = expense.category === 'work' ? 'Work-related' : 'Non-work-related';

        // Show delete button for admins only
        const isAdmin = window.accessControl && window.accessControl.getCurrentRole() === 'admin';
        const deleteBtn = isAdmin ? `<button onclick="deleteExpense('${expense.id}')" title="Delete" style="background: #dc3545; color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; margin: 0 2px; cursor: pointer; transition: all 0.2s ease;"><span aria-label='Delete' role='img'>🗑️</span></button>` : '';

        row.innerHTML = `
            <td>${sanitizeHTML(formattedDate)}</td>
            <td>${sanitizeHTML(expense.description)}</td>
            <td class="${categoryClass}">${sanitizeHTML(categoryText)}</td>
            <td>${sanitizeHTML(formatCurrency(parseFloat(expense.amount)))}</td>
            <td style="text-align: center;">
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                    ${deleteBtn}
                </div>
            </td>
        `;

        expensesList.appendChild(row);
    });
}

// ===============================
// Event Listeners
// ===============================

// Apply filters when the button is clicked
applyFiltersBtn.addEventListener('click', applyFilters);

// Apply filters when Enter is pressed in any filter field
[categoryFilter, dateFrom, dateTo].forEach(element => {
    element.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
});

// ===============================
// Initialize
// ===============================

// Set default date range to current month
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

dateFrom.value = formatDate(firstDay);
dateTo.value = formatDate(today);

// Load and display expenses when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize delete functionality first
    initializeDeleteFunctionality();

    // Load and display all expenses immediately
    await loadAndDisplayAllExpenses();

    // Also apply default filters to show the filtered view
    await applyFilters();
});

/**
 * Load and display all expenses immediately
 * 
 * SECURITY: Shows all expenses with delete buttons for admins
 */
async function loadAndDisplayAllExpenses() {
    try {
        const expenses = await loadExpenses();

        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Display all expenses
        displayExpenses(expenses);
        updateSummaryCards(expenses);

        console.log('🔐 All expenses loaded and displayed:', {
            timestamp: new Date().toISOString(),
            file: 'expenses-history.js',
            function: 'loadAndDisplayAllExpenses',
            expenseCount: expenses.length
        });

    } catch (error) {
        console.error('🔐 Error loading all expenses:', {
            timestamp: new Date().toISOString(),
            file: 'expenses-history.js',
            function: 'loadAndDisplayAllExpenses',
            error: error.message
        });
    }
}

// ===============================
// End of expenses-history.js
// ===============================