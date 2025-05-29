// ============================================
// Performance Monitoring Utilities
// ============================================

/**
 * Performance metrics collector
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.listeners = new Set();
    this.config = {
      enabled: true,
      maxMetrics: 1000,
      sampleRate: 1.0, // 100% sampling by default
      flushInterval: 30000 // 30 seconds
    };
    
    this.startTime = performance.now();
    this.errorQueue = [];
    this.userInteractions = [];
    
    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      this.observePageLoad();
      this.observeUserInteractions();
      this.observeResourceTiming();
      this.observeLayoutShifts();
      this.observeFirstInputDelay();
      this.startPeriodicCollection();
    }
  }

  /**
   * Record performance metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} metadata - Additional metadata
   */
  recordMetric(name, value, metadata = {}) {
    if (!this.shouldSample()) return;

    const metric = {
      name,
      value,
      timestamp: performance.now(),
      metadata: {
        ...metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: this.getConnectionType()
      }
    };

    this.metrics.set(`${name}_${Date.now()}`, metric);
    this.notifyListeners('metric', metric);
    this.cleanupOldMetrics();
  }

  /**
   * Start timing for a named operation
   * @param {string} name - Operation name
   * @returns {Function} End timing function
   */
  startTiming(name) {
    const startTime = performance.now();
    
    return (metadata = {}) => {
      const duration = performance.now() - startTime;
      this.recordMetric(`timing_${name}`, duration, {
        ...metadata,
        type: 'timing'
      });
      return duration;
    };
  }

  /**
   * Time an async operation
   * @param {string} name - Operation name
   * @param {Function} operation - Async operation
   * @param {Object} metadata - Additional metadata
   * @returns {Promise} Operation result
   */
  async timeAsync(name, operation, metadata = {}) {
    const endTiming = this.startTiming(name);
    
    try {
      const result = await operation();
      endTiming({ ...metadata, success: true });
      return result;
    } catch (error) {
      endTiming({ 
        ...metadata, 
        success: false, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Count occurrences of an event
   * @param {string} name - Counter name
   * @param {number} increment - Increment value
   * @param {Object} metadata - Additional metadata
   */
  incrementCounter(name, increment = 1, metadata = {}) {
    const existing = this.getLatestMetric(`counter_${name}`);
    const newValue = (existing?.value || 0) + increment;
    
    this.recordMetric(`counter_${name}`, newValue, {
      ...metadata,
      type: 'counter',
      increment
    });
  }

  /**
   * Record a gauge value (current state)
   * @param {string} name - Gauge name
   * @param {number} value - Current value
   * @param {Object} metadata - Additional metadata
   */
  recordGauge(name, value, metadata = {}) {
    this.recordMetric(`gauge_${name}`, value, {
      ...metadata,
      type: 'gauge'
    });
  }

  /**
   * Record error occurrence
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  recordError(error, context = {}) {
    const errorMetric = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: performance.now(),
      url: window.location.href,
      ...context
    };

    this.errorQueue.push(errorMetric);
    this.recordMetric('error_count', 1, {
      type: 'error',
      errorType: error.name,
      ...context
    });

    // Limit error queue size
    if (this.errorQueue.length > 100) {
      this.errorQueue.shift();
    }
  }

  /**
   * Record user interaction
   * @param {string} type - Interaction type
   * @param {Object} details - Interaction details
   */
  recordUserInteraction(type, details = {}) {
    const interaction = {
      type,
      timestamp: performance.now(),
      details,
      url: window.location.href
    };

    this.userInteractions.push(interaction);
    this.recordMetric(`interaction_${type}`, 1, {
      type: 'interaction',
      ...details
    });

    // Limit interactions queue size
    if (this.userInteractions.length > 200) {
      this.userInteractions.shift();
    }
  }

  /**
   * Get metrics summary
   * @param {string} filter - Filter pattern
   * @returns {Object} Metrics summary
   */
  getMetrics(filter = null) {
    const metrics = Array.from(this.metrics.values());
    
    const filtered = filter 
      ? metrics.filter(m => m.name.includes(filter))
      : metrics;

    return {
      total: filtered.length,
      metrics: filtered,
      summary: this.calculateSummary(filtered),
      errors: this.errorQueue,
      interactions: this.userInteractions
    };
  }

  /**
   * Calculate metrics summary
   * @param {Array} metrics - Metrics array
   * @returns {Object} Summary statistics
   */
  calculateSummary(metrics) {
    if (metrics.length === 0) return {};

    const byType = {};
    const timings = [];
    const counters = {};
    const gauges = {};

    metrics.forEach(metric => {
      const type = metric.metadata.type || 'unknown';
      
      if (!byType[type]) byType[type] = [];
      byType[type].push(metric);

      if (type === 'timing') {
        timings.push(metric.value);
      } else if (type === 'counter') {
        counters[metric.name] = metric.value;
      } else if (type === 'gauge') {
        gauges[metric.name] = metric.value;
      }
    });

    return {
      byType,
      timings: timings.length > 0 ? {
        count: timings.length,
        avg: timings.reduce((a, b) => a + b, 0) / timings.length,
        min: Math.min(...timings),
        max: Math.max(...timings),
        p50: this.percentile(timings, 0.5),
        p95: this.percentile(timings, 0.95),
        p99: this.percentile(timings, 0.99)
      } : null,
      counters,
      gauges,
      errorRate: this.errorQueue.length / metrics.length
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.errorQueue = [];
    this.userInteractions = [];
  }

  /**
   * Add metrics listener
   * @param {Function} listener - Listener function
   * @returns {Function} Unsubscribe function
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Configure monitoring
   * @param {Object} newConfig - Configuration options
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Export metrics for external systems
   * @param {string} format - Export format ('json', 'csv', 'prometheus')
   * @returns {string} Formatted metrics
   */
  exportMetrics(format = 'json') {
    const metrics = this.getMetrics();
    
    switch (format) {
      case 'csv':
        return this.toCsv(metrics.metrics);
      case 'prometheus':
        return this.toPrometheus(metrics.metrics);
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  // Private methods

  shouldSample() {
    return this.config.enabled && Math.random() < this.config.sampleRate;
  }

  getLatestMetric(name) {
    const entries = Array.from(this.metrics.entries());
    const filtered = entries
      .filter(([key, metric]) => metric.name === name)
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);
    
    return filtered.length > 0 ? filtered[0][1] : null;
  }

  cleanupOldMetrics() {
    if (this.metrics.size > this.config.maxMetrics) {
      const entries = Array.from(this.metrics.entries());
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.config.maxMetrics);
      toDelete.forEach(([key]) => this.metrics.delete(key));
    }
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in monitoring listener:', error);
      }
    });
  }

  observePageLoad() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, {
          type: 'timing',
          phase: 'page_load'
        });
        
        this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, {
          type: 'timing',
          phase: 'dom_ready'
        });
      }
    });
  }

  observeUserInteractions() {
    if (typeof window === 'undefined') return;

    ['click', 'keydown', 'scroll', 'resize'].forEach(event => {
      window.addEventListener(event, (e) => {
        this.recordUserInteraction(event, {
          target: e.target?.tagName,
          timestamp: e.timeStamp
        });
      }, { passive: true });
    });
  }

  observeResourceTiming() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.recordMetric('resource_load_time', entry.duration, {
          type: 'timing',
          resource: entry.name,
          resourceType: entry.initiatorType
        });
      });
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  observeLayoutShifts() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      let cumulativeScore = 0;
      
      list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) {
          cumulativeScore += entry.value;
        }
      });

      if (cumulativeScore > 0) {
        this.recordMetric('cumulative_layout_shift', cumulativeScore, {
          type: 'gauge',
          metric: 'cls'
        });
      }
    });

    observer.observe({ entryTypes: ['layout-shift'] });
  }

  observeFirstInputDelay() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.recordMetric('first_input_delay', entry.processingStart - entry.startTime, {
          type: 'timing',
          metric: 'fid'
        });
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  }

  startPeriodicCollection() {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      // Memory usage
      if (performance.memory) {
        this.recordGauge('memory_used', performance.memory.usedJSHeapSize, {
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        });
      }

      // Connection info
      if (navigator.connection) {
        this.recordGauge('connection_speed', navigator.connection.downlink);
        this.recordMetric('connection_type', 1, {
          type: 'info',
          effectiveType: navigator.connection.effectiveType,
          rtt: navigator.connection.rtt
        });
      }

      // Battery info
      if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
          this.recordGauge('battery_level', battery.level * 100);
        });
      }
    }, this.config.flushInterval);
  }

  getConnectionType() {
    if (navigator.connection) {
      return navigator.connection.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  toCsv(metrics) {
    const headers = ['name', 'value', 'timestamp', 'url', 'type'];
    const rows = [headers.join(',')];
    
    metrics.forEach(metric => {
      const row = [
        metric.name,
        metric.value,
        metric.timestamp,
        metric.metadata.url,
        metric.metadata.type || 'unknown'
      ];
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }

  toPrometheus(metrics) {
    const lines = [];
    const metricGroups = {};
    
    metrics.forEach(metric => {
      const name = metric.name.replace(/[^a-zA-Z0-9_]/g, '_');
      if (!metricGroups[name]) metricGroups[name] = [];
      metricGroups[name].push(metric);
    });
    
    Object.entries(metricGroups).forEach(([name, group]) => {
      lines.push(`# HELP ${name} ${name} metric`);
      lines.push(`# TYPE ${name} gauge`);
      
      group.forEach(metric => {
        const labels = Object.entries(metric.metadata)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${name}{${labels}} ${metric.value} ${Math.floor(metric.timestamp)}`);
      });
    });
    
    return lines.join('\n');
  }
}

/**
 * Component performance wrapper
 */
export class ComponentMonitor {
  constructor(componentName, monitor = globalMonitor) {
    this.componentName = componentName;
    this.monitor = monitor;
    this.renderCount = 0;
    this.mountTime = null;
  }

  onMount() {
    this.mountTime = performance.now();
    this.monitor.recordMetric(`component_mount_${this.componentName}`, this.mountTime, {
      type: 'timing',
      component: this.componentName,
      phase: 'mount'
    });
  }

  onUnmount() {
    if (this.mountTime) {
      const lifetime = performance.now() - this.mountTime;
      this.monitor.recordMetric(`component_lifetime_${this.componentName}`, lifetime, {
        type: 'timing',
        component: this.componentName,
        phase: 'unmount',
        renderCount: this.renderCount
      });
    }
  }

  onRender(renderTime = null) {
    this.renderCount++;
    
    if (renderTime) {
      this.monitor.recordMetric(`component_render_${this.componentName}`, renderTime, {
        type: 'timing',
        component: this.componentName,
        phase: 'render',
        renderNumber: this.renderCount
      });
    }

    this.monitor.incrementCounter(`component_renders_${this.componentName}`, 1, {
      component: this.componentName
    });
  }

  onError(error, errorInfo = {}) {
    this.monitor.recordError(error, {
      component: this.componentName,
      renderCount: this.renderCount,
      ...errorInfo
    });
  }
}

/**
 * API call monitoring wrapper
 */
export class APIMonitor {
  constructor(baseURL = '', monitor = globalMonitor) {
    this.baseURL = baseURL;
    this.monitor = monitor;
    this.requestCount = 0;
  }

  async monitorRequest(url, options = {}) {
    const requestId = ++this.requestCount;
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const method = options.method || 'GET';
    
    const endTiming = this.monitor.startTiming(`api_request_${method}`);
    
    try {
      const response = await fetch(fullUrl, options);
      
      endTiming({
        url: fullUrl,
        method,
        status: response.status,
        success: response.ok,
        requestId
      });

      this.monitor.incrementCounter('api_requests_total', 1, {
        method,
        status: response.status,
        endpoint: this.getEndpointName(url)
      });

      if (!response.ok) {
        this.monitor.incrementCounter('api_requests_failed', 1, {
          method,
          status: response.status,
          endpoint: this.getEndpointName(url)
        });
      }

      return response;
    } catch (error) {
      endTiming({
        url: fullUrl,
        method,
        success: false,
        error: error.message,
        requestId
      });

      this.monitor.recordError(error, {
        type: 'api_request',
        url: fullUrl,
        method,
        requestId
      });

      throw error;
    }
  }

  getEndpointName(url) {
    return url.split('?')[0].replace(/\/\d+/g, '/:id');
  }
}

/**
 * Real User Monitoring (RUM) utilities
 */
export const RUM = {
  // Core Web Vitals
  measureLCP() {
    return new Promise((resolve) => {
      if (!window.PerformanceObserver) {
        resolve(null);
        return;
      }

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.startTime);
        observer.disconnect();
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    });
  },

  measureFID() {
    return new Promise((resolve) => {
      if (!window.PerformanceObserver) {
        resolve(null);
        return;
      }

      const observer = new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0];
        resolve(firstInput.processingStart - firstInput.startTime);
        observer.disconnect();
      });

      observer.observe({ entryTypes: ['first-input'] });
    });
  },

  measureCLS() {
    return new Promise((resolve) => {
      if (!window.PerformanceObserver) {
        resolve(null);
        return;
      }

      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
      });

      observer.observe({ entryTypes: ['layout-shift'] });

      // Return current CLS value after page visibility change or before unload
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          resolve(clsValue);
          observer.disconnect();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', () => resolve(clsValue));
    });
  }
};

// Global monitor instance
export const globalMonitor = new PerformanceMonitor();

// Convenience functions
export const startTiming = (name) => globalMonitor.startTiming(name);
export const timeAsync = (name, operation, metadata) => globalMonitor.timeAsync(name, operation, metadata);
export const recordMetric = (name, value, metadata) => globalMonitor.recordMetric(name, value, metadata);
export const recordError = (error, context) => globalMonitor.recordError(error, context);
export const incrementCounter = (name, increment, metadata) => globalMonitor.incrementCounter(name, increment, metadata);
export const recordGauge = (name, value, metadata) => globalMonitor.recordGauge(name, value, metadata);

// React hooks for monitoring
export const useComponentMonitor = (componentName) => {
  const monitor = new ComponentMonitor(componentName);
  
  React.useEffect(() => {
    monitor.onMount();
    return () => monitor.onUnmount();
  }, []);

  return {
    onRender: monitor.onRender.bind(monitor),
    onError: monitor.onError.bind(monitor)
  };
};

export const useAPIMonitor = (baseURL = '') => {
  const monitor = new APIMonitor(baseURL);
  return monitor.monitorRequest.bind(monitor);
};

export default {
  PerformanceMonitor,
  ComponentMonitor,
  APIMonitor,
  RUM,
  globalMonitor,
  startTiming,
  timeAsync,
  recordMetric,
  recordError,
  incrementCounter,
  recordGauge,
  useComponentMonitor,
  useAPIMonitor
};
