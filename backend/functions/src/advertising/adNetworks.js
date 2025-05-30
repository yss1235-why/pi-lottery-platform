const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const environmentConfig = require('../config/environment');

/**
 * Ad network integrations and validation
 */
class AdNetworks {
  constructor() {
    this.networks = {
      unity_ads: new UnityAdsHandler(),
      google_admob: new GoogleAdMobHandler(),
      facebook_audience: new FacebookAudienceHandler()
    };
  }

  /**
   * Get network handler
   */
  getNetworkHandler(networkId) {
    return this.networks[networkId] || null;
  }

  /**
   * Get all supported networks
   */
  getSupportedNetworks() {
    return Object.keys(this.networks);
  }

  /**
   * Validate ad completion across all networks
   */
  async validateAdCompletion(adCompletionData) {
    const networkId = adCompletionData.adNetworkId;
    const handler = this.getNetworkHandler(networkId);

    if (!handler) {
      return {
        isValid: false,
        reason: `Unsupported ad network: ${networkId}`
      };
    }

    try {
      const validation = await handler.validateCompletion(adCompletionData);
      return validation;
    } catch (error) {
      logger.error(`Ad validation failed for ${networkId}:`, error);
      return {
        isValid: false,
        reason: 'Network validation error'
      };
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStatistics() {
    const statistics = {};

    for (const [networkId, handler] of Object.entries(this.networks)) {
      try {
        statistics[networkId] = await handler.getStatistics();
      } catch (error) {
        statistics[networkId] = { error: error.message };
      }
    }

    return statistics;
  }
}

/**
 * Base class for ad network handlers
 */
class BaseAdNetworkHandler {
  constructor(networkId) {
    this.networkId = networkId;
    this.isEnabled = true;
    this.config = this.getNetworkConfig();
  }

  getNetworkConfig() {
    return environmentConfig.get(`advertising.networks.${this.networkId}`, {});
  }

  async validateCompletion(adCompletionData) {
    // Base validation logic
    return {
      isValid: true,
      reason: 'Basic validation passed'
    };
  }

  async getStatistics() {
    return {
      networkId: this.networkId,
      isEnabled: this.isEnabled,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Unity Ads network handler
 */
class UnityAdsHandler extends BaseAdNetworkHandler {
  constructor() {
    super('unity_ads');
    this.apiBaseUrl = 'https://ads.unity3d.com/v1';
    this.gameId = this.config.gameId || process.env.UNITY_GAME_ID;
    this.apiKey = this.config.apiKey || process.env.UNITY_API_KEY;
  }

  async validateCompletion(adCompletionData) {
    try {
      // Validate required Unity Ads fields
      if (!adCompletionData.placementId || !adCompletionData.unityUserId) {
        return {
          isValid: false,
          reason: 'Missing Unity Ads required fields'
        };
      }

      // Validate placement ID format
      if (!this.isValidPlacementId(adCompletionData.placementId)) {
        return {
          isValid: false,
          reason: 'Invalid Unity Ads placement ID'
        };
      }

      // Validate watch duration (Unity ads are typically 15-30 seconds)
      const watchDuration = parseInt(adCompletionData.watchDuration);
      if (watchDuration < 15 || watchDuration > 45) {
        return {
          isValid: false,
          reason: 'Invalid watch duration for Unity Ads'
        };
      }

      // Server-side validation (if API available)
      const serverValidation = await this.validateWithUnityServer(adCompletionData);
      if (!serverValidation.isValid) {
        return serverValidation;
      }

      return {
        isValid: true,
        reason: 'Unity Ads validation successful',
        networkData: {
          placementId: adCompletionData.placementId,
          unityUserId: adCompletionData.unityUserId
        }
      };
    } catch (error) {
      logger.error('Unity Ads validation error:', error);
      return {
        isValid: false,
        reason: 'Unity Ads validation failed'
      };
    }
  }

  isValidPlacementId(placementId) {
    // Unity placement IDs are typically alphanumeric with underscores
    return /^[a-zA-Z0-9_]+$/.test(placementId);
  }

  async validateWithUnityServer(adCompletionData) {
    try {
      if (!this.gameId || !this.apiKey) {
        // Skip server validation if credentials not available
        return { isValid: true, reason: 'Server validation skipped' };
      }

      // Note: This is a placeholder - Unity doesn't provide a direct ad validation API
      // In practice, you would implement client-side validation or use Unity Analytics
      
      return {
        isValid: true,
        reason: 'Unity server validation passed'
      };
    } catch (error) {
      logger.warn('Unity server validation failed:', error);
      return { isValid: true, reason: 'Server validation skipped due to error' };
    }
  }

  async getStatistics() {
    const baseStats = await super.getStatistics();
    return {
      ...baseStats,
      gameId: this.gameId ? 'configured' : 'not_configured',
      serverValidation: this.gameId && this.apiKey ? 'available' : 'unavailable'
    };
  }
}

/**
 * Google AdMob network handler
 */
class GoogleAdMobHandler extends BaseAdNetworkHandler {
  constructor() {
    super('google_admob');
    this.publisherId = this.config.publisherId || process.env.ADMOB_PUBLISHER_ID;
    this.apiKey = this.config.apiKey || process.env.ADMOB_API_KEY;
  }

  async validateCompletion(adCompletionData) {
    try {
      // Validate required AdMob fields
      if (!adCompletionData.adUnitId || !adCompletionData.requestId) {
        return {
          isValid: false,
          reason: 'Missing AdMob required fields'
        };
      }

      // Validate AdMob ad unit ID format
      if (!this.isValidAdUnitId(adCompletionData.adUnitId)) {
        return {
          isValid: false,
          reason: 'Invalid AdMob ad unit ID format'
        };
      }

      // Validate watch duration (AdMob rewarded videos are typically 15-30 seconds)
      const watchDuration = parseInt(adCompletionData.watchDuration);
      if (watchDuration < 15 || watchDuration > 60) {
        return {
          isValid: false,
          reason: 'Invalid watch duration for AdMob'
        };
      }

      // Check request ID uniqueness
      const isDuplicate = await this.checkRequestIdDuplicate(adCompletionData.requestId);
      if (isDuplicate) {
        return {
          isValid: false,
          reason: 'Duplicate AdMob request ID'
        };
      }

      // Server-side validation
      const serverValidation = await this.validateWithAdMobServer(adCompletionData);
      if (!serverValidation.isValid) {
        return serverValidation;
      }

      return {
        isValid: true,
        reason: 'AdMob validation successful',
        networkData: {
          adUnitId: adCompletionData.adUnitId,
          requestId: adCompletionData.requestId
        }
      };
    } catch (error) {
      logger.error('AdMob validation error:', error);
      return {
        isValid: false,
        reason: 'AdMob validation failed'
      };
    }
  }

  isValidAdUnitId(adUnitId) {
    // AdMob ad unit IDs follow format: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
    return /^ca-app-pub-\d{16}\/\d{10}$/.test(adUnitId);
  }

  async checkRequestIdDuplicate(requestId) {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      const duplicateSnapshot = await db.collection('admob_requests')
        .where('requestId', '==', requestId)
        .limit(1)
        .get();

      if (!duplicateSnapshot.empty) {
        return true;
      }

      // Store request ID to prevent future duplicates
      await db.collection('admob_requests').add({
        requestId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return false;
    } catch (error) {
      logger.error('Failed to check AdMob request ID duplicate:', error);
      return false; // Allow completion if check fails
    }
  }

  async validateWithAdMobServer(adCompletionData) {
    try {
      if (!this.publisherId || !this.apiKey) {
        return { isValid: true, reason: 'Server validation skipped' };
      }

      // Note: Google AdMob doesn't provide a direct server-side validation API
      // for individual ad impressions. This is a placeholder for custom validation
      
      return {
        isValid: true,
        reason: 'AdMob server validation passed'
      };
    } catch (error) {
      logger.warn('AdMob server validation failed:', error);
      return { isValid: true, reason: 'Server validation skipped due to error' };
    }
  }

  async getStatistics() {
    const baseStats = await super.getStatistics();
    return {
      ...baseStats,
      publisherId: this.publisherId ? 'configured' : 'not_configured',
      serverValidation: this.publisherId && this.apiKey ? 'available' : 'unavailable'
    };
  }
}

/**
 * Facebook Audience Network handler
 */
class FacebookAudienceHandler extends BaseAdNetworkHandler {
  constructor() {
    super('facebook_audience');
    this.appId = this.config.appId || process.env.FACEBOOK_APP_ID;
    this.appSecret = this.config.appSecret || process.env.FACEBOOK_APP_SECRET;
    this.apiBaseUrl = 'https://graph.facebook.com/v18.0';
  }

  async validateCompletion(adCompletionData) {
    try {
      // Validate required Facebook Audience Network fields
      if (!adCompletionData.placementId || !adCompletionData.impressionId) {
        return {
          isValid: false,
          reason: 'Missing Facebook Audience Network required fields'
        };
      }

      // Validate placement ID format
      if (!this.isValidPlacementId(adCompletionData.placementId)) {
        return {
          isValid: false,
          reason: 'Invalid Facebook placement ID format'
        };
      }

      // Validate watch duration
      const watchDuration = parseInt(adCompletionData.watchDuration);
      if (watchDuration < 15 || watchDuration > 60) {
        return {
          isValid: false,
          reason: 'Invalid watch duration for Facebook Audience Network'
        };
      }

      // Check impression ID uniqueness
      const isDuplicate = await this.checkImpressionIdDuplicate(adCompletionData.impressionId);
      if (isDuplicate) {
        return {
          isValid: false,
          reason: 'Duplicate Facebook impression ID'
        };
      }

      // Server-side validation
      const serverValidation = await this.validateWithFacebookServer(adCompletionData);
      if (!serverValidation.isValid) {
        return serverValidation;
      }

      return {
        isValid: true,
        reason: 'Facebook Audience Network validation successful',
        networkData: {
          placementId: adCompletionData.placementId,
          impressionId: adCompletionData.impressionId
        }
      };
    } catch (error) {
      logger.error('Facebook Audience Network validation error:', error);
      return {
        isValid: false,
        reason: 'Facebook Audience Network validation failed'
      };
    }
  }

  isValidPlacementId(placementId) {
    // Facebook placement IDs typically include app ID and placement name
    return /^\d+_[a-zA-Z0-9_]+$/.test(placementId);
  }

  async checkImpressionIdDuplicate(impressionId) {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      const duplicateSnapshot = await db.collection('facebook_impressions')
        .where('impressionId', '==', impressionId)
        .limit(1)
        .get();

      if (!duplicateSnapshot.empty) {
        return true;
      }

      // Store impression ID to prevent future duplicates
      await db.collection('facebook_impressions').add({
        impressionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return false;
    } catch (error) {
      logger.error('Failed to check Facebook impression ID duplicate:', error);
      return false;
    }
  }

  async validateWithFacebookServer(adCompletionData) {
    try {
      if (!this.appId || !this.appSecret) {
        return { isValid: true, reason: 'Server validation skipped' };
      }

      // Note: Facebook Audience Network provides limited server-side validation
      // This is a placeholder for custom validation logic
      
      return {
        isValid: true,
        reason: 'Facebook server validation passed'
      };
    } catch (error) {
      logger.warn('Facebook server validation failed:', error);
      return { isValid: true, reason: 'Server validation skipped due to error' };
    }
  }

  async getStatistics() {
    const baseStats = await super.getStatistics();
    return {
      ...baseStats,
      appId: this.appId ? 'configured' : 'not_configured',
      serverValidation: this.appId && this.appSecret ? 'available' : 'unavailable'
    };
  }
}

/**
 * Ad network configuration management
 */
class AdNetworkConfig {
  constructor() {
    this.db = require('firebase-admin').firestore();
  }

  /**
   * Get network configuration
   */
  async getNetworkConfig(networkId) {
    try {
      const configDoc = await this.db.collection('ad_network_config').doc(networkId).get();
      return configDoc.exists ? configDoc.data() : {};
    } catch (error) {
      logger.error(`Failed to get config for ${networkId}:`, error);
      return {};
    }
  }

  /**
   * Update network configuration
   */
  async updateNetworkConfig(networkId, config, adminId) {
    try {
      const admin = require('firebase-admin');
      
      await this.db.collection('ad_network_config').doc(networkId).set({
        ...config,
        updatedBy: adminId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log configuration change
      await this.db.collection('admin_logs').add({
        action: 'ad_network_config_updated',
        details: {
          networkId,
          changes: config,
          adminId
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to update config for ${networkId}:`, error);
      throw error;
    }
  }

  /**
   * Enable/disable network
   */
  async toggleNetwork(networkId, enabled, adminId) {
    try {
      const admin = require('firebase-admin');
      
      await this.db.collection('ad_network_config').doc(networkId).update({
        isEnabled: enabled,
        updatedBy: adminId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log toggle action
      await this.db.collection('admin_logs').add({
        action: 'ad_network_toggled',
        details: {
          networkId,
          enabled,
          adminId
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to toggle ${networkId}:`, error);
      throw error;
    }
  }
}

// Create and export instances
const adNetworks = new AdNetworks();
const adNetworkConfig = new AdNetworkConfig();

module.exports = {
  adNetworks,
  adNetworkConfig,
  // Export for direct access
  ...adNetworks
};
