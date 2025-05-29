// Application Configuration Constants
export const APP_CONFIG = {
  name: 'Pi Lottery Platform',
  version: process.env.REACT_APP_APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  supportEmail: process.env.REACT_APP_SUPPORT_EMAIL || 'support@pilottery.app',
  contactEmail: 'contact@pilottery.app',
  legalEmail: 'legal@pilottery.app',
  privacyEmail: 'privacy@pilottery.app',
  websiteUrl: 'https://pilottery.app',
  documentationUrl: 'https://docs.pilottery.app',
  githubUrl: 'https://github.com/pilottery/pi-lottery-platform'
};

// Pi Network Configuration
export const PI_NETWORK_CONFIG = {
  apiKey: process.env.REACT_APP_PI_API_KEY,
  sandbox: process.env.REACT_APP_PI_SANDBOX === 'true',
  productionHostname: process.env.REACT_APP_PRODUCTION_HOSTNAME || 'localhost:3000',
  version: '2.0',
  defaultScopes: ['username', 'payments'],
  apiBaseUrl: process.env.REACT_APP_PI_API_BASE_URL || 'https://api.minepi.com',
  explorerUrl: 'https://pi-blockchain.net',
  networkFee: 0.01 // Standard Pi Network transaction fee
};

// Lottery System Configuration
export const LOTTERY_CONFIG = {
  types: {
    daily_pi: {
      id: 'daily_pi',
      name: 'Daily Pi Lottery',
      description: 'Daily lottery with Pi cryptocurrency entry fee',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 3,
      minParticipants: 5,
      drawFrequency: 24, // hours
      scheduledTime: '20:00',
      timezone: 'UTC',
      prizeStructure: 'small',
      category: 'pi_payment',
      isEnabled: true
    },
    daily_ads: {
      id: 'daily_ads',
      name: 'Daily Ads Lottery',
      description: 'Free daily lottery entry by watching advertisements',
      entryFee: 0,
      adValue: 0.001,
      maxTicketsPerUser: 5,
      minParticipants: 10,
      drawFrequency: 24, // hours
      scheduledTime: '21:00',
      timezone: 'UTC',
      prizeStructure: 'micro',
      category: 'advertisement',
      isEnabled: true,
      adDuration: 30, // seconds
      cooldownPeriod: 300 // seconds (5 minutes)
    },
    weekly_pi: {
      id: 'weekly_pi',
      name: 'Weekly Pi Lottery',
      description: 'Weekly lottery with higher prize pool',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 10,
      minParticipants: 20,
      drawFrequency: 168, // hours (1 week)
      scheduledTime: 'sunday_18:00',
      timezone: 'UTC',
      prizeStructure: 'medium',
      category: 'pi_payment',
      isEnabled: true
    },
    monthly_pi: {
      id: 'monthly_pi',
      name: 'Monthly Pi Lottery',
      description: 'Monthly lottery with maximum prize pool',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 25,
      minParticipants: 30,
      drawFrequency: 720, // hours (~30 days)
      scheduledTime: 'last_day_21:00',
      timezone: 'UTC',
      prizeStructure: 'large',
      category: 'pi_payment',
      isEnabled: false // Disabled by default
    }
  },
  
  prizeStructures: {
    micro: {
      name: 'Micro Prize Structure',
      maxParticipants: 50,
      distribution: { 
        first: 0.5, 
        second: 0.3, 
        third: 0.2 
      },
      positions: 3
    },
    small: {
      name: 'Small Prize Structure',
      maxParticipants: 50,
      distribution: { 
        first: 0.6, 
        second: 0.25, 
        third: 0.15 
      },
      positions: 3
    },
    medium: {
      name: 'Medium Prize Structure',
      maxParticipants: 200,
      distribution: { 
        first: 0.5, 
        second: 0.25, 
        third: 0.15, 
        fourth: 0.06, 
        fifth: 0.04 
      },
      positions: 5
    },
    large: {
      name: 'Large Prize Structure',
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
      },
      positions: 10
    }
  },

  // Drawing schedule extensions
  extensionPolicy: {
    maxExtensions: 3,
    extensionHours: 24,
    minParticipantThreshold: 0.5 // 50% of minimum required
  },

  // Prize claim settings
  prizePolicy: {
    claimDeadlineDays: 90,
    unclaimedPrizeAction: 'return_to_pool',
    minPrizeAmount: 0.001
  }
};

// Administrative Configuration
export const ADMIN_CONFIG = {
  permissions: [
    'manage_lotteries',
    'approve_prizes',
    'system_config',
    'user_management',
    'view_analytics',
    'manage_ads',
    'financial_reports',
    'audit_logs',
    'security_settings'
  ],
  
  defaultPermissions: [
    'manage_lotteries',
    'approve_prizes',
    'system_config'
  ],
  
  roles: {
    super_admin: {
      name: 'Super Administrator',
      permissions: [
        'manage_lotteries',
        'approve_prizes',
        'system_config',
        'user_management',
        'view_analytics',
        'manage_ads',
        'financial_reports',
        'audit_logs',
        'security_settings'
      ]
    },
    admin: {
      name: 'Administrator',
      permissions: [
        'manage_lotteries',
        'approve_prizes',
        'system_config',
        'view_analytics'
      ]
    },
    moderator: {
      name: 'Moderator',
      permissions: [
        'manage_lotteries',
        'approve_prizes'
      ]
    }
  }
};

// Security Configuration
export const SECURITY_CONFIG = {
  authentication: {
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    passwordMinLength: 8,
    requireMFA: process.env.REACT_APP_REQUIRE_MFA === 'true',
    allowedDomains: process.env.REACT_APP_ALLOWED_DOMAINS?.split(',') || []
  },
  
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxPaymentRequestsPerHour: 10,
    maxLotteryEntriesPerHour: 20
  },
  
  validation: {
    maxUsernameLength: 50,
    maxMessageLength: 500,
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
    maxFileSize: 5 * 1024 * 1024 // 5MB
  }
};

// Advertisement Configuration
export const AD_CONFIG = {
  networks: [
    {
      id: 'google_admob',
      name: 'Google AdMob',
      enabled: true,
      revenueShare: 0.003
    },
    {
      id: 'unity_ads',
      name: 'Unity Ads',
      enabled: true,
      revenueShare: 0.0025
    },
    {
      id: 'facebook_audience',
      name: 'Facebook Audience Network',
      enabled: false,
      revenueShare: 0.0035
    }
  ],
  
  settings: {
    defaultDuration: 30, // seconds
    minWatchTime: 25, // seconds (83% completion required)
    cooldownPeriod: 300, // seconds (5 minutes)
    maxAdsPerDay: 5,
    maxAdsPerUser: 10,
    revenueShare: 0.003, // Pi per ad
    skipAvailable: false,
    autoPlay: true
  },
  
  validation: {
    requiredCompletionRate: 0.83,
    fraudDetection: true,
    ipTracking: true,
    deviceFingerprinting: false
  }
};

// User Interface Configuration
export const UI_CONFIG = {
  theme: {
    primary: {
      50: '#fffbeb',
      100: '#fef3c7',
      400: '#f59e0b',
      500: '#d97706',
      600: '#b45309'
    },
    secondary: {
      50: '#eff6ff',
      100: '#dbeafe',
      400: '#3b82f6',
      500: '#1d4ed8',
      600: '#1e40af'
    },
    accent: {
      50: '#faf5ff',
      100: '#f3e8ff',
      400: '#a855f7',
      500: '#7c3aed',
      600: '#6d28d9'
    },
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    gray: '#6b7280'
  },
  
  animations: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500
    },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },
  
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem'
  }
};

// API Configuration
export const API_CONFIG = {
  endpoints: {
    auth: '/api/auth',
    lotteries: '/api/lotteries',
    payments: '/api/payments',
    users: '/api/users',
    admin: '/api/admin',
    analytics: '/api/analytics'
  },
  
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Feature Flags
export const FEATURE_FLAGS = {
  enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
  enableAdLottery: process.env.REACT_APP_ENABLE_AD_LOTTERY !== 'false',
  enableBetaFeatures: process.env.REACT_APP_ENABLE_BETA_FEATURES === 'true',
  enablePushNotifications: process.env.REACT_APP_ENABLE_PUSH_NOTIFICATIONS === 'true',
  enableSocialSharing: process.env.REACT_APP_ENABLE_SOCIAL_SHARING !== 'false',
  enableMultiLanguage: process.env.REACT_APP_ENABLE_MULTI_LANGUAGE === 'true',
  enableDarkMode: process.env.REACT_APP_ENABLE_DARK_MODE !== 'false'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  AUTHENTICATION_FAILED: 'Authentication failed. Please try again.',
  INSUFFICIENT_BALANCE: 'Insufficient Pi balance for this transaction.',
  LOTTERY_FULL: 'This lottery has reached maximum capacity.',
  INVALID_ENTRY: 'Invalid lottery entry. Please check your information.',
  PAYMENT_FAILED: 'Payment processing failed. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  ACCESS_DENIED: 'Access denied. You do not have permission for this action.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Validation failed. Please check your input.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOTTERY_ENTRY_SUCCESS: 'Successfully entered lottery!',
  PAYMENT_SUCCESS: 'Payment processed successfully!',
  AUTHENTICATION_SUCCESS: 'Successfully authenticated!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  PRIZE_CLAIMED: 'Prize claimed successfully!',
  AD_COMPLETED: 'Advertisement completed successfully!'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'pi_lottery_user_preferences',
  THEME_SETTINGS: 'pi_lottery_theme',
  LANGUAGE_SETTING: 'pi_lottery_language',
  NOTIFICATION_SETTINGS: 'pi_lottery_notifications',
  TUTORIAL_COMPLETED: 'pi_lottery_tutorial_completed'
};

// Date and Time Formats
export const DATE_FORMATS = {
  DISPLAY_DATE: 'MMM dd, yyyy',
  DISPLAY_DATETIME: 'MMM dd, yyyy HH:mm',
  API_DATE: 'yyyy-MM-dd',
  API_DATETIME: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  TIME_ONLY: 'HH:mm'
};

// Validation Rules
export const VALIDATION_RULES = {
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Username must be 3-30 characters, letters, numbers, and underscores only'
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers'
  }
};

// Export all configurations as a single object for convenience
export const CONFIG = {
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
  VALIDATION_RULES
};

export default CONFIG;
