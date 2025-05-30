const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const { validateAdminPermissions } = require('../middleware/auth');

class UserManagement {
  constructor() {
    this.db = admin.firestore();
    this.auth = admin.auth();
    this.defaultPermissions = [
      'manage_lotteries',
      'approve_prizes',
      'system_config',
      'view_analytics'
    ];
    this.allPermissions = [
      'manage_lotteries',
      'approve_prizes',
      'system_config',
      'view_analytics',
      'user_management',
      'manage_ads',
      'financial_admin',
      'super_admin'
    ];
  }

  /**
   * Create a new admin user
   */
  async createAdminUser(requestingAdminId, userData) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      const { email, password, permissions = [], role = 'admin' } = userData;

      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Validate permissions
      const validPermissions = permissions.filter(p => this.allPermissions.includes(p));
      const finalPermissions = validPermissions.length > 0 ? validPermissions : this.defaultPermissions;

      // Create Firebase Auth user
      const userRecord = await this.auth.createUser({
        email,
        password,
        emailVerified: true,
        disabled: false
      });

      // Create admin user document
      const adminUserData = {
        email,
        role,
        permissions: finalPermissions,
        isAdmin: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: requestingAdminId,
        lastLogin: null,
        isActive: true,
        loginCount: 0,
        lastPasswordChange: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('admin_users').doc(userRecord.uid).set(adminUserData);

      // Log admin creation
      await this.logAdminAction(requestingAdminId, 'admin_user_created', {
        newAdminId: userRecord.uid,
        email,
        permissions: finalPermissions,
        role
      });

      logger.info(`Admin user created: ${email} by ${requestingAdminId}`);

      return {
        success: true,
        adminId: userRecord.uid,
        email,
        permissions: finalPermissions,
        role,
        message: 'Admin user created successfully'
      };
    } catch (error) {
      logger.error('Failed to create admin user:', error);
      throw error;
    }
  }

  /**
   * Update admin user permissions
   */
  async updateAdminPermissions(requestingAdminId, targetAdminId, newPermissions) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      // Prevent self-modification of super admin permissions
      if (requestingAdminId === targetAdminId) {
        const requestingAdmin = await this.getAdminUser(requestingAdminId);
        if (requestingAdmin.permissions.includes('super_admin')) {
          throw new Error('Super admin cannot modify their own permissions');
        }
      }

      // Validate permissions
      const validPermissions = newPermissions.filter(p => this.allPermissions.includes(p));
      
      if (validPermissions.length === 0) {
        throw new Error('At least one valid permission must be provided');
      }

      // Get current admin data
      const currentAdmin = await this.getAdminUser(targetAdminId);
      if (!currentAdmin) {
        throw new Error('Admin user not found');
      }

      // Update permissions
      await this.db.collection('admin_users').doc(targetAdminId).update({
        permissions: validPermissions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: requestingAdminId
      });

      // Log permission change
      await this.logAdminAction(requestingAdminId, 'admin_permissions_updated', {
        targetAdminId,
        oldPermissions: currentAdmin.permissions,
        newPermissions: validPermissions
      });

      logger.info(`Admin permissions updated for ${targetAdminId} by ${requestingAdminId}`);

      return {
        success: true,
        adminId: targetAdminId,
        oldPermissions: currentAdmin.permissions,
        newPermissions: validPermissions,
        message: 'Admin permissions updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update admin permissions:', error);
      throw error;
    }
  }

  /**
   * Deactivate admin user
   */
  async deactivateAdminUser(requestingAdminId, targetAdminId) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      // Prevent self-deactivation
      if (requestingAdminId === targetAdminId) {
        throw new Error('Admin cannot deactivate their own account');
      }

      // Get admin data
      const targetAdmin = await this.getAdminUser(targetAdminId);
      if (!targetAdmin) {
        throw new Error('Admin user not found');
      }

      // Prevent deactivation of super admin by non-super admin
      if (targetAdmin.permissions.includes('super_admin')) {
        const requestingAdmin = await this.getAdminUser(requestingAdminId);
        if (!requestingAdmin.permissions.includes('super_admin')) {
          throw new Error('Only super admin can deactivate another super admin');
        }
      }

      // Deactivate in Firebase Auth
      await this.auth.updateUser(targetAdminId, { disabled: true });

      // Update admin document
      await this.db.collection('admin_users').doc(targetAdminId).update({
        isActive: false,
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deactivatedBy: requestingAdminId
      });

      // Log deactivation
      await this.logAdminAction(requestingAdminId, 'admin_user_deactivated', {
        targetAdminId,
        email: targetAdmin.email
      });

      logger.info(`Admin user deactivated: ${targetAdminId} by ${requestingAdminId}`);

      return {
        success: true,
        adminId: targetAdminId,
        message: 'Admin user deactivated successfully'
      };
    } catch (error) {
      logger.error('Failed to deactivate admin user:', error);
      throw error;
    }
  }

  /**
   * Reactivate admin user
   */
  async reactivateAdminUser(requestingAdminId, targetAdminId) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      // Get admin data
      const targetAdmin = await this.getAdminUser(targetAdminId);
      if (!targetAdmin) {
        throw new Error('Admin user not found');
      }

      // Reactivate in Firebase Auth
      await this.auth.updateUser(targetAdminId, { disabled: false });

      // Update admin document
      await this.db.collection('admin_users').doc(targetAdminId).update({
        isActive: true,
        reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reactivatedBy: requestingAdminId
      });

      // Log reactivation
      await this.logAdminAction(requestingAdminId, 'admin_user_reactivated', {
        targetAdminId,
        email: targetAdmin.email
      });

      logger.info(`Admin user reactivated: ${targetAdminId} by ${requestingAdminId}`);

      return {
        success: true,
        adminId: targetAdminId,
        message: 'Admin user reactivated successfully'
      };
    } catch (error) {
      logger.error('Failed to reactivate admin user:', error);
      throw error;
    }
  }

  /**
   * Get admin user details
   */
  async getAdminUser(adminId) {
    try {
      const adminDoc = await this.db.collection('admin_users').doc(adminId).get();
      
      if (!adminDoc.exists) {
        return null;
      }

      return {
        id: adminDoc.id,
        ...adminDoc.data()
      };
    } catch (error) {
      logger.error(`Failed to get admin user ${adminId}:`, error);
      throw error;
    }
  }

  /**
   * List all admin users
   */
  async listAdminUsers(requestingAdminId) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      const adminsSnapshot = await this.db.collection('admin_users')
        .orderBy('createdAt', 'desc')
        .get();

      const adminUsers = [];
      adminsSnapshot.forEach(doc => {
        const adminData = doc.data();
        adminUsers.push({
          id: doc.id,
          email: adminData.email,
          role: adminData.role,
          permissions: adminData.permissions,
          isActive: adminData.isActive,
          createdAt: adminData.createdAt?.toDate?.()?.toISOString?.() || null,
          lastLogin: adminData.lastLogin?.toDate?.()?.toISOString?.() || null,
          loginCount: adminData.loginCount || 0
        });
      });

      return adminUsers;
    } catch (error) {
      logger.error('Failed to list admin users:', error);
      throw error;
    }
  }

  /**
   * Get regular user details (Pi lottery users)
   */
  async getUser(requestingAdminId, userId) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();

      // Get user's lottery entries
      const entriesSnapshot = await this.db.collection('user_entries')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const entries = [];
      entriesSnapshot.forEach(doc => {
        entries.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null
        });
      });

      // Get user's winnings
      const winnersSnapshot = await this.db.collection('lottery_winners')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const winnings = [];
      winnersSnapshot.forEach(doc => {
        winnings.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null
        });
      });

      return {
        id: userId,
        ...userData,
        createdAt: userData.createdAt?.toDate?.()?.toISOString?.() || null,
        lastLogin: userData.lastLogin?.toDate?.()?.toISOString?.() || null,
        recentEntries: entries,
        winnings
      };
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * List regular users with filtering and pagination
   */
  async listUsers(requestingAdminId, options = {}) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      const {
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        searchTerm = '',
        dateFrom = null,
        dateTo = null
      } = options;

      let query = this.db.collection('users');

      // Apply date filters
      if (dateFrom) {
        query = query.where('createdAt', '>=', new Date(dateFrom));
      }
      if (dateTo) {
        query = query.where('createdAt', '<=', new Date(dateTo));
      }

      // Apply sorting
      query = query.orderBy(sortBy, sortOrder);

      // Apply pagination
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit);

      const usersSnapshot = await query.get();
      const users = [];

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        
        // Apply search filter (client-side for simplicity)
        if (searchTerm && !userData.piUsername?.toLowerCase().includes(searchTerm.toLowerCase())) {
          return;
        }

        users.push({
          id: doc.id,
          piUsername: userData.piUsername,
          piUID: userData.piUID,
          authMethod: userData.authMethod,
          totalEntries: userData.totalEntries || 0,
          totalWinnings: userData.totalWinnings || 0,
          lotteriesWon: userData.lotteriesWon || 0,
          winRate: userData.winRate || 0,
          createdAt: userData.createdAt?.toDate?.()?.toISOString?.() || null,
          lastLogin: userData.lastLogin?.toDate?.()?.toISOString?.() || null
        });
      });

      // Get total count (for pagination)
      const totalSnapshot = await this.db.collection('users').get();
      const totalUsers = totalSnapshot.size;

      return {
        users,
        pagination: {
          total: totalUsers,
          limit,
          offset,
          hasMore: offset + limit < totalUsers
        }
      };
    } catch (error) {
      logger.error('Failed to list users:', error);
      throw error;
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(requestingAdminId, userId, reason = '') {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      // Check if user exists
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      // Update user status
      await this.db.collection('users').doc(userId).update({
        isSuspended: true,
        suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
        suspendedBy: requestingAdminId,
        suspensionReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log suspension
      await this.logAdminAction(requestingAdminId, 'user_suspended', {
        userId,
        reason
      });

      logger.info(`User suspended: ${userId} by ${requestingAdminId} - ${reason}`);

      return {
        success: true,
        userId,
        message: 'User suspended successfully'
      };
    } catch (error) {
      logger.error('Failed to suspend user:', error);
      throw error;
    }
  }

  /**
   * Unsuspend user account
   */
  async unsuspendUser(requestingAdminId, userId) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      // Check if user exists
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      // Update user status
      await this.db.collection('users').doc(userId).update({
        isSuspended: false,
        unsuspendedAt: admin.firestore.FieldValue.serverTimestamp(),
        unsuspendedBy: requestingAdminId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log unsuspension
      await this.logAdminAction(requestingAdminId, 'user_unsuspended', {
        userId
      });

      logger.info(`User unsuspended: ${userId} by ${requestingAdminId}`);

      return {
        success: true,
        userId,
        message: 'User unsuspended successfully'
      };
    } catch (error) {
      logger.error('Failed to unsuspend user:', error);
      throw error;
    }
  }

  /**
   * Get user statistics summary
   */
  async getUserStatistics(requestingAdminId) {
    try {
      await validateAdminPermissions(requestingAdminId, 'view_analytics');

      const now = new Date();
      const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);

      // Total users
      const totalUsersSnapshot = await this.db.collection('users').get();
      const totalUsers = totalUsersSnapshot.size;

      // New users (last 30 days)
      const newUsersSnapshot = await this.db.collection('users')
        .where('createdAt', '>=', last30Days)
        .get();
      const newUsers = newUsersSnapshot.size;

      // Active users (logged in last 7 days)
      const activeUsersSnapshot = await this.db.collection('users')
        .where('lastLogin', '>=', last7Days)
        .get();
      const activeUsers = activeUsersSnapshot.size;

      // Suspended users
      const suspendedUsersSnapshot = await this.db.collection('users')
        .where('isSuspended', '==', true)
        .get();
      const suspendedUsers = suspendedUsersSnapshot.size;

      // Users with entries
      const usersWithEntriesSnapshot = await this.db.collection('users')
        .where('totalEntries', '>', 0)
        .get();
      const usersWithEntries = usersWithEntriesSnapshot.size;

      // Users with winnings
      const usersWithWinningsSnapshot = await this.db.collection('users')
        .where('lotteriesWon', '>', 0)
        .get();
      const usersWithWinnings = usersWithWinningsSnapshot.size;

      return {
        total: totalUsers,
        new: newUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        withEntries: usersWithEntries,
        withWinnings: usersWithWinnings,
        engagementRate: totalUsers > 0 ? parseFloat(((usersWithEntries / totalUsers) * 100).toFixed(2)) : 0,
        winnerRate: usersWithEntries > 0 ? parseFloat(((usersWithWinnings / usersWithEntries) * 100).toFixed(2)) : 0
      };
    } catch (error) {
      logger.error('Failed to get user statistics:', error);
      throw error;
    }
  }

  /**
   * Reset user password (for admin users)
   */
  async resetAdminPassword(requestingAdminId, targetAdminId, newPassword) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      // Validate new password
      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      // Get target admin data
      const targetAdmin = await this.getAdminUser(targetAdminId);
      if (!targetAdmin) {
        throw new Error('Admin user not found');
      }

      // Prevent self-password reset (should use normal password change)
      if (requestingAdminId === targetAdminId) {
        throw new Error('Use the password change function to update your own password');
      }

      // Update password in Firebase Auth
      await this.auth.updateUser(targetAdminId, {
        password: newPassword
      });

      // Update admin document
      await this.db.collection('admin_users').doc(targetAdminId).update({
        lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
        passwordResetBy: requestingAdminId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log password reset
      await this.logAdminAction(requestingAdminId, 'admin_password_reset', {
        targetAdminId,
        email: targetAdmin.email
      });

      logger.info(`Admin password reset: ${targetAdminId} by ${requestingAdminId}`);

      return {
        success: true,
        adminId: targetAdminId,
        message: 'Admin password reset successfully'
      };
    } catch (error) {
      logger.error('Failed to reset admin password:', error);
      throw error;
    }
  }

  /**
   * Change own admin password
   */
  async changeAdminPassword(adminId, currentPassword, newPassword) {
    try {
      // Validate new password
      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      // Get admin data
      const adminData = await this.getAdminUser(adminId);
      if (!adminData) {
        throw new Error('Admin user not found');
      }

      // Update password in Firebase Auth
      await this.auth.updateUser(adminId, {
        password: newPassword
      });

      // Update admin document
      await this.db.collection('admin_users').doc(adminId).update({
        lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log password change
      await this.logAdminAction(adminId, 'admin_password_changed', {
        adminId
      });

      logger.info(`Admin password changed: ${adminId}`);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Failed to change admin password:', error);
      throw error;
    }
  }

  /**
   * Get admin activity log
   */
  async getAdminActivityLog(requestingAdminId, options = {}) {
    try {
      await validateAdminPermissions(requestingAdminId, 'user_management');

      const {
        limit = 50,
        adminId = null,
        dateFrom = null,
        dateTo = null,
        action = null
      } = options;

      let query = this.db.collection('admin_logs')
        .orderBy('timestamp', 'desc')
        .limit(limit);

      // Apply filters
      if (adminId) {
        query = query.where('adminId', '==', adminId);
      }
      if (action) {
        query = query.where('action', '==', action);
      }
      if (dateFrom) {
        query = query.where('timestamp', '>=', new Date(dateFrom));
      }
      if (dateTo) {
        query = query.where('timestamp', '<=', new Date(dateTo));
      }

      const logsSnapshot = await query.get();
      const logs = [];

      logsSnapshot.forEach(doc => {
        const logData = doc.data();
        logs.push({
          id: doc.id,
          ...logData,
          timestamp: logData.timestamp?.toDate?.()?.toISOString?.() || null
        });
      });

      return logs;
    } catch (error) {
      logger.error('Failed to get admin activity log:', error);
      throw error;
    }
  }

  /**
   * Log admin action
   */
  async logAdminAction(adminId, action, details = {}) {
    try {
      await this.db.collection('admin_logs').add({
        adminId,
        action,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log admin action:', error);
    }
  }

  /**
   * Update admin login tracking
   */
  async trackAdminLogin(adminId) {
    try {
      await this.db.collection('admin_users').doc(adminId).update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        loginCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log login
      await this.logAdminAction(adminId, 'admin_login', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to track admin login:', error);
    }
  }

  /**
   * Get available permissions list
   */
  getAvailablePermissions() {
    return this.allPermissions.map(permission => ({
      key: permission,
      name: this.formatPermissionName(permission),
      description: this.getPermissionDescription(permission)
    }));
  }

  /**
   * Format permission name for display
   */
  formatPermissionName(permission) {
    return permission
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get permission description
   */
  getPermissionDescription(permission) {
    const descriptions = {
      'manage_lotteries': 'Create, modify, and manage lottery instances',
      'approve_prizes': 'Approve and distribute lottery prizes',
      'system_config': 'Modify system configuration and settings',
      'view_analytics': 'View reports and analytics data',
      'user_management': 'Manage admin and regular users',
      'manage_ads': 'Manage advertisement system and rewards',
      'financial_admin': 'Access financial data and audit reports',
      'super_admin': 'Full system access and user management'
    };

    return descriptions[permission] || 'No description available';
  }
}

module.exports = new UserManagement();
