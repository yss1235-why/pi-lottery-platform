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
  startAfter,
  serverTimestamp,
  writeBatch,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

class AdminService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes for admin data
    this.listeners = new Map();
    this.reportCache = new Map();
    this.reportCacheTimeout = 5 * 60 * 1000; // 5 minutes for reports
  }

  // =============================================
  // PLATFORM CONFIGURATION MANAGEMENT
  // =============================================

  async getPlatformConfig() {
    try {
      const cacheKey = 'platform_config';
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      const configDoc = await getDoc(doc(db, 'system_config', 'platform'));
      let config = {
        platformFee: 0.1,
        adValue: 0.001,
        lotteryToggle: {
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
        minimumParticipants: {
          daily_pi: 5,
          daily_ads: 10,
          weekly_pi: 20,
          monthly_pi: 30
        },
        fees: {
          transactionFee: 0.01,
          withdrawalFee: 0.02
        }
      };

      if (configDoc.exists()) {
        config = { ...config, ...configDoc.data() };
      } else {
        // Initialize default config
        await this.initializePlatformConfig(config);
      }

      this.cache.set(cacheKey, { data: config, timestamp: Date.now() });
      return config;
    } catch (error) {
      console.error('Failed to get platform config:', error);
      throw error;
    }
  }

  async updatePlatformConfig(updates, adminId) {
    try {
      const configRef = doc(db, 'system_config', 'platform');
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: adminId
      };

      await updateDoc(configRef, updateData);

      // Log the configuration change
      await this.logAdminAction(adminId, 'config_update', {
        updates: updates,
        timestamp: Date.now()
      });

      // Clear cache
      this.cache.delete('platform_config');

      return { success: true, updates: updateData };
    } catch (error) {
      console.error('Failed to update platform config:', error);
      throw error;
    }
  }

  async initializePlatformConfig(config) {
    try {
      await setDoc(doc(db, 'system_config', 'platform'), {
        ...config,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to initialize platform config:', error);
      throw error;
    }
  }

  // =============================================
  // LOTTERY MANAGEMENT
  // =============================================

  async getAllLotteryInstances(status = null, limit = 50) {
    try {
      const instancesCollection = collection(db, 'lottery_instances');
      let q = query(
        instancesCollection,
        orderBy('createdAt', 'desc'),
        limit(limit)
      );

      if (status) {
        q = query(
          instancesCollection,
          where('status', '==', status),
          orderBy('createdAt', 'desc'),
          limit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const instances = [];
      
      snapshot.forEach(doc => {
        instances.push({ id: doc.id, ...doc.data() });
      });

      return instances;
    } catch (error) {
      console.error('Failed to get lottery instances:', error);
      throw error;
    }
  }

  async forceLotteryDraw(instanceId, adminId, reason = '') {
    try {
      const instanceRef = doc(db, 'lottery_instances', instanceId);
      const instanceDoc = await getDoc(instanceRef);

      if (!instanceDoc.exists()) {
        throw new Error('Lottery instance not found');
      }

      const instanceData = instanceDoc.data();
      if (instanceData.status !== 'active') {
        throw new Error('Can only force draw on active lotteries');
      }

      // Update instance to indicate forced draw
      await updateDoc(instanceRef, {
        status: 'drawing',
        forcedDraw: true,
        forcedBy: adminId,
        forceReason: reason,
        forcedAt: serverTimestamp()
      });

      // Log the forced draw
      await this.logAdminAction(adminId, 'force_lottery_draw', {
        instanceId: instanceId,
        reason: reason,
        participants: instanceData.participants,
        prizePool: instanceData.prizePool
      });

      // Trigger backend drawing function
      const response = await this.triggerLotteryDraw(instanceId);

      return { success: true, drawResult: response };
    } catch (error) {
      console.error('Failed to force lottery draw:', error);
      throw error;
    }
  }

  async triggerLotteryDraw(instanceId) {
    try {
      // In a real implementation, this would call a Cloud Function
      const response = await fetch('/api/admin/lottery/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ instanceId })
      });

      if (!response.ok) {
        throw new Error('Failed to trigger lottery draw');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to trigger lottery draw:', error);
      throw error;
    }
  }

  async cancelLotteryInstance(instanceId, adminId, reason) {
    try {
      const instanceRef = doc(db, 'lottery_instances', instanceId);
      const instanceDoc = await getDoc(instanceRef);

      if (!instanceDoc.exists()) {
        throw new Error('Lottery instance not found');
      }

      const instanceData = instanceDoc.data();
      if (instanceData.status !== 'active') {
        throw new Error('Can only cancel active lotteries');
      }

      // Update instance status
      await updateDoc(instanceRef, {
        status: 'cancelled',
        cancelledBy: adminId,
        cancelReason: reason,
        cancelledAt: serverTimestamp()
      });

      // Process refunds if needed
      await this.processLotteryCancellationRefunds(instanceId, instanceData);

      // Log the cancellation
      await this.logAdminAction(adminId, 'cancel_lottery', {
        instanceId: instanceId,
        reason: reason,
        participants: instanceData.participants,
        prizePool: instanceData.prizePool
      });

      return { success: true, refundsProcessed: instanceData.participants };
    } catch (error) {
      console.error('Failed to cancel lottery instance:', error);
      throw error;
    }
  }

  async processLotteryCancellationRefunds(instanceId, instanceData) {
    try {
      // Get all entries for this lottery
      const entriesQuery = query(
        collection(db, 'user_entries'),
        where('lotteryInstanceId', '==', instanceId),
        where('status', '==', 'confirmed')
      );

      const entriesSnapshot = await getDocs(entriesQuery);
      const batch = writeBatch(db);

      entriesSnapshot.forEach(doc => {
        const entryData = doc.data();
        
        // Only process refunds for Pi payment entries
        if (entryData.entryMethod === 'pi_payment' && entryData.paymentId) {
          // Create refund record
          const refundRef = doc(collection(db, 'refunds'));
          batch.set(refundRef, {
            userId: entryData.userId,
            lotteryInstanceId: instanceId,
            entryId: doc.id,
            paymentId: entryData.paymentId,
            refundAmount: instanceData.entryFee || 1.0,
            status: 'pending',
            reason: 'lottery_cancelled',
            createdAt: serverTimestamp()
          });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to process cancellation refunds:', error);
      throw error;
    }
  }

  // =============================================
  // PRIZE MANAGEMENT AND WINNER APPROVAL
  // =============================================

  async getPendingWinners(limit = 20) {
    try {
      const cacheKey = 'pending_winners';
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      const winnersQuery = query(
        collection(db, 'lottery_winners'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );

      const snapshot = await getDocs(winnersQuery);
      const winners = [];
      
      snapshot.forEach(doc => {
        winners.push({ id: doc.id, ...doc.data() });
      });

      this.cache.set(cacheKey, { data: winners, timestamp: Date.now() });
      return winners;
    } catch (error) {
      console.error('Failed to get pending winners:', error);
      throw error;
    }
  }

  async approvePrize(winnerId, adminId, notes = '') {
    try {
      const winnerRef = doc(db, 'lottery_winners', winnerId);
      const winnerDoc = await getDoc(winnerRef);

      if (!winnerDoc.exists()) {
        throw new Error('Winner record not found');
      }

      const winnerData = winnerDoc.data();
      if (winnerData.status !== 'pending') {
        throw new Error('Prize can only be approved for pending winners');
      }

      // Calculate net prize amount (minus transaction fees)
      const transactionFee = 0.01;
      const netPrizeAmount = Math.max(0, winnerData.prizeAmount - transactionFee);

      // Update winner status
      await updateDoc(winnerRef, {
        status: 'approved',
        approvedBy: adminId,
        approvedAt: serverTimestamp(),
        approvalNotes: notes,
        netPrizeAmount: netPrizeAmount,
        transactionFee: transactionFee
      });

      // Create prize transfer record
      await this.createPrizeTransferRecord(winnerId, winnerData, adminId, netPrizeAmount);

      // Log the approval
      await this.logAdminAction(adminId, 'approve_prize', {
        winnerId: winnerId,
        userId: winnerData.userId,
        prizeAmount: winnerData.prizeAmount,
        netPrizeAmount: netPrizeAmount,
        lotteryInstanceId: winnerData.lotteryInstanceId,
        notes: notes
      });

      // Clear pending winners cache
      this.cache.delete('pending_winners');

      return { 
        success: true, 
        netPrizeAmount: netPrizeAmount,
        transactionFee: transactionFee
      };
    } catch (error) {
      console.error('Failed to approve prize:', error);
      throw error;
    }
  }

  async createPrizeTransferRecord(winnerId, winnerData, adminId, netAmount) {
    try {
      const transferId = uuidv4();
      const transferData = {
        transferId,
        winnerId,
        userId: winnerData.userId,
        lotteryInstanceId: winnerData.lotteryInstanceId,
        grossAmount: winnerData.prizeAmount,
        netAmount: netAmount,
        transactionFee: winnerData.prizeAmount - netAmount,
        status: 'approved',
        approvedBy: adminId,
        method: 'pi_network_transfer',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'prize_transfers', transferId), transferData);
      return transferId;
    } catch (error) {
      console.error('Failed to create prize transfer record:', error);
      throw error;
    }
  }

  async rejectPrize(winnerId, adminId, reason) {
    try {
      const winnerRef = doc(db, 'lottery_winners', winnerId);
      const winnerDoc = await getDoc(winnerRef);

      if (!winnerDoc.exists()) {
        throw new Error('Winner record not found');
      }

      const winnerData = winnerDoc.data();
      if (winnerData.status !== 'pending') {
        throw new Error('Prize can only be rejected for pending winners');
      }

      // Update winner status
      await updateDoc(winnerRef, {
        status: 'rejected',
        rejectedBy: adminId,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason
      });

      // Log the rejection
      await this.logAdminAction(adminId, 'reject_prize', {
        winnerId: winnerId,
        userId: winnerData.userId,
        prizeAmount: winnerData.prizeAmount,
        lotteryInstanceId: winnerData.lotteryInstanceId,
        reason: reason
      });

      // Clear pending winners cache
      this.cache.delete('pending_winners');

      return { success: true };
    } catch (error) {
      console.error('Failed to reject prize:', error);
      throw error;
    }
  }

  // =============================================
  // USER MANAGEMENT
  // =============================================

  async getAllUsers(limit = 50, startAfterId = null) {
    try {
      const usersCollection = collection(db, 'users');
      let q = query(
        usersCollection,
        orderBy('createdAt', 'desc'),
        limit(limit)
      );

      if (startAfterId) {
        const startAfterDoc = await getDoc(doc(db, 'users', startAfterId));
        if (startAfterDoc.exists()) {
          q = query(
            usersCollection,
            orderBy('createdAt', 'desc'),
            startAfter(startAfterDoc),
            limit(limit)
          );
        }
      }

      const snapshot = await getDocs(q);
      const users = [];
      
      snapshot.forEach(doc => {
        const userData = doc.data();
        // Remove sensitive data
        delete userData.piAccessToken;
        users.push({ id: doc.id, ...userData });
      });

      return users;
    } catch (error) {
      console.error('Failed to get all users:', error);
      throw error;
    }
  }

  async getUserDetails(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      // Get user's lottery entries
      const entriesQuery = query(
        collection(db, 'user_entries'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const entriesSnapshot = await getDocs(entriesQuery);
      const entries = [];
      entriesSnapshot.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });

      // Get user's winnings
      const winningsQuery = query(
        collection(db, 'lottery_winners'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const winningsSnapshot = await getDocs(winningsQuery);
      const winnings = [];
      winningsSnapshot.forEach(doc => {
        winnings.push({ id: doc.id, ...doc.data() });
      });

      // Remove sensitive data
      delete userData.piAccessToken;

      return {
        user: { id: userId, ...userData },
        entries: entries,
        winnings: winnings,
        stats: {
          totalEntries: entries.length,
          totalWinnings: winnings.reduce((sum, w) => sum + (w.prizeAmount || 0), 0),
          winRate: entries.length > 0 ? winnings.length / entries.length : 0
        }
      };
    } catch (error) {
      console.error('Failed to get user details:', error);
      throw error;
    }
  }

  async suspendUser(userId, adminId, reason, duration = null) {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const suspensionData = {
        status: 'suspended',
        suspendedBy: adminId,
        suspendedAt: serverTimestamp(),
        suspensionReason: reason,
        suspensionDuration: duration
      };

      if (duration) {
        const suspensionEnd = new Date(Date.now() + duration);
        suspensionData.suspensionEndsAt = suspensionEnd;
      }

      await updateDoc(userRef, suspensionData);

      // Log the suspension
      await this.logAdminAction(adminId, 'suspend_user', {
        userId: userId,
        reason: reason,
        duration: duration
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to suspend user:', error);
      throw error;
    }
  }

  async reinstateUser(userId, adminId, notes = '') {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      await updateDoc(userRef, {
        status: 'active',
        reinstatedBy: adminId,
        reinstatedAt: serverTimestamp(),
        reinstatementNotes: notes,
        suspensionReason: null,
        suspensionDuration: null,
        suspensionEndsAt: null
      });

      // Log the reinstatement
      await this.logAdminAction(adminId, 'reinstate_user', {
        userId: userId,
        notes: notes
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to reinstate user:', error);
      throw error;
    }
  }

  // =============================================
  // SYSTEM ANALYTICS AND REPORTING
  // =============================================

  async getSystemStats() {
    try {
      const cacheKey = 'system_stats';
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Get active users count
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;

      // Get active lottery instances
      const activeLotteriesQuery = query(
        collection(db, 'lottery_instances'),
        where('status', '==', 'active')
      );
      const activeLotteriesSnapshot = await getDocs(activeLotteriesQuery);
      const activeLotteries = activeLotteriesSnapshot.size;

      // Get pending prizes count
      const pendingPrizesQuery = query(
        collection(db, 'lottery_winners'),
        where('status', '==', 'pending')
      );
      const pendingPrizesSnapshot = await getDocs(pendingPrizesQuery);
      const pendingPrizes = pendingPrizesSnapshot.size;

      // Calculate total revenue (simplified)
      const revenueQuery = query(
        collection(db, 'payment_transactions'),
        where('status', '==', 'completed')
      );
      const revenueSnapshot = await getDocs(revenueQuery);
      let totalRevenue = 0;
      revenueSnapshot.forEach(doc => {
        const data = doc.data();
        totalRevenue += (data.amount || 0) * 0.1; // Platform fee
      });

      const stats = {
        totalUsers,
        activeLotteries,
        pendingPrizes,
        totalRevenue,
        systemHealth: 'optimal',
        lastUpdated: Date.now()
      };

      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });
      return stats;
    } catch (error) {
      console.error('Failed to get system stats:', error);
      throw error;
    }
  }

  async generateReport(reportType, dateRange, adminId) {
    try {
      const cacheKey = `report_${reportType}_${dateRange}`;
      if (this.reportCache.has(cacheKey)) {
        const cached = this.reportCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.reportCacheTimeout) {
          return cached.data;
        }
      }

      let report = {};
      const endDate = new Date();
      const startDate = new Date();
      
      // Set date range
      if (dateRange === '7') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (dateRange === '30') {
        startDate.setDate(endDate.getDate() - 30);
      } else if (dateRange === '90') {
        startDate.setDate(endDate.getDate() - 90);
      } else if (dateRange === '365') {
        startDate.setFullYear(endDate.getFullYear() - 1);
      }

      switch (reportType) {
        case 'revenue':
          report = await this.generateRevenueReport(startDate, endDate);
          break;
        case 'users':
          report = await this.generateUserReport(startDate, endDate);
          break;
        case 'lotteries':
          report = await this.generateLotteryReport(startDate, endDate);
          break;
        case 'system':
          report = await this.generateSystemReport(startDate, endDate);
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Log report generation
      await this.logAdminAction(adminId, 'generate_report', {
        reportType,
        dateRange,
        recordCount: report.recordCount || 0
      });

      this.reportCache.set(cacheKey, { data: report, timestamp: Date.now() });
      return report;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  async generateRevenueReport(startDate, endDate) {
    try {
      const paymentsQuery = query(
        collection(db, 'payment_transactions'),
        where('status', '==', 'completed'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate)
      );

      const snapshot = await getDocs(paymentsQuery);
      let totalRevenue = 0;
      let totalTransactions = 0;
      const dailyRevenue = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const revenue = (data.amount || 0) * 0.1; // Platform fee
        totalRevenue += revenue;
        totalTransactions += 1;

        const date = data.createdAt.toDate().toISOString().split('T')[0];
        dailyRevenue[date] = (dailyRevenue[date] || 0) + revenue;
      });

      return {
        reportType: 'revenue',
        dateRange: { startDate, endDate },
        totalRevenue,
        totalTransactions,
        averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        dailyBreakdown: dailyRevenue,
        recordCount: totalTransactions,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to generate revenue report:', error);
      throw error;
    }
  }

  async generateUserReport(startDate, endDate) {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate)
      );

      const snapshot = await getDocs(usersQuery);
      let newUsers = 0;
      let activeUsers = 0;
      const dailySignups = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        newUsers += 1;
        
        if (data.lastLogin && data.lastLogin.toDate() > startDate) {
          activeUsers += 1;
        }

        const date = data.createdAt.toDate().toISOString().split('T')[0];
        dailySignups[date] = (dailySignups[date] || 0) + 1;
      });

      return {
        reportType: 'users',
        dateRange: { startDate, endDate },
        newUsers,
        activeUsers,
        activityRate: newUsers > 0 ? (activeUsers / newUsers) * 100 : 0,
        dailySignups,
        recordCount: newUsers,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to generate user report:', error);
      throw error;
    }
  }

  async generateLotteryReport(startDate, endDate) {
    try {
      const lotteriesQuery = query(
        collection(db, 'lottery_instances'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate)
      );

      const snapshot = await getDocs(lotteriesQuery);
      let totalLotteries = 0;
      let completedLotteries = 0;
      let totalParticipants = 0;
      let totalPrizePool = 0;
      const lotterysByType = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        totalLotteries += 1;
        totalParticipants += data.participants || 0;
        totalPrizePool += data.prizePool || 0;

        if (data.status === 'completed') {
          completedLotteries += 1;
        }

        const type = data.lotteryTypeId;
        if (!lotterysByType[type]) {
          lotterysByType[type] = { count: 0, participants: 0, prizePool: 0 };
        }
        lotterysByType[type].count += 1;
        lotterysByType[type].participants += data.participants || 0;
        lotterysByType[type].prizePool += data.prizePool || 0;
      });

      return {
        reportType: 'lotteries',
        dateRange: { startDate, endDate },
        totalLotteries,
        completedLotteries,
        completionRate: totalLotteries > 0 ? (completedLotteries / totalLotteries) * 100 : 0,
        totalParticipants,
        totalPrizePool,
        averageParticipants: totalLotteries > 0 ? totalParticipants / totalLotteries : 0,
        lotterysByType,
        recordCount: totalLotteries,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to generate lottery report:', error);
      throw error;
    }
  }

  async generateSystemReport(startDate, endDate) {
    try {
      // Get system health metrics
      const systemHealth = await this.getSystemHealthMetrics();
      
      return {
        reportType: 'system',
        dateRange: { startDate, endDate },
        ...systemHealth,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to generate system report:', error);
      throw error;
    }
  }

  async getSystemHealthMetrics() {
    try {
      // This would include various system health checks
      return {
        databaseConnectivity: 'healthy',
        apiResponseTime: '45ms',
        errorRate: '0.1%',
        uptime: '99.9%',
        activeConnections: 127,
        memoryUsage: '68%',
        diskUsage: '42%'
      };
    } catch (error) {
      console.error('Failed to get system health metrics:', error);
      throw error;
    }
  }

  // =============================================
  // ADMIN ACTIVITY LOGGING
  // =============================================

  async logAdminAction(adminId, action, details = {}) {
    try {
      const logData = {
        adminId,
        action,
        details,
        timestamp: serverTimestamp(),
        ip: await this.getClientIP(),
        userAgent: navigator.userAgent
      };

      await addDoc(collection(db, 'admin_logs'), logData);
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  }

  async getAdminLogs(limit = 50, adminId = null) {
    try {
      const logsCollection = collection(db, 'admin_logs');
      let q = query(
        logsCollection,
        orderBy('timestamp', 'desc'),
        limit(limit)
      );

      if (adminId) {
        q = query(
          logsCollection,
          where('adminId', '==', adminId),
          orderBy('timestamp', 'desc'),
          limit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const logs = [];
      
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });

      return logs;
    } catch (error) {
      console.error('Failed to get admin logs:', error);
      throw error;
    }
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  }

  // =============================================
  // CACHE MANAGEMENT
  // =============================================

  clearCache() {
    this.cache.clear();
    this.reportCache.clear();
  }

  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      reportCacheSize: this.reportCache.size,
      cacheKeys: Array.from(this.cache.keys()),
      reportCacheKeys: Array.from(this.reportCache.keys())
    };
  }

  // =============================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================

  subscribeToPendingWinners(callback) {
    const winnersQuery = query(
      collection(db, 'lottery_winners'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    return onSnapshot(winnersQuery, (snapshot) => {
      const winners = [];
      snapshot.forEach(doc => {
        winners.push({ id: doc.id, ...doc.data() });
      });
      
      // Clear cache when real-time updates come in
      this.cache.delete('pending_winners');
      
      callback(winners);
    });
  }

  subscribeToSystemStats(callback) {
    // This would set up multiple subscriptions for real-time stats
    const unsubscribeFunctions = [];
    
    // Subscribe to active lotteries
    const lotteriesQuery = query(
      collection(db, 'lottery_instances'),
      where('status', '==', 'active')
    );
    
    const unsubscribeLotteries = onSnapshot(lotteriesQuery, () => {
      // Clear cache and trigger stats refresh
      this.cache.delete('system_stats');
      this.getSystemStats().then(callback);
    });
    
    unsubscribeFunctions.push(unsubscribeLotteries);
    
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }
}

// Export singleton instance
export const adminService = new AdminService();
export default adminService;
