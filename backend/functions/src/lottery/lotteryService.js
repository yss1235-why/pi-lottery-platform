const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { ValidationError, LotteryError } = require('../middleware/errorHandler');
const { validateUserIntegrity, checkRateLimit } = require('../middleware/auth');

/**
 * Core lottery service for managing lottery operations
 */
class LotteryService {
  constructor() {
    this.db = admin.firestore();
    this.lotteryTypes = {
      daily_pi: {
        name: 'Daily Pi Lottery',
        entryFee: 1.0,
        platformFee: 0.1,
        maxTicketsPerUser: 3,
        minParticipants: 5,
        drawFrequency: 24,
        scheduledTime: '20:00',
        isEnabled: true
      },
      daily_ads: {
        name: 'Daily Ads Lottery',
        entryFee: 0,
        adValue: 0.001,
        maxTicketsPerUser: 5,
        minParticipants: 10,
        drawFrequency: 24,
        scheduledTime: '21:00',
        isEnabled: true
      },
      weekly_pi: {
        name: 'Weekly Pi Lottery',
        entryFee: 1.0,
        platformFee: 0.1,
        maxTicketsPerUser: 10,
        minParticipants: 20,
        drawFrequency: 168,
        scheduledTime: 'sunday_18:00',
        isEnabled: true
      },
      monthly_pi: {
        name: 'Monthly Pi Lottery',
        entryFee: 1.0,
        platformFee: 0.1,
        maxTicketsPerUser: 25,
        minParticipants: 30,
        drawFrequency: 720,
        scheduledTime: 'last_day_21:00',
        isEnabled: false
      }
    };
  }

  /**
   * Initialize lottery types in database
   */
  async initializeLotteryTypes() {
    try {
      const batch = this.db.batch();
      
      for (const [typeId, config] of Object.entries(this.lotteryTypes)) {
        const typeRef = this.db.collection('lottery_types').doc(typeId);
        batch.set(typeRef, {
          ...config,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      logger.info('Lottery types initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize lottery types:', error);
      throw error;
    }
  }

  /**
   * Get all lottery types
   */
  async getLotteryTypes() {
    try {
      const snapshot = await this.db.collection('lottery_types').get();
      
      if (snapshot.empty) {
        await this.initializeLotteryTypes();
        return { ...this.lotteryTypes };
      }

      const types = {};
      snapshot.forEach(doc => {
        types[doc.id] = { id: doc.id, ...doc.data() };
      });

      return types;
    } catch (error) {
      logger.error('Failed to get lottery types:', error);
      throw error;
    }
  }

  /**
   * Get active lottery instances
   */
  async getActiveLotteryInstances() {
    try {
      const snapshot = await this.db.collection('lottery_instances')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .get();

      const instances = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        instances[data.lotteryTypeId] = { id: doc.id, ...data };
      });

      return instances;
    } catch (error) {
      logger.error('Failed to get active lottery instances:', error);
      throw error;
    }
  }

  /**
   * Create new lottery instance
   */
  async createLotteryInstance(lotteryTypeId) {
    try {
      const lotteryType = await this.getLotteryType(lotteryTypeId);
      if (!lotteryType || !lotteryType.isEnabled) {
        throw new LotteryError(`Lottery type ${lotteryTypeId} is not available`);
      }

      const instanceId = this.generateInstanceId(lotteryTypeId);
      const scheduledDrawTime = this.calculateNextDrawTime(lotteryType);

      const instanceData = {
        lotteryTypeId,
        status: 'active',
        participants: 0,
        prizePool: 0,
        scheduledDrawTime,
        actualDrawTime: null,
        extensionCount: 0,
        winners: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('lottery_instances').doc(instanceId).set(instanceData);

      logger.info(`Created lottery instance: ${instanceId}`);
      return { id: instanceId, ...instanceData };
    } catch (error) {
      logger.error('Failed to create lottery instance:', error);
      throw error;
    }
  }

  /**
   * Generate unique instance ID
   */
  generateInstanceId(lotteryTypeId) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '_');
    const timeStr = date.getHours().toString().padStart(2, '0');
    const randomStr = Math.random().toString(36).substr(2, 4);
    
    return `${lotteryTypeId}_${dateStr}_${timeStr}_${randomStr}`;
  }

  /**
   * Enter lottery
   */
  async enterLottery(lotteryTypeId, userId, entryMethod, ticketCount = 1, paymentData = null) {
    try {
      // Validate user integrity
      await validateUserIntegrity(userId, 'lottery_entry');

      // Check rate limiting
      await checkRateLimit(userId, 'lottery_entry', 60000, 5); // 5 entries per minute

      // Validate lottery type
      const lotteryType = await this.getLotteryType(lotteryTypeId);
      if (!lotteryType || !lotteryType.isEnabled) {
        throw new ValidationError(`Lottery type ${lotteryTypeId} is not available`);
      }

      // Validate ticket count
      if (ticketCount < 1 || ticketCount > lotteryType.maxTicketsPerUser) {
        throw new ValidationError(`Invalid ticket count: ${ticketCount}`);
      }

      // Check user ticket limits
      const canEnter = await this.validateUserTicketLimits(lotteryTypeId, userId, ticketCount);
      if (!canEnter.allowed) {
        throw new ValidationError(canEnter.reason);
      }

      // Validate entry method
      await this.validateEntryMethod(lotteryTypeId, entryMethod, paymentData);

      // Get or create lottery instance
      let instance = await this.getCurrentLotteryInstance(lotteryTypeId);
      if (!instance) {
        instance = await this.createLotteryInstance(lotteryTypeId);
      }

      // Create lottery entry
      const entryId = uuidv4();
      const entryData = {
        lotteryInstanceId: instance.id,
        userId,
        lotteryTypeId,
        entryMethod,
        ticketCount,
        paymentId: paymentData?.paymentId || null,
        adCompletionId: paymentData?.adCompletionId || null,
        status: 'confirmed',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Execute entry transaction
      const result = await this.db.runTransaction(async (transaction) => {
        // Create entry
        const entryRef = this.db.collection('user_entries').doc(entryId);
        transaction.set(entryRef, entryData);

        // Update lottery instance
        const instanceRef = this.db.collection('lottery_instances').doc(instance.id);
        const instanceDoc = await transaction.get(instanceRef);
        
        if (!instanceDoc.exists) {
          throw new LotteryError('Lottery instance not found');
        }

        const currentData = instanceDoc.data();
        const newParticipants = (currentData.participants || 0) + ticketCount;
        const newPrizePool = this.calculatePrizePool(lotteryTypeId, newParticipants);

        transaction.update(instanceRef, {
          participants: newParticipants,
          prizePool: newPrizePool,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update user ticket limits
        await this.updateUserTicketLimits(lotteryTypeId, userId, ticketCount, transaction);

        return {
          entryId,
          instanceId: instance.id,
          newParticipants,
          newPrizePool
        };
      });

      // Update user statistics
      await this.updateUserStats(userId, lotteryTypeId, ticketCount);

      logger.info(`Lottery entry created: ${entryId} for user ${userId}`);

      return {
        success: true,
        ...result,
        message: 'Lottery entry successful'
      };
    } catch (error) {
      logger.error('Lottery entry failed:', error);
      throw error;
    }
  }

  /**
   * Validate entry method
   */
  async validateEntryMethod(lotteryTypeId, entryMethod, paymentData) {
    switch (entryMethod) {
      case 'pi_payment':
        if (lotteryTypeId === 'daily_ads') {
          throw new ValidationError('Pi payment not allowed for ads lottery');
        }
        if (!paymentData?.paymentId) {
          throw new ValidationError('Payment ID required for Pi payment entry');
        }
        break;
        
      case 'watch_ads':
        if (lotteryTypeId !== 'daily_ads') {
          throw new ValidationError('Ad watching only allowed for ads lottery');
        }
        if (!paymentData?.adCompletionId) {
          throw new ValidationError('Ad completion ID required for ad entry');
        }
        break;
        
      default:
        throw new ValidationError(`Invalid entry method: ${entryMethod}`);
    }
  }

  /**
   * Process payment entry
   */
  async processPaymentEntry(lotteryTypeId, userId, transactionId) {
    try {
      // Find pending entry
      const entriesSnapshot = await this.db.collection('user_entries')
        .where('userId', '==', userId)
        .where('lotteryTypeId', '==', lotteryTypeId)
        .where('status', '==', 'pending_payment')
        .limit(1)
        .get();

      if (entriesSnapshot.empty) {
        throw new LotteryError('No pending payment entry found');
      }

      const entryDoc = entriesSnapshot.docs[0];
      
      // Update entry status
      await entryDoc.ref.update({
        status: 'confirmed',
        transactionId,
        confirmedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Payment entry processed: ${entryDoc.id} with transaction ${transactionId}`);

      return {
        success: true,
        entryId: entryDoc.id,
        transactionId
      };
    } catch (error) {
      logger.error('Failed to process payment entry:', error);
      throw error;
    }
  }

  /**
   * Validate user ticket limits
   */
  async validateUserTicketLimits(lotteryTypeId, userId, requestedTickets) {
    try {
      const lotteryType = await this.getLotteryType(lotteryTypeId);
      const maxTickets = lotteryType.maxTicketsPerUser;
      
      // Get current period limits
      const limitsPeriod = this.getLimitsPeriod(lotteryTypeId);
      const limitsDoc = await this.db.collection('user_ticket_limits')
        .doc(`${userId}_${limitsPeriod}`)
        .get();

      let usedTickets = 0;
      if (limitsDoc.exists) {
        const data = limitsDoc.data();
        usedTickets = data[`${lotteryTypeId}_used`] || 0;
      }

      if (usedTickets + requestedTickets > maxTickets) {
        return {
          allowed: false,
          reason: `Ticket limit exceeded. Max ${maxTickets} tickets per ${this.getLimitsPeriodName(lotteryTypeId)}, you have used ${usedTickets}.`,
          usedTickets,
          maxTickets,
          remainingTickets: Math.max(0, maxTickets - usedTickets)
        };
      }

      return {
        allowed: true,
        usedTickets,
        maxTickets,
        remainingTickets: maxTickets - usedTickets - requestedTickets
      };
    } catch (error) {
      logger.error('Failed to validate ticket limits:', error);
      return {
        allowed: false,
        reason: 'Unable to validate ticket limits'
      };
    }
  }

  /**
   * Update user ticket limits
   */
  async updateUserTicketLimits(lotteryTypeId, userId, ticketCount, transaction = null) {
    try {
      const limitsPeriod = this.getLimitsPeriod(lotteryTypeId);
      const limitsRef = this.db.collection('user_ticket_limits').doc(`${userId}_${limitsPeriod}`);
      
      const updateData = {
        userId,
        period: limitsPeriod,
        [`${lotteryTypeId}_used`]: admin.firestore.FieldValue.increment(ticketCount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (transaction) {
        const limitsDoc = await transaction.get(limitsRef);
        if (limitsDoc.exists) {
          transaction.update(limitsRef, updateData);
        } else {
          transaction.set(limitsRef, {
            ...updateData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        await limitsRef.set(updateData, { merge: true });
      }
    } catch (error) {
      logger.error('Failed to update user ticket limits:', error);
      throw error;
    }
  }

  /**
   * Get limits period based on lottery type
   */
  getLimitsPeriod(lotteryTypeId) {
    const now = new Date();
    
    switch (lotteryTypeId) {
      case 'daily_pi':
      case 'daily_ads':
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
        
      case 'weekly_pi':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        return `${weekStart.getFullYear()}_W${this.getWeekNumber(weekStart)}`;
        
      case 'monthly_pi':
        return `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        
      default:
        return now.toISOString().split('T')[0];
    }
  }

  /**
   * Get limits period name for user display
   */
  getLimitsPeriodName(lotteryTypeId) {
    switch (lotteryTypeId) {
      case 'daily_pi':
      case 'daily_ads':
        return 'day';
      case 'weekly_pi':
        return 'week';
      case 'monthly_pi':
        return 'month';
      default:
        return 'period';
    }
  }

  /**
   * Get week number
   */
  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Calculate prize pool
   */
  calculatePrizePool(lotteryTypeId, participants) {
    const lotteryType = this.lotteryTypes[lotteryTypeId];
    if (!lotteryType) return 0;

    if (lotteryTypeId === 'daily_ads') {
      return participants * (lotteryType.adValue || 0.001);
    } else {
      return participants * (lotteryType.entryFee - lotteryType.platformFee);
    }
  }

  /**
   * Get current lottery instance
   */
  async getCurrentLotteryInstance(lotteryTypeId) {
    try {
      const snapshot = await this.db.collection('lottery_instances')
        .where('lotteryTypeId', '==', lotteryTypeId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Failed to get current lottery instance:', error);
      throw error;
    }
  }

  /**
   * Get lottery type
   */
  async getLotteryType(typeId) {
    try {
      const doc = await this.db.collection('lottery_types').doc(typeId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      logger.error(`Failed to get lottery type ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * Update user statistics
   */
  async updateUserStats(userId, lotteryTypeId, ticketCount) {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.update({
        totalEntries: admin.firestore.FieldValue.increment(ticketCount),
        [`${lotteryTypeId}_entries`]: admin.firestore.FieldValue.increment(ticketCount),
        lastLotteryEntry: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to update user stats:', error);
    }
  }

  /**
   * Get user lottery statistics
   */
  async getUserLotteryStats(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return {
          totalEntries: 0,
          totalWinnings: 0,
          lotteriesWon: 0,
          winRate: 0,
          entriesByType: {}
        };
      }

      const userData = userDoc.data();
      
      return {
        totalEntries: userData.totalEntries || 0,
        totalWinnings: userData.totalWinnings || 0,
        lotteriesWon: userData.lotteriesWon || 0,
        winRate: userData.winRate || 0,
        entriesByType: {
          daily_pi: userData.daily_pi_entries || 0,
          daily_ads: userData.daily_ads_entries || 0,
          weekly_pi: userData.weekly_pi_entries || 0,
          monthly_pi: userData.monthly_pi_entries || 0
        }
      };
    } catch (error) {
      logger.error('Failed to get user lottery stats:', error);
      throw error;
    }
  }

  /**
   * Get recent winners
   */
  async getRecentWinners(limit = 10) {
    try {
      const snapshot = await this.db.collection('lottery_winners')
        .where('status', '==', 'transferred')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const winners = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        winners.push({
          id: doc.id,
          username: data.username,
          lotteryInstanceId: data.lotteryInstanceId,
          position: data.position,
          prizeAmount: data.prizeAmount,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null
        });
      });

      return winners;
    } catch (error) {
      logger.error('Failed to get recent winners:', error);
      throw error;
    }
  }

  /**
   * Calculate next draw time
   */
  calculateNextDrawTime(lotteryType) {
    const now = new Date();
    const drawTime = new Date(now);
    
    switch (lotteryType.scheduledTime) {
      case '20:00':
        drawTime.setHours(20, 0, 0, 0);
        if (drawTime <= now) {
          drawTime.setDate(drawTime.getDate() + 1);
        }
        break;
        
      case '21:00':
        drawTime.setHours(21, 0, 0, 0);
        if (drawTime <= now) {
          drawTime.setDate(drawTime.getDate() + 1);
        }
        break;
        
      case 'sunday_18:00':
        const daysUntilSunday = (7 - drawTime.getDay()) % 7;
        drawTime.setDate(drawTime.getDate() + (daysUntilSunday || 7));
        drawTime.setHours(18, 0, 0, 0);
        break;
        
      case 'last_day_21:00':
        drawTime.setMonth(drawTime.getMonth() + 1, 0);
        drawTime.setHours(21, 0, 0, 0);
        break;
        
      default:
        drawTime.setHours(drawTime.getHours() + 24);
    }
    
    return drawTime;
  }

  /**
   * Get lottery performance statistics
   */
  async getLotteryPerformanceStats(timeRange = 30) {
    try {
      const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const instancesSnapshot = await this.db.collection('lottery_instances')
        .where('createdAt', '>=', startDate)
        .get();

      const stats = {
        totalLotteries: 0,
        completedLotteries: 0,
        cancelledLotteries: 0,
        totalParticipants: 0,
        totalPrizePool: 0,
        averageParticipants: 0,
        averagePrizePool: 0,
        byType: {}
      };

      instancesSnapshot.forEach(doc => {
        const data = doc.data();
        const lotteryType = data.lotteryTypeId;
        
        stats.totalLotteries++;
        stats.totalParticipants += data.participants || 0;
        stats.totalPrizePool += data.prizePool || 0;
        
        if (data.status === 'completed') {
          stats.completedLotteries++;
        } else if (data.status === 'cancelled') {
          stats.cancelledLotteries++;
        }

        if (!stats.byType[lotteryType]) {
          stats.byType[lotteryType] = {
            count: 0,
            participants: 0,
            prizePool: 0
          };
        }
        
        stats.byType[lotteryType].count++;
        stats.byType[lotteryType].participants += data.participants || 0;
        stats.byType[lotteryType].prizePool += data.prizePool || 0;
      });

      if (stats.totalLotteries > 0) {
        stats.averageParticipants = stats.totalParticipants / stats.totalLotteries;
        stats.averagePrizePool = stats.totalPrizePool / stats.totalLotteries;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get lottery performance stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old lottery data
   */
  async cleanupOldLotteryData() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      // Clean up old ticket limits
      const oldLimitsSnapshot = await this.db.collection('user_ticket_limits')
        .where('updatedAt', '<', cutoffDate)
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

      return { deletedLimits: deletedCount };
    } catch (error) {
      logger.error('Failed to cleanup old lottery data:', error);
      throw error;
    }
  }
}

module.exports = new LotteryService();
