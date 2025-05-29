// Configuration module exports
// Centralized configuration management for Pi Lottery Platform

// Import all configuration modules
import firebaseApp, { 
  auth, 
  db, 
  functions, 
  storage, 
  analytics,
  checkFirebaseConnection,
  getFirebaseConfig,
  handleFirebaseError
} from './firebase';

import {
  APP_CONFIG,
  PI_NETWORK_CONFIG,
  LOTTERY_CONFIG,
  ADMIN_CONFIG,
  SECURITY_CONFIG,
  AD_CONFIG,
  UI_CONFIG,
  API_CONFIG,
  FEATURE_FLAGS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STORAGE_KEYS,
  DATE_FORMATS,
  VALIDATION_RULES,
  CONFIG
} from './constants';

import piNetworkConfig, { PiNetworkConfig } from './piNetwork';

// Environment configuration
import { 
  ENVIRONMENT_CONFIG, 
  isDevelopment, 
  isProduction, 
  isStaging,
  getEnvironmentConfig
} from './environment';

// ============================================
// FIREBASE CONFIGURATION EXPORTS
// ============================================
export {
  // Firebase app and services
  firebaseApp,
  auth,
  db,
  functions,
  storage,
  analytics,
  
  // Firebase utilities
  checkFirebaseConnection,
  getFirebaseConfig,
  handleFirebaseError
};

// ============================================
// PI NETWORK CONFIGURATION EXPORTS
// ============================================
export {
  // Pi Network configuration
  piNetworkConfig,
  PiNetworkConfig
};

// ============================================
// APPLICATION CONFIGURATION EXPORTS
// ============================================
export {
  // Core application config
  APP_CONFIG,
  PI_NETWORK_CONFIG,
  LOTTERY_CONFIG,
  ADMIN_CONFIG,
  SECURITY_CONFIG,
  AD_CONFIG,
  UI_CONFIG,
  API_CONFIG,
  
  // Feature flags and settings
  FEATURE_FLAGS,
  
  // Messages and UI content
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  
  // Storage and data management
  STORAGE_KEYS,
  DATE_FORMATS,
  VALIDATION_RULES,
  
  // Consolidated configuration object
  CONFIG
};

// ============================================
// ENVIRONMENT CONFIGURATION EXPORTS
// ============================================
export {
  ENVIRONMENT_CONFIG,
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironmentConfig
};

// ============================================
// CONFIGURATION UTILITIES
// ============================================

/**
 * Initialize all configuration modules
 * @returns {Promise<Object>} Initialization results
 */
export async function initializeConfig() {
  const results = {
    firebase: { status: 'pending' },
    piNetwork: { status: 'pending' },
    environment: { status: 'pending' }
  };

  try {
    // Initialize Firebase
    const firebaseStatus = await checkFirebaseConnection();
    results.firebase = {
      status: firebaseStatus.status === 'connected' ? 'success' : 'error',
      details: firebaseStatus
    };
  } catch (error) {
    results.firebase = {
      status: 'error',
      error: error.message
    };
  }

  try {
    // Initialize Pi Network SDK
    const piNetworkStatus = await piNetworkConfig.initialize();
    results.piNetwork = {
      status: piNetworkStatus ? 'success' : 'warning',
      details: piNetworkConfig.getConnectionStatus()
    };
  } catch (error) {
    results.piNetwork = {
      status: 'error',
      error: error.message
    };
  }

  try {
    // Validate environment configuration
    const envConfig = getEnvironmentConfig();
    results.environment = {
      status: 'success',
      details: envConfig
    };
  } catch (error) {
    results.environment = {
      status: 'error',
      error: error.message
    };
  }

  return results;
}

/**
 * Get configuration summary for debugging
 * @returns {Object} Configuration summary
 */
export function getConfigurationSummary() {
  return {
    environment: {
      mode: process.env.NODE_ENV,
      development: isDevelopment(),
      production: isProduction(),
      staging: isStaging()
    },
    firebase: {
      projectId: getFirebaseConfig().projectId,
      emulators: getFirebaseConfig().emulators,
      services: ['auth', 'firestore', 'functions', 'storage', 'analytics']
    },
    piNetwork: {
      sandbox: PI_NETWORK_CONFIG.sandbox,
      version: PI_NETWORK_CONFIG.version,
      available: piNetworkConfig.isInPiBrowser()
    },
    features: Object.entries(FEATURE_FLAGS).reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {}),
    lotteries: Object.keys(LOTTERY_CONFIG.types).map(type => ({
      type,
      enabled: LOTTERY_CONFIG.types[type].isEnabled
    }))
  };
}

/**
 * Validate configuration completeness
 * @returns {Object} Validation results
 */
export function validateConfiguration() {
  const validationResults = {
    isValid: true,
    issues: [],
    warnings: []
  };

  // Validate Firebase configuration
  const requiredFirebaseVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];

  const missingFirebaseVars = requiredFirebaseVars.filter(key => !process.env[key]);
  if (missingFirebaseVars.length > 0) {
    validationResults.isValid = false;
    validationResults.issues.push({
      type: 'firebase',
      message: `Missing Firebase environment variables: ${missingFirebaseVars.join(', ')}`
    });
  }

  // Validate Pi Network configuration
  if (!PI_NETWORK_CONFIG.apiKey) {
    validationResults.warnings.push({
      type: 'piNetwork',
      message: 'Pi Network API key not configured'
    });
  }

  // Validate feature flags
  if (FEATURE_FLAGS.enableAnalytics && !process.env.REACT_APP_FIREBASE_MEASUREMENT_ID) {
    validationResults.warnings.push({
      type: 'analytics',
      message: 'Analytics enabled but measurement ID not configured'
    });
  }

  // Validate lottery configuration
  const enabledLotteries = Object.values(LOTTERY_CONFIG.types).filter(type => type.isEnabled);
  if (enabledLotteries.length === 0) {
    validationResults.warnings.push({
      type: 'lotteries',
      message: 'No lottery types are enabled'
    });
  }

  return validationResults;
}

/**
 * Get runtime configuration status
 * @returns {Promise<Object>} Runtime status
 */
export async function getRuntimeStatus() {
  const initialization = await initializeConfig();
  const validation = validateConfiguration();
  const summary = getConfigurationSummary();

  return {
    timestamp: new Date().toISOString(),
    initialization,
    validation,
    summary,
    health: {
      overall: validation.isValid && initialization.firebase.status === 'success' ? 'healthy' : 'degraded',
      firebase: initialization.firebase.status,
      piNetwork: initialization.piNetwork.status,
      environment: initialization.environment.status
    }
  };
}

// ============================================
// DEFAULT EXPORT
// ============================================
export default {
  // Core services
  firebaseApp,
  auth,
  db,
  functions,
  storage,
  analytics,
  piNetworkConfig,
  
  // Configuration objects
  APP_CONFIG,
  PI_NETWORK_CONFIG,
  LOTTERY_CONFIG,
  ADMIN_CONFIG,
  SECURITY_CONFIG,
  AD_CONFIG,
  UI_CONFIG,
  API_CONFIG,
  FEATURE_FLAGS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STORAGE_KEYS,
  DATE_FORMATS,
  VALIDATION_RULES,
  ENVIRONMENT_CONFIG,
  
  // Utilities
  initializeConfig,
  getConfigurationSummary,
  validateConfiguration,
  getRuntimeStatus,
  checkFirebaseConnection,
  handleFirebaseError,
  
  // Environment helpers
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironmentConfig
};
