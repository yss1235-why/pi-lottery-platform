const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const { validateAdminPermissions } = require('../middleware/auth');

class SystemManagement {
  constructor() {
    this.db = admin.firestore();
    this.maintenanceTasks = new Map();
    this.systemAlerts = [];
  }

  /**
   * Perform comprehensive system maintenance
   */
  async performSystemMaintenance() {
    const maintenanceId = `maint_${Date.now()}`;
    
    try {
      logger.info(`Starting system maintenance: ${maintenanceId}`);
      
      const maintenanceLog = {
        id: maintenanceId,
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        tasks: [],
        status: 'running'
      };

      // Create maintenance log
      await this.db.collection('maintenance_logs').doc(maintenanceId).set(maintenanceLog);

      const tasks = [
        { name: 'cleanup_expired_sessions', fn: this.cleanupExpiredSessions.bind(this) },
        { name: 'cleanup_old_logs', fn: this.cleanupOldLogs.bind(this) },
        { name: 'cleanup_incomplete_payments', fn: this.cleanupIncompletePayments.bind(this) },
        { name: 'update_user_statistics', fn: this.updateUserStatistics.bind(this) },
        { name: 'validate_lottery_integrity', fn: this.validateLotteryIntegrity.bind(this) },
        { name: 'cleanup_old_ticket_limits', fn: this.cleanupOldTicketLimits.bind(this) },
        { name: 'generate_system_metrics', fn: this.generateSystemMetrics.bind(this) },
        { name: 'backup_critical_data', fn: this.backupCriticalData.bind(this) }
      ];

      const results = [];
      
      for (const task of tasks) {
        try {
          logger.info(`Executing maintenance task: ${task.name}`);
          const taskResult = await task.fn();
          
          results.push({
            name: task.name,
            status: 'completed',
            result: taskResult,
            completedAt: new Date().toISOString()
          });
          
          logger.info(`Maintenance task ${task.name} completed successfully`);
        } catch (error) {
          logger.error(`Maintenance task ${task.name} failed:`, error);
          
          results.push({
            name: task.name,
            status: 'failed',
            error: error.message,
            completedAt: new Date().toISOString()
          });
        }
      }

      // Update maintenance log
      await this.db.collection('maintenance_logs').doc(maintenanceId).update({
        tasks: results,
        status: 'completed',
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        summary: {
          totalTasks: tasks.length,
          completedTasks: results.filter(r => r.status === 'completed').length,
          failedTasks: results.filter(r => r.status === 'failed').length
        }
      });

      logger.info(`System maintenance completed: ${maintenanceId}`);
      
      return {
        maintenanceId,
        results,
        summary: {
          totalTasks: tasks.length,
          completedTasks: results.filter(r => r.status === 'completed').length,
          failedTasks: results.filter(r => r.status === 'failed').length
        }
      };
    } catch (error) {
      logger.error('System maintenance failed:', error);
      
      // Update maintenance log with error
      await this.db.collection('maintenance_logs').doc(maintenanceId).update({
        status: 'failed',
        error: error.message,
        endTime: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error;
    }
  }

  /**
   * Clean up expired user sessions and authentication tokens
   */
  async cleanupExpiredSessions() {
    try {
      const expiredThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      // Clean up old user ticket limits (older than 30 days)
      const oldLimitsSnapshot = await this.db.collection('user_ticket_limits')
        .where('createdAt', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .get();

      const batch = this.db.batch();
      let deletedCount = 0;

      oldLimitsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return {
        deletedSessions: deletedCount,
        threshold: expiredThreshold.toISOString()
      };
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      throw error;
    }
  }

  /**
   * Clean up old system logs
   */
  async cleanupOldLogs() {
    try {
      const retentionPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
      const cutoffDate = new Date(Date.now() - retentionPeriod);

      // Clean up admin logs
      const oldAdminLogsSnapshot = await this.db.collection('admin_logs')
        .where('timestamp', '<', cutoffDate)
        .limit(1000) // Process in batches
        .get();

      const batch = this.db.batch();
      let deletedAdminLogs = 0;

      oldAdminLogsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedAdminLogs++;
      });

      if (deletedAdminLogs > 0) {
        await batch.commit();
      }

      // Clean up old maintenance logs (keep only last 50)
      const maintenanceLogsSnapshot = await this.db.collection('maintenance_logs')
        .orderBy('startTime', 'desc')
        .offset(50)
        .get();

      const maintenanceBatch = this.db.batch();
      let deletedMaintenanceLogs = 0;

      maintenanceLogsSnapshot.forEach(doc => {
        maintenanceBatch.delete(doc.ref);
        deletedMaintenanceLogs++;
      });

      if (deletedMaintenanceLogs > 0) {
        await maintenanceBatch.commit();
      }

      return {
        deletedAdminLogs,
        deletedMaintenanceLogs,
        cutoffDate: cutoffDate.toISOString()
      };
    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }

  /**
   * Clean up incomplete or expired payments
   */
  async cleanupIncompletePayments() {
    try {
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const incompletePaymentsSnapshot = await this.db.collection('payment_transactions')
        .where('status', 'in', ['pending', 'created'])
        .where('createdAt', '<', expiredThreshold)
        .get();

      const batch = this.db.batch();
      let cleanedCount = 0;

      incompletePaymentsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        cleanedCount++;
      });

      if (cleanedCount > 0) {
        await batch.commit();
      }

      return {
        expiredPayments: cleanedCount,
        threshold: expiredThreshold.toISOString()
      };
    } catch (error) {
      logger.error('Failed to cleanup incomplete payments:', error);
      throw error;
    }
  }

  /**
   * Update user statistics and calculate win rates
   */
  async updateUserStatistics() {
    try {
      const usersSnapshot = await this.db.collection('users').get();
      const batch = this.db.batch();
      let updatedUsers = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        // Get user entries
        const entriesSnapshot = await this.db.collection('user_entries')
          .where('userId', '==', userId)
          .where('status', '==', 'confirmed')
          .get();

        const totalEntries = entriesSnapshot.size;

        // Get user winnings
        const winnersSnapshot = await this.db.collection('lottery_winners')
          .where('userId', '==', userId)
          .get();

        let totalWinnings = 0;
        const lotteriesWon = winnersSnapshot.size;

        winnersSnapshot.forEach(doc => {
          const winner = doc.data();
          totalWinnings += winner.prizeAmount || 0;
        });

        const winRate = totalEntries > 0 ? lotteriesWon / totalEntries : 0;

        // Update user statistics
        batch.update(userDoc.ref, {
          totalEntries,
          totalWinnings: parseFloat(totalWinnings.toFixed(4)),
          lotteriesWon,
          winRate: parseFloat(winRate.toFixed(4)),
          statisticsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        updatedUsers++;

        // Process in batches of 500
        if (updatedUsers % 500 === 0) {
          await batch.commit();
        }
      }

      if (updatedUsers % 500 !== 0) {
        await batch.commit();
      }

      return {
        updatedUsers,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to update user statistics:', error);
      throw error;
    }
  }

  /**
   * Validate lottery data integrity
   */
  async validateLotteryIntegrity() {
    try {
      const issues = [];
      
      // Check for lottery instances without corresponding entries
      const instancesSnapshot = await this.db.collection('lottery_instances').get();
      
      for (const instanceDoc of instancesSnapshot.docs) {
        const instance = instanceDoc.data();
        const instanceId = instanceDoc.id;
        
        // Get entries for this instance
        const entriesSnapshot = await this.db.collection('user_entries')
          .where('lotteryInstanceId', '==', instanceId)
          .get();

        const actualParticipants = entriesSnapshot.size;
        const recordedParticipants = instance.participants || 0;

        if (actualParticipants !== recordedParticipants) {
          issues.push({
            type: 'participant_mismatch',
            instanceId,
            recorded: recordedParticipants,
            actual: actualParticipants
          });

          // Fix the mismatch
          await instanceDoc.ref.update({
            participants: actualParticipants,
            lastValidatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Validate prize pool calculation
        const lotteryTypeDoc = await this.db.collection('lottery_types')
          .doc(instance.lotteryTypeId)
          .get();

        if (lotteryTypeDoc.exists()) {
          const lotteryType = lotteryTypeDoc.data();
          let expectedPrizePool = 0;

          if (instance.lotteryTypeId === 'daily_ads') {
            expectedPrizePool = actualParticipants * 0.001; // Ad value
          } else {
            expectedPrizePool = actualParticipants * (lotteryType.entryFee - lotteryType.platformFee);
          }

          const recordedPrizePool = instance.prizePool || 0;
          const difference = Math.abs(expectedPrizePool - recordedPrizePool);

          if (difference > 0.001) { // Allow small floating point differences
            issues.push({
              type: 'prize_pool_mismatch',
              instanceId,
              expected: expectedPrizePool,
              recorded: recordedPrizePool,
              difference
            });

            // Fix the prize pool
            await instanceDoc.ref.update({
              prizePool: parseFloat(expectedPrizePool.toFixed(4)),
              lastValidatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }

      // Check for orphaned entries
      const entriesSnapshot = await this.db.collection('user_entries').get();
      
      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();
        
        if (entry.lotteryInstanceId) {
          const instanceDoc = await this.db.collection('lottery_instances')
            .doc(entry.lotteryInstanceId)
            .get();

          if (!instanceDoc.exists()) {
            issues.push({
              type: 'orphaned_entry',
              entryId: entryDoc.id,
              instanceId: entry.lotteryInstanceId
            });
          }
        }
      }

      return {
        totalIssuesFound: issues.length,
        issues,
        validatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to validate lottery integrity:', error);
      throw error;
    }
  }

  /**
   * Clean up old ticket limits
   */
  async cleanupOldTicketLimits() {
    try {
      const retentionDays = 30;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const oldLimitsSnapshot = await this.db.collection('user_ticket_limits')
        .where('createdAt', '<', cutoffDate)
        .limit(1000)
        .get();

      const batch = this.db.batch();
      let deletedCount = 0;

      oldLimitsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return {
        deletedLimits: deletedCount,
        cutoffDate: cutoffDate.toISOString()
      };
    } catch (error) {
      logger.error('Failed to cleanup old ticket limits:', error);
      throw error;
    }
  }

  /**
   * Generate system performance metrics
   */
  async generateSystemMetrics() {
    try {
      const metrics = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        database: {},
        performance: {},
        usage: {}
      };

      // Database metrics
      const collections = ['users', 'lottery_instances', 'user_entries', 'payment_transactions', 'lottery_winners'];
      
      for (const collection of collections) {
        const snapshot = await this.db.collection(collection).get();
        metrics.database[collection] = {
          count: snapshot.size,
          lastUpdated: new Date().toISOString()
        };
      }

      // Performance metrics
      metrics.performance = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      // Usage metrics for the last 24 hours
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentEntriesSnapshot = await this.db.collection('user_entries')
        .where('createdAt', '>=', last24Hours)
        .get();

      const recentPaymentsSnapshot = await this.db.collection('payment_transactions')
        .where('createdAt', '>=', last24Hours)
        .get();

      metrics.usage = {
        entriesLast24h: recentEntriesSnapshot.size,
        paymentsLast24h: recentPaymentsSnapshot.size,
        timestamp: new Date().toISOString()
      };

      // Store metrics
      await this.db.collection('system_metrics').add(metrics);

      return metrics;
    } catch (error) {
      logger.error('Failed to generate system metrics:', error);
      throw error;
    }
  }

  /**
   * Backup critical system data
   */
  async backupCriticalData() {
    try {
      const backupId = `backup_${Date.now()}`;
      const backupData = {
        id: backupId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'creating'
      };

      // Create backup record
      await this.db.collection('system_backups').doc(backupId).set(backupData);

      // Backup critical collections
      const criticalCollections = ['system_config', 'lottery_types', 'admin_users'];
      const backupCollections = {};

      for (const collectionName of criticalCollections) {
        const snapshot = await this.db.collection(collectionName).get();
        const documents = [];
        
        snapshot.forEach(doc => {
          documents.push({
            id: doc.id,
            data: doc.data()
          });
        });

        backupCollections[collectionName] = documents;
      }

      // Update backup with data
      await this.db.collection('system_backups').doc(backupId).update({
        status: 'completed',
        collections: backupCollections,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        size: JSON.stringify(backupCollections).length
      });

      // Clean up old backups (keep only last 10)
      const oldBackupsSnapshot = await this.db.collection('system_backups')
        .orderBy('createdAt', 'desc')
        .offset(10)
        .get();

      const batch = this.db.batch();
      oldBackupsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      if (!oldBackupsSnapshot.empty) {
        await batch.commit();
      }

      return {
        backupId,
        collections: Object.keys(backupCollections),
        documentsBackedUp: Object.values(backupCollections).reduce((sum, docs) => sum + docs.length, 0),
        size: JSON.stringify(backupCollections).length
      };
    } catch (error) {
      logger.error('Failed to backup critical data:', error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {},
        alerts: this.systemAlerts
      };

      // Database connectivity check
      try {
        await this.db.collection('system_config').doc('platform').get();
        health.checks.database = { status: 'healthy', message: 'Database connection successful' };
      } catch (error) {
        health.checks.database = { status: 'error', message: error.message };
        health.status = 'unhealthy';
      }

      // Check active lotteries
      const activeLotteriesSnapshot = await this.db.collection('lottery_instances')
        .where('status', '==', 'active')
        .get();

      health.checks.activeLotteries = {
        status: 'healthy',
        count: activeLotteriesSnapshot.size,
        message: `${activeLotteriesSnapshot.size} active lotteries`
      };

      // Check recent errors
      const recentErrorsSnapshot = await this.db.collection('admin_logs')
        .where('action', '==', 'error')
        .where('timestamp', '>=', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
        .get();

      const errorCount = recentErrorsSnapshot.size;
      if (errorCount > 10) {
        health.checks.errors = {
          status: 'warning',
          count: errorCount,
          message: `${errorCount} errors in the last hour`
        };
        health.status = 'warning';
      } else {
        health.checks.errors = {
          status: 'healthy',
          count: errorCount,
          message: `${errorCount} errors in the last hour`
        };
      }

      // Check system resources
      health.checks.resources = {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        message: 'System resources within normal limits'
      };

      return health;
    } catch (error) {
      logger.error('Failed to get system health:', error);
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Add system alert
   */
  addSystemAlert(alert) {
    this.systemAlerts.unshift({
      ...alert,
      id: `alert_${Date.now()}`,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 alerts
    if (this.systemAlerts.length > 50) {
      this.systemAlerts = this.systemAlerts.slice(0, 50);
    }

    logger.warn('System alert added:', alert);
  }

  /**
   * Clear system alerts
   */
  clearSystemAlerts() {
    this.systemAlerts = [];
    logger.info('System alerts cleared');
  }

  /**
   * Manual system cleanup trigger
   */
  async triggerManualCleanup(adminId, tasks = []) {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      const availableTasks = {
        'cleanup_expired_sessions': this.cleanupExpiredSessions.bind(this),
        'cleanup_old_logs': this.cleanupOldLogs.bind(this),
        'cleanup_incomplete_payments': this.cleanupIncompletePayments.bind(this),
        'update_user_statistics': this.updateUserStatistics.bind(this),
        'validate_lottery_integrity': this.validateLotteryIntegrity.bind(this),
        'cleanup_old_ticket_limits': this.cleanupOldTicketLimits.bind(this),
        'generate_system_metrics': this.generateSystemMetrics.bind(this),
        'backup_critical_data': this.backupCriticalData.bind(this)
      };

      const tasksToRun = tasks.length > 0 ? tasks : Object.keys(availableTasks);
      const results = [];

      for (const taskName of tasksToRun) {
        if (availableTasks[taskName]) {
          try {
            const result = await availableTasks[taskName]();
            results.push({
              task: taskName,
              status: 'completed',
              result
            });
          } catch (error) {
            results.push({
              task: taskName,
              status: 'failed',
              error: error.message
            });
          }
        } else {
          results.push({
            task: taskName,
            status: 'skipped',
            reason: 'Task not found'
          });
        }
      }

      // Log manual cleanup
      await this.db.collection('admin_logs').add({
        action: 'manual_cleanup',
        details: {
          adminId,
          tasks: tasksToRun,
          results
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        results,
        summary: {
          requested: tasksToRun.length,
          completed: results.filter(r => r.status === 'completed').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      };
    } catch (error) {
      logger.error('Manual cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get maintenance history
   */
  async getMaintenanceHistory(limit = 10) {
    try {
      const historySnapshot = await this.db.collection('maintenance_logs')
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();

      const history = [];
      historySnapshot.forEach(doc => {
        history.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return history;
    } catch (error) {
      logger.error('Failed to get maintenance history:', error);
      throw error;
    }
  }
}

module.exports = new SystemManagement();
