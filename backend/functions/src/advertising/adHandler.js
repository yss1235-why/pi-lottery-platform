const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const { ValidationError, RateLimitError } = require('../middleware/errorHandler');
const adNetworks = require('./adNetworks');
const adRewards = require('./adRewards');

/**
 * Advertisement handling and validation system
 */
class AdHandler {
  constructor() {
    this.db = admin.firestore();
    this.supportedNetworks = ['unity_ads', 'google_admob', 'facebook_audience'];
    this.minWatchDuration = 25; // seconds
    this.maxWatchDuration = 60; // seconds
    this.cooldownPeriod = 5 * 60 * 1000; // 5 minutes
    this.dailyAdLimit = 5;
  }

  /**
   * Validate ad completion
   */
  async validateAdCompletion(adCompletionData, userId) {
    try {
      const validation = {
        isValid: false,
        reason: null,
        rewardAmount: 0,
        cooldownRemaining: 0
      };

      // Validate required fields
      const requiredFields = ['adNetworkId', 'watchDuration', 'completedAt', 'adUnitId'];
      for (const field of requiredFields) {
        if (!adCompletionData[field]) {
          validation.reason = `Missing required field: ${field}`;
          return validation;
        }
      }

      // Validate ad network
      if (!this.supportedNetworks.includes(adCompletionData.adNetworkId)) {
        validation.reason = 'Unsupported ad network';
        return validation;
      }

      // Validate watch duration
      const watchDuration = parseInt(adCompletionData.watchDuration);
      if (watchDuration < this.minWatchDuration) {
        validation.reason = `Insufficient watch duration: ${watchDuration}s (minimum: ${this.minWatchDuration}s)`;
        return validation;
      }

      if (watchDuration > this.maxWatchDuration) {
        validation.reason = `Watch duration too long: ${watchDuration}s (maximum: ${this.maxWatchDuration}s)`;
        return validation;
      }

      // Check completion timestamp
      const completedAt = new Date(adCompletionData.completedAt);
      const now = new Date();
      const timeDiff = now - completedAt;

      // Ad completion should be recent (within 5 minutes)
      if (timeDiff > 5 * 60 * 1000 || timeDiff < 0) {
        validation.reason = 'Invalid completion timestamp';
        return validation;
      }

      // Check user cooldown
      const cooldownCheck = await this.checkUserCooldown(userId);
      if (!cooldownCheck.allowed) {
        validation.reason = 'User in cooldown period';
        validation.cooldownRemaining = cooldownCheck.remainingTime;
        return validation;
      }

      // Check daily ad limit
      const dailyLimitCheck = await this.checkDailyAdLimit(userId);
      if (!dailyLimitCheck.allowed) {
        validation.reason = `Daily ad limit reached (${this.dailyAdLimit} ads per day)`;
        return validation;
      }

      // Validate with ad network (if applicable)
      const networkValidation = await this.validateWithAdNetwork(adCompletionData);
      if (!networkValidation.isValid) {
        validation.reason = networkValidation.reason;
        return validation;
      }

      // Check for duplicate submissions
      const duplicateCheck = await this.checkDuplicateSubmission(userId, adCompletionData);
      if (duplicateCheck.isDuplicate) {
        validation.reason = 'Duplicate ad completion detected';
        return validation;
      }

      // Calculate reward amount
      validation.rewardAmount = await this.calculateAdReward(adCompletionData, userId);

      validation.isValid = true;
      validation.reason = 'Ad completion validated successfully';

      // Log successful validation
      await this.logAdCompletion(userId, adCompletionData, validation);

      return validation;
    } catch (error) {
      logger.error('Ad completion validation failed:', error);
      throw error;
    }
  }

  /**
   * Process ad reward for validated completion
   */
  async processAdReward(userId, lotteryTypeId) {
    try {
      // Get platform configuration
      const platformConfig = await this.getPlatformConfig();
      const adValue = platformConfig.adValue?.current || 0.001;

      // Record ad completion
      const completionId = await this.recordAdCompletion(userId, lotteryTypeId, adValue);

      // Update user cooldown
      await this.updateUserCooldown(userId);

      // Update daily ad count
      await this.updateDailyAdCount(userId);

      // Award lottery entry
      const entryResult = await adRewards.awardLotteryEntry(userId, lotteryTypeId, completionId);

      return {
        success: true,
        completionId,
        rewardAmount: adValue,
        lotteryEntry: entryResult,
        message: 'Ad reward processed successfully'
      };
    } catch (error) {
      logger.error('Ad reward processing failed:', error);
      throw error;
    }
  }

  /**
   * Check user cooldown status
   */
  async checkUserCooldown(userId) {
    try {
      const cooldownRef = this.db.collection('ad_cooldowns').doc(userId);
      const cooldownDoc = await cooldownRef.get();

      if (!cooldownDoc.exists) {
        return { allowed: true, remainingTime: 0 };
      }

      const cooldownData = cooldownDoc.data();
      const lastAdTime = cooldownData.lastAdCompletedAt?.toDate() || new Date(0);
      const now = new Date();
      const timeSinceLastAd = now - lastAdTime;

      if (timeSinceLastAd < this.cooldownPeriod) {
        const remainingTime = this.cooldownPeriod - timeSinceLastAd;
        return {
          allowed: false,
          remainingTime: Math.ceil(remainingTime / 1000), // seconds
          lastAdTime: lastAdTime.toISOString()
        };
      }

      return { allowed: true, remainingTime: 0 };
    } catch (error) {
      logger.error('Failed to check user cooldown:', error);
      throw error;
    }
  }

  /**
   * Check daily ad limit
   */
  async checkDailyAdLimit(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyCountRef = this.db.collection('daily_ad_counts').doc(`${userId}_${today}`);
      const dailyCountDoc = await dailyCountRef.get();

      if (!dailyCountDoc.exists) {
        return { allowed: true, adsWatched: 0, limit: this.dailyAdLimit };
      }

      const dailyData = dailyCountDoc.data();
      const adsWatched = dailyData.count || 0;

      return {
        allowed: adsWatched < this.dailyAdLimit,
        adsWatched,
        limit: this.dailyAdLimit,
        remainingAds: Math.max(0, this.dailyAdLimit - adsWatched)
      };
    } catch (error) {
      logger.error('Failed to check daily ad limit:', error);
      throw error;
    }
  }

  /**
   * Validate with ad network
   */
  async validateWithAdNetwork(adCompletionData) {
    try {
      const networkId = adCompletionData.adNetworkId;
      const networkHandler = adNetworks.getNetworkHandler(networkId);

      if (!networkHandler) {
        return {
          isValid: false,
          reason: 'Ad network handler not available'
        };
      }

      // Validate with specific ad network
      const validation = await networkHandler.validateCompletion(adCompletionData);
      return validation;
    } catch (error) {
      logger.error('Ad network validation failed:', error);
      return {
        isValid: false,
        reason: 'Ad network validation error'
      };
    }
  }

  /**
   * Check for duplicate ad submission
   */
  async checkDuplicateSubmission(userId, adCompletionData) {
    try {
      const adId = adCompletionData.adUnitId;
      const completedAt = new Date(adCompletionData.completedAt);
      
      // Check for submissions within the last hour with same ad unit ID
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const duplicateQuery = this.db.collection('ad_completions')
        .where('userId', '==', userId)
        .where('adUnitId', '==', adId)
        .where('completedAt', '>=', hourAgo)
        .limit(1);

      const duplicateSnapshot = await duplicateQuery.get();
      
      return {
        isDuplicate: !duplicateSnapshot.empty,
        existingCompletions: duplicateSnapshot.size
      };
    } catch (error) {
      logger.error('Failed to check duplicate submission:', error);
      return { isDuplicate: false };
    }
  }

  /**
   * Calculate ad reward amount
   */
  async calculateAdReward(adCompletionData, userId) {
    try {
      const platformConfig = await this.getPlatformConfig();
      let baseReward = platformConfig.adValue?.current || 0.001;

      // Apply multipliers based on various factors
      let multiplier = 1.0;

      // Watch duration bonus (for watching full ad)
      const watchDuration = parseInt(adCompletionData.watchDuration);
      if (watchDuration >= 30) {
        multiplier += 0.1; // 10% bonus for full watch
      }

      // Network-specific multipliers
      const networkMultipliers = {
        unity_ads: 1.0,
        google_admob: 1.05,
        facebook_audience: 0.95
      };

      const networkMultiplier = networkMultipliers[adCompletionData.adNetworkId] || 1.0;
      multiplier *= networkMultiplier;

      // User loyalty bonus (for regular users)
      const userBonus = await this.getUserLoyaltyBonus(userId);
      multiplier += userBonus;

      const finalReward = baseReward * multiplier;
      return parseFloat(finalReward.toFixed(6));
    } catch (error) {
      logger.error('Failed to calculate ad reward:', error);
      return 0.001; // Default reward
    }
  }

  /**
   * Get user loyalty bonus
   */
  async getUserLoyaltyBonus(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) return 0;

      const userData = userDoc.data();
      const totalEntries = userData.totalEntries || 0;

      // Loyalty bonus based on total entries
      if (totalEntries >= 100) return 0.2; // 20% bonus
      if (totalEntries >= 50) return 0.15; // 15% bonus
      if (totalEntries >= 20) return 0.1; // 10% bonus
      if (totalEntries >= 10) return 0.05; // 5% bonus

      return 0;
    } catch (error) {
      logger.error('Failed to get user loyalty bonus:', error);
      return 0;
    }
  }

  /**
   * Record ad completion
   */
  async recordAdCompletion(userId, lotteryTypeId, rewardAmount) {
    try {
      const completionId = `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.collection('ad_completions').doc(completionId).set({
        userId,
        lotteryTypeId,
        rewardAmount,
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return completionId;
    } catch (error) {
      logger.error('Failed to record ad completion:', error);
      throw error;
    }
  }

  /**
   * Update user cooldown
   */
  async updateUserCooldown(userId) {
    try {
      const cooldownRef = this.db.collection('ad_cooldowns').doc(userId);
      
      await cooldownRef.set({
        userId,
        lastAdCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to update user cooldown:', error);
    }
  }

  /**
   * Update daily ad count
   */
  async updateDailyAdCount(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyCountRef = this.db.collection('daily_ad_counts').doc(`${userId}_${today}`);
      
      const dailyCountDoc = await dailyCountRef.get();
      
      if (dailyCountDoc.exists) {
        await dailyCountRef.update({
          count: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await dailyCountRef.set({
          userId,
          date: today,
          count: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      logger.error('Failed to update daily ad count:', error);
    }
  }

  /**
   * Log ad completion for analytics
   */
  async logAdCompletion(userId, adCompletionData, validation) {
    try {
      await this.db.collection('ad_analytics').add({
        userId,
        adNetworkId: adCompletionData.adNetworkId,
        adUnitId: adCompletionData.adUnitId,
        watchDuration: adCompletionData.watchDuration,
        rewardAmount: validation.rewardAmount,
        validationResult: validation.isValid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log ad completion:', error);
    }
  }

  /**
   * Get platform configuration
   */
  async getPlatformConfig() {
    try {
      const configDoc = await this.db.collection('system_config').doc('platform').get();
      return configDoc.exists ? configDoc.data() : {};
    } catch (error) {
      logger.error('Failed to get platform config:', error);
      return {};
    }
  }

  /**
   * Get ad statistics for user
   */
  async getUserAdStatistics(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's ad count
      const dailyCountDoc = await this.db.collection('daily_ad_counts').doc(`${userId}_${today}`).get();
      const adsWatchedToday = dailyCountDoc.exists ? dailyCountDoc.data().count || 0 : 0;

      // Get total ad completions
      const totalCompletionsSnapshot = await this.db.collection('ad_completions')
        .where('userId', '==', userId)
        .get();

      // Get cooldown status
      const cooldownStatus = await this.checkUserCooldown(userId);

      return {
        adsWatchedToday,
        dailyLimit: this.dailyAdLimit,
        remainingAds: Math.max(0, this.dailyAdLimit - adsWatchedToday),
        totalAdsWatched: totalCompletionsSnapshot.size,
        cooldownStatus,
        canWatchAd: cooldownStatus.allowed && adsWatchedToday < this.dailyAdLimit
      };
    } catch (error) {
      logger.error('Failed to get user ad statistics:', error);
      throw error;
    }
  }

  /**
   * Get ad analytics for admin
   */
  async getAdAnalytics(timeRange = 24) {
    try {
      const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
      
      const analyticsSnapshot = await this.db.collection('ad_analytics')
        .where('timestamp', '>=', startTime)
        .get();

      const analytics = {
        totalAds: 0,
        byNetwork: {},
        totalRewards: 0,
        averageWatchDuration: 0,
        validationRate: 0
      };

      let totalWatchDuration = 0;
      let validCompletions = 0;

      analyticsSnapshot.forEach(doc => {
        const data = doc.data();
        analytics.totalAds++;
        
        // Count by network
        const network = data.adNetworkId || 'unknown';
        analytics.byNetwork[network] = (analytics.byNetwork[network] || 0) + 1;
        
        // Sum rewards
        analytics.totalRewards += data.rewardAmount || 0;
        
        // Sum watch duration
        totalWatchDuration += data.watchDuration || 0;
        
        // Count valid completions
        if (data.validationResult) validCompletions++;
      });

      if (analytics.totalAds > 0) {
        analytics.averageWatchDuration = parseFloat((totalWatchDuration / analytics.totalAds).toFixed(2));
        analytics.validationRate = parseFloat(((validCompletions / analytics.totalAds) * 100).toFixed(2));
      }

      analytics.totalRewards = parseFloat(analytics.totalRewards.toFixed(6));

      return analytics;
    } catch (error) {
      logger.error('Failed to get ad analytics:', error);
      throw error;
    }
  }

  /**
   * Clean up old ad data
   */
  async cleanupOldAdData() {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Clean up old daily counts
      const oldCountsSnapshot = await this.db.collection('daily_ad_counts')
        .where('createdAt', '<', cutoffDate)
        .limit(1000)
        .get();

      const batch = this.db.batch();
      let deletedCount = 0;

      oldCountsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return { deletedRecords: deletedCount };
    } catch (error) {
      logger.error('Failed to cleanup old ad data:', error);
      throw error;
    }
  }
}

module.exports = new AdHandler();
