// ============================================
// Error Handling Utilities
// ============================================

/**
 * Custom error classes for specific error types
 */
export class AppError extends Error {
  constructor(message, code, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
    this.value = value;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network request failed', endpoint = null) {
    super(message, 'NETWORK_ERROR', 0);
    this.endpoint = endpoint;
  }
}

export class PiNetworkError extends AppError {
  constructor(message = 'Pi Network operation failed', piError = null) {
    super(message, 'PI_NETWORK_ERROR', 500);
    this.piError = piError;
  }
}

export class LotteryError extends AppError {
  constructor(message, lotteryId = null, operation = null) {
    super(message, 'LOTTERY_ERROR', 500);
    this.lotteryId = lotteryId;
    this.operation = operation;
  }
}

export class PaymentError extends AppError {
  constructor(message, paymentId = null, amount = null) {
    super(message, 'PAYMENT_ERROR', 500);
    this.paymentId = paymentId;
    this.amount = amount;
  }
}

/**
 * Error handler for different contexts
 */
export class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
    this.listeners = new Set();
  }

  /**
   * Handle error based on context
   * @param {Error} error - Error to handle
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional error metadata
   * @returns {Object} Processed error information
   */
  handle(error, context = 'unknown', metadata = {}) {
    const errorInfo = this.processError(error, context, metadata);
    
    // Log the error
    this.logError(errorInfo);
    
    // Notify listeners
    this.notifyListeners(errorInfo);
    
    // Return user-friendly error info
    return this.sanitizeError(errorInfo);
  }

  /**
   * Process error into structured format
   * @param {Error} error - Original error
   * @param {string} context - Error context
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Processed error information
   */
  processError(error, context, metadata) {
    const isAppError = error instanceof AppError;
    
    return {
      id: this.generateErrorId(),
      message: error.message,
      code: isAppError ? error.code : 'UNKNOWN_ERROR',
      name: error.name,
      statusCode: isAppError ? error.statusCode : 500,
      context,
      metadata,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      isOperational: isAppError ? error.isOperational : false,
      ...this.extractErrorDetails(error)
    };
  }

  /**
   * Extract specific details from different error types
   * @param {Error} error - Error to analyze
   * @returns {Object} Additional error details
   */
  extractErrorDetails(error) {
    const details = {};
    
    if (error instanceof ValidationError) {
      details.field = error.field;
      details.value = error.value;
    }
    
    if (error instanceof NetworkError) {
      details.endpoint = error.endpoint;
    }
    
    if (error instanceof PiNetworkError) {
      details.piError = error.piError;
    }
    
    if (error instanceof LotteryError) {
      details.lotteryId = error.lotteryId;
      details.operation = error.operation;
    }
    
    if (error instanceof PaymentError) {
      details.paymentId = error.paymentId;
      details.amount = error.amount;
    }
    
    // Check for Firebase errors
    if (error.code && error.code.startsWith('auth/')) {
      details.firebaseCode = error.code;
      details.isFirebaseError = true;
    }
    
    return details;
  }

  /**
   * Sanitize error for user display
   * @param {Object} errorInfo - Processed error information
   * @returns {Object} User-safe error information
   */
  sanitizeError(errorInfo) {
    const userFriendlyMessages = {
      'AUTH_ERROR': 'Please check your login credentials and try again.',
      'AUTHORIZATION_ERROR': 'You do not have permission to perform this action.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'NETWORK_ERROR': 'Connection failed. Please check your internet connection.',
      'PI_NETWORK_ERROR': 'Pi Network is temporarily unavailable. Please try again later.',
      'LOTTERY_ERROR': 'Lottery operation failed. Please try again.',
      'PAYMENT_ERROR': 'Payment processing failed. Please verify your Pi balance and try again.',
      'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.'
    };

    return {
      id: errorInfo.id,
      message: errorInfo.isOperational ? errorInfo.message : userFriendlyMessages[errorInfo.code] || userFriendlyMessages['UNKNOWN_ERROR'],
      code: errorInfo.code,
      timestamp: errorInfo.timestamp,
      context: errorInfo.context,
      recoverable: errorInfo.isOperational,
      suggestions: this.generateSuggestions(errorInfo)
    };
  }

  /**
   * Generate helpful suggestions based on error type
   * @param {Object} errorInfo - Error information
   * @returns {Array} Array of suggestion strings
   */
  generateSuggestions(errorInfo) {
    const suggestions = [];
    
    switch (errorInfo.code) {
      case 'AUTH_ERROR':
        suggestions.push('Verify your Pi wallet is connected');
        suggestions.push('Try refreshing the page');
        break;
        
      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Try again in a few moments');
        break;
        
      case 'PI_NETWORK_ERROR':
        suggestions.push('Ensure you are using Pi Browser');
        suggestions.push('Check Pi Network status');
        break;
        
      case 'PAYMENT_ERROR':
        suggestions.push('Verify your Pi balance');
        suggestions.push('Check payment details');
        break;
        
      case 'LOTTERY_ERROR':
        suggestions.push('Check if lottery is still active');
        suggestions.push('Verify you have not exceeded entry limits');
        break;
        
      case 'VALIDATION_ERROR':
        if (errorInfo.field) {
          suggestions.push(`Please check the ${errorInfo.field} field`);
        }
        suggestions.push('Ensure all required fields are filled correctly');
        break;
        
      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Contact support if the problem persists');
    }
    
    return suggestions;
  }

  /**
   * Log error to internal storage
   * @param {Object} errorInfo - Error information to log
   */
  logError(errorInfo) {
    this.errorLog.unshift(errorInfo);
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
  }

  /**
   * Get recent errors
   * @param {number} limit - Number of recent errors to return
   * @returns {Array} Recent error log entries
   */
  getRecentErrors(limit = 10) {
    return this.errorLog.slice(0, limit);
  }

  /**
   * Clear error log
   */
  clearLog() {
    this.errorLog = [];
  }

  /**
   * Generate unique error ID
   * @returns {string} Unique error identifier
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add error listener
   * @param {Function} listener - Error event listener
   * @returns {Function} Cleanup function
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of error
   * @param {Object} errorInfo - Error information
   */
  notifyListeners(errorInfo) {
    this.listeners.forEach(listener => {
      try {
        listener(errorInfo);
      } catch (error) {
        console.error('Error in error listener:', error);
      }
    });
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

/**
 * Wrap function with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Error context
 * @returns {Function} Wrapped function
 */
export const withErrorHandling = (fn, context = 'unknown') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorInfo = globalErrorHandler.handle(error, context);
      throw new AppError(errorInfo.message, errorInfo.code, errorInfo.statusCode);
    }
  };
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Function result or final error
 */
export const withRetry = async (fn, options = {}) => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = (error) => error instanceof NetworkError
  } = options;

  let lastError;
  let delay = baseDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !retryCondition(error)) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }
  
  throw lastError;
};

/**
 * Create error boundary for React components
 * @param {Function} onError - Error callback
 * @returns {Object} Error boundary methods
 */
export const createErrorBoundary = (onError = null) => {
  return {
    componentDidCatch(error, errorInfo) {
      const errorData = globalErrorHandler.handle(error, 'react_component', {
        componentStack: errorInfo.componentStack
      });
      
      if (onError) {
        onError(errorData);
      }
    }
  };
};

/**
 * Validate and throw appropriate errors
 * @param {any} value - Value to validate
 * @param {string} field - Field name
 * @param {Object} rules - Validation rules
 * @throws {ValidationError} If validation fails
 */
export const validateOrThrow = (value, field, rules = {}) => {
  const { required, type, min, max, pattern, custom } = rules;
  
  if (required && (value === null || value === undefined || value === '')) {
    throw new ValidationError(`${field} is required`, field, value);
  }
  
  if (value !== null && value !== undefined && value !== '') {
    if (type && typeof value !== type) {
      throw new ValidationError(`${field} must be of type ${type}`, field, value);
    }
    
    if (type === 'string') {
      if (min && value.length < min) {
        throw new ValidationError(`${field} must be at least ${min} characters`, field, value);
      }
      if (max && value.length > max) {
        throw new ValidationError(`${field} must not exceed ${max} characters`, field, value);
      }
      if (pattern && !pattern.test(value)) {
        throw new ValidationError(`${field} format is invalid`, field, value);
      }
    }
    
    if (type === 'number') {
      if (min !== undefined && value < min) {
        throw new ValidationError(`${field} must be at least ${min}`, field, value);
      }
      if (max !== undefined && value > max) {
        throw new ValidationError(`${field} must not exceed ${max}`, field, value);
      }
    }
    
    if (custom && typeof custom === 'function') {
      const customResult = custom(value);
      if (customResult !== true) {
        throw new ValidationError(customResult || `${field} validation failed`, field, value);
      }
    }
  }
};

/**
 * Safe async function execution
 * @param {Function} fn - Async function to execute
 * @param {any} fallback - Fallback value on error
 * @returns {Promise} Result or fallback value
 */
export const safeAsync = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    globalErrorHandler.handle(error, 'safe_async');
    return fallback;
  }
};

/**
 * Handle promise rejections gracefully
 * @param {Promise} promise - Promise to handle
 * @param {any} fallback - Fallback value on rejection
 * @returns {Promise} Resolved promise with result or fallback
 */
export const handlePromise = async (promise, fallback = null) => {
  try {
    return await promise;
  } catch (error) {
    return fallback;
  }
};

/**
 * Create timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} timeoutMessage - Custom timeout message
 * @returns {Promise} Promise with timeout
 */
export const withTimeout = (promise, timeout, timeoutMessage = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AppError(timeoutMessage, 'TIMEOUT_ERROR', 408));
      }, timeout);
    })
  ]);
};

/**
 * Batch error handling for multiple operations
 * @param {Array} operations - Array of async operations
 * @param {Object} options - Batch options
 * @returns {Promise} Results with error handling
 */
export const batchWithErrorHandling = async (operations, options = {}) => {
  const { continueOnError = true, maxConcurrency = 5 } = options;
  const results = [];
  const errors = [];
  
  // Process operations in batches
  for (let i = 0; i < operations.length; i += maxConcurrency) {
    const batch = operations.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(async (operation, index) => {
      try {
        const result = await operation();
        return { success: true, result, index: i + index };
      } catch (error) {
        const errorInfo = globalErrorHandler.handle(error, 'batch_operation');
        return { success: false, error: errorInfo, index: i + index };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result.success) {
        results[result.index] = result.result;
      } else {
        errors.push(result);
        if (!continueOnError) {
          throw new AppError('Batch operation failed', 'BATCH_ERROR', 500);
        }
      }
    });
  }
  
  return { results, errors, hasErrors: errors.length > 0 };
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  PiNetworkError,
  LotteryError,
  PaymentError,
  ErrorHandler,
  globalErrorHandler,
  withErrorHandling,
  withRetry,
  createErrorBoundary,
  validateOrThrow,
  safeAsync,
  handlePromise,
  withTimeout,
  batchWithErrorHandling
};
