// EPA Collector Sub-Agent
// Fetches environmental data from EPA Envirofacts API
// Uses Token Vault for API key management

const axios = require('axios');
const tokenVaultClient = require('../../utils/token-vault-client');

class EPACollectorAgent {
  constructor() {
    this.name = 'EPACollectorAgent';
  }

  /**
   * Execute EPA data collection
   */
  async execute(state) {
    console.log(`    🏭 [${this.name}] Collecting EPA data...`);

    const companyData = state.companyData;

    // Only collect EPA data for US companies
    if (companyData.country !== 'United States' && companyData.country !== 'US') {
      console.log(`    ℹ️  [${this.name}] Skipping - Company not in US`);
      return {
        environmental: {},
        social: {},
        governance: {},
        source: null,
      };
    }

    try {
      // Get EPA API key from Token Vault (Auth0 feature: Control the Tools)
      const apiKey = await tokenVaultClient.getApiKey('epa_api_key');

      // Search for facilities by city
      const city = companyData.city || companyData.city_name || 'LOS ANGELES';
      const searchUrl = `https://data.epa.gov/efservice/tri_facility/city_name/${encodeURIComponent(city)}/rows/0:10/JSON`;

      console.log(`    🔍 [${this.name}] Querying EPA API for city: ${city}`);

      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: apiKey ? { 'X-API-Key': apiKey } : {},
      });

      if (!response.data || response.data.length === 0) {
        console.log(`    ℹ️  [${this.name}] No EPA data found`);
        return {
          environmental: {},
          social: {},
          governance: {},
          source: null,
        };
      }

      // Find facility matching company name
      const companyNameParts = companyData.name.toLowerCase().split(' ');
      const facility = response.data.find(f => 
        f.facility_name && 
        companyNameParts.some(part => 
          part.length > 3 && f.facility_name.toLowerCase().includes(part)
        )
      );

      if (!facility) {
        console.log(`    ℹ️  [${this.name}] No matching EPA facility found`);
        return {
          environmental: {},
          social: {},
          governance: {},
          source: null,
        };
      }

      console.log(`    ✅ [${this.name}] Found EPA facility: ${facility.facility_name}`);

      // Extract environmental data
      const environmentalData = {
        epa_facility_id: facility.tri_facility_id,
        facility_name: facility.facility_name,
        parent_company: facility.parent_co_name,
        epa_registry_id: facility.epa_registry_id,
        location: {
          address: facility.street_address,
          city: facility.city_name,
          state: facility.state_abbr,
          zip: facility.zip_code,
          latitude: facility.pref_latitude,
          longitude: facility.pref_longitude,
        },
      };

      return {
        environmental: environmentalData,
        social: {},
        governance: {},
        source: 'EPA Envirofacts',
      };
    } catch (error) {
      console.error(`    ❌ [${this.name}] Error:`, error.message);
      throw error;
    }
  }
}

module.exports = new EPACollectorAgent();
