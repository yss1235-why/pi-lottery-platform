const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const { validateAdminPermissions } = require('../middleware/auth');

class ReportGenerator {
  constructor() {
    this.db = admin.firestore();
    this.reportCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Generate comprehensive dashboard report
   */
  async generateDashboardReport(adminId, dateRange = null) {
    try {
      await validateAdminPermissions(adminId, 'view_analytics');

      const cacheKey = `dashboard_${dateRange?.start || 'all'}_${dateRange?.end || 'all'}`;
      const cached = this.reportCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const [
        revenueStats,
        userStats,
        lotteryStats,
        systemHealth,
        recentActivity
      ] = await Promise.all([
        this.generateRevenueReport(adminId, dateRange),
        this.generateUserAnalytics(adminId, dateRange),
        this.generateLotteryPerformance(adminId, dateRange),
        this.getSystemHealthMetrics(),
        this.getRecentActivity(10)
      ]);

      const dashboardReport = {
        generatedAt: new Date().toISOString(),
        generatedBy: adminId,
        dateRange,
        revenue: revenueStats,
        users: userStats,
        lotteries: lotteryStats,
        system: systemHealth,
        recentActivity,
        summary: {
          totalRevenue: revenueStats.totalRevenue,
          totalUsers: userStats.totalUsers,
          activeLotteries: lotteryStats.activeLotteries,
          systemStatus: systemHealth.overallStatus
        }
      };

      // Cache the report
      this.reportCache.set(cacheKey, {
        data: dashboardReport,
        timestamp: Date.now()
      });

      logger.info(`Dashboard report generated by ${adminId}`);
      return dashboardReport;
    } catch (error) {
      logger.error('Failed to generate dashboard report:', error);
      throw error;
    }
  }

  /**
   * Generate revenue analytics report
   */
  async generateRevenueReport(adminId, dateRange = null) {
    try {
      await validateAdminPermissions(adminId, 'view_analytics');

      const now = new Date();
      const startDate = dateRange?.start ? new Date(dateRange.start) : new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.end ? new Date(dateRange.end) : now;

      // Get payment transactions
      let transactionsQuery = this.db.collection('payment_transactions')
        .where('status', '==', 'approved')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate);

      const transactionsSnapshot = await transactionsQuery.get();
      
      let totalRevenue = 0;
      let totalTransactions = 0;
      const revenueByLottery = {};
      const revenueByDate = {};
      const platformFees = {};

      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        const amount = transaction.amount || 0;
        const lotteryType = transaction.lotteryTypeId || 'unknown';
        const date = transaction.createdAt.toDate().toISOString().split('T')[0];
        
        // Calculate platform fee (assuming 0.1 Pi default)
        const platformFee = transaction.platformFee || 0.1;
        const revenue = platformFee;

        totalRevenue += revenue;
        totalTransactions++;

        // Revenue by lottery type
        if (!revenueByLottery[lotteryType]) {
          revenueByLottery[lotteryType] = { revenue: 0, count: 0 };
        }
        revenueByLottery[lotteryType].revenue += revenue;
        revenueByLottery[lotteryType].count++;

        // Revenue by date
        if (!revenueByDate[date]) {
          revenueByDate[date] = 0;
        }
        revenueByDate[date] += revenue;

        // Platform fees tracking
        const feeKey = platformFee.toString();
        if (!platformFees[feeKey]) {
          platformFees[feeKey] = { count: 0, revenue: 0 };
        }
        platformFees[feeKey].count++;
        platformFees[feeKey].revenue += revenue;
      });

      // Calculate averages and trends
      const avgRevenuePerTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      const avgRevenuePerDay = Object.keys(revenueByDate).length > 0 ? 
        totalRevenue / Object.keys(revenueByDate).length : 0;

      // Get previous period for comparison
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - (endDate - startDate) / (24 * 60 * 60 * 1000));
      const previousRevenue = await this.getPreviousPeriodRevenue(previousPeriodStart, startDate);
      
      const revenueGrowth = previousRevenue > 0 ? 
        ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        totalRevenue: parseFloat(totalRevenue.toFixed(4)),
        totalTransactions,
        avgRevenuePerTransaction: parseFloat(avgRevenuePerTransaction.toFixed(4)),
        avgRevenuePerDay: parseFloat(avgRevenuePerDay.toFixed(4)),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
        revenueByLottery,
        revenueByDate,
        platformFees,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate revenue report:', error);
      throw error;
    }
  }

  /**
   * Generate user analytics report
   */
  async generateUserAnalytics(adminId, dateRange = null) {
    try {
      await validateAdminPermissions(adminId, 'view_analytics');

      const now = new Date();
      const startDate = dateRange?.start ? new Date(dateRange.start) : new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.end ? new Date(dateRange.end) : now;

      // Get all users
      const usersSnapshot = await this.db.collection('users').get();
      
      let totalUsers = 0;
      let activeUsers = 0;
      let newUsers = 0;
      const usersByRegDate = {};
      const usersByActivity = {};
      let totalEntries = 0;
      let totalWinnings = 0;

      usersSnapshot.forEach(doc => {
        const user = doc.data();
        totalUsers++;

        // Check if user is active (has entries or recent login)
        const lastLogin = user.lastLogin?.toDate() || new Date(0);
        const isActive = lastLogin >= startDate;
        if (isActive) activeUsers++;

        // Check if user is new
        const createdAt = user.createdAt?.toDate() || new Date(0);
        if (createdAt >= startDate && createdAt <= endDate) {
          newUsers++;
        }

        // Users by registration date
        const regDate = createdAt.toISOString().split('T')[0];
        if (!usersByRegDate[regDate]) {
          usersByRegDate[regDate] = 0;
        }
        usersByRegDate[regDate]++;

        // Activity tracking
        const entriesCount = user.totalEntries || 0;
        if (entriesCount > 0) {
          const activityLevel = entriesCount < 5 ? 'low' : 
                               entriesCount < 20 ? 'medium' : 'high';
          if (!usersByActivity[activityLevel]) {
            usersByActivity[activityLevel] = 0;
          }
          usersByActivity[activityLevel]++;
        }

        totalEntries += entriesCount;
        totalWinnings += user.totalWinnings || 0;
      });

      // Get user entries for the period
      const entriesSnapshot = await this.db.collection('user_entries')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const entriesByDate = {};
      const entriesByLottery = {};

      entriesSnapshot.forEach(doc => {
        const entry = doc.data();
        const date = entry.createdAt.toDate().toISOString().split('T')[0];
        const lotteryType = entry.lotteryTypeId || 'unknown';

        if (!entriesByDate[date]) {
          entriesByDate[date] = 0;
        }
        entriesByDate[date]++;

        if (!entriesByLottery[lotteryType]) {
          entriesByLottery[lotteryType] = 0;
        }
        entriesByLottery[lotteryType]++;
      });

      const avgEntriesPerUser = totalUsers > 0 ? totalEntries / totalUsers : 0;
      const userRetentionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        totalUsers,
        activeUsers,
        newUsers,
        avgEntriesPerUser: parseFloat(avgEntriesPerUser.toFixed(2)),
        userRetentionRate: parseFloat(userRetentionRate.toFixed(2)),
        totalEntries,
        totalWinnings: parseFloat(totalWinnings.toFixed(4)),
        usersByRegDate,
        usersByActivity,
        entriesByDate,
        entriesByLottery,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate user analytics:', error);
      throw error;
    }
  }

  /**
   * Generate lottery performance report
   */
  async generateLotteryPerformance(adminId, dateRange = null) {
    try {
      await validateAdminPermissions(adminId, 'view_analytics');

      const now = new Date();
      const startDate = dateRange?.start ? new Date(dateRange.start) : new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.end ? new Date(dateRange.end) : now;

      // Get lottery instances
      const instancesSnapshot = await this.db.collection('lottery_instances')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const lotteryPerformance = {};
      let totalLotteries = 0;
      let completedLotteries = 0;
      let totalParticipants = 0;
      let totalPrizePool = 0;

      instancesSnapshot.forEach(doc => {
        const instance = doc.data();
        const lotteryType = instance.lotteryTypeId || 'unknown';
        
        totalLotteries++;
        if (instance.status === 'completed') {
          completedLotteries++;
        }
        
        totalParticipants += instance.participants || 0;
        totalPrizePool += instance.prizePool || 0;

        if (!lotteryPerformance[lotteryType]) {
          lotteryPerformance[lotteryType] = {
            total: 0,
            completed: 0,
            active: 0,
            avgParticipants: 0,
            avgPrizePool: 0,
            totalParticipants: 0,
            totalPrizePool: 0
          };
        }

        const perf = lotteryPerformance[lotteryType];
        perf.total++;
        if (instance.status === 'completed') perf.completed++;
        if (instance.status === 'active') perf.active++;
        perf.totalParticipants += instance.participants || 0;
        perf.totalPrizePool += instance.prizePool || 0;
      });

      // Calculate averages
      Object.keys(lotteryPerformance).forEach(lotteryType => {
        const perf = lotteryPerformance[lotteryType];
        perf.avgParticipants = perf.total > 0 ? 
          parseFloat((perf.totalParticipants / perf.total).toFixed(2)) : 0;
        perf.avgPrizePool = perf.total > 0 ? 
          parseFloat((perf.totalPrizePool / perf.total).toFixed(4)) : 0;
        perf.completionRate = perf.total > 0 ? 
          parseFloat(((perf.completed / perf.total) * 100).toFixed(2)) : 0;
      });

      // Get active lotteries count
      const activeLotteriesSnapshot = await this.db.collection('lottery_instances')
        .where('status', '==', 'active')
        .get();

      const activeLotteries = activeLotteriesSnapshot.size;

      // Get recent winners
      const winnersSnapshot = await this.db.collection('lottery_winners')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const recentWinners = [];
      winnersSnapshot.forEach(doc => {
        const winner = doc.data();
        recentWinners.push({
          id: doc.id,
          username: winner.username,
          lotteryType: winner.lotteryInstanceId?.split('_')[0] || 'unknown',
          position: winner.position,
          prizeAmount: winner.prizeAmount,
          status: winner.status,
          createdAt: winner.createdAt.toDate().toISOString()
        });
      });

      const avgParticipantsPerLottery = totalLotteries > 0 ? 
        parseFloat((totalParticipants / totalLotteries).toFixed(2)) : 0;
      const avgPrizePoolPerLottery = totalLotteries > 0 ? 
        parseFloat((totalPrizePool / totalLotteries).toFixed(4)) : 0;
      const completionRate = totalLotteries > 0 ? 
        parseFloat(((completedLotteries / totalLotteries) * 100).toFixed(2)) : 0;

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          totalLotteries,
          completedLotteries,
          activeLotteries,
          completionRate,
          avgParticipantsPerLottery,
          avgPrizePoolPerLottery,
          totalParticipants,
          totalPrizePool: parseFloat(totalPrizePool.toFixed(4))
        },
        lotteryPerformance,
        recentWinners,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate lottery performance report:', error);
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealthMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        database: 'healthy',
        functions: 'healthy',
        authentication: 'healthy',
        overallStatus: 'healthy',
        details: {
          activeConnections: 0,
          errorRate: 0,
          responseTime: 0,
          uptime: process.uptime()
        }
      };

      // Check database connectivity
      try {
        await this.db.collection('system_config').doc('platform').get();
        metrics.database = 'healthy';
      } catch (error) {
        metrics.database = 'error';
        metrics.overallStatus = 'warning';
      }

      // Check recent errors
      const recentErrorsSnapshot = await this.db.collection('admin_logs')
        .where('action', '==', 'error')
        .where('timestamp', '>=', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
        .get();

      const errorCount = recentErrorsSnapshot.size;
      if (errorCount > 10) {
        metrics.overallStatus = 'warning';
      } else if (errorCount > 50) {
        metrics.overallStatus = 'critical';
      }

      metrics.details.errorRate = errorCount;

      return metrics;
    } catch (error) {
      logger.error('Failed to get system health metrics:', error);
      return {
        timestamp: new Date().toISOString(),
        database: 'error',
        functions: 'error',
        authentication: 'unknown',
        overallStatus: 'critical',
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Get recent system activity
   */
  async getRecentActivity(limit = 20) {
    try {
      const activitySnapshot = await this.db.collection('admin_logs')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const activities = [];
      activitySnapshot.forEach(doc => {
        const activity = doc.data();
        activities.push({
          id: doc.id,
          action: activity.action,
          details: activity.details,
          timestamp: activity.timestamp.toDate().toISOString(),
          adminId: activity.adminId || activity.details?.adminId
        });
      });

      return activities;
    } catch (error) {
      logger.error('Failed to get recent activity:', error);
      return [];
    }
  }

  /**
   * Generate financial audit report
   */
  async generateFinancialAuditReport(adminId, dateRange) {
    try {
      await validateAdminPermissions(adminId, 'view_analytics');

      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);

      // Get all financial transactions
      const transactionsSnapshot = await this.db.collection('payment_transactions')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'desc')
        .get();

      const transactions = [];
      let totalIncome = 0;
      let totalPlatformFees = 0;

      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        transactions.push({
          id: doc.id,
          ...transaction,
          createdAt: transaction.createdAt.toDate().toISOString()
        });

        if (transaction.status === 'approved') {
          totalIncome += transaction.amount || 0;
          totalPlatformFees += transaction.platformFee || 0;
        }
      });

      // Get prize distributions
      const winnersSnapshot = await this.db.collection('lottery_winners')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'desc')
        .get();

      const prizeDistributions = [];
      let totalPrizesAwarded = 0;

      winnersSnapshot.forEach(doc => {
        const winner = doc.data();
        prizeDistributions.push({
          id: doc.id,
          ...winner,
          createdAt: winner.createdAt.toDate().toISOString()
        });

        if (winner.status === 'transferred') {
          totalPrizesAwarded += winner.prizeAmount || 0;
        }
      });

      const netRevenue = totalPlatformFees - totalPrizesAwarded;
      const profitMargin = totalIncome > 0 ? (netRevenue / totalIncome) * 100 : 0;

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          totalIncome: parseFloat(totalIncome.toFixed(4)),
          totalPlatformFees: parseFloat(totalPlatformFees.toFixed(4)),
          totalPrizesAwarded: parseFloat(totalPrizesAwarded.toFixed(4)),
          netRevenue: parseFloat(netRevenue.toFixed(4)),
          profitMargin: parseFloat(profitMargin.toFixed(2)),
          transactionCount: transactions.length,
          prizeCount: prizeDistributions.length
        },
        transactions,
        prizeDistributions,
        generatedAt: new Date().toISOString(),
        generatedBy: adminId
      };
    } catch (error) {
      logger.error('Failed to generate financial audit report:', error);
      throw error;
    }
  }

  /**
   * Export report data
   */
  async exportReport(reportType, adminId, dateRange = null, format = 'json') {
    try {
      await validateAdminPermissions(adminId, 'view_analytics');

      let reportData;
      
      switch (reportType) {
        case 'dashboard':
          reportData = await this.generateDashboardReport(adminId, dateRange);
          break;
        case 'revenue':
          reportData = await this.generateRevenueReport(adminId, dateRange);
          break;
        case 'users':
          reportData = await this.generateUserAnalytics(adminId, dateRange);
          break;
        case 'lotteries':
          reportData = await this.generateLotteryPerformance(adminId, dateRange);
          break;
        case 'financial_audit':
          reportData = await this.generateFinancialAuditReport(adminId, dateRange);
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Log export action
      await this.db.collection('admin_logs').add({
        action: 'report_export',
        details: {
          reportType,
          format,
          dateRange,
          adminId
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      if (format === 'csv') {
        return this.convertToCSV(reportData, reportType);
      }

      return reportData;
    } catch (error) {
      logger.error('Failed to export report:', error);
      throw error;
    }
  }

  /**
   * Convert report data to CSV format
   */
  convertToCSV(data, reportType) {
    // Basic CSV conversion - can be enhanced based on specific needs
    const headers = Object.keys(data.summary || data);
    const values = Object.values(data.summary || data);
    
    let csv = headers.join(',') + '\n';
    csv += values.join(',') + '\n';
    
    return csv;
  }

  /**
   * Get previous period revenue for comparison
   */
  async getPreviousPeriodRevenue(startDate, endDate) {
    try {
      const transactionsSnapshot = await this.db.collection('payment_transactions')
        .where('status', '==', 'approved')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<', endDate)
        .get();

      let totalRevenue = 0;
      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        totalRevenue += transaction.platformFee || 0.1;
      });

      return totalRevenue;
    } catch (error) {
      logger.error('Failed to get previous period revenue:', error);
      return 0;
    }
  }

  /**
   * Clear report cache
   */
  clearCache(key = null) {
    if (key) {
      this.reportCache.delete(key);
    } else {
      this.reportCache.clear();
    }
    logger.info('Report cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.reportCache.size,
      entries: Array.from(this.reportCache.keys()),
      timeout: this.cacheTimeout
    };
  }
}

module.exports = new ReportGenerator();
