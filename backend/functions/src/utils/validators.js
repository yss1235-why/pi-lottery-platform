// backend/functions/src/utils/validators.js

import { ERROR_CODES, REGEX_PATTERNS, LOTTERY, PI_NETWORK, ADMIN_PERMISSIONS } from './constants.js';
import { logger } from './logger.js';

/**
 * Custom Error Class
 * Provides structured error handling with error codes
 */
export class CustomError extends Error {
  constructor(message, code = ERROR_CODES.INTERNAL_ERROR, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON format
   * @returns {Object} Error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Validation Error Class
 * Specialized error for validation failures
 */
export class ValidationError extends CustomError {
  constructor(message, field = null, value = null) {
    super(message, ERROR_CODES.VALIDATION_FAILED, 400, { field, value });
  }
}

/**
 * Authentication Error Class
 * Specialized error for authentication failures
 */
export class AuthenticationError extends CustomError {
  constructor(message, code = ERROR_CODES.AUTH_INVALID) {
    super(message, code, 401);
  }
}

/**
 * Authorization Error Class
 * Specialized error for authorization failures
 */
export class AuthorizationError extends CustomError {
  constructor(message, requiredPermission = null) {
    super(message, ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS, 403, { requiredPermission });
  }
}

/**
 * Input Validation Utility Class
 * Provides comprehensive input validation and sanitization
 */
class InputValidator {
  constructor() {
    this.errors = [];
  }

  /**
   * Reset validation errors
   */
  reset() {
    this.errors = [];
  }

  /**
   * Add validation error
   * @param {string} field - Field name
   * @param {string} message - Error message
   * @param {any} value - Invalid value
   */
  addError(field, message, value = null) {
    this.errors.push({
      field,
      message,
      value: value !== null ? String(value) : null,
      code: ERROR_CODES.VALIDATION_FAILED
    });
  }

  /**
   * Check if validation has errors
   * @returns {boolean} Has errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get validation errors
   * @returns {Array} Validation errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Throw validation error if any errors exist
   */
  throwIfErrors() {
    if (this.hasErrors()) {
      const errorMessage = this.errors.map(err => `${err.field}: ${err.message}`).join(', ');
      throw new ValidationError(`Validation failed: ${errorMessage}`, null, this.errors);
    }
  }

  /**
   * Validate required field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {InputValidator} Validator instance for chaining
   */
  required(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      this.addError(fieldName, 'This field is required', value);
    }
    return this;
  }

  /**
   * Validate string type and length
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {Object} options - Validation options
   * @returns {InputValidator} Validator instance for chaining
   */
  string(value, fieldName, options = {}) {
    if (value !== null && value !== undefined) {
      if (typeof value !== 'string') {
        this.addError(fieldName, 'Must be a string', value);
        return this;
      }

      const { minLength, maxLength, pattern, allowEmpty = false } = options;

      if (!allowEmpty && value.length === 0) {
        this.addError(fieldName, 'String cannot be empty', value);
      }

      if (minLength && value.length < minLength) {
        this.addError(fieldName, `Must be at least ${minLength} characters long`, value);
      }

      if (maxLength && value.length > maxLength) {
        this.addError(fieldName, `Must not exceed ${maxLength} characters`, value);
      }

      if (pattern && !pattern.test(value)) {
        this.addError(fieldName, 'Invalid format', value);
      }
    }
    return this;
  }

  /**
   * Validate number type and range
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {Object} options - Validation options
   * @returns {InputValidator} Validator instance for chaining
   */
  number(value, fieldName, options = {}) {
    if (value !== null && value !== undefined) {
      const numValue = Number(value);
      
      if (isNaN(numValue)) {
        this.addError(fieldName, 'Must be a valid number', value);
        return this;
      }

      const { min, max, integer = false } = options;

      if (integer && !Number.isInteger(numValue)) {
        this.addError(fieldName, 'Must be an integer', value);
      }

      if (min !== undefined && numValue < min) {
        this.addError(fieldName, `Must be at least ${min}`, value);
      }

      if (max !== undefined && numValue > max) {
        this.addError(fieldName, `Must not exceed ${max}`, value);
      }
    }
    return this;
  }

  /**
   * Validate email format
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {InputValidator} Validator instance for chaining
   */
  email(value, fieldName) {
    if (value !== null && value !== undefined && value !== '') {
      if (!REGEX_PATTERNS.EMAIL.test(value)) {
        this.addError(fieldName, 'Invalid email format', value);
      }
    }
    return this;
  }

  /**
   * Validate Pi amount
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {InputValidator} Validator instance for chaining
   */
  piAmount(value, fieldName) {
    if (value !== null && value !== undefined) {
      const amount = Number(value);
      
      if (isNaN(amount)) {
        this.addError(fieldName, 'Invalid Pi amount format', value);
        return this;
      }

      if (amount < PI_NETWORK.MIN_PAYMENT_AMOUNT) {
        this.addError(fieldName, `Amount must be at least ${PI_NETWORK.MIN_PAYMENT_AMOUNT} Pi`, value);
      }

      if (amount > PI_NETWORK.MAX_PAYMENT_AMOUNT) {
        this.addError(fieldName, `Amount cannot exceed ${PI_NETWORK.MAX_PAYMENT_AMOUNT} Pi`, value);
      }

      // Check decimal places (Pi supports up to 6 decimal places)
      const decimalPart = value.toString().split('.')[1];
      if (decimalPart && decimalPart.length > 6) {
        this.addError(fieldName, 'Pi amount cannot have more than 6 decimal places', value);
      }
    }
    return this;
  }

  /**
   * Validate UUID format
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {InputValidator} Validator instance for chaining
   */
  uuid(value, fieldName) {
    if (value !== null && value !== undefined && value !== '') {
      if (!REGEX_PATTERNS.UUID.test(value)) {
        this.addError(fieldName, 'Invalid UUID format', value);
      }
    }
    return this;
  }

  /**
   * Validate date format
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {Object} options - Validation options
   * @returns {InputValidator} Validator instance for chaining
   */
  date(value, fieldName, options = {}) {
    if (value !== null && value !== undefined && value !== '') {
      const dateValue = new Date(value);
      
      if (isNaN(dateValue.getTime())) {
        this.addError(fieldName, 'Invalid date format', value);
        return this;
      }

      const { minDate, maxDate } = options;

      if (minDate && dateValue < new Date(minDate)) {
        this.addError(fieldName, `Date must be after ${minDate}`, value);
      }

      if (maxDate && dateValue > new Date(maxDate)) {
        this.addError(fieldName, `Date must be before ${maxDate}`, value);
      }
    }
    return this;
  }

  /**
   * Validate array
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {Object} options - Validation options
   * @returns {InputValidator} Validator instance for chaining
   */
  array(value, fieldName, options = {}) {
    if (value !== null && value !== undefined) {
      if (!Array.isArray(value)) {
        this.addError(fieldName, 'Must be an array', value);
        return this;
      }

      const { minLength, maxLength, itemValidator } = options;

      if (minLength && value.length < minLength) {
        this.addError(fieldName, `Array must have at least ${minLength} items`, value);
      }

      if (maxLength && value.length > maxLength) {
        this.addError(fieldName, `Array cannot have more than ${maxLength} items`, value);
      }

      // Validate each item if validator provided
      if (itemValidator && typeof itemValidator === 'function') {
        value.forEach((item, index) => {
          try {
            itemValidator(item, `${fieldName}[${index}]`);
          } catch (error) {
            this.addError(`${fieldName}[${index}]`, error.message, item);
          }
        });
      }
    }
    return this;
  }

  /**
   * Validate enum value
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {Array} allowedValues - Allowed values
   * @returns {InputValidator} Validator instance for chaining
   */
  enum(value, fieldName, allowedValues) {
    if (value !== null && value !== undefined && !allowedValues.includes(value)) {
      this.addError(fieldName, `Must be one of: ${allowedValues.join(', ')}`, value);
    }
    return this;
  }

  /**
   * Custom validation function
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {Function} validator - Custom validator function
   * @returns {InputValidator} Validator instance for chaining
   */
  custom(value, fieldName, validator) {
    try {
      const result = validator(value);
      if (result !== true) {
        this.addError(fieldName, result || 'Custom validation failed', value);
      }
    } catch (error) {
      this.addError(fieldName, error.message, value);
    }
    return this;
  }
}

/**
 * Lottery-specific Validators
 */
class LotteryValidator extends InputValidator {
  
  /**
   * Validate lottery type
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {LotteryValidator} Validator instance
   */
  lotteryType(value, fieldName) {
    const validTypes = Object.values(LOTTERY.TYPES);
    return this.enum(value, fieldName, validTypes);
  }

  /**
   * Validate lottery status
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {LotteryValidator} Validator instance
   */
  lotteryStatus(value, fieldName) {
    const validStatuses = Object.values(LOTTERY.STATUS);
    return this.enum(value, fieldName, validStatuses);
  }

  /**
   * Validate entry method
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {LotteryValidator} Validator instance
   */
  entryMethod(value, fieldName) {
    const validMethods = Object.values(LOTTERY.ENTRY_METHODS);
    return this.enum(value, fieldName, validMethods);
  }

  /**
   * Validate ticket count
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {number} maxTickets - Maximum allowed tickets
   * @returns {LotteryValidator} Validator instance
   */
  ticketCount(value, fieldName, maxTickets = 100) {
    return this.number(value, fieldName, { min: 1, max: maxTickets, integer: true });
  }

  /**
   * Validate participant count
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {LotteryValidator} Validator instance
   */
  participantCount(value, fieldName) {
    return this.number(value, fieldName, { min: 0, integer: true });
  }

  /**
   * Validate prize amount
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {LotteryValidator} Validator instance
   */
  prizeAmount(value, fieldName) {
    return this.piAmount(value, fieldName);
  }

  /**
   * Validate lottery entry data
   * @param {Object} entryData - Entry data to validate
   * @returns {Object} Validation result
   */
  validateLotteryEntry(entryData) {
    this.reset();
    
    this.required(entryData.lotteryTypeId, 'lotteryTypeId')
        .lotteryType(entryData.lotteryTypeId, 'lotteryTypeId');
    
    this.required(entryData.userId, 'userId')
        .string(entryData.userId, 'userId', { minLength: 1 });
    
    this.required(entryData.entryMethod, 'entryMethod')
        .entryMethod(entryData.entryMethod, 'entryMethod');
    
    this.required(entryData.ticketCount, 'ticketCount')
        .ticketCount(entryData.ticketCount, 'ticketCount');

    // Validate payment data for Pi payment entries
    if (entryData.entryMethod === LOTTERY.ENTRY_METHODS.PI_PAYMENT) {
      this.required(entryData.paymentId, 'paymentId')
          .string(entryData.paymentId, 'paymentId');
    }

    // Validate ad completion data for ad entries
    if (entryData.entryMethod === LOTTERY.ENTRY_METHODS.WATCH_ADS) {
      this.required(entryData.adCompletionId, 'adCompletionId')
          .string(entryData.adCompletionId, 'adCompletionId');
    }

    this.throwIfErrors();
    return { valid: true, errors: [] };
  }

  /**
   * Validate lottery configuration
   * @param {Object} config - Lottery configuration
   * @returns {Object} Validation result
   */
  validateLotteryConfig(config) {
    this.reset();
    
    this.required(config.name, 'name')
        .string(config.name, 'name', { minLength: 3, maxLength: 100 });
    
    this.required(config.entryFee, 'entryFee')
        .piAmount(config.entryFee, 'entryFee');
    
    if (config.platformFee !== undefined) {
      this.piAmount(config.platformFee, 'platformFee');
    }
    
    this.required(config.maxTicketsPerUser, 'maxTicketsPerUser')
        .number(config.maxTicketsPerUser, 'maxTicketsPerUser', { min: 1, max: 1000, integer: true });
    
    this.required(config.minParticipants, 'minParticipants')
        .number(config.minParticipants, 'minParticipants', { min: 1, integer: true });
    
    this.required(config.drawFrequency, 'drawFrequency')
        .number(config.drawFrequency, 'drawFrequency', { min: 1, integer: true });

    this.throwIfErrors();
    return { valid: true, errors: [] };
  }
}

/**
 * Admin-specific Validators
 */
class AdminValidator extends InputValidator {
  
  /**
   * Validate admin permissions
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name
   * @returns {AdminValidator} Validator instance
   */
  adminPermissions(value, fieldName) {
    if (value !== null && value !== undefined) {
      if (!Array.isArray(value)) {
        this.addError(fieldName, 'Permissions must be an array', value);
        return this;
      }

      const validPermissions = Object.values(ADMIN_PERMISSIONS);
      const invalidPermissions = value.filter(perm => !validPermissions.includes(perm));
      
      if (invalidPermissions.length > 0) {
        this.addError(fieldName, `Invalid permissions: ${invalidPermissions.join(', ')}`, value);
      }
    }
    return this;
  }

  /**
   * Validate admin user data
   * @param {Object} adminData - Admin user data
   * @returns {Object} Validation result
   */
  validateAdminUser(adminData) {
    this.reset();
    
    this.required(adminData.email, 'email')
        .email(adminData.email, 'email');
    
    if (adminData.permissions) {
      this.adminPermissions(adminData.permissions, 'permissions');
    }
    
    if (adminData.isAdmin !== undefined) {
      if (typeof adminData.isAdmin !== 'boolean') {
        this.addError('isAdmin', 'Must be a boolean value', adminData.isAdmin);
      }
    }

    this.throwIfErrors();
    return { valid: true, errors: [] };
  }

  /**
   * Validate permission requirement
   * @param {Object} user - User object
   * @param {string} requiredPermission - Required permission
   * @returns {boolean} Has permission
   */
  validatePermission(user, requiredPermission) {
    if (!user || !user.isAdmin) {
      throw new AuthorizationError('Admin privileges required');
    }
    
    if (!user.permissions || !user.permissions.includes(requiredPermission)) {
      throw new AuthorizationError(`Permission required: ${requiredPermission}`, requiredPermission);
    }
    
    return true;
  }
}

/**
 * Payment Validators
 */
class PaymentValidator extends InputValidator {
  
  /**
   * Validate payment data
   * @param {Object} paymentData - Payment data
   * @returns {Object} Validation result
   */
  validatePayment(paymentData) {
    this.reset();
    
    this.required(paymentData.amount, 'amount')
        .piAmount(paymentData.amount, 'amount');
    
    this.required(paymentData.memo, 'memo')
        .string(paymentData.memo, 'memo', { minLength: 1, maxLength: 500 });
    
    if (paymentData.metadata) {
      if (typeof paymentData.metadata !== 'object') {
        this.addError('metadata', 'Metadata must be an object', paymentData.metadata);
      }
    }

    this.throwIfErrors();
    return { valid: true, errors: [] };
  }

  /**
   * Validate Pi Network payment response
   * @param {Object} piPayment - Pi payment response
   * @returns {Object} Validation result
   */
  validatePiPaymentResponse(piPayment) {
    this.reset();
    
    this.required(piPayment.identifier, 'identifier')
        .string(piPayment.identifier, 'identifier');
    
    this.required(piPayment.user_uid, 'user_uid')
        .string(piPayment.user_uid, 'user_uid');
    
    this.required(piPayment.amount, 'amount')
        .piAmount(piPayment.amount, 'amount');
    
    if (piPayment.status) {
      const validStatuses = ['pending', 'ready_for_server_approval', 'ready_for_server_completion', 'cancelled', 'completed'];
      this.enum(piPayment.status, 'status', validStatuses);
    }

    this.throwIfErrors();
    return { valid: true, errors: [] };
  }
}

/**
 * Create validator instances
 */
export function createValidator() {
  return new InputValidator();
}

export function createLotteryValidator() {
  return new LotteryValidator();
}

export function createAdminValidator() {
  return new AdminValidator();
}

export function createPaymentValidator() {
  return new PaymentValidator();
}

/**
 * Validation middleware for Express-like functions
 * @param {Function} validationFunction - Validation function
 * @returns {Function} Middleware function
 */
export function validateRequest(validationFunction) {
  return (req, res, next) => {
    try {
      validationFunction(req.body, req.params, req.query);
      next();
    } catch (error) {
      logger.warn('Request validation failed', { 
        error: error.message,
        body: req.body,
        params: req.params,
        query: req.query
      });
      
      res.status(error.statusCode || 400).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }
  };
}

/**
 * Sanitize and validate input data
 * @param {Object} data - Input data
 * @param {Object} schema - Validation schema
 * @returns {Object} Cleaned and validated data
 */
export function sanitizeAndValidate(data, schema) {
  const validator = createValidator();
  const cleanedData = {};
  
  Object.entries(schema).forEach(([field, rules]) => {
    const value = data[field];
    
    // Apply validation rules
    let fieldValidator = validator;
    
    if (rules.required) {
      fieldValidator = fieldValidator.required(value, field);
    }
    
    if (rules.type === 'string') {
      fieldValidator = fieldValidator.string(value, field, rules.options);
      cleanedData[field] = typeof value === 'string' ? value.trim() : value;
    } else if (rules.type === 'number') {
      fieldValidator = fieldValidator.number(value, field, rules.options);
      cleanedData[field] = value !== null && value !== undefined ? Number(value) : value;
    } else if (rules.type === 'email') {
      fieldValidator = fieldValidator.email(value, field);
      cleanedData[field] = typeof value === 'string' ? value.toLowerCase().trim() : value;
    } else if (rules.type === 'piAmount') {
      fieldValidator = fieldValidator.piAmount(value, field);
      cleanedData[field] = value !== null && value !== undefined ? Number(value) : value;
    } else {
      cleanedData[field] = value;
    }
    
    if (rules.custom) {
      fieldValidator = fieldValidator.custom(value, field, rules.custom);
    }
  });
  
  validator.throwIfErrors();
  return cleanedData;
}

/**
 * Quick validation functions for common use cases
 */
export const validate = {
  required: (value, fieldName) => {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
    return value;
  },
  
  email: (value, fieldName = 'email') => {
    if (value && !REGEX_PATTERNS.EMAIL.test(value)) {
      throw new ValidationError(`Invalid ${fieldName} format`);
    }
    return value;
  },
  
  piAmount: (value, fieldName = 'amount') => {
    const amount = Number(value);
    if (isNaN(amount) || amount < PI_NETWORK.MIN_PAYMENT_AMOUNT || amount > PI_NETWORK.MAX_PAYMENT_AMOUNT) {
      throw new ValidationError(`Invalid ${fieldName}: must be between ${PI_NETWORK.MIN_PAYMENT_AMOUNT} and ${PI_NETWORK.MAX_PAYMENT_AMOUNT} Pi`);
    }
    return amount;
  },
  
  uuid: (value, fieldName = 'ID') => {
    if (value && !REGEX_PATTERNS.UUID.test(value)) {
      throw new ValidationError(`Invalid ${fieldName} format`);
    }
    return value;
  },
  
  positiveInteger: (value, fieldName = 'number') => {
    const num = Number(value);
    if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
      throw new ValidationError(`${fieldName} must be a positive integer`);
    }
    return num;
  }
};

// Export default validator instances
export const validator = createValidator();
export const lotteryValidator = createLotteryValidator();
export const adminValidator = createAdminValidator();
export const paymentValidator = createPaymentValidator();

export default {
  CustomError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  InputValidator,
  LotteryValidator,
  AdminValidator,
  PaymentValidator,
  createValidator,
  createLotteryValidator,
  createAdminValidator,
  createPaymentValidator,
  validateRequest,
  sanitizeAndValidate,
  validate,
  validator,
  lotteryValidator,
  adminValidator,
  paymentValidator
};
