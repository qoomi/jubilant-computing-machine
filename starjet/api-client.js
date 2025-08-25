/**
 * API Client for Star Jet Application
 * Replaces direct Supabase calls with server API calls
 */

class ApiClient {
    constructor() {
        // Use configuration for API base URL
        this.baseUrl = window.config ? window.config.getApiBaseUrl() : 'http://localhost:3000/api';
        this.sessionToken = null;
    }

    /**
     * Get the current session token from sessionStorage or instance
     */
    async getSessionToken() {
        try {
            // First check sessionStorage
            let token = sessionStorage.getItem('sessionToken');

            // If not in sessionStorage, check instance variable
            if (!token && this.sessionToken) {
                token = this.sessionToken;
                // Store it in sessionStorage for consistency
                sessionStorage.setItem('sessionToken', token);
            }

            if (!token) {
                console.error('No session token found');
                return null;
            }
            return token;
        } catch (error) {
            console.error('Failed to get session token:', error);
            return null;
        }
    }

    /**
     * Get headers with authentication token
     */
    async getAuthHeaders() {
        const token = await this.getSessionToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    /**
     * Performance monitoring for API calls
     */
    async measureApiCall(apiCall, endpoint) {
        const startTime = performance.now();
        try {
            const result = await apiCall();
            const duration = performance.now() - startTime;

            // Log performance in production
            if (window.config && window.config.isProduction()) {
                console.log('📊 API Performance:', {
                    endpoint,
                    duration: `${duration.toFixed(2)}ms`,
                    timestamp: new Date().toISOString()
                });
            }

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error('📊 API Error Performance:', {
                endpoint,
                duration: `${duration.toFixed(2)}ms`,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    // Test connection
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/test`);
            return await response.json();
        } catch (error) {
            console.error('API connection failed:', error);
            return null;
        }
    }

    // Authentication
    async login(email, password, csrfToken = null) {
        try {
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add CSRF token if provided
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            // Store the session token if login was successful
            if (result.session && result.session.access_token) {
                this.sessionToken = result.session.access_token;
                // Also store in sessionStorage for consistency
                sessionStorage.setItem('sessionToken', result.session.access_token);
            }

            return result;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    // Registration
    async register(email, password, fullName, role, csrfToken = null) {
        try {
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add CSRF token if provided
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
                console.log('🔐 API Client: CSRF token added to headers');
            } else {
                console.warn('🔐 API Client: No CSRF token provided');
            }

            console.log('🔐 API Client: Making registration request to:', `${this.baseUrl}/auth/register`);

            const response = await fetch(`${this.baseUrl}/auth/register`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email,
                    password,
                    fullName,
                    role
                })
            });

            console.log('🔐 API Client: Registration response status:', response.status);

            const result = await response.json();

            if (!response.ok) {
                console.error('🔐 API Client: Registration failed with status:', response.status, 'Error:', result);
            }

            return result;
        } catch (error) {
            console.error('Registration failed:', error);
            throw error;
        }
    }

    // Get user profile
    async getUserProfile() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/user/profile`, {
                headers
            });
            return await response.json();
        } catch (error) {
            console.error('Get profile failed:', error);
            throw error;
        }
    }

    // Get sales data
    async getSales() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/sales`, {
                headers
            });
            return await response.json();
        } catch (error) {
            console.error('Get sales failed:', error);
            throw error;
        }
    }

    // Get single sale by ID
    async getSale(id) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/sales/${id}`, {
                headers
            });
            return await response.json();
        } catch (error) {
            console.error('Get sale failed:', error);
            throw error;
        }
    }

    // Update sale by ID
    async updateSale(id, saleData) {
        try {
            const headers = await this.getAuthHeaders();

            const response = await fetch(`${this.baseUrl}/sales/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(saleData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔐 Update sale error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Update sale failed:', error);
            throw error;
        }
    }

    // Create new sale
    async createSale(saleData) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/sales`, {
                method: 'POST',
                headers,
                body: JSON.stringify(saleData)
            });
            return await response.json();
        } catch (error) {
            console.error('Create sale failed:', error);
            throw error;
        }
    }

    // Update sale status
    async updateSaleStatus(id, status) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/sales/${id}/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status })
            });
            return await response.json();
        } catch (error) {
            console.error('Update sale status failed:', error);
            throw error;
        }
    }

    // Delete sale
    async deleteSale(id) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/sales/${id}`, {
                method: 'DELETE',
                headers
            });
            return await response.json();
        } catch (error) {
            console.error('Delete sale failed:', error);
            throw error;
        }
    }

    // Get expenses data
    async getExpenses() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/expenses`, {
                headers
            });
            return await response.json();
        } catch (error) {
            console.error('Get expenses failed:', error);
            throw error;
        }
    }

    // Create new expense
    async createExpense(expenseData) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/expenses`, {
                method: 'POST',
                headers,
                body: JSON.stringify(expenseData)
            });
            return await response.json();
        } catch (error) {
            console.error('Create expense failed:', error);
            throw error;
        }
    }

    // Delete expense
    async deleteExpense(id) {
        try {
            const headers = await this.getAuthHeaders();

            const response = await fetch(`${this.baseUrl}/expenses/${id}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔐 Delete expense error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Delete expense failed:', error);
            throw error;
        }
    }

    // Get capital settings
    async getCapitalSettings() {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseUrl}/capital-settings`, {
                headers
            });
            return await response.json();
        } catch (error) {
            console.error('Get capital settings failed:', error);
            throw error;
        }
    }

    // Update capital settings
    async updateCapitalSettings(originalCapital) {
        try {
            const headers = await this.getAuthHeaders();

            const response = await fetch(`${this.baseUrl}/capital-settings`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ original_capital: originalCapital })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔐 Update capital settings error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Update capital settings failed:', error);
            throw error;
        }
    }
}

// Create global API client instance
window.apiClient = new ApiClient();
