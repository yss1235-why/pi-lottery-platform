import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { lotteryService } from '../services/lotteryService';

export function useLottery() {
  const [lotteryData, setLotteryData] = useState({
    types: {},
    instances: {},
    loading: true,
    error: null
  });
  const [recentWinners, setRecentWinners] = useState([]);
  const [userTicketLimits, setUserTicketLimits] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    initializeLotteryData();
  }, [refreshTrigger]);

  const initializeLotteryData = async () => {
    try {
      setLotteryData(prev => ({ ...prev, loading: true, error: null }));

      const [types, instances, winners] = await Promise.all([
        lotteryService.getLotteryTypes(),
        lotteryService.getCurrentLotteryInstances(),
        lotteryService.getRecentWinners(10)
      ]);

      setLotteryData({
        types,
        instances,
        loading: false,
        error: null
      });
      
      setRecentWinners(winners);

      // Subscribe to real-time updates
      const unsubscribe = lotteryService.subscribeToLotteryUpdates((updatedInstances) => {
        setLotteryData(prev => ({
          ...prev,
          instances: updatedInstances
        }));
      });

      return unsubscribe;
    } catch (error) {
      console.error('Failed to initialize lottery data:', error);
      setLotteryData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  const enterLottery = useCallback(async (lotteryTypeId, userId, entryMethod, ticketCount = 1, paymentData = null) => {
    try {
      const result = await lotteryService.enterLottery(
        lotteryTypeId,
        userId,
        entryMethod,
        ticketCount,
        paymentData
      );
      
      // Refresh lottery instances after successful entry
      const updatedInstances = await lotteryService.getCurrentLotteryInstances();
      setLotteryData(prev => ({
        ...prev,
        instances: updatedInstances
      }));

      // Update user ticket limits
      await refreshUserTicketLimits(userId);
      
      return result;
    } catch (error) {
      console.error('Failed to enter lottery:', error);
      throw error;
    }
  }, []);

  const getUserStats = useCallback(async (userId) => {
    try {
      return await lotteryService.getUserLotteryStats(userId);
    } catch (error) {
      console.error('Failed to get user stats:', error);
      throw error;
    }
  }, []);

  const getUserTicketLimits = useCallback(async (userId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const limitsDoc = await getDoc(doc(db, 'user_ticket_limits', `${userId}_${today}`));
      
      if (limitsDoc.exists()) {
        return limitsDoc.data();
      }
      
      return {
        daily_pi_used: 0,
        daily_ads_used: 0,
        weekly_pi_used: 0,
        monthly_pi_used: 0
      };
    } catch (error) {
      console.error('Failed to get user ticket limits:', error);
      return {};
    }
  }, []);

  const refreshUserTicketLimits = useCallback(async (userId) => {
    try {
      const limits = await getUserTicketLimits(userId);
      setUserTicketLimits(prev => ({ ...prev, [userId]: limits }));
    } catch (error) {
      console.error('Failed to refresh user ticket limits:', error);
    }
  }, [getUserTicketLimits]);

  const getAvailableTickets = useCallback((lotteryTypeId, userId) => {
    const lotteryType = lotteryData.types[lotteryTypeId];
    const userLimits = userTicketLimits[userId] || {};
    
    if (!lotteryType) return 0;

    const maxTickets = lotteryType.maxTicketsPerUser || 0;
    const usedTickets = userLimits[`${lotteryTypeId}_used`] || 0;
    
    return Math.max(0, maxTickets - usedTickets);
  }, [lotteryData.types, userTicketLimits]);

  const canEnterLottery = useCallback((lotteryTypeId, userId, requestedTickets = 1) => {
    const lotteryType = lotteryData.types[lotteryTypeId];
    
    if (!lotteryType || !lotteryType.isEnabled) {
      return { allowed: false, reason: 'Lottery not available' };
    }

    const availableTickets = getAvailableTickets(lotteryTypeId, userId);
    
    if (availableTickets < requestedTickets) {
      return { 
        allowed: false, 
        reason: `Ticket limit exceeded. ${availableTickets} tickets remaining today.` 
      };
    }

    return { allowed: true };
  }, [lotteryData.types, getAvailableTickets]);

  const getLotteryHistory = useCallback(async (userId, limit = 20) => {
    try {
      const userEntriesQuery = query(
        collection(db, 'user_entries'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );
      
      const snapshot = await getDocs(userEntriesQuery);
      const entries = [];
      
      snapshot.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });

      return entries;
    } catch (error) {
      console.error('Failed to get lottery history:', error);
      throw error;
    }
  }, []);

  const getPrizeStructure = useCallback((participants) => {
    if (participants <= 50) {
      return {
        first: 0.6,
        second: 0.25,
        third: 0.15
      };
    } else if (participants <= 200) {
      return {
        first: 0.5,
        second: 0.25,
        third: 0.15,
        fourth: 0.06,
        fifth: 0.04
      };
    } else {
      return {
        first: 0.4,
        second: 0.2,
        third: 0.15,
        fourth: 0.08,
        fifth: 0.08,
        sixth: 0.08,
        seventh: 0.0225,
        eighth: 0.0225,
        ninth: 0.0225,
        tenth: 0.0225
      };
    }
  }, []);

  const calculatePrizeDistribution = useCallback((lotteryTypeId, participants) => {
    const lotteryType = lotteryData.types[lotteryTypeId];
    const prizeStructure = getPrizeStructure(participants);
    
    if (!lotteryType) return {};

    let prizePool;
    if (lotteryTypeId === 'daily_ads') {
      prizePool = participants * (lotteryType.adValue || 0.001);
    } else {
      prizePool = participants * (lotteryType.entryFee - lotteryType.platformFee);
    }

    const prizes = {};
    Object.entries(prizeStructure).forEach(([position, percentage]) => {
      prizes[position] = prizePool * percentage;
    });

    return prizes;
  }, [lotteryData.types, getPrizeStructure]);

  const getTimeUntilDraw = useCallback((scheduledDrawTime) => {
    if (!scheduledDrawTime) return null;
    
    const now = new Date();
    const drawTime = scheduledDrawTime.toDate ? scheduledDrawTime.toDate() : new Date(scheduledDrawTime);
    const diff = drawTime - now;
    
    if (diff <= 0) return { expired: true };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds, expired: false };
  }, []);

  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const subscribeToWinners = useCallback((callback) => {
    const winnersQuery = query(
      collection(db, 'lottery_winners'),
      where('status', '==', 'transferred'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    return onSnapshot(winnersQuery, (snapshot) => {
      const winners = [];
      snapshot.forEach(doc => {
        winners.push({ id: doc.id, ...doc.data() });
      });
      callback(winners);
    });
  }, []);

  const getLotteryStats = useCallback(async () => {
    try {
      const [totalLotteries, totalPrizes, totalUsers] = await Promise.all([
        getDocs(collection(db, 'lottery_instances')),
        getDocs(collection(db, 'lottery_winners')),
        getDocs(collection(db, 'users'))
      ]);

      return {
        totalLotteries: totalLotteries.size,
        totalPrizes: totalPrizes.size,
        totalUsers: totalUsers.size
      };
    } catch (error) {
      console.error('Failed to get lottery stats:', error);
      return { totalLotteries: 0, totalPrizes: 0, totalUsers: 0 };
    }
  }, []);

  return {
    lotteryTypes: lotteryData.types,
    lotteryInstances: lotteryData.instances,
    recentWinners,
    loading: lotteryData.loading,
    error: lotteryData.error,
    userTicketLimits,
    enterLottery,
    getUserStats,
    getUserTicketLimits,
    getAvailableTickets,
    canEnterLottery,
    getLotteryHistory,
    calculatePrizeDistribution,
    getTimeUntilDraw,
    refreshData,
    subscribeToWinners,
    getLotteryStats,
    refreshUserTicketLimits
  };
}

export function useLotteryInstance(lotteryTypeId) {
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lotteryTypeId) return;

    const loadInstance = async () => {
      try {
        setLoading(true);
        const currentInstance = await lotteryService.getCurrentLotteryInstance(lotteryTypeId);
        setInstance(currentInstance);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadInstance();

    // Subscribe to real-time updates for this specific instance
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'lottery_instances'),
        where('lotteryTypeId', '==', lotteryTypeId),
        where('status', '==', 'active'),
        limit(1)
      ),
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setInstance({ id: doc.id, ...doc.data() });
        } else {
          setInstance(null);
        }
      }
    );

    return () => unsubscribe();
  }, [lotteryTypeId]);

  return { instance, loading, error };
}

export default useLottery;
