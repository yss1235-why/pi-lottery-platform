import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { adminAuthService } from '../services/adminAuthService';
import { adminService } from '../services/adminService';
import { performanceMonitor } from '../utils/monitoring';

// Initial state
const initialState = {
  // Admin authentication state
  isAdmin: false,
  isLoading: true,
  admin: null,
  
  // Authentication status
  authenticationStatus: 'idle', // idle, authenticating, authenticated, failed
  authError: null,
  
  // Admin permissions
  permissions: [],
  hasFullAccess: false,
  
  // Platform configuration
  platformConfig: {
    fees: {
      platformFee: 0.1,
      adValue: 0.001,
      transactionFee: 0.01
    },
    lotteries: {
      daily_pi: true,
      daily_ads: true,
      weekly_pi: true,
      monthly_pi: false
    },
    limits: {
      dailyPiLimit: 3,
      dailyAdsLimit: 5,
      weeklyPiLimit: 10,
      monthlyPiLimit: 25
    },
    thresholds: {
      dailyPiThreshold: 5,
      dailyAdsThreshold: 10,
      weeklyPiThreshold: 20,
      monthlyPiThreshold: 30
    }
  },
  
  // System statistics
  systemStats: {
    totalRevenue: 0,
    currentMonthRevenue: 0,
    totalUsers: 0,
    activeUsers: 0,
    activeLotteries: 0,
    pendingPrizes: 0,
    systemHealth: 'optimal'
  },
  
  // Pending operations
  pendingWinners: [],
  pendingPayments: [],
  pendingReports: [],
  
  // Admin activity logs
  adminLogs: [],
  
  // System alerts and notifications
  systemAlerts: [],
  notifications: [],
  
  // Configuration change tracking
  hasUnsavedChanges: false,
  configHistory: [],
  
  // Real-time monitoring
  realTimeData: {
    onlineUsers: 0,
    activeConnections: 0,
    serverLoad: 0,
    lastUpdate: null
  }
};

// Action types
const ActionTypes = {
  // Authentication actions
  SET_LOADING: 'SET_LOADING',
  ADMIN_AUTHENTICATION_START: 'ADMIN_AUTHENTICATION_START',
  ADMIN_AUTHENTICATION_SUCCESS: 'ADMIN_AUTHENTICATION_SUCCESS',
  ADMIN_AUTHENTICATION_FAILURE: 'ADMIN_AUTHENTICATION_FAILURE',
  ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  
  // Configuration actions
  UPDATE_PLATFORM_CONFIG: 'UPDATE_PLATFORM_CONFIG',
  SET_UNSAVED_CHANGES: 'SET_UNSAVED_CHANGES',
  SAVE_CONFIG_SUCCESS: 'SAVE_CONFIG_SUCCESS',
  ADD_CONFIG_HISTORY: 'ADD_CONFIG_HISTORY',
  
  // System data actions
  UPDATE_SYSTEM_STATS: 'UPDATE_SYSTEM_STATS',
  UPDATE_PENDING_WINNERS: 'UPDATE_PENDING_WINNERS',
  UPDATE_PENDING_PAYMENTS: 'UPDATE_PENDING_PAYMENTS',
  UPDATE_REAL_TIME_DATA: 'UPDATE_REAL_TIME_DATA',
  
  // Operations actions
  APPROVE_PRIZE_START: 'APPROVE_PRIZE_START',
  APPROVE_PRIZE_SUCCESS: 'APPROVE_PRIZE_SUCCESS',
  APPROVE_PRIZE_FAILURE: 'APPROVE_PRIZE_FAILURE',
  
  // Logs and monitoring
  ADD_ADMIN_LOG: 'ADD_ADMIN_LOG',
  UPDATE_ADMIN_LOGS: 'UPDATE_ADMIN_LOGS',
  ADD_SYSTEM_ALERT: 'ADD_SYSTEM_ALERT',
  CLEAR_SYSTEM_ALERT: 'CLEAR_SYSTEM_ALERT',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  CLEAR_NOTIFICATION: 'CLEAR_NOTIFICATION',
  
  // Error handling
  SET_ADMIN_ERROR: 'SET_ADMIN_ERROR',
  CLEAR_ADMIN_ERROR: 'CLEAR_ADMIN_ERROR'
};

// Reducer function
function adminReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case ActionTypes.ADMIN_AUTHENTICATION_START:
      return {
        ...state,
        isLoading: true,
        authenticationStatus: 'authenticating',
        authError: null
      };

    case ActionTypes.ADMIN_AUTHENTICATION_SUCCESS:
      return {
        ...state,
        isAdmin: true,
        isLoading: false,
        authenticationStatus: 'authenticated',
        admin: action.payload.admin,
        permissions: action.payload.permissions || [],
        hasFullAccess: action.payload.hasFullAccess || false,
        authError: null
      };

    case ActionTypes.ADMIN_AUTHENTICATION_FAILURE:
      return {
        ...state,
        isAdmin: false,
        isLoading: false,
        authenticationStatus: 'failed',
        admin: null,
        permissions: [],
        hasFullAccess: false,
        authError: action.payload.error
      };

    case ActionTypes.ADMIN_LOGOUT:
      return {
        ...initialState,
        isLoading: false,
        authenticationStatus: 'idle'
      };

    case ActionTypes.UPDATE_PLATFORM_CONFIG:
      return {
        ...state,
        platformConfig: { ...state.platformConfig, ...action.payload },
        hasUnsavedChanges: true
      };

    case ActionTypes.SET_UNSAVED_CHANGES:
      return {
        ...state,
        hasUnsavedChanges: action.payload
      };

    case ActionTypes.SAVE_CONFIG_SUCCESS:
      return {
        ...state,
        hasUnsavedChanges: false
      };

    case ActionTypes.ADD_CONFIG_HISTORY:
      return {
        ...state,
        configHistory: [action.payload, ...state.configHistory.slice(0, 9)] // Keep last 10
      };

    case ActionTypes.UPDATE_SYSTEM_STATS:
      return {
        ...state,
        systemStats: { ...state.systemStats, ...action.payload }
      };

    case ActionTypes.UPDATE_PENDING_WINNERS:
      return {
        ...state,
        pendingWinners: action.payload
      };

    case ActionTypes.UPDATE_PENDING_PAYMENTS:
      return {
        ...state,
        pendingPayments: action.payload
      };

    case ActionTypes.UPDATE_REAL_TIME_DATA:
      return {
        ...state,
        realTimeData: { ...state.realTimeData, ...action.payload, lastUpdate: new Date() }
      };

    case ActionTypes.ADD_ADMIN_LOG:
      return {
        ...state,
        adminLogs: [action.payload, ...state.adminLogs.slice(0, 49)] // Keep last 50
      };

    case ActionTypes.UPDATE_ADMIN_LOGS:
      return {
        ...state,
        adminLogs: action.payload
      };

    case ActionTypes.ADD_SYSTEM_ALERT:
      return {
        ...state,
        systemAlerts: [action.payload, ...state.systemAlerts]
      };

    case ActionTypes.CLEAR_SYSTEM_ALERT:
      return {
        ...state,
        systemAlerts: state.systemAlerts.filter(alert => alert.id !== action.payload)
      };

    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [action.payload, ...state.notifications]
      };

    case ActionTypes.CLEAR_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(notif => notif.id !== action.payload)
      };

    case ActionTypes.SET_ADMIN_ERROR:
      return {
        ...state,
        authError: action.payload
      };

    case ActionTypes.CLEAR_ADMIN_ERROR:
      return {
        ...state,
        authError: null
      };

    default:
      return state;
  }
}

// Create contexts
const AdminContext = createContext();
const AdminDispatchContext = createContext();

// Admin Provider component
export function AdminProvider({ children }) {
  const [state, dispatch] = useReducer(adminReducer, initialState);

  // Initialize admin state on mount
  useEffect(() => {
    initializeAdminState();
  }, []);

  // Real-time data updates
  useEffect(() => {
    if (state.isAdmin) {
      const interval = setInterval(updateRealTimeData, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [state.isAdmin]);

  // System monitoring
  useEffect(() => {
    if (state.isAdmin) {
      loadSystemData();
      const interval = setInterval(loadSystemData, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [state.isAdmin]);

  const initializeAdminState = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      
      // Check if admin is already authenticated
      const currentAdmin = adminAuthService.getCurrentAdmin();
      const isAdminAuthenticated = adminAuthService.getIsAdmin();
      
      if (isAdminAuthenticated && currentAdmin) {
        dispatch({
          type: ActionTypes.ADMIN_AUTHENTICATION_SUCCESS,
          payload: {
            admin: currentAdmin,
            permissions: currentAdmin.permissions || [],
            hasFullAccess: currentAdmin.permissions?.includes('full_access') || false
          }
        });
        
        await loadInitialData();
      } else {
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    } catch (error) {
      console.error('Failed to initialize admin state:', error);
      dispatch({
        type: ActionTypes.ADMIN_AUTHENTICATION_FAILURE,
        payload: { error: error.message }
      });
    }
  };

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadPlatformConfig(),
        loadSystemStats(),
        loadPendingOperations(),
        loadAdminLogs()
      ]);
    } catch (error) {
      console.error('Failed to load initial admin data:', error);
    }
  };

  const loadPlatformConfig = async () => {
    try {
      const config = await adminService.getPlatformConfig();
      dispatch({
        type: ActionTypes.UPDATE_PLATFORM_CONFIG,
        payload: config
      });
      dispatch({ type: ActionTypes.SET_UNSAVED_CHANGES, payload: false });
    } catch (error) {
      console.error('Failed to load platform config:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      const stats = await adminService.getSystemStats();
      dispatch({
        type: ActionTypes.UPDATE_SYSTEM_STATS,
        payload: stats
      });
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  const loadPendingOperations = async () => {
    try {
      const [winners, payments] = await Promise.all([
        adminService.getPendingWinners(),
        adminService.getPendingPayments()
      ]);
      
      dispatch({ type: ActionTypes.UPDATE_PENDING_WINNERS, payload: winners });
      dispatch({ type: ActionTypes.UPDATE_PENDING_PAYMENTS, payload: payments });
    } catch (error) {
      console.error('Failed to load pending operations:', error);
    }
  };

  const loadAdminLogs = async () => {
    try {
      const logs = await adminService.getAdminLogs(50);
      dispatch({ type: ActionTypes.UPDATE_ADMIN_LOGS, payload: logs });
    } catch (error) {
      console.error('Failed to load admin logs:', error);
    }
  };

  const updateRealTimeData = async () => {
    try {
      const realTimeData = await adminService.getRealTimeData();
      dispatch({
        type: ActionTypes.UPDATE_REAL_TIME_DATA,
        payload: realTimeData
      });
    } catch (error) {
      console.error('Failed to update real-time data:', error);
    }
  };

  const loadSystemData = async () => {
    try {
      await Promise.all([
        loadSystemStats(),
        loadPendingOperations()
      ]);
    } catch (error) {
      console.error('Failed to load system data:', error);
    }
  };

  // Authentication methods
  const handleAdminSignIn = async (email, password) => {
    try {
      dispatch({ type: ActionTypes.ADMIN_AUTHENTICATION_START });

      const authResult = await adminAuthService.signInAdmin(email, password);

      if (authResult.success) {
        dispatch({
          type: ActionTypes.ADMIN_AUTHENTICATION_SUCCESS,
          payload: {
            admin: authResult.admin,
            permissions: authResult.admin.permissions || [],
            hasFullAccess: authResult.admin.permissions?.includes('full_access') || false
          }
        });

        await loadInitialData();

        // Log admin login
        dispatch({
          type: ActionTypes.ADD_ADMIN_LOG,
          payload: {
            id: Date.now(),
            action: 'admin_login',
            adminId: authResult.admin.uid,
            adminEmail: authResult.admin.email,
            timestamp: new Date(),
            details: { loginMethod: 'email_password' }
          }
        });

        performanceMonitor.logUserAction('admin_authentication_success', {
          adminId: authResult.admin.uid,
          method: 'email_password'
        });

        return authResult;
      } else {
        throw new Error('Admin authentication failed');
      }
    } catch (error) {
      console.error('Admin sign in failed:', error);
      
      dispatch({
        type: ActionTypes.ADMIN_AUTHENTICATION_FAILURE,
        payload: { error: error.message }
      });
      
      performanceMonitor.logError(error, { context: 'admin_authentication' });
      throw error;
    }
  };

  const handleAdminLogout = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });

      // Log admin logout
      if (state.admin) {
        dispatch({
          type: ActionTypes.ADD_ADMIN_LOG,
          payload: {
            id: Date.now(),
            action: 'admin_logout',
            adminId: state.admin.uid,
            adminEmail: state.admin.email,
            timestamp: new Date()
          }
        });
      }

      await adminAuthService.signOutAdmin();
      dispatch({ type: ActionTypes.ADMIN_LOGOUT });

      performanceMonitor.logUserAction('admin_logout', {
        adminId: state.admin?.uid
      });
    } catch (error) {
      console.error('Admin logout failed:', error);
      dispatch({ type: ActionTypes.SET_ADMIN_ERROR, payload: error.message });
    }
  };

  // Configuration management
  const updatePlatformConfig = async (configUpdates) => {
    try {
      const updatedConfig = { ...state.platformConfig, ...configUpdates };
      
      await adminService.updatePlatformConfig(updatedConfig);
      
      dispatch({
        type: ActionTypes.UPDATE_PLATFORM_CONFIG,
        payload: configUpdates
      });
      
      dispatch({ type: ActionTypes.SAVE_CONFIG_SUCCESS });
      
      // Add to history
      dispatch({
        type: ActionTypes.ADD_CONFIG_HISTORY,
        payload: {
          id: Date.now(),
          changes: configUpdates,
          timestamp: new Date(),
          adminId: state.admin?.uid,
          adminEmail: state.admin?.email
        }
      });

      // Log configuration change
      dispatch({
        type: ActionTypes.ADD_ADMIN_LOG,
        payload: {
          id: Date.now(),
          action: 'config_update',
          adminId: state.admin?.uid,
          adminEmail: state.admin?.email,
          timestamp: new Date(),
          details: { changes: configUpdates }
        }
      });

      dispatch({
        type: ActionTypes.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'success',
          title: 'Configuration Updated',
          message: 'Platform configuration has been successfully updated.',
          timestamp: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to update platform config:', error);
      dispatch({ type: ActionTypes.SET_ADMIN_ERROR, payload: error.message });
      throw error;
    }
  };

  // Prize management
  const approvePrize = async (winnerId) => {
    try {
      dispatch({ type: ActionTypes.APPROVE_PRIZE_START });

      const result = await adminService.approvePrize(winnerId);

      if (result.success) {
        // Update pending winners list
        const updatedWinners = state.pendingWinners.filter(w => w.id !== winnerId);
        dispatch({ type: ActionTypes.UPDATE_PENDING_WINNERS, payload: updatedWinners });

        // Log prize approval
        dispatch({
          type: ActionTypes.ADD_ADMIN_LOG,
          payload: {
            id: Date.now(),
            action: 'prize_approved',
            adminId: state.admin?.uid,
            adminEmail: state.admin?.email,
            timestamp: new Date(),
            details: { winnerId, amount: result.amount }
          }
        });

        dispatch({
          type: ActionTypes.ADD_NOTIFICATION,
          payload: {
            id: Date.now(),
            type: 'success',
            title: 'Prize Approved',
            message: `Prize of ${result.amount} π has been transferred successfully.`,
            timestamp: new Date()
          }
        });

        return result;
      } else {
        throw new Error('Prize approval failed');
      }
    } catch (error) {
      console.error('Failed to approve prize:', error);
      dispatch({ type: ActionTypes.SET_ADMIN_ERROR, payload: error.message });
      throw error;
    }
  };

  // Report generation
  const generateReport = async (reportType, dateRange) => {
    try {
      const report = await adminService.generateReport(reportType, dateRange);

      // Log report generation
      dispatch({
        type: ActionTypes.ADD_ADMIN_LOG,
        payload: {
          id: Date.now(),
          action: 'report_generated',
          adminId: state.admin?.uid,
          adminEmail: state.admin?.email,
          timestamp: new Date(),
          details: { reportType, dateRange }
        }
      });

      return report;
    } catch (error) {
      console.error('Failed to generate report:', error);
      dispatch({ type: ActionTypes.SET_ADMIN_ERROR, payload: error.message });
      throw error;
    }
  };

  // Permission checking
  const hasPermission = (permission) => {
    return state.hasFullAccess || state.permissions.includes(permission);
  };

  // System alerts
  const addSystemAlert = (alert) => {
    dispatch({
      type: ActionTypes.ADD_SYSTEM_ALERT,
      payload: {
        id: Date.now(),
        ...alert,
        timestamp: new Date()
      }
    });
  };

  const clearSystemAlert = (alertId) => {
    dispatch({ type: ActionTypes.CLEAR_SYSTEM_ALERT, payload: alertId });
  };

  // Notifications
  const addNotification = (notification) => {
    dispatch({
      type: ActionTypes.ADD_NOTIFICATION,
      payload: {
        id: Date.now(),
        ...notification,
        timestamp: new Date()
      }
    });
  };

  const clearNotification = (notificationId) => {
    dispatch({ type: ActionTypes.CLEAR_NOTIFICATION, payload: notificationId });
  };

  const clearAdminError = () => {
    dispatch({ type: ActionTypes.CLEAR_ADMIN_ERROR });
  };

  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Methods
    signIn: handleAdminSignIn,
    signOut: handleAdminLogout,
    updatePlatformConfig,
    approvePrize,
    generateReport,
    hasPermission,
    addSystemAlert,
    clearSystemAlert,
    addNotification,
    clearNotification,
    clearAdminError,
    
    // Data refresh methods
    refreshSystemStats: loadSystemStats,
    refreshPendingOperations: loadPendingOperations,
    refreshAdminLogs: loadAdminLogs,
    refreshRealTimeData: updateRealTimeData
  };

  return (
    <AdminContext.Provider value={contextValue}>
      <AdminDispatchContext.Provider value={dispatch}>
        {children}
      </AdminDispatchContext.Provider>
    </AdminContext.Provider>
  );
}

// Custom hooks
export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}

export function useAdminDispatch() {
  const context = useContext(AdminDispatchContext);
  if (!context) {
    throw new Error('useAdminDispatch must be used within an AdminProvider');
  }
  return context;
}

// Utility hooks
export function useAdminAuth() {
  const { isAdmin, isLoading, admin, authenticationStatus, signIn, signOut } = useAdmin();
  return { isAdmin, isLoading, admin, authenticationStatus, signIn, signOut };
}

export function useAdminPermissions() {
  const { permissions, hasFullAccess, hasPermission } = useAdmin();
  return { permissions, hasFullAccess, hasPermission };
}

export function usePlatformConfig() {
  const { platformConfig, hasUnsavedChanges, updatePlatformConfig } = useAdmin();
  return { platformConfig, hasUnsavedChanges, updatePlatformConfig };
}

export function useSystemMonitoring() {
  const { systemStats, realTimeData, systemAlerts, notifications } = useAdmin();
  return { systemStats, realTimeData, systemAlerts, notifications };
}

export default AdminContext;
