const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * Advertisement reward system
 */
class AdRewards {
  constructor() {
    this.db = admin.firestore();
    this.rewardTiers = {
      bronze: { minAds: 0, multiplier: 1.0 },
      silver: { minAds: 50, multiplier: 1.1 },
      gold: { minAds: 100, multiplier: 1.2 },
      platinum: { minAds: 200, multiplier: 1.3 }
    };
  }

  /**
   * Award lottery entry for completed ad
   */
  async awardLotteryEntry(userId, lotteryTypeId, adCompletionId) {
    try {
      // Get or create current lottery instance
      const lotteryInstance = await this.getCurrentLotteryInstance(lotteryTypeId);
      
      if (!lotteryInstance) {
        throw new Error(`No active lottery instance for ${lotteryTypeId}`);
      }

      // Create lottery entry
      const entryId = `${userId}_${lotteryTypeId}_${Date.now()}`;
      const entryData = {
        lotteryInstanceId: lotteryInstance.id,
        userId,
        lotteryTypeId,
        entryMethod: 'watch_ads',
        ticketCount: 1,
        adCompletionId,
        status: 'confirmed',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('user_entries').doc(entryId).set(entryData);

      // Update lottery instance
      await this.updateLotteryInstance(lotteryInstance.id, lotteryTypeId);

      // Update user ad statistics
      await this.updateUserAdStats(userId, lotteryTypeId);

      // Check for tier progression
      await this.checkTierProgression(userId);

      logger.info(`Lottery entry awarded: ${entryId} for user ${userId}`);

      return {
        success: true,
        entryId,
        lotteryInstanceId: lotteryInstance.id,
        message: 'Lottery entry awarded successfully'
      };
    } catch (error) {
      logger.error('Failed to award lottery entry:', error);
      throw error;
    }
  }

  /**
   * Get current lottery instance for type
   */
  async getCurrentLotteryInstance(lotteryTypeId) {
    try {
      const instancesSnapshot = await this.db.collection('lottery_instances')
        .where('lotteryTypeId', '==', lotteryTypeId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (instancesSnapshot.empty) {
        // Create new instance if none exists
        return await this.createLotteryInstance(lotteryTypeId);
      }

      const instanceDoc = instancesSnapshot.docs[0];
      return {
        id: instanceDoc.id,
        ...instanceDoc.data()
      };
    } catch (error) {
      logger.error('Failed to get current lottery instance:', error);
      throw error;
    }
  }

  /**
   * Create new lottery instance
   */
  async createLotteryInstance(lotteryTypeId) {
    try {
      const lotteryTypeDoc = await this.db.collection('lottery_types').doc(lotteryTypeId).get();
      
      if (!lotteryTypeDoc.exists) {
        throw new Error(`Lottery type ${lotteryTypeId} not found`);
      }

      const lotteryType = lotteryTypeDoc.data();
      const instanceId = `${lotteryTypeId}_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}`;
      
      const instanceData = {
        lotteryTypeId,
        status: 'active',
        participants: 0,
        prizePool: 0,
        scheduledDrawTime: this.calculateNextDrawTime(lotteryType),
        actualDrawTime: null,
        extensionCount: 0,
        winners: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('lottery_instances').doc(instanceId).set(instanceData);

      return {
        id: instanceId,
        ...instanceData
      };
    } catch (error) {
      logger.error('Failed to create lottery instance:', error);
      throw error;
    }
  }

  /**
   * Update lottery instance with new participant
   */
  async updateLotteryInstance(instanceId, lotteryTypeId) {
    try {
      const instanceRef = this.db.collection('lottery_instances').doc(instanceId);
      
      return await this.db.runTransaction(async (transaction) => {
        const instanceDoc = await transaction.get(instanceRef);
        
        if (!instanceDoc.exists) {
          throw new Error('Lottery instance not found');
        }

        const currentData = instanceDoc.data();
        const newParticipants = (currentData.participants || 0) + 1;
        
        // Calculate new prize pool (for ad lottery, prize pool = participants * ad value)
        const adValue = await this.getAdValue();
        const newPrizePool = newParticipants * adValue;

        transaction.update(instanceRef, {
          participants: newParticipants,
          prizePool: parseFloat(newPrizePool.toFixed(6)),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          participants: newParticipants,
          prizePool: newPrizePool
        };
      });
    } catch (error) {
      logger.error('Failed to update lottery instance:', error);
      throw error;
    }
  }

  /**
   * Get current ad value from platform config
   */
  async getAdValue() {
    try {
      const configDoc = await this.db.collection('system_config').doc('platform').get();
      
      if (configDoc.exists) {
        const config = configDoc.data();
        return config.adValue?.current || 0.001;
      }
      
      return 0.001; // Default ad value
    } catch (error) {
      logger.error('Failed to get ad value:', error);
      return 0.001;
    }
  }

  /**
   * Update user ad statistics
   */
  async updateUserAdStats(userId, lotteryTypeId) {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await this.db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        const updates = {
          totalEntries: (userData.totalEntries || 0) + 1,
          [`${lotteryTypeId}_entries`]: ((userData[`${lotteryTypeId}_entries`] || 0) + 1),
          totalAdsWatched: (userData.totalAdsWatched || 0) + 1,
          lastAdReward: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        transaction.update(userRef, updates);
      });
    } catch (error) {
      logger.error('Failed to update user ad stats:', error);
    }
  }

  /**
   * Check and update user tier progression
   */
  async checkTierProgression(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      const totalAdsWatched = userData.totalAdsWatched || 0;
      const currentTier = userData.adRewardTier || 'bronze';

      // Determine new tier
      let newTier = 'bronze';
      if (totalAdsWatched >= this.rewardTiers.platinum.minAds) {
        newTier = 'platinum';
      } else if (totalAdsWatched >= this.rewardTiers.gold.minAds) {
        newTier = 'gold';
      } else if (totalAdsWatched >= this.rewardTiers.silver.minAds) {
        newTier = 'silver';
      }

      // Update tier if changed
      if (newTier !== currentTier) {
        await this.db.collection('users').doc(userId).update({
          adRewardTier: newTier,
          tierUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log tier progression
        await this.logTierProgression(userId, currentTier, newTier, totalAdsWatched);

        logger.info(`User ${userId} progressed from ${currentTier} to ${newTier} tier`);
      }
    } catch (error) {
      logger.error('Failed to check tier progression:', error);
    }
  }

  /**
   * Log tier progression for analytics
   */
  async logTierProgression(userId, oldTier, newTier, totalAdsWatched) {
    try {
      await this.db.collection('tier_progressions').add({
        userId,
        oldTier,
        newTier,
        totalAdsWatched,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log tier progression:', error);
    }
  }

  /**
   * Calculate reward multiplier for user
   */
  async calculateRewardMultiplier(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) return 1.0;

      const userData = userDoc.data();
      const userTier = userData.adRewardTier || 'bronze';
      
      return this.rewardTiers[userTier]?.multiplier || 1.0;
    } catch (error) {
      logger.error('Failed to calculate reward multiplier:', error);
      return 1.0;
    }
  }

  /**
   * Get user reward statistics
   */
  async getUserRewardStats(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return {
          totalAdsWatched: 0,
          totalEntries: 0,
          currentTier: 'bronze',
          multiplier: 1.0,
          nextTier: 'silver',
          adsToNextTier: 50
        };
      }

      const userData = userDoc.data();
      const totalAdsWatched = userData.totalAdsWatched || 0;
      const currentTier = userData.adRewardTier || 'bronze';
      const multiplier = this.rewardTiers[currentTier]?.multiplier || 1.0;

      // Calculate next tier info
      let nextTier = null;
      let adsToNextTier = 0;

      const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
      const currentTierIndex = tierOrder.indexOf(currentTier);

      if (currentTierIndex < tierOrder.length - 1) {
        nextTier = tierOrder[currentTierIndex + 1];
        adsToNextTier = this.rewardTiers[nextTier].minAds - totalAdsWatched;
      }

      return {
        totalAdsWatched,
        totalEntries: userData.totalEntries || 0,
        currentTier,
        multiplier,
        nextTier,
        adsToNextTier: Math.max(0, adsToNextTier),
        tierProgressPercentage: this.calculateTierProgress(totalAdsWatched, currentTier)
      };
    } catch (error) {
      logger.error('Failed to get user reward stats:', error);
      throw error;
    }
  }

  /**
   * Calculate tier progress percentage
   */
  calculateTierProgress(totalAdsWatched, currentTier) {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const currentTierIndex = tierOrder.indexOf(currentTier);

    if (currentTierIndex === tierOrder.length - 1) {
      return 100; // Max tier reached
    }

    const currentTierMin = this.rewardTiers[currentTier].minAds;
    const nextTierMin = this.rewardTiers[tierOrder[currentTierIndex + 1]].minAds;
    
    const progress = (totalAdsWatched - currentTierMin) / (nextTierMin - currentTierMin);
    return Math.min(100, Math.max(0, Math.round(progress * 100)));
  }

  /**
   * Get ad reward leaderboard
   */
  async getAdRewardLeaderboard(limit = 10) {
    try {
      const usersSnapshot = await this.db.collection('users')
        .orderBy('totalAdsWatched', 'desc')
        .limit(limit)
        .get();

      const leaderboard = [];
      let rank = 1;

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        leaderboard.push({
          rank,
          userId: doc.id,
          username: userData.piUsername || 'Anonymous',
          totalAdsWatched: userData.totalAdsWatched || 0,
          tier: userData.adRewardTier || 'bronze',
          totalEntries: userData.totalEntries || 0
        });
        rank++;
      });

      return leaderboard;
    } catch (error) {
      logger.error('Failed to get ad reward leaderboard:', error);
      throw error;
    }
  }

  /**
   * Calculate next draw time for lottery type
   */
  calculateNextDrawTime(lotteryType) {
    const now = new Date();
    const drawTime = new Date(now);
    
    switch (lotteryType.scheduledTime) {
      case '21:00':
        drawTime.setHours(21, 0, 0, 0);
        if (drawTime <= now) {
          drawTime.setDate(drawTime.getDate() + 1);
        }
        break;
      default:
        drawTime.setHours(drawTime.getHours() + 24);
    }
    
    return drawTime;
  }

  /**
   * Process reward bonus events
   */
  async processBonusEvent(eventType, userId, bonusData = {}) {
    try {
      let bonusMultiplier = 1.0;
      let bonusDescription = '';

      switch (eventType) {
        case 'daily_streak':
          bonusMultiplier = 1.2;
          bonusDescription = 'Daily streak bonus';
          break;
        case 'weekend_bonus':
          bonusMultiplier = 1.5;
          bonusDescription = 'Weekend bonus';
          break;
        case 'special_event':
          bonusMultiplier = bonusData.multiplier || 2.0;
          bonusDescription = bonusData.description || 'Special event bonus';
          break;
        default:
          return { success: false, reason: 'Unknown bonus event type' };
      }

      // Record bonus event
      await this.db.collection('bonus_events').add({
        userId,
        eventType,
        bonusMultiplier,
        bonusDescription,
        bonusData,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { 
        success: true, 
        bonusMultiplier, 
        bonusDescription 
      };
    } catch (error) {
      logger.error('Failed to process bonus event:', error);
      throw error;
    }
  }

  /**
   * Get ad reward analytics
   */
  async getAdRewardAnalytics(timeRange = 24) {
    try {
      const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

      // Get ad completions in time range
      const completionsSnapshot = await this.db.collection('ad_completions')
        .where('completedAt', '>=', startTime)
        .get();

      // Get tier progressions
      const progressionsSnapshot = await this.db.collection('tier_progressions')
        .where('timestamp', '>=', startTime)
        .get();

      const analytics = {
        totalRewards: completionsSnapshot.size,
        totalRewardValue: 0,
        tierProgressions: progressionsSnapshot.size,
        averageRewardValue: 0,
        tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
        topUsers: []
      };

      // Calculate reward values
      completionsSnapshot.forEach(doc => {
        const completion = doc.data();
        analytics.totalRewardValue += completion.rewardAmount || 0;
      });

      if (analytics.totalRewards > 0) {
        analytics.averageRewardValue = analytics.totalRewardValue / analytics.totalRewards;
      }

      // Get tier distribution
      const usersSnapshot = await this.db.collection('users')
        .where('totalAdsWatched', '>', 0)
        .get();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const tier = userData.adRewardTier || 'bronze';
        analytics.tierDistribution[tier]++;
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get ad reward analytics:', error);
      throw error;
    }
  }

  /**
   * Clean up old reward data
   */
  async cleanupOldRewardData() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      // Clean up old bonus events
      const oldBonusSnapshot = await this.db.collection('bonus_events')
        .where('timestamp', '<', cutoffDate)
        .limit(1000)
        .get();

      const batch = this.db.batch();
      let deletedCount = 0;

      oldBonusSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return { deletedBonusEvents: deletedCount };
    } catch (error) {
      logger.error('Failed to cleanup old reward data:', error);
      throw error;
    }
  }
}

module.exports = new AdRewards();
