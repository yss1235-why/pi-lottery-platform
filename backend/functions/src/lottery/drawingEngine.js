const admin = require('firebase-admin');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const prizeDistribution = require('./prizeDistribution');

/**
 * Lottery drawing engine with cryptographically secure randomization
 */
class DrawingEngine {
  constructor() {
    this.db = admin.firestore();
    this.maxExtensions = 2;
    this.extensionHours = 24;
  }

  /**
   * Conduct lottery drawing for a specific instance
   */
  async conductLotteryDrawing(lotteryInstanceId) {
    try {
      logger.info(`Starting lottery drawing for instance: ${lotteryInstanceId}`);

      // Get lottery instance
      const instance = await this.getLotteryInstance(lotteryInstanceId);
      if (!instance) {
        throw new Error('Lottery instance not found');
      }

      if (instance.status !== 'active') {
        throw new Error(`Lottery instance is not active (status: ${instance.status})`);
      }

      // Get lottery type configuration
      const lotteryType = await this.getLotteryType(instance.lotteryTypeId);
      if (!lotteryType) {
        throw new Error('Lottery type not found');
      }

      // Check minimum participants requirement
      const minParticipants = lotteryType.minParticipants || 5;
      if (instance.participants < minParticipants) {
        return await this.handleInsufficientParticipants(instance, lotteryType);
      }

      // Get all valid entries for this lottery
      const entries = await this.getLotteryEntries(lotteryInstanceId);
      if (entries.length === 0) {
        throw new Error('No valid entries found for lottery');
      }

      // Conduct the drawing
      const drawingResult = await this.performDrawing(entries, instance);

      // Record winners and distribute prizes
      await this.recordWinners(lotteryInstanceId, drawingResult.winners, instance);

      // Update lottery instance status
      await this.completeLotteryDrawing(lotteryInstanceId, drawingResult);

      // Schedule next lottery instance
      await this.scheduleNextLottery(instance.lotteryTypeId);

      // Log drawing completion
      await this.logDrawingCompletion(lotteryInstanceId, drawingResult);

      logger.info(`Lottery drawing completed for ${lotteryInstanceId}: ${drawingResult.winners.length} winners`);

      return {
        success: true,
        lotteryInstanceId,
        totalEntries: entries.length,
        winners: drawingResult.winners,
        prizePool: instance.prizePool,
        drawingTimestamp: drawingResult.timestamp,
        randomSeed: drawingResult.randomSeed
      };
    } catch (error) {
      logger.error(`Lottery drawing failed for ${lotteryInstanceId}:`, error);
      await this.logDrawingError(lotteryInstanceId, error.message);
      throw error;
    }
  }

  /**
   * Perform the actual drawing with cryptographic randomization
   */
  async performDrawing(entries, instance) {
    try {
      // Generate cryptographically secure random seed
      const randomSeed = crypto.randomBytes(32).toString('hex');
      const timestamp = new Date().toISOString();

      // Create expanded entry pool (accounting for multiple tickets per user)
      const entryPool = [];
      entries.forEach(entry => {
        const ticketCount = entry.ticketCount || 1;
        for (let i = 0; i < ticketCount; i++) {
          entryPool.push({
            ...entry,
            ticketIndex: i
          });
        }
      });

      // Shuffle entry pool using cryptographic randomization
      const shuffledPool = this.cryptographicShuffle(entryPool, randomSeed);

      // Determine prize structure based on participant count
      const prizeStructure = prizeDistribution.getPrizeStructure(instance.participants);
      const winners = [];

      // Select winners
      const selectedEntries = new Set();
      
      for (let position = 1; position <= Object.keys(prizeStructure).length; position++) {
        let winnerSelected = false;
        let attempts = 0;
        const maxAttempts = shuffledPool.length;

        while (!winnerSelected && attempts < maxAttempts) {
          const randomIndex = this.generateSecureRandom(shuffledPool.length, `${randomSeed}_${position}_${attempts}`);
          const selectedEntry = shuffledPool[randomIndex];

          // Ensure one winner per user (no duplicate winners)
          if (!selectedEntries.has(selectedEntry.userId)) {
            const prizeAmount = this.calculatePrizeAmount(instance.prizePool, prizeStructure, position);
            
            winners.push({
              position,
              userId: selectedEntry.userId,
              username: selectedEntry.username || 'Anonymous',
              entryId: selectedEntry.id,
              ticketIndex: selectedEntry.ticketIndex,
              prizeAmount,
              netPrizeAmount: this.calculateNetPrize(prizeAmount),
              selectionIndex: randomIndex
            });

            selectedEntries.add(selectedEntry.userId);
            winnerSelected = true;
          }
          attempts++;
        }

        if (!winnerSelected) {
          logger.warn(`Could not select winner for position ${position} after ${maxAttempts} attempts`);
        }
      }

      return {
        winners,
        totalEntries: entryPool.length,
        uniqueParticipants: entries.length,
        randomSeed,
        timestamp,
        algorithm: 'cryptographic_shuffle',
        prizeStructure
      };
    } catch (error) {
      logger.error('Drawing performance failed:', error);
      throw error;
    }
  }

  /**
   * Cryptographically secure shuffle algorithm
   */
  cryptographicShuffle(array, seed) {
    const shuffled = [...array];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const randomIndex = this.generateSecureRandom(i + 1, `${seed}_${i}`);
      [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    }
    
    return shuffled;
  }

  /**
   * Generate cryptographically secure random number
   */
  generateSecureRandom(max, additionalEntropy = '') {
    const entropy = crypto.randomBytes(4).toString('hex') + additionalEntropy;
    const hash = crypto.createHash('sha256').update(entropy).digest();
    const randomValue = hash.readUInt32BE(0);
    return randomValue % max;
  }

  /**
   * Calculate prize amount for specific position
   */
  calculatePrizeAmount(totalPrizePool, prizeStructure, position) {
    const positionKey = `position_${position}`;
    const percentage = prizeStructure[positionKey] || 0;
    return parseFloat((totalPrizePool * percentage).toFixed(6));
  }

  /**
   * Calculate net prize amount (after Pi Network transaction fee)
   */
  calculateNetPrize(grossAmount) {
    const piNetworkFee = 0.01; // Pi Network transaction fee
    return Math.max(0, parseFloat((grossAmount - piNetworkFee).toFixed(6)));
  }

  /**
   * Handle insufficient participants scenario
   */
  async handleInsufficientParticipants(instance, lotteryType) {
    try {
      const extensionCount = instance.extensionCount || 0;
      
      if (extensionCount >= this.maxExtensions) {
        // Cancel lottery and refund participants
        return await this.cancelLotteryAndRefund(instance);
      } else {
        // Extend lottery deadline
        return await this.extendLotteryDeadline(instance);
      }
    } catch (error) {
      logger.error('Failed to handle insufficient participants:', error);
      throw error;
    }
  }

  /**
   * Extend lottery deadline
   */
  async extendLotteryDeadline(instance) {
    try {
      const newDrawTime = new Date(Date.now() + this.extensionHours * 60 * 60 * 1000);
      
      await this.db.collection('lottery_instances').doc(instance.id).update({
        scheduledDrawTime: newDrawTime,
        extensionCount: admin.firestore.FieldValue.increment(1),
        lastExtendedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log extension
      await this.logLotteryExtension(instance.id, newDrawTime, instance.extensionCount + 1);

      logger.info(`Lottery ${instance.id} extended to ${newDrawTime.toISOString()}`);

      return {
        success: true,
        action: 'extended',
        newDrawTime: newDrawTime.toISOString(),
        extensionCount: instance.extensionCount + 1,
        reason: 'Insufficient participants'
      };
    } catch (error) {
      logger.error('Failed to extend lottery deadline:', error);
      throw error;
    }
  }

  /**
   * Cancel lottery and process refunds
   */
  async cancelLotteryAndRefund(instance) {
    try {
      // Update lottery status
      await this.db.collection('lottery_instances').doc(instance.id).update({
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: 'Insufficient participants after maximum extensions',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Process refunds for paid entries (Pi lottery only)
      if (instance.lotteryTypeId !== 'daily_ads') {
        await this.processRefunds(instance.id);
      }

      // Log cancellation
      await this.logLotteryCancellation(instance.id, 'Insufficient participants');

      logger.info(`Lottery ${instance.id} cancelled due to insufficient participants`);

      return {
        success: true,
        action: 'cancelled',
        reason: 'Insufficient participants after maximum extensions',
        refundsProcessed: instance.lotteryTypeId !== 'daily_ads'
      };
    } catch (error) {
      logger.error('Failed to cancel lottery and refund:', error);
      throw error;
    }
  }

  /**
   * Record winners in database
   */
  async recordWinners(lotteryInstanceId, winners, instance) {
    try {
      const batch = this.db.batch();

      winners.forEach(winner => {
        const winnerId = `${lotteryInstanceId}_${winner.position}`;
        const winnerRef = this.db.collection('lottery_winners').doc(winnerId);
        
        batch.set(winnerRef, {
          lotteryInstanceId,
          userId: winner.userId,
          username: winner.username,
          position: winner.position,
          prizeAmount: winner.prizeAmount,
          netPrizeAmount: winner.netPrizeAmount,
          entryId: winner.entryId,
          status: 'pending_approval',
          selectionData: {
            ticketIndex: winner.ticketIndex,
            selectionIndex: winner.selectionIndex
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update user statistics
        const userRef = this.db.collection('users').doc(winner.userId);
        batch.update(userRef, {
          lotteriesWon: admin.firestore.FieldValue.increment(1),
          totalWinnings: admin.firestore.FieldValue.increment(winner.prizeAmount),
          lastWinDate: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      logger.info(`Recorded ${winners.length} winners for lottery ${lotteryInstanceId}`);
    } catch (error) {
      logger.error('Failed to record winners:', error);
      throw error;
    }
  }

  /**
   * Complete lottery drawing
   */
  async completeLotteryDrawing(lotteryInstanceId, drawingResult) {
    try {
      await this.db.collection('lottery_instances').doc(lotteryInstanceId).update({
        status: 'completed',
        actualDrawTime: admin.firestore.FieldValue.serverTimestamp(),
        drawingResult: {
          totalEntries: drawingResult.totalEntries,
          uniqueParticipants: drawingResult.uniqueParticipants,
          winnersCount: drawingResult.winners.length,
          randomSeed: drawingResult.randomSeed,
          algorithm: drawingResult.algorithm
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to complete lottery drawing:', error);
      throw error;
    }
  }

  /**
   * Schedule next lottery instance
   */
  async scheduleNextLottery(lotteryTypeId) {
    try {
      const lotteryType = await this.getLotteryType(lotteryTypeId);
      if (!lotteryType || !lotteryType.isEnabled) {
        logger.info(`Skipping next lottery scheduling for disabled type: ${lotteryTypeId}`);
        return;
      }

      const nextInstanceId = `${lotteryTypeId}_${this.generateNextInstanceId()}`;
      const nextDrawTime = this.calculateNextDrawTime(lotteryType);

      const nextInstanceData = {
        lotteryTypeId,
        status: 'active',
        participants: 0,
        prizePool: 0,
        scheduledDrawTime: nextDrawTime,
        extensionCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('lottery_instances').doc(nextInstanceId).set(nextInstanceData);
      
      logger.info(`Next lottery scheduled: ${nextInstanceId} for ${nextDrawTime.toISOString()}`);
    } catch (error) {
      logger.error('Failed to schedule next lottery:', error);
    }
  }

  /**
   * Generate next instance ID
   */
  generateNextInstanceId() {
    const now = new Date();
    return `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}_${Date.now()}`;
  }

  /**
   * Calculate next draw time based on lottery type
   */
  calculateNextDrawTime(lotteryType) {
    const now = new Date();
    const drawTime = new Date(now);
    
    switch (lotteryType.scheduledTime) {
      case '20:00':
        drawTime.setDate(drawTime.getDate() + 1);
        drawTime.setHours(20, 0, 0, 0);
        break;
      case '21:00':
        drawTime.setDate(drawTime.getDate() + 1);
        drawTime.setHours(21, 0, 0, 0);
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
        drawTime.setDate(drawTime.getDate() + 1);
        drawTime.setHours(20, 0, 0, 0);
    }
    
    return drawTime;
  }

  /**
   * Get lottery instance
   */
  async getLotteryInstance(instanceId) {
    try {
      const doc = await this.db.collection('lottery_instances').doc(instanceId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      logger.error(`Failed to get lottery instance ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * Get lottery type configuration
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
   * Get lottery entries
   */
  async getLotteryEntries(lotteryInstanceId) {
    try {
      const snapshot = await this.db.collection('user_entries')
        .where('lotteryInstanceId', '==', lotteryInstanceId)
        .where('status', '==', 'confirmed')
        .get();

      const entries = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          ...data
        });
      });

      return entries;
    } catch (error) {
      logger.error(`Failed to get lottery entries for ${lotteryInstanceId}:`, error);
      throw error;
    }
  }

  /**
   * Process refunds for cancelled lottery
   */
  async processRefunds(lotteryInstanceId) {
    try {
      const entries = await this.getLotteryEntries(lotteryInstanceId);
      const refundPromises = [];

      entries.forEach(entry => {
        if (entry.entryMethod === 'pi_payment' && entry.paymentId) {
          refundPromises.push(this.processIndividualRefund(entry));
        }
      });

      await Promise.all(refundPromises);
      logger.info(`Processed ${refundPromises.length} refunds for lottery ${lotteryInstanceId}`);
    } catch (error) {
      logger.error('Failed to process refunds:', error);
    }
  }

  /**
   * Process individual refund
   */
  async processIndividualRefund(entry) {
    try {
      // Create refund record
      await this.db.collection('refunds').add({
        userId: entry.userId,
        lotteryInstanceId: entry.lotteryInstanceId,
        entryId: entry.id,
        paymentId: entry.paymentId,
        refundAmount: 1.0, // Standard lottery entry fee
        status: 'pending',
        reason: 'Lottery cancelled - insufficient participants',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Note: Actual Pi Network refund would require additional API integration
      logger.info(`Refund record created for entry ${entry.id}`);
    } catch (error) {
      logger.error(`Failed to process refund for entry ${entry.id}:`, error);
    }
  }

  /**
   * Scheduled lottery drawings check
   */
  async scheduleLotteryDrawings() {
    try {
      const now = new Date();
      
      const activeInstancesSnapshot = await this.db.collection('lottery_instances')
        .where('status', '==', 'active')
        .get();

      const drawingPromises = [];

      activeInstancesSnapshot.forEach(doc => {
        const instance = { id: doc.id, ...doc.data() };
        const scheduledTime = instance.scheduledDrawTime.toDate();
        
        if (now >= scheduledTime) {
          logger.info(`Triggering scheduled drawing for ${instance.id}`);
          drawingPromises.push(this.conductLotteryDrawing(instance.id));
        }
      });

      if (drawingPromises.length > 0) {
        await Promise.allSettled(drawingPromises);
        logger.info(`Processed ${drawingPromises.length} scheduled drawings`);
      }
    } catch (error) {
      logger.error('Scheduled lottery drawings check failed:', error);
    }
  }

  /**
   * Log drawing completion
   */
  async logDrawingCompletion(lotteryInstanceId, drawingResult) {
    try {
      await this.db.collection('drawing_logs').add({
        lotteryInstanceId,
        action: 'drawing_completed',
        winnersCount: drawingResult.winners.length,
        totalEntries: drawingResult.totalEntries,
        randomSeed: drawingResult.randomSeed,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log drawing completion:', error);
    }
  }

  /**
   * Log drawing error
   */
  async logDrawingError(lotteryInstanceId, errorMessage) {
    try {
      await this.db.collection('drawing_logs').add({
        lotteryInstanceId,
        action: 'drawing_error',
        error: errorMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log drawing error:', error);
    }
  }

  /**
   * Log lottery extension
   */
  async logLotteryExtension(lotteryInstanceId, newDrawTime, extensionCount) {
    try {
      await this.db.collection('drawing_logs').add({
        lotteryInstanceId,
        action: 'lottery_extended',
        newDrawTime,
        extensionCount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log lottery extension:', error);
    }
  }

  /**
   * Log lottery cancellation
   */
  async logLotteryCancellation(lotteryInstanceId, reason) {
    try {
      await this.db.collection('drawing_logs').add({
        lotteryInstanceId,
        action: 'lottery_cancelled',
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log lottery cancellation:', error);
    }
  }
}

module.exports = new DrawingEngine();
