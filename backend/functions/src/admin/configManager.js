const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const { validateAdminPermissions } = require('../middleware/auth');

class ConfigManager {
  constructor() {
    this.db = admin.firestore();
    this.configCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get platform configuration with caching
   */
  async getPlatformConfig() {
    try {
      const cacheKey = 'platform_config';
      const cached = this.configCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const configDoc = await this.db.collection('system_config').doc('platform').get();
      
      if (!configDoc.exists) {
        return await this.initializePlatformConfig();
      }

      const config = configDoc.data();
      this.configCache.set(cacheKey, {
        data: config,
        timestamp: Date.now()
      });

      return config;
    } catch (error) {
      logger.error('Failed to get platform config:', error);
      throw error;
    }
  }

  /**
   * Initialize default platform configuration
   */
  async initializePlatformConfig() {
    try {
      const defaultConfig = {
        platformFee: {
          current: 0.1,
          pending: 0.1,
          type: 'fixed',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'system'
        },
        adValue: {
          current: 0.001,
          pending: 0.001,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'system'
        },
        lotteryToggles: {
          daily_pi: true,
          daily_ads: true,
          weekly_pi: true,
          monthly_pi: false
        },
        ticketLimits: {
          daily_pi_limit: 3,
          daily_ads_limit: 5,
          weekly_pi_limit: 10,
          monthly_pi_limit: 25
        },
        drawingThresholds: {
          daily_pi_threshold: 5,
          daily_ads_threshold: 10,
          weekly_pi_threshold: 20,
          monthly_pi_threshold: 30
        },
        systemSettings: {
          maintenanceMode: false,
          autoDrawing: true,
          prizeCooldownHours: 1,
          maxExtensions: 2,
          transactionFee: 0.01
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('system_config').doc('platform').set(defaultConfig);
      
      // Clear cache
      this.configCache.delete('platform_config');
      
      logger.info('Platform configuration initialized with defaults');
      return defaultConfig;
    } catch (error) {
      logger.error('Failed to initialize platform config:', error);
      throw error;
    }
  }

  /**
   * Update platform fee configuration
   */
  async updatePlatformFee(newFee, adminId, reason = 'Administrative adjustment') {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      const currentConfig = await this.getPlatformConfig();
      
      // Validate fee range
      if (newFee < 0 || newFee > 0.5) {
        throw new Error('Platform fee must be between 0 and 0.5 Pi');
      }

      const updates = {
        'platformFee.pending': newFee,
        'platformFee.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        'platformFee.updatedBy': adminId,
        'platformFee.reason': reason,
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('system_config').doc('platform').update(updates);

      // Log the change
      await this.logConfigChange('platform_fee', {
        oldValue: currentConfig.platformFee.current,
        newValue: newFee,
        adminId,
        reason
      });

      // Clear cache
      this.configCache.delete('platform_config');

      logger.info(`Platform fee updated to ${newFee} by ${adminId}`);
      
      return {
        success: true,
        oldFee: currentConfig.platformFee.current,
        newFee,
        message: 'Platform fee updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update platform fee:', error);
      throw error;
    }
  }

  /**
   * Confirm pending platform fee change
   */
  async confirmPlatformFeeChange(adminId) {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      const currentConfig = await this.getPlatformConfig();
      
      if (currentConfig.platformFee.current === currentConfig.platformFee.pending) {
        throw new Error('No pending fee changes to confirm');
      }

      const updates = {
        'platformFee.current': currentConfig.platformFee.pending,
        'platformFee.confirmedAt': admin.firestore.FieldValue.serverTimestamp(),
        'platformFee.confirmedBy': adminId,
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('system_config').doc('platform').update(updates);

      // Add to fee history
      await this.addFeeHistoryEntry({
        fee: currentConfig.platformFee.pending,
        type: currentConfig.platformFee.type,
        changedBy: adminId,
        reason: currentConfig.platformFee.reason || 'Administrative adjustment',
        date: new Date().toISOString().split('T')[0]
      });

      // Clear cache
      this.configCache.delete('platform_config');

      logger.info(`Platform fee change confirmed: ${currentConfig.platformFee.pending} by ${adminId}`);
      
      return {
        success: true,
        confirmedFee: currentConfig.platformFee.pending,
        message: 'Platform fee change confirmed and activated'
      };
    } catch (error) {
      logger.error('Failed to confirm platform fee change:', error);
      throw error;
    }
  }

  /**
   * Update ad value configuration
   */
  async updateAdValue(newValue, adminId, reason = 'Administrative adjustment') {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      // Validate ad value range
      if (newValue < 0 || newValue > 0.1) {
        throw new Error('Ad value must be between 0 and 0.1 Pi');
      }

      const updates = {
        'adValue.current': newValue,
        'adValue.pending': newValue,
        'adValue.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        'adValue.updatedBy': adminId,
        'adValue.reason': reason,
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('system_config').doc('platform').update(updates);

      // Log the change
      await this.logConfigChange('ad_value', {
        newValue,
        adminId,
        reason
      });

      // Clear cache
      this.configCache.delete('platform_config');

      logger.info(`Ad value updated to ${newValue} by ${adminId}`);
      
      return {
        success: true,
        newValue,
        message: 'Ad value updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update ad value:', error);
      throw error;
    }
  }

  /**
   * Update lottery toggle states
   */
  async updateLotteryToggles(toggles, adminId) {
    try {
      await validateAdminPermissions(adminId, 'manage_lotteries');

      const validLotteryTypes = ['daily_pi', 'daily_ads', 'weekly_pi', 'monthly_pi'];
      const updates = {};

      for (const [lotteryType, enabled] of Object.entries(toggles)) {
        if (validLotteryTypes.includes(lotteryType)) {
          updates[`lotteryToggles.${lotteryType}`] = Boolean(enabled);
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid lottery toggles provided');
      }

      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await this.db.collection('system_config').doc('platform').update(updates);

      // Log the changes
      await this.logConfigChange('lottery_toggles', {
        changes: toggles,
        adminId
      });

      // Clear cache
      this.configCache.delete('platform_config');

      logger.info(`Lottery toggles updated by ${adminId}:`, toggles);
      
      return {
        success: true,
        updates,
        message: 'Lottery toggles updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update lottery toggles:', error);
      throw error;
    }
  }

  /**
   * Update ticket limits
   */
  async updateTicketLimits(limits, adminId) {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      const validLimits = [
        'daily_pi_limit', 'daily_ads_limit', 
        'weekly_pi_limit', 'monthly_pi_limit'
      ];
      const updates = {};

      for (const [limitType, value] of Object.entries(limits)) {
        if (validLimits.includes(limitType)) {
          const numValue = parseInt(value);
          if (numValue > 0 && numValue <= 100) {
            updates[`ticketLimits.${limitType}`] = numValue;
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid ticket limits provided');
      }

      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await this.db.collection('system_config').doc('platform').update(updates);

      // Log the changes
      await this.logConfigChange('ticket_limits', {
        changes: limits,
        adminId
      });

      // Clear cache
      this.configCache.delete('platform_config');

      logger.info(`Ticket limits updated by ${adminId}:`, limits);
      
      return {
        success: true,
        updates,
        message: 'Ticket limits updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update ticket limits:', error);
      throw error;
    }
  }

  /**
   * Update drawing thresholds
   */
  async updateDrawingThresholds(thresholds, adminId) {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      const validThresholds = [
        'daily_pi_threshold', 'daily_ads_threshold',
        'weekly_pi_threshold', 'monthly_pi_threshold'
      ];
      const updates = {};

      for (const [thresholdType, value] of Object.entries(thresholds)) {
        if (validThresholds.includes(thresholdType)) {
          const numValue = parseInt(value);
          if (numValue > 0 && numValue <= 1000) {
            updates[`drawingThresholds.${thresholdType}`] = numValue;
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid drawing thresholds provided');
      }

      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await this.db.collection('system_config').doc('platform').update(updates);

      // Log the changes
      await this.logConfigChange('drawing_thresholds', {
        changes: thresholds,
        adminId
      });

      // Clear cache
      this.configCache.delete('platform_config');

      logger.info(`Drawing thresholds updated by ${adminId}:`, thresholds);
      
      return {
        success: true,
        updates,
        message: 'Drawing thresholds updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update drawing thresholds:', error);
      throw error;
    }
  }

  /**
   * Toggle maintenance mode
   */
  async toggleMaintenanceMode(enabled, adminId, reason = '') {
    try {
      await validateAdminPermissions(adminId, 'system_config');

      const updates = {
        'systemSettings.maintenanceMode': Boolean(enabled),
        'systemSettings.maintenanceReason': reason,
        'systemSettings.maintenanceToggledAt': admin.firestore.FieldValue.serverTimestamp(),
        'systemSettings.maintenanceToggledBy': adminId,
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('system_config').doc('platform').update(updates);

      // Log the change
      await this.logConfigChange('maintenance_mode', {
        enabled,
        reason,
        adminId
      });

      // Clear cache
      this.configCache.delete('platform_config');

      const action = enabled ? 'enabled' : 'disabled';
      logger.info(`Maintenance mode ${action} by ${adminId}: ${reason}`);
      
      return {
        success: true,
        maintenanceMode: enabled,
        message: `Maintenance mode ${action} successfully`
      };
    } catch (error) {
      logger.error('Failed to toggle maintenance mode:', error);
      throw error;
    }
  }

  /**
   * Get fee change history
   */
  async getFeeHistory(limit = 10) {
    try {
      const historyDoc = await this.db.collection('system_config').doc('fee_history').get();
      
      if (!historyDoc.exists()) {
        return [];
      }

      const history = historyDoc.data().entries || [];
      return history
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to get fee history:', error);
      throw error;
    }
  }

  /**
   * Add entry to fee history
   */
  async addFeeHistoryEntry(entry) {
    try {
      const historyRef = this.db.collection('system_config').doc('fee_history');
      const historyDoc = await historyRef.get();
      
      let entries = [];
      if (historyDoc.exists()) {
        entries = historyDoc.data().entries || [];
      }

      entries.unshift({
        ...entry,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Keep only last 50 entries
      if (entries.length > 50) {
        entries = entries.slice(0, 50);
      }

      await historyRef.set({
        entries,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to add fee history entry:', error);
    }
  }

  /**
   * Log configuration changes
   */
  async logConfigChange(changeType, details) {
    try {
      await this.db.collection('admin_logs').add({
        action: 'config_change',
        changeType,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log config change:', error);
    }
  }

  /**
   * Get lottery type configuration
   */
  async getLotteryTypeConfig(lotteryTypeId) {
    try {
      const lotteryTypeDoc = await this.db.collection('lottery_types').doc(lotteryTypeId).get();
      
      if (!lotteryTypeDoc.exists()) {
        throw new Error(`Lottery type ${lotteryTypeId} not found`);
      }

      return { id: lotteryTypeDoc.id, ...lotteryTypeDoc.data() };
    } catch (error) {
      logger.error(`Failed to get lottery type config for ${lotteryTypeId}:`, error);
      throw error;
    }
  }

  /**
   * Update lottery type configuration
   */
  async updateLotteryTypeConfig(lotteryTypeId, updates, adminId) {
    try {
      await validateAdminPermissions(adminId, 'manage_lotteries');

      const allowedUpdates = [
        'entryFee', 'platformFee', 'maxTicketsPerUser',
        'minParticipants', 'drawFrequency', 'scheduledTime',
        'isEnabled'
      ];

      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid updates provided');
      }

      filteredUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      filteredUpdates.updatedBy = adminId;

      await this.db.collection('lottery_types').doc(lotteryTypeId).update(filteredUpdates);

      // Log the change
      await this.logConfigChange('lottery_type_config', {
        lotteryTypeId,
        updates: filteredUpdates,
        adminId
      });

      logger.info(`Lottery type ${lotteryTypeId} updated by ${adminId}:`, filteredUpdates);
      
      return {
        success: true,
        lotteryTypeId,
        updates: filteredUpdates,
        message: 'Lottery type configuration updated successfully'
      };
    } catch (error) {
      logger.error(`Failed to update lottery type config for ${lotteryTypeId}:`, error);
      throw error;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache(key = null) {
    if (key) {
      this.configCache.delete(key);
    } else {
      this.configCache.clear();
    }
    logger.info('Configuration cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.configCache.size,
      entries: Array.from(this.configCache.keys()),
      timeout: this.cacheTimeout
    };
  }
}

module.exports = new ConfigManager();
