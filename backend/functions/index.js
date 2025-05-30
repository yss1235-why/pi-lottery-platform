const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

// Import middleware
const { authMiddleware, validateAdminAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

// Import services
const { handlePaymentApproval, handlePaymentCompletion } = require('./payments/piPaymentHandler');
const { conductLotteryDrawing, scheduleLotteryDrawings } = require('./lottery/drawingEngine');
const { validateAdCompletion, processAdReward } = require('./advertising/adHandler');
const { performSystemMaintenance } = require('./admin/systemManagement');
const configManager = require('./admin/configManager');
const reportGenerator = require('./admin/reportGenerator');
const userManagement = require('./admin/userManagement');

// Import utilities
const { logger } = require('./utils/logger');

// =============================================
// AUTHENTICATION FUNCTIONS
// =============================================

/**
 * Authenticate Pi Network user
 */
exports.authenticatePiUser = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { piUID, piUsername, piAccessToken } = data;

    if (!piUID || !piUsername) {
      throw new functions.https.HttpsError('invalid-argument', 'Pi user data is required');
    }

    // Verify Pi user data and create/update user record
    const db = admin.firestore();
    const userRef = db.collection('users').doc(context.auth.uid);
    
    const userData = {
      piUID,
      piUsername,
      piAccessToken,
      authMethod: 'pi-network-anonymous',
      firebaseUID: context.auth.uid,
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const userDoc = await userRef.get();
    if (userDoc.exists()) {
      await userRef.update(userData);
    } else {
      await userRef.set({
        ...userData,
        totalEntries: 0,
        totalWinnings: 0,
        lotteriesWon: 0,
        winRate: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    logger.info(`Pi user authenticated: ${piUsername} (${piUID})`);
    
    return { 
      success: true, 
      message: 'Pi user authenticated successfully',
      userId: context.auth.uid
    };
  } catch (error) {
    logger.error('Pi user authentication failed:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Admin authentication
 */
exports.authenticateAdmin = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    // Verify admin status
    const db = admin.firestore();
    const adminDoc = await db.collection('admin_users').doc(context.auth.uid).get();
    
    if (!adminDoc.exists() || !adminDoc.data().isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    // Track admin login
    await userManagement.trackAdminLogin(context.auth.uid);

    return { 
      success: true, 
      admin: {
        id: context.auth.uid,
        email: context.auth.token.email,
        permissions: adminDoc.data().permissions
      }
    };
  } catch (error) {
    logger.error('Admin authentication failed:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// PAYMENT PROCESSING FUNCTIONS
// =============================================

/**
 * Approve Pi Network payment
 */
exports.approvePayment = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { paymentId, paymentData } = data;
    const result = await handlePaymentApproval(paymentId, context.auth.uid, paymentData);
    
    return { success: true, result };
  } catch (error) {
    logger.error('Payment approval error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Complete Pi Network payment
 */
exports.completePayment = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { paymentId, txid } = data;
    const result = await handlePaymentCompletion(paymentId, txid, context.auth.uid);
    
    return { success: true, result };
  } catch (error) {
    logger.error('Payment completion error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// LOTTERY MANAGEMENT FUNCTIONS
// =============================================

/**
 * Conduct lottery drawing (admin only)
 */
exports.conductDrawing = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'manage_lotteries');

    const { lotteryInstanceId } = data;
    const result = await conductLotteryDrawing(lotteryInstanceId);
    
    return { success: true, result };
  } catch (error) {
    logger.error('Drawing conduct error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Get lottery configuration
 */
exports.getLotteryConfig = functions.https.onCall(async (data, context) => {
  try {
    const config = await configManager.getPlatformConfig();
    return { success: true, config };
  } catch (error) {
    logger.error('Failed to get lottery config:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Enter lottery
 */
exports.enterLottery = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { lotteryTypeId, entryMethod, ticketCount = 1, paymentData = null } = data;
    
    // Import lottery service here to avoid circular dependencies
    const lotteryService = require('./lottery/lotteryService');
    const result = await lotteryService.enterLottery(
      lotteryTypeId, 
      context.auth.uid, 
      entryMethod, 
      ticketCount, 
      paymentData
    );
    
    return { success: true, result };
  } catch (error) {
    logger.error('Lottery entry error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// SCHEDULED FUNCTIONS
// =============================================

/**
 * Scheduled lottery drawings
 */
exports.scheduledDrawings = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    await scheduleLotteryDrawings();
    logger.info('Scheduled drawings check completed');
  } catch (error) {
    logger.error('Scheduled drawings error:', error);
  }
});

/**
 * Daily system maintenance
 */
exports.dailyMaintenance = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    await performSystemMaintenance();
    logger.info('Daily maintenance completed');
  } catch (error) {
    logger.error('Daily maintenance error:', error);
  }
});

// =============================================
// ADVERTISEMENT FUNCTIONS
// =============================================

/**
 * Validate ad completion
 */
exports.validateAdCompletion = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { adCompletionData, lotteryTypeId } = data;
    const result = await validateAdCompletion(adCompletionData, context.auth.uid);
    
    if (result.isValid) {
      await processAdReward(context.auth.uid, lotteryTypeId);
    }
    
    return { success: true, result };
  } catch (error) {
    logger.error('Ad validation error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// ADMINISTRATIVE FUNCTIONS
// =============================================

/**
 * Update platform configuration
 */
exports.updatePlatformConfig = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'system_config');

    const { configType, updates, reason } = data;
    let result;

    switch (configType) {
      case 'platform_fee':
        result = await configManager.updatePlatformFee(updates.fee, context.auth.uid, reason);
        break;
      case 'ad_value':
        result = await configManager.updateAdValue(updates.value, context.auth.uid, reason);
        break;
      case 'lottery_toggles':
        result = await configManager.updateLotteryToggles(updates, context.auth.uid);
        break;
      case 'ticket_limits':
        result = await configManager.updateTicketLimits(updates, context.auth.uid);
        break;
      default:
        throw new Error(`Unknown config type: ${configType}`);
    }

    return { success: true, result };
  } catch (error) {
    logger.error('Config update error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Generate admin report
 */
exports.generateReport = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'view_analytics');

    const { reportType, dateRange } = data;
    let report;

    switch (reportType) {
      case 'dashboard':
        report = await reportGenerator.generateDashboardReport(context.auth.uid, dateRange);
        break;
      case 'revenue':
        report = await reportGenerator.generateRevenueReport(context.auth.uid, dateRange);
        break;
      case 'users':
        report = await reportGenerator.generateUserAnalytics(context.auth.uid, dateRange);
        break;
      case 'lotteries':
        report = await reportGenerator.generateLotteryPerformance(context.auth.uid, dateRange);
        break;
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    return { success: true, report };
  } catch (error) {
    logger.error('Report generation error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Manage admin users
 */
exports.manageAdminUser = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'user_management');

    const { action, targetUserId, userData } = data;
    let result;

    switch (action) {
      case 'create':
        result = await userManagement.createAdminUser(context.auth.uid, userData);
        break;
      case 'update_permissions':
        result = await userManagement.updateAdminPermissions(context.auth.uid, targetUserId, userData.permissions);
        break;
      case 'deactivate':
        result = await userManagement.deactivateAdminUser(context.auth.uid, targetUserId);
        break;
      case 'reactivate':
        result = await userManagement.reactivateAdminUser(context.auth.uid, targetUserId);
        break;
      case 'list':
        result = await userManagement.listAdminUsers(context.auth.uid);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return { success: true, result };
  } catch (error) {
    logger.error('Admin user management error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Manage regular users
 */
exports.manageUser = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'user_management');

    const { action, userId, options } = data;
    let result;

    switch (action) {
      case 'get':
        result = await userManagement.getUser(context.auth.uid, userId);
        break;
      case 'list':
        result = await userManagement.listUsers(context.auth.uid, options);
        break;
      case 'suspend':
        result = await userManagement.suspendUser(context.auth.uid, userId, options?.reason);
        break;
      case 'unsuspend':
        result = await userManagement.unsuspendUser(context.auth.uid, userId);
        break;
      case 'statistics':
        result = await userManagement.getUserStatistics(context.auth.uid);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return { success: true, result };
  } catch (error) {
    logger.error('User management error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Trigger manual system maintenance
 */
exports.triggerMaintenance = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'system_config');

    const systemManagement = require('./admin/systemManagement');
    const { tasks = [] } = data;
    
    const result = await systemManagement.triggerManualCleanup(context.auth.uid, tasks);
    
    return { success: true, result };
  } catch (error) {
    logger.error('Manual maintenance error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Get system health
 */
exports.getSystemHealth = functions.https.onCall(async (data, context) => {
  try {
    await validateAdminAuth(context.auth, 'view_analytics');

    const systemManagement = require('./admin/systemManagement');
    const health = await systemManagement.getSystemHealth();
    
    return { success: true, health };
  } catch (error) {
    logger.error('System health check error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// HTTP ENDPOINTS (for webhooks and external integrations)
// =============================================

/**
 * Pi Network payment webhook
 */
exports.piPaymentWebhook = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Verify webhook signature (implement based on Pi Network specs)
      // const signature = req.headers['x-pi-signature'];
      // if (!signature) {
      //   return res.status(401).json({ error: 'Missing signature' });
      // }

      const { paymentId, status, txid } = req.body;
      
      if (status === 'completed' && txid) {
        // Handle payment completion
        await handlePaymentCompletion(paymentId, txid, null);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Pi payment webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
});

/**
 * Health check endpoint
 */
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const db = admin.firestore();
      await db.collection('system_config').doc('platform').get();
      
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// =============================================
// ERROR HANDLING AND LOGGING
// =============================================

/**
 * Log application errors
 */
exports.logErrors = functions.https.onCall(async (data, context) => {
  try {
    const { errors } = data;
    
    for (const error of errors) {
      await admin.firestore().collection('error_logs').add({
        ...error,
        userId: context.auth?.uid || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { success: true };
  } catch (error) {
    logger.error('Error logging failed:', error);
    throw new functions.https.HttpsError('internal', 'Failed to log errors');
  }
});

/**
 * Log performance metrics
 */
exports.logPerformance = functions.https.onCall(async (data, context) => {
  try {
    const { metrics } = data;
    
    for (const metric of metrics) {
      await admin.firestore().collection('performance_logs').add({
        ...metric,
        userId: context.auth?.uid || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { success: true };
  } catch (error) {
    logger.error('Performance logging failed:', error);
    throw new functions.https.HttpsError('internal', 'Failed to log performance metrics');
  }
});

// =============================================
// GLOBAL ERROR HANDLER
// =============================================

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
