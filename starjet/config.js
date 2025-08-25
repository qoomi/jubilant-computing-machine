/**
 * Configuration Management for Star Jet Application
 * Handles environment-based settings for development and production
 */

class Config {
    constructor() {
        this.environment = this.detectEnvironment();
        this.settings = this.loadSettings();
    }

    /**
     * Detect current environment
     */
    detectEnvironment() {
        // Check if we're in development (localhost) or production
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'development';
        }
        return 'production';
    }

    /**
     * Load settings based on environment
     */
    loadSettings() {
        const baseSettings = {
            // Common settings
            appName: 'Star Jet',
            version: '2.0.0',

            // Security settings
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            maxLoginAttempts: 5,
            lockoutDuration: 15 * 60 * 1000, // 15 minutes
        };

        if (this.environment === 'development') {
            return {
                ...baseSettings,
                apiBaseUrl: 'http://localhost:3000/api',
                debugMode: true,
                logLevel: 'debug'
            };
        } else {
            return {
                ...baseSettings,
                apiBaseUrl: window.location.origin + '/api', // Production: same domain
                debugMode: false,
                logLevel: 'error'
            };
        }
    }

    /**
     * Get a configuration value
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Get API base URL
     */
    getApiBaseUrl() {
        return this.settings.apiBaseUrl;
    }

    /**
     * Check if in development mode
     */
    isDevelopment() {
        return this.environment === 'development';
    }

    /**
     * Check if in production mode
     */
    isProduction() {
        return this.environment === 'production';
    }

    /**
     * Get current environment
     */
    getEnvironment() {
        return this.environment;
    }

    /**
     * Get performance monitoring settings
     */
    getPerformanceSettings() {
        return {
            enableMetrics: this.isProduction(),
            logLevel: this.get('logLevel'),
            debugMode: this.get('debugMode')
        };
    }
}

// Create global configuration instance
window.config = new Config();

// Log configuration for debugging
if (window.config.isDevelopment()) {
    console.log('🔧 Configuration loaded:', {
        environment: window.config.getEnvironment(),
        apiBaseUrl: window.config.getApiBaseUrl(),
        debugMode: window.config.get('debugMode')
    });
}
