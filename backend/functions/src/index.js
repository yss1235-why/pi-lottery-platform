// backend/functions/src/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const express = require('express');

// Initialize Firebase Admin
admin.initializeApp();

// Import utilities
const { logger, logApiRequest, logSecurityEvent, logUserAction, logAdminAction } = require('./utils/logger.js');
const { security, checkRateLimit, validateWebhookSignature } = require('./utils/security.js');
const { dbManager, lotteryQueries } = require('./utils/database.js');
const { 
  ERROR_CODES, 
  HTTP_STATUS, 
  FEATURE_FLAGS, 
  COLLECTIONS,
  LOTTERY,
  PAYMENT,
  ADMIN_PERMISSIONS 
} = require('./utils/constants.js');
const { 
  CustomError, 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  lotteryValidator,
  paymentValidator,
  adminValidator
} = require('./utils/validators.js');

// Import middleware
const { authenticateUser, authenticateAdmin, requirePermission } = require('./middleware/auth.js');
const { rateLimiter } = require('./middleware/rateLimiter.js');
const { errorHandler } = require('./middleware/errorHandler.js');

// Import service handlers
const { 
  handlePaymentApproval, 
  handlePaymentCompletion, 
  processPaymentWebhook,
  validatePiPayment 
} = require('./payments/piPaymentHandler.js');
const { 
  conductLotteryDrawing, 
  scheduleLotteryDrawings, 
  processLotteryEntry,
  extendLotteryDrawing 
} = require('./lottery/drawingEngine.js');
const { 
  validateAdCompletion, 
  processAdReward,
  initializeAdNetworks 
} = require('./advertising/adHandler.js');
const { 
  generateSystemReports, 
  performSystemMaintenance, 
  updateSystemConfig,
  getSystemStatus,
  backupSystemData 
} = require('./admin/systemManagement.js');
const { 
  manageUsers, 
  getUserStats, 
  updateUserProfile,
  suspendUser,
  getUserActivity 
} = require('./admin/userManagement.js');

// =============================================
// HEALTH CHECK AND SYSTEM STATUS
// =============================================

exports.healthCheck = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const startTime = Date.now();
    
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'pi-lottery-platform',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {
          database: 'unknown',
          authentication: 'unknown',
          external_apis: 'unknown',
          rate_limiter: 'unknown'
        }
      };

      // Check database connectivity
      try {
        await admin.firestore().collection(COLLECTIONS.SYSTEM_CONFIG).limit(1).get();
        health.checks.database = 'healthy';
      } catch (error) {
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
        logger.error('Database health check failed', { error: error.message });
      }

      // Check authentication service
      try {
        await admin.auth().listUsers(1);
        health.checks.authentication = 'healthy';
      } catch (error) {
        health.checks.authentication = 'unhealthy';
        health.status = 'degraded';
        logger.error('Auth health check failed', { error: error.message });
      }

      // Check rate limiter
      try {
        const rateLimitResult = await rateLimiter.checkRateLimit('health_check', 'api_general');
        health.checks.rate_limiter = rateLimitResult.allowed ? 'healthy' : 'limited';
      } catch (error) {
        health.checks.rate_limiter = 'unhealthy';
        logger.error('Rate limiter health check failed', { error: error.message });
      }

      // Response time
      health.responseTime = Date.now() - startTime;
      health.features = {
        adLottery: FEATURE_FLAGS.ENABLE_AD_LOTTERY,
        monthlyLottery: FEATURE_FLAGS.ENABLE_MONTHLY_LOTTERY,
        analytics: FEATURE_FLAGS.ENABLE_ANALYTICS,
        rateLimiting: FEATURE_FLAGS.ENABLE_RATE_LIMITING,
        autoDrawing: FEATURE_FLAGS.ENABLE_AUTO_DRAWING
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      logger.debug('Health check completed', { 
        status: health.status,
        responseTime: health.responseTime 
      });
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(500).json({
        status: 'unhealthy',
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  });
});

exports.systemStatus = functions.https.onCall(async (data, context) => {
  try {
    // Require admin authentication for detailed system status
    const adminAuth = await authenticateAdmin(context);
    if (!adminAuth.hasPermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS)) {
      throw new AuthorizationError('Analytics permission required');
    }

    const systemStatus = await getSystemStatus();
    
    logAdminAction('view_system_status', context.auth.uid, {
      timestamp: Date.now()
    });

    return systemStatus;
  } catch (error) {
    logger.error('System status request failed', { error: error.message });
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// AUTHENTICATION ENDPOINTS
// =============================================

exports.authenticateUser = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('user_authentication');
  
  try {
    logger.info('User authentication request', { uid: context.auth?.uid });
    
    if (!context.auth) {
      throw new AuthenticationError('Authentication required');
    }

    // Rate limit authentication attempts
    const rateLimitResult = await rateLimiter.checkRateLimit(context.auth.uid, 'api_auth');
    if (!rateLimitResult.allowed) {
      throw new functions.https.HttpsError('resource-exhausted', rateLimitResult.message);
    }

    // Verify Pi Network authentication data
    const { piUID, piUsername, piAccessToken } = data;
    
    if (!piUID || !piUsername) {
      throw new AuthenticationError('Invalid Pi Network authentication data');
    }

    // Validate Pi user data format
    if (typeof piUID !== 'string' || typeof piUsername !== 'string') {
      throw new ValidationError('Invalid Pi user data format');
    }

    // Create or update user profile
    const userRef = admin.firestore().collection(COLLECTIONS.USERS).doc(context.auth.uid);
    const userDoc = await userRef.get();
    
    const userData = {
      piUID,
      piUsername: piUsername.toLowerCase().trim(),
      piAccessToken: security.maskSensitiveData(piAccessToken),
      firebaseUID: context.auth.uid,
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    };

    if (userDoc.exists) {
      await userRef.update(userData);
      logger.info('User profile updated', { uid: context.auth.uid, piUID });
    } else {
      await userRef.set({
        ...userData,
        totalEntries: 0,
        totalWinnings: 0,
        lotteriesWon: 0,
        winRate: 0,
        preferences: {
          notifications: true,
          marketing: false
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info('New user profile created', { uid: context.auth.uid, piUID });
      
      // Log new user registration for analytics
      logUserAction('user_registration', context.auth.uid, {
        piUID,
        piUsername,
        registrationMethod: 'pi_network'
      });
    }

    const duration = timer();
    
    return {
      success: true,
      user: {
        uid: context.auth.uid,
        piUID,
        piUsername: userData.piUsername
      },
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('User authentication failed', { 
      uid: context.auth?.uid,
      error: error.message 
    });
    
    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      throw new functions.https.HttpsError('unauthenticated', error.message);
    }
    throw new functions.https.HttpsError('internal', 'Authentication failed');
  }
});

exports.refreshUserSession = functions.https.onCall(async (data, context) => {
  try {
    const userAuth = await authenticateUser(context);
    
    // Update last activity
    await admin.firestore()
      .collection(COLLECTIONS.USERS)
      .doc(context.auth.uid)
      .update({
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

    return {
      success: true,
      user: userAuth.user,
      sessionRefreshed: true
    };
  } catch (error) {
    logger.error('Session refresh failed', { 
      uid: context.auth?.uid,
      error: error.message 
    });
    throw new functions.https.HttpsError('unauthenticated', error.message);
  }
});

// =============================================
// LOTTERY MANAGEMENT FUNCTIONS
// =============================================

exports.enterLottery = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('lottery_entry');
  
  try {
    const userAuth = await authenticateUser(context);
    
    // Rate limit lottery entries
    const rateLimitResult = await rateLimiter.checkRateLimit(context.auth.uid, 'lottery_entry');
    if (!rateLimitResult.allowed) {
      throw new functions.https.HttpsError('resource-exhausted', rateLimitResult.message);
    }

    const { lotteryTypeId, entryMethod, ticketCount = 1, paymentData } = data;
    
    // Validate lottery entry data
    const validatedData = lotteryValidator.validateLotteryEntry({
      lotteryTypeId,
      userId: context.auth.uid,
      entryMethod,
      ticketCount,
      paymentData
    });

    logger.info('Lottery entry request', { 
      userId: context.auth.uid, 
      lotteryTypeId, 
      entryMethod,
      ticketCount 
    });

    const result = await processLotteryEntry({
      lotteryTypeId,
      userId: context.auth.uid,
      entryMethod,
      ticketCount,
      paymentData
    });

    // Log user action
    logUserAction('lottery_entry', context.auth.uid, {
      lotteryTypeId,
      entryMethod,
      ticketCount,
      entryId: result.entryId
    });

    const duration = timer();
    
    logger.info('Lottery entry successful', { 
      userId: context.auth.uid,
      entryId: result.entryId,
      lotteryTypeId,
      duration
    });

    return {
      ...result,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Lottery entry failed', { 
      userId: context.auth?.uid,
      lotteryTypeId: data?.lotteryTypeId,
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.getLotteryStatus = functions.https.onCall(async (data, context) => {
  try {
    const { lotteryTypeId } = data;
    
    if (!lotteryTypeId || !Object.values(LOTTERY.TYPES).includes(lotteryTypeId)) {
      throw new ValidationError('Invalid lottery type');
    }
    
    const activeLotteries = await lotteryQueries.getActiveLotteries();
    const targetLottery = activeLotteries.find(lottery => lottery.lotteryTypeId === lotteryTypeId);

    if (!targetLottery) {
      return { 
        active: false, 
        lotteryTypeId,
        message: 'No active lottery found for this type' 
      };
    }

    // Get additional lottery statistics
    const entries = await lotteryQueries.getLotteryEntries(targetLottery.id);
    const uniqueParticipants = new Set(entries.map(entry => entry.userId)).size;

    return {
      active: true,
      lottery: {
        id: targetLottery.id,
        lotteryTypeId: targetLottery.lotteryTypeId,
        status: targetLottery.status,
        participants: targetLottery.participants,
        uniqueParticipants,
        prizePool: targetLottery.prizePool,
        scheduledDrawTime: targetLottery.scheduledDrawTime,
        minParticipants: targetLottery.minParticipants,
        extensionCount: targetLottery.extensionCount || 0
      }
    };
  } catch (error) {
    logger.error('Failed to get lottery status', { 
      lotteryTypeId: data?.lotteryTypeId,
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    throw new functions.https.HttpsError('internal', 'Failed to get lottery status');
  }
});

exports.getUserLotteryHistory = functions.https.onCall(async (data, context) => {
  try {
    const userAuth = await authenticateUser(context);
    const { limit = 20, offset = 0 } = data;
    
    // Get user lottery entries
    const userEntries = await lotteryQueries.getUserEntries(context.auth.uid);
    
    // Get user winnings
    const userWinnings = await admin.firestore()
      .collection(COLLECTIONS.LOTTERY_WINNERS)
      .where('userId', '==', context.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const winnings = [];
    userWinnings.forEach(doc => {
      winnings.push({ id: doc.id, ...doc.data() });
    });

    return {
      entries: userEntries.slice(offset, offset + limit),
      winnings,
      totalEntries: userEntries.length,
      totalWinnings: winnings.length
    };
  } catch (error) {
    logger.error('Failed to get user lottery history', { 
      userId: context.auth?.uid,
      error: error.message 
    });
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// PAYMENT PROCESSING FUNCTIONS
// =============================================

exports.approvePayment = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('payment_approval');
  
  try {
    const userAuth = await authenticateUser(context);
    
    // Rate limit payment operations
    const rateLimitResult = await rateLimiter.checkRateLimit(context.auth.uid, 'api_payment');
    if (!rateLimitResult.allowed) {
      throw new functions.https.HttpsError('resource-exhausted', rateLimitResult.message);
    }

    const { paymentId, amount, memo, metadata } = data;
    
    // Validate payment data
    paymentValidator.validatePayment({ amount, memo, metadata });
    
    logger.info('Payment approval request', { 
      userId: context.auth.uid, 
      paymentId,
      amount 
    });

    const result = await handlePaymentApproval(paymentId, context.auth.uid, {
      amount, 
      memo, 
      metadata
    });
    
    const duration = timer();
    
    logger.info('Payment approved successfully', { 
      userId: context.auth.uid,
      paymentId,
      transactionId: result.transactionId,
      duration
    });

    return {
      ...result,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Payment approval failed', { 
      userId: context.auth?.uid,
      paymentId: data?.paymentId,
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.completePayment = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('payment_completion');
  
  try {
    const userAuth = await authenticateUser(context);
    const { paymentId, txid } = data;
    
    if (!paymentId || !txid) {
      throw new ValidationError('Payment ID and transaction ID are required');
    }
    
    logger.info('Payment completion request', { 
      userId: context.auth.uid, 
      paymentId,
      txid 
    });

    const result = await handlePaymentCompletion(paymentId, txid, context.auth.uid);
    
    const duration = timer();
    
    logger.info('Payment completed successfully', { 
      userId: context.auth.uid,
      paymentId,
      txid,
      duration
    });

    return {
      ...result,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Payment completion failed', { 
      userId: context.auth?.uid,
      paymentId: data?.paymentId,
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Webhook endpoint for Pi Network payment notifications
exports.piPaymentWebhook = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const timer = logger.startTimer('pi_webhook');
    
    try {
      logger.info('Pi payment webhook received', { 
        method: req.method,
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent']
      });

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Verify webhook signature
      const signature = req.headers['x-pi-signature'];
      const webhookSecret = process.env.PI_WEBHOOK_SECRET;
      
      if (!signature || !webhookSecret) {
        logSecurityEvent('missing_webhook_signature', { 
          hasSignature: !!signature,
          hasSecret: !!webhookSecret,
          ip: req.ip 
        }, 'high');
        return res.status(401).json({ error: 'Missing signature or secret' });
      }

      if (!validateWebhookSignature(JSON.stringify(req.body), signature, webhookSecret)) {
        logSecurityEvent('invalid_webhook_signature', { 
          signature: security.maskSensitiveData(signature),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, 'high');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const result = await processPaymentWebhook(req.body);
      
      const duration = timer();
      
      logger.info('Pi payment webhook processed successfully', { 
        result,
        duration
      });
      
      res.status(200).json({ 
        success: true, 
        processed: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      timer();
      logger.error('Pi payment webhook failed', { 
        error: error.message,
        body: req.body 
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// =============================================
// ADVERTISEMENT FUNCTIONS
// =============================================

exports.completeAdWatch = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('ad_completion');
  
  try {
    const userAuth = await authenticateUser(context);

    if (!FEATURE_FLAGS.ENABLE_AD_LOTTERY) {
      throw new functions.https.HttpsError('failed-precondition', 'Ad lottery is currently disabled');
    }

    // Rate limit ad completions
    const rateLimitResult = await rateLimiter.checkRateLimit(context.auth.uid, 'ad_watch');
    if (!rateLimitResult.allowed) {
      throw new functions.https.HttpsError('resource-exhausted', rateLimitResult.message);
    }

    const { adCompletionData, lotteryTypeId } = data;
    
    if (!adCompletionData || !lotteryTypeId) {
      throw new ValidationError('Ad completion data and lottery type are required');
    }
    
    logger.info('Ad completion request', { 
      userId: context.auth.uid, 
      lotteryTypeId,
      adNetwork: adCompletionData.networkId
    });

    const validationResult = await validateAdCompletion(adCompletionData, context.auth.uid);
    
    if (!validationResult.isValid) {
      throw new functions.https.HttpsError('invalid-argument', 'Ad completion validation failed');
    }

    const rewardResult = await processAdReward(context.auth.uid, lotteryTypeId, adCompletionData);
    
    // Log user action
    logUserAction('ad_completion', context.auth.uid, {
      lotteryTypeId,
      adNetwork: adCompletionData.networkId,
      watchDuration: adCompletionData.watchDuration,
      entryId: rewardResult.entryId
    });

    const duration = timer();
    
    logger.info('Ad reward processed successfully', { 
      userId: context.auth.uid,
      lotteryTypeId,
      entryId: rewardResult.entryId,
      duration
    });

    return {
      success: true,
      reward: rewardResult,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Ad completion failed', { 
      userId: context.auth?.uid,
      lotteryTypeId: data?.lotteryTypeId,
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.getAdNetworkStatus = functions.https.onCall(async (data, context) => {
  try {
    const userAuth = await authenticateUser(context);
    
    const adNetworks = await initializeAdNetworks();
    const userAdLimits = await admin.firestore()
      .collection(COLLECTIONS.USER_TICKET_LIMITS)
      .doc(`${context.auth.uid}_${new Date().toISOString().split('T')[0]}`)
      .get();

    const adLimitsData = userAdLimits.exists ? userAdLimits.data() : {};
    const usedAdTickets = adLimitsData.daily_ads_used || 0;
    
    return {
      networks: adNetworks,
      userLimits: {
        dailyLimit: 5,
        used: usedAdTickets,
        remaining: Math.max(0, 5 - usedAdTickets)
      },
      cooldownActive: false // This would be calculated based on last ad completion
    };
  } catch (error) {
    logger.error('Failed to get ad network status', { 
      userId: context.auth?.uid,
      error: error.message 
    });
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// ADMINISTRATIVE FUNCTIONS
// =============================================

exports.conductDrawing = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('manual_drawing');
  
  try {
    const adminAuth = await requirePermission(context, ADMIN_PERMISSIONS.MANAGE_LOTTERIES);
    
    const { lotteryInstanceId, force = false } = data;
    
    if (!lotteryInstanceId) {
      throw new ValidationError('Lottery instance ID is required');
    }
    
    logger.info('Manual drawing request', { 
      adminId: context.auth.uid,
      lotteryInstanceId,
      force
    });

    const result = await conductLotteryDrawing(lotteryInstanceId, { manual: true, force });
    
    // Log admin action
    logAdminAction('conduct_drawing', context.auth.uid, {
      lotteryInstanceId,
      winners: result.winners,
      totalPrizePool: result.totalPrizePool,
      force
    });

    const duration = timer();
    
    logger.info('Manual drawing completed successfully', { 
      adminId: context.auth.uid,
      lotteryInstanceId,
      winners: result.winners,
      duration
    });

    return {
      ...result,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Manual drawing failed', { 
      adminId: context.auth?.uid,
      lotteryInstanceId: data?.lotteryInstanceId,
      error: error.message 
    });
    
    if (error instanceof ValidationError || error instanceof AuthorizationError) {
      throw new functions.https.HttpsError('permission-denied', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.updateSystemConfiguration = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('system_config_update');
  
  try {
    const adminAuth = await requirePermission(context, ADMIN_PERMISSIONS.SYSTEM_CONFIG);
    
    const { configKey, configValue, reason } = data;
    
    if (!configKey || configValue === undefined) {
      throw new ValidationError('Configuration key and value are required');
    }
    
    logger.info('System configuration update request', { 
      adminId: context.auth.uid,
      configKey,
      reason: reason || 'No reason provided'
    });

    const result = await updateSystemConfig(configKey, configValue, context.auth.uid, reason);
    
    // Log admin action
    logAdminAction('update_system_config', context.auth.uid, {
      configKey,
      previousValue: result.previousValue,
      newValue: configValue,
      reason
    });

    const duration = timer();
    
    logger.info('System configuration updated successfully', { 
      adminId: context.auth.uid,
      configKey,
      duration
    });

    return {
      ...result,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('System configuration update failed', { 
      adminId: context.auth?.uid,
      configKey: data?.configKey,
      error: error.message 
    });
    
    if (error instanceof ValidationError || error instanceof AuthorizationError) {
      throw new functions.https.HttpsError('permission-denied', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.generateReport = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('report_generation');
  
  try {
    const adminAuth = await requirePermission(context, ADMIN_PERMISSIONS.VIEW_ANALYTICS);
    
    const { reportType, dateRange, filters = {} } = data;
    
    if (!reportType) {
      throw new ValidationError('Report type is required');
    }
    
    const validReportTypes = [
      'financial_summary',
      'lottery_performance',
      'user_analytics',
      'system_health',
      'security_audit'
    ];
    
    if (!validReportTypes.includes(reportType)) {
      throw new ValidationError(`Invalid report type. Must be one of: ${validReportTypes.join(', ')}`);
    }
    
    logger.info('Report generation request', { 
      adminId: context.auth.uid,
      reportType,
      dateRange
    });

    const report = await generateSystemReports(reportType, dateRange, filters);
    
    // Log admin action
    logAdminAction('generate_report', context.auth.uid, {
      reportType,
      dateRange,
      recordCount: report.data?.length || 0
    });

    const duration = timer();
    
    logger.info('Report generated successfully', { 
      adminId: context.auth.uid,
      reportType,
      duration
    });

    return {
      ...report,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Report generation failed', { 
      adminId: context.auth?.uid,
      reportType: data?.reportType,
      error: error.message 
    });
    
    if (error instanceof ValidationError || error instanceof AuthorizationError) {
      throw new functions.https.HttpsError('permission-denied', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.approveWinnerPayout = functions.https.onCall(async (data, context) => {
  const timer = logger.startTimer('winner_payout_approval');
  
  try {
    const adminAuth = await requirePermission(context, ADMIN_PERMISSIONS.APPROVE_PRIZES);
    
    const { winnerId, approved, notes } = data;
    
    if (!winnerId || typeof approved !== 'boolean') {
      throw new ValidationError('Winner ID and approval status are required');
    }
    
    logger.info('Winner payout approval request', { 
      adminId: context.auth.uid,
      winnerId,
      approved
    });

    const winnerRef = admin.firestore().collection(COLLECTIONS.LOTTERY_WINNERS).doc(winnerId);
    const winnerDoc = await winnerRef.get();
    
    if (!winnerDoc.exists) {
      throw new ValidationError('Winner not found');
    }

    const winnerData = winnerDoc.data();
    
    if (winnerData.status !== 'pending') {
      throw new ValidationError(`Winner status is ${winnerData.status}, cannot approve`);
    }

    const updateData = {
      status: approved ? 'approved' : 'rejected',
      approvedBy: context.auth.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminNotes: notes || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await winnerRef.update(updateData);
    
    // Log admin action
    logAdminAction('approve_winner_payout', context.auth.uid, {
      winnerId,
      approved,
      userId: winnerData.userId,
      prizeAmount: winnerData.prizeAmount,
      lotteryInstanceId: winnerData.lotteryInstanceId
    });

    const duration = timer();
    
    logger.info('Winner payout approval completed', { 
      adminId: context.auth.uid,
      winnerId,
      approved,
      duration
    });

    return {
      success: true,
      winnerId,
      status: updateData.status,
      responseTime: duration
    };
  } catch (error) {
    timer();
    logger.error('Winner payout approval failed', { 
      adminId: context.auth?.uid,
      winnerId: data?.winnerId,
      error: error.message 
    });
    
    if (error instanceof ValidationError || error instanceof AuthorizationError) {
      throw new functions.https.HttpsError('permission-denied', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// SCHEDULED FUNCTIONS
// =============================================

// Automated lottery drawings - runs every hour
exports.scheduledDrawings = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const timer = logger.startTimer('scheduled_drawings');
  
  try {
    if (!FEATURE_FLAGS.ENABLE_AUTO_DRAWING) {
      logger.info('Automated drawings disabled by feature flag');
      return;
    }

    logger.info('Starting scheduled lottery drawings check');
    
    const result = await scheduleLotteryDrawings();
    
    const duration = timer();
    
    logger.info('Scheduled lottery drawings completed', { 
      ...result,
      duration
    });
    
    return result;
  } catch (error) {
    timer();
    logger.error('Scheduled lottery drawings failed', { error: error.message });
    throw error;
  }
});

// System maintenance - runs daily at 2 AM UTC
exports.systemMaintenance = functions.pubsub.schedule('0 2 * * *').timeZone('UTC').onRun(async (context) => {
  const timer = logger.startTimer('system_maintenance');
  
  try {
    logger.info('Starting daily system maintenance');
    
    const result = await performSystemMaintenance();
    
    const duration = timer();
    
    logger.info('System maintenance completed successfully', { 
      ...result,
      duration
    });
    
    return result;
  } catch (error) {
    timer();
    logger.error('System maintenance failed', { error: error.message });
    throw error;
  }
});

// Data cleanup - runs weekly on Sundays at 3 AM UTC
exports.dataCleanup = functions.pubsub.schedule('0 3 * * 0').timeZone('UTC').onRun(async (context) => {
  const timer = logger.startTimer('data_cleanup');
  
  try {
    logger.info('Starting weekly data cleanup');
    
    // Clean up old error logs (keep 30 days)
    const errorLogsDeleted = await logger.clearOldLogs(30);
    
    // Clean up old performance metrics (keep 7 days)
    const metricsDeleted = await cleanupOldMetrics(7);
    
    // Clean up old rate limit records (keep 1 day)
    const rateLimitsDeleted = await cleanupOldRateLimits(1);
    
    // Clean up expired sessions (keep 7 days)
    const sessionsDeleted = await cleanupExpiredSessions(7);
    
    const duration = timer();
    
    logger.info('Data cleanup completed successfully', { 
      errorLogsDeleted,
      metricsDeleted,
      rateLimitsDeleted,
      sessionsDeleted,
      duration
    });
    
    return {
      errorLogsDeleted,
      metricsDeleted,
      rateLimitsDeleted,
      sessionsDeleted,
      duration
    };
  } catch (error) {
    timer();
    logger.error('Data cleanup failed', { error: error.message });
    throw error;
  }
});

// Backup system data - runs daily at 1 AM UTC
exports.backupData = functions.pubsub.schedule('0 1 * * *').timeZone('UTC').onRun(async (context) => {
  const timer = logger.startTimer('data_backup');
  
  try {
    logger.info('Starting daily data backup');
    
    const result = await backupSystemData();
    
    const duration = timer();
    
    logger.info('Data backup completed successfully', { 
      ...result,
      duration
    });
    
    return result;
  } catch (error) {
    timer();
    logger.error('Data backup failed', { error: error.message });
    throw error;
  }
});

// =============================================
// USER MANAGEMENT FUNCTIONS
// =============================================

exports.getUserProfile = functions.https.onCall(async (data, context) => {
  try {
    const userAuth = await authenticateUser(context);
    
    const userProfile = await admin.firestore()
      .collection(COLLECTIONS.USERS)
      .doc(context.auth.uid)
      .get();

    if (!userProfile.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found');
    }

    const userData = userProfile.data();
    
    // Remove sensitive data from response
    const sanitizedData = { ...userData };
    delete sanitizedData.piAccessToken;
    
    return { 
      profile: sanitizedData,
      retrieved: true
    };
  } catch (error) {
    logger.error('Failed to get user profile', { 
      userId: context.auth?.uid,
      error: error.message 
    });
    
    if (error instanceof AuthenticationError) {
      throw new functions.https.HttpsError('unauthenticated', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  try {
    const userAuth = await authenticateUser(context);
    const { profileUpdates } = data;
    
    if (!profileUpdates || typeof profileUpdates !== 'object') {
      throw new ValidationError('Profile updates object is required');
    }
    
    // Validate and sanitize profile updates
    const allowedFields = ['displayName', 'preferences', 'notifications'];
    const sanitizedUpdates = {};
    
    Object.entries(profileUpdates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = value;
      }
    });

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    await admin.firestore()
      .collection(COLLECTIONS.USERS)
      .doc(context.auth.uid)
      .update({
        ...sanitizedUpdates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // Log user action
    logUserAction('update_profile', context.auth.uid, {
      updatedFields: Object.keys(sanitizedUpdates)
    });

    logger.info('User profile updated successfully', { 
      userId: context.auth.uid,
      updatedFields: Object.keys(sanitizedUpdates) 
    });

    return { 
      success: true,
      updatedFields: Object.keys(sanitizedUpdates)
    };
  } catch (error) {
    logger.error('Failed to update user profile', { 
      userId: context.auth?.uid,
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    if (error instanceof AuthenticationError) {
      throw new functions.https.HttpsError('unauthenticated', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.getUserStats = functions.https.onCall(async (data, context) => {
  try {
    const userAuth = await authenticateUser(context);
    
    const stats = await getUserStats(context.auth.uid);
    
    return {
      stats,
      retrieved: true
    };
  } catch (error) {
    logger.error('Failed to get user stats', { 
      userId: context.auth?.uid,
      error: error.message 
    });
    
    if (error instanceof AuthenticationError) {
      throw new functions.https.HttpsError('unauthenticated', error.message);
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =============================================
// UTILITY FUNCTIONS
// =============================================

async function cleanupOldMetrics(daysToKeep) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const query = admin.firestore()
      .collection(COLLECTIONS.PERFORMANCE_METRICS)
      .where('createdAt', '<', cutoffDate)
      .limit(500);
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return snapshot.size;
  } catch (error) {
    logger.error('Failed to cleanup old metrics', { error: error.message });
    return 0;
  }
}

async function cleanupOldRateLimits(daysToKeep) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const query = admin.firestore()
      .collection('rate_limits')
      .where('createdAt', '<', cutoffDate)
      .limit(500);
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return snapshot.size;
  } catch (error) {
    logger.error('Failed to cleanup old rate limits', { error: error.message });
    return 0;
  }
}

async function cleanupExpiredSessions(daysToKeep) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const query = admin.firestore()
      .collection('revoked_sessions')
      .where('revokedAt', '<', cutoffDate)
      .limit(500);
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return snapshot.size;
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error: error.message });
    return 0;
  }
}

// =============================================
// ERROR HANDLING
// =============================================

// Global error handling for uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { 
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', { 
    error: error.message,
    stack: error.stack
  }, error);
  
  // Give time for logging before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Generic error handler for HTTP requests
exports.handleError = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    logger.error('Unhandled HTTP request error', { 
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: security.generateUUID()
    });
  });
});

// Export rate limiter instance for testing
exports.rateLimiter = rateLimiter;
