/**
 * User Profile Component for Star Jet
 * Displays user name and role in the top-right corner
 */

class UserProfile {
    constructor() {
        this.profileContainer = null;
        this.userData = null;
        this.init();
    }

    /**
     * Initialize the user profile component
     */
    async init() {
        await this.loadUserProfile();
        this.createProfileUI();
    }

    /**
     * Load user profile data from API
     */
    async loadUserProfile() {
        try {
            console.log('🔐 Loading user profile...');

            if (!window.apiClient) {
                console.error('🔐 API client not available');
                this.userData = {
                    name: 'Unknown User',
                    role: 'salesman'
                };
                return;
            }

            console.log('🔐 API client available, fetching profile...');

            // Get user profile from API
            const profileResult = await window.apiClient.getUserProfile();
            console.log('🔐 Profile result:', profileResult);

            if (profileResult.error || !profileResult.profile) {
                console.error('🔐 Error loading profile:', profileResult.error);
                this.userData = {
                    name: 'Unknown User',
                    role: 'salesman'
                };
            } else {
                console.log('🔐 Profile loaded successfully:', profileResult.profile);
                this.userData = profileResult.profile;
            }

        } catch (error) {
            console.error('🔐 Error in loadUserProfile:', error);
            this.userData = {
                name: 'Unknown User',
                role: 'salesman'
            };
        }
    }



    /**
     * Create the profile UI in the top-right corner
     */
    createProfileUI() {
        console.log('🔐 Creating profile UI...');
        console.log('🔐 User data:', this.userData);

        // Remove existing profile container if it exists
        const existingContainer = document.getElementById('userProfileContainer');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Create profile container
        this.profileContainer = document.createElement('div');
        this.profileContainer.id = 'userProfileContainer';
        this.profileContainer.className = 'user-profile-container';

        // Create profile icon
        const profileIcon = document.createElement('div');
        profileIcon.className = 'profile-icon';
        profileIcon.innerHTML = '👤';

        // Create profile dropdown
        const profileDropdown = document.createElement('div');
        profileDropdown.className = 'profile-dropdown';
        profileDropdown.style.display = 'none';

        // Create user info
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <div class="user-name">${this.userData?.name || 'Unknown User'}</div>
            <div class="user-role">${this.userData?.role || 'salesman'}</div>
        `;

        // Create logout button
        const logoutButton = document.createElement('button');
        logoutButton.className = 'profile-logout-btn';
        logoutButton.textContent = 'Logout';
        logoutButton.onclick = () => this.logout();

        // Assemble the profile UI
        profileDropdown.appendChild(userInfo);
        profileDropdown.appendChild(logoutButton);
        this.profileContainer.appendChild(profileIcon);
        this.profileContainer.appendChild(profileDropdown);

        // Add click event to toggle dropdown
        profileIcon.addEventListener('click', () => this.toggleDropdown());

        // Add to page
        document.body.appendChild(this.profileContainer);
        console.log('🔐 Profile container added to page');

        // Add styles
        this.addStyles();
        console.log('🔐 Profile UI creation complete');
    }

    /**
     * Toggle profile dropdown visibility
     */
    toggleDropdown() {
        const dropdown = this.profileContainer.querySelector('.profile-dropdown');
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    }

    /**
     * Handle user logout
     */
    async logout() {
        try {
            if (window.authMiddleware) {
                await window.authMiddleware.signOut();
            } else {
                // Fallback logout - clear session and redirect
                sessionStorage.removeItem('sessionToken');
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout by clearing session and redirecting
            sessionStorage.removeItem('sessionToken');
            window.location.href = 'login.html';
        }
    }

    /**
     * Add CSS styles for the profile component
     */
    addStyles() {
        if (document.getElementById('userProfileStyles')) {
            return; // Styles already added
        }

        const style = document.createElement('style');
        style.id = 'userProfileStyles';
        style.textContent = `
            .user-profile-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                font-family: Arial, sans-serif;
            }

            .profile-icon {
                width: 40px;
                height: 40px;
                background: #b3006b;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 20px;
                color: white;
                transition: background 0.2s;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            .profile-icon:hover {
                background: #8a0052;
            }

            .profile-dropdown {
                position: absolute;
                top: 50px;
                right: 0;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                min-width: 200px;
                padding: 16px;
                border: 1px solid #e1e5e9;
            }

            .user-info {
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e1e5e9;
            }

            .user-name {
                font-weight: 600;
                color: #333;
                font-size: 14px;
                margin-bottom: 4px;
            }

            .user-role {
                color: #666;
                font-size: 12px;
                text-transform: capitalize;
            }

            .profile-logout-btn {
                background: #dc3545;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                width: 100%;
                transition: background 0.2s;
            }

            .profile-logout-btn:hover {
                background: #c82333;
            }

            /* Hide logout button if it already exists elsewhere */
            .logout-button {
                display: none;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Update user profile data
     */
    updateProfile(userData) {
        this.userData = userData;
        this.createProfileUI();
    }
}

// Initialize user profile when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on pages that are not the login page
    if (!window.location.pathname.includes('login.html')) {
        console.log('🔐 DOM loaded, initializing UserProfile...');

        // Wait a bit to ensure API client is loaded
        setTimeout(() => {
            if (window.apiClient) {
                console.log('🔐 API client available, creating UserProfile');
                window.userProfile = new UserProfile();
            } else {
                console.log('🔐 API client not available yet, retrying...');
                // Retry after a short delay
                setTimeout(() => {
                    console.log('🔐 Retrying UserProfile creation');
                    window.userProfile = new UserProfile();
                }, 500);
            }
        }, 100);
    }
});




