const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

class PaymentLogger {
  constructor() {
    this.db = admin.firestore();
    this.logLevels = {
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      DEBUG: 'debug',
      AUDIT: 'audit'
    };
  }

  /**
   * Log payment initiation
   * @param {Object} paymentData - Payment initialization data
   * @param {string} userId - User ID initiating payment
   * @param {string} lotteryTypeId - Type of lottery
   */
  async logPaymentInitiation(paymentData, userId, lotteryTypeId) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_initiation',
        level: this.logLevels.INFO,
        userId,
        lotteryTypeId,
        paymentId: paymentData.identifier,
        amount: paymentData.amount,
        memo: paymentData.memo,
        metadata: paymentData.metadata || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: this.extractIPAddress(),
        userAgent: this.extractUserAgent(),
        sessionId: this.generateSessionId(),
        status: 'initiated'
      };

      await this.writeLog('payment_logs', logEntry);
      await this.updatePaymentMetrics('initiation', paymentData.amount);

      console.log(`Payment initiated: ${paymentData.identifier} for user: ${userId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log payment initiation:', error);
      await this.logError('payment_initiation_log_error', error, { userId, paymentId: paymentData.identifier });
    }
  }

  /**
   * Log payment approval process
   * @param {string} paymentId - Pi Network payment ID
   * @param {string} userId - User ID
   * @param {Object} approvalData - Approval process data
   */
  async logPaymentApproval(paymentId, userId, approvalData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_approval',
        level: this.logLevels.AUDIT,
        userId,
        paymentId,
        approvalData: {
          approved: approvalData.approved,
          approvedBy: approvalData.approvedBy || 'system',
          approvalReason: approvalData.reason || 'automatic_approval',
          validationChecks: approvalData.validationChecks || {},
          piNetworkResponse: approvalData.piNetworkResponse || {}
        },
        processingTime: approvalData.processingTime,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: approvalData.approved ? 'approved' : 'rejected'
      };

      await this.writeLog('payment_logs', logEntry);
      await this.updatePaymentStatus(paymentId, 'approval_logged');

      if (approvalData.approved) {
        await this.updatePaymentMetrics('approval', approvalData.amount || 0);
      } else {
        await this.updatePaymentMetrics('rejection', 0);
      }

      console.log(`Payment ${approvalData.approved ? 'approved' : 'rejected'}: ${paymentId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log payment approval:', error);
      await this.logError('payment_approval_log_error', error, { userId, paymentId });
    }
  }

  /**
   * Log payment completion
   * @param {string} paymentId - Pi Network payment ID
   * @param {string} txid - Blockchain transaction ID
   * @param {string} userId - User ID
   * @param {Object} completionData - Completion data
   */
  async logPaymentCompletion(paymentId, txid, userId, completionData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_completion',
        level: this.logLevels.AUDIT,
        userId,
        paymentId,
        blockchainTxId: txid,
        completionData: {
          amount: completionData.amount,
          fee: completionData.fee || 0.01,
          netAmount: (completionData.amount || 0) - (completionData.fee || 0.01),
          blockchainConfirmations: completionData.confirmations || 0,
          lotteryEntryProcessed: completionData.lotteryEntryProcessed || false,
          prizeEligible: completionData.prizeEligible || false
        },
        blockchainData: {
          network: 'pi-network',
          blockHeight: completionData.blockHeight,
          timestamp: completionData.blockchainTimestamp,
          gasUsed: completionData.gasUsed
        },
        processingMetrics: {
          totalProcessingTime: completionData.totalProcessingTime,
          validationTime: completionData.validationTime,
          dbUpdateTime: completionData.dbUpdateTime
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'completed'
      };

      await this.writeLog('payment_logs', logEntry);
      await this.updatePaymentStatus(paymentId, 'completed');
      await this.updatePaymentMetrics('completion', completionData.amount || 0);

      // Log to revenue tracking
      await this.updateRevenueTracking(completionData);

      console.log(`Payment completed: ${paymentId} with txid: ${txid}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log payment completion:', error);
      await this.logError('payment_completion_log_error', error, { userId, paymentId, txid });
    }
  }

  /**
   * Log payment errors
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  async logPaymentError(errorType, error, context) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_error',
        level: this.logLevels.ERROR,
        errorType,
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code || 'UNKNOWN_ERROR',
        context: {
          userId: context.userId,
          paymentId: context.paymentId,
          lotteryTypeId: context.lotteryTypeId,
          amount: context.amount,
          step: context.step || 'unknown',
          additionalInfo: context.additionalInfo || {}
        },
        systemInfo: {
          nodeVersion: process.version,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          functionName: context.functionName || 'unknown',
          region: process.env.FUNCTION_REGION || 'unknown'
        },
        recoveryAttempts: context.recoveryAttempts || 0,
        status: 'error'
      };

      await this.writeLog('payment_error_logs', logEntry);
      await this.updateErrorMetrics(errorType);

      // Send alert for critical errors
      if (this.isCriticalError(errorType)) {
        await this.sendErrorAlert(logEntry);
      }

      console.error(`Payment error logged: ${errorType} - ${error.message}`);
      return logEntry.logId;

    } catch (logError) {
      console.error('Failed to log payment error:', logError);
      // Fallback logging to console if database fails
      console.error('Original error:', error);
      console.error('Context:', context);
    }
  }

  /**
   * Log payment fraud detection
   * @param {string} paymentId - Payment ID
   * @param {string} userId - User ID
   * @param {Object} fraudData - Fraud detection data
   */
  async logFraudDetection(paymentId, userId, fraudData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_fraud_detection',
        level: this.logLevels.WARN,
        userId,
        paymentId,
        fraudScore: fraudData.fraudScore,
        fraudReasons: fraudData.reasons || [],
        riskLevel: fraudData.riskLevel,
        preventedAction: fraudData.preventedAction,
        detectionRules: fraudData.triggeredRules || [],
        userBehavior: {
          recentPayments: fraudData.recentPayments || 0,
          averageAmount: fraudData.averageAmount || 0,
          geolocationChange: fraudData.geolocationChange || false,
          deviceChange: fraudData.deviceChange || false,
          timePattern: fraudData.timePattern || 'normal'
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'flagged'
      };

      await this.writeLog('fraud_detection_logs', logEntry);
      await this.updateSecurityMetrics('fraud_detection', fraudData.riskLevel);

      // Alert security team for high-risk transactions
      if (fraudData.riskLevel === 'high') {
        await this.sendSecurityAlert(logEntry);
      }

      console.log(`Fraud detection logged for payment: ${paymentId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log fraud detection:', error);
    }
  }

  /**
   * Log admin payment actions
   * @param {string} adminId - Admin user ID
   * @param {string} action - Admin action performed
   * @param {Object} actionData - Action details
   */
  async logAdminPaymentAction(adminId, action, actionData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'admin_payment_action',
        level: this.logLevels.AUDIT,
        adminId,
        action,
        actionData: {
          paymentId: actionData.paymentId,
          userId: actionData.userId,
          previousStatus: actionData.previousStatus,
          newStatus: actionData.newStatus,
          reason: actionData.reason,
          amount: actionData.amount,
          approvalOverride: actionData.approvalOverride || false
        },
        adminInfo: {
          email: actionData.adminEmail,
          permissions: actionData.adminPermissions || [],
          ipAddress: this.extractIPAddress(),
          sessionId: actionData.sessionId
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'admin_action'
      };

      await this.writeLog('admin_audit_logs', logEntry);
      await this.updateAdminMetrics(action);

      console.log(`Admin action logged: ${action} by ${adminId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log admin payment action:', error);
    }
  }

  /**
   * Generate payment analytics report
   * @param {string} period - Time period (daily, weekly, monthly)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async generatePaymentAnalytics(period, startDate, endDate) {
    try {
      const analytics = {
        reportId: uuidv4(),
        period,
        dateRange: { startDate, endDate },
        generatedAt: new Date(),
        metrics: {}
      };

      // Payment volume metrics
      const paymentMetrics = await this.getPaymentMetrics(startDate, endDate);
      analytics.metrics.payments = paymentMetrics;

      // Error metrics
      const errorMetrics = await this.getErrorMetrics(startDate, endDate);
      analytics.metrics.errors = errorMetrics;

      // Revenue metrics
      const revenueMetrics = await this.getRevenueMetrics(startDate, endDate);
      analytics.metrics.revenue = revenueMetrics;

      // Fraud metrics
      const fraudMetrics = await this.getFraudMetrics(startDate, endDate);
      analytics.metrics.fraud = fraudMetrics;

      // Performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(startDate, endDate);
      analytics.metrics.performance = performanceMetrics;

      await this.writeLog('payment_analytics', analytics);

      console.log(`Payment analytics generated for period: ${period}`);
      return analytics;

    } catch (error) {
      console.error('Failed to generate payment analytics:', error);
      throw error;
    }
  }

  /**
   * Write log entry to Firestore
   * @param {string} collection - Collection name
   * @param {Object} logEntry - Log entry data
   */
  async writeLog(collection, logEntry) {
    try {
      await this.db.collection(collection).doc(logEntry.logId).set(logEntry);
      
      // Also write to daily partition for better query performance
      const dateStr = new Date().toISOString().split('T')[0];
      const partitionedCollection = `${collection}_${dateStr.replace(/-/g, '_')}`;
      await this.db.collection(partitionedCollection).doc(logEntry.logId).set(logEntry);

    } catch (error) {
      console.error(`Failed to write log to ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Update payment status in tracking document
   * @param {string} paymentId - Payment ID
   * @param {string} status - New status
   */
  async updatePaymentStatus(paymentId, status) {
    try {
      const statusRef = this.db.collection('payment_status_tracking').doc(paymentId);
      await statusRef.set({
        paymentId,
        status,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status,
          timestamp: new Date()
        })
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update payment status:', error);
    }
  }

  /**
   * Update payment metrics
   * @param {string} metricType - Type of metric
   * @param {number} amount - Payment amount
   */
  async updatePaymentMetrics(metricType, amount) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const metricsRef = this.db.collection('payment_metrics').doc(today);
      
      const updateData = {
        [`${metricType}_count`]: admin.firestore.FieldValue.increment(1),
        [`${metricType}_amount`]: admin.firestore.FieldValue.increment(amount),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await metricsRef.set(updateData, { merge: true });

    } catch (error) {
      console.error('Failed to update payment metrics:', error);
    }
  }

  /**
   * Update revenue tracking
   * @param {Object} completionData - Payment completion data
   */
  async updateRevenueTracking(completionData) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const revenueRef = this.db.collection('revenue_tracking').doc(today);
      
      const platformFee = 0.1; // From lottery configuration
      const revenue = platformFee;
      
      await revenueRef.set({
        date: today,
        totalRevenue: admin.firestore.FieldValue.increment(revenue),
        transactionCount: admin.firestore.FieldValue.increment(1),
        totalVolume: admin.firestore.FieldValue.increment(completionData.amount || 0),
        averageTransaction: admin.firestore.FieldValue.increment((completionData.amount || 0) / 1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update revenue tracking:', error);
    }
  }

  /**
   * Update error metrics
   * @param {string} errorType - Type of error
   */
  async updateErrorMetrics(errorType) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const errorRef = this.db.collection('error_metrics').doc(today);
      
      await errorRef.set({
        [`${errorType}_count`]: admin.firestore.FieldValue.increment(1),
        totalErrors: admin.firestore.FieldValue.increment(1),
        lastError: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update error metrics:', error);
    }
  }

  /**
   * Update security metrics
   * @param {string} eventType - Security event type
   * @param {string} riskLevel - Risk level
   */
  async updateSecurityMetrics(eventType, riskLevel) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const securityRef = this.db.collection('security_metrics').doc(today);
      
      await securityRef.set({
        [`${eventType}_count`]: admin.firestore.FieldValue.increment(1),
        [`${riskLevel}_risk_count`]: admin.firestore.FieldValue.increment(1),
        totalSecurityEvents: admin.firestore.FieldValue.increment(1),
        lastEvent: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update security metrics:', error);
    }
  }

  /**
   * Update admin action metrics
   * @param {string} action - Admin action
   */
  async updateAdminMetrics(action) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const adminRef = this.db.collection('admin_metrics').doc(today);
      
      await adminRef.set({
        [`${action}_count`]: admin.firestore.FieldValue.increment(1),
        totalAdminActions: admin.firestore.FieldValue.increment(1),
        lastAction: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update admin metrics:', error);
    }
  }

  /**
   * Check if error is critical
   * @param {string} errorType - Error type
   * @returns {boolean} - Is critical error
   */
  isCriticalError(errorType) {
    const criticalErrors = [
      'payment_validation_failure',
      'blockchain_verification_failure',
      'database_corruption',
      'security_breach',
      'fraud_attempt'
    ];
    return criticalErrors.includes(errorType);
  }

  /**
   * Send error alert to administrators
   * @param {Object} logEntry - Error log entry
   */
  async sendErrorAlert(logEntry) {
    try {
      await this.db.collection('admin_alerts').add({
        type: 'critical_payment_error',
        severity: 'high',
        logId: logEntry.logId,
        errorType: logEntry.errorType,
        message: logEntry.errorMessage,
        context: logEntry.context,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        acknowledged: false
      });

      console.log(`Critical error alert sent for: ${logEntry.errorType}`);

    } catch (error) {
      console.error('Failed to send error alert:', error);
    }
  }

  /**
   * Send security alert
   * @param {Object} logEntry - Security log entry
   */
  async sendSecurityAlert(logEntry) {
    try {
      await this.db.collection('security_alerts').add({
        type: 'high_risk_payment',
        severity: 'high',
        logId: logEntry.logId,
        userId: logEntry.userId,
        paymentId: logEntry.paymentId,
        fraudScore: logEntry.fraudScore,
        riskLevel: logEntry.riskLevel,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        investigated: false
      });

      console.log(`Security alert sent for payment: ${logEntry.paymentId}`);

    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  /**
   * Utility functions for extracting request information
   */
  extractIPAddress() {
    // In Cloud Functions, this would extract from request headers
    return process.env.FUNCTION_SOURCE || 'unknown';
  }

  extractUserAgent() {
    // In Cloud Functions, this would extract from request headers
    return 'Pi-Lottery-Platform/1.0';
  }

  generateSessionId() {
    return uuidv4().substring(0, 8);
  }

  /**
   * Get payment metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getPaymentMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('payment_metrics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalCount = 0;
      let totalAmount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalCount += data.initiation_count || 0;
        totalAmount += data.initiation_amount || 0;
        approvedCount += data.approval_count || 0;
        rejectedCount += data.rejection_count || 0;
      });

      return {
        totalTransactions: totalCount,
        totalAmount,
        approvedTransactions: approvedCount,
        rejectedTransactions: rejectedCount,
        approvalRate: totalCount > 0 ? (approvedCount / totalCount) * 100 : 0
      };

    } catch (error) {
      console.error('Failed to get payment metrics:', error);
      return {};
    }
  }

  /**
   * Get error metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getErrorMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('error_metrics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalErrors = 0;
      const errorBreakdown = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        totalErrors += data.totalErrors || 0;
        
        Object.keys(data).forEach(key => {
          if (key.endsWith('_count') && key !== 'totalErrors') {
            const errorType = key.replace('_count', '');
            errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + (data[key] || 0);
          }
        });
      });

      return {
        totalErrors,
        errorBreakdown,
        errorRate: totalErrors > 0 ? (totalErrors / (totalErrors + 100)) * 100 : 0 // Placeholder calculation
      };

    } catch (error) {
      console.error('Failed to get error metrics:', error);
      return {};
    }
  }

  /**
   * Get revenue metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getRevenueMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('revenue_tracking')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalRevenue = 0;
      let totalVolume = 0;
      let transactionCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalRevenue += data.totalRevenue || 0;
        totalVolume += data.totalVolume || 0;
        transactionCount += data.transactionCount || 0;
      });

      return {
        totalRevenue,
        totalVolume,
        transactionCount,
        averageRevenue: transactionCount > 0 ? totalRevenue / transactionCount : 0,
        revenueMargin: totalVolume > 0 ? (totalRevenue / totalVolume) * 100 : 0
      };

    } catch (error) {
      console.error('Failed to get revenue metrics:', error);
      return {};
    }
  }

  /**
   * Get fraud metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getFraudMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('security_metrics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalFraudEvents = 0;
      let highRiskCount = 0;
      let mediumRiskCount = 0;
      let lowRiskCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalFraudEvents += data.fraud_detection_count || 0;
        highRiskCount += data.high_risk_count || 0;
        mediumRiskCount += data.medium_risk_count || 0;
        lowRiskCount += data.low_risk_count || 0;
      });

      return {
        totalFraudEvents,
        riskDistribution: {
          high: highRiskCount,
          medium: mediumRiskCount,
          low: lowRiskCount
        },
        fraudRate: totalFraudEvents > 0 ? (totalFraudEvents / (totalFraudEvents + 1000)) * 100 : 0 // Placeholder calculation
      };

    } catch (error) {
      console.error('Failed to get fraud metrics:', error);
      return {};
    }
  }

  /**
   * Get performance metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getPerformanceMetrics(startDate, endDate) {
    try {
      // This would aggregate performance data from payment logs
      const snapshot = await this.db.collection('payment_logs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .where('logType', '==', 'payment_completion')
        .limit(1000) // Limit for performance
        .get();

      let totalProcessingTime = 0;
      let count = 0;
      let minTime = Number.MAX_VALUE;
      let maxTime = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.processingMetrics && data.processingMetrics.totalProcessingTime) {
          const time = data.processingMetrics.totalProcessingTime;
          totalProcessingTime += time;
          count++;
          minTime = Math.min(minTime, time);
          maxTime = Math.max(maxTime, time);
        }
      });

      return {
        averageProcessingTime: count > 0 ? totalProcessingTime / count : 0,
        minProcessingTime: minTime === Number.MAX_VALUE ? 0 : minTime,
        maxProcessingTime: maxTime,
        processedTransactions: count
      };

    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {};
    }
  }
}

// Export singleton instance
const paymentLogger = new PaymentLogger();

module.exports = {
  paymentLogger,
  PaymentLogger
};const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

class PaymentLogger {
  constructor() {
    this.db = admin.firestore();
    this.logLevels = {
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      DEBUG: 'debug',
      AUDIT: 'audit'
    };
  }

  /**
   * Log payment initiation
   * @param {Object} paymentData - Payment initialization data
   * @param {string} userId - User ID initiating payment
   * @param {string} lotteryTypeId - Type of lottery
   */
  async logPaymentInitiation(paymentData, userId, lotteryTypeId) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_initiation',
        level: this.logLevels.INFO,
        userId,
        lotteryTypeId,
        paymentId: paymentData.identifier,
        amount: paymentData.amount,
        memo: paymentData.memo,
        metadata: paymentData.metadata || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: this.extractIPAddress(),
        userAgent: this.extractUserAgent(),
        sessionId: this.generateSessionId(),
        status: 'initiated'
      };

      await this.writeLog('payment_logs', logEntry);
      await this.updatePaymentMetrics('initiation', paymentData.amount);

      console.log(`Payment initiated: ${paymentData.identifier} for user: ${userId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log payment initiation:', error);
      await this.logError('payment_initiation_log_error', error, { userId, paymentId: paymentData.identifier });
    }
  }

  /**
   * Log payment approval process
   * @param {string} paymentId - Pi Network payment ID
   * @param {string} userId - User ID
   * @param {Object} approvalData - Approval process data
   */
  async logPaymentApproval(paymentId, userId, approvalData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_approval',
        level: this.logLevels.AUDIT,
        userId,
        paymentId,
        approvalData: {
          approved: approvalData.approved,
          approvedBy: approvalData.approvedBy || 'system',
          approvalReason: approvalData.reason || 'automatic_approval',
          validationChecks: approvalData.validationChecks || {},
          piNetworkResponse: approvalData.piNetworkResponse || {}
        },
        processingTime: approvalData.processingTime,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: approvalData.approved ? 'approved' : 'rejected'
      };

      await this.writeLog('payment_logs', logEntry);
      await this.updatePaymentStatus(paymentId, 'approval_logged');

      if (approvalData.approved) {
        await this.updatePaymentMetrics('approval', approvalData.amount || 0);
      } else {
        await this.updatePaymentMetrics('rejection', 0);
      }

      console.log(`Payment ${approvalData.approved ? 'approved' : 'rejected'}: ${paymentId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log payment approval:', error);
      await this.logError('payment_approval_log_error', error, { userId, paymentId });
    }
  }

  /**
   * Log payment completion
   * @param {string} paymentId - Pi Network payment ID
   * @param {string} txid - Blockchain transaction ID
   * @param {string} userId - User ID
   * @param {Object} completionData - Completion data
   */
  async logPaymentCompletion(paymentId, txid, userId, completionData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_completion',
        level: this.logLevels.AUDIT,
        userId,
        paymentId,
        blockchainTxId: txid,
        completionData: {
          amount: completionData.amount,
          fee: completionData.fee || 0.01,
          netAmount: (completionData.amount || 0) - (completionData.fee || 0.01),
          blockchainConfirmations: completionData.confirmations || 0,
          lotteryEntryProcessed: completionData.lotteryEntryProcessed || false,
          prizeEligible: completionData.prizeEligible || false
        },
        blockchainData: {
          network: 'pi-network',
          blockHeight: completionData.blockHeight,
          timestamp: completionData.blockchainTimestamp,
          gasUsed: completionData.gasUsed
        },
        processingMetrics: {
          totalProcessingTime: completionData.totalProcessingTime,
          validationTime: completionData.validationTime,
          dbUpdateTime: completionData.dbUpdateTime
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'completed'
      };

      await this.writeLog('payment_logs', logEntry);
      await this.updatePaymentStatus(paymentId, 'completed');
      await this.updatePaymentMetrics('completion', completionData.amount || 0);

      // Log to revenue tracking
      await this.updateRevenueTracking(completionData);

      console.log(`Payment completed: ${paymentId} with txid: ${txid}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log payment completion:', error);
      await this.logError('payment_completion_log_error', error, { userId, paymentId, txid });
    }
  }

  /**
   * Log payment errors
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  async logPaymentError(errorType, error, context) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_error',
        level: this.logLevels.ERROR,
        errorType,
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code || 'UNKNOWN_ERROR',
        context: {
          userId: context.userId,
          paymentId: context.paymentId,
          lotteryTypeId: context.lotteryTypeId,
          amount: context.amount,
          step: context.step || 'unknown',
          additionalInfo: context.additionalInfo || {}
        },
        systemInfo: {
          nodeVersion: process.version,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          functionName: context.functionName || 'unknown',
          region: process.env.FUNCTION_REGION || 'unknown'
        },
        recoveryAttempts: context.recoveryAttempts || 0,
        status: 'error'
      };

      await this.writeLog('payment_error_logs', logEntry);
      await this.updateErrorMetrics(errorType);

      // Send alert for critical errors
      if (this.isCriticalError(errorType)) {
        await this.sendErrorAlert(logEntry);
      }

      console.error(`Payment error logged: ${errorType} - ${error.message}`);
      return logEntry.logId;

    } catch (logError) {
      console.error('Failed to log payment error:', logError);
      // Fallback logging to console if database fails
      console.error('Original error:', error);
      console.error('Context:', context);
    }
  }

  /**
   * Log payment fraud detection
   * @param {string} paymentId - Payment ID
   * @param {string} userId - User ID
   * @param {Object} fraudData - Fraud detection data
   */
  async logFraudDetection(paymentId, userId, fraudData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'payment_fraud_detection',
        level: this.logLevels.WARN,
        userId,
        paymentId,
        fraudScore: fraudData.fraudScore,
        fraudReasons: fraudData.reasons || [],
        riskLevel: fraudData.riskLevel,
        preventedAction: fraudData.preventedAction,
        detectionRules: fraudData.triggeredRules || [],
        userBehavior: {
          recentPayments: fraudData.recentPayments || 0,
          averageAmount: fraudData.averageAmount || 0,
          geolocationChange: fraudData.geolocationChange || false,
          deviceChange: fraudData.deviceChange || false,
          timePattern: fraudData.timePattern || 'normal'
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'flagged'
      };

      await this.writeLog('fraud_detection_logs', logEntry);
      await this.updateSecurityMetrics('fraud_detection', fraudData.riskLevel);

      // Alert security team for high-risk transactions
      if (fraudData.riskLevel === 'high') {
        await this.sendSecurityAlert(logEntry);
      }

      console.log(`Fraud detection logged for payment: ${paymentId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log fraud detection:', error);
    }
  }

  /**
   * Log admin payment actions
   * @param {string} adminId - Admin user ID
   * @param {string} action - Admin action performed
   * @param {Object} actionData - Action details
   */
  async logAdminPaymentAction(adminId, action, actionData) {
    try {
      const logEntry = {
        logId: uuidv4(),
        logType: 'admin_payment_action',
        level: this.logLevels.AUDIT,
        adminId,
        action,
        actionData: {
          paymentId: actionData.paymentId,
          userId: actionData.userId,
          previousStatus: actionData.previousStatus,
          newStatus: actionData.newStatus,
          reason: actionData.reason,
          amount: actionData.amount,
          approvalOverride: actionData.approvalOverride || false
        },
        adminInfo: {
          email: actionData.adminEmail,
          permissions: actionData.adminPermissions || [],
          ipAddress: this.extractIPAddress(),
          sessionId: actionData.sessionId
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'admin_action'
      };

      await this.writeLog('admin_audit_logs', logEntry);
      await this.updateAdminMetrics(action);

      console.log(`Admin action logged: ${action} by ${adminId}`);
      return logEntry.logId;

    } catch (error) {
      console.error('Failed to log admin payment action:', error);
    }
  }

  /**
   * Generate payment analytics report
   * @param {string} period - Time period (daily, weekly, monthly)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async generatePaymentAnalytics(period, startDate, endDate) {
    try {
      const analytics = {
        reportId: uuidv4(),
        period,
        dateRange: { startDate, endDate },
        generatedAt: new Date(),
        metrics: {}
      };

      // Payment volume metrics
      const paymentMetrics = await this.getPaymentMetrics(startDate, endDate);
      analytics.metrics.payments = paymentMetrics;

      // Error metrics
      const errorMetrics = await this.getErrorMetrics(startDate, endDate);
      analytics.metrics.errors = errorMetrics;

      // Revenue metrics
      const revenueMetrics = await this.getRevenueMetrics(startDate, endDate);
      analytics.metrics.revenue = revenueMetrics;

      // Fraud metrics
      const fraudMetrics = await this.getFraudMetrics(startDate, endDate);
      analytics.metrics.fraud = fraudMetrics;

      // Performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(startDate, endDate);
      analytics.metrics.performance = performanceMetrics;

      await this.writeLog('payment_analytics', analytics);

      console.log(`Payment analytics generated for period: ${period}`);
      return analytics;

    } catch (error) {
      console.error('Failed to generate payment analytics:', error);
      throw error;
    }
  }

  /**
   * Write log entry to Firestore
   * @param {string} collection - Collection name
   * @param {Object} logEntry - Log entry data
   */
  async writeLog(collection, logEntry) {
    try {
      await this.db.collection(collection).doc(logEntry.logId).set(logEntry);
      
      // Also write to daily partition for better query performance
      const dateStr = new Date().toISOString().split('T')[0];
      const partitionedCollection = `${collection}_${dateStr.replace(/-/g, '_')}`;
      await this.db.collection(partitionedCollection).doc(logEntry.logId).set(logEntry);

    } catch (error) {
      console.error(`Failed to write log to ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Update payment status in tracking document
   * @param {string} paymentId - Payment ID
   * @param {string} status - New status
   */
  async updatePaymentStatus(paymentId, status) {
    try {
      const statusRef = this.db.collection('payment_status_tracking').doc(paymentId);
      await statusRef.set({
        paymentId,
        status,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status,
          timestamp: new Date()
        })
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update payment status:', error);
    }
  }

  /**
   * Update payment metrics
   * @param {string} metricType - Type of metric
   * @param {number} amount - Payment amount
   */
  async updatePaymentMetrics(metricType, amount) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const metricsRef = this.db.collection('payment_metrics').doc(today);
      
      const updateData = {
        [`${metricType}_count`]: admin.firestore.FieldValue.increment(1),
        [`${metricType}_amount`]: admin.firestore.FieldValue.increment(amount),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await metricsRef.set(updateData, { merge: true });

    } catch (error) {
      console.error('Failed to update payment metrics:', error);
    }
  }

  /**
   * Update revenue tracking
   * @param {Object} completionData - Payment completion data
   */
  async updateRevenueTracking(completionData) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const revenueRef = this.db.collection('revenue_tracking').doc(today);
      
      const platformFee = 0.1; // From lottery configuration
      const revenue = platformFee;
      
      await revenueRef.set({
        date: today,
        totalRevenue: admin.firestore.FieldValue.increment(revenue),
        transactionCount: admin.firestore.FieldValue.increment(1),
        totalVolume: admin.firestore.FieldValue.increment(completionData.amount || 0),
        averageTransaction: admin.firestore.FieldValue.increment((completionData.amount || 0) / 1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update revenue tracking:', error);
    }
  }

  /**
   * Update error metrics
   * @param {string} errorType - Type of error
   */
  async updateErrorMetrics(errorType) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const errorRef = this.db.collection('error_metrics').doc(today);
      
      await errorRef.set({
        [`${errorType}_count`]: admin.firestore.FieldValue.increment(1),
        totalErrors: admin.firestore.FieldValue.increment(1),
        lastError: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update error metrics:', error);
    }
  }

  /**
   * Update security metrics
   * @param {string} eventType - Security event type
   * @param {string} riskLevel - Risk level
   */
  async updateSecurityMetrics(eventType, riskLevel) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const securityRef = this.db.collection('security_metrics').doc(today);
      
      await securityRef.set({
        [`${eventType}_count`]: admin.firestore.FieldValue.increment(1),
        [`${riskLevel}_risk_count`]: admin.firestore.FieldValue.increment(1),
        totalSecurityEvents: admin.firestore.FieldValue.increment(1),
        lastEvent: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update security metrics:', error);
    }
  }

  /**
   * Update admin action metrics
   * @param {string} action - Admin action
   */
  async updateAdminMetrics(action) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const adminRef = this.db.collection('admin_metrics').doc(today);
      
      await adminRef.set({
        [`${action}_count`]: admin.firestore.FieldValue.increment(1),
        totalAdminActions: admin.firestore.FieldValue.increment(1),
        lastAction: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Failed to update admin metrics:', error);
    }
  }

  /**
   * Check if error is critical
   * @param {string} errorType - Error type
   * @returns {boolean} - Is critical error
   */
  isCriticalError(errorType) {
    const criticalErrors = [
      'payment_validation_failure',
      'blockchain_verification_failure',
      'database_corruption',
      'security_breach',
      'fraud_attempt'
    ];
    return criticalErrors.includes(errorType);
  }

  /**
   * Send error alert to administrators
   * @param {Object} logEntry - Error log entry
   */
  async sendErrorAlert(logEntry) {
    try {
      await this.db.collection('admin_alerts').add({
        type: 'critical_payment_error',
        severity: 'high',
        logId: logEntry.logId,
        errorType: logEntry.errorType,
        message: logEntry.errorMessage,
        context: logEntry.context,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        acknowledged: false
      });

      console.log(`Critical error alert sent for: ${logEntry.errorType}`);

    } catch (error) {
      console.error('Failed to send error alert:', error);
    }
  }

  /**
   * Send security alert
   * @param {Object} logEntry - Security log entry
   */
  async sendSecurityAlert(logEntry) {
    try {
      await this.db.collection('security_alerts').add({
        type: 'high_risk_payment',
        severity: 'high',
        logId: logEntry.logId,
        userId: logEntry.userId,
        paymentId: logEntry.paymentId,
        fraudScore: logEntry.fraudScore,
        riskLevel: logEntry.riskLevel,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        investigated: false
      });

      console.log(`Security alert sent for payment: ${logEntry.paymentId}`);

    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  /**
   * Utility functions for extracting request information
   */
  extractIPAddress() {
    // In Cloud Functions, this would extract from request headers
    return process.env.FUNCTION_SOURCE || 'unknown';
  }

  extractUserAgent() {
    // In Cloud Functions, this would extract from request headers
    return 'Pi-Lottery-Platform/1.0';
  }

  generateSessionId() {
    return uuidv4().substring(0, 8);
  }

  /**
   * Get payment metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getPaymentMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('payment_metrics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalCount = 0;
      let totalAmount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalCount += data.initiation_count || 0;
        totalAmount += data.initiation_amount || 0;
        approvedCount += data.approval_count || 0;
        rejectedCount += data.rejection_count || 0;
      });

      return {
        totalTransactions: totalCount,
        totalAmount,
        approvedTransactions: approvedCount,
        rejectedTransactions: rejectedCount,
        approvalRate: totalCount > 0 ? (approvedCount / totalCount) * 100 : 0
      };

    } catch (error) {
      console.error('Failed to get payment metrics:', error);
      return {};
    }
  }

  /**
   * Get error metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getErrorMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('error_metrics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalErrors = 0;
      const errorBreakdown = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        totalErrors += data.totalErrors || 0;
        
        Object.keys(data).forEach(key => {
          if (key.endsWith('_count') && key !== 'totalErrors') {
            const errorType = key.replace('_count', '');
            errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + (data[key] || 0);
          }
        });
      });

      return {
        totalErrors,
        errorBreakdown,
        errorRate: totalErrors > 0 ? (totalErrors / (totalErrors + 100)) * 100 : 0 // Placeholder calculation
      };

    } catch (error) {
      console.error('Failed to get error metrics:', error);
      return {};
    }
  }

  /**
   * Get revenue metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getRevenueMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('revenue_tracking')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalRevenue = 0;
      let totalVolume = 0;
      let transactionCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalRevenue += data.totalRevenue || 0;
        totalVolume += data.totalVolume || 0;
        transactionCount += data.transactionCount || 0;
      });

      return {
        totalRevenue,
        totalVolume,
        transactionCount,
        averageRevenue: transactionCount > 0 ? totalRevenue / transactionCount : 0,
        revenueMargin: totalVolume > 0 ? (totalRevenue / totalVolume) * 100 : 0
      };

    } catch (error) {
      console.error('Failed to get revenue metrics:', error);
      return {};
    }
  }

  /**
   * Get fraud metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getFraudMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db.collection('security_metrics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      let totalFraudEvents = 0;
      let highRiskCount = 0;
      let mediumRiskCount = 0;
      let lowRiskCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalFraudEvents += data.fraud_detection_count || 0;
        highRiskCount += data.high_risk_count || 0;
        mediumRiskCount += data.medium_risk_count || 0;
        lowRiskCount += data.low_risk_count || 0;
      });

      return {
        totalFraudEvents,
        riskDistribution: {
          high: highRiskCount,
          medium: mediumRiskCount,
          low: lowRiskCount
        },
        fraudRate: totalFraudEvents > 0 ? (totalFraudEvents / (totalFraudEvents + 1000)) * 100 : 0 // Placeholder calculation
      };

    } catch (error) {
      console.error('Failed to get fraud metrics:', error);
      return {};
    }
  }

  /**
   * Get performance metrics for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getPerformanceMetrics(startDate, endDate) {
    try {
      // This would aggregate performance data from payment logs
      const snapshot = await this.db.collection('payment_logs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .where('logType', '==', 'payment_completion')
        .limit(1000) // Limit for performance
        .get();

      let totalProcessingTime = 0;
      let count = 0;
      let minTime = Number.MAX_VALUE;
      let maxTime = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.processingMetrics && data.processingMetrics.totalProcessingTime) {
          const time = data.processingMetrics.totalProcessingTime;
          totalProcessingTime += time;
          count++;
          minTime = Math.min(minTime, time);
          maxTime = Math.max(maxTime, time);
        }
      });

      return {
        averageProcessingTime: count > 0 ? totalProcessingTime / count : 0,
        minProcessingTime: minTime === Number.MAX_VALUE ? 0 : minTime,
        maxProcessingTime: maxTime,
        processedTransactions: count
      };

    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {};
    }
  }
}

// Export singleton instance
const paymentLogger = new PaymentLogger();

module.exports = {
  paymentLogger,
  PaymentLogger
};
