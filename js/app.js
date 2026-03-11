// Main Application Module for Billy's List

class BillysListApp {
    constructor() {
        this.authManager = null;
        this.databaseManager = null;
        this.uiManager = null;
        this.isReady = false;
        
        this.initialize();
    }

    initialize() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            console.log('🚀 Initializing Billy\'s List App...');
            
            // Check for required dependencies
            if (!this.checkDependencies()) {
                throw new Error('Required dependencies not available');
            }

            // Initialize core managers
            this.databaseManager = new DatabaseManager();
            this.authManager = new AuthManager();
            this.uiManager = new UIManager(this.databaseManager);
            
            // Set up app-level event listeners
            this.setupEventListeners();
            
            // Initialize PWA features if available
            await this.uiManager.initializePWA();
            
            // Load user preferences
            this.uiManager.loadTheme();
            
            // Start connection monitoring
            this.uiManager.monitorConnectionStatus();
            
            // Check browser feature support
            this.uiManager.checkFeatureSupport();
            
            // Mark app as ready
            this.isReady = true;
            
            console.log('✅ Billy\'s List App initialized successfully');
            
            // Dispatch ready event
            this.dispatchEvent('app-ready');
            
        } catch (error) {
            console.error('❌ Failed to initialize Billy\'s List App:', error);
            this.showInitializationError(error);
        }
    }

    checkDependencies() {
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            return false;
        }

        // Check if Firebase services are available
        try {
            if (!firebase.auth) {
                console.error('Firebase Auth not available');
                return false;
            }
            
            if (!firebase.database) {
                console.error('Firebase Database not available');
                return false;
            }

            // Check if Firebase app is initialized by trying to get the default app
            const app = firebase.app();
            if (!app) {
                console.error('Firebase app not initialized');
                return false;
            }

            console.log('✅ All Firebase dependencies available');
            return true;
            
        } catch (error) {
            console.error('Firebase dependency check failed:', error);
            return false;
        }
    }

    setupEventListeners() {
        // Handle app-level events
        window.addEventListener('online', () => {
            console.log('📶 App came online');
            this.handleConnectionRestore();
        });

        window.addEventListener('offline', () => {
            console.log('📵 App went offline');
            this.handleConnectionLoss();
        });

        // Handle visibility changes (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleAppBackground();
            } else {
                this.handleAppForeground();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', (e) => {
            this.handleAppUnload(e);
        });

        // Handle errors
        window.addEventListener('error', (e) => {
            this.handleGlobalError(e);
        });

        window.addEventListener('unhandledrejection', (e) => {
            this.handleUnhandledRejection(e);
        });
    }

    // Called by AuthManager when user signs in
    async initializeWithUser(user) {
        if (!this.isReady) {
            console.warn('App not ready yet, queuing user initialization...');
            // Queue the initialization for when app is ready
            this.addEventListener('app-ready', () => this.initializeWithUser(user));
            return;
        }

        try {
            console.log('👤 Initializing app for user:', user.displayName || user.email);
            
            // Initialize UI with user context
            await this.uiManager.initializeWithUser(user);
            
            // Restore previous app state if available
            const savedState = this.uiManager.loadAppState();
            if (savedState && savedState.currentListId) {
                // Attempt to restore the last selected list
                setTimeout(() => {
                    if (window.billysListApp && window.billysListApp.listsManager) {
                        const userLists = window.billysListApp.listsManager.userLists;
                        const allLists = [...userLists.owned, ...userLists.shared];
                        const listExists = allLists.some(list => list.id === savedState.currentListId);
                        
                        if (listExists) {
                            window.billysListApp.listsManager.selectList(savedState.currentListId);
                        }
                    }
                }, 500);
            }
            
            console.log('✅ User initialization complete');
            this.dispatchEvent('user-ready', { user });
            
        } catch (error) {
            console.error('❌ Failed to initialize user session:', error);
            this.uiManager.showError('Failed to set up your account. Please try signing out and back in.');
        }
    }

    // Event handling methods
    handleConnectionRestore() {
        if (this.uiManager) {
            this.uiManager.handleOnline();
        }
    }

    handleConnectionLoss() {
        if (this.uiManager) {
            this.uiManager.handleOffline();
        }
    }

    handleAppBackground() {
        // Save state when user switches tabs
        if (this.uiManager) {
            this.uiManager.saveAppState();
        }
    }

    handleAppForeground() {
        // Could refresh data or check for updates when user returns
        console.log('📱 App returned to foreground');
    }

    handleAppUnload(e) {
        // Clean up before page unload
        this.cleanup();
        
        // Could show confirmation if user has unsaved changes
        // e.preventDefault();
        // e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }

    handleGlobalError(e) {
        console.error('🚨 Global error:', e.error);
        
        // Report error to monitoring service if available
        this.reportError('javascript-error', e.error, {
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno
        });
        
        // Show user-friendly error message
        if (this.uiManager) {
            this.uiManager.showError('An unexpected error occurred. Please refresh the page.');
        }
    }

    handleUnhandledRejection(e) {
        console.error('🚨 Unhandled promise rejection:', e.reason);
        
        // Report error to monitoring service if available
        this.reportError('unhandled-rejection', e.reason);
        
        // Prevent default browser behavior
        e.preventDefault();
    }

    // Error reporting (placeholder for monitoring service integration)
    reportError(type, error, metadata = {}) {
        const errorReport = {
            type,
            message: error?.message || String(error),
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.authManager?.currentUser?.uid || 'anonymous',
            ...metadata
        };

        // Would send to error monitoring service here
        console.log('Error report:', errorReport);
    }

    // Initialization error handling
    showInitializationError(error) {
        // Show a minimal error page
        document.body.innerHTML = `
            <div style="
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                padding: 20px; 
                text-align: center; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            ">
                <div style="
                    background: rgba(255,255,255,0.1); 
                    backdrop-filter: blur(10px);
                    padding: 40px; 
                    border-radius: 16px; 
                    max-width: 400px; 
                    width: 100%;
                ">
                    <h1 style="margin-bottom: 20px;">🚨 Initialization Failed</h1>
                    <p style="margin-bottom: 30px; opacity: 0.9;">
                        Billy's List failed to start properly. This might be due to:
                    </p>
                    <ul style="text-align: left; margin-bottom: 30px; opacity: 0.9;">
                        <li>Network connectivity issues</li>
                        <li>Firebase configuration problems</li>
                        <li>Browser compatibility issues</li>
                        <li>JavaScript errors</li>
                    </ul>
                    <button 
                        onclick="window.location.reload()" 
                        style="
                            background: rgba(255,255,255,0.2); 
                            color: white; 
                            border: 2px solid rgba(255,255,255,0.3);
                            padding: 12px 24px; 
                            border-radius: 8px; 
                            cursor: pointer; 
                            font-size: 16px;
                            transition: all 0.3s ease;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.2)'"
                    >
                        🔄 Try Again
                    </button>
                    <div style="
                        margin-top: 20px; 
                        padding: 15px; 
                        background: rgba(255,255,255,0.1); 
                        border-radius: 8px; 
                        font-size: 12px; 
                        opacity: 0.8;
                        text-align: left;
                    ">
                        <strong>Error Details:</strong><br>
                        ${error.message || 'Unknown error'}
                    </div>
                </div>
            </div>
        `;
    }

    // Event system for internal communication
    addEventListener(eventName, callback) {
        if (!this.eventListeners) {
            this.eventListeners = {};
        }
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    removeEventListener(eventName, callback) {
        if (this.eventListeners && this.eventListeners[eventName]) {
            this.eventListeners[eventName] = this.eventListeners[eventName].filter(
                listener => listener !== callback
            );
        }
    }

    dispatchEvent(eventName, data = {}) {
        if (this.eventListeners && this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
    }

    // App information and debugging
    getAppInfo() {
        return {
            version: '2.0.0',
            buildDate: new Date().toISOString(),
            isReady: this.isReady,
            user: this.authManager?.currentUser?.uid || null,
            debug: this.uiManager?.getDebugInfo() || null
        };
    }

    // Cleanup method
    cleanup() {
        console.log('🧹 Cleaning up Billy\'s List App...');
        
        try {
            // Clean up managers in reverse order
            if (this.uiManager) {
                this.uiManager.cleanup();
            }
            
            if (this.databaseManager) {
                this.databaseManager.cleanup();
            }
            
            // Clear event listeners
            this.eventListeners = {};
            
            // Mark as not ready
            this.isReady = false;
            
            console.log('✅ App cleanup complete');
            
        } catch (error) {
            console.error('❌ Error during app cleanup:', error);
        }
    }
}

// Initialize the app when script loads
const billysListApp = new BillysListApp();

// Make app available globally for debugging
window.BillysListApp = billysListApp;

// Listen for user sign-in events from AuthManager
window.addEventListener('user-signed-in', (event) => {
    const { user } = event.detail;
    console.log('🔔 Received user sign-in event:', user.email);
    billysListApp.initializeWithUser(user);
});

// Log app information
console.log('📝 Billy\'s List App loaded:', billysListApp.getAppInfo());