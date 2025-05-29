import { signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

class PiAuthService {
  constructor() {
    this.piSDK = null;
    this.currentUser = null;
    this.isAuthenticated = false;
    this.authListeners = new Set();
    this.sessionData = null;
    this.authConfig = {
      version: "2.0",
      sandbox: process.env.REACT_APP_PI_SANDBOX === 'true',
      productionHostname: process.env.REACT_APP_PRODUCTION_HOSTNAME || 'localhost:3000'
    };
    
    this.initializePiSDK();
  }

  // =============================================
  // PI SDK INITIALIZATION AND SETUP
  // =============================================

  async initializePiSDK() {
    try {
      // Check if we're in Pi Browser
      if (typeof window === 'undefined') {
        console.log('Server-side environment detected, Pi SDK not available');
        return false;
      }

      if (!window.Pi) {
        console.log('Pi SDK not available - not running in Pi Browser');
        return false;
      }

      this.piSDK = window.Pi;
      
      // Initialize Pi SDK
      await this.piSDK.init(this.authConfig);
      console.log('Pi SDK initialized successfully', this.authConfig);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Pi SDK:', error);
      return false;
    }
  }

  isPiSDKAvailable() {
    return this.piSDK !== null && typeof window !== 'undefined' && window.Pi;
  }

  isInPiBrowser() {
    return typeof window !== 'undefined' && 
           window.Pi && 
           window.navigator.userAgent.includes('PiBrowser');
  }

  // =============================================
  // AUTHENTICATION METHODS
  // =============================================

  async authenticate(scopes = ['username', 'payments']) {
    try {
      if (!this.isPiSDKAvailable()) {
        throw new Error('Pi SDK not available. Please open this app in Pi Browser.');
      }

      console.log('Starting Pi Network authentication with scopes:', scopes);
      
      // Authenticate with Pi Network
      const authResult = await this.piSDK.authenticate(
        scopes,
        this.handleIncompletePayment.bind(this)
      );

      if (!authResult || !authResult.user) {
        throw new Error('Authentication failed - no user data received');
      }

      // Validate authentication result
      this.validateAuthResult(authResult);

      // Create Firebase anonymous session
      const firebaseUser = await this.createFirebaseSession();
      
      // Link Pi user data to Firebase
      await this.linkUserData(authResult, firebaseUser);

      // Update session data
      this.sessionData = {
        piUser: authResult.user,
        firebaseUser: firebaseUser,
        accessToken: authResult.accessToken,
        scopes: scopes,
        authenticatedAt: Date.now()
      };

      this.currentUser = authResult.user;
      this.isAuthenticated = true;

      // Notify listeners
      this.notifyAuthListeners(true, this.currentUser);

      console.log('Pi Network authentication successful:', this.currentUser);
      
      return {
        success: true,
        user: this.currentUser,
        accessToken: authResult.accessToken,
        scopes: scopes
      };

    } catch (error) {
      console.error('Pi Network authentication failed:', error);
      this.handleAuthenticationError(error);
      throw error;
    }
  }

  validateAuthResult(authResult) {
    if (!authResult.user) {
      throw new Error('No user data in authentication result');
    }

    if (!authResult.user.uid) {
      throw new Error('No user ID in authentication result');
    }

    if (!authResult.user.username) {
      throw new Error('No username in authentication result');
    }

    if (!authResult.accessToken) {
      throw new Error('No access token in authentication result');
    }
  }

  async createFirebaseSession() {
    try {
      console.log('Creating Firebase anonymous session...');
      const credential = await signInAnonymously(auth);
      return credential.user;
    } catch (error) {
      console.error('Failed to create Firebase session:', error);
      throw new Error(`Firebase authentication failed: ${error.message}`);
    }
  }

  async linkUserData(authResult, firebaseUser) {
    try {
      const userId = firebaseUser.uid;
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      const userData = {
        piUID: authResult.user.uid,
        piUsername: authResult.user.username,
        piAccessToken: authResult.accessToken,
        firebaseUID: firebaseUser.uid,
        authMethod: 'pi-network',
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (userDoc.exists()) {
        // Update existing user
        await updateDoc(userRef, userData);
        console.log('User data updated in Firebase');
      } else {
        // Create new user profile
        const newUserData = {
          ...userData,
          totalEntries: 0,
          totalWinnings: 0,
          lotteriesWon: 0,
          winRate: 0,
          totalSpent: 0,
          status: 'active',
          createdAt: serverTimestamp()
        };

        await setDoc(userRef, newUserData);
        console.log('New user profile created in Firebase');
      }

      return userData;
    } catch (error) {
      console.error('Failed to link user data:', error);
      throw new Error(`User data linking failed: ${error.message}`);
    }
  }

  handleIncompletePayment(payment) {
    console.log('Handling incomplete payment:', payment);
    
    try {
      if (this.piSDK && payment && payment.identifier) {
        return this.piSDK.completePayment(payment.identifier);
      } else {
        throw new Error('Unable to complete payment - invalid payment data');
      }
    } catch (error) {
      console.error('Failed to handle incomplete payment:', error);
      throw error;
    }
  }

  handleAuthenticationError(error) {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.sessionData = null;
    
    this.notifyAuthListeners(false, null, error);
  }

  // =============================================
  // SESSION MANAGEMENT
  // =============================================

  async signOut() {
    try {
      console.log('Signing out user...');
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Clear session data
      this.currentUser = null;
      this.isAuthenticated = false;
      this.sessionData = null;
      
      // Notify listeners
      this.notifyAuthListeners(false, null);
      
      console.log('User signed out successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  getCurrentUser() {
    return {
      user: this.currentUser,
      isAuthenticated: this.isAuthenticated,
      sessionData: this.sessionData
    };
  }

  getSessionInfo() {
    if (!this.sessionData) {
      return null;
    }

    return {
      piUser: this.sessionData.piUser,
      firebaseUID: this.sessionData.firebaseUser?.uid,
      scopes: this.sessionData.scopes,
      authenticatedAt: this.sessionData.authenticatedAt,
      isExpired: this.isSessionExpired()
    };
  }

  isSessionExpired() {
    if (!this.sessionData) {
      return true;
    }

    // Sessions expire after 24 hours
    const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    return (now - this.sessionData.authenticatedAt) > sessionDuration;
  }

  async refreshSession() {
    try {
      if (!this.isAuthenticated || !this.sessionData) {
        throw new Error('No active session to refresh');
      }

      if (!this.isSessionExpired()) {
        console.log('Session is still valid, no refresh needed');
        return { success: true, refreshed: false };
      }

      console.log('Refreshing expired session...');
      
      // Re-authenticate with same scopes
      const refreshResult = await this.authenticate(this.sessionData.scopes);
      
      return { success: true, refreshed: true, result: refreshResult };
    } catch (error) {
      console.error('Session refresh failed:', error);
      throw error;
    }
  }

  // =============================================
  // PAYMENT INTEGRATION
  // =============================================

  async createPayment(amount, memo, metadata = {}) {
    try {
      if (!this.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      if (!this.isPiSDKAvailable()) {
        throw new Error('Pi SDK not available for payment creation');
      }

      const paymentData = {
        amount: parseFloat(amount),
        memo: memo,
        metadata: {
          ...metadata,
          piUID: this.currentUser.uid,
          firebaseUID: this.sessionData?.firebaseUser?.uid,
          timestamp: Date.now()
        }
      };

      console.log('Creating Pi Network payment:', paymentData);

      const payment = await this.piSDK.createPayment(paymentData, {
        onReadyForServerApproval: this.handlePaymentReadyForApproval.bind(this),
        onReadyForServerCompletion: this.handlePaymentReadyForCompletion.bind(this),
        onCancel: this.handlePaymentCancel.bind(this),
        onError: this.handlePaymentError.bind(this)
      });

      console.log('Payment created successfully:', payment.identifier);
      
      return payment;
    } catch (error) {
      console.error('Payment creation failed:', error);
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }

  handlePaymentReadyForApproval(paymentId) {
    console.log('Payment ready for server approval:', paymentId);
    
    // This will be handled by the payment service
    return { approved: true };
  }

  handlePaymentReadyForCompletion(paymentId, txid) {
    console.log('Payment ready for server completion:', paymentId, txid);
    
    // This will be handled by the payment service
    return { completed: true };
  }

  handlePaymentCancel(paymentId) {
    console.log('Payment cancelled by user:', paymentId);
  }

  handlePaymentError(error, payment) {
    console.error('Payment error occurred:', error, payment);
    throw error;
  }

  // =============================================
  // USER VERIFICATION AND VALIDATION
  // =============================================

  async verifyUserIdentity() {
    try {
      if (!this.isAuthenticated || !this.currentUser) {
        throw new Error('User not authenticated');
      }

      // Get user data from Firebase
      const userDoc = await getDoc(doc(db, 'users', this.sessionData.firebaseUser.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();
      
      // Verify Pi user data matches Firebase record
      if (userData.piUID !== this.currentUser.uid) {
        throw new Error('User identity mismatch');
      }

      if (userData.piUsername !== this.currentUser.username) {
        throw new Error('Username mismatch');
      }

      return {
        verified: true,
        user: userData,
        piUser: this.currentUser
      };
    } catch (error) {
      console.error('User identity verification failed:', error);
      throw error;
    }
  }

  async updateUserProfile(updates) {
    try {
      if (!this.isAuthenticated || !this.sessionData) {
        throw new Error('User not authenticated');
      }

      const userRef = doc(db, 'users', this.sessionData.firebaseUser.uid);
      
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  // =============================================
  // EVENT LISTENERS AND CALLBACKS
  // =============================================

  addAuthStateListener(callback) {
    this.authListeners.add(callback);
    
    // Immediately call with current state
    callback(this.isAuthenticated, this.currentUser);
    
    return () => {
      this.authListeners.delete(callback);
    };
  }

  notifyAuthListeners(isAuthenticated, user, error = null) {
    this.authListeners.forEach(callback => {
      try {
        callback(isAuthenticated, user, error);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  getAuthConfig() {
    return { ...this.authConfig };
  }

  updateAuthConfig(newConfig) {
    this.authConfig = { ...this.authConfig, ...newConfig };
    
    // Reinitialize SDK with new config if available
    if (this.isPiSDKAvailable()) {
      this.initializePiSDK();
    }
  }

  getConnectionStatus() {
    return {
      piSDKAvailable: this.isPiSDKAvailable(),
      inPiBrowser: this.isInPiBrowser(),
      isAuthenticated: this.isAuthenticated,
      sessionValid: !this.isSessionExpired(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
    };
  }

  async testConnection() {
    try {
      const status = this.getConnectionStatus();
      
      if (!status.piSDKAvailable) {
        return { success: false, error: 'Pi SDK not available' };
      }

      if (!status.inPiBrowser) {
        return { success: false, error: 'Not running in Pi Browser' };
      }

      // Test SDK initialization
      const initResult = await this.initializePiSDK();
      
      return { 
        success: initResult, 
        status: status,
        timestamp: Date.now()
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // =============================================
  // DEBUG AND LOGGING
  // =============================================

  getDebugInfo() {
    return {
      isAuthenticated: this.isAuthenticated,
      currentUser: this.currentUser ? {
        uid: this.currentUser.uid,
        username: this.currentUser.username
      } : null,
      sessionData: this.sessionData ? {
        authenticatedAt: this.sessionData.authenticatedAt,
        scopes: this.sessionData.scopes,
        isExpired: this.isSessionExpired()
      } : null,
      connectionStatus: this.getConnectionStatus(),
      authConfig: this.authConfig,
      listeners: this.authListeners.size
    };
  }

  clearSession() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.sessionData = null;
    this.notifyAuthListeners(false, null);
  }
}

// Export singleton instance
export const piAuthService = new PiAuthService();
export default piAuthService;
