import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

class NotificationService {
  constructor() {
    this.listeners = new Map();
    this.notificationQueue = [];
    this.isProcessingQueue = false;
    this.maxRetries = 3;
    this.retryDelay = 5000;
    this.batchSize = 10;
    
    // Notification types and their default settings
    this.notificationTypes = {
      lottery_entry: {
        title: 'Lottery Entry Confirmed',
        priority: 'normal',
        category: 'lottery',
        defaultEnabled: true
      },
      lottery_win: {
        title: 'Congratulations! You Won!',
        priority: 'high',
        category: 'lottery',
        defaultEnabled: true
      },
      lottery_draw: {
        title: 'Lottery Drawing Complete',
        priority: 'normal',
        category: 'lottery',
        defaultEnabled: true
      },
      payment_success: {
        title: 'Payment Successful',
        priority: 'normal',
        category: 'payment',
        defaultEnabled: true
      },
      payment_failed: {
        title: 'Payment Failed',
        priority: 'high',
        category: 'payment',
        defaultEnabled: true
      },
      prize_transferred: {
        title: 'Prize Transferred',
        priority: 'high',
        category: 'prize',
        defaultEnabled: true
      },
      system_maintenance: {
        title: 'System Maintenance',
        priority: 'normal',
        category: 'system',
        defaultEnabled: true
      },
      ad_reward: {
        title: 'Ad Reward Earned',
        priority: 'low',
        category: 'ad',
        defaultEnabled: true
      }
    };

    this.startQueueProcessor();
  }

  // =============================================
  // NOTIFICATION CREATION AND SENDING
  // =============================================

  async createNotification(userId, type, data = {}, options = {}) {
    try {
      const notificationId = uuidv4();
      const typeConfig = this.notificationTypes[type];
      
      if (!typeConfig) {
        throw new Error(`Unknown notification type: ${type}`);
      }

      // Check user preferences
      const userPrefs = await this.getUserNotificationPreferences(userId);
      if (!this.shouldSendNotification(type, userPrefs)) {
        console.log(`Notification ${type} disabled for user ${userId}`);
        return null;
      }

      const notification = {
        id: notificationId,
        userId,
        type,
        title: options.title || typeConfig.title,
        message: this.generateNotificationMessage(type, data),
        data: data,
        priority: options.priority || typeConfig.priority,
        category: typeConfig.category,
        status: 'pending',
        read: false,
        delivered: false,
        attempts: 0,
        createdAt: serverTimestamp(),
        scheduledFor: options.scheduledFor || null,
        expiresAt: options.expiresAt || null
      };

      // Store notification in database
      await setDoc(doc(db, 'notifications', notificationId), notification);

      // Add to processing queue if not scheduled
      if (!options.scheduledFor || new Date(options.scheduledFor) <= new Date()) {
        this.addToQueue(notification);
      }

      return notificationId;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  generateNotificationMessage(type, data) {
    switch (type) {
      case 'lottery_entry':
        return `Your entry for ${data.lotteryName || 'lottery'} has been confirmed. Good luck!`;
      case 'lottery_win':
        return `🎉 You won ${data.prizeAmount || 0} π in the ${data.lotteryName || 'lottery'}!`;
      case 'lottery_draw':
        return `The ${data.lotteryName || 'lottery'} drawing is complete. Check your results!`;
      case 'payment_success':
        return `Payment of ${data.amount || 0} π was successful.`;
      case 'payment_failed':
        return `Payment of ${data.amount || 0} π failed. Please try again.`;
      case 'prize_transferred':
        return `Your prize of ${data.amount || 0} π has been transferred to your wallet.`;
      case 'system_maintenance':
        return `System maintenance is scheduled. ${data.message || 'Please check back later.'}`;
      case 'ad_reward':
        return `You earned ${data.amount || 0} π for watching an advertisement!`;
      default:
        return data.message || 'You have a new notification.';
    }
  }

  async sendNotification(notification) {
    try {
      const userId = notification.userId;
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const deliveryMethods = await this.getDeliveryMethods(userId, notification.type);

      const deliveryResults = [];

      // Send via in-app notification (always enabled)
      const inAppResult = await this.sendInAppNotification(notification);
      deliveryResults.push({ method: 'in_app', success: inAppResult.success });

      // Send via email if enabled and available
      if (deliveryMethods.email && userData.email) {
        const emailResult = await this.sendEmailNotification(notification, userData.email);
        deliveryResults.push({ method: 'email', success: emailResult.success });
      }

      // Send via push notification if enabled (browser notifications)
      if (deliveryMethods.push) {
        const pushResult = await this.sendPushNotification(notification);
        deliveryResults.push({ method: 'push', success: pushResult.success });
      }

      // Update notification status
      const successful = deliveryResults.some(result => result.success);
      await this.updateNotificationStatus(
        notification.id, 
        successful ? 'delivered' : 'failed',
        deliveryResults
      );

      return { success: successful, deliveryResults };
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  async sendInAppNotification(notification) {
    try {
      // In-app notifications are stored in database and delivered via real-time listeners
      const inAppNotification = {
        userId: notification.userId,
        notificationId: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        read: false,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'in_app_notifications'), inAppNotification);
      
      // Notify real-time listeners
      this.notifyInAppListeners(notification.userId, inAppNotification);

      return { success: true };
    } catch (error) {
      console.error('Failed to send in-app notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendEmailNotification(notification, email) {
    try {
      // In a real implementation, this would integrate with an email service
      // For now, we'll simulate email sending
      const emailData = {
        to: email,
        subject: notification.title,
        body: notification.message,
        template: 'notification',
        data: notification.data
      };

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Email notification sent:', emailData);
      return { success: true };
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPushNotification(notification) {
    try {
      // Browser push notifications
      if ('Notification' in window && Notification.permission === 'granted') {
        const pushNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: notification.id,
          data: notification.data,
          requireInteraction: notification.priority === 'high'
        });

        // Handle notification click
        pushNotification.onclick = () => {
          this.handleNotificationClick(notification);
          pushNotification.close();
        };

        return { success: true };
      } else {
        return { success: false, error: 'Push notifications not supported or not permitted' };
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return { success: false, error: error.message };
    }
  }

  handleNotificationClick(notification) {
    // Handle notification click based on type
    switch (notification.type) {
      case 'lottery_win':
        window.location.href = '/lottery-results';
        break;
      case 'prize_transferred':
        window.location.href = '/profile';
        break;
      case 'payment_failed':
        window.location.href = '/payments';
        break;
      default:
        window.location.href = '/notifications';
    }
  }

  // =============================================
  // USER PREFERENCES MANAGEMENT
  // =============================================

  async getUserNotificationPreferences(userId) {
    try {
      const prefsDoc = await getDoc(doc(db, 'user_notification_preferences', userId));
      
      if (prefsDoc.exists()) {
        return prefsDoc.data();
      }

      // Return default preferences
      const defaultPrefs = {
        userId,
        types: {},
        delivery: {
          email: true,
          push: true,
          inApp: true
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        },
        createdAt: serverTimestamp()
      };

      // Set default enabled status for each notification type
      Object.keys(this.notificationTypes).forEach(type => {
        defaultPrefs.types[type] = this.notificationTypes[type].defaultEnabled;
      });

      await setDoc(doc(db, 'user_notification_preferences', userId), defaultPrefs);
      return defaultPrefs;
    } catch (error) {
      console.error('Failed to get user notification preferences:', error);
      throw error;
    }
  }

  async updateUserNotificationPreferences(userId, preferences) {
    try {
      const prefsRef = doc(db, 'user_notification_preferences', userId);
      await updateDoc(prefsRef, {
        ...preferences,
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  shouldSendNotification(type, userPrefs) {
    // Check if notification type is enabled
    if (userPrefs.types && userPrefs.types[type] === false) {
      return false;
    }

    // Check quiet hours
    if (userPrefs.quietHours && userPrefs.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (this.isInQuietHours(currentTime, userPrefs.quietHours)) {
        // Only send high priority notifications during quiet hours
        const typeConfig = this.notificationTypes[type];
        return typeConfig && typeConfig.priority === 'high';
      }
    }

    return true;
  }

  isInQuietHours(currentTime, quietHours) {
    const start = quietHours.start;
    const end = quietHours.end;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }
    
    return currentTime >= start && currentTime <= end;
  }

  async getDeliveryMethods(userId, notificationType) {
    try {
      const prefs = await this.getUserNotificationPreferences(userId);
      return {
        email: prefs.delivery?.email || false,
        push: prefs.delivery?.push || false,
        inApp: prefs.delivery?.inApp !== false // Default to true if not specified
      };
    } catch (error) {
      console.error('Failed to get delivery methods:', error);
      return { email: false, push: false, inApp: true };
    }
  }

  // =============================================
  // NOTIFICATION QUEUE PROCESSING
  // =============================================

  addToQueue(notification) {
    this.notificationQueue.push(notification);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        const batch = this.notificationQueue.splice(0, this.batchSize);
        
        const promises = batch.map(notification => 
          this.processNotification(notification)
        );

        await Promise.allSettled(promises);
        
        // Small delay between batches
        if (this.notificationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async processNotification(notification) {
    try {
      const result = await this.sendNotification(notification);
      
      if (!result.success && notification.attempts < this.maxRetries) {
        // Retry failed notification
        notification.attempts += 1;
        
        setTimeout(() => {
          this.addToQueue(notification);
        }, this.retryDelay * notification.attempts);
      }

      return result;
    } catch (error) {
      console.error('Failed to process notification:', error);
      throw error;
    }
  }

  startQueueProcessor() {
    // Process queue every 5 seconds
    setInterval(() => {
      this.processQueue();
    }, 5000);

    // Process scheduled notifications every minute
    setInterval(() => {
      this.processScheduledNotifications();
    }, 60000);
  }

  async processScheduledNotifications() {
    try {
      const now = new Date();
      const scheduledQuery = query(
        collection(db, 'notifications'),
        where('status', '==', 'pending'),
        where('scheduledFor', '<=', now),
        limit(50)
      );

      const snapshot = await getDocs(scheduledQuery);
      
      snapshot.forEach(doc => {
        const notification = { id: doc.id, ...doc.data() };
        this.addToQueue(notification);
      });
    } catch (error) {
      console.error('Failed to process scheduled notifications:', error);
    }
  }

  async updateNotificationStatus(notificationId, status, deliveryResults = []) {
    try {
      const updates = {
        status,
        delivered: status === 'delivered',
        deliveryResults,
        updatedAt: serverTimestamp()
      };

      if (status === 'delivered') {
        updates.deliveredAt = serverTimestamp();
      } else if (status === 'failed') {
        updates.failedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'notifications', notificationId), updates);
    } catch (error) {
      console.error('Failed to update notification status:', error);
    }
  }

  // =============================================
  // NOTIFICATION RETRIEVAL AND MANAGEMENT
  // =============================================

  async getUserNotifications(userId, limit = 20, unreadOnly = false) {
    try {
      const notificationsCollection = collection(db, 'in_app_notifications');
      let q = query(
        notificationsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );

      if (unreadOnly) {
        q = query(
          notificationsCollection,
          where('userId', '==', userId),
          where('read', '==', false),
          orderBy('createdAt', 'desc'),
          limit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const notifications = [];
      
      snapshot.forEach(doc => {
        notifications.push({ id: doc.id, ...doc.data() });
      });

      return notifications;
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId, userId) {
    try {
      const notificationRef = doc(db, 'in_app_notifications', notificationId);
      const notificationDoc = await getDoc(notificationRef);
      
      if (!notificationDoc.exists()) {
        throw new Error('Notification not found');
      }

      const notificationData = notificationDoc.data();
      if (notificationData.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }

      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId) {
    try {
      const notificationsQuery = query(
        collection(db, 'in_app_notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      const batch = writeBatch(db);

      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          read: true,
          readAt: serverTimestamp()
        });
      });

      await batch.commit();
      return { success: true, updatedCount: snapshot.size };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      const notificationRef = doc(db, 'in_app_notifications', notificationId);
      const notificationDoc = await getDoc(notificationRef);
      
      if (!notificationDoc.exists()) {
        throw new Error('Notification not found');
      }

      const notificationData = notificationDoc.data();
      if (notificationData.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }

      await deleteDoc(notificationRef);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      const unreadQuery = query(
        collection(db, 'in_app_notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(unreadQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      throw error;
    }
  }

  // =============================================
  // REAL-TIME SUBSCRIPTION
  // =============================================

  subscribeToUserNotifications(userId, callback) {
    const notificationsQuery = query(
      collection(db, 'in_app_notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    return onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = [];
      snapshot.forEach(doc => {
        notifications.push({ id: doc.id, ...doc.data() });
      });
      callback(notifications);
    });
  }

  notifyInAppListeners(userId, notification) {
    const listeners = this.listeners.get(userId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(notification);
        } catch (error) {
          console.error('Notification listener error:', error);
        }
      });
    }
  }

  addInAppListener(userId, callback) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId).add(callback);
    
    return () => {
      const listeners = this.listeners.get(userId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  // =============================================
  // BULK NOTIFICATIONS
  // =============================================

  async sendBulkNotification(userIds, type, data = {}, options = {}) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type,
        data,
        options
      }));

      const results = [];
      
      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < notifications.length; i += this.batchSize) {
        const batch = notifications.slice(i, i + this.batchSize);
        
        const batchPromises = batch.map(notif => 
          this.createNotification(notif.userId, notif.type, notif.data, notif.options)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Small delay between batches
        if (i + this.batchSize < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: true,
        total: notifications.length,
        successful,
        failed,
        results
      };
    } catch (error) {
      console.error('Failed to send bulk notifications:', error);
      throw error;
    }
  }

  async sendSystemNotification(message, priority = 'normal', category = 'system') {
    try {
      // Get all active users
      const usersQuery = query(
        collection(db, 'users'),
        where('status', '!=', 'suspended'),
        limit(1000)
      );

      const snapshot = await getDocs(usersQuery);
      const userIds = [];
      
      snapshot.forEach(doc => {
        userIds.push(doc.id);
      });

      return await this.sendBulkNotification(
        userIds,
        'system_maintenance',
        { message },
        { priority, title: 'System Notification' }
      );
    } catch (error) {
      console.error('Failed to send system notification:', error);
      throw error;
    }
  }

  // =============================================
  // CLEANUP AND MAINTENANCE
  // =============================================

  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldNotificationsQuery = query(
        collection(db, 'notifications'),
        where('createdAt', '<', cutoffDate),
        limit(100)
      );

      const snapshot = await getDocs(oldNotificationsQuery);
      const batch = writeBatch(db);

      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      
      return { success: true, deletedCount: snapshot.size };
    } catch (error) {
      console.error('Failed to cleanup old notifications:', error);
      throw error;
    }
  }

  getQueueStats() {
    return {
      queueLength: this.notificationQueue.length,
      isProcessing: this.isProcessingQueue,
      listeners: this.listeners.size
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
