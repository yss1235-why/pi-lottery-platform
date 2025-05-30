const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * Validate admin authentication and permissions
 */
async function validateAdminAuth(authContext, requiredPermission = null) {
  if (!authContext || !authContext.uid) {
    throw new Error('Authentication required');
  }

  // Check if user is authenticated with email/password (admin auth)
  if (!authContext.token || authContext.token.firebase.sign_in_provider !== 'password') {
    throw new Error('Admin authentication required');
  }

  try {
    const db = admin.firestore();
    const adminDoc = await db.collection('admin_users').doc(authContext.uid).get();

    if (!adminDoc.exists) {
      throw new Error('Admin user not found');
    }

    const adminData = adminDoc.data();
    
    if (!adminData.isAdmin) {
      throw new Error('Admin privileges required');
    }

    if (!adminData.isActive) {
      throw new Error('Admin account is deactivated');
    }

    // Check specific permission if required
    if (requiredPermission) {
      const hasPermission = adminData.permissions && 
                           adminData.permissions.includes(requiredPermission);
      
      if (!hasPermission && !adminData.permissions.includes('super_admin')) {
        throw new Error(`Permission '${requiredPermission}' required`);
      }
    }

    return {
      isAdmin: true,
      adminData: {
        id: authContext.uid,
        email: adminData.email,
        permissions: adminData.permissions,
        role: adminData.role
      }
    };
  } catch (error) {
    logger.error('Admin authentication validation failed:', error);
    throw error;
  }
}

/**
 * Validate admin permissions for specific actions
 */
async function validateAdminPermissions(adminId, requiredPermission) {
  try {
    const db = admin.firestore();
    const adminDoc = await db.collection('admin_users').doc(adminId).get();

    if (!adminDoc.exists) {
      throw new Error('Admin user not found');
    }

    const adminData = adminDoc.data();
    
    if (!adminData.isAdmin || !adminData.isActive) {
      throw new Error('Admin access denied');
    }

    const hasPermission = adminData.permissions && 
                         (adminData.permissions.includes(requiredPermission) || 
                          adminData.permissions.includes('super_admin'));

    if (!hasPermission) {
      throw new Error(`Permission '${requiredPermission}' required`);
    }

    return true;
  } catch (error) {
    logger.error(`Permission validation failed for ${adminId}:`, error);
    throw error;
  }
}

/**
 * Validate Pi Network user authentication
 */
async function validatePiUserAuth(authContext) {
  if (!authContext || !authContext.uid) {
    throw new Error('Authentication required');
  }

  // Check if user is authenticated with anonymous auth (Pi user)
  if (!authContext.token || authContext.token.firebase.sign_in_provider !== 'anonymous') {
    throw new Error('Pi Network authentication required');
  }

  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(authContext.uid).get();

    if (!userDoc.exists) {
      throw new Error('Pi user not found');
    }

    const userData = userDoc.data();
    
    if (userData.isSuspended) {
      throw new Error('User account is suspended');
    }

    return {
      isPiUser: true,
      userData: {
        id: authContext.uid,
        piUID: userData.piUID,
        piUsername: userData.piUsername,
        authMethod: userData.authMethod
      }
    };
  } catch (error) {
    logger.error('Pi user authentication validation failed:', error);
    throw error;
  }
}

/**
 * General authentication middleware
 */
function authMiddleware(requiredRole = null) {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split('Bearer ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'Authorization token required' });
      }

      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;

      // Role-based validation
      if (requiredRole === 'admin') {
        await validateAdminAuth({ uid: decodedToken.uid, token: decodedToken });
      } else if (requiredRole === 'pi_user') {
        await validatePiUserAuth({ uid: decodedToken.uid, token: decodedToken });
      }

      next();
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      res.status(403).json({ error: error.message });
    }
  };
}

/**
 * Permission-based middleware for admin routes
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      await validateAdminPermissions(req.user.uid, permission);
      next();
    } catch (error) {
      logger.error('Permission middleware error:', error);
      res.status(403).json({ error: error.message });
    }
  };
}

/**
 * Check if user has specific permission
 */
async function hasPermission(userId, permission) {
  try {
    const db = admin.firestore();
    const adminDoc = await db.collection('admin_users').doc(userId).get();

    if (!adminDoc.exists()) {
      return false;
    }

    const adminData = adminDoc.data();
    return adminData.isAdmin && 
           adminData.isActive && 
           adminData.permissions && 
           (adminData.permissions.includes(permission) || 
            adminData.permissions.includes('super_admin'));
  } catch (error) {
    logger.error(`Permission check failed for ${userId}:`, error);
    return false;
  }
}

/**
 * Validate session and refresh if needed
 */
async function validateSession(authContext) {
  try {
    if (!authContext || !authContext.uid) {
      throw new Error('No authentication context');
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (authContext.token.exp <= now) {
      throw new Error('Token expired');
    }

    // Check if token was issued too long ago (security measure)
    const tokenAge = now - authContext.token.iat;
    const maxAge = 24 * 60 * 60; // 24 hours

    if (tokenAge > maxAge) {
      throw new Error('Token too old, please re-authenticate');
    }

    return true;
  } catch (error) {
    logger.error('Session validation failed:', error);
    throw error;
  }
}

/**
 * Anti-fraud validation for Pi users
 */
async function validateUserIntegrity(userId, actionType = 'general') {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Check if user is suspended
    if (userData.isSuspended) {
      throw new Error('User account is suspended');
    }

    // Check for suspicious activity patterns
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);

    // Check entry frequency (anti-spam)
    if (actionType === 'lottery_entry') {
      const recentEntriesSnapshot = await db.collection('user_entries')
        .where('userId', '==', userId)
        .where('createdAt', '>=', last24Hours)
        .get();

      const recentEntries = recentEntriesSnapshot.size;
      
      // Flag if more than 50 entries in 24 hours
      if (recentEntries > 50) {
        await flagSuspiciousActivity(userId, 'high_entry_frequency', {
          entriesIn24h: recentEntries
        });
        throw new Error('Entry frequency limit exceeded');
      }
    }

    // Check payment patterns (anti-fraud)
    if (actionType === 'payment') {
      const recentPaymentsSnapshot = await db.collection('payment_transactions')
        .where('userId', '==', userId)
        .where('createdAt', '>=', last24Hours)
        .get();

      const recentPayments = recentPaymentsSnapshot.size;
      
      // Flag if more than 20 payments in 24 hours
      if (recentPayments > 20) {
        await flagSuspiciousActivity(userId, 'high_payment_frequency', {
          paymentsIn24h: recentPayments
        });
        throw new Error('Payment frequency limit exceeded');
      }
    }

    return true;
  } catch (error) {
    logger.error(`User integrity validation failed for ${userId}:`, error);
    throw error;
  }
}

/**
 * Flag suspicious activity
 */
async function flagSuspiciousActivity(userId, activityType, details = {}) {
  try {
    const db = admin.firestore();
    
    await db.collection('suspicious_activity').add({
      userId,
      activityType,
      details,
      flagged: true,
      reviewed: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log for admin review
    await db.collection('admin_logs').add({
      action: 'suspicious_activity_flagged',
      details: {
        userId,
        activityType,
        details
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.warn(`Suspicious activity flagged for user ${userId}:`, {
      activityType,
      details
    });
  } catch (error) {
    logger.error('Failed to flag suspicious activity:', error);
  }
}

/**
 * Rate limiting check for specific actions
 */
async function checkRateLimit(userId, actionType, timeWindow = 3600, maxActions = 10) {
  try {
    const db = admin.firestore();
    const now = new Date();
    const windowStart = new Date(now - timeWindow * 1000);

    // Check action count in time window
    const actionsSnapshot = await db.collection('user_actions')
      .where('userId', '==', userId)
      .where('actionType', '==', actionType)
      .where('timestamp', '>=', windowStart)
      .get();

    const actionCount = actionsSnapshot.size;

    if (actionCount >= maxActions) {
      throw new Error(`Rate limit exceeded for ${actionType}`);
    }

    // Log the action
    await db.collection('user_actions').add({
      userId,
      actionType,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return true;
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    throw error;
  }
}

/**
 * Cleanup old action logs (called by maintenance)
 */
async function cleanupActionLogs() {
  try {
    const db = admin.firestore();
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const oldActionsSnapshot = await db.collection('user_actions')
      .where('timestamp', '<', cutoffDate)
      .limit(1000)
      .get();

    const batch = db.batch();
    oldActionsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (!oldActionsSnapshot.empty) {
      await batch.commit();
    }

    return oldActionsSnapshot.size;
  } catch (error) {
    logger.error('Failed to cleanup action logs:', error);
    throw error;
  }
}

module.exports = {
  validateAdminAuth,
  validateAdminPermissions,
  validatePiUserAuth,
  authMiddleware,
  requirePermission,
  hasPermission,
  validateSession,
  validateUserIntegrity,
  flagSuspiciousActivity,
  checkRateLimit,
  cleanupActionLogs
};
