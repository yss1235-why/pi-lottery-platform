import { PI_NETWORK_CONFIG } from './constants';

/**
 * Pi Network SDK Configuration and Management
 * Handles Pi Network authentication, payments, and SDK integration
 */
class PiNetworkConfig {
  constructor() {
    this.isInitialized = false;
    this.isConnected = false;
    this.currentUser = null;
    this.sessionData = null;
    
    this.config = {
      version: PI_NETWORK_CONFIG.version,
      sandbox: PI_NETWORK_CONFIG.sandbox,
      productionHostname: PI_NETWORK_CONFIG.productionHostname,
      apiKey: PI_NETWORK_CONFIG.apiKey
    };

    this.callbacks = {
      onAuthStateChange: new Set(),
      onPaymentStateChange: new Set(),
      onConnectionStateChange: new Set()
    };

    // Bind methods to preserve context
    this.handleIncompletePayment = this.handleIncompletePayment.bind(this);
    this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
  }

  /**
   * Initialize Pi Network SDK
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Validate environment
      if (!this.isInPiBrowser()) {
        console.warn('Pi SDK not available - likely running outside Pi Browser');
        return false;
      }

      // Validate configuration
      if (!this.validateConfiguration()) {
        throw new Error('Invalid Pi Network configuration');
      }

      // Initialize Pi SDK
      await window.Pi.init(this.config);
      this.isInitialized = true;
      this.isConnected = true;
      
      console.log('Pi Network SDK initialized successfully', {
        sandbox: this.config.sandbox,
        version: this.config.version,
        hostname: this.config.productionHostname
      });

      this.notifyConnectionStateChange(true);
      return true;

    } catch (error) {
      console.error('Failed to initialize Pi Network SDK:', error);
      this.isInitialized = false;
      this.isConnected = false;
      this.notifyConnectionStateChange(false);
      return false;
    }
  }

  /**
   * Authenticate user with Pi Network
   * @param {Array} scopes - Requested permission scopes
   * @param {Function} onIncompletePaymentFound - Callback for incomplete payments
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate(scopes = PI_NETWORK_CONFIG.defaultScopes, onIncompletePaymentFound = null) {
    if (!this.isInitialized) {
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error('Pi SDK initialization failed');
      }
    }

    try {
      const authResult = await window.Pi.authenticate(
        scopes,
        onIncompletePaymentFound || this.handleIncompletePayment
      );
      
      this.currentUser = authResult.user;
      this.sessionData = {
        accessToken: authResult.accessToken,
        scopes: scopes,
        authenticatedAt: new Date().toISOString()
      };

      console.log('Pi Network authentication successful:', {
        user: authResult.user.username,
        scopes: scopes
      });

      this.notifyAuthStateChange(authResult);
      return authResult;

    } catch (error) {
      console.error('Pi Network authentication failed:', error);
      this.handleAuthenticationError(error);
      throw error;
    }
  }

  /**
   * Create Pi Network payment
   * @param {Object} paymentData - Payment information
   * @param {Object} callbacks - Payment lifecycle callbacks
   * @returns {Promise<Object>} Payment result
   */
  async createPayment(paymentData, callbacks = {}) {
    if (!this.isInitialized) {
      throw new Error('Pi SDK not initialized');
    }

    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Validate payment data
    const validatedPaymentData = this.validatePaymentData(paymentData);

    try {
      const payment = await window.Pi.createPayment(validatedPaymentData, {
        onReadyForServerApproval: callbacks.onReadyForServerApproval || this.handleServerApproval.bind(this),
        onReadyForServerCompletion: callbacks.onReadyForServerCompletion || this.handleServerCompletion.bind(this),
        onCancel: callbacks.onCancel || this.handlePaymentCancel.bind(this),
        onError: callbacks.onError || this.handlePaymentError.bind(this)
      });

      console.log('Payment created successfully:', payment.identifier);
      this.notifyPaymentStateChange({ type: 'created', payment });
      return payment;

    } catch (error) {
      console.error('Payment creation failed:', error);
      this.handlePaymentError(error, paymentData);
      throw error;
    }
  }

  /**
   * Handle incomplete payment found during authentication
   * @param {Object} payment - Incomplete payment object
   * @returns {Promise<Object>} Completion result
   */
  async handleIncompletePayment(payment) {
    console.log('Handling incomplete payment:', payment.identifier);
    
    try {
      const result = await window.Pi.completePayment(payment.identifier);
      console.log('Incomplete payment completed:', result);
      return result;
    } catch (error) {
      console.error('Failed to complete incomplete payment:', error);
      throw error;
    }
  }

  /**
   * Default server approval handler
   * @param {String} paymentId - Payment identifier
   * @returns {Object} Approval response
   */
  async handleServerApproval(paymentId) {
    console.log('Payment ready for server approval:', paymentId);
    
    try {
      // In a real implementation, this would call your backend API
      // For now, we'll return a default approval
      const approvalResult = { approved: true, paymentId };
      
      this.notifyPaymentStateChange({ 
        type: 'ready_for_approval', 
        paymentId, 
        result: approvalResult 
      });
      
      return approvalResult;
    } catch (error) {
      console.error('Server approval failed:', error);
      throw error;
    }
  }

  /**
   * Default server completion handler
   * @param {String} paymentId - Payment identifier
   * @param {String} txid - Transaction ID
   * @returns {Object} Completion response
   */
  async handleServerCompletion(paymentId, txid) {
    console.log('Payment ready for server completion:', paymentId, txid);
    
    try {
      // In a real implementation, this would call your backend API
      const completionResult = { completed: true, paymentId, txid };
      
      this.notifyPaymentStateChange({ 
        type: 'completed', 
        paymentId, 
        txid, 
        result: completionResult 
      });
      
      return completionResult;
    } catch (error) {
      console.error('Server completion failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment cancellation
   * @param {String} paymentId - Payment identifier
   */
  handlePaymentCancel(paymentId) {
    console.log('Payment cancelled:', paymentId);
    this.notifyPaymentStateChange({ type: 'cancelled', paymentId });
  }

  /**
   * Handle payment errors
   * @param {Error} error - Payment error
   * @param {Object} payment - Payment data
   */
  handlePaymentError(error, payment = null) {
    console.error('Payment error:', error);
    this.notifyPaymentStateChange({ 
      type: 'error', 
      error: error.message, 
      payment 
    });
  }

  /**
   * Handle authentication errors
   * @param {Error} error - Authentication error
   */
  handleAuthenticationError(error) {
    console.error('Authentication error:', error);
    this.currentUser = null;
    this.sessionData = null;
    this.notifyAuthStateChange({ error: error.message, user: null });
  }

  /**
   * Validate payment data
   * @param {Object} paymentData - Raw payment data
   * @returns {Object} Validated payment data
   */
  validatePaymentData(paymentData) {
    const required = ['amount', 'memo'];
    const missing = required.filter(field => !paymentData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required payment fields: ${missing.join(', ')}`);
    }

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (paymentData.memo.length > 200) {
      throw new Error('Payment memo too long (max 200 characters)');
    }

    return {
      amount: amount,
      memo: paymentData.memo,
      metadata: {
        ...paymentData.metadata,
        platform: 'pi-lottery-platform',
        version: PI_NETWORK_CONFIG.version,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Validate Pi Network configuration
   * @returns {boolean} Configuration validity
   */
  validateConfiguration() {
    if (!this.config.version) {
      console.error('Pi SDK version not specified');
      return false;
    }

    if (this.config.sandbox === undefined) {
      console.error('Pi sandbox mode not specified');
      return false;
    }

    if (!this.config.productionHostname) {
      console.error('Pi production hostname not specified');
      return false;
    }

    return true;
  }

  /**
   * Check if running in Pi Browser
   * @returns {boolean} Pi Browser status
   */
  isInPiBrowser() {
    return typeof window !== 'undefined' && 
           typeof window.Pi !== 'undefined' &&
           typeof window.Pi.init === 'function';
  }

  /**
   * Get current user information
   * @returns {Object|null} Current user data
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get session information
   * @returns {Object|null} Session data
   */
  getSessionData() {
    return this.sessionData;
  }

  /**
   * Get SDK configuration
   * @returns {Object} Configuration object
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Get connection status
   * @returns {Object} Connection status information
   */
  getConnectionStatus() {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.isConnected,
      isInPiBrowser: this.isInPiBrowser(),
      hasUser: !!this.currentUser,
      sdkAvailable: typeof window !== 'undefined' && typeof window.Pi !== 'undefined'
    };
  }

  /**
   * Add authentication state change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    this.callbacks.onAuthStateChange.add(callback);
    return () => this.callbacks.onAuthStateChange.delete(callback);
  }

  /**
   * Add payment state change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onPaymentStateChange(callback) {
    this.callbacks.onPaymentStateChange.add(callback);
    return () => this.callbacks.onPaymentStateChange.delete(callback);
  }

  /**
   * Add connection state change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onConnectionStateChange(callback) {
    this.callbacks.onConnectionStateChange.add(callback);
    return () => this.callbacks.onConnectionStateChange.delete(callback);
  }

  /**
   * Notify authentication state change listeners
   * @param {Object} authData - Authentication data
   */
  notifyAuthStateChange(authData) {
    this.callbacks.onAuthStateChange.forEach(callback => {
      try {
        callback(authData);
      } catch (error) {
        console.error('Auth state change callback error:', error);
      }
    });
  }

  /**
   * Notify payment state change listeners
   * @param {Object} paymentData - Payment data
   */
  notifyPaymentStateChange(paymentData) {
    this.callbacks.onPaymentStateChange.forEach(callback => {
      try {
        callback(paymentData);
      } catch (error) {
        console.error('Payment state change callback error:', error);
      }
    });
  }

  /**
   * Notify connection state change listeners
   * @param {boolean} isConnected - Connection status
   */
  notifyConnectionStateChange(isConnected) {
    this.callbacks.onConnectionStateChange.forEach(callback => {
      try {
        callback({ isConnected, timestamp: Date.now() });
      } catch (error) {
        console.error('Connection state change callback error:', error);
      }
    });
  }

  /**
   * Reset SDK state
   */
  reset() {
    this.isInitialized = false;
    this.isConnected = false;
    this.currentUser = null;
    this.sessionData = null;
    
    console.log('Pi Network SDK state reset');
    this.notifyAuthStateChange({ user: null, reset: true });
    this.notifyConnectionStateChange(false);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.callbacks.onAuthStateChange.clear();
    this.callbacks.onPaymentStateChange.clear();
    this.callbacks.onConnectionStateChange.clear();
    
    this.reset();
    console.log('Pi Network SDK cleanup completed');
  }
}

// Create singleton instance
const piNetworkConfig = new PiNetworkConfig();

// Export both the class and singleton instance
export { PiNetworkConfig };
export default piNetworkConfig;
