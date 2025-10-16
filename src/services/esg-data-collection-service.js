// ESG Data Collection Service (F3)
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bigQueryClient = require('../utils/bigquery-client');
const tokenVaultClient = require('../utils/token-vault-client');
const geminiClient = require('../utils/gemini-client');

class ESGDataCollectionService {
  /**
   * Collect ESG data for a company from multiple sources
   */
  async collectESGData(companyId, companyData) {
    console.log(`📊 Collecting ESG data for company: ${companyData.name}`);

    const results = {
      environmental: null,
      social: null,
      governance: null,
      sources: [],
    };

    // Step 1: Collect environmental data from EPA (if US company)
    if (companyData.country === 'United States') {
      results.environmental = await this.collectEPAData(companyData);
      if (results.environmental) {
        results.sources.push('EPA Envirofacts');
      }
    }

    // Step 2: Scrape company website for ESG data
    const webData = await this.scrapeCompanyWebsite(companyData);
    if (webData) {
      results.environmental = { ...results.environmental, ...webData.environmental };
      results.social = webData.social;
      results.governance = webData.governance;
      results.sources.push('Company Website');
    }

    // Step 3: Store in BigQuery
    const esgDataRecords = this.formatESGDataForStorage(companyId, results);
    if (esgDataRecords.length > 0) {
      await bigQueryClient.insert('esg_data', esgDataRecords);
    }

    return {
      companyId,
      companyName: companyData.name,
      dataCollected: results,
      recordsStored: esgDataRecords.length,
      sources: results.sources,
    };
  }

  /**
   * Collect environmental data from EPA Envirofacts API
   * Demonstrates Token Vault usage for API keys
   */
  async collectEPAData(companyData) {
    try {
      console.log(`🏭 Collecting EPA data for: ${companyData.name}`);

      // Get EPA API key from Token Vault (Auth0 feature #2: Control the Tools)
      const apiKey = await tokenVaultClient.getApiKey('epa_api_key');

      // EPA Envirofacts API - Search for facilities
      // Note: EPA API is actually FREE and doesn't require a key for basic access
      const searchUrl = `https://data.epa.gov/efservice/tri_facility/city_name/${encodeURIComponent(companyData.city_name || 'LOS ANGELES')}/rows/0:10/JSON`;

      console.log(`🔍 Querying EPA API: ${searchUrl}`);

      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: apiKey ? { 'X-API-Key': apiKey } : {},
      });

      if (!response.data || response.data.length === 0) {
        console.log(`ℹ️  No EPA data found for ${companyData.name}`);
        return null;
      }

      // Find facility matching company name
      const facility = response.data.find(f => 
        f.facility_name && 
        f.facility_name.toLowerCase().includes(companyData.name.toLowerCase().split(' ')[0])
      );

      if (!facility) {
        console.log(`ℹ️  No matching EPA facility found for ${companyData.name}`);
        return null;
      }

      console.log(`✅ Found EPA facility: ${facility.facility_name}`);

      return {
        epa_facility_id: facility.tri_facility_id,
        facility_name: facility.facility_name,
        location: {
          address: facility.street_address,
          city: facility.city_name,
          state: facility.state_abbr,
          zip: facility.zip_code,
          latitude: facility.pref_latitude,
          longitude: facility.pref_longitude,
        },
        parent_company: facility.parent_co_name,
        epa_registry_id: facility.epa_registry_id,
        source: 'EPA Envirofacts',
      };
    } catch (error) {
      console.error('Error collecting EPA data:', error.message);
      return null;
    }
  }

  /**
   * Scrape company website for ESG data using AI
   */
  async scrapeCompanyWebsite(companyData) {
    try {
      console.log(`🌐 Analyzing company website for ESG data: ${companyData.name}`);

      // In production, you would:
      // 1. Fetch company website HTML
      // 2. Extract text content
      // 3. Use Gemini to analyze for ESG information

      // For demo, we'll simulate with AI-generated data based on company info
      const prompt = `
You are an ESG data analyst. Based on this company information, generate realistic ESG data that might be found on their website or in public reports.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry}
- Country: ${companyData.country}
- Employees: ${companyData.employees || 'Unknown'}

Generate realistic ESG data in JSON format:
{
  "environmental": {
    "carbon_emissions_tons": number (estimated annual CO2 emissions),
    "energy_consumption_mwh": number (estimated annual energy use),
    "renewable_energy_percent": number (0-100),
    "waste_recycling_percent": number (0-100),
    "water_usage_m3": number (estimated annual water use)
  },
  "social": {
    "employee_turnover_percent": number (0-100),
    "women_in_leadership_percent": number (0-100),
    "diversity_initiatives": boolean,
    "employee_training_hours": number (average per employee),
    "health_safety_incidents": number (per year)
  },
  "governance": {
    "board_independence_percent": number (0-100),
    "ethics_policy": boolean,
    "whistleblower_program": boolean,
    "sustainability_committee": boolean,
    "esg_reporting": boolean
  }
}

Make the data realistic for a ${companyData.industry} company with ${companyData.employees || 100} employees.
`;

      const result = await geminiClient.generateJSON(prompt);
      
      console.log(`✅ Generated ESG data from AI analysis`);
      
      return result;
    } catch (error) {
      console.error('Error scraping company website:', error.message);
      return null;
    }
  }

  /**
   * Format ESG data for BigQuery storage
   */
  formatESGDataForStorage(companyId, results) {
    const records = [];
    const timestamp = new Date().toISOString();

    // Environmental metrics
    if (results.environmental) {
      Object.entries(results.environmental).forEach(([metric, value]) => {
        if (typeof value === 'number' || typeof value === 'string') {
          records.push({
            data_id: uuidv4(),
            company_id: companyId,
            category: 'environmental',
            metric_name: metric,
            metric_value: String(value),
            unit: this.getMetricUnit(metric),
            reporting_period: new Date().getFullYear().toString(),
            data_source: results.sources.join(', '),
            verified: false,
            created_at: timestamp,
          });
        }
      });
    }

    // Social metrics
    if (results.social) {
      Object.entries(results.social).forEach(([metric, value]) => {
        records.push({
          data_id: uuidv4(),
          company_id: companyId,
          category: 'social',
          metric_name: metric,
          metric_value: String(value),
          unit: this.getMetricUnit(metric),
          reporting_period: new Date().getFullYear().toString(),
          data_source: results.sources.join(', '),
          verified: false,
          created_at: timestamp,
        });
      });
    }

    // Governance metrics
    if (results.governance) {
      Object.entries(results.governance).forEach(([metric, value]) => {
        records.push({
          data_id: uuidv4(),
          company_id: companyId,
          category: 'governance',
          metric_name: metric,
          metric_value: String(value),
          unit: this.getMetricUnit(metric),
          reporting_period: new Date().getFullYear().toString(),
          data_source: results.sources.join(', '),
          verified: false,
          created: timestamp,
        });
      });
    }

    return records;
  }

  /**
   * Get appropriate unit for a metric
   */
  getMetricUnit(metricName) {
    const unitMap = {
      carbon_emissions_tons: 'tons CO2e',
      energy_consumption_mwh: 'MWh',
      renewable_energy_percent: '%',
      waste_recycling_percent: '%',
      water_usage_m3: 'm³',
      employee_turnover_percent: '%',
      women_in_leadership_percent: '%',
      employee_training_hours: 'hours',
      health_safety_incidents: 'count',
      board_independence_percent: '%',
    };

    return unitMap[metricName] || 'N/A';
  }

  /**
   * Get ESG data for a company
   */
  async getESGData(companyId, category = null) {
    let query = `
      SELECT *
      FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.esg_data\`
      WHERE company_id = ?
    `;

    const params = [companyId];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC`;

    return await bigQueryClient.query(query, params);
  }

  /**
   * Manual data entry
   */
  async addManualData(companyId, data) {
    const record = {
      data_id: uuidv4(),
      company_id: companyId,
      category: data.category,
      metric_name: data.metricName,
      metric_value: String(data.metricValue),
      unit: data.unit || 'N/A',
      reporting_period: data.reportingPeriod || new Date().getFullYear().toString(),
      data_source: 'Manual Entry',
      verified: data.verified || false,
      created_at: new Date().toISOString(),
    };

    await bigQueryClient.insert('esg_data', [record]);
    return record;
  }
}

module.exports = new ESGDataCollectionService();
