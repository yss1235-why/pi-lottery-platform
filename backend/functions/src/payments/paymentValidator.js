const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * Payment validation and verification system
 */
class PaymentValidator {
  constructor() {
    this.db = admin.firestore();
    this.validationRules = {
      minAmount: 0.1,
      maxAmount: 100.0,
      allowedCurrencies: ['Pi'],
      maxAgeMinutes: 30,
      requiredMetadata: ['lotteryTypeId', 'timestamp']
    };
  }

  /**
   * Validate payment details against expected values
   */
  async validatePaymentDetails(payment, expectedData, userId) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };

      // Basic payment structure validation
      const structureValidation = this.validatePaymentStructure(payment);
      if (!structureValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...structureValidation.errors);
      }

      // Amount validation
      const amountValidation = this.validateAmount(payment.amount, expectedData.amount);
      if (!amountValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(amountValidation.error);
      }

      // Metadata validation
      const metadataValidation = this.validateMetadata(payment.metadata, expectedData.metadata);
      if (!metadataValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...metadataValidation.errors);
      }

      // User validation
      const userValidation = await this.validateUser(payment, userId);
      if (!userValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(userValidation.error);
      }

      // Timing validation
      const timingValidation = this.validateTiming(payment);
      if (!timingValidation.isValid) {
        validation.warnings.push(timingValidation.warning);
      }

      // Business rules validation
      const businessValidation = await this.validateBusinessRules(payment, userId);
      if (!businessValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...businessValidation.errors);
      }

      return {
        isValid: validation.isValid,
        reason: validation.isValid ? 'Payment validation successful' : validation.errors.join('; '),
        errors: validation.errors,
        warnings: validation.warnings,
        validationDetails: {
          structure: structureValidation.isValid,
          amount: amountValidation.isValid,
          metadata: metadataValidation.isValid,
          user: userValidation.isValid,
          timing: timingValidation.isValid,
          business: businessValidation.isValid
        }
      };
    } catch (error) {
      logger.error('Payment validation failed:', error);
      return {
        isValid: false,
        reason: 'Validation system error',
        errors: [error.message]
      };
    }
  }

  /**
   * Validate basic payment structure
   */
  validatePaymentStructure(payment) {
    const validation = {
      isValid: true,
      errors: []
    };

    // Required fields
    const requiredFields = ['amount', 'user', 'created_at'];
    for (const field of requiredFields) {
      if (!payment[field]) {
        validation.isValid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Amount should be a number
    if (payment.amount && (typeof payment.amount !== 'number' || payment.amount <= 0)) {
      validation.isValid = false;
      validation.errors.push('Invalid amount format');
    }

    // User should have uid
    if (payment.user && !payment.user.uid) {
      validation.isValid = false;
      validation.errors.push('Invalid user data - missing uid');
    }

    return validation;
  }

  /**
   * Validate payment amount
   */
  validateAmount(actualAmount, expectedAmount) {
    // Allow small floating point differences
    const tolerance = 0.000001;
    const difference = Math.abs(actualAmount - expectedAmount);

    if (difference > tolerance) {
      return {
        isValid: false,
        error: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`
      };
    }

    // Check against validation rules
    if (actualAmount < this.validationRules.minAmount) {
      return {
        isValid: false,
        error: `Amount below minimum: ${actualAmount} < ${this.validationRules.minAmount}`
      };
    }

    if (actualAmount > this.validationRules.maxAmount) {
      return {
        isValid: false,
        error: `Amount above maximum: ${actualAmount} > ${this.validationRules.maxAmount}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate payment metadata
   */
  validateMetadata(actualMetadata, expectedMetadata) {
    const validation = {
      isValid: true,
      errors: []
    };

    if (!actualMetadata) {
      validation.isValid = false;
      validation.errors.push('Missing payment metadata');
      return validation;
    }

    // Check required metadata fields
    for (const field of this.validationRules.requiredMetadata) {
      if (!actualMetadata[field]) {
        validation.isValid = false;
        validation.errors.push(`Missing required metadata field: ${field}`);
      }
    }

    // Validate specific expected metadata
    if (expectedMetadata) {
      for (const [key, expectedValue] of Object.entries(expectedMetadata)) {
        if (actualMetadata[key] !== expectedValue) {
          validation.isValid = false;
          validation.errors.push(`Metadata mismatch for ${key}: expected ${expectedValue}, got ${actualMetadata[key]}`);
        }
      }
    }

    // Validate lottery type ID
    if (actualMetadata.lotteryTypeId) {
      const validLotteryTypes = ['daily_pi', 'daily_ads', 'weekly_pi', 'monthly_pi'];
      if (!validLotteryTypes.includes(actualMetadata.lotteryTypeId)) {
        validation.isValid = false;
        validation.errors.push(`Invalid lottery type: ${actualMetadata.lotteryTypeId}`);
      }
    }

    return validation;
  }

  /**
   * Validate user information
   */
  async validateUser(payment, expectedUserId) {
    try {
      // Check if payment user matches expected user
      if (payment.user.uid !== expectedUserId) {
        return {
          isValid: false,
          error: `User mismatch: payment user ${payment.user.uid} != expected user ${expectedUserId}`
        };
      }

      // Check if user exists in our system
      const userDoc = await this.db.collection('users').doc(expectedUserId).get();
      if (!userDoc.exists) {
        return {
          isValid: false,
          error: 'User not found in system'
        };
      }

      const userData = userDoc.data();

      // Check if user is suspended
      if (userData.isSuspended) {
        return {
          isValid: false,
          error: 'User account is suspended'
        };
      }

      // Check Pi user ID match
      if (userData.piUID && payment.user.uid !== userData.piUID) {
        return {
          isValid: false,
          error: 'Pi user ID mismatch with stored data'
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('User validation failed:', error);
      return {
        isValid: false,
        error: 'User validation system error'
      };
    }
  }

  /**
   * Validate payment timing
   */
  validateTiming(payment) {
    const paymentTime = new Date(payment.created_at);
    const now = new Date();
    const ageMinutes = (now - paymentTime) / (1000 * 60);

    if (ageMinutes > this.validationRules.maxAgeMinutes) {
      return {
        isValid: false,
        warning: `Payment is old: ${ageMinutes.toFixed(1)} minutes (max: ${this.validationRules.maxAgeMinutes})`
      };
    }

    // Check if payment is from the future (clock skew tolerance: 5 minutes)
    if (ageMinutes < -5) {
      return {
        isValid: false,
        warning: `Payment timestamp is in the future: ${ageMinutes.toFixed(1)} minutes`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate business rules
   */
  async validateBusinessRules(payment, userId) {
    const validation = {
      isValid: true,
      errors: []
    };

    try {
      // Check daily payment limits
      const dailyLimitCheck = await this.checkDailyPaymentLimits(userId, payment.amount);
      if (!dailyLimitCheck.allowed) {
        validation.isValid = false;
        validation.errors.push(dailyLimitCheck.reason);
      }

      // Check lottery-specific rules
      if (payment.metadata?.lotteryTypeId) {
        const lotteryRulesCheck = await this.validateLotteryRules(payment.metadata.lotteryTypeId, userId, payment.amount);
        if (!lotteryRulesCheck.isValid) {
          validation.isValid = false;
          validation.errors.push(...lotteryRulesCheck.errors);
        }
      }

      // Check for suspicious activity patterns
      const suspiciousActivityCheck = await this.checkSuspiciousActivity(userId, payment);
      if (!suspiciousActivityCheck.isValid) {
        validation.isValid = false;
        validation.errors.push(suspiciousActivityCheck.error);
      }

      return validation;
    } catch (error) {
      logger.error('Business rules validation failed:', error);
      validation.isValid = false;
      validation.errors.push('Business rules validation error');
      return validation;
    }
  }

  /**
   * Check daily payment limits
   */
  async checkDailyPaymentLimits(userId, amount) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyLimitRef = this.db.collection('daily_payment_limits').doc(`${userId}_${today}`);
      const dailyLimitDoc = await dailyLimitRef.get();

      const dailyLimit = 50.0; // 50 Pi per day
      const maxTransactions = 20; // 20 transactions per day

      let dailyTotal = 0;
      let transactionCount = 0;

      if (dailyLimitDoc.exists) {
        const data = dailyLimitDoc.data();
        dailyTotal = data.totalAmount || 0;
        transactionCount = data.transactionCount || 0;
      }

      if (dailyTotal + amount > dailyLimit) {
        return {
          allowed: false,
          reason: `Daily payment limit exceeded: ${dailyTotal + amount} > ${dailyLimit} Pi`
        };
      }

      if (transactionCount >= maxTransactions) {
        return {
          allowed: false,
          reason: `Daily transaction limit exceeded: ${transactionCount} >= ${maxTransactions}`
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check daily payment limits:', error);
      return { allowed: true }; // Allow payment if check fails
    }
  }

  /**
   * Validate lottery-specific rules
   */
  async validateLotteryRules(lotteryTypeId, userId, amount) {
    const validation = {
      isValid: true,
      errors: []
    };

    try {
      // Get lottery type configuration
      const lotteryTypeDoc = await this.db.collection('lottery_types').doc(lotteryTypeId).get();
      
      if (!lotteryTypeDoc.exists) {
        validation.isValid = false;
        validation.errors.push(`Lottery type not found: ${lotteryTypeId}`);
        return validation;
      }

      const lotteryType = lotteryTypeDoc.data();

      // Check if lottery is enabled
      if (!lotteryType.isEnabled) {
        validation.isValid = false;
        validation.errors.push(`Lottery type is disabled: ${lotteryTypeId}`);
        return validation;
      }

      // Validate entry fee
      const expectedFee = lotteryType.entryFee || 1.0;
      if (Math.abs(amount - expectedFee) > 0.000001) {
        validation.isValid = false;
        validation.errors.push(`Invalid entry fee: expected ${expectedFee}, got ${amount}`);
      }

      // Check user ticket limits
      const ticketLimitCheck = await this.checkUserTicketLimits(lotteryTypeId, userId);
      if (!ticketLimitCheck.allowed) {
        validation.isValid = false;
        validation.errors.push(ticketLimitCheck.reason);
      }

      return validation;
    } catch (error) {
      logger.error('Lottery rules validation failed:', error);
      validation.isValid = false;
      validation.errors.push('Lottery rules validation error');
      return validation;
    }
  }

  /**
   * Check user ticket limits for lottery type
   */
  async checkUserTicketLimits(lotteryTypeId, userId) {
    try {
      // Get lottery type limits
      const lotteryLimits = {
        daily_pi: 3,
        daily_ads: 5,
        weekly_pi: 10,
        monthly_pi: 25
      };

      const maxTickets = lotteryLimits[lotteryTypeId] || 1;
      const limitsPeriod = this.getLimitsPeriod(lotteryTypeId);
      
      const limitsDoc = await this.db.collection('user_ticket_limits')
        .doc(`${userId}_${limitsPeriod}`)
        .get();

      let usedTickets = 0;
      if (limitsDoc.exists) {
        const data = limitsDoc.data();
        usedTickets = data[`${lotteryTypeId}_used`] || 0;
      }

      if (usedTickets >= maxTickets) {
        return {
          allowed: false,
          reason: `Ticket limit exceeded for ${lotteryTypeId}: ${usedTickets}/${maxTickets}`
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check user ticket limits:', error);
      return { allowed: true }; // Allow if check fails
    }
  }

  /**
   * Get limits period for lottery type
   */
  getLimitsPeriod(lotteryTypeId) {
    const now = new Date();
    
    switch (lotteryTypeId) {
      case 'daily_pi':
      case 'daily_ads':
        return now.toISOString().split('T')[0];
        
      case 'weekly_pi':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return `${weekStart.getFullYear()}_W${this.getWeekNumber(weekStart)}`;
        
      case 'monthly_pi':
        return `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        
      default:
        return now.toISOString().split('T')[0];
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
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(userId, payment) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);

      // Check for rapid repeated payments
      const recentPaymentsSnapshot = await this.db.collection('payment_transactions')
        .where('userId', '==', userId)
        .where('createdAt', '>=', oneHourAgo)
        .get();

      const recentPayments = recentPaymentsSnapshot.size;
      
      if (recentPayments > 10) {
        return {
          isValid: false,
          error: `Suspicious activity: ${recentPayments} payments in last hour`
        };
      }

      // Check for identical amounts in short timeframe
      let identicalAmountCount = 0;
      recentPaymentsSnapshot.forEach(doc => {
        const paymentData = doc.data();
        if (Math.abs(paymentData.amount - payment.amount) < 0.000001) {
          identicalAmountCount++;
        }
      });

      if (identicalAmountCount > 5) {
        return {
          isValid: false,
          error: `Suspicious activity: ${identicalAmountCount} identical amounts in last hour`
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Suspicious activity check failed:', error);
      return { isValid: true }; // Allow if check fails
    }
  }

  /**
   * Validate payment against Pi Network standards
   */
  validatePiNetworkStandards(payment) {
    const validation = {
      isValid: true,
      errors: []
    };

    // Check Pi-specific fields
    if (!payment.identifier) {
      validation.isValid = false;
      validation.errors.push('Missing Pi payment identifier');
    }

    // Validate status
    const validStatuses = ['ready_for_server_approval', 'server_approved', 'completed', 'cancelled'];
    if (!validStatuses.includes(payment.status)) {
      validation.isValid = false;
      validation.errors.push(`Invalid payment status: ${payment.status}`);
    }

    // Check for required Pi Network fields
    const requiredPiFields = ['amount', 'memo', 'metadata', 'user'];
    for (const field of requiredPiFields) {
      if (!payment[field]) {
        validation.isValid = false;
        validation.errors.push(`Missing Pi Network field: ${field}`);
      }
    }

    return validation;
  }

  /**
   * Update daily payment limits after successful payment
   */
  async updateDailyPaymentLimits(userId, amount) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyLimitRef = this.db.collection('daily_payment_limits').doc(`${userId}_${today}`);
      
      await dailyLimitRef.set({
        userId,
        date: today,
        totalAmount: admin.firestore.FieldValue.increment(amount),
        transactionCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      logger.error('Failed to update daily payment limits:', error);
    }
  }

  /**
   * Get validation statistics
   */
  async getValidationStatistics(timeRange = 24) {
    try {
      const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
      
      // This would require storing validation results in a collection
      // For now, return basic structure
      return {
        timeRange,
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        validationRate: 0,
        commonErrors: [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get validation statistics:', error);
      throw error;
    }
  }

  /**
   * Update validation rules
   */
  updateValidationRules(newRules) {
    try {
      this.validationRules = {
        ...this.validationRules,
        ...newRules
      };

      logger.info('Validation rules updated:', newRules);
      return { success: true, rules: this.validationRules };
    } catch (error) {
      logger.error('Failed to update validation rules:', error);
      throw error;
    }
  }

  /**
   * Get current validation rules
   */
  getValidationRules() {
    return { ...this.validationRules };
  }
}

module.exports = new PaymentValidator();
