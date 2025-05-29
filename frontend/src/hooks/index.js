// Authentication Hooks
export { usePiAuth, default as useAuth } from './useAuth';
export { useAdminAuth, default as useAdminAuthHook } from './useAdminAuth';

// Lottery Management Hooks
export { useLottery, useLotteryInstance, default as useLotteryHook } from './useLottery';

// Payment Processing Hooks
export { usePayment, usePaymentHistory, default as usePaymentHook } from './usePayment';

// Advertisement Lottery Hooks
export { useAdLottery, useAdNetwork, default as useAdLotteryHook } from './useAdLottery';

// Combined Authentication Hook for backwards compatibility
export function useAuthCombined() {
  const piAuth = usePiAuth();
  const adminAuth = useAdminAuth();
  
  return {
    // Pi Network User Authentication
    user: piAuth.user,
    loading: piAuth.loading || adminAuth.loading,
    isAuthenticated: piAuth.isAuthenticated,
    signIn: piAuth.signIn,
    signOut: piAuth.signOut,
    createPayment: piAuth.createPayment,
    error: piAuth.error,
    
    // Admin Authentication
    admin: adminAuth.admin,
    isAdmin: adminAuth.isAdmin,
    adminSignIn: adminAuth.signIn,
    adminSignOut: adminAuth.signOut,
    hasPermission: adminAuth.hasPermission,
    adminError: adminAuth.error
  };
}

// Hook Utilities
export const hookUtils = {
  // Combine multiple hook states
  combineStates: (...states) => {
    return states.reduce((combined, state) => ({
      ...combined,
      ...state,
      loading: states.some(s => s.loading),
      error: states.find(s => s.error)?.error || null
    }), {});
  },
  
  // Check if any hooks are loading
  isAnyLoading: (...hooks) => {
    return hooks.some(hook => hook.loading);
  },
  
  // Get first error from hooks
  getFirstError: (...hooks) => {
    return hooks.find(hook => hook.error)?.error || null;
  },
  
  // Format time utilities
  formatTime: {
    countdown: (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    },
    
    cooldown: (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    },
    
    duration: (milliseconds) => {
      const seconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    }
  },
  
  // Validation utilities
  validate: {
    piAmount: (amount) => {
      const num = parseFloat(amount);
      return !isNaN(num) && num > 0 && num <= 1000;
    },
    
    username: (username) => {
      return username && username.length >= 3 && username.length <= 20;
    },
    
    email: (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
  }
};

// Default export for convenience
export default {
  usePiAuth,
  useAdminAuth,
  useLottery,
  useLotteryInstance,
  usePayment,
  usePaymentHistory,
  useAdLottery,
  useAdNetwork,
  useAuthCombined,
  hookUtils
};
