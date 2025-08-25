/**
 * Toast Notification System
 * Modern replacement for alert() statements with better UX
 */

class ToastNotifications {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.querySelector('.toast-container')) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.toast-container');
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {string} title - Optional title
     * @param {number} duration - Auto-hide duration in ms (0 = no auto-hide)
     */
    show(message, type = 'info', title = null, duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = this.getIcon(type);
        const closeBtn = '<button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            ${closeBtn}
        `;

        this.container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hide(toast);
            }, duration);
        }

        // Add to tracking array
        this.toasts.push(toast);

        // Remove from tracking when hidden
        toast.addEventListener('animationend', () => {
            if (toast.classList.contains('exiting')) {
                this.toasts = this.toasts.filter(t => t !== toast);
            }
        });

        return toast;
    }

    /**
     * Hide a specific toast
     */
    hide(toast) {
        toast.classList.add('exiting');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }

    /**
     * Hide all toasts
     */
    hideAll() {
        this.toasts.forEach(toast => this.hide(toast));
    }

    /**
     * Get icon for toast type
     */
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Convenience methods
    success(message, title = null, duration = 5000) {
        return this.show(message, 'success', title, duration);
    }

    error(message, title = null, duration = 8000) {
        return this.show(message, 'error', title, duration);
    }

    warning(message, title = null, duration = 6000) {
        return this.show(message, 'warning', title, duration);
    }

    info(message, title = null, duration = 5000) {
        return this.show(message, 'info', title, duration);
    }
}

// Global toast instance
window.toastNotifications = new ToastNotifications();

// Convenience function for backward compatibility
window.showToast = (message, type = 'info', title = null, duration = 5000) => {
    return window.toastNotifications.show(message, type, title, duration);
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastNotifications;
}



