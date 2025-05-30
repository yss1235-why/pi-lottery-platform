import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { performanceMonitor } from './utils/monitoring';

// Performance measurement
const startTime = performance.now();

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  performanceMonitor.logError(new Error(event.reason), {
    type: 'unhandledRejection',
    promise: event.promise
  });
});

// Global error handler for uncaught exceptions
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  performanceMonitor.logError(event.error, {
    type: 'uncaughtException',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Create React root and render app
const container = document.getElementById('root');
const root = createRoot(container);

// Render the app with error boundary
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log performance metrics after initial render
const endTime = performance.now();
const loadTime = endTime - startTime;

performanceMonitor.logPerformanceMetric('app_initial_load', loadTime, {
  timestamp: Date.now(),
  userAgent: navigator.userAgent,
  screenResolution: `${screen.width}x${screen.height}`,
  connectionType: navigator.connection?.effectiveType || 'unknown',
  language: navigator.language,
  cookieEnabled: navigator.cookieEnabled,
  onlineStatus: navigator.onLine
});

// Service Worker registration (optional - for PWA features)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        performanceMonitor.logUserAction('service_worker_registered');
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
        performanceMonitor.logError(registrationError, { component: 'ServiceWorker' });
      });
  });
}

// Detect Pi Browser environment
const isPiBrowser = typeof window !== 'undefined' && typeof window.Pi !== 'undefined';
if (isPiBrowser) {
  console.log('Pi Browser detected - Pi Network SDK available');
  performanceMonitor.logUserAction('pi_browser_detected');
} else {
  console.log('Standard browser detected - Pi Network SDK may not be available');
  performanceMonitor.logUserAction('standard_browser_detected');
}

// Debug information in development
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Pi Lottery Platform Development Mode');
  console.log('📊 Performance monitoring enabled');
  console.log('🔧 React StrictMode enabled');
  console.log(`⏱️ Initial load time: ${loadTime.toFixed(2)}ms`);
  console.log(`🌐 Pi Browser: ${isPiBrowser ? 'Yes' : 'No'}`);
  console.log(`📱 User Agent: ${navigator.userAgent}`);
  console.log(`🖥️ Screen: ${screen.width}x${screen.height}`);
  console.log(`🌍 Language: ${navigator.language}`);
  console.log(`📶 Connection: ${navigator.connection?.effectiveType || 'unknown'}`);
  console.log(`🔌 Online: ${navigator.onLine}`);
  
  // Enable performance observer for detailed metrics
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            performanceMonitor.logPerformanceMetric('largest_contentful_paint', entry.startTime);
          }
          if (entry.entryType === 'first-input') {
            performanceMonitor.logPerformanceMetric('first_input_delay', entry.processingStart - entry.startTime);
          }
          if (entry.entryType === 'layout-shift') {
            performanceMonitor.logPerformanceMetric('cumulative_layout_shift', entry.value);
          }
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (error) {
      console.warn('Performance Observer not fully supported:', error);
    }
  }
  
  // Memory usage monitoring (Chrome only)
  if ('memory' in performance) {
    setInterval(() => {
      const memory = performance.memory;
      performanceMonitor.logPerformanceMetric('memory_usage', {
        usedHeap: memory.usedJSHeapSize,
        totalHeap: memory.totalJSHeapSize,
        heapLimit: memory.jsHeapSizeLimit
      });
    }, 60000); // Every minute
  }
}

// Page visibility API for tracking app focus/blur
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    performanceMonitor.logUserAction('app_hidden');
  } else {
    performanceMonitor.logUserAction('app_visible');
  }
});

// Network status monitoring
window.addEventListener('online', () => {
  performanceMonitor.logUserAction('network_online');
});

window.addEventListener('offline', () => {
  performanceMonitor.logUserAction('network_offline');
});

// Page load complete event
window.addEventListener('load', () => {
  const loadCompleteTime = performance.now();
  performanceMonitor.logPerformanceMetric('page_load_complete', loadCompleteTime - startTime);
  
  // Measure Core Web Vitals
  if ('PerformanceObserver' in window) {
    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          performanceMonitor.logPerformanceMetric('first_contentful_paint', entry.startTime);
        }
      }
    });
    fcpObserver.observe({ entryTypes: ['paint'] });
  }
});

// Cleanup function for development hot reloading
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    const NextApp = require('./App').default;
    root.render(
      <React.StrictMode>
        <NextApp />
      </React.StrictMode>
    );
  });
}
