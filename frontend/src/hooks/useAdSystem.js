import { useState, useEffect, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, getDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';

export function useAdLottery() {
  const [adState, setAdState] = useState({
    watching: false,
    cooldown: 0,
    availableAds: 0,
    loading: false,
    error: null
  });

  const [adConfig, setAdConfig] = useState({
    maxAdsPerDay: 5,
    adDuration: 30,
    minWatchTime: 25,
    cooldownPeriod: 300, // 5 minutes
    adValue: 0.001
  });

  useEffect(() => {
    loadAdConfiguration();
  }, []);

  useEffect(() => {
    if (adState.cooldown > 0) {
      const timer = setTimeout(() => {
        setAdState(prev => ({ ...prev, cooldown: prev.cooldown - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [adState.cooldown]);

  const loadAdConfiguration = async () => {
    try {
      const configDoc = await getDoc(doc(db, 'ad_lottery_config', 'default'));
      if (configDoc.exists()) {
        setAdConfig({ ...adConfig, ...configDoc.data() });
      }
    } catch (error) {
      console.error('Failed to load ad configuration:', error);
    }
  };

  const getUserAdLimits = useCallback(async (userId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const limitsDoc = await getDoc(doc(db, 'user_ticket_limits', `${userId}_${today}`));
      
      if (limitsDoc.exists()) {
        return limitsDoc.data().daily_ads_used || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Failed to get user ad limits:', error);
      return 0;
    }
  }, []);

  const canWatchAd = useCallback(async (userId) => {
    try {
      const usedAds = await getUserAdLimits(userId);
      const availableAds = Math.max(0, adConfig.maxAdsPerDay - usedAds);
      
      return {
        canWatch: availableAds > 0 && adState.cooldown === 0 && !adState.watching,
        availableAds,
        reason: availableAds === 0 ? 'Daily ad limit reached' :
                adState.cooldown > 0 ? `Cooldown active: ${adState.cooldown}s` :
                adState.watching ? 'Currently watching an ad' : null
      };
    } catch (error) {
      console.error('Failed to check ad watch eligibility:', error);
      return { canWatch: false, availableAds: 0, reason: 'Unable to verify eligibility' };
    }
  }, [adConfig.maxAdsPerDay, adState.cooldown, adState.watching, getUserAdLimits]);

  const watchAd = useCallback(async (userId, lotteryTypeId) => {
    try {
      const eligibility = await canWatchAd(userId);
      if (!eligibility.canWatch) {
        throw new Error(eligibility.reason || 'Cannot watch ad at this time');
      }

      setAdState(prev => ({ 
        ...prev, 
        watching: true, 
        loading: true, 
        error: null 
      }));

      // Simulate ad watching process
      const adData = await startAdSession(userId, lotteryTypeId);
      
      // Wait for minimum watch time
      await new Promise(resolve => setTimeout(resolve, adConfig.minWatchTime * 1000));
      
      // Complete ad watching
      const completionResult = await completeAdSession(adData.sessionId, userId);
      
      if (completionResult.success) {
        // Start cooldown period
        setAdState(prev => ({ 
          ...prev, 
          watching: false,
          loading: false,
          cooldown: adConfig.cooldownPeriod,
          availableAds: prev.availableAds - 1
        }));

        return {
          success: true,
          adCompletionId: completionResult.completionId,
          earnedValue: adConfig.adValue
        };
      } else {
        throw new Error('Ad completion verification failed');
      }

    } catch (error) {
      console.error('Ad watching failed:', error);
      setAdState(prev => ({ 
        ...prev, 
        watching: false, 
        loading: false, 
        error: error.message 
      }));
      throw error;
    }
  }, [canWatchAd, adConfig.minWatchTime, adConfig.cooldownPeriod, adConfig.adValue]);

  const startAdSession = async (userId, lotteryTypeId) => {
    try {
      const sessionData = {
        userId,
        lotteryTypeId,
        startTime: new Date(),
        status: 'started',
        adNetwork: 'default',
        expectedDuration: adConfig.adDuration
      };

      const sessionRef = await addDoc(collection(db, 'ad_sessions'), {
        ...sessionData,
        createdAt: serverTimestamp()
      });

      return {
        sessionId: sessionRef.id,
        ...sessionData
      };
    } catch (error) {
      console.error('Failed to start ad session:', error);
      throw error;
    }
  };

  const completeAdSession = async (sessionId, userId) => {
    try {
      const validateAdCompletion = httpsCallable(functions, 'validateAdCompletion');
      
      const completionData = {
        sessionId,
        userId,
        endTime: new Date(),
        watchDuration: adConfig.minWatchTime,
        completed: true
      };

      const result = await validateAdCompletion({
        adCompletionData: completionData,
        lotteryTypeId: 'daily_ads'
      });

      if (result.data.success && result.data.result.isValid) {
        // Update ad session as completed
        await updateDoc(doc(db, 'ad_sessions', sessionId), {
          status: 'completed',
          endTime: serverTimestamp(),
          completedAt: serverTimestamp()
        });

        // Record ad completion
        const completionRef = await addDoc(collection(db, 'ad_completions'), {
          userId,
          sessionId,
          adNetworkId: 'default',
          watchDuration: adConfig.minWatchTime,
          earnedValue: adConfig.adValue,
          completedAt: serverTimestamp()
        });

        return {
          success: true,
          completionId: completionRef.id
        };
      } else {
        throw new Error('Ad completion validation failed');
      }
    } catch (error) {
      console.error('Failed to complete ad session:', error);
      throw error;
    }
  };

  const getAdHistory = useCallback(async (userId, limitCount = 20) => {
    try {
      const adHistoryQuery = query(
        collection(db, 'ad_completions'),
        where('userId', '==', userId),
        orderBy('completedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(adHistoryQuery);
      const history = [];
      
      snapshot.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() });
      });

      return history;
    } catch (error) {
      console.error('Failed to get ad history:', error);
      throw error;
    }
  }, []);

  const getAdStats = useCallback(async (userId) => {
    try {
      const history = await getAdHistory(userId, 100);
      
      const stats = {
        totalAdsWatched: history.length,
        totalEarned: history.reduce((sum, ad) => sum + (ad.earnedValue || 0), 0),
        averageWatchTime: history.reduce((sum, ad) => sum + (ad.watchDuration || 0), 0) / history.length || 0,
        todayAdsWatched: 0,
        weeklyAdsWatched: 0
      };

      // Calculate today's and weekly stats
      const today = new Date().toDateString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      history.forEach(ad => {
        const adDate = ad.completedAt?.toDate() || new Date(ad.completedAt);
        
        if (adDate.toDateString() === today) {
          stats.todayAdsWatched++;
        }
        
        if (adDate >= weekAgo) {
          stats.weeklyAdsWatched++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get ad stats:', error);
      return { totalAdsWatched: 0, totalEarned: 0, averageWatchTime: 0, todayAdsWatched: 0, weeklyAdsWatched: 0 };
    }
  }, [getAdHistory]);

  const skipAd = useCallback(async () => {
    setAdState(prev => ({ 
      ...prev, 
      watching: false, 
      loading: false, 
      error: 'Ad skipped by user' 
    }));
  }, []);

  const resetCooldown = useCallback(() => {
    setAdState(prev => ({ ...prev, cooldown: 0 }));
  }, []);

  const formatCooldownTime = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const updateAvailableAds = useCallback(async (userId) => {
    try {
      const usedAds = await getUserAdLimits(userId);
      const available = Math.max(0, adConfig.maxAdsPerDay - usedAds);
      
      setAdState(prev => ({ ...prev, availableAds: available }));
      return available;
    } catch (error) {
      console.error('Failed to update available ads:', error);
      return 0;
    }
  }, [adConfig.maxAdsPerDay, getUserAdLimits]);

  return {
    adState,
    adConfig,
    canWatchAd,
    watchAd,
    getAdHistory,
    getAdStats,
    skipAd,
    resetCooldown,
    formatCooldownTime,
    updateAvailableAds
  };
}

export function useAdNetwork() {
  const [networkState, setNetworkState] = useState({
    availableNetworks: ['google_admob', 'unity_ads', 'facebook_audience'],
    activeNetwork: 'google_admob',
    networkStats: {},
    loading: false
  });

  const switchNetwork = useCallback(async (networkId) => {
    try {
      setNetworkState(prev => ({ ...prev, loading: true }));
      
      // Validate network availability
      if (!networkState.availableNetworks.includes(networkId)) {
        throw new Error('Ad network not available');
      }

      // Update active network
      setNetworkState(prev => ({ 
        ...prev, 
        activeNetwork: networkId, 
        loading: false 
      }));

      return true;
    } catch (error) {
      console.error('Failed to switch ad network:', error);
      setNetworkState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  }, [networkState.availableNetworks]);

  const getNetworkStats = useCallback(async () => {
    try {
      const statsQuery = query(
        collection(db, 'ad_completions'),
        orderBy('completedAt', 'desc'),
        limit(1000)
      );

      const snapshot = await getDocs(statsQuery);
      const stats = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const network = data.adNetworkId || 'default';
        
        if (!stats[network]) {
          stats[network] = {
            totalAds: 0,
            totalValue: 0,
            avgWatchTime: 0
          };
        }
        
        stats[network].totalAds++;
        stats[network].totalValue += data.earnedValue || 0;
      });

      setNetworkState(prev => ({ ...prev, networkStats: stats }));
      return stats;
    } catch (error) {
      console.error('Failed to get network stats:', error);
      return {};
    }
  }, []);

  return {
    networkState,
    switchNetwork,
    getNetworkStats
  };
}

export default useAdLottery;
