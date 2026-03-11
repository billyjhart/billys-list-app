// UI Manager for Billy's List

class UIManager {
    constructor(database) {
        this.database = database;
        this.isInitialized = false;
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    initializeElements() {
        // Main containers
        this.authSection = document.getElementById('auth-section');
        this.appSection = document.getElementById('app-section');
        this.noListSelected = document.getElementById('no-list-selected');
        this.activeListContainer = document.getElementById('active-list-container');
    }

    initializeEventListeners() {
        // Handle window events
        window.addEventListener('beforeunload', () => this.cleanup());
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Handle responsive UI updates
        window.addEventListener('resize', () => this.handleResize());
        
        // Handle theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    // Initialize UI with user data
    async initializeWithUser(user) {
        if (this.isInitialized) return;
        
        try {
            console.log('Initializing UI for user:', user.displayName);
            
            // Set up database with current user
            await this.database.setCurrentUser(user);
            
            // Initialize managers
            this.listsManager = new ListsManager(this.database);
            this.itemsManager = new ItemsManager(this.database);

            // Set up cross-manager communication BEFORE loading lists
            // so auto-selected list can notify itemsManager immediately.
            this.setupManagerCommunication();
            
            // Load user's lists (may auto-select first list)
            await this.listsManager.loadUserLists();

            // Safety: ensure items manager is synced with current selection after refresh
            const currentListId = this.listsManager.getCurrentListId();
            if (currentListId) {
                this.itemsManager.setCurrentList(currentListId);
            }
            
            // Focus on new item input if a list is selected
            setTimeout(() => {
                const newItemInput = document.getElementById('new-item-input');
                if (newItemInput && this.listsManager.getCurrentListId()) {
                    newItemInput.focus();
                }
            }, 100);
            
            this.isInitialized = true;
            console.log('UI initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize UI:', error);
            this.showError('Failed to initialize the app. Please refresh and try again.');
        }
    }

    // Set up communication between managers
    setupManagerCommunication() {
        // Make managers available globally for cross-communication
        window.billysListApp = {
            database: this.database,
            uiManager: this,
            listsManager: this.listsManager,
            itemsManager: this.itemsManager,
            
            // Methods for cross-manager communication
            initializeWithUser: (user) => this.initializeWithUser(user),
            cleanup: () => this.cleanup()
        };
    }

    // Handle keyboard shortcuts
    handleKeyboardShortcuts(e) {
        // Don't handle shortcuts if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // Allow some shortcuts even in inputs
            if (e.key === 'Escape') {
                e.target.blur();
                return;
            }
            return;
        }

        // Global shortcuts
        switch (e.key) {
            case 'n':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.createNewList();
                }
                break;
                
            case '/':
                e.preventDefault();
                this.focusNewItemInput();
                break;
                
            case 'Escape':
                this.handleEscapeKey();
                break;
        }
    }

    // Handle responsive UI updates
    handleResize() {
        // Update context menu positions if visible
        const contextMenus = document.querySelectorAll('.context-menu[style*="block"]');
        contextMenus.forEach(menu => {
            menu.style.display = 'none';
        });
        
        // Update modal positions if needed
        const modals = document.querySelectorAll('.modal[style*="flex"]');
        modals.forEach(modal => {
            // Modals should handle their own responsive design via CSS
        });
    }

    // Utility methods for keyboard shortcuts
    createNewList() {
        if (this.listsManager) {
            this.listsManager.showCreateListModal();
        }
    }

    focusNewItemInput() {
        const newItemInput = document.getElementById('new-item-input');
        if (newItemInput && !newItemInput.disabled) {
            newItemInput.focus();
        }
    }

    handleEscapeKey() {
        // Close any open modals or menus
        const openModals = document.querySelectorAll('.modal[style*="flex"]');
        openModals.forEach(modal => {
            modal.style.display = 'none';
        });
        
        const openMenus = document.querySelectorAll('.context-menu[style*="block"]');
        openMenus.forEach(menu => {
            menu.style.display = 'none';
        });
        
    }

    // State management methods
    showLoadingState(message = 'Loading...') {
        // Could implement a loading overlay
        console.log(message);
    }

    hideLoadingState() {
        // Hide loading overlay
    }

    showError(message) {
        // Enhanced error handling - could use toast notifications
        console.error(message);
        alert(message);
    }

    showSuccess(message) {
        // Enhanced success messaging - could use toast notifications
        console.log(message);
    }

    // Theme and appearance methods
    setTheme(theme, persist = true) {
        document.documentElement.setAttribute('data-theme', theme);
        if (persist) {
            localStorage.setItem('billys-list-theme', theme);
        }
        this.updateThemeToggleIcon(theme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('billys-list-theme');

        // If user explicitly chose a theme before, honor it.
        if (savedTheme === 'dark' || savedTheme === 'light') {
            this.setTheme(savedTheme, true);
        } else {
            // Default to system theme when no user override exists.
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light', false);

            // Keep following system changes until user overrides by toggling.
            if (window.matchMedia) {
                const media = window.matchMedia('(prefers-color-scheme: dark)');
                const applySystemTheme = (e) => {
                    const hasUserOverride = localStorage.getItem('billys-list-theme');
                    if (!hasUserOverride) {
                        this.setTheme(e.matches ? 'dark' : 'light', false);
                    }
                };

                if (media.addEventListener) {
                    media.addEventListener('change', applySystemTheme);
                } else if (media.addListener) {
                    media.addListener(applySystemTheme);
                }
            }
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // Toggling is an explicit user override; persist it.
        this.setTheme(newTheme, true);
        
        // Announce theme change to screen readers
        this.announceToScreenReader(`Switched to ${newTheme} mode`);
    }

    updateThemeToggleIcon(theme) {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        }
    }

    // Accessibility helpers
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        // Remove after announcement
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Performance optimization
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // App state persistence
    saveAppState() {
        const state = {
            currentListId: this.listsManager ? this.listsManager.getCurrentListId() : null,
            timestamp: Date.now()
        };
        
        localStorage.setItem('billys-list-state', JSON.stringify(state));
    }

    loadAppState() {
        try {
            const savedState = localStorage.getItem('billys-list-state');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // Only restore if state is recent (within 24 hours)
                if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                    return state;
                }
            }
        } catch (error) {
            console.warn('Failed to load app state:', error);
        }
        
        return null;
    }

    // Connection status monitoring
    monitorConnectionStatus() {
        // Temporarily disabled aggressive Firebase connection monitoring
        // to prevent false offline detection during development
        
        // Only monitor actual network status
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Assume connected by default unless network is actually offline
        if (navigator.onLine) {
            this.handleOnline();
        }
    }

    handleOnline() {
        console.log('Connected to Firebase');
        document.body.classList.remove('offline');
        
        // Could show a subtle "Connected" indicator
    }

    handleOffline() {
        console.log('Disconnected from Firebase');
        document.body.classList.add('offline');
        
        // Could show an "Offline" indicator
        this.showError('You are currently offline. Changes will sync when connection is restored.');
    }

    // Feature flags and progressive enhancement
    checkFeatureSupport() {
        const features = {
            serviceWorker: 'serviceWorker' in navigator,
            localStorage: typeof Storage !== 'undefined',
            dragAndDrop: 'draggable' in document.createElement('div'),
            touchEvents: 'ontouchstart' in window,
            notifications: 'Notification' in window
        };

        // Enable features based on support
        if (features.touchEvents) {
            document.body.classList.add('touch-device');
        }

        if (!features.localStorage) {
            this.showError('Your browser does not support local storage. Some features may not work correctly.');
        }

        return features;
    }

    // Progressive Web App features
    async initializePWA() {
        if ('serviceWorker' in navigator) {
            try {
                // Would register service worker here
                console.log('PWA features would be initialized here');
            } catch (error) {
                console.warn('Failed to initialize PWA features:', error);
            }
        }
    }

    // Cleanup
    cleanup() {
        console.log('Cleaning up UI manager...');
        
        // Save app state
        this.saveAppState();
        
        // Clean up managers
        if (this.listsManager) {
            this.listsManager.cleanup();
        }
        
        if (this.itemsManager) {
            this.itemsManager.cleanup();
        }
        
        if (this.database) {
            this.database.cleanup();
        }
        
        // Clear global reference
        if (window.billysListApp) {
            delete window.billysListApp;
        }
        
        this.isInitialized = false;
    }

    // Debugging helpers
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            currentUser: this.database ? this.database.currentUserId : null,
            currentList: this.listsManager ? this.listsManager.getCurrentListId() : null,
            editMode: this.itemsManager ? this.itemsManager.isEditMode : false,
            listsCount: this.listsManager ? 
                this.listsManager.userLists.owned.length + this.listsManager.userLists.shared.length : 0
        };
    }
}