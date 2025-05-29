import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

class PaymentService {
  constructor() {
    this.piSDK = null;
    this.listeners = new Map();
    this.pendingPayments = new Map();
    this.paymentTimeouts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.paymentTimeout = 300000; // 5 minutes
    
    this.initializePiSDK();
  }

  async initializePiSDK() {
    try {
      if (typeof window !== 'undefined' && window.Pi) {
        this.piSDK = window.Pi;
        console.log('Payment service Pi SDK ready');
      }
    } catch (error) {
      console.error('Failed to initialize Pi SDK in payment service:', error);
    }
  }

  async createPayment(amount, memo, metadata = {}) {
    try {
      if (!this.piSDK) {
        throw new Error('Pi SDK not available for payment processing');
      }

      const paymentId = uuidv4();
      const paymentData = {
        amount: parseFloat(amount),
        memo: memo,
        metadata: {
          ...metadata,
          paymentId,
          timestamp: Date.now(),
          version: '2.0'
        }
      };

      // Store payment in pending state
      this.pendingPayments.set(paymentId, {
        ...paymentData,
        status: 'created',
        attempts: 0,
        createdAt: Date.now()
      });

      // Set payment timeout
      this.setPaymentTimeout(paymentId);

      // Create payment with Pi Network
      const payment = await this.piSDK.createPayment(paymentData, {
        onReadyForServerApproval: this.handlePaymentApproval.bind(this),
        onReadyForServerCompletion: this.handlePaymentCompletion.bind(this),
        onCancel: this.handlePaymentCancel.bind(this),
        onError: this.handlePaymentError.bind(this)
      });

      // Update pending payment with Pi Network payment ID
      this.updatePendingPayment(paymentId, {
        piPaymentId: payment.identifier,
        status: 'pending_approval'
      });

      // Record payment in database
      await this.recordPaymentTransaction(paymentId, paymentData, payment.identifier);

      return {
        paymentId,
        piPaymentId: payment.identifier,
        amount: paymentData.amount,
        memo: paymentData.memo,
        status: 'created'
      };

    } catch (error) {
      console.error('Payment creation failed:', error);
      throw new Error(`Failed to create payment: ${error.message}`);
    }
  }

  async handlePaymentApproval(paymentId) {
    try {
      console.log('Payment ready for approval:', paymentId);
      
      // Find our internal payment ID
      const internalPaymentId = this.findInternalPaymentId(paymentId);
      if (!internalPaymentId) {
        throw new Error('Payment not found in pending payments');
      }

      // Update pending payment status
      this.updatePendingPayment(internalPaymentId, {
        status: 'approving',
        piPaymentId: paymentId
      });

      // Call backend for approval
      const approvalResult = await this.requestBackendApproval(paymentId, internalPaymentId);
      
      if (approvalResult.approved) {
        this.updatePendingPayment(internalPaymentId, {
          status: 'approved',
          approvedAt: Date.now()
        });
        
        // Update database record
        await this.updatePaymentRecord(internalPaymentId, {
          status: 'approved',
          approvedAt: serverTimestamp(),
          backendResponse: approvalResult
        });

        return { approved: true };
      } else {
        throw new Error(approvalResult.reason || 'Payment approval denied');
      }

    } catch (error) {
      console.error('Payment approval failed:', error);
      
      const internalPaymentId = this.findInternalPaymentId(paymentId);
      if (internalPaymentId) {
        this.updatePendingPayment(internalPaymentId, {
          status: 'approval_failed',
          error: error.message
        });
        
        await this.updatePaymentRecord(internalPaymentId, {
          status: 'failed',
          error: error.message,
          failedAt: serverTimestamp()
        });
      }
      
      throw error;
    }
  }

  async handlePaymentCompletion(paymentId, txid) {
    try {
      console.log('Payment ready for completion:', paymentId, txid);
      
      const internalPaymentId = this.findInternalPaymentId(paymentId);
      if (!internalPaymentId) {
        throw new Error('Payment not found in pending payments');
      }

      // Update pending payment status
      this.updatePendingPayment(internalPaymentId, {
        status: 'completing',
        txid: txid
      });

      // Verify transaction on blockchain
      const verificationResult = await this.verifyBlockchainTransaction(txid, paymentId);
      
      if (verificationResult.verified) {
        // Call backend for completion
        const completionResult = await this.requestBackendCompletion(paymentId, txid, internalPaymentId);
        
        if (completionResult.completed) {
          this.updatePendingPayment(internalPaymentId, {
            status: 'completed',
            completedAt: Date.now(),
            txid: txid
          });
          
          // Update database record
          await this.updatePaymentRecord(internalPaymentId, {
            status: 'completed',
            txid: txid,
            completedAt: serverTimestamp(),
            blockchainVerified: true
          });

          // Clear timeout and remove from pending
          this.clearPaymentTimeout(internalPaymentId);
          this.pendingPayments.delete(internalPaymentId);

          // Notify listeners
          this.notifyPaymentListeners(internalPaymentId, 'completed');

          return { completed: true };
        } else {
          throw new Error(completionResult.reason || 'Payment completion denied');
        }
      } else {
        throw new Error('Blockchain transaction verification failed');
      }

    } catch (error) {
      console.error('Payment completion failed:', error);
      
      const internalPaymentId = this.findInternalPaymentId(paymentId);
      if (internalPaymentId) {
        this.updatePendingPayment(internalPaymentId, {
          status: 'completion_failed',
          error: error.message
        });
        
        await this.updatePaymentRecord(internalPaymentId, {
          status: 'failed',
          error: error.message,
          failedAt: serverTimestamp()
        });
      }
      
      throw error;
    }
  }

  handlePaymentCancel(paymentId) {
    console.log('Payment cancelled:', paymentId);
    
    const internalPaymentId = this.findInternalPaymentId(paymentId);
    if (internalPaymentId) {
      this.updatePendingPayment(internalPaymentId, {
        status: 'cancelled',
        cancelledAt: Date.now()
      });
      
      this.updatePaymentRecord(internalPaymentId, {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });

      this.clearPaymentTimeout(internalPaymentId);
      this.pendingPayments.delete(internalPaymentId);
      
      this.notifyPaymentListeners(internalPaymentId, 'cancelled');
    }
  }

  handlePaymentError(error, payment) {
    console.error('Payment error:', error, payment);
    
    const paymentId = payment?.identifier;
    if (paymentId) {
      const internalPaymentId = this.findInternalPaymentId(paymentId);
      if (internalPaymentId) {
        this.updatePendingPayment(internalPaymentId, {
          status: 'error',
          error: error.message || 'Unknown payment error'
        });
        
        this.updatePaymentRecord(internalPaymentId, {
          status: 'failed',
          error: error.message || 'Unknown payment error',
          failedAt: serverTimestamp()
        });

        this.notifyPaymentListeners(internalPaymentId, 'error', error);
      }
    }
  }

  async requestBackendApproval(piPaymentId, internalPaymentId) {
    try {
      const pendingPayment = this.pendingPayments.get(internalPaymentId);
      if (!pendingPayment) {
        throw new Error('Payment not found');
      }

      const response = await fetch('/api/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: piPaymentId,
          internalPaymentId: internalPaymentId,
          amount: pendingPayment.amount,
          memo: pendingPayment.memo,
          metadata: pendingPayment.metadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Backend approval failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Backend approval request failed:', error);
      throw error;
    }
  }

  async requestBackendCompletion(piPaymentId, txid, internalPaymentId) {
    try {
      const response = await fetch('/api/payments/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: piPaymentId,
          internalPaymentId: internalPaymentId,
          txid: txid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Backend completion failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Backend completion request failed:', error);
      throw error;
    }
  }

  async verifyBlockchainTransaction(txid, paymentId) {
    try {
      // In a real implementation, this would verify the transaction on Pi blockchain
      // For now, we'll simulate verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        verified: true,
        txid: txid,
        confirmations: 1,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Blockchain verification failed:', error);
      return { verified: false, error: error.message };
    }
  }

  async recordPaymentTransaction(paymentId, paymentData, piPaymentId) {
    try {
      const transactionData = {
        paymentId: paymentId,
        piPaymentId: piPaymentId,
        amount: paymentData.amount,
        memo: paymentData.memo,
        metadata: paymentData.metadata,
        status: 'created',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'payment_transactions', paymentId), transactionData);
    } catch (error) {
      console.error('Failed to record payment transaction:', error);
      throw error;
    }
  }

  async updatePaymentRecord(paymentId, updates) {
    try {
      const paymentRef = doc(db, 'payment_transactions', paymentId);
      await updateDoc(paymentRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update payment record:', error);
    }
  }

  findInternalPaymentId(piPaymentId) {
    for (const [internalId, payment] of this.pendingPayments.entries()) {
      if (payment.piPaymentId === piPaymentId) {
        return internalId;
      }
    }
    return null;
  }

  updatePendingPayment(paymentId, updates) {
    const payment = this.pendingPayments.get(paymentId);
    if (payment) {
      this.pendingPayments.set(paymentId, { ...payment, ...updates });
    }
  }

  setPaymentTimeout(paymentId) {
    const timeoutId = setTimeout(() => {
      this.handlePaymentTimeout(paymentId);
    }, this.paymentTimeout);
    
    this.paymentTimeouts.set(paymentId, timeoutId);
  }

  clearPaymentTimeout(paymentId) {
    const timeoutId = this.paymentTimeouts.get(paymentId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.paymentTimeouts.delete(paymentId);
    }
  }

  handlePaymentTimeout(paymentId) {
    console.log('Payment timeout:', paymentId);
    
    const payment = this.pendingPayments.get(paymentId);
    if (payment && payment.status !== 'completed') {
      this.updatePendingPayment(paymentId, {
        status: 'timeout',
        timeoutAt: Date.now()
      });
      
      this.updatePaymentRecord(paymentId, {
        status: 'timeout',
        timeoutAt: serverTimestamp()
      });

      this.pendingPayments.delete(paymentId);
      this.notifyPaymentListeners(paymentId, 'timeout');
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      // Check pending payments first
      const pendingPayment = this.pendingPayments.get(paymentId);
      if (pendingPayment) {
        return {
          paymentId: paymentId,
          status: pendingPayment.status,
          amount: pendingPayment.amount,
          memo: pendingPayment.memo,
          createdAt: pendingPayment.createdAt,
          piPaymentId: pendingPayment.piPaymentId
        };
      }

      // Check database
      const paymentDoc = await getDoc(doc(db, 'payment_transactions', paymentId));
      if (paymentDoc.exists()) {
        return { paymentId: paymentId, ...paymentDoc.data() };
      }

      return null;
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }

  async getPaymentHistory(userId, limitCount = 20) {
    try {
      const paymentsCollection = collection(db, 'payment_transactions');
      const q = query(
        paymentsCollection,
        where('metadata.userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const payments = [];
      
      snapshot.forEach(doc => {
        payments.push({ id: doc.id, ...doc.data() });
      });
      
      return payments;
    } catch (error) {
      console.error('Failed to get payment history:', error);
      throw error;
    }
  }

  async retryFailedPayment(paymentId) {
    try {
      const payment = this.pendingPayments.get(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.attempts >= this.maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      payment.attempts += 1;
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * payment.attempts));
      
      // Retry the payment creation
      return await this.createPayment(payment.amount, payment.memo, payment.metadata);
    } catch (error) {
      console.error('Payment retry failed:', error);
      throw error;
    }
  }

  addPaymentListener(paymentId, callback) {
    if (!this.listeners.has(paymentId)) {
      this.listeners.set(paymentId, new Set());
    }
    this.listeners.get(paymentId).add(callback);
    
    return () => {
      const listeners = this.listeners.get(paymentId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(paymentId);
        }
      }
    };
  }

  notifyPaymentListeners(paymentId, status, data = null) {
    const listeners = this.listeners.get(paymentId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback({ paymentId, status, data });
        } catch (error) {
          console.error('Payment listener error:', error);
        }
      });
    }
  }

  subscribeToPayments(userId, callback) {
    const paymentsCollection = collection(db, 'payment_transactions');
    const q = query(
      paymentsCollection,
      where('metadata.userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    return onSnapshot(q, (snapshot) => {
      const payments = [];
      snapshot.forEach(doc => {
        payments.push({ id: doc.id, ...doc.data() });
      });
      callback(payments);
    });
  }

  getPendingPayments() {
    return Array.from(this.pendingPayments.entries()).map(([id, payment]) => ({
      id,
      ...payment
    }));
  }

  clearPendingPayments() {
    // Clear all timeouts
    for (const timeoutId of this.paymentTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    
    this.paymentTimeouts.clear();
    this.pendingPayments.clear();
  }

  async validatePaymentAmount(amount, lotteryTypeId) {
    try {
      // Get lottery type configuration
      const lotteryTypeDoc = await getDoc(doc(db, 'lottery_types', lotteryTypeId));
      if (!lotteryTypeDoc.exists()) {
        throw new Error('Invalid lottery type');
      }

      const lotteryType = lotteryTypeDoc.data();
      const expectedAmount = lotteryType.entryFee;

      if (Math.abs(amount - expectedAmount) > 0.001) { // Allow small floating point differences
        throw new Error(`Invalid payment amount. Expected ${expectedAmount} π, got ${amount} π`);
      }

      return { valid: true, expectedAmount };
    } catch (error) {
      console.error('Payment amount validation failed:', error);
      throw error;
    }
  }

  async estimateTransactionFee(amount) {
    try {
      // Pi Network transaction fees are typically very low
      // This is a simulation - actual fees would come from Pi Network
      const baseFee = 0.01; // 0.01 Pi base fee
      const percentageFee = amount * 0.001; // 0.1% of amount
      
      return Math.max(baseFee, percentageFee);
    } catch (error) {
      console.error('Fee estimation failed:', error);
      return 0.01; // Default fee
    }
  }

  getPaymentStatistics() {
    const pending = this.pendingPayments.size;
    const statuses = {};
    
    for (const payment of this.pendingPayments.values()) {
      statuses[payment.status] = (statuses[payment.status] || 0) + 1;
    }
    
    return {
      pendingCount: pending,
      statusBreakdown: statuses,
      listeners: this.listeners.size
    };
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
