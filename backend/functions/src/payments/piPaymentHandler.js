const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const { PaymentError, ValidationError } = require('../middleware/errorHandler');
const piNetworkConfig = require('../config/piNetwork');
const paymentValidator = require('./paymentValidator');
const paymentLogger = require('./paymentLogger');

/**
 * Pi Network payment processing handler
 */
class PiPaymentHandler {
  constructor() {
    this.db = admin.firestore();
    this.processingTimeout = 30 * 60 * 1000; // 30 minutes
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Handle payment approval from Pi Network
   */
  async handlePaymentApproval(paymentId, userId, paymentData) {
    try {
      logger.info(`Processing payment approval: ${paymentId} for user ${userId}`);

      // Validate payment with Pi Network
      const piValidation = await piNetworkConfig.validatePayment(paymentId);
      if (!piValidation.isValid) {
        throw new PaymentError(`Payment validation failed: ${piValidation.error}`, paymentId);
      }

      // Validate payment details
      const detailsValidation = await paymentValidator.validatePaymentDetails(
        piValidation.payment, 
        paymentData, 
        userId
      );
      if (!detailsValidation.isValid) {
        throw new PaymentError(`Payment details validation failed: ${detailsValidation.reason}`, paymentId);
      }

      // Check for duplicate processing
      const duplicateCheck = await this.checkDuplicatePayment(paymentId);
      if (duplicateCheck.isDuplicate) {
        throw new PaymentError('Payment already processed', paymentId);
      }

      // Create payment transaction record
      const transactionId = await this.createPaymentTransaction(paymentId, userId, piValidation.payment);

      // Approve payment with Pi Network
      const approvalResult = await piNetworkConfig.approvePayment(paymentId);
      if (!approvalResult.success) {
        throw new PaymentError(`Pi Network approval failed: ${approvalResult.error}`, paymentId);
      }

      // Process lottery entry
      await this.processLotteryEntry(paymentData, userId, transactionId);

      // Update user payment statistics
      await this.updateUserPaymentStats(userId, piValidation.payment.amount);

      // Log successful approval
      await paymentLogger.logPaymentApproval(paymentId, userId, transactionId, piValidation.payment);

      logger.info(`Payment approved successfully: ${paymentId} -> ${transactionId}`);

      return {
        success: true,
        paymentId,
        transactionId,
        amount: piValidation.payment.amount,
        status: 'approved',
        message: 'Payment approved and lottery entry processed'
      };
    } catch (error) {
      logger.error(`Payment approval failed for ${paymentId}:`, error);
      
      // Log error
      await paymentLogger.logPaymentError(paymentId, userId, error.message, 'approval');
      
      // Cancel payment if it was approved but processing failed
      if (error.message.includes('lottery entry')) {
        await this.cancelFailedPayment(paymentId, 'Lottery entry processing failed');
      }

      throw error;
    }
  }

  /**
   * Handle payment completion from Pi Network
   */
  async handlePaymentCompletion(paymentId, txid, userId) {
    try {
      logger.info(`Processing payment completion: ${paymentId} with txid ${txid}`);

      // Get payment transaction
      const transaction = await this.getPaymentTransaction(paymentId);
      if (!transaction) {
        throw new PaymentError('Payment transaction not found', paymentId);
      }

      if (transaction.status === 'completed') {
        logger.warn(`Payment ${paymentId} already completed`);
        return {
          success: true,
          paymentId,
          txid,
          status: 'already_completed',
          message: 'Payment was already completed'
        };
      }

      // Verify blockchain transaction
      const blockchainVerification = await this.verifyBlockchainTransaction(txid, paymentId);
      if (!blockchainVerification.isValid) {
        throw new PaymentError(`Blockchain verification failed: ${blockchainVerification.reason}`, paymentId);
      }

      // Complete payment with Pi Network
      const completionResult = await piNetworkConfig.completePayment(paymentId, txid);
      if (!completionResult.success) {
        throw new PaymentError(`Pi Network completion failed: ${completionResult.error}`, paymentId);
      }

      // Update transaction status
      await this.updateTransactionStatus(transaction.id, 'completed', txid, blockchainVerification.blockData);

      // Finalize lottery entry
      await this.finalizeLotteryEntry(paymentId, userId, txid);

      // Update system revenue tracking
      await this.updateRevenueTracking(transaction);

      // Log successful completion
      await paymentLogger.logPaymentCompletion(paymentId, userId, txid, blockchainVerification);

      logger.info(`Payment completed successfully: ${paymentId} with txid ${txid}`);

      return {
        success: true,
        paymentId,
        txid,
        status: 'completed',
        blockHeight: blockchainVerification.blockData?.height,
        message: 'Payment completed successfully'
      };
    } catch (error) {
      logger.error(`Payment completion failed for ${paymentId}:`, error);
      
      // Log error
      await paymentLogger.logPaymentError(paymentId, userId, error.message, 'completion');

      throw error;
    }
  }

  /**
   * Check for duplicate payment processing
   */
  async checkDuplicatePayment(paymentId) {
    try {
      const existingSnapshot = await this.db.collection('payment_transactions')
        .where('paymentId', '==', paymentId)
        .limit(1)
        .get();

      return {
        isDuplicate: !existingSnapshot.empty,
        existingTransaction: existingSnapshot.empty ? null : {
          id: existingSnapshot.docs[0].id,
          ...existingSnapshot.docs[0].data()
        }
      };
    } catch (error) {
      logger.error('Failed to check duplicate payment:', error);
      return { isDuplicate: false };
    }
  }

  /**
   * Create payment transaction record
   */
  async createPaymentTransaction(paymentId, userId, paymentData) {
    try {
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const transactionData = {
        paymentId,
        userId,
        amount: paymentData.amount,
        memo: paymentData.memo,
        metadata: paymentData.metadata || {},
        lotteryTypeId: paymentData.metadata?.lotteryTypeId,
        status: 'approved',
        platformFee: this.calculatePlatformFee(paymentData.amount, paymentData.metadata?.lotteryTypeId),
        piNetworkFee: 0.01,
        netAmount: paymentData.amount - 0.01,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('payment_transactions').doc(transactionId).set(transactionData);
      
      return transactionId;
    } catch (error) {
      logger.error('Failed to create payment transaction:', error);
      throw error;
    }
  }

  /**
   * Calculate platform fee
   */
  calculatePlatformFee(amount, lotteryTypeId) {
    // Standard platform fee is 0.1 Pi, but could vary by lottery type
    const standardFee = 0.1;
    
    // For now, return standard fee regardless of lottery type
    return Math.min(standardFee, amount * 0.1); // Cap at 10% of payment
  }

  /**
   * Get payment transaction
   */
  async getPaymentTransaction(paymentId) {
    try {
      const snapshot = await this.db.collection('payment_transactions')
        .where('paymentId', '==', paymentId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      logger.error('Failed to get payment transaction:', error);
      throw error;
    }
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(transactionId, status, txid = null, blockData = null) {
    try {
      const updateData = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (txid) {
        updateData.txid = txid;
        updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      if (blockData) {
        updateData.blockData = blockData;
      }

      await this.db.collection('payment_transactions').doc(transactionId).update(updateData);
    } catch (error) {
      logger.error('Failed to update transaction status:', error);
      throw error;
    }
  }

  /**
   * Verify blockchain transaction
   */
  async verifyBlockchainTransaction(txid, paymentId) {
    try {
      // Note: This is a placeholder for blockchain verification
      // In a real implementation, you would query the Pi Network blockchain
      // or use Pi Network's APIs to verify the transaction
      
      // Basic validation
      if (!txid || typeof txid !== 'string' || txid.length < 10) {
        return {
          isValid: false,
          reason: 'Invalid transaction ID format'
        };
      }

      // Mock blockchain verification - in production, implement actual verification
      const mockBlockData = {
        txid,
        blockHeight: Math.floor(Math.random() * 1000000) + 500000,
        confirmations: Math.floor(Math.random() * 10) + 1,
        timestamp: new Date().toISOString(),
        verified: true
      };

      return {
        isValid: true,
        blockData: mockBlockData,
        reason: 'Transaction verified on blockchain'
      };
    } catch (error) {
      logger.error('Blockchain verification failed:', error);
      return {
        isValid: false,
        reason: 'Blockchain verification error'
      };
    }
  }

  /**
   * Process lottery entry after payment approval
   */
  async processLotteryEntry(paymentData, userId, transactionId) {
    try {
      const lotteryTypeId = paymentData.metadata?.lotteryTypeId;
      if (!lotteryTypeId) {
        throw new Error('Missing lottery type ID in payment metadata');
      }

      // Import lottery service to avoid circular dependencies
      const lotteryService = require('../lottery/lotteryService');
      
      const entryResult = await lotteryService.enterLottery(
        lotteryTypeId,
        userId,
        'pi_payment',
        1, // Standard single ticket
        {
          paymentId: paymentData.paymentId || transactionId,
          transactionId
        }
      );

      if (!entryResult.success) {
        throw new Error(`Lottery entry failed: ${entryResult.message}`);
      }

      logger.info(`Lottery entry processed: ${entryResult.entryId} for payment ${transactionId}`);
    } catch (error) {
      logger.error('Failed to process lottery entry:', error);
      throw error;
    }
  }

  /**
   * Finalize lottery entry after payment completion
   */
  async finalizeLotteryEntry(paymentId, userId, txid) {
    try {
      // Find and update lottery entry status
      const entriesSnapshot = await this.db.collection('user_entries')
        .where('userId', '==', userId)
        .where('paymentId', '==', paymentId)
        .where('status', '==', 'confirmed')
        .limit(1)
        .get();

      if (!entriesSnapshot.empty) {
        const entryDoc = entriesSnapshot.docs[0];
        await entryDoc.ref.update({
          txid,
          finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'finalized'
        });

        logger.info(`Lottery entry finalized: ${entryDoc.id} with txid ${txid}`);
      } else {
        logger.warn(`No lottery entry found for payment ${paymentId}`);
      }
    } catch (error) {
      logger.error('Failed to finalize lottery entry:', error);
    }
  }

  /**
   * Update user payment statistics
   */
  async updateUserPaymentStats(userId, amount) {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await userRef.update({
        totalPaid: admin.firestore.FieldValue.increment(amount),
        paymentCount: admin.firestore.FieldValue.increment(1),
        lastPayment: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to update user payment stats:', error);
    }
  }

  /**
   * Update system revenue tracking
   */
  async updateRevenueTracking(transaction) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const revenueRef = this.db.collection('daily_revenue').doc(today);
      
      await revenueRef.set({
        date: today,
        totalRevenue: admin.firestore.FieldValue.increment(transaction.platformFee || 0),
        totalVolume: admin.firestore.FieldValue.increment(transaction.amount || 0),
        transactionCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      logger.error('Failed to update revenue tracking:', error);
    }
  }

  /**
   * Cancel failed payment
   */
  async cancelFailedPayment(paymentId, reason) {
    try {
      const cancelResult = await piNetworkConfig.cancelPayment(paymentId, reason);
      
      if (cancelResult.success) {
        // Update transaction status
        const transaction = await this.getPaymentTransaction(paymentId);
        if (transaction) {
          await this.updateTransactionStatus(transaction.id, 'cancelled');
        }

        // Log cancellation
        await paymentLogger.logPaymentCancellation(paymentId, reason);
      }

      return cancelResult;
    } catch (error) {
      logger.error('Failed to cancel payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process payment timeout
   */
  async processPaymentTimeout(paymentId) {
    try {
      logger.warn(`Processing payment timeout for ${paymentId}`);

      const transaction = await this.getPaymentTransaction(paymentId);
      if (!transaction) {
        return { success: false, reason: 'Transaction not found' };
      }

      if (transaction.status === 'completed') {
        return { success: true, reason: 'Already completed' };
      }

      // Check if payment is still valid with Pi Network
      const statusCheck = await piNetworkConfig.getPaymentStatus(paymentId);
      
      if (statusCheck.status === 'completed') {
        // Payment was completed but our system didn't process it
        logger.warn(`Payment ${paymentId} completed externally, processing now`);
        return await this.handlePaymentCompletion(paymentId, statusCheck.transaction?.txid, transaction.userId);
      } else if (statusCheck.status === 'cancelled' || statusCheck.status === 'failed') {
        // Payment failed, update our records
        await this.updateTransactionStatus(transaction.id, 'failed');
        await paymentLogger.logPaymentTimeout(paymentId, statusCheck.status);
        
        return {
          success: true,
          action: 'marked_failed',
          piStatus: statusCheck.status
        };
      } else {
        // Payment still pending, extend timeout or cancel
        const timeSinceCreation = Date.now() - transaction.createdAt.toDate().getTime();
        
        if (timeSinceCreation > this.processingTimeout) {
          // Cancel expired payment
          await this.cancelFailedPayment(paymentId, 'Payment timeout');
          return {
            success: true,
            action: 'cancelled_timeout',
            timeExpired: timeSinceCreation
          };
        }
      }

      return { success: false, reason: 'No action taken' };
    } catch (error) {
      logger.error('Failed to process payment timeout:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(timeRange = 24) {
    try {
      const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
      
      const transactionsSnapshot = await this.db.collection('payment_transactions')
        .where('createdAt', '>=', startTime)
        .get();

      const stats = {
        totalTransactions: 0,
        completedTransactions: 0,
        failedTransactions: 0,
        totalVolume: 0,
        totalRevenue: 0,
        averageAmount: 0,
        successRate: 0,
        byStatus: {},
        byLotteryType: {}
      };

      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        
        stats.totalTransactions++;
        stats.totalVolume += transaction.amount || 0;
        stats.totalRevenue += transaction.platformFee || 0;

        // Count by status
        const status = transaction.status || 'unknown';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        if (status === 'completed') {
          stats.completedTransactions++;
        } else if (status === 'failed' || status === 'cancelled') {
          stats.failedTransactions++;
        }

        // Count by lottery type
        const lotteryType = transaction.lotteryTypeId || 'unknown';
        stats.byLotteryType[lotteryType] = (stats.byLotteryType[lotteryType] || 0) + 1;
      });

      if (stats.totalTransactions > 0) {
        stats.averageAmount = stats.totalVolume / stats.totalTransactions;
        stats.successRate = (stats.completedTransactions / stats.totalTransactions) * 100;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get payment statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old payment data
   */
  async cleanupOldPayments() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      // Clean up old failed transactions
      const oldTransactionsSnapshot = await this.db.collection('payment_transactions')
        .where('status', 'in', ['failed', 'cancelled'])
        .where('createdAt', '<', cutoffDate)
        .limit(1000)
        .get();

      const batch = this.db.batch();
      let deletedCount = 0;

      oldTransactionsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return { deletedTransactions: deletedCount };
    } catch (error) {
      logger.error('Failed to cleanup old payments:', error);
      throw error;
    }
  }
}

module.exports = new PiPaymentHandler();
