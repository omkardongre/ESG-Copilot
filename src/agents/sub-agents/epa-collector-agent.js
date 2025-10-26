// EPA Collector Sub-Agent
// Fetches environmental data from EPA Envirofacts API
// EPA API is FREE and does NOT require an API key

const axios = require('axios');

class EPACollectorAgent {
  constructor() {
    this.name = 'EPACollectorAgent';
  }

  /**
   * Execute EPA data collection
   * EPA Envirofacts API is FREE and does NOT require an API key
   */
  async execute(state) {
    console.log(`      🏭 [${this.name}] Collecting EPA data...`);

    const companyData = state.companyData;

    // Only collect EPA data for US companies
    if (companyData.country !== 'United States' && companyData.country !== 'US') {
      console.log(`      ℹ️  [${this.name}] Skipping - Company not in US`);
      return null;
    }

    try {
      // Search for facilities by state (more reliable than city)
      const state_abbr = companyData.state || 'CA';
      const searchUrl = `https://data.epa.gov/efservice/tri_facility/state_abbr/${state_abbr}/rows/0:100/JSON`;

      console.log(`      🔍 [${this.name}] Querying EPA API for state: ${state_abbr}`);

      const response = await axios.get(searchUrl, {
        timeout: 15000,
      });

      if (!response.data || response.data.length === 0) {
        console.log(`      ℹ️  [${this.name}] No EPA data found`);
        return null;
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
        console.log(`      ℹ️  [${this.name}] No matching EPA facility found`);
        return null;
      }

      console.log(`      ✅ [${this.name}] Found EPA facility: ${facility.facility_name}`);

      // Extract environmental data (flatten for storage)
      const environmentalData = {
        epa_facility_id: facility.tri_facility_id || 'N/A',
        facility_name: facility.facility_name || 'N/A',
        parent_company: facility.parent_co_name || 'N/A',
        epa_registry_id: facility.epa_registry_id || 'N/A',
        facility_address: facility.street_address || 'N/A',
        facility_city: facility.city_name || 'N/A',
        facility_state: facility.state_abbr || 'N/A',
        facility_zip: facility.zip_code || 'N/A',
      };

      return {
        environmental: environmentalData,
        social: null,
        governance: null,
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      return null; // Graceful degradation
    }
  }
}

module.exports = new EPACollectorAgent();
