import { signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

class AuthService {
  constructor() {
    this.currentPiUser = null;
    this.currentFirebaseUser = null;
    this.isAuthenticated = false;
    this.listeners = new Set();
    this.piSDK = null;
    this.initializePiSDK();

    // Listen for Firebase auth state changes
    onAuthStateChanged(auth, (firebaseUser) => {
      this.handleAuthStateChange(firebaseUser);
    });
  }

  async initializePiSDK() {
    try {
      if (typeof window !== 'undefined' && window.Pi) {
        this.piSDK = window.Pi;
        await this.piSDK.init({
          version: "2.0",
          sandbox: process.env.REACT_APP_PI_SANDBOX === 'true',
          productionHostname: process.env.REACT_APP_PRODUCTION_HOSTNAME || 'localhost:3000'
        });
        console.log('Pi SDK initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Pi SDK:', error);
    }
  }

  async handleAuthStateChange(firebaseUser) {
    if (firebaseUser && firebaseUser.isAnonymous) {
      this.currentFirebaseUser = firebaseUser;
      await this.loadPiUserData();
    } else {
      this.currentFirebaseUser = null;
      this.currentPiUser = null;
      this.isAuthenticated = false;
    }
    
    this.notifyListeners();
  }

  async loadPiUserData() {
    if (!this.currentFirebaseUser) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', this.currentFirebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.currentPiUser = {
          uid: userData.piUID,
          username: userData.piUsername,
          accessToken: userData.piAccessToken
        };
        this.isAuthenticated = true;
      }
    } catch (error) {
      console.error('Failed to load Pi user data:', error);
    }
  }

  async authenticateWithPi() {
    try {
      console.log('Starting Pi Network authentication...');

      if (!this.piSDK) {
        throw new Error('Pi Network SDK not available. Please open this app in Pi Browser.');
      }

      // Authenticate with Pi Network
      const piAuthResult = await this.piSDK.authenticate(
        ['username', 'payments'],
        this.handleIncompletePayment.bind(this)
      );

      console.log('Pi authentication successful:', piAuthResult.user);

      // Create Firebase anonymous session
      console.log('Creating Firebase anonymous session...');
      const firebaseCredential = await signInAnonymously(auth);
      
      // Link Pi data to Firebase user
      await this.linkPiDataToFirebase(piAuthResult, firebaseCredential.user);

      // Update user profile
      await this.updateUserProfile();

      this.currentPiUser = piAuthResult.user;
      this.currentFirebaseUser = firebaseCredential.user;
      this.isAuthenticated = true;

      console.log('Authentication completed successfully');
      
      return {
        success: true,
        piUser: this.currentPiUser,
        firebaseUser: this.currentFirebaseUser
      };

    } catch (error) {
      console.error('Pi authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async linkPiDataToFirebase(piAuthResult, firebaseUser) {
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
          totalSpent: 0,
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
  }

  async updateUserProfile() {
    if (!this.currentFirebaseUser) return;

    try {
      const userRef = doc(db, 'users', this.currentFirebaseUser.uid);
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  }

  handleIncompletePayment(payment) {
    console.log('Handling incomplete payment:', payment);
    if (this.piSDK) {
      return this.piSDK.completePayment(payment.identifier);
    }
    return Promise.reject(new Error('Pi SDK not available'));
  }

  async createPayment(amount, memo, metadata = {}) {
    if (!this.isAuthenticated || !this.piSDK) {
      throw new Error('User not authenticated or Pi SDK not available');
    }

    try {
      const paymentData = {
        amount: parseFloat(amount),
        memo: memo,
        metadata: {
          ...metadata,
          userId: this.currentFirebaseUser.uid,
          piUID: this.currentPiUser.uid,
          timestamp: Date.now()
        }
      };

      const payment = await this.piSDK.createPayment(paymentData, {
        onReadyForServerApproval: this.handlePaymentApproval.bind(this),
        onReadyForServerCompletion: this.handlePaymentCompletion.bind(this),
        onCancel: this.handlePaymentCancel.bind(this),
        onError: this.handlePaymentError.bind(this)
      });

      return payment;
    } catch (error) {
      console.error('Payment creation failed:', error);
      throw error;
    }
  }

  async handlePaymentApproval(paymentId) {
    try {
      // Call backend function to approve payment
      const response = await fetch('/api/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentPiUser.accessToken}`
        },
        body: JSON.stringify({
          paymentId,
          userId: this.currentFirebaseUser.uid
        })
      });

      if (!response.ok) {
        throw new Error('Payment approval failed');
      }

      const result = await response.json();
      console.log('Payment approved:', result);
      return result;
    } catch (error) {
      console.error('Payment approval error:', error);
      throw error;
    }
  }

  async handlePaymentCompletion(paymentId, txid) {
    try {
      // Call backend function to complete payment
      const response = await fetch('/api/payments/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentPiUser.accessToken}`
        },
        body: JSON.stringify({
          paymentId,
          txid,
          userId: this.currentFirebaseUser.uid
        })
      });

      if (!response.ok) {
        throw new Error('Payment completion failed');
      }

      const result = await response.json();
      console.log('Payment completed:', result);
      return result;
    } catch (error) {
      console.error('Payment completion error:', error);
      throw error;
    }
  }

  handlePaymentCancel(paymentId) {
    console.log('Payment cancelled:', paymentId);
  }

  handlePaymentError(error, payment) {
    console.error('Payment error:', error, payment);
    throw error;
  }

  async signOut() {
    try {
      await signOut(auth);
      this.currentPiUser = null;
      this.currentFirebaseUser = null;
      this.isAuthenticated = false;
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  getCurrentUser() {
    return {
      piUser: this.currentPiUser,
      firebaseUser: this.currentFirebaseUser,
      isAuthenticated: this.isAuthenticated
    };
  }

  addAuthStateListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.getCurrentUser());
      } catch (error) {
        console.error('Auth state listener error:', error);
      }
    });
  }

  async getUserBalance() {
    if (!this.isAuthenticated || !this.currentPiUser) {
      return 0;
    }

    try {
      // In a real implementation, this would call Pi Network API
      // For now, return a mock balance
      return 45.7;
    } catch (error) {
      console.error('Failed to get user balance:', error);
      return 0;
    }
  }

  async validateTransaction(paymentId) {
    try {
      const response = await fetch(`/api/payments/validate/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.currentPiUser.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Transaction validation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Transaction validation error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
