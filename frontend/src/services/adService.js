import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  getDocs 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

class AdService {
  constructor() {
    this.adNetworks = {
      google_admob: {
        name: 'Google AdMob',
        minWatchTime: 25,
        adDuration: 30,
        revenueShare: 0.003,
        isEnabled: true
      },
      unity_ads: {
        name: 'Unity Ads',
        minWatchTime: 27,
        adDuration: 30,
        revenueShare: 0.0025,
        isEnabled: false
      },
      facebook_audience: {
        name: 'Facebook Audience Network',
        minWatchTime: 25,
        adDuration: 30,
        revenueShare: 0.0028,
        isEnabled: false
      }
    };
    
    this.dailyAdLimit = 5;
    this.cooldownPeriod = 300000; // 5 minutes in milliseconds
    this.userCooldowns = new Map();
    this.adSessions = new Map();
    this.verificationQuestions = [
      {
        question: "What was the main product advertised?",
        options: ["Smartphone", "Headphones", "Laptop", "Tablet"],
        correctAnswer: "Headphones"
      },
      {
        question: "What color was prominently featured in the ad?",
        options: ["Red", "Blue", "Green", "Yellow"],
        correctAnswer: "Blue"
      },
      {
        question: "What was the special offer mentioned?",
        options: ["50% off", "Buy 1 Get 1", "Free shipping", "30% off"],
        correctAnswer: "30% off"
      },
      {
        question: "What brand was advertised?",
        options: ["TechCorp", "SoundMax", "AudioPro", "MegaSound"],
        correctAnswer: "SoundMax"
      },
      {
        question: "What was the discount percentage?",
        options: ["20%", "25%", "30%", "35%"],
        correctAnswer: "30%"
      }
    ];
  }

  async getAdNetworks() {
    try {
      const networksCollection = collection(db, 'ad_networks');
      const snapshot = await getDocs(networksCollection);
      
      if (snapshot.empty) {
        await this.initializeAdNetworks();
        return this.adNetworks;
      }
      
      const networks = {};
      snapshot.forEach(doc => {
        networks[doc.id] = { id: doc.id, ...doc.data() };
      });
      
      return networks;
    } catch (error) {
      console.error('Failed to get ad networks:', error);
      throw error;
    }
  }

  async initializeAdNetworks() {
    try {
      const promises = Object.entries(this.adNetworks).map(([networkId, config]) => {
        return setDoc(doc(db, 'ad_networks', networkId), {
          ...config,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      await Promise.all(promises);
      console.log('Ad networks initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ad networks:', error);
      throw error;
    }
  }

  async canWatchAd(userId) {
    try {
      // Check daily limit
      const dailyCount = await this.getUserDailyAdCount(userId);
      if (dailyCount >= this.dailyAdLimit) {
        return {
          canWatch: false,
          reason: `Daily ad limit reached (${this.dailyAdLimit} ads per day)`,
          remainingAds: 0,
          cooldownTime: 0
        };
      }

      // Check cooldown
      const cooldownRemaining = this.getUserCooldownTime(userId);
      if (cooldownRemaining > 0) {
        return {
          canWatch: false,
          reason: 'Cooldown period active',
          remainingAds: this.dailyAdLimit - dailyCount,
          cooldownTime: cooldownRemaining
        };
      }

      return {
        canWatch: true,
        reason: null,
        remainingAds: this.dailyAdLimit - dailyCount,
        cooldownTime: 0
      };
    } catch (error) {
      console.error('Failed to check ad watch eligibility:', error);
      return {
        canWatch: false,
        reason: 'Unable to verify eligibility',
        remainingAds: 0,
        cooldownTime: 0
      };
    }
  }

  async getUserDailyAdCount(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const adCountDoc = await getDoc(doc(db, 'user_ad_limits', `${userId}_${today}`));
      
      if (adCountDoc.exists()) {
        return adCountDoc.data().adsWatched || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Failed to get user daily ad count:', error);
      return this.dailyAdLimit; // Return limit to prevent watching if error
    }
  }

  getUserCooldownTime(userId) {
    const cooldownEnd = this.userCooldowns.get(userId);
    if (!cooldownEnd) return 0;
    
    const remaining = cooldownEnd - Date.now();
    return Math.max(0, remaining);
  }

  async startAdSession(userId, networkId = 'google_admob') {
    try {
      const eligibility = await this.canWatchAd(userId);
      if (!eligibility.canWatch) {
        throw new Error(eligibility.reason);
      }

      const network = this.adNetworks[networkId];
      if (!network || !network.isEnabled) {
        throw new Error('Ad network not available');
      }

      const sessionId = uuidv4();
      const adSession = {
        sessionId,
        userId,
        networkId,
        startTime: Date.now(),
        duration: network.adDuration,
        minWatchTime: network.minWatchTime,
        status: 'started',
        watchedTime: 0,
        verificationRequired: true,
        rewardAmount: network.revenueShare
      };

      this.adSessions.set(sessionId, adSession);
      
      // Record ad session in database
      await this.recordAdSession(adSession);

      return {
        sessionId,
        duration: network.adDuration,
        networkName: network.name,
        rewardAmount: network.revenueShare
      };
    } catch (error) {
      console.error('Failed to start ad session:', error);
      throw error;
    }
  }

  async completeAdWatch(sessionId, watchedTime) {
    try {
      const adSession = this.adSessions.get(sessionId);
      if (!adSession) {
        throw new Error('Ad session not found');
      }

      const network = this.adNetworks[adSession.networkId];
      if (!network) {
        throw new Error('Ad network configuration not found');
      }

      // Validate watched time
      if (watchedTime < network.minWatchTime) {
        throw new Error(`Insufficient watch time. Required: ${network.minWatchTime}s, watched: ${watchedTime}s`);
      }

      // Update session
      adSession.watchedTime = watchedTime;
      adSession.completedAt = Date.now();
      adSession.status = 'completed';
      
      // Generate verification question
      const verification = this.generateVerificationQuestion();
      adSession.verification = verification;

      // Update database record
      await this.updateAdSession(sessionId, {
        watchedTime,
        completedAt: serverTimestamp(),
        status: 'completed',
        verification: verification
      });

      return {
        sessionId,
        watchedTime,
        verification,
        rewardAmount: adSession.rewardAmount
      };
    } catch (error) {
      console.error('Failed to complete ad watch:', error);
      throw error;
    }
  }

  async verifyAdCompletion(sessionId, userAnswer) {
    try {
      const adSession = this.adSessions.get(sessionId);
      if (!adSession) {
        throw new Error('Ad session not found');
      }

      if (adSession.status !== 'completed') {
        throw new Error('Ad session not completed');
      }

      const verification = adSession.verification;
      if (!verification) {
        throw new Error('No verification data found');
      }

      const isCorrect = userAnswer === verification.correctAnswer;
      
      if (isCorrect) {
        // Mark as verified
        adSession.status = 'verified';
        adSession.verifiedAt = Date.now();
        
        // Process reward
        const reward = await this.processAdReward(adSession);
        
        // Update database
        await this.updateAdSession(sessionId, {
          status: 'verified',
          verifiedAt: serverTimestamp(),
          userAnswer,
          rewardProcessed: true,
          rewardAmount: reward.amount
        });

        // Set cooldown
        this.setCooldown(adSession.userId);
        
        // Update daily count
        await this.updateDailyAdCount(adSession.userId);
        
        // Clean up session
        this.adSessions.delete(sessionId);

        return {
          verified: true,
          reward: reward,
          cooldownTime: this.cooldownPeriod
        };
      } else {
        // Mark as failed
        adSession.status = 'verification_failed';
        adSession.failedAt = Date.now();
        
        await this.updateAdSession(sessionId, {
          status: 'verification_failed',
          failedAt: serverTimestamp(),
          userAnswer
        });

        // Set a shorter cooldown for failed verification
        this.setCooldown(adSession.userId, this.cooldownPeriod / 2);
        
        this.adSessions.delete(sessionId);

        return {
          verified: false,
          correctAnswer: verification.correctAnswer,
          cooldownTime: this.cooldownPeriod / 2
        };
      }
    } catch (error) {
      console.error('Failed to verify ad completion:', error);
      throw error;
    }
  }

  generateVerificationQuestion() {
    const question = this.verificationQuestions[
      Math.floor(Math.random() * this.verificationQuestions.length)
    ];
    
    // Shuffle options
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    
    return {
      question: question.question,
      options: shuffledOptions,
      correctAnswer: question.correctAnswer
    };
  }

  async processAdReward(adSession) {
    try {
      const rewardAmount = adSession.rewardAmount;
      
      // In a real implementation, this would credit the user's account
      // For now, we'll just record the reward
      const rewardId = uuidv4();
      const rewardData = {
        rewardId,
        userId: adSession.userId,
        sessionId: adSession.sessionId,
        amount: rewardAmount,
        type: 'ad_reward',
        networkId: adSession.networkId,
        status: 'processed',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'ad_rewards', rewardId), rewardData);

      return {
        rewardId,
        amount: rewardAmount,
        type: 'ad_reward'
      };
    } catch (error) {
      console.error('Failed to process ad reward:', error);
      throw error;
    }
  }

  setCooldown(userId, duration = this.cooldownPeriod) {
    const cooldownEnd = Date.now() + duration;
    this.userCooldowns.set(userId, cooldownEnd);
    
    // Clear cooldown after duration
    setTimeout(() => {
      this.userCooldowns.delete(userId);
    }, duration);
  }

  async updateDailyAdCount(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const limitRef = doc(db, 'user_ad_limits', `${userId}_${today}`);
      const limitDoc = await getDoc(limitRef);
      
      if (limitDoc.exists()) {
        const currentCount = limitDoc.data().adsWatched || 0;
        await updateDoc(limitRef, {
          adsWatched: currentCount + 1,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(limitRef, {
          userId,
          date: today,
          adsWatched: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Failed to update daily ad count:', error);
      throw error;
    }
  }

  async recordAdSession(adSession) {
    try {
      const sessionData = {
        ...adSession,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'ad_sessions', adSession.sessionId), sessionData);
    } catch (error) {
      console.error('Failed to record ad session:', error);
      throw error;
    }
  }

  async updateAdSession(sessionId, updates) {
    try {
      const sessionRef = doc(db, 'ad_sessions', sessionId);
      await updateDoc(sessionRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update ad session:', error);
      throw error;
    }
  }

  async getUserAdStats(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayDoc = await getDoc(doc(db, 'user_ad_limits', `${userId}_${today}`));
      
      const todayWatched = todayDoc.exists() ? todayDoc.data().adsWatched || 0 : 0;
      const cooldownTime = this.getUserCooldownTime(userId);
      
      // Get total ad rewards
      const rewardsCollection = collection(db, 'ad_rewards');
      const rewardsQuery = query(
        rewardsCollection,
        where('userId', '==', userId),
        where('status', '==', 'processed')
      );
      
      const rewardsSnapshot = await getDocs(rewardsQuery);
      let totalRewards = 0;
      let totalAdsWatched = 0;
      
      rewardsSnapshot.forEach(doc => {
        const data = doc.data();
        totalRewards += data.amount || 0;
        totalAdsWatched += 1;
      });

      return {
        todayWatched,
        dailyLimit: this.dailyAdLimit,
        remainingToday: Math.max(0, this.dailyAdLimit - todayWatched),
        cooldownTime,
        totalAdsWatched,
        totalRewards,
        averageReward: totalAdsWatched > 0 ? totalRewards / totalAdsWatched : 0
      };
    } catch (error) {
      console.error('Failed to get user ad stats:', error);
      throw error;
    }
  }

  async getAdHistory(userId, limitCount = 20) {
    try {
      const sessionsCollection = collection(db, 'ad_sessions');
      const q = query(
        sessionsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const sessions = [];
      
      snapshot.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
      });
      
      return sessions;
    } catch (error) {
      console.error('Failed to get ad history:', error);
      throw error;
    }
  }

  async cancelAdSession(sessionId, reason = 'user_cancelled') {
    try {
      const adSession = this.adSessions.get(sessionId);
      if (!adSession) {
        throw new Error('Ad session not found');
      }

      adSession.status = 'cancelled';
      adSession.cancelledAt = Date.now();
      adSession.cancelReason = reason;

      await this.updateAdSession(sessionId, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelReason: reason
      });

      this.adSessions.delete(sessionId);
      
      return { success: true, reason };
    } catch (error) {
      console.error('Failed to cancel ad session:', error);
      throw error;
    }
  }

  async updateAdNetworkStatus(networkId, isEnabled) {
    try {
      const networkRef = doc(db, 'ad_networks', networkId);
      await updateDoc(networkRef, {
        isEnabled,
        updatedAt: serverTimestamp()
      });
      
      // Update local configuration
      if (this.adNetworks[networkId]) {
        this.adNetworks[networkId].isEnabled = isEnabled;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to update ad network status:', error);
      throw error;
    }
  }

  async getSystemAdStats() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Get today's sessions
      const todaySessionsQuery = query(
        collection(db, 'ad_sessions'),
        where('createdAt', '>=', today.toISOString().split('T')[0])
      );
      
      const todaySnapshot = await getDocs(todaySessionsQuery);
      let todayStats = {
        total: 0,
        completed: 0,
        verified: 0,
        failed: 0,
        cancelled: 0
      };
      
      todaySnapshot.forEach(doc => {
        const data = doc.data();
        todayStats.total += 1;
        todayStats[data.status] = (todayStats[data.status] || 0) + 1;
      });

      // Get total rewards distributed
      const rewardsQuery = query(
        collection(db, 'ad_rewards'),
        where('status', '==', 'processed')
      );
      
      const rewardsSnapshot = await getDocs(rewardsQuery);
      let totalRewards = 0;
      rewardsSnapshot.forEach(doc => {
        totalRewards += doc.data().amount || 0;
      });

      return {
        today: todayStats,
        totalRewardsDistributed: totalRewards,
        activeNetworks: Object.values(this.adNetworks).filter(n => n.isEnabled).length,
        dailyLimit: this.dailyAdLimit,
        cooldownPeriod: this.cooldownPeriod / 1000 // in seconds
      };
    } catch (error) {
      console.error('Failed to get system ad stats:', error);
      throw error;
    }
  }

  getActiveAdSessions() {
    return Array.from(this.adSessions.values());
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredThreshold = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, session] of this.adSessions.entries()) {
      if (now - session.startTime > expiredThreshold) {
        this.cancelAdSession(sessionId, 'expired');
      }
    }
  }

  // Clean up expired sessions periodically
  startSessionCleanup() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

// Export singleton instance
export const adService = new AdService();

// Start session cleanup when service is imported
adService.startSessionCleanup();

export default adService;
