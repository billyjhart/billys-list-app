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
        this.resendVerificationBtn = document.getElementById('resend-verification-btn');
        this.toggleSignupBtn = document.getElementById('toggle-signup-btn');
        
        // Email sign-up
        this.signupNameInput = document.getElementById('signup-name');
        this.signupEmailInput = document.getElementById('signup-email');
        this.signupPasswordInput = document.getElementById('signup-password');
        this.signupConfirmInput = document.getElementById('signup-confirm');
        this.signupTermsAgreeInput = document.getElementById('signup-terms-agree');
        this.signUpEmailBtn = document.getElementById('sign-up-email-btn');
        this.toggleSigninBtn = document.getElementById('toggle-signin-btn');

        // Terms modal (runtime TOU enforcement)
        this.termsModal = document.getElementById('terms-modal');
        this.termsModalAgreeInput = document.getElementById('terms-modal-agree');
        this.termsAcceptBtn = document.getElementById('terms-accept-btn');
        this.termsDeclineBtn = document.getElementById('terms-decline-btn');
        this.termsVersionLabel = document.getElementById('terms-version-label');
        
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
        this.deleteAccountBtn = document.getElementById('delete-account-btn');
        this.signOutBtn = document.getElementById('sign-out-btn');
        this.listsHeading = document.getElementById('lists-heading');
        this.lastSignInDispatch = { uid: null, at: 0 };
        this.termsVersion = '2026-03-13';
        this.termsCheckInProgress = false;
        this.termsModalResolver = null;
        this.suppressAuthStateHandling = false;
        this.pendingAuthInfoMessage = null;
        
        this.initializeAuth();
    }

    initializeAuth() {
        // Set up event listeners
        this.googleAuthBtn.addEventListener('click', () => this.switchAuthMethod('google'));
        this.emailAuthBtn.addEventListener('click', () => this.switchAuthMethod('email'));
        
        this.signInGoogleBtn.addEventListener('click', () => this.signInWithGoogle());
        
        this.signInEmailBtn.addEventListener('click', () => this.signInWithEmail());
        this.forgotPasswordBtn.addEventListener('click', () => this.sendPasswordReset());
        if (this.resendVerificationBtn) {
            this.resendVerificationBtn.addEventListener('click', () => this.resendVerificationEmail());
        }
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
        this.signupConfirmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.signUpWithEmail();
        });
        this.signupTermsAgreeInput.addEventListener('change', () => this.updateSignupButtonState());

        if (this.termsModalAgreeInput) {
            this.termsModalAgreeInput.addEventListener('change', () => this.updateTermsModalButtonState());
        }
        if (this.termsAcceptBtn) {
            this.termsAcceptBtn.addEventListener('click', () => this.resolveTermsModal(true));
        }
        if (this.termsDeclineBtn) {
            this.termsDeclineBtn.addEventListener('click', () => this.resolveTermsModal(false));
        }
        
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
        this.deleteAccountBtn.addEventListener('click', () => this.deleteAccount());
        this.signOutBtn.addEventListener('click', () => {
            this.hideAppMenu();
            this.signOut();
        });

        // Close menu on outside click
        document.addEventListener('click', () => this.hideAppMenu());
        this.appMenu.addEventListener('click', (e) => e.stopPropagation());

        // Default signup button state (requires ToS agreement)
        this.updateSignupButtonState();

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            if (this.suppressAuthStateHandling) return;

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

            // Enforce email verification for email/password users.
            await result.user.reload();
            if (!result.user.emailVerified) {
                try {
                    await result.user.sendEmailVerification();
                    console.log('Verification email send requested (sign-in gate):', {
                        email,
                        uid: result.user.uid,
                        provider: result.user.providerData?.map(p => p.providerId)
                    });
                    this.showInfo(`Verification email requested for ${email} at ${new Date().toLocaleTimeString()}. If you don't see it, check spam/junk.`, true);
                } catch (verifyError) {
                    console.error('Verification email send failed (sign-in gate):', {
                        code: verifyError.code,
                        message: verifyError.message,
                        email,
                        uid: result.user.uid
                    });
                }

                await auth.signOut();
                this.showInfo('Please verify your email before signing in. Verification email request was submitted. If you don\'t see it, check spam/junk.', true);
                return;
            }

            // Keep profile verification state in sync.
            await database.ref(`users/${result.user.uid}/profile`).update({
                emailVerified: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            }).catch(() => {});

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

        if (!this.signupTermsAgreeInput.checked) {
            this.showError('Please review and agree to the Terms of Service to create your account.');
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

            // Ensure profile name is correct in RTDB immediately on first account creation.
            // This prevents initial profile/name writes from temporarily using email fallback.
            try {
                const uid = result.user.uid;
                await database.ref(`users/${uid}/profile`).update({
                    name,
                    email: result.user.email,
                    photoURL: result.user.photoURL || null,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP,
                    termsAccepted: true,
                    termsAcceptedAt: firebase.database.ServerValue.TIMESTAMP,
                    termsVersion: this.termsVersion,
                    emailVerified: !!result.user.emailVerified
                });
            } catch (profileWriteError) {
                console.warn('Immediate profile name write failed after signup:', profileWriteError);
            }

            // Require email verification for email/password accounts.
            try {
                await result.user.sendEmailVerification();
                console.log('Verification email send requested (signup):', {
                    email,
                    uid: result.user.uid,
                    provider: result.user.providerData?.map(p => p.providerId)
                });
                this.showInfo(`Verification email requested for ${email} at ${new Date().toLocaleTimeString()}. If you don't see it, check spam/junk.`, true);
            } catch (verifyError) {
                console.error('Verification email send failed (signup):', {
                    code: verifyError.code,
                    message: verifyError.message,
                    email,
                    uid: result.user.uid
                });
                throw verifyError;
            }

            await auth.signOut();
            alert(`Account created. We sent a verification email to ${email}. Please verify your email, then sign in. If you don't see it, check your spam/junk folder.`);

            console.log('User account created (verification required):', result.user.email);
            
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
        this.updateSignupButtonState();
        this.signupNameInput.focus();
    }

    showSigninForm() {
        this.emailAuthForm.classList.add('active');
        this.emailSignupForm.classList.remove('active');
        this.hideError();
        this.updateSignupButtonState();
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

    async resendVerificationEmail() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        if (!email || !password) {
            this.showError('Enter your email and password, then tap "Resend verification email".');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        const originalText = this.resendVerificationBtn ? this.resendVerificationBtn.innerHTML : '';

        try {
            if (this.resendVerificationBtn) {
                this.resendVerificationBtn.disabled = true;
                this.resendVerificationBtn.textContent = 'Sending...';
            }

            this.suppressAuthStateHandling = true;
            const result = await auth.signInWithEmailAndPassword(email, password);
            await result.user.reload();

            if (result.user.emailVerified) {
                alert('This email is already verified. You can sign in now.');
            } else {
                try {
                    await result.user.sendEmailVerification();
                    console.log('Verification email send requested (manual resend):', {
                        email,
                        uid: result.user.uid,
                        provider: result.user.providerData?.map(p => p.providerId)
                    });
                    this.showInfo(`Verification email requested for ${email} at ${new Date().toLocaleTimeString()}. If you don't see it, check spam/junk.`, true);
                    alert(`Verification email sent to ${email}. Please verify, then sign in. If you don't see it, check your spam/junk folder.`);
                } catch (verifyError) {
                    console.error('Verification email send failed (manual resend):', {
                        code: verifyError.code,
                        message: verifyError.message,
                        email,
                        uid: result.user.uid
                    });
                    this.showError(`Could not send verification email (${verifyError.code || 'unknown-error'}).`);
                }
            }

            await auth.signOut();
            this.hideError();
        } catch (error) {
            console.error('Resend verification error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.suppressAuthStateHandling = false;
            if (this.resendVerificationBtn) {
                this.resendVerificationBtn.disabled = false;
                this.resendVerificationBtn.innerHTML = originalText || 'Resend verification email';
            }
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

            const dbManager = window.BillysListApp?.databaseManager || window.billysListApp?.databaseManager || window.billysListApp?.database;
            if (dbManager) {
                await dbManager.setCurrentUser(this.currentUser);
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

    async deleteAccount() {
        this.hideAppMenu();
        if (!this.currentUser) return;

        const firstConfirm = confirm('Delete your account permanently? This will remove your profile and all lists you own.');
        if (!firstConfirm) return;

        // Check recency before requiring typed confirmation.
        const lastSignInMs = new Date(this.currentUser.metadata?.lastSignInTime || 0).getTime();
        if (!lastSignInMs || (Date.now() - lastSignInMs) > (15 * 60 * 1000)) {
            alert('For security, please sign out and sign back in, then try Delete Account again.');
            return;
        }

        const typed = prompt('Type DELETE to confirm account deletion:');
        if (typed !== 'DELETE') {
            alert('Account deletion canceled.');
            return;
        }

        const originalDeleteText = this.deleteAccountBtn.innerHTML;

        try {
            this.deleteAccountBtn.disabled = true;
            this.deleteAccountBtn.innerHTML = '⏳ Deleting account...';

            const dbManager = window.BillysListApp?.databaseManager || window.billysListApp?.databaseManager || window.billysListApp?.database;
            if (!dbManager) {
                throw new Error('Account deletion failed: database manager not available');
            }

            const deleteUid = this.currentUser.uid;
            const deleteEmail = this.currentUser.email;

            if (typeof dbManager.deleteUserDataByUid === 'function') {
                await dbManager.deleteUserDataByUid(deleteUid, deleteEmail);
            } else {
                await dbManager.deleteCurrentUserData();
            }

            await this.currentUser.delete();
            await auth.signOut().catch(() => {});
            alert('Your account has been deleted.');
        } catch (error) {
            console.error('Delete account error:', error);
            if ((error.code || '').includes('requires-recent-login')) {
                alert('For security, please sign out and sign back in, then try deleting your account again.');
            } else {
                this.showError(this.getErrorMessage(error));
            }
        } finally {
            this.deleteAccountBtn.disabled = false;
            this.deleteAccountBtn.innerHTML = originalDeleteText;
        }
    }

    updateListsHeading() {
        if (!this.listsHeading) return;
        const name = (this.currentUser && (this.currentUser.displayName || this.currentUser.email)) || 'My';
        this.listsHeading.textContent = `${name} - My Lists`;
    }

    async isTermsAccepted(user) {
        try {
            const profileSnap = await database.ref(`users/${user.uid}/profile`).once('value');
            if (!profileSnap.exists()) return false;
            const profile = profileSnap.val() || {};
            return profile.termsAccepted === true && profile.termsVersion === this.termsVersion;
        } catch (error) {
            console.warn('Failed checking terms acceptance:', error);
            return false;
        }
    }

    async recordTermsAcceptance(user) {
        await database.ref(`users/${user.uid}/profile`).update({
            termsAccepted: true,
            termsAcceptedAt: firebase.database.ServerValue.TIMESTAMP,
            termsVersion: this.termsVersion,
            email: user.email || null,
            name: user.displayName || user.email || 'User',
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }

    updateTermsModalButtonState() {
        if (!this.termsAcceptBtn || !this.termsModalAgreeInput) return;
        this.termsAcceptBtn.disabled = !this.termsModalAgreeInput.checked;
    }

    showTermsModal() {
        if (!this.termsModal) {
            // Fallback safety if markup is missing
            return Promise.resolve(confirm('Accept Terms of Service to continue?'));
        }

        if (this.termsVersionLabel) {
            this.termsVersionLabel.textContent = `Version: ${this.termsVersion}`;
        }

        this.termsModalAgreeInput.checked = false;
        this.updateTermsModalButtonState();
        this.termsModal.style.display = 'flex';

        return new Promise((resolve) => {
            this.termsModalResolver = resolve;
        });
    }

    resolveTermsModal(accepted) {
        if (this.termsModal) {
            this.termsModal.style.display = 'none';
        }

        if (this.termsModalResolver) {
            const resolver = this.termsModalResolver;
            this.termsModalResolver = null;
            resolver(accepted);
        }
    }

    async ensureTermsAccepted(user) {
        if (await this.isTermsAccepted(user)) return true;

        const accepted = await this.showTermsModal();

        if (!accepted) {
            await auth.signOut().catch(() => {});
            return false;
        }

        await this.recordTermsAcceptance(user);
        return true;
    }

    // Handle signed in state
    async handleSignedIn(user) {
        if (this.termsCheckInProgress) return;

        let resolvedUser = user;

        // Firebase may initially provide an auth object without the just-updated displayName.
        // Reload to get the latest profile so heading/UI use the correct name immediately.
        try {
            await user.reload();
            resolvedUser = auth.currentUser || user;
        } catch (error) {
            console.warn('User reload failed during sign-in state handling:', error);
        }

        this.termsCheckInProgress = true;
        try {
            const hasAcceptedTerms = await this.ensureTermsAccepted(resolvedUser);
            if (!hasAcceptedTerms) return;
        } finally {
            this.termsCheckInProgress = false;
        }

        this.currentUser = resolvedUser;
        this.hideAppMenu();
        
        // Show app, hide auth
        this.authSection.style.display = 'none';
        this.appSection.style.display = 'block';
        
        this.updateListsHeading();

        // Prevent duplicate burst dispatches for the same user (can duplicate UI event bindings).
        const now = Date.now();
        if (
            this.lastSignInDispatch.uid === resolvedUser.uid &&
            (now - this.lastSignInDispatch.at) < 2000
        ) {
            console.log('Skipping duplicate user-signed-in dispatch for', resolvedUser.email);
            return;
        }
        this.lastSignInDispatch = { uid: resolvedUser.uid, at: now };

        // Dispatch user signed in event for the main app to handle
        window.dispatchEvent(new CustomEvent('user-signed-in', { 
            detail: { user: resolvedUser } 
        }));
        
        console.log('User authenticated:', resolvedUser.displayName || resolvedUser.email);
    }

    // Handle signed out state
    handleSignedOut() {
        this.currentUser = null;
        this.termsCheckInProgress = false;
        this.resolveTermsModal(false);
        this.hideAppMenu();
        
        // Show auth, hide app
        this.authSection.style.display = 'flex';
        this.appSection.style.display = 'none';
        
        // Reset forms
        this.resetAuthForms();

        // Restore pending informational message (e.g., verification email request) after sign-out reset.
        if (this.pendingAuthInfoMessage) {
            this.showInfo(this.pendingAuthInfoMessage, false);
            this.pendingAuthInfoMessage = null;
        }
        
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
        this.signupTermsAgreeInput.checked = false;
        this.updateSignupButtonState();
        this.hideError();
    }

    updateSignupButtonState() {
        const onSignupForm = this.emailSignupForm.classList.contains('active');
        if (!onSignupForm) {
            this.signUpEmailBtn.disabled = false;
            return;
        }

        this.signUpEmailBtn.disabled = !this.signupTermsAgreeInput.checked;
    }

    // Error/info handling
    showError(message) {
        this.authError.classList.remove('auth-info');
        this.authError.textContent = message;
        this.authError.style.display = 'block';
    }

    showInfo(message, persistAfterSignOut = false) {
        this.authError.classList.add('auth-info');
        this.authError.textContent = message;
        this.authError.style.display = 'block';

        if (persistAfterSignOut) {
            this.pendingAuthInfoMessage = message;
        }
    }

    hideError() {
        this.authError.classList.remove('auth-info');
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