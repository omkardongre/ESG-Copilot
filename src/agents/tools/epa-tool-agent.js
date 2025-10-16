// EPA Tool Agent
// Wraps EPA API as an autonomous agent with retry logic and caching

const axios = require('axios');
const { getInstance: getTokenVaultClient } = require('../../common/token-vault-client');

class EPAToolAgent {
  constructor() {
    this.name = 'EPAToolAgent';
    this.baseUrl = 'https://enviro.epa.gov/enviro/efservice';
    this.cache = new Map();
    this.cacheExpiry = 3600000; // 1 hour
  }

  /**
   * Execute EPA data retrieval as an agent
   */
  async execute(params) {
    const { userId, facilityId, zipCode, city, state, action = 'search' } = params;

    console.log(`🏭 [${this.name}] Executing ${action}...`);

    try {
      // Get API key from Token Vault
      const tokenVault = getTokenVaultClient();
      const { apiKey } = await tokenVault.getApiKey(userId, 'epa', ['read']);

      let result;
      switch (action) {
        case 'search':
          result = await this.searchFacilities({ zipCode, city, state, apiKey });
          break;
        case 'get_facility':
          result = await this.getFacilityDetails({ facilityId, apiKey });
          break;
        case 'get_emissions':
          result = await this.getEmissionsData({ facilityId, apiKey });
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      console.log(`✅ [${this.name}] ${action} complete`);

      return {
        success: true,
        action,
        data: result,
        source: 'EPA',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);
      
      // Retry logic
      if (error.response?.status === 429) {
        console.log(`   ⏳ Rate limited, retrying in 5s...`);
        await this.sleep(5000);
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
   * Search for facilities
   */
  async searchFacilities({ zipCode, city, state, apiKey }) {
    const cacheKey = `search_${zipCode}_${city}_${state}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let url = `${this.baseUrl}/tri_facility`;
    const params = [];

    if (zipCode) params.push(`zip/${zipCode}`);
    if (city) params.push(`city_name/${city}`);
    if (state) params.push(`st/${state}`);

    url += `/${params.join('/')}/JSON`;

    const response = await axios.get(url, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      timeout: 10000,
    });

    const facilities = response.data || [];
    this.setCache(cacheKey, facilities);

    return facilities;
  }

  /**
   * Get facility details
   */
  async getFacilityDetails({ facilityId, apiKey }) {
    const cacheKey = `facility_${facilityId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/tri_facility/tri_facility_id/${facilityId}/JSON`;

    const response = await axios.get(url, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      timeout: 10000,
    });

    const facility = response.data?.[0] || null;
    this.setCache(cacheKey, facility);

    return facility;
  }

  /**
   * Get emissions data
   */
  async getEmissionsData({ facilityId, apiKey }) {
    const cacheKey = `emissions_${facilityId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/tri_release/tri_facility_id/${facilityId}/JSON`;

    const response = await axios.get(url, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      timeout: 10000,
    });

    const emissions = response.data || [];
    this.setCache(cacheKey, emissions);

    return emissions;
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

module.exports = EPAToolAgent;
