// Pi Lottery Platform - Test Configuration
// This file is automatically executed before running tests

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import 'whatwg-fetch';

// =============================================
// GLOBAL TEST ENVIRONMENT SETUP
// =============================================

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock global objects that may not be available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock crypto.getRandomValues for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }
});

// =============================================
// PI NETWORK SDK MOCKING
// =============================================

// Mock Pi Network SDK for testing
global.Pi = {
  init: jest.fn().mockResolvedValue(true),
  authenticate: jest.fn().mockResolvedValue({
    user: {
      uid: 'test-pi-uid',
      username: 'testuser'
    },
    accessToken: 'test-access-token'
  }),
  createPayment: jest.fn().mockResolvedValue({
    identifier: 'test-payment-id',
    amount: 1.0,
    memo: 'Test payment'
  }),
  completePayment: jest.fn().mockResolvedValue({
    txid: 'test-transaction-id'
  })
};

// Mock window.Pi availability check
Object.defineProperty(window, 'Pi', {
  value: global.Pi,
  writable: true
});

// =============================================
// FIREBASE MOCKING
// =============================================

// Mock Firebase functions
jest.mock('./config/firebase', () => ({
  auth: {
    currentUser: null,
    signInAnonymously: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn()
  },
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        onSnapshot: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
        onSnapshot: jest.fn()
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn()
        }))
      })),
      add: jest.fn(),
      get: jest.fn()
    })),
    doc: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      collection: jest.fn()
    }))
  },
  functions: {
    httpsCallable: jest.fn(() => jest.fn().mockResolvedValue({ data: {} }))
  },
  storage: {
    ref: jest.fn(() => ({
      put: jest.fn(),
      getDownloadURL: jest.fn()
    }))
  },
  analytics: null,
  checkFirebaseConnection: jest.fn().mockResolvedValue({
    status: 'connected',
    services: {
      auth: 'ready',
      firestore: 'ready',
      functions: 'ready',
      storage: 'ready'
    }
  })
}));

// =============================================
// PERFORMANCE MONITORING MOCKING
// =============================================

jest.mock('./utils/monitoring', () => ({
  performanceMonitor: {
    logUserAction: jest.fn(),
    logError: jest.fn(),
    logPerformanceMetric: jest.fn(),
    measureLoadTime: jest.fn(() => jest.fn()),
    measureAPICall: jest.fn(() => jest.fn()),
    flushErrorQueue: jest.fn(),
    flushPerformanceQueue: jest.fn()
  }
}));

// =============================================
// REACT ROUTER MOCKING
// =============================================

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null
  }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), jest.fn()]
}));

// =============================================
// CONSOLE OUTPUT MANAGEMENT
// =============================================

// Suppress console.log/warn/error in tests unless explicitly enabled
const originalConsole = { ...console };

beforeAll(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
});

// =============================================
// CUSTOM TEST UTILITIES
// =============================================

// Custom render function with providers
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

export const renderWithProviders = (ui, options = {}) => {
  const Wrapper = ({ children }) => (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
  
  return render(ui, { wrapper: Wrapper, ...options });
};

// Mock authentication states
export const mockAuthStates = {
  unauthenticated: {
    user: null,
    loading: false,
    isAuthenticated: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    createPayment: jest.fn()
  },
  authenticated: {
    user: {
      piUser: { uid: 'test-pi-uid', username: 'testuser' },
      firebaseUser: { uid: 'test-firebase-uid', isAnonymous: true }
    },
    loading: false,
    isAuthenticated: true,
    signIn: jest.fn(),
    signOut: jest.fn(),
    createPayment: jest.fn().mockResolvedValue({ identifier: 'test-payment' })
  },
  loading: {
    user: null,
    loading: true,
    isAuthenticated: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    createPayment: jest.fn()
  }
};

// Mock lottery data
export const mockLotteryData = {
  types: {
    daily_pi: {
      name: 'Daily Pi Lottery',
      entryFee: 1.0,
      platformFee: 0.1,
      maxTicketsPerUser: 3,
      isEnabled: true
    },
    daily_ads: {
      name: 'Daily Ads Lottery',
      entryFee: 0,
      adValue: 0.001,
      maxTicketsPerUser: 5,
      isEnabled: true
    }
  },
  instances: {
    daily_pi: {
      id: 'daily_pi_2025_05_30',
      participants: 25,
      prizePool: 22.5,
      scheduledDrawTime: new Date(Date.now() + 3600000) // 1 hour from now
    }
  },
  recentWinners: [
    {
      username: 'winner1',
      lotteryInstanceId: 'daily_pi_2025_05_29',
      prizeAmount: 15.0,
      position: 1
    }
  ]
};

// Mock admin data
export const mockAdminData = {
  unauthenticated: {
    admin: null,
    loading: false,
    isAdmin: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(false)
  },
  authenticated: {
    admin: {
      uid: 'admin-uid',
      email: 'admin@pilottery.app',
      permissions: ['manage_lotteries', 'approve_prizes', 'system_config']
    },
    loading: false,
    isAdmin: true,
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(true)
  }
};

// =============================================
// CLEANUP
// =============================================

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Reset DOM
  document.body.innerHTML = '';
  
  // Clear local/session storage
  localStorage.clear();
  sessionStorage.clear();
});

// Global test timeout
jest.setTimeout(10000);

// =============================================
// TEST ENVIRONMENT VALIDATION
// =============================================

// Verify test environment is properly configured
beforeAll(() => {
  // Check if required globals are available
  expect(global.TextEncoder).toBeDefined();
  expect(global.TextDecoder).toBeDefined();
  expect(window.matchMedia).toBeDefined();
  expect(global.IntersectionObserver).toBeDefined();
  expect(global.ResizeObserver).toBeDefined();
  expect(global.crypto).toBeDefined();
  expect(window.Pi).toBeDefined();
  
  console.log('✅ Test environment configured successfully');
});

export default {
  renderWithProviders,
  mockAuthStates,
  mockLotteryData,
  mockAdminData
};
