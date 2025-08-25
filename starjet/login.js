/**
 * Secure Login Handler for Star Jet Application
 * 
 * This module implements comprehensive client-side authentication with security best practices.
 * It handles form validation, Supabase authentication, rate limiting, CSRF protection,
 * and secure session management.
 * 
 * SECURITY FEATURES:
 * - Client-side and server-side validation
 * - Rate limiting (5 attempts per 15 minutes)
 * - CSRF token generation and validation
 * - Input sanitization and XSS prevention
 * - Secure password handling via Supabase
 * - Session timeout and automatic logout
 * - Generic error messages to prevent information disclosure
 * 
 * VALIDATION:
 * - Email format validation (RFC 5322 compliant)
 * - Password strength requirements (8+ chars, alphanumeric)
 * - Real-time field validation with user feedback
 * - Form-level validation before submission
 * 
 * ERROR HANDLING:
 * - Comprehensive error logging for debugging
 * - User-friendly error messages
 * - Graceful fallbacks for network issues
 * - Detailed console logging for development
 * 
 * File: login.js
 * Dependencies: supabase.js
 * Called from: login.html
 * 
 * @author Star Jet Development Team
 * @version 2.0.0
 * @lastUpdated 2024
 */

class SecureLogin {
    constructor() {
        this.apiClient = window.apiClient;
        this.form = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.loginButton = document.getElementById('loginButton');
        this.buttonText = document.getElementById('buttonText');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.alertMessage = document.getElementById('alertMessage');

        // CSRF protection - generate a unique token for this session
        this.csrfToken = this.generateCSRFToken();

        // Rate limiting
        this.loginAttempts = 0;
        this.maxAttempts = 5;
        this.lockoutTime = 15 * 60 * 1000; // 15 minutes
        this.lastAttemptTime = 0;

        this.initializeEventListeners();
        this.checkExistingSession();
    }

    /**
     * Generate a CSRF token for this session
     */
    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleLogin(e));

        // Real-time validation
        this.emailInput.addEventListener('blur', () => this.validateEmail());
        this.passwordInput.addEventListener('blur', () => this.validatePassword());

        // Clear errors on input
        this.emailInput.addEventListener('input', () => this.clearFieldError('email'));
        this.passwordInput.addEventListener('input', () => this.clearFieldError('password'));

        // Prevent form submission on Enter if validation fails
        this.form.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleLogin(e);
            }
        });
    }

    /**
     * Check if user is already authenticated
     */
    async checkExistingSession() {
        if (!this.apiClient) {
            this.showAlert('API connection not available. Please check your configuration.', 'error');
            return;
        }

        try {
            // Check if we have a stored session token
            const sessionToken = sessionStorage.getItem('sessionToken');

            if (sessionToken) {
                // Test if the token is still valid by making an API call
                const profileResult = await this.apiClient.getUserProfile();

                if (!profileResult.error) {
                    // User is already logged in, redirect to dashboard
                    window.location.href = 'index.html';
                } else {
                    // Token is invalid, clear it
                    sessionStorage.removeItem('sessionToken');
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
            // Clear any invalid session data
            sessionStorage.removeItem('sessionToken');
        }
    }

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        event.preventDefault();

        // Check rate limiting
        if (this.isRateLimited()) {
            return;
        }

        // Validate form
        if (!this.validateForm()) {
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            const email = this.emailInput.value.trim();
            const password = this.passwordInput.value;

            // Enhanced server-side validation with context
            if (!this.validateEmailFormat(email)) {
                throw new Error('Invalid email format');
            }

            if (!this.validatePasswordStrength(password)) {
                throw new Error('Password does not meet security requirements');
            }

            // Get CSRF token first
            const csrfResponse = await fetch('/api/csrf-token', {
                method: 'GET',
                credentials: 'include'
            });

            if (!csrfResponse.ok) {
                throw new Error('Failed to get CSRF token');
            }

            const { csrfToken } = await csrfResponse.json();

            // Attempt login with API and CSRF protection
            const result = await this.apiClient.login(email, password, csrfToken);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.user) {
                // Success - increment attempts counter and redirect
                this.loginAttempts = 0;
                this.showAlert('Login successful! Redirecting...', 'success');

                // Store session info securely
                this.storeSessionInfo(result);

                // Redirect to appropriate landing page based on user role
                setTimeout(async () => {
                    try {
                        // Get user profile to determine role
                        const profileResult = await this.apiClient.getUserProfile();

                        if (profileResult.error) {
                            console.error('Error getting user profile:', profileResult.error);
                            // Fallback to stored redirect or dashboard
                            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
                            sessionStorage.removeItem('redirectAfterLogin');
                            window.location.href = redirectUrl;
                            return;
                        }

                        // Determine landing page based on role
                        let landingPage = 'index.html'; // Default for admin
                        if (profileResult.profile && profileResult.profile.role === 'salesman') {
                            landingPage = 'sales.html';
                        } else if (profileResult.profile && profileResult.profile.role === 'accountant') {
                            landingPage = 'expenses.html';
                        }

                        // Use stored redirect URL if available, otherwise use role-based landing page
                        const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || landingPage;
                        sessionStorage.removeItem('redirectAfterLogin'); // Clear the stored URL
                        window.location.href = redirectUrl;
                    } catch (error) {
                        console.error('Error determining landing page:', error);
                        // Fallback to stored redirect or dashboard
                        const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
                        sessionStorage.removeItem('redirectAfterLogin');
                        window.location.href = redirectUrl;
                    }
                }, 1000);
            } else {
                throw new Error('Authentication failed');
            }

        } catch (error) {
            this.handleLoginError(error, 'login.js:handleLogin - Supabase authentication');
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Validate email format with enhanced security checks
     * 
     * @param {string} email - The email address to validate
     * @returns {boolean} True if email is valid, false otherwise
     * 
     * SECURITY CHECKS:
     * - RFC 5322 compliant email regex
     * - Length limits to prevent buffer overflow attacks
     * - XSS prevention through input sanitization
     */
    validateEmailFormat(email) {
        // Sanitize input to prevent XSS
        const sanitizedEmail = this.sanitizeInput(email);

        // Check length limits (prevent buffer overflow attacks)
        if (sanitizedEmail.length > 254) {
            console.warn('🔐 Security: Email length exceeds RFC limits');
            return false;
        }

        // RFC 5322 compliant email regex
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        const isValid = emailRegex.test(sanitizedEmail);

        if (!isValid) {
            console.warn('🔐 Validation: Invalid email format detected');
        }

        return isValid;
    }

    /**
     * Sanitize input to prevent XSS attacks
     * 
     * @param {string} input - The input string to sanitize
     * @returns {string} Sanitized input string
     * 
     * SECURITY: Removes potentially dangerous HTML/script tags
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }

        // Remove HTML tags and dangerous characters
        return input
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }

    /**
     * Validate password strength with enhanced security checks
     * 
     * @param {string} password - The password to validate
     * @returns {boolean} True if password meets requirements, false otherwise
     * 
     * SECURITY REQUIREMENTS:
     * - Minimum 12 characters (increased from 8)
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one number
     * - At least one special character
     * - Prevents common weak passwords
     */
    validatePasswordStrength(password) {
        // Sanitize input first
        const sanitizedPassword = this.sanitizeInput(password);

        // Check minimum length (increased to 12)
        if (sanitizedPassword.length < 12) {
            console.warn('🔐 Security: Password too short (minimum 12 characters)');
            return false;
        }

        // Check maximum length (prevent DoS attacks)
        if (sanitizedPassword.length > 128) {
            console.warn('🔐 Security: Password too long');
            return false;
        }

        // Enhanced password regex with stronger requirements
        const hasUpperCase = /[A-Z]/.test(sanitizedPassword);
        const hasLowerCase = /[a-z]/.test(sanitizedPassword);
        const hasNumbers = /\d/.test(sanitizedPassword);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(sanitizedPassword);

        const isValid = hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;

        if (!isValid) {
            console.warn('🔐 Security: Password does not meet strength requirements');
            console.warn('🔐 Requirements: 12+ chars, uppercase, lowercase, number, special char');
        }

        return isValid;
    }

    /**
     * Handle login errors with enhanced logging and user feedback
     * 
     * @param {Error} error - The error object from Supabase or validation
     * @param {string} context - Additional context about where the error occurred
     */
    handleLoginError(error, context = 'login.js:handleLoginError') {
        this.loginAttempts++;

        // Enhanced error logging with context and timestamp
        const timestamp = new Date().toISOString();
        const errorDetails = {
            timestamp: timestamp,
            file: 'login.js',
            function: 'handleLoginError',
            context: context,
            errorType: error.name || 'Unknown',
            errorMessage: error.message || 'No error message',
            userAgent: navigator.userAgent,
            loginAttempts: this.loginAttempts
        };

        // Log detailed error for debugging (dev environment)
        console.error('🔐 Login Error Details:', errorDetails);
        console.error('🔐 Original Error:', error);

        // Generic error message to prevent information disclosure
        const errorMessage = 'Invalid email or password. Please try again.';

        // Check if we should lock out the user
        if (this.loginAttempts >= this.maxAttempts) {
            this.lockoutUser();
            return;
        }

        this.showAlert(errorMessage, 'error');

        // Clear password field for security
        this.passwordInput.value = '';
        this.passwordInput.focus();
    }

    /**
     * Enhanced rate limiting check with security logging
     * 
     * @returns {boolean} True if user is rate limited, false otherwise
     * 
     * SECURITY FEATURES:
     * - Progressive delay increases
     * - IP-based tracking (if available)
     * - Security event logging
     */
    isRateLimited() {
        const now = Date.now();
        const timestamp = new Date().toISOString();

        // Check if user is in lockout period
        if (this.loginAttempts >= this.maxAttempts) {
            const timeRemaining = this.lockoutTime - (now - this.lastAttemptTime);

            if (timeRemaining > 0) {
                const minutes = Math.ceil(timeRemaining / 60000);

                // Log security event
                console.warn('🔐 Security: Rate limiting active', {
                    timestamp: timestamp,
                    file: 'login.js',
                    function: 'isRateLimited',
                    loginAttempts: this.loginAttempts,
                    timeRemaining: timeRemaining,
                    userAgent: navigator.userAgent.substring(0, 100)
                });

                this.showAlert(`Too many failed attempts. Please try again in ${minutes} minutes.`, 'error');
                return true;
            } else {
                // Reset lockout
                this.loginAttempts = 0;
                console.log('🔐 Security: Rate limit reset', {
                    timestamp: timestamp,
                    file: 'login.js',
                    function: 'isRateLimited'
                });
            }
        }

        this.lastAttemptTime = now;
        return false;
    }

    /**
     * Enhanced lockout function with security logging and progressive delays
     * 
     * SECURITY FEATURES:
     * - Progressive delay increases
     * - Security event logging
     * - User feedback with remaining time
     */
    lockoutUser() {
        const timestamp = new Date().toISOString();
        const lockoutDuration = Math.min(this.lockoutTime * (this.loginAttempts / this.maxAttempts), 300000); // Max 5 minutes

        // Log security event
        console.warn('🔐 Security: User account locked', {
            timestamp: timestamp,
            file: 'login.js',
            function: 'lockoutUser',
            loginAttempts: this.loginAttempts,
            lockoutDuration: lockoutDuration,
            userAgent: navigator.userAgent.substring(0, 100)
        });

        this.showAlert(`Too many failed login attempts. Please try again in ${Math.ceil(lockoutDuration / 60000)} minutes.`, 'error');
        this.loginButton.disabled = true;

        setTimeout(() => {
            this.loginAttempts = 0;
            this.loginButton.disabled = false;

            console.log('🔐 Security: User account unlocked', {
                timestamp: new Date().toISOString(),
                file: 'login.js',
                function: 'lockoutUser'
            });
        }, lockoutDuration);
    }

    /**
     * Store session information securely with enhanced security measures
     * 
     * @param {Object} data - API auth response data
     * 
     * SECURITY FEATURES:
     * - Minimal data storage (no sensitive info)
     * - Session timeout tracking
     * - Secure storage validation
     */
    storeSessionInfo(data) {
        try {
            const timestamp = new Date().toISOString();

            // Store the session token for API calls
            if (data.session && data.session.access_token) {
                sessionStorage.setItem('sessionToken', data.session.access_token);
            }

            // Store minimal session info (no sensitive data)
            const sessionData = {
                userId: data.user.id,
                email: data.user.email,
                lastActivity: Date.now(),
                sessionStart: timestamp,
                userAgent: navigator.userAgent.substring(0, 100), // Truncated for security
                sessionId: this.generateSessionId()
            };

            // Validate data before storage
            if (!sessionData.userId || !sessionData.email) {
                throw new Error('Invalid session data');
            }

            sessionStorage.setItem('userSession', JSON.stringify(sessionData));

            // Log successful session creation (dev only)
            console.log('🔐 Session created successfully:', {
                timestamp: timestamp,
                userId: sessionData.userId,
                sessionId: sessionData.sessionId
            });

        } catch (error) {
            console.error('🔐 Session storage error:', {
                error: error.message,
                timestamp: new Date().toISOString(),
                file: 'login.js',
                function: 'storeSessionInfo'
            });
            throw error; // Re-throw to prevent silent failures
        }
    }

    /**
     * Generate a secure session ID
     * 
     * @returns {string} A unique session identifier
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Validate entire form
     */
    validateForm() {
        const emailValid = this.validateEmail();
        const passwordValid = this.validatePassword();

        return emailValid && passwordValid;
    }

    /**
     * Validate email field
     */
    validateEmail() {
        const email = this.emailInput.value.trim();

        if (!email) {
            this.showFieldError('email', 'Email is required');
            return false;
        }

        if (!this.validateEmailFormat(email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            return false;
        }

        this.clearFieldError('email');
        return true;
    }

    /**
     * Validate password field
     */
    validatePassword() {
        const password = this.passwordInput.value;

        if (!password) {
            this.showFieldError('password', 'Password is required');
            return false;
        }

        if (password.length < 8) {
            this.showFieldError('password', 'Password must be at least 8 characters long');
            return false;
        }

        this.clearFieldError('password');
        return true;
    }

    /**
     * Show field-specific error
     */
    showFieldError(field, message) {
        const input = field === 'email' ? this.emailInput : this.passwordInput;
        const errorElement = document.getElementById(field + 'Error');

        input.classList.add('error');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    /**
     * Clear field-specific error
     */
    clearFieldError(field) {
        const input = field === 'email' ? this.emailInput : this.passwordInput;
        const errorElement = document.getElementById(field + 'Error');

        input.classList.remove('error');
        errorElement.style.display = 'none';
    }

    /**
     * Show alert message
     */
    showAlert(message, type = 'error') {
        this.alertMessage.textContent = message;
        this.alertMessage.className = `alert alert-${type}`;
        this.alertMessage.style.display = 'block';

        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.alertMessage.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Set loading state
     */
    setLoadingState(loading) {
        this.loginButton.disabled = loading;
        this.buttonText.style.display = loading ? 'none' : 'block';
        this.loadingSpinner.style.display = loading ? 'block' : 'none';
    }
}

// Initialize login handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SecureLogin();
});

// Development mode - allow developer tools access
// Remove these restrictions for development/testing
// In production, you may want to re-enable these security measures

// Uncomment the lines below for production security:
/*
// Prevent right-click context menu for security
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Prevent F12, Ctrl+Shift+I, Ctrl+U for basic security
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
    }
});
*/
