/**
 * Environment Configuration Management
 * Handles environment-specific settings and configurations
 */

// Environment detection utilities
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isStaging = () => process.env.NODE_ENV === 'staging' || process.env.REACT_APP_ENVIRONMENT === 'staging';
export const isTest = () => process.env.NODE_ENV === 'test';

// Current environment
const CURRENT_ENVIRONMENT = process.env.NODE_ENV || 'development';

// Environment-specific configurations
export const ENVIRONMENT_CONFIG = {
  development: {
    name: 'Development',
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
    
    // Firebase settings
    firebase: {
      useEmulators: process.env.REACT_APP_USE_EMULATORS === 'true',
      emulatorPorts: {
        auth: 9099,
        firestore: 8080,
        functions: 5001,
        storage: 9199
      }
    },
    
    // Pi Network settings
    piNetwork: {
      sandbox: true,
      apiBaseUrl: 'https://api.minepi.com',
      hostname: process.env.REACT_APP_PRODUCTION_HOSTNAME || 'localhost:3000'
    },
    
    // Security settings
    security: {
      enableCORS: true,
      allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      rateLimit: {
        enabled: false,
        maxRequests: 1000
      }
    },
    
    // Logging and debugging
    logging: {
      level: 'debug',
      enableConsole: true,
      enableAnalytics: false,
      enableErrorReporting: false
    },
    
    // Feature flags
    features: {
      enableDebugMode: true,
      enableTestMode: true,
      enableMockPayments: true,
      enableBetaFeatures: true,
      skipRealPayments: true
    },
    
    // Performance settings
    performance: {
      enableHotReload: true,
      enableSourceMaps: true,
      optimizeAssets: false
    }
  },

  staging: {
    name: 'Staging',
    apiUrl: process.env.REACT_APP_API_URL || 'https://staging-api.pilottery.app',
    
    // Firebase settings
    firebase: {
      useEmulators: false,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID + '-staging'
    },
    
    // Pi Network settings
    piNetwork: {
      sandbox: true,
      apiBaseUrl: 'https://api.minepi.com',
      hostname: process.env.REACT_APP_PRODUCTION_HOSTNAME || 'staging.pilottery.app'
    },
    
    // Security settings
    security: {
      enableCORS: true,
      allowedOrigins: [
        'https://staging.pilottery.app',
        'https://staging-app.pilottery.app'
      ],
      rateLimit: {
        enabled: true,
        maxRequests: 100
      }
    },
    
    // Logging and debugging
    logging: {
      level: 'info',
      enableConsole: true,
      enableAnalytics: true,
      enableErrorReporting: true
    },
    
    // Feature flags
    features: {
      enableDebugMode: false,
      enableTestMode: true,
      enableMockPayments: false,
      enableBetaFeatures: true,
      skipRealPayments: false
    },
    
    // Performance settings
    performance: {
      enableHotReload: false,
      enableSourceMaps: true,
      optimizeAssets: true
    }
  },

  production: {
    name: 'Production',
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.pilottery.app',
    
    // Firebase settings
    firebase: {
      useEmulators: false,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
    },
    
    // Pi Network settings
    piNetwork: {
      sandbox: process.env.REACT_APP_PI_SANDBOX === 'true',
      apiBaseUrl: 'https://api.minepi.com',
      hostname: process.env.REACT_APP_PRODUCTION_HOSTNAME || 'pilottery.app'
    },
    
    // Security settings
    security: {
      enableCORS: true,
      allowedOrigins: [
        'https://pilottery.app',
        'https://www.pilottery.app',
        'https://app.pilottery.app'
      ],
      rateLimit: {
        enabled: true,
        maxRequests: 60
      }
    },
    
    // Logging and debugging
    logging: {
      level: 'warn',
      enableConsole: false,
      enableAnalytics: true,
      enableErrorReporting: true
    },
    
    // Feature flags
    features: {
      enableDebugMode: false,
      enableTestMode: false,
      enableMockPayments: false,
      enableBetaFeatures: process.env.REACT_APP_ENABLE_BETA_FEATURES === 'true',
      skipRealPayments: false
    },
    
    // Performance settings
    performance: {
      enableHotReload: false,
      enableSourceMaps: false,
      optimizeAssets: true
    }
  },

  test: {
    name: 'Test',
    apiUrl: 'http://localhost:3000',
    
    // Firebase settings
    firebase: {
      useEmulators: true,
      emulatorPorts: {
        auth: 9099,
        firestore: 8080,
        functions: 5001,
        storage: 9199
      }
    },
    
    // Pi Network settings
    piNetwork: {
      sandbox: true,
      apiBaseUrl: 'https://api.minepi.com',
      hostname: 'localhost:3000'
    },
    
    // Security settings
    security: {
      enableCORS: false,
      allowedOrigins: ['*'],
      rateLimit: {
        enabled: false,
        maxRequests: 10000
      }
    },
    
    // Logging and debugging
    logging: {
      level: 'error',
      enableConsole: false,
      enableAnalytics: false,
      enableErrorReporting: false
    },
    
    // Feature flags
    features: {
      enableDebugMode: false,
      enableTestMode: true,
      enableMockPayments: true,
      enableBetaFeatures: true,
      skipRealPayments: true
    },
    
    // Performance settings
    performance: {
      enableHotReload: false,
      enableSourceMaps: false,
      optimizeAssets: false
    }
  }
};

/**
 * Get configuration for current environment
 * @returns {Object} Environment configuration
 */
export function getEnvironmentConfig() {
  const config = ENVIRONMENT_CONFIG[CURRENT_ENVIRONMENT];
  
  if (!config) {
    console.warn(`Unknown environment: ${CURRENT_ENVIRONMENT}, falling back to development`);
    return ENVIRONMENT_CONFIG.development;
  }
  
  return {
    ...config,
    environment: CURRENT_ENVIRONMENT,
    timestamp: Date.now()
  };
}

/**
 * Get environment-specific database configuration
 * @returns {Object} Database configuration
 */
export function getDatabaseConfig() {
  const envConfig = getEnvironmentConfig();
  
  return {
    useEmulators: envConfig.firebase?.useEmulators || false,
    emulatorPorts: envConfig.firebase?.emulatorPorts || {},
    projectId: envConfig.firebase?.projectId || process.env.REACT_APP_FIREBASE_PROJECT_ID
  };
}

/**
 * Get environment-specific API configuration
 * @returns {Object} API configuration
 */
export function getApiConfig() {
  const envConfig = getEnvironmentConfig();
  
  return {
    baseUrl: envConfig.apiUrl,
    timeout: isProduction() ? 30000 : 60000,
    retryAttempts: isProduction() ? 3 : 1,
    rateLimit: envConfig.security?.rateLimit || { enabled: false, maxRequests: 100 }
  };
}

/**
 * Get environment-specific security configuration
 * @returns {Object} Security configuration
 */
export function getSecurityConfig() {
  const envConfig = getEnvironmentConfig();
  
  return {
    ...envConfig.security,
    strictMode: isProduction(),
    enableHTTPS: isProduction() || isStaging(),
    sessionTimeout: isProduction() ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 1 day prod, 1 week dev
    maxLoginAttempts: isProduction() ? 5 : 10
  };
}

/**
 * Get environment-specific logging configuration
 * @returns {Object} Logging configuration
 */
export function getLoggingConfig() {
  const envConfig = getEnvironmentConfig();
  
  return {
    ...envConfig.logging,
    includeStackTrace: !isProduction(),
    sanitizeData: isProduction(),
    enablePerformanceMonitoring: isProduction() || isStaging()
  };
}

/**
 * Get environment-specific feature flag configuration
 * @returns {Object} Feature flags
 */
export function getFeatureFlags() {
  const envConfig = getEnvironmentConfig();
  
  return {
    ...envConfig.features,
    // Override with environment variables if set
    enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true' || envConfig.logging?.enableAnalytics,
    enableErrorReporting: process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true' || envConfig.logging?.enableErrorReporting,
    enableBetaFeatures: process.env.REACT_APP_ENABLE_BETA_FEATURES === 'true' || envConfig.features?.enableBetaFeatures
  };
}

/**
 * Get environment-specific Pi Network configuration
 * @returns {Object} Pi Network configuration
 */
export function getPiNetworkConfig() {
  const envConfig = getEnvironmentConfig();
  
  return {
    ...envConfig.piNetwork,
    version: '2.0',
    scopes: ['username', 'payments'],
    enableMockPayments: envConfig.features?.enableMockPayments || false,
    skipRealPayments: envConfig.features?.skipRealPayments || false
  };
}

/**
 * Validate environment configuration
 * @returns {Object} Validation results
 */
export function validateEnvironmentConfig() {
  const config = getEnvironmentConfig();
  const issues = [];
  const warnings = [];

  // Validate required environment variables
  const requiredVars = [
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN'
  ];

  if (isProduction()) {
    requiredVars.push(
      'REACT_APP_PI_API_KEY',
      'REACT_APP_PRODUCTION_HOSTNAME'
    );
  }

  const missingVars = requiredVars.filter(key => !process.env[key]);
  if (missingVars.length > 0) {
    issues.push(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate production-specific requirements
  if (isProduction()) {
    if (config.piNetwork?.sandbox) {
      warnings.push('Pi Network sandbox mode enabled in production');
    }
    
    if (config.features?.enableDebugMode) {
      warnings.push('Debug mode enabled in production');
    }
    
    if (config.features?.enableTestMode) {
      warnings.push('Test mode enabled in production');
    }
  }

  // Validate development-specific settings
  if (isDevelopment()) {
    if (!config.firebase?.useEmulators) {
      warnings.push('Firebase emulators not enabled in development');
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    environment: CURRENT_ENVIRONMENT,
    config: config
  };
}

/**
 * Get environment information summary
 * @returns {Object} Environment summary
 */
export function getEnvironmentSummary() {
  const config = getEnvironmentConfig();
  const validation = validateEnvironmentConfig();
  
  return {
    environment: CURRENT_ENVIRONMENT,
    name: config.name,
    timestamp: new Date().toISOString(),
    
    status: {
      isValid: validation.isValid,
      issueCount: validation.issues.length,
      warningCount: validation.warnings.length
    },
    
    services: {
      firebase: {
        emulators: config.firebase?.useEmulators || false,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
      },
      piNetwork: {
        sandbox: config.piNetwork?.sandbox || false,
        hostname: config.piNetwork?.hostname
      }
    },
    
    features: config.features,
    security: {
      corsEnabled: config.security?.enableCORS,
      rateLimitEnabled: config.security?.rateLimit?.enabled
    },
    
    performance: config.performance
  };
}

// Export current environment configuration
export const currentEnvironmentConfig = getEnvironmentConfig();

// Export environment utilities
export const environmentUtils = {
  getEnvironmentConfig,
  getDatabaseConfig,
  getApiConfig,
  getSecurityConfig,
  getLoggingConfig,
  getFeatureFlags,
  getPiNetworkConfig,
  validateEnvironmentConfig,
  getEnvironmentSummary
};

export default {
  ENVIRONMENT_CONFIG,
  currentEnvironmentConfig,
  isDevelopment,
  isProduction,
  isStaging,
  isTest,
  getEnvironmentConfig,
  getDatabaseConfig,
  getApiConfig,
  getSecurityConfig,
  getLoggingConfig,
  getFeatureFlags,
  getPiNetworkConfig,
  validateEnvironmentConfig,
  getEnvironmentSummary,
  environmentUtils
};
