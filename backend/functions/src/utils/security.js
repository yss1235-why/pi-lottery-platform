// backend/functions/src/utils/security.js

import crypto from 'crypto';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { SECURITY, ERROR_CODES, ADMIN_PERMISSIONS, REGEX_PATTERNS } from './constants.js';
import { logger } from './logger.js';
import { CustomError } from './validators.js';

/**
 * Security Utility Class
 * Provides encryption, hashing, token management, and security validation
 */
class SecurityManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecureKey();
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.saltRounds = 12;
    this.rateLimitStore = new Map();
    
    // Initialize rate limiting cleanup
    this.startRateLimitCleanup();
  }

  /**
   * Generate secure random key
   * @param {number} length - Key length in bytes
   * @returns {string} Base64 encoded key
   */
  generateSecureKey(length = 32) {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Generate encryption key
   * @returns {Buffer} Encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(SECURITY.ENCRYPTION.KEY_LENGTH);
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      logger.debug('Password hashed successfully');
      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error: error.message });
      throw new CustomError('Password hashing failed', ERROR_CODES.INTERNAL_ERROR);
    }
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Verification result
   */
  async verifyPassword(password, hash) {
    try {
      const isValid = await bcrypt.compare(password, hash);
      logger.debug('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Password verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePasswordStrength(password) {
    const result = {
      isValid: true,
      score: 0,
      feedback: []
    };

    // Length check
    if (password.length < SECURITY.PASSWORD.MIN_LENGTH) {
      result.isValid = false;
      result.feedback.push(`Password must be at least ${SECURITY.PASSWORD.MIN_LENGTH} characters long`);
    } else {
      result.score += 1;
    }

    // Uppercase check
    if (SECURITY.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      result.isValid = false;
      result.feedback.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      result.score += 1;
    }

    // Lowercase check
    if (SECURITY.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      result.isValid = false;
      result.feedback.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      result.score += 1;
    }

    // Numbers check
    if (SECURITY.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      result.isValid = false;
      result.feedback.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      result.score += 1;
    }

    // Symbols check
    if (SECURITY.PASSWORD.REQUIRE_SYMBOLS && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      result.isValid = false;
      result.feedback.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      result.score += 1;
    }

    // Common password check
    if (this.isCommonPassword(password)) {
      result.isValid = false;
      result.feedback.push('Password is too common');
      result.score = Math.max(0, result.score - 2);
    }

    return result;
  }

  /**
   * Check if password is commonly used
   * @param {string} password - Password to check
   * @returns {boolean} Whether password is common
   */
  isCommonPassword(password) {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {string} expiresIn - Expiration time
   * @returns {string} JWT token
   */
  generateJWT(payload, expiresIn = SECURITY.JWT.EXPIRY) {
    try {
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn,
        algorithm: SECURITY.JWT.ALGORITHM,
        issuer: 'pi-lottery-platform'
      });
      
      logger.debug('JWT token generated', { userId: payload.sub });
      return token;
    } catch (error) {
      logger.error('JWT generation failed', { error: error.message });
      throw new CustomError('Token generation failed', ERROR_CODES.INTERNAL_ERROR);
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  verifyJWT(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: [SECURITY.JWT.ALGORITHM],
        issuer: 'pi-lottery-platform'
      });
      
      logger.debug('JWT token verified', { userId: decoded.sub });
      return decoded;
    } catch (error) {
      logger.warn('JWT verification failed', { error: error.message });
      
      if (error.name === 'TokenExpiredError') {
        throw new CustomError('Token expired', ERROR_CODES.AUTH_EXPIRED);
      } else if (error.name === 'JsonWebTokenError') {
        throw new CustomError('Invalid token', ERROR_CODES.AUTH_INVALID);
      } else {
        throw new CustomError('Token verification failed', ERROR_CODES.AUTH_INVALID);
      }
    }
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Text to encrypt
   * @param {Buffer} key - Encryption key (optional)
   * @returns {Object} Encrypted data with IV
   */
  encrypt(text, key = null) {
    try {
      const encryptionKey = key || Buffer.from(this.encryptionKey, 'base64');
      const iv = crypto.randomBytes(SECURITY.ENCRYPTION.IV_LENGTH);
      
      const cipher = crypto.createCipher(SECURITY.ENCRYPTION.ALGORITHM, encryptionKey);
      cipher.setAAD(Buffer.from('pi-lottery-platform'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new CustomError('Encryption failed', ERROR_CODES.INTERNAL_ERROR);
    }
  }

  /**
   * Decrypt sensitive data
   * @param {Object} encryptedData - Encrypted data object
   * @param {Buffer} key - Decryption key (optional)
   * @returns {string} Decrypted text
   */
  decrypt(encryptedData, key = null) {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      const decryptionKey = key || Buffer.from(this.encryptionKey, 'base64');
      
      const decipher = crypto.createDecipher(SECURITY.ENCRYPTION.ALGORITHM, decryptionKey);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      decipher.setAAD(Buffer.from('pi-lottery-platform'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new CustomError('Decryption failed', ERROR_CODES.INTERNAL_ERROR);
    }
  }

  /**
   * Generate secure random string
   * @param {number} length - String length
   * @param {string} charset - Character set
   * @returns {string} Random string
   */
  generateRandomString(length = 32, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    
    return result;
  }

  /**
   * Generate UUID v4
   * @returns {string} UUID
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Hash data with SHA-256
   * @param {string} data - Data to hash
   * @param {string} salt - Salt (optional)
   * @returns {string} Hash
   */
  hashSHA256(data, salt = '') {
    const hash = crypto.createHash('sha256');
    hash.update(data + salt);
    return hash.digest('hex');
  }

  /**
   * Create HMAC signature
   * @param {string} data - Data to sign
   * @param {string} secret - Secret key
   * @returns {string} HMAC signature
   */
  createHMAC(data, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - HMAC signature
   * @param {string} secret - Secret key
   * @returns {boolean} Verification result
   */
  verifyHMAC(data, signature, secret) {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Rate limiting check
   * @param {string} identifier - Client identifier (IP, user ID, etc.)
   * @param {number} maxRequests - Maximum requests per window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} Rate limit result
   */
  checkRateLimit(identifier, maxRequests = SECURITY.RATE_LIMITING.MAX_REQUESTS_PER_MINUTE, windowMs = SECURITY.RATE_LIMITING.WINDOW_SIZE) {
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / windowMs)}`;
    
    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, { count: 0, resetTime: now + windowMs });
    }
    
    const record = this.rateLimitStore.get(key);
    record.count++;
    
    const isLimited = record.count > maxRequests;
    const remainingRequests = Math.max(0, maxRequests - record.count);
    const resetTime = record.resetTime;
    
    if (isLimited) {
      logger.warn('Rate limit exceeded', { 
        identifier, 
        count: record.count, 
        maxRequests,
        resetTime 
      });
    }
    
    return {
      isLimited,
      remainingRequests,
      resetTime,
      retryAfter: isLimited ? Math.ceil((resetTime - now) / 1000) : 0
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  startRateLimitCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.rateLimitStore.entries()) {
        if (now > record.resetTime) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Sanitize input to prevent injection attacks
   * @param {string} input - User input
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[\\]/g, '') // Remove backslashes
      .trim(); // Remove whitespace
  }

  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} Validation result
   */
  validateEmail(email) {
    return REGEX_PATTERNS.EMAIL.test(email);
  }

  /**
   * Validate Pi amount format
   * @param {string|number} amount - Pi amount
   * @returns {boolean} Validation result
   */
  validatePiAmount(amount) {
    const amountStr = amount.toString();
    return REGEX_PATTERNS.PI_AMOUNT.test(amountStr) && parseFloat(amountStr) > 0;
  }

  /**
   * Check admin permissions
   * @param {Object} adminUser - Admin user object
   * @param {string} requiredPermission - Required permission
   * @returns {boolean} Permission check result
   */
  hasAdminPermission(adminUser, requiredPermission) {
    if (!adminUser || !adminUser.isAdmin) {
      return false;
    }
    
    if (!adminUser.permissions || !Array.isArray(adminUser.permissions)) {
      return false;
    }
    
    return adminUser.permissions.includes(requiredPermission);
  }

  /**
   * Verify Firebase ID token
   * @param {string} idToken - Firebase ID token
   * @returns {Promise<Object>} Decoded token
   */
  async verifyFirebaseToken(idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      logger.debug('Firebase token verified', { uid: decodedToken.uid });
      return decodedToken;
    } catch (error) {
      logger.warn('Firebase token verification failed', { error: error.message });
      throw new CustomError('Invalid authentication token', ERROR_CODES.AUTH_INVALID);
    }
  }

  /**
   * Generate secure API key
   * @param {string} prefix - Key prefix
   * @returns {string} API key
   */
  generateApiKey(prefix = 'plat') {
    const randomPart = this.generateRandomString(32);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomPart}`;
  }

  /**
   * Create secure session token
   * @param {string} userId - User ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Session data
   */
  createSecureSession(userId, metadata = {}) {
    const sessionId = this.generateUUID();
    const token = this.generateJWT({
      sub: userId,
      sessionId,
      type: 'session',
      ...metadata
    });
    
    return {
      sessionId,
      token,
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  /**
   * Mask sensitive data for logging
   * @param {string} data - Sensitive data
   * @param {number} visibleChars - Number of visible characters
   * @returns {string} Masked data
   */
  maskSensitiveData(data, visibleChars = 4) {
    if (!data || data.length <= visibleChars) {
      return '*'.repeat(data?.length || 0);
    }
    
    const visible = data.slice(-visibleChars);
    const masked = '*'.repeat(data.length - visibleChars);
    return masked + visible;
  }

  /**
   * Validate request signature (for webhooks)
   * @param {string} payload - Request payload
   * @param {string} signature - Request signature
   * @param {string} secret - Webhook secret
   * @returns {boolean} Validation result
   */
  validateWebhookSignature(payload, signature, secret) {
    const expectedSignature = this.createHMAC(payload, secret);
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  }

  /**
   * Generate one-time password (OTP)
   * @param {number} length - OTP length
   * @returns {string} OTP
   */
  generateOTP(length = 6) {
    const digits = '0123456789';
    return this.generateRandomString(length, digits);
  }

  /**
   * Time-based one-time password (TOTP) generation
   * @param {string} secret - TOTP secret
   * @param {number} window - Time window
   * @returns {string} TOTP
   */
  generateTOTP(secret, window = Math.floor(Date.now() / 30000)) {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(window, 4);
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
    hmac.update(buffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0x0f;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Constant-time string comparison
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} Comparison result
   */
  constantTimeEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}

// Create singleton instance
export const security = new SecurityManager();

// Export individual functions for convenience
export const {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateJWT,
  verifyJWT,
  encrypt,
  decrypt,
  generateRandomString,
  generateUUID,
  hashSHA256,
  createHMAC,
  verifyHMAC,
  checkRateLimit,
  sanitizeInput,
  validateEmail,
  validatePiAmount,
  hasAdminPermission,
  verifyFirebaseToken,
  generateApiKey,
  createSecureSession,
  maskSensitiveData,
  validateWebhookSignature,
  generateOTP,
  generateTOTP,
  constantTimeEqual
} = security;

export default security;
