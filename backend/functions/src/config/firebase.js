const admin = require('firebase-admin');
const { logger } = require('../utils/logger');
const environmentConfig = require('./environment');

/**
 * Firebase Admin configuration and initialization
 */
class FirebaseConfig {
  constructor() {
    this.isInitialized = false;
    this.db = null;
    this.auth = null;
    this.storage = null;
    this.messaging = null;
    this.connections = {
      database: false,
      auth: false,
      storage: false,
      messaging: false
    };
  }

  /**
   * Initialize Firebase Admin SDK
   */
  async initialize() {
    if (this.isInitialized) {
      return this.getServices();
    }

    try {
      const firebaseConfig = environmentConfig.get('firebase');
      
      // Initialize Firebase Admin with service account or default credentials
      if (!admin.apps.length) {
        let appOptions = {};

        // In production, use service account key
        if (environmentConfig.isProduction()) {
          const serviceAccount = this.getServiceAccountConfig();
          if (serviceAccount) {
            appOptions.credential = admin.credential.cert(serviceAccount);
          }
        }

        // Add database URL if provided
        if (firebaseConfig.databaseURL) {
          appOptions.databaseURL = firebaseConfig.databaseURL;
        }

        // Add project ID
        if (firebaseConfig.projectId) {
          appOptions.projectId = firebaseConfig.projectId;
        }

        admin.initializeApp(appOptions);
        logger.info('Firebase Admin SDK initialized successfully');
      }

      // Initialize services
      await this.initializeServices();
      
      this.isInitialized = true;
      logger.info('Firebase configuration completed successfully');

      return this.getServices();
    } catch (error) {
      logger.error('Firebase initialization failed:', error);
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize Firebase services
   */
  async initializeServices() {
    try {
      // Initialize Firestore
      this.db = admin.firestore();
      await this.configureFirestore();
      this.connections.database = true;

      // Initialize Authentication
      this.auth = admin.auth();
      this.connections.auth = true;

      // Initialize Cloud Storage
      this.storage = admin.storage();
      this.connections.storage = true;

      // Initialize Firebase Messaging (optional)
      try {
        this.messaging = admin.messaging();
        this.connections.messaging = true;
      } catch (messagingError) {
        logger.warn('Firebase Messaging initialization failed:', messagingError);
      }

      logger.info('Firebase services initialized:', this.connections);
    } catch (error) {
      logger.error('Firebase services initialization failed:', error);
      throw error;
    }
  }

  /**
   * Configure Firestore settings
   */
  async configureFirestore() {
    try {
      const dbConfig = environmentConfig.getDatabaseConfig();
      
      // Configure Firestore settings
      this.db.settings({
        ignoreUndefinedProperties: true,
        timestampsInSnapshots: true
      });

      // Test database connection
      await this.testDatabaseConnection();
      
      // Set up database indexes if needed
      await this.ensureDatabaseIndexes();

      logger.info('Firestore configured successfully');
    } catch (error) {
      logger.error('Firestore configuration failed:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection() {
    try {
      // Try to read a system document
      const testRef = this.db.collection('system_config').doc('connection_test');
      await testRef.get();
      logger.info('Database connection test successful');
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * Ensure required database indexes exist
   */
  async ensureDatabaseIndexes() {
    try {
      // This would typically be handled by Firebase CLI deployment
      // but we can check if certain queries work
      const indexChecks = [
        // Check user entries index
        () => this.db.collection('user_entries')
          .where('userId', '==', 'test')
          .where('createdAt', '>=', new Date())
          .limit(1)
          .get(),
        
        // Check lottery instances index
        () => this.db.collection('lottery_instances')
          .where('status', '==', 'active')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get(),

        // Check admin logs index
        () => this.db.collection('admin_logs')
          .where('timestamp', '>=', new Date())
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get()
      ];

      // Run index checks (they may fail in development, which is okay)
      for (const check of indexChecks) {
        try {
          await check();
        } catch (indexError) {
          if (environmentConfig.isDevelopment()) {
            logger.warn('Index check failed (expected in development):', indexError.message);
          } else {
            logger.error('Index check failed in production:', indexError);
          }
        }
      }

      logger.info('Database index checks completed');
    } catch (error) {
      logger.error('Database index check failed:', error);
    }
  }

  /**
   * Get service account configuration
   */
  getServiceAccountConfig() {
    try {
      // Try to get service account from environment or Firebase config
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (serviceAccountJson) {
        return JSON.parse(serviceAccountJson);
      }

      // Alternative: get from Firebase functions config
      const serviceAccount = {
        type: "service_account",
        project_id: environmentConfig.get('firebase.projectId'),
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      // Validate required fields
      if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
        return serviceAccount;
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get service account config:', error);
      return null;
    }
  }

  /**
   * Get Firebase services
   */
  getServices() {
    if (!this.isInitialized) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }

    return {
      db: this.db,
      auth: this.auth,
      storage: this.storage,
      messaging: this.messaging,
      admin: admin
    };
  }

  /**
   * Get Firestore database instance
   */
  getDatabase() {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    return this.db;
  }

  /**
   * Get Firebase Auth instance
   */
  getAuth() {
    if (!this.auth) {
      throw new Error('Firebase Auth not initialized');
    }
    return this.auth;
  }

  /**
   * Get Cloud Storage instance
   */
  getStorage() {
    if (!this.storage) {
      throw new Error('Cloud Storage not initialized');
    }
    return this.storage;
  }

  /**
   * Get Firebase Messaging instance
   */
  getMessaging() {
    if (!this.messaging) {
      throw new Error('Firebase Messaging not initialized');
    }
    return this.messaging;
  }

  /**
   * Check connection status
   */
  getConnectionStatus() {
    return {
      initialized: this.isInitialized,
      connections: { ...this.connections },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check for Firebase services
   */
  async healthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {}
    };

    try {
      // Test Firestore
      if (this.db) {
        try {
          await this.db.collection('health_check').doc('test').get();
          health.services.firestore = 'healthy';
        } catch (error) {
          health.services.firestore = 'error';
          health.status = 'unhealthy';
        }
      }

      // Test Auth
      if (this.auth) {
        try {
          await this.auth.listUsers(1);
          health.services.auth = 'healthy';
        } catch (error) {
          health.services.auth = 'error';
          health.status = 'unhealthy';
        }
      }

      // Test Storage
      if (this.storage) {
        try {
          this.storage.bucket();
          health.services.storage = 'healthy';
        } catch (error) {
          health.services.storage = 'error';
          health.status = 'unhealthy';
        }
      }

      return health;
    } catch (error) {
      logger.error('Firebase health check failed:', error);
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get Firebase usage statistics
   */
  async getUsageStatistics() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        collections: {},
        totalDocuments: 0
      };

      // Get document counts for major collections
      const collections = [
        'users', 'lottery_instances', 'user_entries', 
        'payment_transactions', 'lottery_winners', 'admin_users'
      ];

      for (const collectionName of collections) {
        try {
          const snapshot = await this.db.collection(collectionName).get();
          stats.collections[collectionName] = snapshot.size;
          stats.totalDocuments += snapshot.size;
        } catch (error) {
          stats.collections[collectionName] = 'error';
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get Firebase usage statistics:', error);
      throw error;
    }
  }

  /**
   * Batch write helper
   */
  createBatch() {
    return this.db.batch();
  }

  /**
   * Transaction helper
   */
  runTransaction(updateFunction) {
    return this.db.runTransaction(updateFunction);
  }

  /**
   * Get server timestamp
   */
  getServerTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  }

  /**
   * Get array union helper
   */
  arrayUnion(...elements) {
    return admin.firestore.FieldValue.arrayUnion(...elements);
  }

  /**
   * Get array remove helper
   */
  arrayRemove(...elements) {
    return admin.firestore.FieldValue.arrayRemove(...elements);
  }

  /**
   * Get increment helper
   */
  increment(n) {
    return admin.firestore.FieldValue.increment(n);
  }

  /**
   * Create Firestore query helper
   */
  createQuery(collectionPath) {
    return {
      collection: this.db.collection(collectionPath),
      where: (field, operator, value) => this.db.collection(collectionPath).where(field, operator, value),
      orderBy: (field, direction = 'asc') => this.db.collection(collectionPath).orderBy(field, direction),
      limit: (count) => this.db.collection(collectionPath).limit(count)
    };
  }

  /**
   * Cleanup and close connections
   */
  async cleanup() {
    try {
      // Firebase Admin doesn't require explicit cleanup in Cloud Functions
      // but we can reset our state
      this.isInitialized = false;
      this.connections = {
        database: false,
        auth: false,
        storage: false,
        messaging: false
      };
      
      logger.info('Firebase cleanup completed');
    } catch (error) {
      logger.error('Firebase cleanup failed:', error);
    }
  }
}

// Create and export singleton instance
const firebaseConfig = new FirebaseConfig();

module.exports = firebaseConfig;
