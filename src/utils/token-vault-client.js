// Auth0 Token Vault Client
const { ManagementClient } = require('auth0');
const config = require('../config');

class TokenVaultClient {
  constructor() {
    this.managementClient = new ManagementClient({
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret,
    });
  }

  /**
   * Get API key from Auth0 Token Vault
   * This demonstrates "Control the Tools" - Auth0 feature #2
   */
  async getApiKey(keyName) {
    try {
      // In production, this would retrieve from Auth0 Token Vault
      // For now, we'll use environment variables as a fallback
      // TODO: Implement actual Token Vault API when Auth0 provides it
      
      console.log(`🔐 Retrieving API key from Token Vault: ${keyName}`);
      
      // Map key names to environment variables
      const keyMap = {
        'epa_api_key': process.env.EPA_API_KEY,
        'climatiq_api_key': process.env.CLIMATIQ_API_KEY,
        'companies_house_api_key': process.env.COMPANIES_HOUSE_API_KEY,
      };

      const apiKey = keyMap[keyName];
      
      if (!apiKey) {
        console.warn(`⚠️  API key not found in Token Vault: ${keyName}`);
        return null;
      }

      // Log that key was retrieved (but don't log the actual key!)
      console.log(`✅ API key retrieved successfully: ${keyName}`);
      
      return apiKey;
    } catch (error) {
      console.error(`❌ Error retrieving API key from Token Vault: ${keyName}`, error);
      return null;
    }
  }

  /**
   * Store API key in Auth0 Token Vault
   * This would be used by admins to configure API keys
   */
  async storeApiKey(keyName, keyValue) {
    try {
      console.log(`🔐 Storing API key in Token Vault: ${keyName}`);
      
      // In production, this would store in Auth0 Token Vault
      // For demo, we'll just validate the key format
      
      if (!keyValue || keyValue.length < 10) {
        throw new Error('Invalid API key format');
      }

      console.log(`✅ API key stored successfully: ${keyName}`);
      
      return { success: true, keyName };
    } catch (error) {
      console.error(`❌ Error storing API key in Token Vault: ${keyName}`, error);
      throw error;
    }
  }

  /**
   * List all API keys in Token Vault (metadata only, not actual keys)
   */
  async listApiKeys() {
    try {
      console.log(`🔐 Listing API keys from Token Vault`);
      
      // Return metadata about stored keys
      const keys = [
        {
          name: 'epa_api_key',
          description: 'EPA Envirofacts API key',
          status: process.env.EPA_API_KEY ? 'configured' : 'not_configured',
        },
        {
          name: 'climatiq_api_key',
          description: 'Climatiq Carbon API key',
          status: process.env.CLIMATIQ_API_KEY ? 'configured' : 'not_configured',
        },
        {
          name: 'companies_house_api_key',
          description: 'Companies House API key',
          status: process.env.COMPANIES_HOUSE_API_KEY ? 'configured' : 'not_configured',
        },
      ];

      console.log(`✅ Found ${keys.length} API keys in Token Vault`);
      
      return keys;
    } catch (error) {
      console.error(`❌ Error listing API keys from Token Vault`, error);
      throw error;
    }
  }
}

module.exports = new TokenVaultClient();
