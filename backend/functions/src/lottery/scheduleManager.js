const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const drawingEngine = require('./drawingEngine');

/**
 * Lottery schedule management and automation
 */
class ScheduleManager {
  constructor() {
    this.db = admin.firestore();
    this.schedules = new Map();
    this.timezoneOffset = 0; // UTC by default
    this.isRunning = false;
  }

  /**
   * Initialize schedule manager
   */
  async initialize() {
    try {
      await this.loadScheduleConfiguration();
      await this.validateActiveSchedules();
      this.isRunning = true;
      
      logger.info('Schedule manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize schedule manager:', error);
      throw error;
    }
  }

  /**
   * Load schedule configuration from database
   */
  async loadScheduleConfiguration() {
    try {
      const configDoc = await this.db.collection('system_config').doc('schedules').get();
      
      if (configDoc.exists) {
        const config = configDoc.data();
        this.timezoneOffset = config.timezoneOffset || 0;
        
        if (config.customSchedules) {
          for (const [lotteryType, schedule] of Object.entries(config.customSchedules)) {
            this.schedules.set(lotteryType, schedule);
          }
        }
      }

      // Load default schedules if not in database
      await this.ensureDefaultSchedules();
    } catch (error) {
      logger.error('Failed to load schedule configuration:', error);
      throw error;
    }
  }

  /**
   * Ensure default schedules exist
   */
  async ensureDefaultSchedules() {
    try {
      const defaultSchedules = {
        daily_pi: {
          type: 'daily',
          time: '20:00',
          timezone: 'UTC',
          enabled: true,
          minParticipants: 5,
          maxExtensions: 2
        },
        daily_ads: {
          type: 'daily',
          time: '21:00',
          timezone: 'UTC',
          enabled: true,
          minParticipants: 10,
          maxExtensions: 2
        },
        weekly_pi: {
          type: 'weekly',
          dayOfWeek: 0, // Sunday
          time: '18:00',
          timezone: 'UTC',
          enabled: true,
          minParticipants: 20,
          maxExtensions: 1
        },
        monthly_pi: {
          type: 'monthly',
          dayOfMonth: -1, // Last day of month
          time: '21:00',
          timezone: 'UTC',
          enabled: false,
          minParticipants: 30,
          maxExtensions: 1
        }
      };

      for (const [lotteryType, schedule] of Object.entries(defaultSchedules)) {
        if (!this.schedules.has(lotteryType)) {
          this.schedules.set(lotteryType, schedule);
        }
      }

      // Save to database
      await this.saveScheduleConfiguration();
    } catch (error) {
      logger.error('Failed to ensure default schedules:', error);
      throw error;
    }
  }

  /**
   * Save schedule configuration to database
   */
  async saveScheduleConfiguration() {
    try {
      const scheduleData = {
        timezoneOffset: this.timezoneOffset,
        customSchedules: Object.fromEntries(this.schedules),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('system_config').doc('schedules').set(scheduleData);
    } catch (error) {
      logger.error('Failed to save schedule configuration:', error);
      throw error;
    }
  }

  /**
   * Validate and sync active schedules
   */
  async validateActiveSchedules() {
    try {
      const lotteryTypesSnapshot = await this.db.collection('lottery_types').get();
      
      lotteryTypesSnapshot.forEach(doc => {
        const lotteryType = doc.data();
        const typeId = doc.id;
        
        if (lotteryType.isEnabled && !this.schedules.has(typeId)) {
          logger.warn(`No schedule found for enabled lottery type: ${typeId}`);
        }
      });
    } catch (error) {
      logger.error('Failed to validate active schedules:', error);
    }
  }

  /**
   * Check for due lottery drawings
   */
  async checkDueDrawings() {
    try {
      if (!this.isRunning) {
        return { processed: 0, message: 'Schedule manager not running' };
      }

      const now = new Date();
      const dueInstances = await this.getDueInstances(now);
      
      let processedCount = 0;
      const results = [];

      for (const instance of dueInstances) {
        try {
          logger.info(`Processing due drawing for instance: ${instance.id}`);
          
          const result = await this.processScheduledDrawing(instance);
          results.push({
            instanceId: instance.id,
            lotteryType: instance.lotteryTypeId,
            status: 'success',
            result
          });
          
          processedCount++;
        } catch (error) {
          logger.error(`Failed to process drawing for ${instance.id}:`, error);
          
          results.push({
            instanceId: instance.id,
            lotteryType: instance.lotteryTypeId,
            status: 'error',
            error: error.message
          });

          // Log the failure
          await this.logScheduleFailure(instance.id, error.message);
        }
      }

      // Update next check time
      await this.updateLastCheckTime(now);

      return {
        processed: processedCount,
        total: dueInstances.length,
        results,
        timestamp: now.toISOString()
      };
    } catch (error) {
      logger.error('Failed to check due drawings:', error);
      throw error;
    }
  }

  /**
   * Get lottery instances that are due for drawing
   */
  async getDueInstances(currentTime) {
    try {
      const dueInstances = [];
      
      // Get all active lottery instances
      const activeInstancesSnapshot = await this.db.collection('lottery_instances')
        .where('status', '==', 'active')
        .get();

      activeInstancesSnapshot.forEach(doc => {
        const instance = { id: doc.id, ...doc.data() };
        
        // Check if drawing time has passed
        const scheduledTime = instance.scheduledDrawTime.toDate();
        
        if (currentTime >= scheduledTime) {
          dueInstances.push(instance);
        }
      });

      return dueInstances;
    } catch (error) {
      logger.error('Failed to get due instances:', error);
      throw error;
    }
  }

  /**
   * Process a scheduled drawing
   */
  async processScheduledDrawing(instance) {
    try {
      const schedule = this.schedules.get(instance.lotteryTypeId);
      
      if (!schedule || !schedule.enabled) {
        throw new Error(`Schedule not enabled for lottery type: ${instance.lotteryTypeId}`);
      }

      // Check minimum participants
      if (instance.participants < schedule.minParticipants) {
        return await this.handleInsufficientParticipants(instance, schedule);
      }

      // Conduct the drawing
      const drawingResult = await drawingEngine.conductLotteryDrawing(instance.id);
      
      // Schedule next instance
      await this.scheduleNextInstance(instance.lotteryTypeId);
      
      // Log successful drawing
      await this.logScheduledDrawing(instance.id, drawingResult);

      return {
        action: 'drawing_completed',
        drawingResult,
        nextScheduled: true
      };
    } catch (error) {
      logger.error('Failed to process scheduled drawing:', error);
      throw error;
    }
  }

  /**
   * Handle insufficient participants
   */
  async handleInsufficientParticipants(instance, schedule) {
    try {
      const extensionCount = instance.extensionCount || 0;
      const maxExtensions = schedule.maxExtensions || 2;

      if (extensionCount >= maxExtensions) {
        // Cancel lottery and process refunds
        await this.cancelInsufficientLottery(instance);
        
        return {
          action: 'lottery_cancelled',
          reason: 'Insufficient participants after maximum extensions',
          extensionCount
        };
      } else {
        // Extend the lottery
        const extensionResult = await this.extendLotterySchedule(instance, schedule);
        
        return {
          action: 'lottery_extended',
          extensionCount: extensionCount + 1,
          newScheduledTime: extensionResult.newScheduledTime
        };
      }
    } catch (error) {
      logger.error('Failed to handle insufficient participants:', error);
      throw error;
    }
  }

  /**
   * Extend lottery schedule
   */
  async extendLotterySchedule(instance, schedule) {
    try {
      // Calculate extension time (24 hours by default)
      const extensionHours = schedule.extensionHours || 24;
      const newScheduledTime = new Date(Date.now() + extensionHours * 60 * 60 * 1000);

      // Update instance
      await this.db.collection('lottery_instances').doc(instance.id).update({
        scheduledDrawTime: newScheduledTime,
        extensionCount: admin.firestore.FieldValue.increment(1),
        lastExtendedAt: admin.firestore.FieldValue.serverTimestamp(),
        extensionReason: 'Insufficient participants',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log extension
      await this.logScheduleExtension(instance.id, newScheduledTime, instance.extensionCount + 1);

      logger.info(`Lottery ${instance.id} extended to ${newScheduledTime.toISOString()}`);

      return {
        newScheduledTime: newScheduledTime.toISOString(),
        extensionCount: instance.extensionCount + 1
      };
    } catch (error) {
      logger.error('Failed to extend lottery schedule:', error);
      throw error;
    }
  }

  /**
   * Cancel lottery with insufficient participants
   */
  async cancelInsufficientLottery(instance) {
    try {
      // Update instance status
      await this.db.collection('lottery_instances').doc(instance.id).update({
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: 'Insufficient participants after maximum extensions',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Schedule next instance immediately
      await this.scheduleNextInstance(instance.lotteryTypeId);

      // Log cancellation
      await this.logScheduleCancellation(instance.id, 'Insufficient participants');

      logger.info(`Lottery ${instance.id} cancelled due to insufficient participants`);
    } catch (error) {
      logger.error('Failed to cancel insufficient lottery:', error);
      throw error;
    }
  }

  /**
   * Schedule next lottery instance
   */
  async scheduleNextInstance(lotteryTypeId) {
    try {
      const schedule = this.schedules.get(lotteryTypeId);
      
      if (!schedule || !schedule.enabled) {
        logger.info(`Skipping next instance scheduling for disabled lottery: ${lotteryTypeId}`);
        return;
      }

      const nextDrawTime = this.calculateNextDrawTime(schedule);
      const instanceId = this.generateInstanceId(lotteryTypeId, nextDrawTime);

      const instanceData = {
        lotteryTypeId,
        status: 'active',
        participants: 0,
        prizePool: 0,
        scheduledDrawTime: nextDrawTime,
        extensionCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('lottery_instances').doc(instanceId).set(instanceData);
      
      logger.info(`Next lottery instance scheduled: ${instanceId} for ${nextDrawTime.toISOString()}`);

      return {
        instanceId,
        scheduledTime: nextDrawTime.toISOString(),
        lotteryTypeId
      };
    } catch (error) {
      logger.error('Failed to schedule next instance:', error);
      throw error;
    }
  }

  /**
   * Calculate next draw time based on schedule
   */
  calculateNextDrawTime(schedule) {
    const now = new Date();
    let nextDrawTime;

    switch (schedule.type) {
      case 'daily':
        nextDrawTime = this.calculateDailyTime(now, schedule.time);
        break;
        
      case 'weekly':
        nextDrawTime = this.calculateWeeklyTime(now, schedule.dayOfWeek, schedule.time);
        break;
        
      case 'monthly':
        nextDrawTime = this.calculateMonthlyTime(now, schedule.dayOfMonth, schedule.time);
        break;
        
      default:
        // Default to daily
        nextDrawTime = this.calculateDailyTime(now, '20:00');
    }

    // Apply timezone offset if needed
    if (this.timezoneOffset !== 0) {
      nextDrawTime.setMinutes(nextDrawTime.getMinutes() - this.timezoneOffset);
    }

    return nextDrawTime;
  }

  /**
   * Calculate next daily draw time
   */
  calculateDailyTime(currentTime, timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const nextDraw = new Date(currentTime);
    
    nextDraw.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextDraw <= currentTime) {
      nextDraw.setDate(nextDraw.getDate() + 1);
    }
    
    return nextDraw;
  }

  /**
   * Calculate next weekly draw time
   */
  calculateWeeklyTime(currentTime, dayOfWeek, timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const nextDraw = new Date(currentTime);
    
    // Calculate days until target day of week
    const currentDay = nextDraw.getDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
    
    if (daysUntilTarget === 0) {
      // Same day - check if time has passed
      nextDraw.setHours(hours, minutes, 0, 0);
      if (nextDraw <= currentTime) {
        nextDraw.setDate(nextDraw.getDate() + 7); // Next week
      }
    } else {
      nextDraw.setDate(nextDraw.getDate() + daysUntilTarget);
      nextDraw.setHours(hours, minutes, 0, 0);
    }
    
    return nextDraw;
  }

  /**
   * Calculate next monthly draw time
   */
  calculateMonthlyTime(currentTime, dayOfMonth, timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const nextDraw = new Date(currentTime);
    
    if (dayOfMonth === -1) {
      // Last day of month
      nextDraw.setMonth(nextDraw.getMonth() + 1, 0); // Last day of current month
      if (nextDraw <= currentTime) {
        nextDraw.setMonth(nextDraw.getMonth() + 1, 0); // Last day of next month
      }
    } else {
      // Specific day of month
      nextDraw.setDate(dayOfMonth);
      if (nextDraw <= currentTime) {
        nextDraw.setMonth(nextDraw.getMonth() + 1, dayOfMonth);
      }
    }
    
    nextDraw.setHours(hours, minutes, 0, 0);
    return nextDraw;
  }

  /**
   * Generate instance ID
   */
  generateInstanceId(lotteryTypeId, scheduledTime) {
    const dateStr = scheduledTime.toISOString().split('T')[0].replace(/-/g, '_');
    const timeStr = scheduledTime.getHours().toString().padStart(2, '0');
    const randomStr = Math.random().toString(36).substr(2, 4);
    
    return `${lotteryTypeId}_${dateStr}_${timeStr}_${randomStr}`;
  }

  /**
   * Update schedule for lottery type
   */
  async updateSchedule(lotteryTypeId, newSchedule, adminId) {
    try {
      // Validate schedule
      const validation = this.validateSchedule(newSchedule);
      if (!validation.isValid) {
        throw new Error(`Invalid schedule: ${validation.reason}`);
      }

      // Update in memory
      this.schedules.set(lotteryTypeId, {
        ...newSchedule,
        updatedBy: adminId,
        updatedAt: new Date().toISOString()
      });

      // Save to database
      await this.saveScheduleConfiguration();

      // Log change
      await this.logScheduleChange(lotteryTypeId, newSchedule, adminId);

      logger.info(`Schedule updated for ${lotteryTypeId} by ${adminId}`);

      return {
        success: true,
        lotteryTypeId,
        newSchedule,
        nextDrawTime: this.calculateNextDrawTime(newSchedule).toISOString()
      };
    } catch (error) {
      logger.error('Failed to update schedule:', error);
      throw error;
    }
  }

  /**
   * Validate schedule configuration
   */
  validateSchedule(schedule) {
    try {
      if (!schedule.type || !['daily', 'weekly', 'monthly'].includes(schedule.type)) {
        return { isValid: false, reason: 'Invalid schedule type' };
      }

      if (!schedule.time || !/^\d{2}:\d{2}$/.test(schedule.time)) {
        return { isValid: false, reason: 'Invalid time format (use HH:MM)' };
      }

      const [hours, minutes] = schedule.time.split(':').map(Number);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { isValid: false, reason: 'Invalid time values' };
      }

      if (schedule.type === 'weekly') {
        if (typeof schedule.dayOfWeek !== 'number' || schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
          return { isValid: false, reason: 'Invalid day of week (0-6)' };
        }
      }

      if (schedule.type === 'monthly') {
        if (typeof schedule.dayOfMonth !== 'number' || 
           (schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) && schedule.dayOfMonth !== -1) {
          return { isValid: false, reason: 'Invalid day of month (1-31 or -1 for last day)' };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: 'Validation error' };
    }
  }

  /**
   * Get schedule status for all lottery types
   */
  async getScheduleStatus() {
    try {
      const status = {
        managerRunning: this.isRunning,
        timezoneOffset: this.timezoneOffset,
        schedules: {},
        nextDrawings: []
      };

      for (const [lotteryTypeId, schedule] of this.schedules.entries()) {
        const nextDrawTime = this.calculateNextDrawTime(schedule);
        
        status.schedules[lotteryTypeId] = {
          ...schedule,
          nextDrawTime: nextDrawTime.toISOString(),
          timeUntilDraw: nextDrawTime - new Date()
        };

        status.nextDrawings.push({
          lotteryTypeId,
          scheduledTime: nextDrawTime.toISOString(),
          enabled: schedule.enabled
        });
      }

      // Sort by next draw time
      status.nextDrawings.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

      return status;
    } catch (error) {
      logger.error('Failed to get schedule status:', error);
      throw error;
    }
  }

  /**
   * Emergency stop all schedules
   */
  async emergencyStop(adminId, reason = 'Emergency stop') {
    try {
      this.isRunning = false;

      // Log emergency stop
      await this.db.collection('admin_logs').add({
        action: 'schedule_emergency_stop',
        details: {
          adminId,
          reason,
          stoppedAt: new Date().toISOString()
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.warn(`Schedule manager emergency stop by ${adminId}: ${reason}`);

      return {
        success: true,
        stopped: true,
        reason,
        stoppedBy: adminId
      };
    } catch (error) {
      logger.error('Failed to emergency stop schedules:', error);
      throw error;
    }
  }

  /**
   * Resume schedule operations
   */
  async resumeOperations(adminId, reason = 'Resume operations') {
    try {
      this.isRunning = true;

      // Log resume
      await this.db.collection('admin_logs').add({
        action: 'schedule_resumed',
        details: {
          adminId,
          reason,
          resumedAt: new Date().toISOString()
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Schedule manager resumed by ${adminId}: ${reason}`);

      return {
        success: true,
        running: true,
        reason,
        resumedBy: adminId
      };
    } catch (error) {
      logger.error('Failed to resume schedule operations:', error);
      throw error;
    }
  }

  /**
   * Update last check time
   */
  async updateLastCheckTime(checkTime) {
    try {
      await this.db.collection('system_config').doc('schedule_status').set({
        lastCheckTime: checkTime,
        isRunning: this.isRunning,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to update last check time:', error);
    }
  }

  /**
   * Log scheduled drawing
   */
  async logScheduledDrawing(instanceId, drawingResult) {
    try {
      await this.db.collection('schedule_logs').add({
        action: 'scheduled_drawing',
        instanceId,
        winnersCount: drawingResult.winners?.length || 0,
        totalEntries: drawingResult.totalEntries || 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log scheduled drawing:', error);
    }
  }

  /**
   * Log schedule failure
   */
  async logScheduleFailure(instanceId, errorMessage) {
    try {
      await this.db.collection('schedule_logs').add({
        action: 'schedule_failure',
        instanceId,
        error: errorMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log schedule failure:', error);
    }
  }

  /**
   * Log schedule extension
   */
  async logScheduleExtension(instanceId, newScheduledTime, extensionCount) {
    try {
      await this.db.collection('schedule_logs').add({
        action: 'schedule_extension',
        instanceId,
        newScheduledTime,
        extensionCount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log schedule extension:', error);
    }
  }

  /**
   * Log schedule cancellation
   */
  async logScheduleCancellation(instanceId, reason) {
    try {
      await this.db.collection('schedule_logs').add({
        action: 'schedule_cancellation',
        instanceId,
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log schedule cancellation:', error);
    }
  }

  /**
   * Log schedule changes
   */
  async logScheduleChange(lotteryTypeId, newSchedule, adminId) {
    try {
      await this.db.collection('admin_logs').add({
        action: 'schedule_updated',
        details: {
          lotteryTypeId,
          newSchedule,
          adminId
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to log schedule change:', error);
    }
  }
}

module.exports = new ScheduleManager();
