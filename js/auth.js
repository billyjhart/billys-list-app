// Authentication Module for Billy's List

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authSection = document.getElementById('auth-section');
        this.appSection = document.getElementById('app-section');
        
        // Auth method selection
        this.googleAuthBtn = document.getElementById('google-auth-btn');
        this.emailAuthBtn = document.getElementById('email-auth-btn');
        this.googleAuthForm = document.getElementById('google-auth-form');
        this.emailAuthForm = document.getElementById('email-auth-form');
        this.emailSignupForm = document.getElementById('email-signup-form');
        
        // Google sign-in
        this.signInGoogleBtn = document.getElementById('sign-in-google-btn');
        
        // Email sign-in
        this.emailInput = document.getElementById('email-input');
        this.passwordInput = document.getElementById('password-input');
        this.signInEmailBtn = document.getElementById('sign-in-email-btn');
        this.forgotPasswordBtn = document.getElementById('forgot-password-btn');
        this.toggleSignupBtn = document.getElementById('toggle-signup-btn');
        
        // Email sign-up
        this.signupNameInput = document.getElementById('signup-name');
        this.signupEmailInput = document.getElementById('signup-email');
        this.signupPasswordInput = document.getElementById('signup-password');
        this.signupConfirmInput = document.getElementById('signup-confirm');
        this.signUpEmailBtn = document.getElementById('sign-up-email-btn');
        this.toggleSigninBtn = document.getElementById('toggle-signin-btn');
        
        // Error display
        this.authError = document.getElementById('auth-error');
        
        // Header menu + sign out
        this.appMenuBtn = document.getElementById('app-menu-btn');
        this.appMenu = document.getElementById('app-menu');
        this.accountProfileBtn = document.getElementById('account-profile-btn');
        this.accountEmailBtn = document.getElementById('account-email-btn');
        this.accountPasswordBtn = document.getElementById('account-password-btn');
        this.accountSortDefaultsBtn = document.getElementById('account-sort-defaults-btn');
        this.themeModeBtn = document.getElementById('theme-mode-btn');
        this.signOutBtn = document.getElementById('sign-out-btn');
        this.listsHeading = document.getElementById('lists-heading');
        
        this.initializeAuth();
    }

    initializeAuth() {
        // Set up event listeners
        this.googleAuthBtn.addEventListener('click', () => this.switchAuthMethod('google'));
        this.emailAuthBtn.addEventListener('click', () => this.switchAuthMethod('email'));
        
        this.signInGoogleBtn.addEventListener('click', () => this.signInWithGoogle());
        
        this.signInEmailBtn.addEventListener('click', () => this.signInWithEmail());
        this.forgotPasswordBtn.addEventListener('click', () => this.sendPasswordReset());
        this.emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.signInWithEmail();
        });
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.signInWithEmail();
        });
        
        this.toggleSignupBtn.addEventListener('click', () => this.showSignupForm());
        this.toggleSigninBtn.addEventListener('click', () => this.showSigninForm());
        
        this.signUpEmailBtn.addEventListener('click', () => this.signUpWithEmail());
        this.signupPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.signUpWithEmail();
        });
        
        // Header menu toggle
        this.appMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAppMenu();
        });

        // Account menu actions
        this.accountProfileBtn.addEventListener('click', () => this.updateDisplayName());
        this.accountEmailBtn.addEventListener('click', () => this.updateEmailAddress());
        this.accountPasswordBtn.addEventListener('click', () => this.updatePassword());
        this.accountSortDefaultsBtn.addEventListener('click', () => this.openSortDefaults());
        this.themeModeBtn.addEventListener('click', () => {
            this.hideAppMenu();
            if (window.billysListApp && window.billysListApp.uiManager) {
                window.billysListApp.uiManager.toggleTheme();
            }
        });
        this.signOutBtn.addEventListener('click', () => {
            this.hideAppMenu();
            this.signOut();
        });

        // Close menu on outside click
        document.addEventListener('click', () => this.hideAppMenu());
        this.appMenu.addEventListener('click', (e) => e.stopPropagation());

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.handleSignedIn(user);
            } else {
                this.handleSignedOut();
            }
        });
    }

    // Switch authentication method
    switchAuthMethod(method) {
        // Update button states
        if (method === 'google') {
            this.googleAuthBtn.classList.add('active');
            this.emailAuthBtn.classList.remove('active');
            this.googleAuthForm.classList.add('active');
            this.emailAuthForm.classList.remove('active');
            this.emailSignupForm.classList.remove('active');
        } else {
            this.googleAuthBtn.classList.remove('active');
            this.emailAuthBtn.classList.add('active');
            this.googleAuthForm.classList.remove('active');
            this.emailAuthForm.classList.add('active');
            this.hideError();
        }
    }

    // Google Sign-In
    async signInWithGoogle() {
        try {
            this.signInGoogleBtn.disabled = true;
            this.signInGoogleBtn.innerHTML = '<span class="btn-icon">⏳</span>Signing in...';
            
            const result = await auth.signInWithPopup(provider);
            console.log('User signed in with Google:', result.user.displayName);
            
        } catch (error) {
            console.error('Google sign in error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            // Always reset button state
            this.signInGoogleBtn.disabled = false;
            this.signInGoogleBtn.innerHTML = '<span class="btn-icon">🔑</span>Sign in with Google';
        }
    }

    // Email/Password Sign-In
    async signInWithEmail() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        if (!email || !password) {
            this.showError('Please enter both email and password');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        // Store original button state
        const originalText = this.signInEmailBtn.innerHTML;
        
        try {
            this.signInEmailBtn.disabled = true;
            this.signInEmailBtn.innerHTML = '<span class="btn-icon">⏳</span>Signing in...';
            
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('User signed in with email:', result.user.email);
            
            // Success - button will be hidden when app loads
            
        } catch (error) {
            console.error('Email sign in error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            // Always reset button state, regardless of success or error
            this.signInEmailBtn.disabled = false;
            this.signInEmailBtn.innerHTML = '<span class="btn-icon">📧</span>Sign In';
        }
    }

    // Email/Password Sign-Up
    async signUpWithEmail() {
        const name = this.signupNameInput.value.trim();
        const email = this.signupEmailInput.value.trim();
        const password = this.signupPasswordInput.value;
        const confirm = this.signupConfirmInput.value;

        // Validation
        if (!name || !email || !password || !confirm) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirm) {
            this.showError('Passwords do not match');
            return;
        }

        try {
            this.signUpEmailBtn.disabled = true;
            this.signUpEmailBtn.innerHTML = '<span class="btn-icon">⏳</span>Creating account...';
            
            // Create user account
            const result = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update user profile with name
            await result.user.updateProfile({
                displayName: name
            });
            
            console.log('User account created:', result.user.email);
            
        } catch (error) {
            console.error('Email sign up error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            // Always reset button state
            this.signUpEmailBtn.disabled = false;
            this.signUpEmailBtn.innerHTML = '<span class="btn-icon">✨</span>Create Account';
        }
    }

    // Show/hide forms
    showSignupForm() {
        this.emailAuthForm.classList.remove('active');
        this.emailSignupForm.classList.add('active');
        this.hideError();
        this.signupNameInput.focus();
    }

    showSigninForm() {
        this.emailAuthForm.classList.add('active');
        this.emailSignupForm.classList.remove('active');
        this.hideError();
        this.emailInput.focus();
    }

    // Sign out
    async signOut() {
        try {
            await auth.signOut();
            console.log('User signed out');
        } catch (error) {
            console.error('Sign out error:', error);
            this.showError('Failed to sign out. Please try again.');
        }
    }

    async sendPasswordReset() {
        const email = this.emailInput.value.trim();
        if (!email) {
            this.showError('Enter your email first, then tap "Forgot password?"');
            return;
        }
        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            alert(`Password reset email sent to ${email}`);
            this.hideError();
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError(this.getErrorMessage(error));
        }
    }

    async updateDisplayName() {
        this.hideAppMenu();
        if (!this.currentUser) return;

        const currentName = this.currentUser.displayName || '';
        const newName = prompt('Enter display name:', currentName);
        if (!newName || newName.trim() === currentName) return;

        try {
            await this.currentUser.updateProfile({ displayName: newName.trim() });

            if (window.billysListApp && window.billysListApp.databaseManager) {
                await window.billysListApp.databaseManager.setCurrentUser(this.currentUser);
            }

            this.updateListsHeading();
            alert('Display name updated');
        } catch (error) {
            console.error('Update display name error:', error);
            this.showError(this.getErrorMessage(error));
        }
    }

    async updateEmailAddress() {
        this.hideAppMenu();
        if (!this.currentUser) return;

        const newEmail = prompt('Enter new email address:', this.currentUser.email || '');
        if (!newEmail || newEmail.trim() === this.currentUser.email) return;
        if (!this.isValidEmail(newEmail.trim())) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            await this.currentUser.verifyBeforeUpdateEmail(newEmail.trim());
            alert(`Verification email sent to ${newEmail.trim()}. Confirm it to finish email update.`);
        } catch (error) {
            console.error('Update email error:', error);
            if ((error.code || '').includes('requires-recent-login')) {
                alert('For security, please sign out and sign back in, then try updating email again.');
            } else {
                this.showError(this.getErrorMessage(error));
            }
        }
    }

    async updatePassword() {
        this.hideAppMenu();
        if (!this.currentUser) return;

        const newPassword = prompt('Enter new password (min 6 characters):');
        if (!newPassword) return;
        if (newPassword.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        try {
            await this.currentUser.updatePassword(newPassword);
            alert('Password updated successfully');
        } catch (error) {
            console.error('Update password error:', error);
            if ((error.code || '').includes('requires-recent-login')) {
                alert('For security, please sign out and sign back in, then try updating password again.');
            } else {
                this.showError(this.getErrorMessage(error));
            }
        }
    }

    openSortDefaults() {
        this.hideAppMenu();
        if (window.billysListApp && window.billysListApp.listsManager) {
            window.billysListApp.listsManager.configureUserSortDefaults();
        }
    }

    updateListsHeading() {
        if (!this.listsHeading) return;
        const name = (this.currentUser && (this.currentUser.displayName || this.currentUser.email)) || 'My';
        this.listsHeading.textContent = `${name} - My Lists`;
    }

    // Handle signed in state
    handleSignedIn(user) {
        this.currentUser = user;
        this.hideAppMenu();
        
        // Show app, hide auth
        this.authSection.style.display = 'none';
        this.appSection.style.display = 'block';
        
        this.updateListsHeading();

        // Dispatch user signed in event for the main app to handle
        window.dispatchEvent(new CustomEvent('user-signed-in', { 
            detail: { user } 
        }));
        
        console.log('User authenticated:', user.displayName || user.email);
    }

    // Handle signed out state
    handleSignedOut() {
        this.currentUser = null;
        this.hideAppMenu();
        
        // Show auth, hide app
        this.authSection.style.display = 'flex';
        this.appSection.style.display = 'none';
        
        // Reset forms
        this.resetAuthForms();
        
        // Reset sign-in button
        this.signInGoogleBtn.disabled = false;
        this.signInGoogleBtn.innerHTML = '<span class="btn-icon">🔑</span>Sign in with Google';
        
        // Show Google auth by default
        this.switchAuthMethod('google');

        if (this.listsHeading) {
            this.listsHeading.textContent = 'My Lists';
        }
        
        // Clean up app state
        if (window.billysListApp) {
            window.billysListApp.cleanup();
        }
        
        console.log('User signed out');
    }

    // Reset auth forms
    resetAuthForms() {
        this.emailInput.value = '';
        this.passwordInput.value = '';
        this.signupNameInput.value = '';
        this.signupEmailInput.value = '';
        this.signupPasswordInput.value = '';
        this.signupConfirmInput.value = '';
        this.hideError();
    }

    // Error handling
    showError(message) {
        this.authError.textContent = message;
        this.authError.style.display = 'block';
    }

    hideError() {
        this.authError.style.display = 'none';
        this.authError.textContent = '';
    }

    getErrorMessage(error) {
        const errorCode = error.code || '';
        const errorMessage = error.message || 'An error occurred';

        switch (errorCode) {
            case 'auth/user-not-found':
                return 'Email not found. Please check or create a new account.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/email-already-in-use':
                return 'Email is already registered. Please sign in or use a different email.';
            case 'auth/weak-password':
                return 'Password is too weak. Please use a stronger password.';
            case 'auth/operation-not-allowed':
                return 'This sign-in method is not enabled.';
            case 'auth/too-many-requests':
                return 'Too many failed login attempts. Please try again later.';
            case 'auth/popup-blocked':
                return 'Pop-up was blocked. Please allow pop-ups and try again.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in was cancelled.';
            default:
                // Extract just the error message without the code
                return errorMessage.split(']').pop().trim();
        }
    }

    toggleAppMenu() {
        if (!this.appMenu || !this.appMenuBtn) return;

        const isOpen = this.appMenu.style.display === 'block';
        if (isOpen) {
            this.hideAppMenu();
            return;
        }

        const rect = this.appMenuBtn.getBoundingClientRect();
        const menuWidth = 220;
        const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));

        this.appMenu.style.display = 'block';
        this.appMenu.style.position = 'fixed';
        this.appMenu.style.top = `${Math.round(rect.bottom + 8)}px`;
        this.appMenu.style.left = `${Math.round(left)}px`;
    }

    hideAppMenu() {
        if (!this.appMenu) return;
        this.appMenu.style.display = 'none';
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    getCurrentUser() {
        return this.currentUser;
    }
}