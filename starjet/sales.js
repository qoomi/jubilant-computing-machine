/**
 * Sales Entry Handler for Star Jet Application
 * 
 * This module handles sales entry with multi-row item support, real-time calculations,
 * and secure data submission to Supabase. It includes comprehensive validation,
 * error handling, and user feedback mechanisms.
 * 
 * FEATURES:
 * - Multi-row item entry with dynamic calculations
 * - Real-time total calculations with discount support
 * - Input validation and sanitization
 * - Secure data submission to Supabase
 * - User-friendly error handling and feedback
 * 
 * SECURITY FEATURES:
 * - Input sanitization to prevent XSS
 * - Data validation before submission
 * - Secure error handling without information disclosure
 * - Rate limiting on form submissions
 * 
 * File: sales.js
 * Dependencies: supabase.js, auth.js, access-control.js
 * Called from: sales.html
 * 
 * @author Star Jet Development Team
 * @version 2.0.0
 * @lastUpdated 2024
 */

// ===============================
// Star Jet Sales Entry Logic
// ===============================

// Array kept only as an in-memory cache for UI; Supabase is the source of truth
let sales = [];

// Security and validation constants
const SECURITY_CONFIG = {
    MAX_ITEMS_PER_SALE: 50,
    MAX_QUANTITY_PER_ITEM: 10000,
    MAX_PRICE_PER_ITEM: 1000000,
    MAX_DISCOUNT_PERCENTAGE: 100,
    MIN_ITEM_DIMENSIONS: 0.01,
    MAX_ITEM_DIMENSIONS: 10000
};

// DOM Elements
const salesForm = document.getElementById('salesForm');
const widthInput = document.getElementById('width');
const lengthInput = document.getElementById('length');
const quantityInput = document.getElementById('quantity');
const unitPriceInput = document.getElementById('unitPrice');
const itemTotalInput = document.getElementById('itemTotal');
const quotationPopup = document.getElementById('quotationPopup');
const invoicePopup = document.getElementById('invoicePopup');
const discountInput = document.getElementById('discount');

// ===============================
// Real-time Calculation Handlers for Multi-Row Table
// ===============================

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
 * Validate numeric input with security bounds
 * 
 * @param {string|number} value - The value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Name of the field for error reporting
 * @returns {object} Validation result with isValid and sanitizedValue
 */
function validateNumericInput(value, min, max, fieldName) {
    const sanitizedValue = sanitizeInput(String(value));
    const numericValue = parseFloat(sanitizedValue);

    if (isNaN(numericValue)) {
        console.warn(`🔐 Validation: Invalid numeric input for ${fieldName}:`, value);
        return { isValid: false, sanitizedValue: 0 };
    }

    if (numericValue < min || numericValue > max) {
        console.warn(`🔐 Validation: ${fieldName} value out of bounds:`, numericValue, `(min: ${min}, max: ${max})`);
        return { isValid: false, sanitizedValue: numericValue };
    }

    return { isValid: true, sanitizedValue: numericValue };
}

/**
 * Calculate row total with enhanced validation and security
 * 
 * @param {string|number} width - Item width
 * @param {string|number} length - Item length  
 * @param {string|number} quantity - Item quantity
 * @param {string|number} unitPrice - Unit price
 * @returns {number} Calculated total for the row
 * 
 * SECURITY: Validates all inputs and prevents calculation overflow
 */
function calculateRowTotal(width, length, quantity, unitPrice) {
    const timestamp = new Date().toISOString();

    // Validate and sanitize all inputs
    const widthValidation = validateNumericInput(width, 0, SECURITY_CONFIG.MAX_ITEM_DIMENSIONS, 'width');
    const lengthValidation = validateNumericInput(length, 0, SECURITY_CONFIG.MAX_ITEM_DIMENSIONS, 'length');
    const quantityValidation = validateNumericInput(quantity, 0, SECURITY_CONFIG.MAX_QUANTITY_PER_ITEM, 'quantity');
    const priceValidation = validateNumericInput(unitPrice, 0, SECURITY_CONFIG.MAX_PRICE_PER_ITEM, 'unitPrice');

    const widthVal = widthValidation.sanitizedValue;
    const lengthVal = lengthValidation.sanitizedValue;
    const quantityVal = quantityValidation.sanitizedValue;
    const unitPriceVal = priceValidation.sanitizedValue;

    // Check if width and length are both provided
    const hasWidth = widthValidation.isValid && widthVal > 0;
    const hasLength = lengthValidation.isValid && lengthVal > 0;
    const hasQuantity = quantityValidation.isValid && quantityVal > 0;
    const hasUnitPrice = priceValidation.isValid && unitPriceVal > 0;

    // If both width and length are provided, calculate area × quantity × unit price
    if (hasWidth && hasLength && hasQuantity && hasUnitPrice) {
        const area = widthVal * lengthVal;
        const total = area * quantityVal * unitPriceVal;

        // Check for calculation overflow
        if (!isFinite(total) || total > Number.MAX_SAFE_INTEGER) {
            console.error('🔐 Security: Calculation overflow detected', {
                timestamp: timestamp,
                file: 'sales.js',
                function: 'calculateRowTotal',
                values: { widthVal, lengthVal, quantityVal, unitPriceVal, total }
            });
            return 0;
        }

        return total;
    }

    // If neither width nor length is provided, calculate quantity × unit price
    if (!hasWidth && !hasLength && hasQuantity && hasUnitPrice) {
        const total = quantityVal * unitPriceVal;

        // Check for calculation overflow
        if (!isFinite(total) || total > Number.MAX_SAFE_INTEGER) {
            console.error('🔐 Security: Calculation overflow detected', {
                timestamp: timestamp,
                file: 'sales.js',
                function: 'calculateRowTotal',
                values: { quantityVal, unitPriceVal, total }
            });
            return 0;
        }

        return total;
    }

    // If only one of width or length is provided, return 0 (will be caught by validation)
    return 0;
}

function updateAllTotals() {
    const rows = document.querySelectorAll('#itemsTbody tr');
    let supTotal = 0;
    rows.forEach(row => {
        const width = row.querySelector('input[name="width[]"]').value;
        const length = row.querySelector('input[name="length[]"]').value;
        const quantity = row.querySelector('input[name="quantity[]"]').value;
        const unitPrice = row.querySelector('input[name="unitPrice[]"]').value;
        const total = calculateRowTotal(width, length, quantity, unitPrice);
        row.querySelector('input[name="itemTotal[]"]').value = total > 0 ? total.toFixed(2) : '';
        supTotal += total;
    });
    document.getElementById('supTotal').value = supTotal.toFixed(2);
    // Apply discount
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    let finalTotal = supTotal;
    if (discount > 0) {
        finalTotal = supTotal * (1 - discount / 100);
    }
    document.getElementById('total').value = finalTotal.toFixed(2);
}

// Attach input event listeners for all relevant fields (delegated)
document.getElementById('itemsTbody').addEventListener('input', function (e) {
    if (["width[]", "length[]", "quantity[]", "unitPrice[]"].includes(e.target.name)) {
        updateAllTotals();
    }
});
document.getElementById('discount').addEventListener('input', updateAllTotals);

// Add event listener for dynamically added remove buttons
document.getElementById('itemsTbody').addEventListener('click', function (e) {
    if (e.target.classList.contains('a5-remove-item-btn')) {
        e.target.closest('tr').remove();
        updateAllTotals();
    }
});

// Initial calculation
updateAllTotals();

/**
 * Enhanced form submission handler with comprehensive validation and security
 * 
 * @param {Event} e - Form submission event
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Rate limiting on submissions
 * - Secure error handling
 * - Data integrity checks
 */
salesForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const timestamp = new Date().toISOString();
    console.log('🔐 Sales form submission started:', {
        timestamp: timestamp,
        file: 'sales.js',
        function: 'salesForm.submit'
    });

    // Rate limiting check
    if (window.lastSubmissionTime && (Date.now() - window.lastSubmissionTime) < 2000) {
        console.warn('🔐 Security: Form submission rate limited');
        alert('Please wait a moment before submitting again.');
        return;
    }

    const items = [];
    const rows = document.querySelectorAll('#itemsTbody tr');
    let hasError = false;
    let validationErrors = [];

    // Validate number of items
    if (rows.length > SECURITY_CONFIG.MAX_ITEMS_PER_SALE) {
        console.error('🔐 Security: Too many items in sale', {
            timestamp: timestamp,
            file: 'sales.js',
            function: 'salesForm.submit',
            itemCount: rows.length,
            maxAllowed: SECURITY_CONFIG.MAX_ITEMS_PER_SALE
        });
        alert(`Maximum ${SECURITY_CONFIG.MAX_ITEMS_PER_SALE} items allowed per sale.`);
        return;
    }

    rows.forEach((row, index) => {
        let itemEl = row.querySelector('input[name="item[]"], select[name="item[]"]');
        const item = itemEl ? sanitizeInput(itemEl.value) : '';
        const width = row.querySelector('input[name="width[]"]').value;
        const length = row.querySelector('input[name="length[]"]').value;
        const space = row.querySelector('input[name="space[]"]').value;
        const quantity = row.querySelector('input[name="quantity[]"]').value;
        const unitPrice = row.querySelector('input[name="unitPrice[]"]').value;
        const itemTotal = row.querySelector('input[name="itemTotal[]"]').value;

        // Enhanced validation logic with security bounds
        const widthValidation = validateNumericInput(width, 0, SECURITY_CONFIG.MAX_ITEM_DIMENSIONS, `width (row ${index + 1})`);
        const lengthValidation = validateNumericInput(length, 0, SECURITY_CONFIG.MAX_ITEM_DIMENSIONS, `length (row ${index + 1})`);
        const quantityValidation = validateNumericInput(quantity, 0, SECURITY_CONFIG.MAX_QUANTITY_PER_ITEM, `quantity (row ${index + 1})`);
        const priceValidation = validateNumericInput(unitPrice, 0, SECURITY_CONFIG.MAX_PRICE_PER_ITEM, `unitPrice (row ${index + 1})`);

        const hasWidth = widthValidation.isValid && widthValidation.sanitizedValue > 0;
        const hasLength = lengthValidation.isValid && lengthValidation.sanitizedValue > 0;
        const hasQuantity = quantityValidation.isValid && quantityValidation.sanitizedValue > 0;
        const hasUnitPrice = priceValidation.isValid && priceValidation.sanitizedValue > 0;

        // Check if only one dimension is provided (error case)
        if ((hasWidth && !hasLength) || (!hasWidth && hasLength)) {
            hasError = true;
            validationErrors.push(`Row ${index + 1}: Both width and length must be provided together, or neither.`);
        }

        // Check that quantity and unit price are always required
        if (!hasQuantity || !hasUnitPrice) {
            hasError = true;
        }

        // Only save rows with at least item and quantity
        if (item || quantity) {
            items.push({ item, width, length, space, quantity, unitPrice, itemTotal });
        }
    });
    if (items.length === 0) {
        window.showToast('Please iskahubi:\n• hadaad qorto Width, waa inaad racisaa Length\n• hadaad qorto Length, waa inaad qort Width\n• hadii kalena banaan kaga tag oo Quantity iyo Unit Price uun qor\n• zero wax kabadan qor si iskugu dhufto', 'warning', 'Validation Error');
        return;
    }
    if (hasError) {
        window.showToast('Please iskahubi:\n• hadaad qorto Width, waa inaad racisaa Length\n• hadaad qorto Length, waa inaad qort Width\n• hadii kalena banaan kaga tag oo Quantity iyo Unit Price uun qor\n• zero wax kabadan qor si iskugu dhufto', 'warning', 'Validation Error');
        return;
    }
    // Use lowercase column names to match your Supabase table (customername, customerphone, suptotal)
    const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    const saleDb = {
        id: generatedId, // your table requires a non-null primary key with no default
        customername: salesForm.customerName.value,
        customerphone: salesForm.customerPhone.value,
        date: new Date().toISOString(),
        items,
        discount: parseFloat(document.getElementById('discount').value) || 0,
        suptotal: parseFloat(document.getElementById('supTotal').value) || 0,
        total: parseFloat(document.getElementById('total').value) || 0,
        status: 'Pending',
    };
    try {
        if (!window.apiClient) {
            window.showToast('API client not configured. Please check your configuration.', 'error', 'Configuration Error');
            return;
        }

        // Create sale using API
        const result = await window.apiClient.createSale(saleDb);

        if (result.error) {
            throw new Error(result.error);
        }

        const newId = result.sale && (result.sale.id || result.sale.ID || result.sale.sale_id) || generatedId;
        // Success → go to quotation for this sale (prefer returned id)
        const targetId = newId ? String(newId) : '';
        window.location.href = targetId ? `quotation.html?id=${encodeURIComponent(targetId)}` : 'quotation.html';
    } catch (err) {
        console.error('Failed to save sale via API', err);
        window.showToast('Failed to save sale to the database. Please try again.', 'error', 'Save Failed');
    }
});

// ===============================
// End of sales.js
// =============================== 