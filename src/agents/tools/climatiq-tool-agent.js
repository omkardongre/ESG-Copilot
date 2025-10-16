// Climatiq Tool Agent
// Wraps Climatiq Carbon API as an autonomous agent

const axios = require('axios');
const { getInstance: getTokenVaultClient } = require('../../common/token-vault-client');

class ClimatiqToolAgent {
  constructor() {
    this.name = 'ClimatiqToolAgent';
    this.baseUrl = 'https://api.climatiq.io';
    this.cache = new Map();
    this.cacheExpiry = 86400000; // 24 hours (emission factors don't change often)
  }

  /**
   * Execute carbon calculation as an agent
   */
  async execute(params) {
    const { userId, action = 'calculate', emissionData } = params;

    console.log(`🌍 [${this.name}] Executing ${action}...`);

    try {
      // Get API key from Token Vault
      const tokenVault = getTokenVaultClient();
      const { apiKey } = await tokenVault.getApiKey(userId, 'climatiq', ['read']);

      let result;
      switch (action) {
        case 'calculate':
          result = await this.calculateEmissions({ emissionData, apiKey });
          break;
        case 'search_factors':
          result = await this.searchEmissionFactors({ query: emissionData.query, apiKey });
          break;
        case 'batch_calculate':
          result = await this.batchCalculate({ emissions: emissionData.batch, apiKey });
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      console.log(`✅ [${this.name}] ${action} complete`);

      return {
        success: true,
        action,
        data: result,
        source: 'Climatiq',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);

      // Retry logic for rate limits
      if (error.response?.status === 429) {
        console.log(`   ⏳ Rate limited, retrying in 10s...`);
        await this.sleep(10000);
        return await this.execute(params);
      }

      return {
        success: false,
        error: error.message,
        action,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate emissions
   */
  async calculateEmissions({ emissionData, apiKey }) {
    const { activityId, parameters } = emissionData;

    const cacheKey = `calc_${activityId}_${JSON.stringify(parameters)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/v1/estimate`;

    const response = await axios.post(
      url,
      {
        emission_factor: {
          activity_id: activityId,
        },
        parameters,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const result = response.data;
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Search emission factors
   */
  async searchEmissionFactors({ query, apiKey }) {
    const cacheKey = `search_${query}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/v1/search`;

    const response = await axios.get(url, {
      params: { query },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    const results = response.data.results || [];
    this.setCache(cacheKey, results);

    return results;
  }

  /**
   * Batch calculate multiple emissions
   */
  async batchCalculate({ emissions, apiKey }) {
    const url = `${this.baseUrl}/v1/batch`;

    const response = await axios.post(
      url,
      { estimates: emissions },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.results || [];
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      console.log(`   📦 Using cached data for ${key}`);
      return entry.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheExpiry,
    });
  }

  clearCache() {
    this.cache.clear();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ClimatiqToolAgent;
