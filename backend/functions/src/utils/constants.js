// backend/functions/src/utils/constants.js

/**
 * Application Constants
 * Centralized configuration and constants for the Pi Lottery Platform
 */

// Environment Configuration
export const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// Pi Network Configuration
export const PI_NETWORK = {
  API_BASE_URL: process.env.PI_API_BASE_URL || 'https://api.minepi.com',
  SANDBOX_URL: 'https://api.sandbox.minepi.com',
  VERSION: '2.0',
  REQUIRED_SCOPES: ['username', 'payments'],
  TRANSACTION_FEE: 0.01, // Pi Network transaction fee
  MIN_PAYMENT_AMOUNT: 0.001,
  MAX_PAYMENT_AMOUNT: 1000.0
};

// Firebase Configuration
export const FIREBASE = {
  REGION: process.env.FIREBASE_REGION || 'us-central1',
  PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  MAX_BATCH_SIZE: 500,
  MAX_QUERY_LIMIT: 1000,
  TIMEOUT_DURATION: 60000 // 60 seconds
};

// Lottery System Constants
export const LOTTERY = {
  TYPES: {
    DAILY_PI: 'daily_pi',
    DAILY_ADS: 'daily_ads',
    WEEKLY_PI: 'weekly_pi',
    MONTHLY_PI: 'monthly_pi'
  },
  
  STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    EXTENDED: 'extended',
    PENDING: 'pending'
  },
  
  ENTRY_METHODS: {
    PI_PAYMENT: 'pi_payment',
    WATCH_ADS: 'watch_ads',
    PROMOTIONAL: 'promotional'
  },
  
  DEFAULT_CONFIG: {
    daily_pi: {
      name: 'Daily Pi Lottery',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 3,
      minParticipants: 5,
      drawFrequency: 24,
      scheduledTime: '20:00',
      isEnabled: true,
      extensionHours: 24,
      maxExtensions: 3
    },
    daily_ads: {
      name: 'Daily Ads Lottery',
      entryFee: 0,
      adValue: 0.001,
      maxTicketsPerUser: 5,
      minParticipants: 10,
      drawFrequency: 24,
      scheduledTime: '21:00',
      isEnabled: true,
      extensionHours: 24,
      maxExtensions: 2
    },
    weekly_pi: {
      name: 'Weekly Pi Lottery',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 10,
      minParticipants: 20,
      drawFrequency: 168,
      scheduledTime: 'sunday_18:00',
      isEnabled: true,
      extensionHours: 48,
      maxExtensions: 2
    },
    monthly_pi: {
      name: 'Monthly Pi Lottery',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 25,
      minParticipants: 30,
      drawFrequency: 720,
      scheduledTime: 'last_day_21:00',
      isEnabled: false,
      extensionHours: 72,
      maxExtensions: 1
    }
  }
};

// Prize Distribution Structures
export const PRIZE_STRUCTURES = {
  SMALL: {
    name: 'Small Lottery (≤50 participants)',
    maxParticipants: 50,
    distribution: {
      first: 0.6,
      second: 0.25,
      third: 0.15
    }
  },
  
  MEDIUM: {
    name: 'Medium Lottery (51-200 participants)',
    maxParticipants: 200,
    distribution: {
      first: 0.5,
      second: 0.25,
      third: 0.15,
      fourth: 0.06,
      fifth: 0.04
    }
  },
  
  LARGE: {
    name: 'Large Lottery (200+ participants)',
    maxParticipants: Infinity,
    distribution: {
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
    }
  }
};

// Winner Status Constants
export const WINNER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  TRANSFERRED: 'transferred',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Payment Constants
export const PAYMENT = {
  STATUS: {
    CREATED: 'created',
    PENDING: 'pending',
    APPROVED: 'approved',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    EXPIRED: 'expired'
  },
  
  TIMEOUT: {
    APPROVAL: 300000, // 5 minutes
    COMPLETION: 600000, // 10 minutes
    TOTAL: 900000 // 15 minutes
  },
  
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_FACTOR: 2,
    INITIAL_DELAY: 1000
  }
};

// Admin Permission Constants
export const ADMIN_PERMISSIONS = {
  MANAGE_LOTTERIES: 'manage_lotteries',
  APPROVE_PRIZES: 'approve_prizes',
  SYSTEM_CONFIG: 'system_config',
  USER_MANAGEMENT: 'user_management',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_ADS: 'manage_ads',
  FINANCIAL_REPORTS: 'financial_reports',
  SYSTEM_MAINTENANCE: 'system_maintenance'
};

// Advertisement System Constants
export const ADVERTISEMENT = {
  NETWORKS: {
    GOOGLE_ADMOB: 'google_admob',
    UNITY_ADS: 'unity_ads',
    FACEBOOK_AUDIENCE: 'facebook_audience'
  },
  
  CONFIG: {
    DEFAULT_DURATION: 30, // seconds
    MIN_WATCH_TIME: 25, // seconds
    COOLDOWN_PERIOD: 300, // 5 minutes
    MAX_ADS_PER_DAY: 5,
    REVENUE_SHARE: 0.003 // Pi per ad
  },
  
  STATUS: {
    STARTED: 'started',
    COMPLETED: 'completed',
    SKIPPED: 'skipped',
    FAILED: 'failed'
  }
};

// Security Constants
export const SECURITY = {
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: false
  },
  
  RATE_LIMITING: {
    MAX_REQUESTS_PER_MINUTE: 60,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 1800000, // 30 minutes
    WINDOW_SIZE: 60000 // 1 minute
  },
  
  JWT: {
    EXPIRY: '24h',
    REFRESH_EXPIRY: '7d',
    ALGORITHM: 'HS256'
  },
  
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16
  }
};

// Error Codes and Messages
export const ERROR_CODES = {
  // Authentication Errors (1000-1999)
  AUTH_REQUIRED: 1000,
  AUTH_INVALID: 1001,
  AUTH_EXPIRED: 1002,
  AUTH_INSUFFICIENT_PERMISSIONS: 1003,
  
  // Validation Errors (2000-2999)
  VALIDATION_FAILED: 2000,
  INVALID_INPUT: 2001,
  MISSING_REQUIRED_FIELD: 2002,
  INVALID_FORMAT: 2003,
  
  // Lottery Errors (3000-3999)
  LOTTERY_NOT_FOUND: 3000,
  LOTTERY_INACTIVE: 3001,
  LOTTERY_FULL: 3002,
  TICKET_LIMIT_EXCEEDED: 3003,
  INSUFFICIENT_PARTICIPANTS: 3004,
  DRAWING_IN_PROGRESS: 3005,
  
  // Payment Errors (4000-4999)
  PAYMENT_FAILED: 4000,
  PAYMENT_INVALID: 4001,
  PAYMENT_EXPIRED: 4002,
  INSUFFICIENT_BALANCE: 4003,
  PAYMENT_DUPLICATE: 4004,
  
  // System Errors (5000-5999)
  INTERNAL_ERROR: 5000,
  DATABASE_ERROR: 5001,
  EXTERNAL_API_ERROR: 5002,
  CONFIGURATION_ERROR: 5003,
  RESOURCE_UNAVAILABLE: 5004
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// Database Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  ADMIN_USERS: 'admin_users',
  LOTTERY_TYPES: 'lottery_types',
  LOTTERY_INSTANCES: 'lottery_instances',
  USER_ENTRIES: 'user_entries',
  LOTTERY_WINNERS: 'lottery_winners',
  PAYMENT_TRANSACTIONS: 'payment_transactions',
  USER_TICKET_LIMITS: 'user_ticket_limits',
  AD_COMPLETIONS: 'ad_completions',
  ADMIN_LOGS: 'admin_logs',
  SYSTEM_CONFIG: 'system_config',
  ERROR_LOGS: 'error_logs',
  PERFORMANCE_METRICS: 'performance_metrics'
};

// Time Constants
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  
  TIMEZONE_UTC: 'UTC',
  DEFAULT_TIMEZONE: 'America/New_York',
  
  FORMATS: {
    ISO_DATE: 'YYYY-MM-DD',
    ISO_DATETIME: 'YYYY-MM-DDTHH:mm:ss.sssZ',
    DISPLAY_DATE: 'MMM DD, YYYY',
    DISPLAY_DATETIME: 'MMM DD, YYYY HH:mm:ss'
  }
};

// Monitoring and Analytics Constants
export const MONITORING = {
  METRICS: {
    LOTTERY_ENTRY: 'lottery_entry',
    PAYMENT_PROCESSED: 'payment_processed',
    WINNER_SELECTED: 'winner_selected',
    PRIZE_TRANSFERRED: 'prize_transferred',
    USER_REGISTRATION: 'user_registration',
    AD_COMPLETION: 'ad_completion',
    ERROR_OCCURRED: 'error_occurred'
  },
  
  LOG_LEVELS: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal'
  },
  
  ALERT_THRESHOLDS: {
    HIGH_ERROR_RATE: 0.05, // 5%
    LOW_SUCCESS_RATE: 0.95, // 95%
    HIGH_RESPONSE_TIME: 5000, // 5 seconds
    LOW_AVAILABILITY: 0.99 // 99%
  }
};

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_AD_LOTTERY: process.env.ENABLE_AD_LOTTERY === 'true',
  ENABLE_MONTHLY_LOTTERY: process.env.ENABLE_MONTHLY_LOTTERY === 'true',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  ENABLE_DETAILED_LOGGING: process.env.ENABLE_DETAILED_LOGGING === 'true',
  ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false',
  ENABLE_AUTO_DRAWING: process.env.ENABLE_AUTO_DRAWING !== 'false'
};

// API Endpoints
export const API_ENDPOINTS = {
  PI_NETWORK: {
    AUTHENTICATE: '/v2/authenticate',
    PAYMENTS: '/v2/payments',
    USER_INFO: '/v2/me'
  },
  
  INTERNAL: {
    HEALTH_CHECK: '/health',
    METRICS: '/metrics',
    STATUS: '/status'
  }
};

// Regular Expressions for Validation
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  PI_AMOUNT: /^\d+(\.\d{1,6})?$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
  DATETIME_ISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
};

// Default Values
export const DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  CACHE_TTL: 300, // 5 minutes
  REQUEST_TIMEOUT: 30000, // 30 seconds
  BATCH_SIZE: 50,
  RETRY_DELAY: 1000 // 1 second
};

export default {
  ENVIRONMENT,
  PI_NETWORK,
  FIREBASE,
  LOTTERY,
  PRIZE_STRUCTURES,
  WINNER_STATUS,
  PAYMENT,
  ADMIN_PERMISSIONS,
  ADVERTISEMENT,
  SECURITY,
  ERROR_CODES,
  HTTP_STATUS,
  COLLECTIONS,
  TIME,
  MONITORING,
  FEATURE_FLAGS,
  API_ENDPOINTS,
  REGEX_PATTERNS,
  DEFAULTS
};
