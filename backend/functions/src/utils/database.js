// backend/functions/src/utils/database.js

import admin from 'firebase-admin';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp,
  runTransaction,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { COLLECTIONS, FIREBASE, ERROR_CODES, DEFAULTS } from './constants.js';
import { logger } from './logger.js';
import { CustomError } from './validators.js';

/**
 * Database Utility Class
 * Provides common database operations and transaction management
 */
class DatabaseManager {
  constructor() {
    this.db = admin.firestore();
    this.batchSize = FIREBASE.MAX_BATCH_SIZE;
    this.queryLimit = FIREBASE.MAX_QUERY_LIMIT;
  }

  /**
   * Get a document by ID
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @returns {Promise<Object|null>} Document data or null
   */
  async getDocument(collectionName, documentId) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get document', { 
        collection: collectionName, 
        documentId, 
        error: error.message 
      });
      throw new CustomError('Database read failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Set a document with data
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @param {Object} data - Document data
   * @param {boolean} merge - Whether to merge with existing data
   * @returns {Promise<void>}
   */
  async setDocument(collectionName, documentId, data, merge = false) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      const documentData = {
        ...data,
        updatedAt: timestamp,
        ...(merge ? {} : { createdAt: timestamp })
      };
      
      await docRef.set(documentData, { merge });
      
      logger.info('Document set successfully', { 
        collection: collectionName, 
        documentId,
        merge 
      });
    } catch (error) {
      logger.error('Failed to set document', { 
        collection: collectionName, 
        documentId, 
        error: error.message 
      });
      throw new CustomError('Database write failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Update a document
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @param {Object} updates - Update data
   * @returns {Promise<void>}
   */
  async updateDocument(collectionName, documentId, updates) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      const updateData = {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await docRef.update(updateData);
      
      logger.info('Document updated successfully', { 
        collection: collectionName, 
        documentId 
      });
    } catch (error) {
      logger.error('Failed to update document', { 
        collection: collectionName, 
        documentId, 
        error: error.message 
      });
      throw new CustomError('Database update failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Delete a document
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(collectionName, documentId) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.delete();
      
      logger.info('Document deleted successfully', { 
        collection: collectionName, 
        documentId 
      });
    } catch (error) {
      logger.error('Failed to delete document', { 
        collection: collectionName, 
        documentId, 
        error: error.message 
      });
      throw new CustomError('Database delete failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Add a document to collection
   * @param {string} collectionName - Collection name
   * @param {Object} data - Document data
   * @returns {Promise<string>} Document ID
   */
  async addDocument(collectionName, data) {
    try {
      const collectionRef = this.db.collection(collectionName);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      const documentData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      const docRef = await collectionRef.add(documentData);
      
      logger.info('Document added successfully', { 
        collection: collectionName, 
        documentId: docRef.id 
      });
      
      return docRef.id;
    } catch (error) {
      logger.error('Failed to add document', { 
        collection: collectionName, 
        error: error.message 
      });
      throw new CustomError('Database add failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Query documents with filters
   * @param {string} collectionName - Collection name
   * @param {Array} filters - Array of filter objects
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of documents
   */
  async queryDocuments(collectionName, filters = [], options = {}) {
    try {
      let queryRef = this.db.collection(collectionName);
      
      // Apply filters
      filters.forEach(filter => {
        if (filter.field && filter.operator && filter.value !== undefined) {
          queryRef = queryRef.where(filter.field, filter.operator, filter.value);
        }
      });
      
      // Apply ordering
      if (options.orderBy) {
        const direction = options.orderDirection || 'asc';
        queryRef = queryRef.orderBy(options.orderBy, direction);
      }
      
      // Apply pagination
      if (options.limit) {
        queryRef = queryRef.limit(Math.min(options.limit, this.queryLimit));
      }
      
      if (options.startAfter) {
        queryRef = queryRef.startAfter(options.startAfter);
      }
      
      const snapshot = await queryRef.get();
      const documents = [];
      
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      logger.debug('Query executed successfully', { 
        collection: collectionName, 
        filtersCount: filters.length,
        resultsCount: documents.length 
      });
      
      return documents;
    } catch (error) {
      logger.error('Failed to query documents', { 
        collection: collectionName, 
        error: error.message 
      });
      throw new CustomError('Database query failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Execute a transaction
   * @param {Function} transactionFunction - Function to execute in transaction
   * @returns {Promise<any>} Transaction result
   */
  async runTransaction(transactionFunction) {
    try {
      const result = await this.db.runTransaction(async (transaction) => {
        return await transactionFunction(transaction, this.db);
      });
      
      logger.info('Transaction completed successfully');
      return result;
    } catch (error) {
      logger.error('Transaction failed', { error: error.message });
      throw new CustomError('Transaction failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Execute batch operations
   * @param {Array} operations - Array of batch operations
   * @returns {Promise<void>}
   */
  async executeBatch(operations) {
    try {
      if (operations.length === 0) return;
      
      // Split operations into batches
      const batches = [];
      for (let i = 0; i < operations.length; i += this.batchSize) {
        batches.push(operations.slice(i, i + this.batchSize));
      }
      
      // Execute batches sequentially
      for (const batchOps of batches) {
        const batch = this.db.batch();
        
        batchOps.forEach(operation => {
          const { type, collection, documentId, data } = operation;
          const docRef = this.db.collection(collection).doc(documentId);
          
          switch (type) {
            case 'set':
              batch.set(docRef, {
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              break;
            case 'update':
              batch.update(docRef, {
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              break;
            case 'delete':
              batch.delete(docRef);
              break;
            default:
              throw new Error(`Unsupported batch operation: ${type}`);
          }
        });
        
        await batch.commit();
      }
      
      logger.info('Batch operations completed', { 
        totalOperations: operations.length,
        batchCount: batches.length 
      });
    } catch (error) {
      logger.error('Batch operations failed', { error: error.message });
      throw new CustomError('Batch operation failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Check if document exists
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @returns {Promise<boolean>} Whether document exists
   */
  async documentExists(collectionName, documentId) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      const docSnap = await docRef.get();
      return docSnap.exists;
    } catch (error) {
      logger.error('Failed to check document existence', { 
        collection: collectionName, 
        documentId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Get collection size
   * @param {string} collectionName - Collection name
   * @param {Array} filters - Optional filters
   * @returns {Promise<number>} Collection size
   */
  async getCollectionSize(collectionName, filters = []) {
    try {
      let queryRef = this.db.collection(collectionName);
      
      filters.forEach(filter => {
        if (filter.field && filter.operator && filter.value !== undefined) {
          queryRef = queryRef.where(filter.field, filter.operator, filter.value);
        }
      });
      
      const snapshot = await queryRef.get();
      return snapshot.size;
    } catch (error) {
      logger.error('Failed to get collection size', { 
        collection: collectionName, 
        error: error.message 
      });
      throw new CustomError('Failed to get collection size', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Create real-time listener
   * @param {string} collectionName - Collection name
   * @param {Array} filters - Query filters
   * @param {Function} callback - Callback function
   * @param {Function} errorCallback - Error callback function
   * @returns {Function} Unsubscribe function
   */
  createListener(collectionName, filters = [], callback, errorCallback) {
    try {
      let queryRef = this.db.collection(collectionName);
      
      filters.forEach(filter => {
        if (filter.field && filter.operator && filter.value !== undefined) {
          queryRef = queryRef.where(filter.field, filter.operator, filter.value);
        }
      });
      
      const unsubscribe = queryRef.onSnapshot(
        (snapshot) => {
          const documents = [];
          snapshot.forEach(doc => {
            documents.push({ id: doc.id, ...doc.data() });
          });
          callback(documents);
        },
        (error) => {
          logger.error('Listener error', { 
            collection: collectionName, 
            error: error.message 
          });
          if (errorCallback) {
            errorCallback(error);
          }
        }
      );
      
      logger.info('Real-time listener created', { collection: collectionName });
      return unsubscribe;
    } catch (error) {
      logger.error('Failed to create listener', { 
        collection: collectionName, 
        error: error.message 
      });
      throw new CustomError('Failed to create listener', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Increment a numeric field
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @param {string} field - Field name
   * @param {number} increment - Increment value
   * @returns {Promise<void>}
   */
  async incrementField(collectionName, documentId, field, increment = 1) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.update({
        [field]: admin.firestore.FieldValue.increment(increment),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logger.debug('Field incremented successfully', { 
        collection: collectionName, 
        documentId, 
        field, 
        increment 
      });
    } catch (error) {
      logger.error('Failed to increment field', { 
        collection: collectionName, 
        documentId, 
        field, 
        error: error.message 
      });
      throw new CustomError('Field increment failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Array union operation
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @param {string} field - Array field name
   * @param {Array} values - Values to add
   * @returns {Promise<void>}
   */
  async arrayUnion(collectionName, documentId, field, values) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.update({
        [field]: admin.firestore.FieldValue.arrayUnion(...values),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logger.debug('Array union completed', { 
        collection: collectionName, 
        documentId, 
        field 
      });
    } catch (error) {
      logger.error('Array union failed', { 
        collection: collectionName, 
        documentId, 
        field, 
        error: error.message 
      });
      throw new CustomError('Array union failed', ERROR_CODES.DATABASE_ERROR);
    }
  }

  /**
   * Array remove operation
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @param {string} field - Array field name
   * @param {Array} values - Values to remove
   * @returns {Promise<void>}
   */
  async arrayRemove(collectionName, documentId, field, values) {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.update({
        [field]: admin.firestore.FieldValue.arrayRemove(...values),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logger.debug('Array remove completed', { 
        collection: collectionName, 
        documentId, 
        field 
      });
    } catch (error) {
      logger.error('Array remove failed', { 
        collection: collectionName, 
        documentId, 
        field, 
        error: error.message 
      });
      throw new CustomError('Array remove failed', ERROR_CODES.DATABASE_ERROR);
    }
  }
}

/**
 * Specialized Database Queries for Pi Lottery Platform
 */
class LotteryQueries extends DatabaseManager {
  
  /**
   * Get active lottery instances
   * @returns {Promise<Array>} Active lottery instances
   */
  async getActiveLotteries() {
    return await this.queryDocuments(COLLECTIONS.LOTTERY_INSTANCES, [
      { field: 'status', operator: '==', value: 'active' }
    ], {
      orderBy: 'createdAt',
      orderDirection: 'desc'
    });
  }

  /**
   * Get user lottery entries
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User entries
   */
  async getUserEntries(userId) {
    return await this.queryDocuments(COLLECTIONS.USER_ENTRIES, [
      { field: 'userId', operator: '==', value: userId }
    ], {
      orderBy: 'createdAt',
      orderDirection: 'desc'
    });
  }

  /**
   * Get lottery winners by instance
   * @param {string} lotteryInstanceId - Lottery instance ID
   * @returns {Promise<Array>} Winners
   */
  async getLotteryWinners(lotteryInstanceId) {
    return await this.queryDocuments(COLLECTIONS.LOTTERY_WINNERS, [
      { field: 'lotteryInstanceId', operator: '==', value: lotteryInstanceId }
    ], {
      orderBy: 'position',
      orderDirection: 'asc'
    });
  }

  /**
   * Get recent winners
   * @param {number} limit - Number of winners to fetch
   * @returns {Promise<Array>} Recent winners
   */
  async getRecentWinners(limit = DEFAULTS.PAGE_SIZE) {
    return await this.queryDocuments(COLLECTIONS.LOTTERY_WINNERS, [
      { field: 'status', operator: '==', value: 'transferred' }
    ], {
      orderBy: 'createdAt',
      orderDirection: 'desc',
      limit
    });
  }

  /**
   * Get user ticket limits for today
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<Object|null>} Ticket limits
   */
  async getUserTicketLimits(userId, date) {
    const limitId = `${userId}_${date}`;
    return await this.getDocument(COLLECTIONS.USER_TICKET_LIMITS, limitId);
  }

  /**
   * Get pending winners for approval
   * @returns {Promise<Array>} Pending winners
   */
  async getPendingWinners() {
    return await this.queryDocuments(COLLECTIONS.LOTTERY_WINNERS, [
      { field: 'status', operator: '==', value: 'pending' }
    ], {
      orderBy: 'createdAt',
      orderDirection: 'asc'
    });
  }

  /**
   * Get lottery entries by instance
   * @param {string} lotteryInstanceId - Lottery instance ID
   * @returns {Promise<Array>} Lottery entries
   */
  async getLotteryEntries(lotteryInstanceId) {
    return await this.queryDocuments(COLLECTIONS.USER_ENTRIES, [
      { field: 'lotteryInstanceId', operator: '==', value: lotteryInstanceId },
      { field: 'status', operator: '==', value: 'confirmed' }
    ]);
  }

  /**
   * Get system configuration
   * @returns {Promise<Object>} System configuration
   */
  async getSystemConfig() {
    const configs = await this.queryDocuments(COLLECTIONS.SYSTEM_CONFIG);
    const configObject = {};
    
    configs.forEach(config => {
      configObject[config.id] = config;
    });
    
    return configObject;
  }

  /**
   * Update user statistics
   * @param {string} userId - User ID
   * @param {Object} stats - Statistics to update
   * @returns {Promise<void>}
   */
  async updateUserStats(userId, stats) {
    const updates = {};
    
    Object.entries(stats).forEach(([key, value]) => {
      if (typeof value === 'number') {
        updates[key] = admin.firestore.FieldValue.increment(value);
      } else {
        updates[key] = value;
      }
    });
    
    await this.updateDocument(COLLECTIONS.USERS, userId, updates);
  }
}

// Create singleton instances
export const dbManager = new DatabaseManager();
export const lotteryQueries = new LotteryQueries();

// Export individual functions for convenience
export const {
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  addDocument,
  queryDocuments,
  runTransaction,
  executeBatch,
  documentExists,
  getCollectionSize,
  createListener,
  incrementField,
  arrayUnion,
  arrayRemove
} = dbManager;

export default {
  dbManager,
  lotteryQueries,
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  addDocument,
  queryDocuments,
  runTransaction,
  executeBatch,
  documentExists,
  getCollectionSize,
  createListener,
  incrementField,
  arrayUnion,
  arrayRemove
};
