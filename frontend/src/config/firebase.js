import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration object
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate required configuration
const requiredConfigKeys = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN', 
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

const missingKeys = requiredConfigKeys.filter(key => !process.env[key]);
if (missingKeys.length > 0) {
  console.error('Missing required Firebase configuration:', missingKeys);
  throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`);
}

// Initialize Firebase application
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase app:', error);
  throw error;
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Initialize Analytics (optional, only in production)
export let analytics = null;
if (process.env.NODE_ENV === 'production' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
    console.log('Firebase Analytics initialized');
  } catch (error) {
    console.warn('Failed to initialize Firebase Analytics:', error);
  }
}

// Connect to Firebase Emulators in development
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true') {
  try {
    console.log('Connecting to Firebase Emulators...');
    
    // Check if emulators are already connected
    if (!auth._delegate._config.emulator) {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    
    if (!db._delegate._settings?.host?.includes('localhost')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    
    if (!functions._delegate._url?.includes('localhost')) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    
    if (!storage._delegate._host?.includes('localhost')) {
      connectStorageEmulator(storage, 'localhost', 9199);
    }
    
    console.log('Firebase Emulators connected successfully');
  } catch (error) {
    console.warn('Failed to connect to Firebase Emulators:', error);
  }
}

// Firebase connection health check
export async function checkFirebaseConnection() {
  try {
    // Test Firestore connection by attempting to read settings
    await db._delegate._databaseId;
    
    // Test Auth connection by checking if it's ready
    await auth.authStateReady();
    
    // Test Functions connection
    const functionsRegion = functions._delegate._region;
    
    return { 
      status: 'connected',
      services: {
        auth: 'ready',
        firestore: 'ready',
        functions: functionsRegion ? 'ready' : 'unavailable',
        storage: 'ready',
        analytics: analytics ? 'ready' : 'disabled'
      },
      environment: process.env.NODE_ENV,
      emulators: process.env.REACT_APP_USE_EMULATORS === 'true'
    };
  } catch (error) {
    console.error('Firebase connection check failed:', error);
    return { 
      status: 'error',
      error: error.message,
      services: {
        auth: 'error',
        firestore: 'error',
        functions: 'error',
        storage: 'error'
      }
    };
  }
}

// Export configuration for debugging purposes
export const getFirebaseConfig = () => {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    environment: process.env.NODE_ENV,
    emulators: process.env.REACT_APP_USE_EMULATORS === 'true'
  };
};

// Firebase error handling utility
export function handleFirebaseError(error) {
  const errorMappings = {
    'auth/user-not-found': 'User account not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email address is already registered',
    'auth/weak-password': 'Password is too weak',
    'auth/invalid-email': 'Invalid email address',
    'auth/network-request-failed': 'Network connection failed',
    'firestore/permission-denied': 'Access denied',
    'firestore/unavailable': 'Service temporarily unavailable',
    'functions/unauthenticated': 'Authentication required',
    'functions/permission-denied': 'Insufficient permissions'
  };

  return errorMappings[error.code] || error.message || 'An unexpected error occurred';
}

// Initialize Firebase services check on module load
checkFirebaseConnection().then(result => {
  if (result.status === 'connected') {
    console.log('Firebase services initialized:', result.services);
  } else {
    console.error('Firebase initialization issues:', result);
  }
});

export default app;
