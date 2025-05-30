const functions = require('firebase-functions');

/**
 * Environment configuration management
 */
class EnvironmentConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration based on environment
   */
  loadConfiguration() {
    const baseConfig = {
      // Firebase Configuration
      firebase: {
        projectId: functions.config().firebase?.project_id || process.env.FIREBASE_PROJECT_ID,
        region: functions.config().app?.region || 'us-central1',
        databaseURL: functions.config().firebase?.database_url || process.env.FIREBASE_DATABASE_URL
      },

      // Pi Network Configuration
      piNetwork: {
        apiBaseUrl: this.environment === 'production' 
          ? 'https://api.minepi.com' 
          : 'https://api.minepi.com/v2',
        apiKey: functions.config().pi?.api_key || process.env.PI_API_KEY,
        sandbox: this.environment !== 'production',
        webhookSecret: functions.config().pi?.webhook_secret || process.env.PI_WEBHOOK_SECRET,
        sdkVersion: '2.0'
      },

      // Application Settings
      app: {
        name: 'Pi Lottery Platform',
        version: '1.0.0',
        environment: this.environment,
        debug: this.environment === 'development',
        maintenanceMode: false,
        maxConcurrentUsers: 10000
      },

      // Security Configuration
      security: {
        jwtSecret: functions.config().security?.jwt_secret || process.env.JWT_SECRET,
        encryptionKey: functions.config().security?.encryption_key || process.env.ENCRYPTION_KEY,
        corsOrigins: this.getCorsOrigins(),
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxLoginAttempts: 5,
        lockoutDuration: 30 * 60 * 1000 // 30 minutes
      },

      // Database Configuration
      database: {
        connectionPoolSize: this.environment === 'production' ? 10 : 5,
        queryTimeout: 30000, // 30 seconds
        retryAttempts: 3,
        backupRetention: 30 // days
      },

      // Logging Configuration
      logging: {
        level: this.environment === 'production' ? 'info' : 'debug',
        enableFileLogging: true,
        enableConsoleLogging: true,
        logRotation: {
          maxFiles: 5,
          maxSize: '20m'
        }
      },

      // Performance Configuration
      performance: {
        functionTimeout: 540, // seconds (9 minutes max for Firebase Functions)
        memoryLimit: 512, // MB
        rateLimiting: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 100
        }
      },

      // External Services
      external: {
        sentry: {
          dsn: functions.config().sentry?.dsn || process.env.SENTRY_DSN,
          environment: this.environment,
          enabled: this.environment === 'production'
        },
        analytics: {
          googleAnalyticsId: functions.config().analytics?.ga_id || process.env.GOOGLE_ANALYTICS_ID,
          enabled: true
        }
      },

      // Feature Flags
      features: {
        adLottery: functions.config().features?.ad_lottery !== 'false',
        multipleLotteries: functions.config().features?.multiple_lotteries !== 'false',
        advancedReporting: functions.config().features?.advanced_reporting !== 'false',
        maintenanceAlerts: functions.config().features?.maintenance_alerts !== 'false',
        autoDrawing: functions.config().features?.auto_drawing !== 'false'
      },

      // Business Logic Configuration
      business: {
        lottery: {
          defaultPlatformFee: 0.1,
          defaultAdValue: 0.001,
          minParticipants: {
            daily_pi: 5,
            daily_ads: 10,
            weekly_pi: 20,
            monthly_pi: 30
          },
          maxTicketsPerUser: {
            daily_pi: 3,
            daily_ads: 5,
            weekly_pi: 10,
            monthly_pi: 25
          },
          drawingSchedule: {
            daily_pi: '20:00',
            daily_ads: '21:00',
            weekly_pi: 'sunday_18:00',
            monthly_pi: 'last_day_21:00'
          },
          maxExtensions: 2,
          extensionHours: 24
        },
        payments: {
          piNetworkFee: 0.01,
          processingTimeout: 30 * 60 * 1000, // 30 minutes
          retryAttempts: 3,
          webhookVerification: true
        }
      },

      // Monitoring and Alerts
      monitoring: {
        healthCheck: {
          interval: 5 * 60 * 1000, // 5 minutes
          endpoints: ['/health', '/api/status'],
          alertThreshold: 3 // consecutive failures
        },
        errorReporting: {
          enabled: true,
          criticalErrorAlert: true,
          errorThreshold: 10 // errors per hour
        },
        performance: {
          slowQueryThreshold: 5000, // 5 seconds
          memoryAlertThreshold: 80, // 80% memory usage
          cpuAlertThreshold: 80 // 80% CPU usage
        }
      }
    };

    // Environment-specific overrides
    if (this.environment === 'production') {
      return {
        ...baseConfig,
        app: {
          ...baseConfig.app,
          debug: false
        },
        logging: {
          ...baseConfig.logging,
          level: 'warn'
        },
        performance: {
          ...baseConfig.performance,
          memoryLimit: 1024 // 1GB for production
        }
      };
    } else if (this.environment === 'development') {
      return {
        ...baseConfig,
        piNetwork: {
          ...baseConfig.piNetwork,
          sandbox: true
        },
        security: {
          ...baseConfig.security,
          corsOrigins: ['http://localhost:3000', 'http://localhost:3001']
        }
      };
    }

    return baseConfig;
  }

  /**
   * Get CORS origins based on environment
   */
  getCorsOrigins() {
    if (this.environment === 'production') {
      return [
        'https://pilottery.app',
        'https://www.pilottery.app',
        'https://app.pilottery.app'
      ];
    } else if (this.environment === 'staging') {
      return [
        'https://staging.pilottery.app',
        'https://test.pilottery.app'
      ];
    } else {
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080'
      ];
    }
  }

  /**
   * Validate required configuration
   */
  validateConfiguration() {
    const requiredFields = [
      'firebase.projectId',
      'piNetwork.apiKey',
      'security.jwtSecret'
    ];

    const missingFields = [];

    requiredFields.forEach(field => {
      if (!this.getNestedValue(this.config, field)) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }

    // Validate Pi Network configuration
    if (this.config.piNetwork.sandbox && this.environment === 'production') {
      console.warn('Warning: Pi Network sandbox mode is enabled in production environment');
    }

    // Validate security configuration
    if (this.config.security.jwtSecret && this.config.security.jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
  }

  /**
   * Get nested configuration value
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    return this.getNestedValue(this.config, key) || defaultValue;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`, false);
  }

  /**
   * Get environment name
   */
  getEnvironment() {
    return this.environment;
  }

  /**
   * Check if development environment
   */
  isDevelopment() {
    return this.environment === 'development';
  }

  /**
   * Check if production environment
   */
  isProduction() {
    return this.environment === 'production';
  }

  /**
   * Check if staging environment
   */
  isStaging() {
    return this.environment === 'staging';
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig() {
    return this.config.database;
  }

  /**
   * Get Pi Network configuration
   */
  getPiNetworkConfig() {
    return this.config.piNetwork;
  }

  /**
   * Get security configuration
   */
  getSecurityConfig() {
    return this.config.security;
  }

  /**
   * Get business logic configuration
   */
  getBusinessConfig() {
    return this.config.business;
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig() {
    return this.config.logging;
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig() {
    return this.config.monitoring;
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig() {
    return this.config.performance;
  }

  /**
   * Update configuration at runtime (for feature flags, etc.)
   */
  updateConfig(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get all configuration (for debugging)
   */
  getAllConfig() {
    if (this.isDevelopment()) {
      return { ...this.config };
    } else {
      // In production, hide sensitive data
      const safeConfig = { ...this.config };
      delete safeConfig.security.jwtSecret;
      delete safeConfig.security.encryptionKey;
      delete safeConfig.piNetwork.apiKey;
      delete safeConfig.piNetwork.webhookSecret;
      return safeConfig;
    }
  }

  /**
   * Generate configuration report
   */
  generateConfigReport() {
    return {
      environment: this.environment,
      timestamp: new Date().toISOString(),
      features: this.config.features,
      performance: {
        functionTimeout: this.config.performance.functionTimeout,
        memoryLimit: this.config.performance.memoryLimit,
        rateLimiting: this.config.performance.rateLimiting.enabled
      },
      integrations: {
        piNetwork: {
          sandbox: this.config.piNetwork.sandbox,
          version: this.config.piNetwork.sdkVersion
        },
        firebase: {
          projectId: this.config.firebase.projectId,
          region: this.config.firebase.region
        }
      },
      security: {
        corsOriginsCount: this.config.security.corsOrigins.length,
        sessionTimeout: this.config.security.sessionTimeout,
        maxLoginAttempts: this.config.security.maxLoginAttempts
      }
    };
  }
}

// Create singleton instance
const environmentConfig = new EnvironmentConfig();

module.exports = environmentConfig;
