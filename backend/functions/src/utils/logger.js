// backend/functions/src/utils/logger.js

import admin from 'firebase-admin';
import { MONITORING, ENVIRONMENT, COLLECTIONS } from './constants.js';

/**
 * Advanced Logging System for Pi Lottery Platform
 * Provides structured logging with multiple outputs and severity levels
 */
class Logger {
  constructor() {
    this.environment = process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT;
    this.enableDetailedLogging = process.env.ENABLE_DETAILED_LOGGING === 'true';
    this.logLevel = process.env.LOG_LEVEL || MONITORING.LOG_LEVELS.INFO;
    this.serviceName = 'pi-lottery-platform';
    this.version = process.env.APP_VERSION || '1.0.0';
    this.db = admin.firestore();
    
    // Log level hierarchy
    this.logLevels = {
      [MONITORING.LOG_LEVELS.DEBUG]: 0,
      [MONITORING.LOG_LEVELS.INFO]: 1,
      [MONITORING.LOG_LEVELS.WARN]: 2,
      [MONITORING.LOG_LEVELS.ERROR]: 3,
      [MONITORING.LOG_LEVELS.FATAL]: 4
    };
    
    this.currentLogLevel = this.logLevels[this.logLevel] || 1;
  }

  /**
   * Check if log level should be output
   * @param {string} level - Log level
   * @returns {boolean} Whether to log
   */
  shouldLog(level) {
    return this.logLevels[level] >= this.currentLogLevel;
  }

  /**
   * Create structured log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Error} error - Error object (optional)
   * @returns {Object} Structured log entry
   */
  createLogEntry(level, message, context = {}, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      service: this.serviceName,
      version: this.version,
      environment: this.environment,
      context: {
        ...context,
        requestId: context.requestId || this.generateRequestId(),
        userId: context.userId || null,
        sessionId: context.sessionId || null
      }
    };

    // Add error details if present
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code || null
      };
    }

    // Add performance metrics if available
    if (context.performance) {
      logEntry.performance = context.performance;
    }

    return logEntry;
  }

  /**
   * Output log to console with formatting
   * @param {Object} logEntry - Structured log entry
   */
  outputToConsole(logEntry) {
    const { level, message, timestamp, context, error } = logEntry;
    
    // Color coding for different log levels
    const colors = {
      [MONITORING.LOG_LEVELS.DEBUG]: '\x1b[36m', // Cyan
      [MONITORING.LOG_LEVELS.INFO]: '\x1b[32m',  // Green
      [MONITORING.LOG_LEVELS.WARN]: '\x1b[33m',  // Yellow
      [MONITORING.LOG_LEVELS.ERROR]: '\x1b[31m', // Red
      [MONITORING.LOG_LEVELS.FATAL]: '\x1b[35m'  // Magenta
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    // Basic log output
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`);
    
    // Detailed context in development
    if (this.environment === ENVIRONMENT.DEVELOPMENT && this.enableDetailedLogging) {
      if (Object.keys(context).length > 0) {
        console.log('Context:', JSON.stringify(context, null, 2));
      }
      
      if (error) {
        console.log('Error:', JSON.stringify(error, null, 2));
      }
    }
  }

  /**
   * Store log in Firestore for persistence
   * @param {Object} logEntry - Structured log entry
   */
  async storeLog(logEntry) {
    try {
      // Only store important logs to reduce storage costs
      if (logEntry.level === MONITORING.LOG_LEVELS.ERROR || 
          logEntry.level === MONITORING.LOG_LEVELS.FATAL ||
          this.enableDetailedLogging) {
        
        await this.db.collection(COLLECTIONS.ERROR_LOGS).add({
          ...logEntry,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to store log:', error.message);
    }
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  debug(message, context = {}) {
    if (!this.shouldLog(MONITORING.LOG_LEVELS.DEBUG)) return;
    
    const logEntry = this.createLogEntry(MONITORING.LOG_LEVELS.DEBUG, message, context);
    this.outputToConsole(logEntry);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  info(message, context = {}) {
    if (!this.shouldLog(MONITORING.LOG_LEVELS.INFO)) return;
    
    const logEntry = this.createLogEntry(MONITORING.LOG_LEVELS.INFO, message, context);
    this.outputToConsole(logEntry);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  warn(message, context = {}) {
    if (!this.shouldLog(MONITORING.LOG_LEVELS.WARN)) return;
    
    const logEntry = this.createLogEntry(MONITORING.LOG_LEVELS.WARN, message, context);
    this.outputToConsole(logEntry);
    
    // Store warnings in production
    if (this.environment === ENVIRONMENT.PRODUCTION) {
      this.storeLog(logEntry).catch(() => {});
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Error} error - Error object
   */
  error(message, context = {}, error = null) {
    if (!this.shouldLog(MONITORING.LOG_LEVELS.ERROR)) return;
    
    const logEntry = this.createLogEntry(MONITORING.LOG_LEVELS.ERROR, message, context, error);
    this.outputToConsole(logEntry);
    this.storeLog(logEntry).catch(() => {});
  }

  /**
   * Log fatal error message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Error} error - Error object
   */
  fatal(message, context = {}, error = null) {
    const logEntry = this.createLogEntry(MONITORING.LOG_LEVELS.FATAL, message, context, error);
    this.outputToConsole(logEntry);
    this.storeLog(logEntry).catch(() => {});
  }

  /**
   * Log API request
   * @param {Object} request - Request object
   * @param {Object} response - Response object
   * @param {number} duration - Request duration in ms
   */
  logApiRequest(request, response, duration) {
    const context = {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      statusCode: response.statusCode,
      performance: {
        duration,
        timestamp: Date.now()
      }
    };

    if (response.statusCode >= 400) {
      this.error(`API request failed: ${request.method} ${request.url}`, context);
    } else {
      this.info(`API request: ${request.method} ${request.url}`, context);
    }
  }

  /**
   * Log lottery operation
   * @param {string} operation - Operation type
   * @param {Object} details - Operation details
   * @param {string} userId - User ID (optional)
   */
  logLotteryOperation(operation, details, userId = null) {
    this.info(`Lottery operation: ${operation}`, {
      operation,
      ...details,
      userId,
      category: 'lottery'
    });
  }

  /**
   * Log payment operation
   * @param {string} operation - Operation type
   * @param {Object} details - Payment details
   * @param {string} userId - User ID
   */
  logPaymentOperation(operation, details, userId) {
    this.info(`Payment operation: ${operation}`, {
      operation,
      ...details,
      userId,
      category: 'payment'
    });
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} details - Event details
   * @param {string} severity - Event severity
   */
  logSecurityEvent(event, details, severity = 'medium') {
    const logLevel = severity === 'high' ? MONITORING.LOG_LEVELS.ERROR : MONITORING.LOG_LEVELS.WARN;
    
    const message = `Security event: ${event}`;
    const context = {
      event,
      severity,
      ...details,
      category: 'security'
    };

    if (logLevel === MONITORING.LOG_LEVELS.ERROR) {
      this.error(message, context);
    } else {
      this.warn(message, context);
    }
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      performance: {
        duration,
        timestamp: Date.now()
      },
      ...metadata,
      category: 'performance'
    });
  }

  /**
   * Log user action
   * @param {string} action - User action
   * @param {string} userId - User ID
   * @param {Object} details - Action details
   */
  logUserAction(action, userId, details = {}) {
    this.info(`User action: ${action}`, {
      action,
      userId,
      ...details,
      category: 'user_action'
    });
  }

  /**
   * Log admin action
   * @param {string} action - Admin action
   * @param {string} adminId - Admin user ID
   * @param {Object} details - Action details
   */
  logAdminAction(action, adminId, details = {}) {
    this.warn(`Admin action: ${action}`, {
      action,
      adminId,
      ...details,
      category: 'admin_action'
    });
  }

  /**
   * Create child logger with additional context
   * @param {Object} additionalContext - Context to add to all logs
   * @returns {Logger} Child logger instance
   */
  child(additionalContext) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = {
      ...(this.defaultContext || {}),
      ...additionalContext
    };
    
    // Override logging methods to include default context
    ['debug', 'info', 'warn', 'error', 'fatal'].forEach(method => {
      const originalMethod = this[method].bind(this);
      childLogger[method] = (message, context = {}) => {
        originalMethod(message, { ...childLogger.defaultContext, ...context });
      };
    });
    
    return childLogger;
  }

  /**
   * Log structured data for analytics
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  logAnalytics(event, data = {}) {
    this.info(`Analytics: ${event}`, {
      event,
      ...data,
      category: 'analytics',
      timestamp: Date.now()
    });
  }

  /**
   * Start performance timer
   * @param {string} operation - Operation name
   * @returns {Function} Function to end timer
   */
  startTimer(operation) {
    const startTime = process.hrtime.bigint();
    
    return (metadata = {}) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      this.logPerformance(operation, duration, metadata);
      return duration;
    };
  }

  /**
   * Batch log multiple entries
   * @param {Array} logEntries - Array of log entries
   */
  async batchLog(logEntries) {
    const batch = this.db.batch();
    
    logEntries.forEach(entry => {
      if (entry.level === MONITORING.LOG_LEVELS.ERROR || 
          entry.level === MONITORING.LOG_LEVELS.FATAL ||
          this.enableDetailedLogging) {
        
        const docRef = this.db.collection(COLLECTIONS.ERROR_LOGS).doc();
        batch.set(docRef, {
          ...entry,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    try {
      await batch.commit();
    } catch (error) {
      console.error('Failed to batch log entries:', error.message);
    }
  }

  /**
   * Get recent logs from database
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Recent log entries
   */
  async getRecentLogs(filters = {}) {
    try {
      let query = this.db.collection(COLLECTIONS.ERROR_LOGS);
      
      if (filters.level) {
        query = query.where('level', '==', filters.level);
      }
      
      if (filters.category) {
        query = query.where('context.category', '==', filters.category);
      }
      
      if (filters.userId) {
        query = query.where('context.userId', '==', filters.userId);
      }
      
      query = query.orderBy('createdAt', 'desc').limit(filters.limit || 100);
      
      const snapshot = await query.get();
      const logs = [];
      
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      
      return logs;
    } catch (error) {
      this.error('Failed to retrieve logs', { error: error.message });
      return [];
    }
  }

  /**
   * Clear old logs (maintenance function)
   * @param {number} daysToKeep - Number of days to keep logs
   */
  async clearOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const query = this.db.collection(COLLECTIONS.ERROR_LOGS)
        .where('createdAt', '<', cutoffDate)
        .limit(500);
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        this.info('No old logs to clear');
        return 0;
      }
      
      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      this.info(`Cleared ${snapshot.size} old log entries`);
      return snapshot.size;
    } catch (error) {
      this.error('Failed to clear old logs', { error: error.message });
      return 0;
    }
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Export logger methods for convenience
export const { debug, info, warn, error, fatal } = logger;

// Export specialized logging functions
export const logApiRequest = logger.logApiRequest.bind(logger);
export const logLotteryOperation = logger.logLotteryOperation.bind(logger);
export const logPaymentOperation = logger.logPaymentOperation.bind(logger);
export const logSecurityEvent = logger.logSecurityEvent.bind(logger);
export const logPerformance = logger.logPerformance.bind(logger);
export const logUserAction = logger.logUserAction.bind(logger);
export const logAdminAction = logger.logAdminAction.bind(logger);
export const logAnalytics = logger.logAnalytics.bind(logger);
export const startTimer = logger.startTimer.bind(logger);

export default logger;
