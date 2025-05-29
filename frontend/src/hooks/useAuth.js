import { useState, useEffect, useCallback } from 'react';
import { signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export function usePiAuth() {
  const [user, setUser] = useState({
    piUser: null,
    firebaseUser: null
  });
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.isAnonymous) {
        try {
          const userData = await loadPiUserData(firebaseUser.uid);
          if (userData) {
            setUser({
              piUser: {
                uid: userData.piUID,
                username: userData.piUsername
              },
              firebaseUser
            });
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('Failed to load user data:', error);
          setError(error.message);
        }
      } else {
        setUser({ piUser: null, firebaseUser: null });
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadPiUserData = async (firebaseUid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUid));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Failed to load Pi user data:', error);
      throw error;
    }
  };

  const signIn = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if Pi SDK is available
      if (typeof window === 'undefined' || typeof window.Pi === 'undefined') {
        throw new Error('Pi Network SDK not available. Please open this app in Pi Browser.');
      }

      // Initialize Pi SDK
      await window.Pi.init({
        version: "2.0",
        sandbox: process.env.REACT_APP_PI_SANDBOX === 'true'
      });

      // Authenticate with Pi Network
      const piAuthResult = await window.Pi.authenticate(
        ['username', 'payments'],
        handleIncompletePayment
      );

      console.log('Pi authentication successful:', piAuthResult.user);

      // Create Firebase anonymous session
      const firebaseCredential = await signInAnonymously(auth);
      
      // Link Pi data to Firebase user
      await linkPiDataToFirebase(piAuthResult, firebaseCredential.user);

      // Update login timestamp
      await updateUserProfile(firebaseCredential.user.uid);

      return {
        success: true,
        piUser: piAuthResult.user,
        firebaseUser: firebaseCredential.user
      };

    } catch (error) {
      console.error('Pi authentication failed:', error);
      setError(error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleIncompletePayment = useCallback((payment) => {
    console.log('Handling incomplete payment:', payment);
    return window.Pi.completePayment(payment.identifier);
  }, []);

  const linkPiDataToFirebase = async (piAuthResult, firebaseUser) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      
      const userData = {
        piUID: piAuthResult.user.uid,
        piUsername: piAuthResult.user.username,
        piAccessToken: piAuthResult.accessToken,
        authMethod: 'pi-network-anonymous',
        firebaseUID: firebaseUser.uid,
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (userDoc.exists()) {
        await updateDoc(userRef, userData);
        console.log('User profile updated');
      } else {
        await setDoc(userRef, {
          ...userData,
          totalEntries: 0,
          totalWinnings: 0,
          lotteriesWon: 0,
          winRate: 0,
          dailyPiTicketsUsed: 0,
          dailyAdTicketsUsed: 0,
          weeklyPiTicketsUsed: 0,
          monthlyPiTicketsUsed: 0,
          createdAt: serverTimestamp()
        });
        console.log('New user profile created');
      }
    } catch (error) {
      console.error('Failed to link Pi data to Firebase:', error);
      throw error;
    }
  };

  const updateUserProfile = async (firebaseUid) => {
    try {
      const userRef = doc(db, 'users', firebaseUid);
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  };

  const createPayment = useCallback(async (amount, memo, metadata = {}) => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    const paymentData = {
      amount: parseFloat(amount),
      memo: memo,
      metadata: {
        ...metadata,
        userId: user.firebaseUser.uid,
        piUID: user.piUser.uid,
        timestamp: Date.now()
      }
    };

    try {
      const payment = await window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: (paymentId) => {
          console.log('Payment ready for approval:', paymentId);
          return { approved: true };
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          console.log('Payment ready for completion:', paymentId, txid);
          return { completed: true };
        },
        onCancel: (paymentId) => {
          console.log('Payment cancelled:', paymentId);
        },
        onError: (error, payment) => {
          console.error('Payment error:', error, payment);
          throw error;
        }
      });

      return payment;
    } catch (error) {
      console.error('Payment creation failed:', error);
      throw error;
    }
  }, [isAuthenticated, user]);

  const signOut = useCallback(async () => {
    try {
      await signOut(auth);
      setUser({ piUser: null, firebaseUser: null });
      setIsAuthenticated(false);
      setError(null);
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      setError(error.message);
      throw error;
    }
  }, []);

  return {
    user,
    loading,
    isAuthenticated,
    error,
    signIn,
    signOut,
    createPayment
  };
}

export default usePiAuth;
