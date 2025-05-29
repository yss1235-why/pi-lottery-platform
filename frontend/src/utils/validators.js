// ============================================
// Validation Utilities
// ============================================

/**
 * Validation result structure
 */
export class ValidationResult {
  constructor(isValid = true, errors = [], warnings = []) {
    this.isValid = isValid;
    this.errors = Array.isArray(errors) ? errors : [errors];
    this.warnings = Array.isArray(warnings) ? warnings : [warnings];
  }

  addError(error) {
    this.errors.push(error);
    this.isValid = false;
    return this;
  }

  addWarning(warning) {
    this.warnings.push(warning);
    return this;
  }

  merge(other) {
    if (!(other instanceof ValidationResult)) return this;
    
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
    this.isValid = this.isValid && other.isValid;
    return this;
  }

  getFirstError() {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }
}

/**
 * Base validator class
 */
export class Validator {
  constructor(value, fieldName = 'field') {
    this.value = value;
    this.fieldName = fieldName;
    this.result = new ValidationResult();
  }

  required(message = null) {
    if (this.value === null || this.value === undefined || this.value === '') {
      this.result.addError(message || `${this.fieldName} is required`);
    }
    return this;
  }

  optional() {
    if (this.value === null || this.value === undefined || this.value === '') {
      return new Validator(null, this.fieldName); // Skip further validations
    }
    return this;
  }

  type(expectedType, message = null) {
    if (this.value !== null && this.value !== undefined) {
      const actualType = Array.isArray(this.value) ? 'array' : typeof this.value;
      if (actualType !== expectedType) {
        this.result.addError(message || `${this.fieldName} must be of type ${expectedType}`);
      }
    }
    return this;
  }

  custom(validatorFn, message = null) {
    if (this.value !== null && this.value !== undefined) {
      const customResult = validatorFn(this.value);
      if (customResult !== true) {
        this.result.addError(message || customResult || `${this.fieldName} is invalid`);
      }
    }
    return this;
  }

  getResult() {
    return this.result;
  }
}

/**
 * String validator
 */
export class StringValidator extends Validator {
  minLength(min, message = null) {
    if (typeof this.value === 'string' && this.value.length < min) {
      this.result.addError(message || `${this.fieldName} must be at least ${min} characters long`);
    }
    return this;
  }

  maxLength(max, message = null) {
    if (typeof this.value === 'string' && this.value.length > max) {
      this.result.addError(message || `${this.fieldName} must not exceed ${max} characters`);
    }
    return this;
  }

  length(exact, message = null) {
    if (typeof this.value === 'string' && this.value.length !== exact) {
      this.result.addError(message || `${this.fieldName} must be exactly ${exact} characters long`);
    }
    return this;
  }

  pattern(regex, message = null) {
    if (typeof this.value === 'string' && !regex.test(this.value)) {
      this.result.addError(message || `${this.fieldName} format is invalid`);
    }
    return this;
  }

  email(message = null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.pattern(emailRegex, message || `${this.fieldName} must be a valid email address`);
  }

  url(message = null) {
    try {
      new URL(this.value);
    } catch {
      this.result.addError(message || `${this.fieldName} must be a valid URL`);
    }
    return this;
  }

  alphanumeric(message = null) {
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return this.pattern(alphanumericRegex, message || `${this.fieldName} must contain only letters and numbers`);
  }

  alpha(message = null) {
    const alphaRegex = /^[a-zA-Z]+$/;
    return this.pattern(alphaRegex, message || `${this.fieldName} must contain only letters`);
  }

  numeric(message = null) {
    const numericRegex = /^[0-9]+$/;
    return this.pattern(numericRegex, message || `${this.fieldName} must contain only numbers`);
  }

  noWhitespace(message = null) {
    if (typeof this.value === 'string' && /\s/.test(this.value)) {
      this.result.addError(message || `${this.fieldName} cannot contain whitespace`);
    }
    return this;
  }

  trim() {
    if (typeof this.value === 'string') {
      this.value = this.value.trim();
    }
    return this;
  }

  oneOf(options, message = null) {
    if (!options.includes(this.value)) {
      this.result.addError(message || `${this.fieldName} must be one of: ${options.join(', ')}`);
    }
    return this;
  }
}

/**
 * Number validator
 */
export class NumberValidator extends Validator {
  min(minimum, message = null) {
    if (typeof this.value === 'number' && this.value < minimum) {
      this.result.addError(message || `${this.fieldName} must be at least ${minimum}`);
    }
    return this;
  }

  max(maximum, message = null) {
    if (typeof this.value === 'number' && this.value > maximum) {
      this.result.addError(message || `${this.fieldName} must not exceed ${maximum}`);
    }
    return this;
  }

  range(min, max, message = null) {
    if (typeof this.value === 'number' && (this.value < min || this.value > max)) {
      this.result.addError(message || `${this.fieldName} must be between ${min} and ${max}`);
    }
    return this;
  }

  positive(message = null) {
    if (typeof this.value === 'number' && this.value <= 0) {
      this.result.addError(message || `${this.fieldName} must be positive`);
    }
    return this;
  }

  negative(message = null) {
    if (typeof this.value === 'number' && this.value >= 0) {
      this.result.addError(message || `${this.fieldName} must be negative`);
    }
    return this;
  }

  integer(message = null) {
    if (typeof this.value === 'number' && !Number.isInteger(this.value)) {
      this.result.addError(message || `${this.fieldName} must be an integer`);
    }
    return this;
  }

  finite(message = null) {
    if (typeof this.value === 'number' && !Number.isFinite(this.value)) {
      this.result.addError(message || `${this.fieldName} must be a finite number`);
    }
    return this;
  }

  precision(decimals, message = null) {
    if (typeof this.value === 'number') {
      const str = this.value.toString();
      const decimalIndex = str.indexOf('.');
      if (decimalIndex !== -1 && str.length - decimalIndex - 1 > decimals) {
        this.result.addError(message || `${this.fieldName} must have at most ${decimals} decimal places`);
      }
    }
    return this;
  }
}

/**
 * Array validator
 */
export class ArrayValidator extends Validator {
  minLength(min, message = null) {
    if (Array.isArray(this.value) && this.value.length < min) {
      this.result.addError(message || `${this.fieldName} must have at least ${min} items`);
    }
    return this;
  }

  maxLength(max, message = null) {
    if (Array.isArray(this.value) && this.value.length > max) {
      this.result.addError(message || `${this.fieldName} must have at most ${max} items`);
    }
    return this;
  }

  length(exact, message = null) {
    if (Array.isArray(this.value) && this.value.length !== exact) {
      this.result.addError(message || `${this.fieldName} must have exactly ${exact} items`);
    }
    return this;
  }

  notEmpty(message = null) {
    if (Array.isArray(this.value) && this.value.length === 0) {
      this.result.addError(message || `${this.fieldName} cannot be empty`);
    }
    return this;
  }

  unique(message = null) {
    if (Array.isArray(this.value)) {
      const unique = [...new Set(this.value)];
      if (unique.length !== this.value.length) {
        this.result.addError(message || `${this.fieldName} must contain unique values`);
      }
    }
    return this;
  }

  contains(item, message = null) {
    if (Array.isArray(this.value) && !this.value.includes(item)) {
      this.result.addError(message || `${this.fieldName} must contain ${item}`);
    }
    return this;
  }

  each(validatorFn, message = null) {
    if (Array.isArray(this.value)) {
      this.value.forEach((item, index) => {
        const itemResult = validatorFn(item, index);
        if (itemResult && !itemResult.isValid) {
          this.result.addError(message || `${this.fieldName}[${index}] is invalid: ${itemResult.getFirstError()}`);
        }
      });
    }
    return this;
  }
}

/**
 * Object validator
 */
export class ObjectValidator extends Validator {
  shape(schema, message = null) {
    if (typeof this.value === 'object' && this.value !== null) {
      for (const [key, validator] of Object.entries(schema)) {
        const fieldResult = validator(this.value[key], `${this.fieldName}.${key}`);
        if (fieldResult && !fieldResult.isValid) {
          this.result.merge(fieldResult);
        }
      }
    } else if (this.value !== null) {
      this.result.addError(message || `${this.fieldName} must be an object`);
    }
    return this;
  }

  hasKeys(keys, message = null) {
    if (typeof this.value === 'object' && this.value !== null) {
      const missingKeys = keys.filter(key => !(key in this.value));
      if (missingKeys.length > 0) {
        this.result.addError(message || `${this.fieldName} is missing required keys: ${missingKeys.join(', ')}`);
      }
    }
    return this;
  }

  exactKeys(keys, message = null) {
    if (typeof this.value === 'object' && this.value !== null) {
      const objectKeys = Object.keys(this.value);
      const extraKeys = objectKeys.filter(key => !keys.includes(key));
      const missingKeys = keys.filter(key => !objectKeys.includes(key));
      
      if (extraKeys.length > 0 || missingKeys.length > 0) {
        let errorMsg = message || `${this.fieldName} has invalid keys.`;
        if (extraKeys.length > 0) errorMsg += ` Extra: ${extraKeys.join(', ')}.`;
        if (missingKeys.length > 0) errorMsg += ` Missing: ${missingKeys.join(', ')}.`;
        this.result.addError(errorMsg);
      }
    }
    return this;
  }
}

/**
 * Date validator
 */
export class DateValidator extends Validator {
  isValid(message = null) {
    const date = new Date(this.value);
    if (isNaN(date.getTime())) {
      this.result.addError(message || `${this.fieldName} must be a valid date`);
    }
    return this;
  }

  after(compareDate, message = null) {
    const date = new Date(this.value);
    const compare = new Date(compareDate);
    if (date <= compare) {
      this.result.addError(message || `${this.fieldName} must be after ${compare.toDateString()}`);
    }
    return this;
  }

  before(compareDate, message = null) {
    const date = new Date(this.value);
    const compare = new Date(compareDate);
    if (date >= compare) {
      this.result.addError(message || `${this.fieldName} must be before ${compare.toDateString()}`);
    }
    return this;
  }

  future(message = null) {
    const date = new Date(this.value);
    const now = new Date();
    if (date <= now) {
      this.result.addError(message || `${this.fieldName} must be in the future`);
    }
    return this;
  }

  past(message = null) {
    const date = new Date(this.value);
    const now = new Date();
    if (date >= now) {
      this.result.addError(message || `${this.fieldName} must be in the past`);
    }
    return this;
  }

  age(minAge, maxAge = null, message = null) {
    const birthDate = new Date(this.value);
    const today = new Date();
    const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < minAge || (maxAge && age > maxAge)) {
      const ageMsg = maxAge ? `between ${minAge} and ${maxAge}` : `at least ${minAge}`;
      this.result.addError(message || `Age must be ${ageMsg}`);
    }
    return this;
  }
}

/**
 * Pi Network specific validators
 */
export class PiValidator extends Validator {
  piAmount(message = null) {
    if (typeof this.value !== 'number' || this.value < 0 || this.value > 1000000) {
      this.result.addError(message || `${this.fieldName} must be a valid Pi amount (0-1,000,000)`);
    }
    return this;
  }

  piWalletAddress(message = null) {
    // Simplified validation - actual Pi wallet addresses would need Pi Network specific validation
    if (typeof this.value !== 'string' || this.value.length < 10) {
      this.result.addError(message || `${this.fieldName} must be a valid Pi wallet address`);
    }
    return this;
  }

  lotteryTicketLimit(limit, message = null) {
    if (typeof this.value !== 'number' || this.value < 1 || this.value > limit) {
      this.result.addError(message || `${this.fieldName} must be between 1 and ${limit} tickets`);
    }
    return this;
  }

  lotteryType(message = null) {
    const validTypes = ['daily_pi', 'daily_ads', 'weekly_pi', 'monthly_pi'];
    if (!validTypes.includes(this.value)) {
      this.result.addError(message || `${this.fieldName} must be a valid lottery type`);
    }
    return this;
  }
}

/**
 * Validation factory functions
 */
export const validateString = (value, fieldName = 'field') => new StringValidator(value, fieldName);
export const validateNumber = (value, fieldName = 'field') => new NumberValidator(value, fieldName);
export const validateArray = (value, fieldName = 'field') => new ArrayValidator(value, fieldName);
export const validateObject = (value, fieldName = 'field') => new ObjectValidator(value, fieldName);
export const validateDate = (value, fieldName = 'field') => new DateValidator(value, fieldName);
export const validatePi = (value, fieldName = 'field') => new PiValidator(value, fieldName);

/**
 * Quick validation functions
 */
export const isEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isPhone = (phone, format = 'US') => {
  const patterns = {
    US: /^[\+]?[1]?[(]?[\d\s\-\(\)]{10,}$/,
    INTERNATIONAL: /^[\+]?[\d\s\-\(\)]{7,15}$/
  };
  return patterns[format]?.test(phone) || false;
};

export const isStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
};

export const isCreditCard = (cardNumber) => {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  
  // Luhn algorithm
  let sum = 0;
  let isEvenPosition = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);
    
    if (isEvenPosition) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEvenPosition = !isEvenPosition;
  }
  
  return sum % 10 === 0;
};

export const isIPAddress = (ip) => {
  const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Validation schema builder
 */
export class ValidationSchema {
  constructor() {
    this.rules = {};
  }

  field(name, validator) {
    this.rules[name] = validator;
    return this;
  }

  validate(data) {
    const result = new ValidationResult();
    
    for (const [fieldName, validator] of Object.entries(this.rules)) {
      const fieldValue = data[fieldName];
      const fieldResult = validator(fieldValue, fieldName);
      
      if (fieldResult instanceof ValidationResult) {
        result.merge(fieldResult);
      }
    }
    
    return result;
  }
}

/**
 * Common validation schemas for Pi Lottery platform
 */
export const lotteryEntrySchema = new ValidationSchema()
  .field('lotteryTypeId', (value, name) => 
    validatePi(value, name).required().lotteryType().getResult())
  .field('ticketCount', (value, name) => 
    validateNumber(value, name).required().integer().positive().max(10).getResult())
  .field('paymentMethod', (value, name) => 
    validateString(value, name).required().oneOf(['pi_payment', 'watch_ads']).getResult());

export const userRegistrationSchema = new ValidationSchema()
  .field('username', (value, name) => 
    validateString(value, name).required().minLength(3).maxLength(20).alphanumeric().getResult())
  .field('email', (value, name) => 
    validateString(value, name).required().email().getResult())
  .field('age', (value, name) => 
    validateNumber(value, name).required().integer().min(18).max(120).getResult());

export const adminConfigSchema = new ValidationSchema()
  .field('platformFee', (value, name) => 
    validateNumber(value, name).required().min(0).max(1).precision(4).getResult())
  .field('maxTicketsPerUser', (value, name) => 
    validateNumber(value, name).required().integer().positive().max(100).getResult())
  .field('minParticipants', (value, name) => 
    validateNumber(value, name).required().integer().positive().max(1000).getResult());

/**
 * Batch validation utility
 */
export const validateBatch = (data, schemas) => {
  const results = {};
  
  for (const [key, schema] of Object.entries(schemas)) {
    if (data[key] !== undefined) {
      results[key] = schema.validate(data[key]);
    }
  }
  
  return results;
};

/**
 * Sanitization utilities
 */
export const sanitize = {
  email: (email) => email?.toLowerCase().trim(),
  
  username: (username) => username?.toLowerCase().trim().replace(/[^a-z0-9_]/g, ''),
  
  piAmount: (amount) => {
    const num = parseFloat(amount);
    return isNaN(num) ? 0 : Math.max(0, Math.min(num, 1000000));
  },
  
  string: (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength);
  },
  
  html: (html) => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
};

export default {
  ValidationResult,
  Validator,
  StringValidator,
  NumberValidator,
  ArrayValidator,
  ObjectValidator,
  DateValidator,
  PiValidator,
  validateString,
  validateNumber,
  validateArray,
  validateObject,
  validateDate,
  validatePi,
  isEmail,
  isUrl,
  isPhone,
  isStrongPassword,
  isCreditCard,
  isIPAddress,
  ValidationSchema,
  lotteryEntrySchema,
  userRegistrationSchema,
  adminConfigSchema,
  validateBatch,
  sanitize
};
