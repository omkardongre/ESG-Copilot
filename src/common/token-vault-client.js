// Token Vault Client
// Securely retrieves API keys from Auth0 Token Vault at runtime
// Implements scoped access, key rotation, and audit logging

const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenVaultClient {
  constructor() {
    this.name = 'TokenVaultClient';
    this.auth0Domain = process.env.AUTH0_DOMAIN;
    this.clientId = process.env.AUTH0_CLIENT_ID;
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET;
    this.tokenVaultUrl = `https://${this.auth0Domain}/api/v2/token-vault`;
    
    // Cache for access tokens
    this.tokenCache = new Map();
    this.cacheExpiry = new Map();
  }

  /**
   * Get API key from Token Vault for a specific user and service
   */
  async getApiKey(userId, serviceName, scopes = []) {
    console.log(`🔐 [TokenVault] Retrieving ${serviceName} key for user ${userId}`);

    try {
      // Get Auth0 management token
      const managementToken = await this.getManagementToken();

      // Request API key from Token Vault
      const response = await axios.post(
        `${this.tokenVaultUrl}/retrieve`,
        {
          user_id: userId,
          service: serviceName,
          scopes: scopes,
          audit: {
            timestamp: new Date().toISOString(),
            action: 'retrieve_api_key',
            agent: 'esg_platform',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const apiKey = response.data.api_key;
      const metadata = response.data.metadata || {};

      console.log(`✅ [TokenVault] Retrieved ${serviceName} key`);

      // Cache the key with expiry
      const cacheKey = `${userId}:${serviceName}`;
      this.tokenCache.set(cacheKey, apiKey);
      this.cacheExpiry.set(cacheKey, Date.now() + 3600000); // 1 hour

      return {
        apiKey,
        service: serviceName,
        scopes: metadata.scopes || scopes,
        expiresAt: metadata.expires_at,
        rotationSchedule: metadata.rotation_schedule,
      };
    } catch (error) {
      console.error(`❌ [TokenVault] Failed to retrieve ${serviceName} key:`, error.message);

      // Fallback to environment variables for development
      if (process.env.NODE_ENV === 'development') {
        return this.getFallbackKey(serviceName);
      }

      throw new Error(`Failed to retrieve API key for ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Get cached API key if available and not expired
   */
  getCachedApiKey(userId, serviceName) {
    const cacheKey = `${userId}:${serviceName}`;
    const expiry = this.cacheExpiry.get(cacheKey);

    if (expiry && Date.now() < expiry) {
      const apiKey = this.tokenCache.get(cacheKey);
      if (apiKey) {
        console.log(`📦 [TokenVault] Using cached ${serviceName} key`);
        return apiKey;
      }
    }

    return null;
  }

  /**
   * Store API key in Token Vault
   */
  async storeApiKey(userId, serviceName, apiKey, metadata = {}) {
    console.log(`💾 [TokenVault] Storing ${serviceName} key for user ${userId}`);

    try {
      const managementToken = await this.getManagementToken();

      // Encrypt API key before storage
      const encryptedKey = this.encryptKey(apiKey);

      await axios.post(
        `${this.tokenVaultUrl}/store`,
        {
          user_id: userId,
          service: serviceName,
          api_key: encryptedKey,
          metadata: {
            ...metadata,
            stored_at: new Date().toISOString(),
            encrypted: true,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ [TokenVault] Stored ${serviceName} key`);

      return { success: true, service: serviceName };
    } catch (error) {
      console.error(`❌ [TokenVault] Failed to store ${serviceName} key:`, error.message);
      throw error;
    }
  }

  /**
   * Rotate API key
   */
  async rotateApiKey(userId, serviceName, newApiKey) {
    console.log(`🔄 [TokenVault] Rotating ${serviceName} key for user ${userId}`);

    try {
      // Store new key
      await this.storeApiKey(userId, serviceName, newApiKey, {
        rotation_date: new Date().toISOString(),
        previous_key_invalidated: true,
      });

      // Invalidate cached key
      const cacheKey = `${userId}:${serviceName}`;
      this.tokenCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);

      // Audit log
      await this.logKeyRotation(userId, serviceName);

      console.log(`✅ [TokenVault] Rotated ${serviceName} key`);

      return { success: true, service: serviceName, rotatedAt: new Date().toISOString() };
    } catch (error) {
      console.error(`❌ [TokenVault] Failed to rotate ${serviceName} key:`, error.message);
      throw error;
    }
  }

  /**
   * Revoke API key access
   */
  async revokeApiKey(userId, serviceName, reason) {
    console.log(`🚫 [TokenVault] Revoking ${serviceName} key for user ${userId}`);

    try {
      const managementToken = await this.getManagementToken();

      await axios.post(
        `${this.tokenVaultUrl}/revoke`,
        {
          user_id: userId,
          service: serviceName,
          reason: reason,
          revoked_at: new Date().toISOString(),
        },
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Clear cache
      const cacheKey = `${userId}:${serviceName}`;
      this.tokenCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);

      console.log(`✅ [TokenVault] Revoked ${serviceName} key`);

      return { success: true, service: serviceName, revokedAt: new Date().toISOString() };
    } catch (error) {
      console.error(`❌ [TokenVault] Failed to revoke ${serviceName} key:`, error.message);
      throw error;
    }
  }

  /**
   * Check if user has access to a service
   */
  async checkAccess(userId, serviceName, requiredScopes = []) {
    try {
      const managementToken = await this.getManagementToken();

      const response = await axios.post(
        `${this.tokenVaultUrl}/check-access`,
        {
          user_id: userId,
          service: serviceName,
          required_scopes: requiredScopes,
        },
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        hasAccess: response.data.has_access,
        grantedScopes: response.data.granted_scopes || [],
        missingScopes: response.data.missing_scopes || [],
      };
    } catch (error) {
      console.error(`❌ [TokenVault] Access check failed:`, error.message);
      
      // Fallback: allow in development
      if (process.env.NODE_ENV === 'development') {
        return { hasAccess: true, grantedScopes: requiredScopes, missingScopes: [] };
      }
      
      return { hasAccess: false, grantedScopes: [], missingScopes: requiredScopes };
    }
  }

  /**
   * Get scoped API key with specific permissions
   */
  async getScopedApiKey(userId, serviceName, scopes) {
    console.log(`🔐 [TokenVault] Getting scoped ${serviceName} key with scopes: ${scopes.join(', ')}`);

    // Check if user has required scopes
    const accessCheck = await this.checkAccess(userId, serviceName, scopes);

    if (!accessCheck.hasAccess) {
      throw new Error(
        `User ${userId} does not have required scopes for ${serviceName}. Missing: ${accessCheck.missingScopes.join(', ')}`
      );
    }

    // Get API key with granted scopes
    return await this.getApiKey(userId, serviceName, accessCheck.grantedScopes);
  }

  /**
   * Get Auth0 management token
   */
  async getManagementToken() {
    // Check cache
    const cached = this.getCachedManagementToken();
    if (cached) return cached;

    try {
      const response = await axios.post(
        `https://${this.auth0Domain}/oauth/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          audience: `https://${this.auth0Domain}/api/v2/`,
          grant_type: 'client_credentials',
        }
      );

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in;

      // Cache token
      this.tokenCache.set('management_token', token);
      this.cacheExpiry.set('management_token', Date.now() + (expiresIn - 60) * 1000);

      return token;
    } catch (error) {
      console.error(`❌ [TokenVault] Failed to get management token:`, error.message);
      throw error;
    }
  }

  /**
   * Get cached management token
   */
  getCachedManagementToken() {
    const expiry = this.cacheExpiry.get('management_token');
    if (expiry && Date.now() < expiry) {
      return this.tokenCache.get('management_token');
    }
    return null;
  }

  /**
   * Encrypt API key
   */
  encryptKey(apiKey) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.clientSecret, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt API key
   */
  decryptKey(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.clientSecret, 'salt', 32);
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Log key rotation
   */
  async logKeyRotation(userId, serviceName) {
    try {
      const managementToken = await this.getManagementToken();

      await axios.post(
        `${this.tokenVaultUrl}/audit`,
        {
          user_id: userId,
          service: serviceName,
          action: 'key_rotation',
          timestamp: new Date().toISOString(),
          metadata: {
            agent: 'esg_platform',
            environment: process.env.NODE_ENV,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.warn(`⚠️  [TokenVault] Failed to log key rotation:`, error.message);
    }
  }

  /**
   * Get fallback key from environment (development only)
   */
  getFallbackKey(serviceName) {
    console.warn(`⚠️  [TokenVault] Using fallback key for ${serviceName} (development mode)`);

    const keyMap = {
      'climatiq': process.env.CLIMATIQ_API_KEY,
      'google_maps': process.env.GOOGLE_MAPS_API_KEY,
      'epa': process.env.EPA_API_KEY,
      'google_ai': process.env.GOOGLE_API_KEY,
      'bigquery': process.env.GOOGLE_CLOUD_PROJECT,
    };

    return {
      apiKey: keyMap[serviceName] || null,
      service: serviceName,
      scopes: ['read', 'write'],
      fallback: true,
    };
  }

  /**
   * Bulk retrieve API keys for multiple services
   */
  async bulkGetApiKeys(userId, serviceNames) {
    console.log(`🔐 [TokenVault] Bulk retrieving keys for ${serviceNames.length} services`);

    const results = await Promise.allSettled(
      serviceNames.map(service => this.getApiKey(userId, service))
    );

    const keys = {};
    const errors = [];

    results.forEach((result, index) => {
      const serviceName = serviceNames[index];
      if (result.status === 'fulfilled') {
        keys[serviceName] = result.value;
      } else {
        errors.push({ service: serviceName, error: result.reason.message });
      }
    });

    return { keys, errors };
  }

  /**
   * Clear all cached tokens
   */
  clearCache() {
    this.tokenCache.clear();
    this.cacheExpiry.clear();
    console.log(`🗑️  [TokenVault] Cache cleared`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.tokenCache.size;
    const expired = Array.from(this.cacheExpiry.entries()).filter(
      ([key, expiry]) => Date.now() >= expiry
    ).length;

    return {
      total,
      active: total - expired,
      expired,
    };
  }
}

// Singleton instance
let instance = null;

module.exports = {
  TokenVaultClient,
  getInstance: () => {
    if (!instance) {
      instance = new TokenVaultClient();
    }
    return instance;
  },
};
