/**
 * Expenses Management Handler for Star Jet Application
 * 
 * This module handles expense entry, validation, and secure data submission to Supabase.
 * It provides comprehensive expense tracking with proper validation, error handling,
 * and security measures for financial data management.
 * 
 * FEATURES:
 * - Secure expense entry with validation
 * - Real-time data submission to Supabase
 * - Category-based expense organization
 * - Date-based expense tracking
 * - Comprehensive error handling and user feedback
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Financial data protection
 * - Rate limiting on submissions
 * - Secure error handling without information disclosure
 * - Audit logging for financial transactions
 * 
 * File: expenses.js
 * Dependencies: supabase.js, auth.js, access-control.js
 * Called from: expenses.html
 * 
 * @author Star Jet Development Team
 * @version 2.0.0
 * @lastUpdated 2024
 */

// Security and validation constants
const EXPENSES_SECURITY_CONFIG = {
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_AMOUNT: 1000000, // $1M limit
    MIN_AMOUNT: 0.01,
    MAX_EXPENSES_PER_DAY: 100,
    RATE_LIMIT_DELAY: 2000, // milliseconds
    ALLOWED_CATEGORIES: ['work', 'non-work']
};

/**
 * Sanitize input to prevent XSS and injection attacks
 * 
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized input string
 * 
 * SECURITY: Removes potentially dangerous HTML/script tags and characters
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
}

/**
 * Validate expense amount with security bounds
 * 
 * @param {string|number} amount - The amount to validate
 * @returns {object} Validation result with isValid and sanitizedValue
 */
function validateExpenseAmount(amount) {
    const sanitizedAmount = sanitizeInput(String(amount));
    const numericAmount = parseFloat(sanitizedAmount);

    if (isNaN(numericAmount)) {
        console.warn('🔐 Validation: Invalid expense amount:', amount);
        return { isValid: false, sanitizedValue: 0 };
    }

    if (numericAmount < EXPENSES_SECURITY_CONFIG.MIN_AMOUNT || numericAmount > EXPENSES_SECURITY_CONFIG.MAX_AMOUNT) {
        console.warn('🔐 Validation: Expense amount out of bounds:', numericAmount,
            `(min: ${EXPENSES_SECURITY_CONFIG.MIN_AMOUNT}, max: ${EXPENSES_SECURITY_CONFIG.MAX_AMOUNT})`);
        return { isValid: false, sanitizedValue: numericAmount };
    }

    return { isValid: true, sanitizedValue: numericAmount };
}

/**
 * Validate expense description with security bounds
 * 
 * @param {string} description - The description to validate
 * @returns {object} Validation result with isValid and sanitizedValue
 */
function validateExpenseDescription(description) {
    const sanitizedDescription = sanitizeInput(description);

    if (!sanitizedDescription || sanitizedDescription.length === 0) {
        console.warn('🔐 Validation: Empty expense description');
        return { isValid: false, sanitizedValue: '' };
    }

    if (sanitizedDescription.length > EXPENSES_SECURITY_CONFIG.MAX_DESCRIPTION_LENGTH) {
        console.warn('🔐 Validation: Expense description too long:', sanitizedDescription.length,
            `(max: ${EXPENSES_SECURITY_CONFIG.MAX_DESCRIPTION_LENGTH})`);
        return { isValid: false, sanitizedValue: sanitizedDescription };
    }

    return { isValid: true, sanitizedValue: sanitizedDescription };
}

/**
 * Validate expense category against allowed values
 * 
 * @param {string} category - The category to validate
 * @returns {object} Validation result with isValid and sanitizedValue
 */
function validateExpenseCategory(category) {
    const sanitizedCategory = sanitizeInput(category);

    if (!EXPENSES_SECURITY_CONFIG.ALLOWED_CATEGORIES.includes(sanitizedCategory)) {
        console.warn('🔐 Validation: Invalid expense category:', category);
        return { isValid: false, sanitizedValue: '' };
    }

    return { isValid: true, sanitizedValue: sanitizedCategory };
}

/**
 * Validate expense date with security bounds
 * 
 * @param {string} date - The date to validate
 * @returns {object} Validation result with isValid and sanitizedValue
 */
function validateExpenseDate(date) {
    const sanitizedDate = sanitizeInput(date);

    if (!sanitizedDate) {
        console.warn('🔐 Validation: Empty expense date');
        return { isValid: false, sanitizedValue: '' };
    }

    // Validate date format and reasonable range
    const dateObj = new Date(sanitizedDate);
    const currentDate = new Date();
    const minDate = new Date('2020-01-01'); // Reasonable minimum date

    if (isNaN(dateObj.getTime()) || dateObj < minDate || dateObj > currentDate) {
        console.warn('🔐 Validation: Invalid expense date:', date);
        return { isValid: false, sanitizedValue: '' };
    }

    return { isValid: true, sanitizedValue: sanitizedDate };
}

// ===============================
// Data Handling
// ===============================

/**
 * Loads expenses from Supabase with enhanced error handling and security logging
 * 
 * @returns {Promise<Array>} Array of expenses or empty array on error
 * 
 * SECURITY: Includes comprehensive error handling and audit logging
 */
async function loadExpenses() {
    try {
        if (!window.apiClient) {
            window.showToast('API client not configured. Please check your configuration.', 'error', 'Configuration Error');
            return [];
        }

        const result = await window.apiClient.getExpenses();

        if (result.error) {
            console.error('Error fetching expenses from API:', result.error);
            window.showToast('Failed to load expenses from database. Please try again.', 'error', 'Load Failed');
            return [];
        }

        return result.expenses || [];
    } catch (e) {
        console.error('Failed to load expenses from API:', e);
        window.showToast('Failed to load expenses from database. Please try again.', 'error', 'Load Failed');
        return [];
    }
}

/**
 * Saves a single expense to Supabase.
 * @param {Object} expense - The expense object to save
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function saveExpense(expense) {
    try {
        if (!window.apiClient) {
            window.showToast('API client not configured. Please check your configuration.', 'error', 'Configuration Error');
            return false;
        }

        const result = await window.apiClient.createExpense(expense);

        if (result.error) {
            console.error('Error creating expense via API:', result.error);
            window.showToast('Failed to save expense to database. Please try again.', 'error', 'Save Failed');
            return false;
        }

        return true;
    } catch (e) {
        console.error('Failed to save expense via API:', e);
        window.showToast('Failed to save expense to database. Please try again.', 'error', 'Save Failed');
        return false;
    }
}



// ===============================
// DOM Elements
// ===============================
const expenseForm = document.getElementById('expenseForm');

/**
 * Initialize expense form with auto-filled date and enhanced security
 * 
 * SECURITY: Ensures date is always set to current system date regardless of user input
 */
function initializeExpenseForm() {
    const timestamp = new Date().toISOString();

    try {
        // Auto-fill date with today's date
        const today = new Date();
        const todayString = today.toISOString().slice(0, 10); // YYYY-MM-DD format

        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = todayString;
            dateInput.setAttribute('readonly', 'readonly');

            console.log('🔐 Expense form initialized with auto-filled date:', {
                timestamp: timestamp,
                file: 'expenses.js',
                function: 'initializeExpenseForm',
                autoFilledDate: todayString
            });
        }

    } catch (error) {
        console.error('🔐 Error initializing expense form:', {
            timestamp: timestamp,
            file: 'expenses.js',
            function: 'initializeExpenseForm',
            error: error.message
        });
    }
}

/**
 * Get current system date in YYYY-MM-DD format
 * 
 * @returns {string} Current date in YYYY-MM-DD format
 * 
 * SECURITY: Always returns current system date, ignoring any user input
 */
function getCurrentSystemDate() {
    const today = new Date();
    return today.toISOString().slice(0, 10);
}

/**
 * Enhanced form submission handler with comprehensive validation and security
 * 
 * @param {Event} e - Form submission event
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Rate limiting on submissions
 * - Secure error handling
 * - Financial data protection
 * - Always uses current system date regardless of user input
 */
expenseForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const timestamp = new Date().toISOString();
    console.log('🔐 Expense form submission started:', {
        timestamp: timestamp,
        file: 'expenses.js',
        function: 'expenseForm.submit'
    });

    // Rate limiting check
    if (window.lastExpenseSubmissionTime && (Date.now() - window.lastExpenseSubmissionTime) < EXPENSES_SECURITY_CONFIG.RATE_LIMIT_DELAY) {
        console.warn('🔐 Security: Expense form submission rate limited', {
            timestamp: timestamp,
            file: 'expenses.js',
            function: 'expenseForm.submit'
        });
        window.showToast('Please wait a moment before submitting another expense.', 'warning', 'Rate Limit');
        return;
    }

    // Get and validate form inputs (date will be overridden with system date)
    const rawDescription = document.getElementById('description').value;
    const rawAmount = document.getElementById('amount').value;
    const rawCategory = document.getElementById('category').value;

    // SECURITY: Always use current system date, ignore any user input
    const systemDate = getCurrentSystemDate();

    // Enhanced validation with security bounds
    const descriptionValidation = validateExpenseDescription(rawDescription);
    const amountValidation = validateExpenseAmount(rawAmount);
    const dateValidation = validateExpenseDate(systemDate); // Use system date
    const categoryValidation = validateExpenseCategory(rawCategory);

    // Collect validation errors
    const validationErrors = [];

    if (!descriptionValidation.isValid) {
        validationErrors.push('Please enter a valid description (max 500 characters).');
    }

    if (!amountValidation.isValid) {
        validationErrors.push(`Please enter a valid amount between $${EXPENSES_SECURITY_CONFIG.MIN_AMOUNT} and $${EXPENSES_SECURITY_CONFIG.MAX_AMOUNT.toLocaleString()}.`);
    }

    if (!dateValidation.isValid) {
        validationErrors.push('System date validation failed. Please refresh the page and try again.');
    }

    if (!categoryValidation.isValid) {
        validationErrors.push('Please select a valid category.');
    }

    // Show validation errors if any
    if (validationErrors.length > 0) {
        console.warn('🔐 Validation: Expense form validation failed', {
            timestamp: timestamp,
            file: 'expenses.js',
            function: 'expenseForm.submit',
            errors: validationErrors
        });
        window.showToast('Please correct the following errors:\n\n' + validationErrors.join('\n'), 'error', 'Validation Errors');
        return;
    }

    // Create secure expense entry with validated data
    const expenseEntry = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
        description: descriptionValidation.sanitizedValue,
        amount: amountValidation.sanitizedValue,
        date: systemDate, // Always use system date
        category: categoryValidation.sanitizedValue,
        type: 'expense',
        timestamp: timestamp
    };

    console.log('🔐 Expense entry created:', {
        timestamp: timestamp,
        file: 'expenses.js',
        function: 'expenseForm.submit',
        expenseId: expenseEntry.id,
        amount: expenseEntry.amount,
        category: expenseEntry.category
    });

    // Save to Supabase with enhanced error handling
    const success = await saveExpense(expenseEntry);

    if (success) {
        // Update rate limiting timestamp
        window.lastExpenseSubmissionTime = Date.now();

        // Reset form securely
        expenseForm.reset();
        document.getElementById('date').value = new Date().toISOString().slice(0, 10);

        console.log('🔐 Expense saved successfully:', {
            timestamp: new Date().toISOString(),
            file: 'expenses.js',
            function: 'expenseForm.submit',
            expenseId: expenseEntry.id
        });

        // Show success message
        window.showToast('Expense entry added successfully!', 'success', 'Success');
    } else {
        console.error('🔐 Expense save failed:', {
            timestamp: new Date().toISOString(),
            file: 'expenses.js',
            function: 'expenseForm.submit',
            expenseId: expenseEntry.id
        });
    }
});

// ===============================
// Initialize
// ===============================

/**
 * Initialize expense form when DOM is loaded
 * 
 * SECURITY: Ensures date field is properly configured and auto-filled
 */
document.addEventListener('DOMContentLoaded', function () {
    initializeExpenseForm();
});

// ===============================
// End of expenses.js
// =============================== 