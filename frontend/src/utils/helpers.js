// ============================================
// General Helper Utilities
// ============================================

/**
 * Deep clone an object or array
 * @param {any} obj - Object to clone
 * @returns {any} Deep cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};

/**
 * Deep merge multiple objects
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
export const deepMerge = (...objects) => {
  const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);
  
  return objects.reduce((prev, obj) => {
    Object.keys(obj || {}).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];
      
      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = deepMerge(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });
    
    return prev;
  }, {});
};

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait, immediate = false) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
};

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Generate unique ID
 * @param {number} length - Length of ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique identifier
 */
export const generateId = (length = 8, prefix = '') => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Generate UUID v4
 * @returns {string} UUID v4 string
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after timeout
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
export const chunk = (array, size) => {
  if (!Array.isArray(array) || size <= 0) return [];
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Flatten nested array
 * @param {Array} array - Array to flatten
 * @param {number} depth - Depth to flatten (default: Infinity)
 * @returns {Array} Flattened array
 */
export const flatten = (array, depth = Infinity) => {
  if (!Array.isArray(array)) return [];
  
  return depth > 0 ? array.reduce((acc, val) => 
    acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val), []) : array.slice();
};

/**
 * Get unique values from array
 * @param {Array} array - Input array
 * @param {Function|string} key - Key function or property name for objects
 * @returns {Array} Array with unique values
 */
export const unique = (array, key = null) => {
  if (!Array.isArray(array)) return [];
  
  if (key === null) {
    return [...new Set(array)];
  }
  
  const keyFn = typeof key === 'function' ? key : (item) => item[key];
  const seen = new Set();
  return array.filter(item => {
    const keyValue = keyFn(item);
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
};

/**
 * Group array by key
 * @param {Array} array - Array to group
 * @param {Function|string} key - Grouping key function or property
 * @returns {Object} Grouped object
 */
export const groupBy = (array, key) => {
  if (!Array.isArray(array)) return {};
  
  const keyFn = typeof key === 'function' ? key : (item) => item[key];
  
  return array.reduce((groups, item) => {
    const group = keyFn(item);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Sort array by multiple criteria
 * @param {Array} array - Array to sort
 * @param {Array} criteria - Sort criteria [{key, order}]
 * @returns {Array} Sorted array
 */
export const sortBy = (array, criteria) => {
  if (!Array.isArray(array) || !Array.isArray(criteria)) return array;
  
  return [...array].sort((a, b) => {
    for (const criterion of criteria) {
      const { key, order = 'asc' } = criterion;
      const keyFn = typeof key === 'function' ? key : (item) => item[key];
      
      const aVal = keyFn(a);
      const bVal = keyFn(b);
      
      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;
      
      if (comparison !== 0) {
        return order === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
};

/**
 * Pick specific properties from object
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {Object} Object with picked properties
 */
export const pick = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return {};
  
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {});
};

/**
 * Omit specific properties from object
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {Object} Object without omitted properties
 */
export const omit = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return {};
  
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
};

/**
 * Check if object is empty
 * @param {any} obj - Object to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (obj) => {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (obj instanceof Map || obj instanceof Set) return obj.size === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};

/**
 * Get nested property value safely
 * @param {Object} obj - Source object
 * @param {string} path - Property path (e.g., 'user.profile.name')
 * @param {any} defaultValue - Default value if path doesn't exist
 * @returns {any} Property value or default
 */
export const get = (obj, path, defaultValue = undefined) => {
  if (!obj || typeof obj !== 'object') return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
};

/**
 * Set nested property value safely
 * @param {Object} obj - Target object
 * @param {string} path - Property path
 * @param {any} value - Value to set
 * @returns {Object} Modified object
 */
export const set = (obj, path, value) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return obj;
};

/**
 * Convert string to various cases
 * @param {string} str - Input string
 * @param {string} targetCase - Target case type
 * @returns {string} Converted string
 */
export const changeCase = (str, targetCase) => {
  if (typeof str !== 'string') return str;
  
  switch (targetCase) {
    case 'camelCase':
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '');
    
    case 'PascalCase':
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, word => 
        word.toUpperCase()).replace(/\s+/g, '');
    
    case 'snake_case':
      return str.replace(/\W+/g, ' ').split(/ |\B(?=[A-Z])/)
        .map(word => word.toLowerCase()).join('_');
    
    case 'kebab-case':
      return str.replace(/\W+/g, ' ').split(/ |\B(?=[A-Z])/)
        .map(word => word.toLowerCase()).join('-');
    
    case 'UPPER_CASE':
      return str.replace(/\W+/g, ' ').split(/ |\B(?=[A-Z])/)
        .map(word => word.toUpperCase()).join('_');
    
    default:
      return str;
  }
};

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to append
 * @returns {string} Truncated string
 */
export const truncate = (str, length = 100, suffix = '...') => {
  if (typeof str !== 'string' || str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
};

/**
 * Escape HTML characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export const escapeHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Generate random number in range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {boolean} integer - Return integer
 * @returns {number} Random number
 */
export const random = (min = 0, max = 1, integer = false) => {
  const value = Math.random() * (max - min) + min;
  return integer ? Math.floor(value) : value;
};

/**
 * Generate random array element
 * @param {Array} array - Source array
 * @returns {any} Random element
 */
export const randomElement = (array) => {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Shuffle array
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
export const shuffle = (array) => {
  if (!Array.isArray(array)) return [];
  
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Clamp number between min and max
 * @param {number} num - Number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped number
 */
export const clamp = (num, min, max) => {
  return Math.min(Math.max(num, min), max);
};

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} factor - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export const lerp = (start, end, factor) => {
  return start + (end - start) * clamp(factor, 0, 1);
};

/**
 * Calculate percentage difference between two numbers
 * @param {number} oldValue - Original value
 * @param {number} newValue - New value
 * @returns {number} Percentage difference
 */
export const percentageDiff = (oldValue, newValue) => {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
};

/**
 * Round number to specified decimal places
 * @param {number} num - Number to round
 * @param {number} decimals - Decimal places
 * @returns {number} Rounded number
 */
export const roundTo = (num, decimals = 0) => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

/**
 * Check if value is between two numbers
 * @param {number} value - Value to check
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @param {boolean} inclusive - Include bounds
 * @returns {boolean} True if in range
 */
export const inRange = (value, min, max, inclusive = true) => {
  return inclusive ? value >= min && value <= max : value > min && value < max;
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Function result
 */
export const retry = async (fn, options = {}) => {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    condition = () => true
  } = options;

  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === retries || !condition(error)) {
        throw error;
      }
      
      await sleep(delay * Math.pow(backoff, i));
    }
  }
  
  throw lastError;
};

/**
 * Memoize function results
 * @param {Function} fn - Function to memoize
 * @param {Function} keyGenerator - Key generation function
 * @returns {Function} Memoized function
 */
export const memoize = (fn, keyGenerator = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  
  return (...args) => {
    const key = keyGenerator(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Create event emitter
 * @returns {Object} Event emitter instance
 */
export const createEventEmitter = () => {
  const events = {};
  
  return {
    on(event, callback) {
      if (!events[event]) events[event] = [];
      events[event].push(callback);
      
      return () => {
        const index = events[event].indexOf(callback);
        if (index > -1) events[event].splice(index, 1);
      };
    },
    
    emit(event, ...args) {
      if (events[event]) {
        events[event].forEach(callback => callback(...args));
      }
    },
    
    off(event, callback) {
      if (events[event]) {
        const index = events[event].indexOf(callback);
        if (index > -1) events[event].splice(index, 1);
      }
    },
    
    once(event, callback) {
      const unsubscribe = this.on(event, (...args) => {
        unsubscribe();
        callback(...args);
      });
      return unsubscribe;
    }
  };
};

export default {
  deepClone,
  deepMerge,
  debounce,
  throttle,
  generateId,
  generateUUID,
  sleep,
  chunk,
  flatten,
  unique,
  groupBy,
  sortBy,
  pick,
  omit,
  isEmpty,
  get,
  set,
  changeCase,
  truncate,
  escapeHtml,
  random,
  randomElement,
  shuffle,
  clamp,
  lerp,
  percentageDiff,
  roundTo,
  inRange,
  retry,
  memoize,
  createEventEmitter
};
