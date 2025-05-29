import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { lotteryService } from '../services/lotteryService';
import { performanceMonitor } from '../utils/monitoring';
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Initial state
const initialState = {
  // Loading states
  isLoading: true,
  isEntering: false,
  isProcessingPayment: false,
  
  // Lottery configuration
  lotteryTypes: {},
  lotteryInstances: {},
  
  // User-specific data
  userEntries: {},
  userStats: {
    totalEntries: 0,
    totalWinnings: 0,
    lotteriesWon: 0,
    winRate: 0,
    averageWinAmount: 0,
    totalSpent: 0,
    netProfit: 0,
    favoriteGame: null,
    longestStreak: 0,
    lastWin: null
  },
  userTicketLimits: {},
  
  // Winners and history
  recentWinners: [],
  allWinners: [],
  winnersHistory: {},
  
  // Real-time updates
  liveUpdates: {
    participants: {},
    prizePools: {},
    timeRemaining: {},
    lastUpdate: null
  },
  
  // Lottery statistics
  lotteryStats: {
    totalParticipants: 0,
    totalPrizesAwarded: 0,
    totalPrizePool: 0,
    averageParticipation: 0,
    mostPopularLottery: null,
    biggestWin: null
  },
  
  // Error handling
  error: null,
  lastError: null,
  errorCount: 0,
  
  // Subscription management
  subscriptions: new Map(),
  isConnected: false,
  connectionRetries: 0,
  
  // Cache management
  cache: {
    lastFetch: null,
    cacheExpiry: 5 * 60 * 1000, // 5 minutes
    prizesCache: {},
    statsCache: {}
  },
  
  // Feature flags
  features: {
    realTimeUpdates: true,
    autoRefresh: true,
    soundEffects: true,
    notifications: true
  }
};

// Action types
const ActionTypes = {
  // Loading actions
  SET_LOADING: 'SET_LOADING',
  SET_ENTERING: 'SET_ENTERING',
  SET_PROCESSING_PAYMENT: 'SET_PROCESSING_PAYMENT',
  
  // Data loading actions
  LOAD_LOTTERY_TYPES_SUCCESS: 'LOAD_LOTTERY_TYPES_SUCCESS',
  LOAD_LOTTERY_INSTANCES_SUCCESS: 'LOAD_LOTTERY_INSTANCES_SUCCESS',
  UPDATE_LOTTERY_INSTANCE: 'UPDATE_LOTTERY_INSTANCE',
  
  // User data actions
  LOAD_USER_ENTRIES_SUCCESS: 'LOAD_USER_ENTRIES_SUCCESS',
  UPDATE_USER_STATS: 'UPDATE_USER_STATS',
  UPDATE_USER_TICKET_LIMITS: 'UPDATE_USER_TICKET_LIMITS',
  ADD_USER_ENTRY: 'ADD_USER_ENTRY',
  
  // Winners actions
  LOAD_RECENT_WINNERS_SUCCESS: 'LOAD_RECENT_WINNERS_SUCCESS',
  LOAD_ALL_WINNERS_SUCCESS: 'LOAD_ALL_WINNERS_SUCCESS',
  UPDATE_WINNERS_HISTORY: 'UPDATE_WINNERS_HISTORY',
  ADD_NEW_WINNER: 'ADD_NEW_WINNER',
  
  // Real-time updates
  UPDATE_LIVE_DATA: 'UPDATE_LIVE_DATA',
  UPDATE_PARTICIPANTS: 'UPDATE_PARTICIPANTS',
  UPDATE_PRIZE_POOLS: 'UPDATE_PRIZE_POOLS',
  UPDATE_TIME_REMAINING: 'UPDATE_TIME_REMAINING',
  
  // Statistics actions
  UPDATE_LOTTERY_STATS: 'UPDATE_LOTTERY_STATS',
  CALCULATE_PRIZE_DISTRIBUTIONS: 'CALCULATE_PRIZE_DISTRIBUTIONS',
  
  // Connection management
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  INCREMENT_CONNECTION_RETRIES: 'INCREMENT_CONNECTION_RETRIES',
  RESET_CONNECTION_RETRIES: 'RESET_CONNECTION_RETRIES',
  
  // Error handling
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  INCREMENT_ERROR_COUNT: 'INCREMENT_ERROR_COUNT',
  RESET_ERROR_COUNT: 'RESET_ERROR_COUNT',
  
  // Cache management
  UPDATE_CACHE: 'UPDATE_CACHE',
  CLEAR_CACHE: 'CLEAR_CACHE',
  SET_CACHE_EXPIRY: 'SET_CACHE_EXPIRY',
  
  // Subscription management
  ADD_SUBSCRIPTION: 'ADD_SUBSCRIPTION',
  REMOVE_SUBSCRIPTION: 'REMOVE_SUBSCRIPTION',
  CLEAR_SUBSCRIPTIONS: 'CLEAR_SUBSCRIPTIONS',
  
  // Feature toggles
  UPDATE_FEATURES: 'UPDATE_FEATURES'
};

// Reducer function
function lotteryReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case ActionTypes.SET_ENTERING:
      return {
        ...state,
        isEntering: action.payload
      };

    case ActionTypes.SET_PROCESSING_PAYMENT:
      return {
        ...state,
        isProcessingPayment: action.payload
      };

    case ActionTypes.LOAD_LOTTERY_TYPES_SUCCESS:
      return {
        ...state,
        lotteryTypes: action.payload,
        error: null
      };

    case ActionTypes.LOAD_LOTTERY_INSTANCES_SUCCESS:
      return {
        ...state,
        lotteryInstances: action.payload,
        error: null
      };

    case ActionTypes.UPDATE_LOTTERY_INSTANCE:
      return {
        ...state,
        lotteryInstances: {
          ...state.lotteryInstances,
          [action.payload.lotteryTypeId]: action.payload.instance
        }
      };

    case ActionTypes.LOAD_USER_ENTRIES_SUCCESS:
      return {
        ...state,
        userEntries: action.payload
      };

    case ActionTypes.UPDATE_USER_STATS:
      return {
        ...state,
        userStats: { ...state.userStats, ...action.payload }
      };

    case ActionTypes.UPDATE_USER_TICKET_LIMITS:
      return {
        ...state,
        userTicketLimits: { ...state.userTicketLimits, ...action.payload }
      };

    case ActionTypes.ADD_USER_ENTRY:
      return {
        ...state,
        userEntries: {
          ...state.userEntries,
          [action.payload.lotteryTypeId]: [
            ...(state.userEntries[action.payload.lotteryTypeId] || []),
            action.payload.entry
          ]
        }
      };

    case ActionTypes.LOAD_RECENT_WINNERS_SUCCESS:
      return {
        ...state,
        recentWinners: action.payload
      };

    case ActionTypes.LOAD_ALL_WINNERS_SUCCESS:
      return {
        ...state,
        allWinners: action.payload
      };

    case ActionTypes.UPDATE_WINNERS_HISTORY:
      return {
        ...state,
        winnersHistory: { ...state.winnersHistory, ...action.payload }
      };

    case ActionTypes.ADD_NEW_WINNER:
      return {
        ...state,
        recentWinners: [action.payload, ...state.recentWinners.slice(0, 9)],
        allWinners: [action.payload, ...state.allWinners]
      };

    case ActionTypes.UPDATE_LIVE_DATA:
      return {
        ...state,
        liveUpdates: {
          ...state.liveUpdates,
          ...action.payload,
          lastUpdate: new Date()
        }
      };

    case ActionTypes.UPDATE_PARTICIPANTS:
      return {
        ...state,
        liveUpdates: {
          ...state.liveUpdates,
          participants: { ...state.liveUpdates.participants, ...action.payload },
          lastUpdate: new Date()
        }
      };

    case ActionTypes.UPDATE_PRIZE_POOLS:
      return {
        ...state,
        liveUpdates: {
          ...state.liveUpdates,
          prizePools: { ...state.liveUpdates.prizePools, ...action.payload },
          lastUpdate: new Date()
        }
      };

    case ActionTypes.UPDATE_TIME_REMAINING:
      return {
        ...state,
        liveUpdates: {
          ...state.liveUpdates,
          timeRemaining: { ...state.liveUpdates.timeRemaining, ...action.payload },
          lastUpdate: new Date()
        }
      };

    case ActionTypes.UPDATE_LOTTERY_STATS:
      return {
        ...state,
        lotteryStats: { ...state.lotteryStats, ...action.payload }
      };

    case ActionTypes.SET_CONNECTION_STATUS:
      return {
        ...state,
        isConnected: action.payload
      };

    case ActionTypes.INCREMENT_CONNECTION_RETRIES:
      return {
        ...state,
        connectionRetries: state.connectionRetries + 1
      };

    case ActionTypes.RESET_CONNECTION_RETRIES:
      return {
        ...state,
        connectionRetries: 0
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        lastError: action.payload,
        errorCount: state.errorCount + 1
      };

    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case ActionTypes.RESET_ERROR_COUNT:
      return {
        ...state,
        errorCount: 0
      };

    case ActionTypes.UPDATE_CACHE:
      return {
        ...state,
        cache: { ...state.cache, ...action.payload }
      };

    case ActionTypes.CLEAR_CACHE:
      return {
        ...state,
        cache: { ...initialState.cache }
      };

    case ActionTypes.ADD_SUBSCRIPTION:
      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.set(action.payload.key, action.payload.unsubscribe);
      return {
        ...state,
        subscriptions: newSubscriptions
      };

    case ActionTypes.REMOVE_SUBSCRIPTION:
      const updatedSubscriptions = new Map(state.subscriptions);
      const unsubscribe = updatedSubscriptions.get(action.payload);
      if (unsubscribe) {
        unsubscribe();
        updatedSubscriptions.delete(action.payload);
      }
      return {
        ...state,
        subscriptions: updatedSubscriptions
      };

    case ActionTypes.CLEAR_SUBSCRIPTIONS:
      state.subscriptions.forEach(unsubscribe => unsubscribe());
      return {
        ...state,
        subscriptions: new Map()
      };

    case ActionTypes.UPDATE_FEATURES:
      return {
        ...state,
        features: { ...state.features, ...action.payload }
      };

    default:
      return state;
  }
}

// Create contexts
const LotteryContext = createContext();
const LotteryDispatchContext = createContext();

// Lottery Provider component
export function LotteryProvider({ children }) {
  const [state, dispatch] = useReducer(lotteryReducer, initialState);

  // Initialize lottery data on mount
  useEffect(() => {
    initializeLotteryData();
    
    return () => {
      // Cleanup subscriptions on unmount
      dispatch({ type: ActionTypes.CLEAR_SUBSCRIPTIONS });
    };
  }, []);

  // Auto-refresh mechanism
  useEffect(() => {
    if (state.features.autoRefresh && state.isConnected) {
      const interval = setInterval(() => {
        refreshLotteryData();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [state.features.autoRefresh, state.isConnected]);

  // Cache management
  useEffect(() => {
    const cacheCleanup = setInterval(() => {
      const now = Date.now();
      if (state.cache.lastFetch && (now - state.cache.lastFetch) > state.cache.cacheExpiry) {
        dispatch({ type: ActionTypes.CLEAR_CACHE });
      }
    }, 60000); // Check every minute

    return () => clearInterval(cacheCleanup);
  }, [state.cache.lastFetch, state.cache.cacheExpiry]);

  const initializeLotteryData = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: false });

      // Load initial data
      await Promise.all([
        loadLotteryTypes(),
        loadLotteryInstances(),
        loadRecentWinners(),
        loadLotteryStats()
      ]);

      // Setup real-time subscriptions
      if (state.features.realTimeUpdates) {
        setupRealTimeSubscriptions();
      }

      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: true });
      dispatch({ type: ActionTypes.RESET_CONNECTION_RETRIES });
      dispatch({ type: ActionTypes.RESET_ERROR_COUNT });
    } catch (error) {
      console.error('Failed to initialize lottery data:', error);
      handleError(error);
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  const loadLotteryTypes = async () => {
    try {
      const types = await lotteryService.getLotteryTypes();
      dispatch({
        type: ActionTypes.LOAD_LOTTERY_TYPES_SUCCESS,
        payload: types
      });
    } catch (error) {
      console.error('Failed to load lottery types:', error);
      throw error;
    }
  };

  const loadLotteryInstances = async () => {
    try {
      const instances = await lotteryService.getCurrentLotteryInstances();
      dispatch({
        type: ActionTypes.LOAD_LOTTERY_INSTANCES_SUCCESS,
        payload: instances
      });
      
      // Update live data
      const participants = {};
      const prizePools = {};
      Object.entries(instances).forEach(([typeId, instance]) => {
        participants[typeId] = instance.participants || 0;
        prizePools[typeId] = instance.prizePool || 0;
      });
      
      dispatch({
        type: ActionTypes.UPDATE_LIVE_DATA,
        payload: { participants, prizePools }
      });
    } catch (error) {
      console.error('Failed to load lottery instances:', error);
      throw error;
    }
  };

  const loadRecentWinners = async () => {
    try {
      const winners = await lotteryService.getRecentWinners(10);
      dispatch({
        type: ActionTypes.LOAD_RECENT_WINNERS_SUCCESS,
        payload: winners
      });
    } catch (error) {
      console.error('Failed to load recent winners:', error);
      throw error;
    }
  };

  const loadLotteryStats = async () => {
    try {
      const stats = await lotteryService.getLotteryStats();
      dispatch({
        type: ActionTypes.UPDATE_LOTTERY_STATS,
        payload: stats
      });
    } catch (error) {
      console.error('Failed to load lottery stats:', error);
      throw error;
    }
  };

  const setupRealTimeSubscriptions = () => {
    try {
      // Subscribe to lottery instances updates
      const instancesQuery = query(
        collection(db, 'lottery_instances'),
        where('status', '==', 'active')
      );

      const instancesUnsubscribe = onSnapshot(instancesQuery, (snapshot) => {
        const instances = {};
        const participants = {};
        const prizePools = {};
        
        snapshot.forEach(doc => {
          const data = doc.data();
          instances[data.lotteryTypeId] = { id: doc.id, ...data };
          participants[data.lotteryTypeId] = data.participants || 0;
          prizePools[data.lotteryTypeId] = data.prizePool || 0;
        });

        dispatch({
          type: ActionTypes.LOAD_LOTTERY_INSTANCES_SUCCESS,
          payload: instances
        });

        dispatch({
          type: ActionTypes.UPDATE_LIVE_DATA,
          payload: { participants, prizePools }
        });
      });

      dispatch({
        type: ActionTypes.ADD_SUBSCRIPTION,
        payload: { key: 'lottery_instances', unsubscribe: instancesUnsubscribe }
      });

      // Subscribe to winners updates
      const winnersQuery = query(
        collection(db, 'lottery_winners'),
        where('status', '==', 'transferred'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const winnersUnsubscribe = onSnapshot(winnersQuery, (snapshot) => {
        const winners = [];
        snapshot.forEach(doc => {
          winners.push({ id: doc.id, ...doc.data() });
        });

        dispatch({
          type: ActionTypes.LOAD_RECENT_WINNERS_SUCCESS,
          payload: winners
        });
      });

      dispatch({
        type: ActionTypes.ADD_SUBSCRIPTION,
        payload: { key: 'recent_winners', unsubscribe: winnersUnsubscribe }
      });

    } catch (error) {
      console.error('Failed to setup real-time subscriptions:', error);
      handleError(error);
    }
  };

  const refreshLotteryData = async () => {
    try {
      if (!state.isConnected) {
        await initializeLotteryData();
        return;
      }

      // Only refresh if cache has expired
      const now = Date.now();
      if (state.cache.lastFetch && (now - state.cache.lastFetch) < state.cache.cacheExpiry) {
        return;
      }

      await Promise.all([
        loadLotteryInstances(),
        loadRecentWinners(),
        loadLotteryStats()
      ]);

      dispatch({
        type: ActionTypes.UPDATE_CACHE,
        payload: { lastFetch: now }
      });
    } catch (error) {
      console.error('Failed to refresh lottery data:', error);
      handleError(error);
    }
  };

  // User-specific data loading
  const loadUserData = async (userId) => {
    try {
      const [userStats, userEntries, ticketLimits] = await Promise.all([
        lotteryService.getUserLotteryStats(userId),
        lotteryService.getUserEntries(userId),
        lotteryService.getUserTicketLimits(userId)
      ]);

      dispatch({ type: ActionTypes.UPDATE_USER_STATS, payload: userStats });
      dispatch({ type: ActionTypes.LOAD_USER_ENTRIES_SUCCESS, payload: userEntries });
      dispatch({ type: ActionTypes.UPDATE_USER_TICKET_LIMITS, payload: ticketLimits });
    } catch (error) {
      console.error('Failed to load user data:', error);
      handleError(error);
    }
  };

  // Lottery entry
  const enterLottery = async (lotteryTypeId, userId, entryMethod, ticketCount = 1, paymentData = null) => {
    try {
      dispatch({ type: ActionTypes.SET_ENTERING, payload: true });
      
      if (entryMethod === 'pi_payment') {
        dispatch({ type: ActionTypes.SET_PROCESSING_PAYMENT, payload: true });
      }

      const result = await lotteryService.enterLottery(
        lotteryTypeId,
        userId,
        entryMethod,
        ticketCount,
        paymentData
      );

      if (result.success) {
        // Add entry to user entries
        dispatch({
          type: ActionTypes.ADD_USER_ENTRY,
          payload: {
            lotteryTypeId,
            entry: {
              id: result.entryId,
              instanceId: result.instanceId,
              ticketCount,
              entryMethod,
              timestamp: new Date()
            }
          }
        });

        // Update user stats
        const updatedStats = {
          totalEntries: state.userStats.totalEntries + ticketCount
        };
        
        if (entryMethod === 'pi_payment' && paymentData) {
          updatedStats.totalSpent = state.userStats.totalSpent + (paymentData.amount || 0);
        }

        dispatch({ type: ActionTypes.UPDATE_USER_STATS, payload: updatedStats });

        // Refresh lottery instance data
        await loadLotteryInstances();

        performanceMonitor.logUserAction('lottery_entry_success', {
          userId,
          lotteryTypeId,
          entryMethod,
          ticketCount
        });

        return result;
      } else {
        throw new Error('Lottery entry failed');
      }
    } catch (error) {
      console.error('Failed to enter lottery:', error);
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: ActionTypes.SET_ENTERING, payload: false });
      dispatch({ type: ActionTypes.SET_PROCESSING_PAYMENT, payload: false });
    }
  };

  // Prize calculations
  const calculatePrizes = useCallback((participants, lotteryTypeId) => {
    const cacheKey = `${lotteryTypeId}_${participants}`;
    
    if (state.cache.prizesCache[cacheKey]) {
      return state.cache.prizesCache[cacheKey];
    }

    const lotteryType = state.lotteryTypes[lotteryTypeId];
    if (!lotteryType) return {};

    let prizePool;
    if (lotteryTypeId === 'daily_ads') {
      prizePool = participants * (lotteryType.adValue || 0.001);
    } else {
      prizePool = participants * (lotteryType.entryFee - lotteryType.platformFee);
    }

    let prizes = {};
    if (participants <= 50) {
      prizes = {
        first: prizePool * 0.6,
        second: prizePool * 0.25,
        third: prizePool * 0.15
      };
    } else if (participants <= 200) {
      prizes = {
        first: prizePool * 0.5,
        second: prizePool * 0.25,
        third: prizePool * 0.15,
        fourth: prizePool * 0.06,
        fifth: prizePool * 0.04
      };
    } else {
      prizes = {
        first: prizePool * 0.4,
        second: prizePool * 0.2,
        third: prizePool * 0.15,
        fourth: prizePool * 0.08,
        fifth: prizePool * 0.08,
        sixth: prizePool * 0.08
      };
    }

    // Cache the result
    dispatch({
      type: ActionTypes.UPDATE_CACHE,
      payload: {
        prizesCache: {
          ...state.cache.prizesCache,
          [cacheKey]: prizes
        }
      }
    });

    return prizes;
  }, [state.lotteryTypes, state.cache.prizesCache]);

  // Error handling
  const handleError = (error) => {
    dispatch({
      type: ActionTypes.SET_ERROR,
      payload: error.message || 'An unknown error occurred'
    });

    performanceMonitor.logError(error, { context: 'lottery_operations' });

    // Implement retry logic for connection errors
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      if (state.connectionRetries < 3) {
        dispatch({ type: ActionTypes.INCREMENT_CONNECTION_RETRIES });
        setTimeout(() => {
          initializeLotteryData();
        }, Math.pow(2, state.connectionRetries) * 1000); // Exponential backoff
      }
    }
  };

  const clearError = () => {
    dispatch({ type: ActionTypes.CLEAR_ERROR });
  };

  // Feature toggles
  const updateFeatures = (newFeatures) => {
    dispatch({
      type: ActionTypes.UPDATE_FEATURES,
      payload: newFeatures
    });

    // Restart subscriptions if real-time updates feature changed
    if (newFeatures.realTimeUpdates !== undefined) {
      if (newFeatures.realTimeUpdates) {
        setupRealTimeSubscriptions();
      } else {
        dispatch({ type: ActionTypes.CLEAR_SUBSCRIPTIONS });
      }
    }
  };

  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Methods
    initializeLotteryData,
    refreshLotteryData,
    loadUserData,
    enterLottery,
    calculatePrizes,
    clearError,
    updateFeatures,
    
    // Utility methods
    getLotteryInstance: (lotteryTypeId) => state.lotteryInstances[lotteryTypeId],
    getLotteryType: (lotteryTypeId) => state.lotteryTypes[lotteryTypeId],
    getUserTicketLimits: (lotteryTypeId) => state.userTicketLimits[`${lotteryTypeId}_used`] || 0,
    isLotteryActive: (lotteryTypeId) => {
      const instance = state.lotteryInstances[lotteryTypeId];
      return instance && instance.status === 'active';
    }
  };

  return (
    <LotteryContext.Provider value={contextValue}>
      <LotteryDispatchContext.Provider value={dispatch}>
        {children}
      </LotteryDispatchContext.Provider>
    </LotteryContext.Provider>
  );
}

// Custom hooks
export function useLottery() {
  const context = useContext(LotteryContext);
  if (!context) {
    throw new Error('useLottery must be used within a LotteryProvider');
  }
  return context;
}

export function useLotteryDispatch() {
  const context = useContext(LotteryDispatchContext);
  if (!context) {
    throw new Error('useLotteryDispatch must be used within a LotteryProvider');
  }
  return context;
}

// Utility hooks
export function useLotteryData() {
  const { lotteryTypes, lotteryInstances, isLoading, error } = useLottery();
  return { lotteryTypes, lotteryInstances, isLoading, error };
}

export function useUserLotteryData() {
  const { userEntries, userStats, userTicketLimits } = useLottery();
  return { userEntries, userStats, userTicketLimits };
}

export function useWinnersData() {
  const { recentWinners, allWinners, winnersHistory } = useLottery();
  return { recentWinners, allWinners, winnersHistory };
}

export function useLotteryStats() {
  const { lotteryStats, liveUpdates } = useLottery();
  return { lotteryStats, liveUpdates };
}

export function useLotteryFeatures() {
  const { features, updateFeatures } = useLottery();
  return { features, updateFeatures };
}

export default LotteryContext;
