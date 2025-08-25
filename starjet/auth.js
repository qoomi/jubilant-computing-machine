/**
 * Authentication Middleware for Star Jet
 * Protects all pages by checking user authentication status using API
 */

class AuthMiddleware {
    constructor() {
        this.currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Pages that don't require authentication
        this.publicPages = ['login.html'];

        this.init();
    }

    /**
     * Initialize authentication check
     */
    async init() {
        // Skip auth check for login page
        if (this.publicPages.includes(this.currentPage)) {
            return;
        }

        // Check authentication status
        const isAuthenticated = await this.checkAuthentication();

        if (!isAuthenticated) {
            this.redirectToLogin();
        } else {
            // Set up session monitoring
            this.setupSessionMonitoring();
        }
    }

    /**
     * Check if user is authenticated using API
     */
    async checkAuthentication() {
        try {
            // Check if we have a session token
            const sessionToken = sessionStorage.getItem('sessionToken');
            if (!sessionToken) {
                return false;
            }

            // Test the token by making an API call
            if (!window.apiClient) {
                console.error('API client not available');
                return false;
            }

            const profileResult = await window.apiClient.getUserProfile();
            return !profileResult.error;

        } catch (error) {
            console.error('Authentication check failed:', error);
            return false;
        }
    }

    /**
     * Set up session monitoring
     */
    setupSessionMonitoring() {
        // Check session validity periodically (every 5 minutes)
        setInterval(async () => {
            const isValid = await this.checkAuthentication();
            if (!isValid) {
                this.redirectToLogin();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        // Store current page for redirect after login
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = 'login.html';
    }

    /**
     * Get current user information
     */
    async getCurrentUser() {
        try {
            if (!window.apiClient) {
                return null;
            }

            const profileResult = await window.apiClient.getUserProfile();
            if (profileResult.error) {
                return null;
            }

            return profileResult.profile;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    /**
     * Sign out user
     */
    async signOut() {
        try {
            // Clear all session data
            sessionStorage.clear();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    /**
 * Add logout functionality to page
 * Note: This is now handled by the user profile component
 */
    addLogoutButton() {
        // Logout functionality is now handled by user-profile.js
        // This method is kept for backward compatibility
    }
}

// Initialize auth middleware when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authMiddleware = new AuthMiddleware();
});

// User profile component handles logout functionality now
// This is kept for backward compatibility
document.addEventListener('DOMContentLoaded', () => {
    // User profile component will handle logout functionality
});
