import { useState, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';

export function usePayment() {
  const [paymentState, setPaymentState] = useState({
    processing: false,
    error: null,
    currentPayment: null
  });

  const createPayment = useCallback(async (paymentData) => {
    try {
      setPaymentState(prev => ({ ...prev, processing: true, error: null }));

      if (typeof window === 'undefined' || typeof window.Pi === 'undefined') {
        throw new Error('Pi Network SDK not available');
      }

      const payment = await window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: async (paymentId) => {
          console.log('Payment ready for server approval:', paymentId);
          try {
            const approvePayment = httpsCallable(functions, 'approvePayment');
            const result = await approvePayment({ 
              paymentId, 
              paymentData 
            });
            
            if (result.data.success) {
              console.log('Payment approved by server');
              await recordPaymentTransaction(paymentId, paymentData, 'approved');
              return { approved: true };
            } else {
              throw new Error('Server approval failed');
            }
          } catch (error) {
            console.error('Server approval error:', error);
            await recordPaymentError(paymentId, error.message);
            throw error;
          }
        },
        
        onReadyForServerCompletion: async (paymentId, txid) => {
          console.log('Payment ready for server completion:', paymentId, txid);
          try {
            const completePayment = httpsCallable(functions, 'completePayment');
            const result = await completePayment({ 
              paymentId, 
              txid 
            });
            
            if (result.data.success) {
              console.log('Payment completed by server');
              await recordPaymentTransaction(paymentId, paymentData, 'completed', txid);
              return { completed: true };
            } else {
              throw new Error('Server completion failed');
            }
          } catch (error) {
            console.error('Server completion error:', error);
            await recordPaymentError(paymentId, error.message);
            throw error;
          }
        },
        
        onCancel: async (paymentId) => {
          console.log('Payment cancelled:', paymentId);
          await recordPaymentTransaction(paymentId, paymentData, 'cancelled');
          setPaymentState(prev => ({ 
            ...prev, 
            processing: false, 
            error: 'Payment cancelled by user' 
          }));
        },
        
        onError: async (error, payment) => {
          console.error('Payment error:', error, payment);
          await recordPaymentError(payment?.identifier || 'unknown', error.message);
          setPaymentState(prev => ({ 
            ...prev, 
            processing: false, 
            error: error.message 
          }));
          throw error;
        }
      });

      setPaymentState(prev => ({ 
        ...prev, 
        processing: false, 
        currentPayment: payment 
      }));
      
      return payment;

    } catch (error) {
      console.error('Payment creation failed:', error);
      setPaymentState(prev => ({ 
        ...prev, 
        processing: false, 
        error: error.message 
      }));
      throw error;
    }
  }, []);

  const recordPaymentTransaction = async (paymentId, paymentData, status, txid = null) => {
    try {
      const transactionRef = doc(collection(db, 'payment_transactions'));
      await updateDoc(transactionRef, {
        paymentId,
        status,
        txid,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to record payment transaction:', error);
    }
  };

  const recordPaymentError = async (paymentId, errorMessage) => {
    try {
      await addDoc(collection(db, 'payment_errors'), {
        paymentId,
        error: errorMessage,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to record payment error:', error);
    }
  };

  const getPaymentStatus = useCallback(async (paymentId) => {
    try {
      const paymentDoc = await getDoc(doc(db, 'payment_transactions', paymentId));
      if (paymentDoc.exists()) {
        return paymentDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }, []);

  const validatePaymentAmount = useCallback((amount, lotteryTypeId) => {
    // Validate that the payment amount matches the expected lottery entry fee
    const expectedAmounts = {
      daily_pi: 1.0,
      weekly_pi: 1.0,
      monthly_pi: 1.0,
      daily_ads: 0 // Ad lottery is free
    };

    const expected = expectedAmounts[lotteryTypeId];
    if (expected === undefined) {
      return { valid: false, reason: 'Invalid lottery type' };
    }

    if (lotteryTypeId === 'daily_ads') {
      return { valid: false, reason: 'Ad lottery does not require payment' };
    }

    if (amount !== expected) {
      return { 
        valid: false, 
        reason: `Invalid amount. Expected ${expected} π, got ${amount} π` 
      };
    }

    return { valid: true };
  }, []);

  const retryPayment = useCallback(async (paymentId) => {
    try {
      setPaymentState(prev => ({ ...prev, processing: true, error: null }));
      
      const payment = await window.Pi.completePayment(paymentId);
      
      setPaymentState(prev => ({ 
        ...prev, 
        processing: false, 
        currentPayment: payment 
      }));
      
      return payment;
    } catch (error) {
      console.error('Payment retry failed:', error);
      setPaymentState(prev => ({ 
        ...prev, 
        processing: false, 
        error: error.message 
      }));
      throw error;
    }
  }, []);

  const cancelPayment = useCallback(async (paymentId) => {
    try {
      await recordPaymentTransaction(paymentId, {}, 'cancelled');
      setPaymentState(prev => ({ 
        ...prev, 
        processing: false, 
        currentPayment: null,
        error: null 
      }));
      
      return true;
    } catch (error) {
      console.error('Payment cancellation failed:', error);
      throw error;
    }
  }, []);

  const clearPaymentState = useCallback(() => {
    setPaymentState({
      processing: false,
      error: null,
      currentPayment: null
    });
  }, []);

  return {
    paymentState,
    createPayment,
    getPaymentStatus,
    validatePaymentAmount,
    retryPayment,
    cancelPayment,
    clearPaymentState
  };
}

export function usePaymentHistory(userId) {
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPaymentHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const paymentsQuery = query(
        collection(db, 'payment_transactions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(paymentsQuery);
      const payments = [];
      
      snapshot.forEach(doc => {
        payments.push({ id: doc.id, ...doc.data() });
      });

      setPaymentHistory(payments);
    } catch (err) {
      console.error('Failed to load payment history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getPaymentSummary = useCallback(() => {
    const summary = {
      totalPayments: paymentHistory.length,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0
    };

    paymentHistory.forEach(payment => {
      summary.totalAmount += payment.amount || 0;
      
      switch (payment.status) {
        case 'completed':
          summary.successfulPayments++;
          break;
        case 'failed':
        case 'cancelled':
          summary.failedPayments++;
          break;
        case 'pending':
        case 'approved':
          summary.pendingPayments++;
          break;
        default:
          break;
      }
    });

    return summary;
  }, [paymentHistory]);

  return {
    paymentHistory,
    loading,
    error,
    loadPaymentHistory,
    getPaymentSummary
  };
}

export default usePayment;
