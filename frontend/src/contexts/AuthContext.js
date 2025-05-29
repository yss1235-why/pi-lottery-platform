import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { piAuthService } from '../services/piAuthService';
import { performanceMonitor } from '../utils/monitoring';

// Initial state
const initialState = {
  // User authentication state
  isAuthenticated: false,
  isLoading: true,
  user: null,
  piUser: null,
  firebaseUser: null,
  
  // Authentication status
  authenticationStatus: 'idle', // idle, authenticating, authenticated, failed
  authError: null,
  
  // User session data
  sessionData: {
    loginTime: null,
    lastActivity: null,
    sessionExpiry: null
  },
  
  // User preferences and settings
  userPreferences: {
    notifications: true,
    soundEnabled: true,
    theme: 'dark',
    language: 'en'
  },
  
  // Connection status
  connectionStatus: 'disconnected', // connected, connecting, disconnected, error
  
  // Pi Network specific data
  piNetworkData: {
    balance: 0,
    walletAddress: null,
    networkStatus: 'disconnected'
  }
};

// Action types
const ActionTypes = {
  // Authentication actions
  SET_LOADING: 'SET_LOADING',
  AUTHENTICATION_START: 'AUTHENTICATION_START',
  AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
  AUTHENTICATION_FAILURE: 'AUTHENTICATION_FAILURE',
  LOGOUT: 'LOGOUT',
  
  // User data actions
  UPDATE_USER_DATA: 'UPDATE_USER_DATA',
  UPDATE_PI_NETWORK_DATA: 'UPDATE_PI_NETWORK_DATA',
  UPDATE_USER_PREFERENCES: 'UPDATE_USER_PREFERENCES',
  
  // Session management
  UPDATE_SESSION_DATA: 'UPDATE_SESSION_DATA',
  EXTEND_SESSION: 'EXTEND_SESSION',
  
  // Connection status
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  
  // Error handling
  SET_AUTH_ERROR: 'SET_AUTH_ERROR',
  CLEAR_AUTH_ERROR: 'CLEAR_AUTH_ERROR'
};

// Reducer function
function authReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case ActionTypes.AUTHENTICATION_START:
      return {
        ...state,
        isLoading: true,
        authenticationStatus: 'authenticating',
        authError: null
      };

    case ActionTypes.AUTHENTICATION_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        authenticationStatus: 'authenticated',
        user: action.payload.user,
        piUser: action.payload.piUser,
        firebaseUser: action.payload.firebaseUser,
        sessionData: {
          ...state.sessionData,
          loginTime: new Date(),
          lastActivity: new Date(),
          sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        },
        authError: null
      };

    case ActionTypes.AUTHENTICATION_FAILURE:
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        authenticationStatus: 'failed',
        user: null,
        piUser: null,
        firebaseUser: null,
        authError: action.payload.error,
        sessionData: initialState.sessionData
      };

    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
        authenticationStatus: 'idle',
        userPreferences: state.userPreferences // Preserve user preferences
      };

    case ActionTypes.UPDATE_USER_DATA:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };

    case ActionTypes.UPDATE_PI_NETWORK_DATA:
      return {
        ...state,
        piNetworkData: { ...state.piNetworkData, ...action.payload }
      };

    case ActionTypes.UPDATE_USER_PREFERENCES:
      return {
        ...state,
        userPreferences: { ...state.userPreferences, ...action.payload }
      };

    case ActionTypes.UPDATE_SESSION_DATA:
      return {
        ...state,
        sessionData: { ...state.sessionData, ...action.payload }
      };

    case ActionTypes.EXTEND_SESSION:
      return {
        ...state,
        sessionData: {
          ...state.sessionData,
          lastActivity: new Date(),
          sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      };

    case ActionTypes.SET_CONNECTION_STATUS:
      return {
        ...state,
        connectionStatus: action.payload
      };

    case ActionTypes.SET_AUTH_ERROR:
      return {
        ...state,
        authError: action.payload
      };

    case ActionTypes.CLEAR_AUTH_ERROR:
      return {
        ...state,
        authError: null
      };

    default:
      return state;
  }
}

// Create contexts
const AuthContext = createContext();
const AuthDispatchContext = createContext();

// Auth Provider component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication state on mount
  useEffect(() => {
    initializeAuthState();
  }, []);

  // Session monitoring
  useEffect(() => {
    if (state.isAuthenticated) {
      const sessionTimer = setInterval(checkSessionValidity, 60000); // Check every minute
      return () => clearInterval(sessionTimer);
    }
  }, [state.isAuthenticated, state.sessionData.sessionExpiry]);

  // Performance monitoring
  useEffect(() => {
    if (state.isAuthenticated) {
      performanceMonitor.logUserAction('user_authenticated', {
        userId: state.firebaseUser?.uid,
        loginMethod: 'pi_network'
      });
    }
  }, [state.isAuthenticated]);

  const initializeAuthState = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      
      // Check if user is already authenticated
      const currentUser = piAuthService.getCurrentUser();
      
      if (currentUser.isAuthenticated) {
        dispatch({
          type: ActionTypes.AUTHENTICATION_SUCCESS,
          payload: {
            user: currentUser,
            piUser: currentUser.piUser,
            firebaseUser: currentUser.firebaseUser
          }
        });
        
        // Load additional user data
        await loadUserData(currentUser.firebaseUser.uid);
        
        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'connected' });
      } else {
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      dispatch({
        type: ActionTypes.AUTHENTICATION_FAILURE,
        payload: { error: error.message }
      });
    }
  };

  const loadUserData = async (userId) => {
    try {
      // Load user preferences from localStorage
      const savedPreferences = localStorage.getItem(`userPreferences_${userId}`);
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        dispatch({
          type: ActionTypes.UPDATE_USER_PREFERENCES,
          payload: preferences
        });
      }

      // Load Pi Network data
      await updatePiNetworkData();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const updatePiNetworkData = async () => {
    try {
      // This would integrate with actual Pi Network APIs
      const mockPiData = {
        balance: 45.7, // This would come from Pi Network API
        walletAddress: state.piUser?.uid || null,
        networkStatus: 'connected'
      };

      dispatch({
        type: ActionTypes.UPDATE_PI_NETWORK_DATA,
        payload: mockPiData
      });
    } catch (error) {
      console.error('Failed to update Pi Network data:', error);
    }
  };

  const checkSessionValidity = () => {
    const now = new Date();
    if (state.sessionData.sessionExpiry && now > new Date(state.sessionData.sessionExpiry)) {
      handleLogout();
    }
  };

  // Authentication methods
  const handleSignIn = async () => {
    try {
      dispatch({ type: ActionTypes.AUTHENTICATION_START });
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'connecting' });

      const authResult = await piAuthService.authenticateWithPi();

      if (authResult.success) {
        dispatch({
          type: ActionTypes.AUTHENTICATION_SUCCESS,
          payload: {
            user: authResult,
            piUser: authResult.piUser,
            firebaseUser: authResult.firebaseUser
          }
        });

        await loadUserData(authResult.firebaseUser.uid);
        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'connected' });

        performanceMonitor.logUserAction('authentication_success', {
          userId: authResult.firebaseUser.uid,
          method: 'pi_network'
        });

        return authResult;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Sign in failed:', error);
      
      dispatch({
        type: ActionTypes.AUTHENTICATION_FAILURE,
        payload: { error: error.message }
      });
      
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'error' });
      
      performanceMonitor.logError(error, { context: 'authentication' });
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });

      // Save user preferences before logout
      if (state.firebaseUser?.uid) {
        localStorage.setItem(`userPreferences_${state.firebaseUser.uid}`, JSON.stringify(state.userPreferences));
      }

      await piAuthService.signOut();
      dispatch({ type: ActionTypes.LOGOUT });
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'disconnected' });

      performanceMonitor.logUserAction('user_logout', {
        userId: state.firebaseUser?.uid
      });
    } catch (error) {
      console.error('Logout failed:', error);
      dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: error.message });
    }
  };

  const createPayment = async (amount, memo, metadata = {}) => {
    try {
      if (!state.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      dispatch({ type: ActionTypes.EXTEND_SESSION });

      const payment = await piAuthService.createPayment(amount, memo, metadata);
      
      performanceMonitor.logUserAction('payment_created', {
        userId: state.firebaseUser?.uid,
        amount,
        memo
      });

      return payment;
    } catch (error) {
      console.error('Payment creation failed:', error);
      performanceMonitor.logError(error, { context: 'payment_creation' });
      throw error;
    }
  };

  const updateUserPreferences = async (newPreferences) => {
    try {
      dispatch({
        type: ActionTypes.UPDATE_USER_PREFERENCES,
        payload: newPreferences
      });

      // Save to localStorage
      if (state.firebaseUser?.uid) {
        const updatedPreferences = { ...state.userPreferences, ...newPreferences };
        localStorage.setItem(`userPreferences_${state.firebaseUser.uid}`, JSON.stringify(updatedPreferences));
      }
    } catch (error) {
      console.error('Failed to update user preferences:', error);
    }
  };

  const extendSession = () => {
    dispatch({ type: ActionTypes.EXTEND_SESSION });
  };

  const clearAuthError = () => {
    dispatch({ type: ActionTypes.CLEAR_AUTH_ERROR });
  };

  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Methods
    signIn: handleSignIn,
    signOut: handleLogout,
    createPayment,
    updateUserPreferences,
    extendSession,
    clearAuthError,
    updatePiNetworkData
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <AuthDispatchContext.Provider value={dispatch}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthContext.Provider>
  );
}

// Custom hooks
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthDispatch() {
  const context = useContext(AuthDispatchContext);
  if (!context) {
    throw new Error('useAuthDispatch must be used within an AuthProvider');
  }
  return context;
}

// Utility hooks
export function useAuthStatus() {
  const { isAuthenticated, isLoading, authenticationStatus } = useAuth();
  return { isAuthenticated, isLoading, authenticationStatus };
}

export function useUserData() {
  const { user, piUser, firebaseUser, piNetworkData } = useAuth();
  return { user, piUser, firebaseUser, piNetworkData };
}

export function useSession() {
  const { sessionData, extendSession } = useAuth();
  return { sessionData, extendSession };
}

export default AuthContext;
