const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * Error categories for better handling and logging
 */
const ErrorCategories = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  PAYMENT: 'payment',
  LOTTERY: 'lottery',
  DATABASE: 'database',
  EXTERNAL_API: 'external_api',
  SYSTEM: 'system',
  RATE_LIMIT: 'rate_limit',
  MAINTENANCE: 'maintenance'
};

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, category = ErrorCategories.SYSTEM, statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, ErrorCategories.AUTHENTICATION, 401);
  }
}

/**
 * Authorization error
 */
class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, ErrorCategories.AUTHORIZATION, 403);
  }
}

/**
 * Validation error
 */
class ValidationError extends AppError {
  constructor(message = 'Invalid input data', details = {}) {
    super(message, ErrorCategories.VALIDATION, 400);
    this.details = details;
  }
}

/**
 * Payment processing error
 */
class PaymentError extends AppError {
  constructor(message = 'Payment processing failed', paymentId = null) {
    super(message, ErrorCategories.PAYMENT, 402);
    this.paymentId = paymentId;
  }
}

/**
 * Lottery operation error
 */
class LotteryError extends AppError {
  constructor(message = 'Lottery operation failed', lotteryId = null) {
    super(message, ErrorCategories.LOTTERY, 422);
    this.lotteryId = lotteryId;
  }
}

/**
 * Rate limiting error
 */
class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = 3600) {
    super(message, ErrorCategories.RATE_LIMIT, 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * Maintenance mode error
 */
class MaintenanceError extends AppError {
  constructor(message = 'System is under maintenance') {
    super(message, ErrorCategories.MAINTENANCE, 503);
  }
}

/**
 * Generic error handler for Cloud Functions
 */
function handleCloudFunctionError(error, context = {}) {
  const errorId = generateErrorId();
  
  // Log error details
  logger.error('Cloud Function Error:', {
    errorId,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });

  // Store error in database for admin review
  storeErrorInDatabase(error, errorId, context);

  // Determine appropriate Functions error type
  if (error instanceof AuthenticationError) {
    throw new functions.https.HttpsError('unauthenticated', error.message);
  } else if (error instanceof AuthorizationError) {
    throw new functions.https.HttpsError('permission-denied', error.message);
  } else if (error instanceof ValidationError) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  } else if (error instanceof PaymentError) {
    throw new functions.https.HttpsError('failed-precondition', error.message);
  } else if (error instanceof RateLimitError) {
    throw new functions.https.HttpsError('resource-exhausted', error.message);
  } else if (error instanceof MaintenanceError) {
    throw new functions.https.HttpsError('unavailable', error.message);
  } else {
    // Generic internal error
    throw new functions.https.HttpsError('internal', 'An internal error occurred');
  }
}

/**
 * Express middleware error handler
 */
function expressErrorHandler(error, req, res, next) {
  const errorId = generateErrorId();
  
  // Log error details
  logger.error('Express Error:', {
    errorId,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    user: req.user?.uid || null,
    timestamp: new Date().toISOString()
  });

  // Store error in database
  storeErrorInDatabase(error, errorId, {
    url: req.url,
    method: req.method,
    user: req.user?.uid || null
  });

  // Send appropriate response
  const statusCode = error.statusCode || 500;
  const response = {
    error: {
      id: errorId,
      message: error.isOperational ? error.message : 'Internal server error',
      category: error.category || ErrorCategories.SYSTEM,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.details = error.details || {};
  }

  res.status(statusCode).json(response);
}

/**
 * Store error information in database for admin review
 */
async function storeErrorInDatabase(error, errorId, context = {}) {
  try {
    const db = admin.firestore();
    
    const errorData = {
      id: errorId,
      message: error.message,
      category: error.category || ErrorCategories.SYSTEM,
      statusCode: error.statusCode || 500,
      stack: error.stack,
      context,
      isOperational: error.isOperational || false,
      resolved: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    // Add error-specific data
    if (error instanceof PaymentError && error.paymentId) {
      errorData.paymentId = error.paymentId;
    }
    
    if (error instanceof LotteryError && error.lotteryId) {
      errorData.lotteryId = error.lotteryId;
    }

    if (error instanceof ValidationError && error.details) {
      errorData.validationDetails = error.details;
    }

    await db.collection('error_logs').doc(errorId).set(errorData);

    // Create admin alert for critical errors
    if (!error.isOperational && error.statusCode >= 500) {
      await createAdminAlert(error, errorId);
    }
  } catch (dbError) {
    logger.error('Failed to store error in database:', dbError);
  }
}

/**
 * Create admin alert for critical errors
 */
async function createAdminAlert(error, errorId) {
  try {
    const db = admin.firestore();
    
    await db.collection('admin_alerts').add({
      type: 'critical_error',
      errorId,
      title: `Critical Error: ${error.message}`,
      description: `A critical system error occurred that requires immediate attention.`,
      category: error.category,
      severity: 'high',
      resolved: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (alertError) {
    logger.error('Failed to create admin alert:', alertError);
  }
}

/**
 * Generate unique error ID
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate error recovery
 */
async function validateErrorRecovery(errorId, recoveryAction, adminId) {
  try {
    const db = admin.firestore();
    const errorDoc = await db.collection('error_logs').doc(errorId).get();
    
    if (!errorDoc.exists) {
      throw new ValidationError('Error not found');
    }

    const errorData = errorDoc.data();
    
    if (errorData.resolved) {
      throw new ValidationError('Error already resolved');
    }

    // Log recovery action
    await db.collection('error_logs').doc(errorId).update({
      resolved: true,
      recoveryAction,
      resolvedBy: adminId,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log admin action
    await db.collection('admin_logs').add({
      action: 'error_resolved',
      details: {
        errorId,
        recoveryAction,
        adminId
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      errorId,
      recoveryAction
    };
  } catch (error) {
    logger.error('Error recovery validation failed:', error);
    throw error;
  }
}

/**
 * Get error statistics for admin dashboard
 */
async function getErrorStatistics(timeRange = 24) {
  try {
    const db = admin.firestore();
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    const errorsSnapshot = await db.collection('error_logs')
      .where('timestamp', '>=', startTime)
      .get();

    const statistics = {
      total: 0,
      byCategory: {},
      byStatusCode: {},
      resolved: 0,
      unresolved: 0,
      critical: 0
    };

    errorsSnapshot.forEach(doc => {
      const errorData = doc.data();
      statistics.total++;

      // Count by category
      const category = errorData.category || 'unknown';
      statistics.byCategory[category] = (statistics.byCategory[category] || 0) + 1;

      // Count by status code
      const statusCode = errorData.statusCode || 500;
      statistics.byStatusCode[statusCode] = (statistics.byStatusCode[statusCode] || 0) + 1;

      // Count resolved vs unresolved
      if (errorData.resolved) {
        statistics.resolved++;
      } else {
        statistics.unresolved++;
      }

      // Count critical errors
      if (!errorData.isOperational && statusCode >= 500) {
        statistics.critical++;
      }
    });

    return statistics;
  } catch (error) {
    logger.error('Failed to get error statistics:', error);
    throw error;
  }
}

/**
 * Get recent errors for admin review
 */
async function getRecentErrors(limit = 50, category = null, resolved = null) {
  try {
    const db = admin.firestore();
    let query = db.collection('error_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (resolved !== null) {
      query = query.where('resolved', '==', resolved);
    }

    const errorsSnapshot = await query.get();
    const errors = [];

    errorsSnapshot.forEach(doc => {
      const errorData = doc.data();
      errors.push({
        id: doc.id,
        ...errorData,
        timestamp: errorData.timestamp?.toDate?.()?.toISOString?.() || null,
        resolvedAt: errorData.resolvedAt?.toDate?.()?.toISOString?.() || null
      });
    });

    return errors;
  } catch (error) {
    logger.error('Failed to get recent errors:', error);
    throw error;
  }
}

/**
 * Cleanup old error logs
 */
async function cleanupOldErrors(retentionDays = 30) {
  try {
    const db = admin.firestore();
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const oldErrorsSnapshot = await db.collection('error_logs')
      .where('timestamp', '<', cutoffDate)
      .where('resolved', '==', true)
      .limit(1000)
      .get();

    const batch = db.batch();
    let deletedCount = 0;

    oldErrorsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await batch.commit();
    }

    return { deletedCount };
  } catch (error) {
    logger.error('Failed to cleanup old errors:', error);
    throw error;
  }
}

/**
 * Check system health based on error rates
 */
async function checkSystemHealthFromErrors() {
  try {
    const last1Hour = await getErrorStatistics(1);
    const last24Hours = await getErrorStatistics(24);

    const healthStatus = {
      status: 'healthy',
      lastHour: last1Hour,
      last24Hours: last24Hours,
      alerts: []
    };

    // Check error rates
    if (last1Hour.total > 50) {
      healthStatus.status = 'warning';
      healthStatus.alerts.push('High error rate in the last hour');
    }

    if (last1Hour.critical > 5) {
      healthStatus.status = 'critical';
      healthStatus.alerts.push('Multiple critical errors in the last hour');
    }

    if (last24Hours.unresolved > 100) {
      healthStatus.status = 'warning';
      healthStatus.alerts.push('Many unresolved errors');
    }

    return healthStatus;
  } catch (error) {
    logger.error('Failed to check system health from errors:', error);
    return {
      status: 'unknown',
      error: error.message
    };
  }
}

module.exports = {
  // Error classes
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  PaymentError,
  LotteryError,
  RateLimitError,
  MaintenanceError,
  
  // Error categories
  ErrorCategories,
  
  // Error handlers
  handleCloudFunctionError,
  expressErrorHandler,
  
  // Error management
  storeErrorInDatabase,
  validateErrorRecovery,
  getErrorStatistics,
  getRecentErrors,
  cleanupOldErrors,
  checkSystemHealthFromErrors
};
