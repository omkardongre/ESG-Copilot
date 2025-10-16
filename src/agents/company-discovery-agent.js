// Company Discovery Agent
// Discovers and verifies companies using Google Places API globally

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const axios = require('axios');
const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');

class CompanyDiscoveryAgent {
  constructor() {
    this.name = 'CompanyDiscoveryAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });
    
    this.placesApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.placesBaseUrl = 'https://maps.googleapis.com/maps/api/place';
  }

  /**
   * Main execution method
   */
  async execute(state) {
    console.log(`\n🔍 [${this.name}] Starting company discovery...`);
    
    const startTime = Date.now();
    const { searchCriteria } = state;
    
    try {
      // Step 1: Search companies using Google Places API
      const companies = await this.searchCompanies(searchCriteria);
      
      // Step 2: Enrich with AI if needed
      const enrichedCompanies = await this.enrichCompanies(companies);
      
      // Step 3: Log the action
      const duration = Date.now() - startTime;
      await agentLogger.logAction(
        this.name,
        state.userId,
        'discover_companies',
        { searchCriteria },
        { companiesFound: enrichedCompanies.length, companies: enrichedCompanies },
        'success',
        null,
        duration
      );
      
      // Step 4: Broadcast results
      await messageQueue.publishMessage(
        this.name,
        'OrchestratorAgent',
        'companies_discovered',
        { companies: enrichedCompanies },
        state.taskId
      );
      
      console.log(`✅ [${this.name}] Found ${enrichedCompanies.length} companies`);
      
      return {
        ...state,
        discoveredCompanies: enrichedCompanies,
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Discovered ${enrichedCompanies.length} companies`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);
      
      await agentLogger.logAction(
        this.name,
        state.userId,
        'discover_companies',
        { searchCriteria },
        null,
        'error',
        error
      );
      
      return {
        ...state,
        errors: [...state.errors, { agent: this.name, error: error.message }],
      };
    }
  }

  /**
   * Search companies using Google Places API
   */
  async searchCompanies(criteria) {
    const { query, location, industry, limit = 10 } = criteria;
    
    // Build search query
    let searchQuery = query || '';
    if (industry) searchQuery += ` ${industry}`;
    if (location) searchQuery += ` ${location}`;
    
    console.log(`   🔎 Searching: "${searchQuery}"`);
    
    try {
      // Text Search API
      const url = `${this.placesBaseUrl}/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${this.placesApiKey}`;
      
      const response = await axios.get(url);
      const data = response.data;
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      
      if (data.status === 'ZERO_RESULTS') {
        console.log(`   ⚠️  No results found for "${searchQuery}"`);
        return [];
      }
      
      // Process results
      const companies = data.results.slice(0, limit).map(place => this.parsePlace(place));
      
      // Get detailed information for each company
      const detailedCompanies = await Promise.all(
        companies.map(company => this.getPlaceDetails(company))
      );
      
      return detailedCompanies;
    } catch (error) {
      console.error(`   ❌ Search failed:`, error.message);
      throw error;
    }
  }

  /**
   * Parse Google Places result
   */
  parsePlace(place) {
    return {
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address || place.vicinity,
      location: {
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
      },
      types: place.types || [],
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      businessStatus: place.business_status,
      isOperational: place.business_status === 'OPERATIONAL',
    };
  }

  /**
   * Get detailed information for a place
   */
  async getPlaceDetails(company) {
    try {
      const fields = 'name,formatted_address,formatted_phone_number,website,types,rating,user_ratings_total,business_status,opening_hours,price_level,reviews';
      const url = `${this.placesBaseUrl}/details/json?place_id=${company.placeId}&fields=${fields}&key=${this.placesApiKey}`;
      
      const response = await axios.get(url);
      const data = response.data;
      
      if (data.status !== 'OK') {
        console.warn(`   ⚠️  Could not get details for ${company.name}: ${data.status}`);
        return company;
      }
      
      const result = data.result;
      
      return {
        ...company,
        phone: result.formatted_phone_number,
        website: result.website,
        openingHours: result.opening_hours?.weekday_text,
        isOpen: result.opening_hours?.open_now,
        priceLevel: result.price_level,
        reviews: result.reviews?.slice(0, 3).map(r => ({
          author: r.author_name,
          rating: r.rating,
          text: r.text,
          time: r.time,
        })),
        // Infer additional data
        industry: this.inferIndustry(result.types),
        companySize: this.estimateCompanySize(result),
      };
    } catch (error) {
      console.warn(`   ⚠️  Error getting details for ${company.name}:`, error.message);
      return company;
    }
  }

  /**
   * Infer industry from place types
   */
  inferIndustry(types) {
    const industryMap = {
      'restaurant': 'Food & Beverage',
      'food': 'Food & Beverage',
      'cafe': 'Food & Beverage',
      'store': 'Retail',
      'shopping_mall': 'Retail',
      'clothing_store': 'Retail',
      'electronics_store': 'Retail',
      'hospital': 'Healthcare',
      'doctor': 'Healthcare',
      'pharmacy': 'Healthcare',
      'bank': 'Financial Services',
      'accounting': 'Financial Services',
      'insurance_agency': 'Financial Services',
      'lawyer': 'Legal Services',
      'real_estate_agency': 'Real Estate',
      'car_dealer': 'Automotive',
      'car_repair': 'Automotive',
      'gym': 'Fitness & Wellness',
      'spa': 'Fitness & Wellness',
      'hotel': 'Hospitality',
      'lodging': 'Hospitality',
      'school': 'Education',
      'university': 'Education',
      'library': 'Education',
    };
    
    for (const type of types) {
      if (industryMap[type]) {
        return industryMap[type];
      }
    }
    
    return 'Other';
  }

  /**
   * Estimate company size based on available data
   */
  estimateCompanySize(placeData) {
    const { user_ratings_total, price_level, types } = placeData;
    
    // Simple heuristic based on review count
    if (user_ratings_total > 1000) return 'Large (100+ employees)';
    if (user_ratings_total > 500) return 'Medium (50-100 employees)';
    if (user_ratings_total > 100) return 'Small (10-50 employees)';
    return 'Micro (<10 employees)';
  }

  /**
   * Enrich companies with AI-generated insights
   */
  async enrichCompanies(companies) {
    if (companies.length === 0) return companies;
    
    console.log(`   🤖 Enriching ${companies.length} companies with AI...`);
    
    try {
      const prompt = `You are an ESG compliance expert. For each company below, provide:
1. Estimated employee count range
2. Likely ESG compliance requirements
3. Industry classification (if not already provided)

Companies:
${companies.map((c, i) => `${i + 1}. ${c.name} - ${c.industry} - ${c.address}`).join('\n')}

Respond in JSON format:
{
  "companies": [
    {
      "index": 0,
      "estimatedEmployees": "10-50",
      "esgRequirements": ["GHG emissions reporting", "Waste management"],
      "industryClassification": "Manufacturing"
    }
  ]
}`;

      const response = await this.llm.invoke(prompt);
      const enrichmentData = JSON.parse(response.content);
      
      // Merge enrichment data
      return companies.map((company, index) => {
        const enrichment = enrichmentData.companies.find(e => e.index === index);
        if (enrichment) {
          return {
            ...company,
            estimatedEmployees: enrichment.estimatedEmployees,
            esgRequirements: enrichment.esgRequirements,
            industry: enrichment.industryClassification || company.industry,
          };
        }
        return company;
      });
    } catch (error) {
      console.warn(`   ⚠️  AI enrichment failed:`, error.message);
      return companies; // Return original data if enrichment fails
    }
  }
}

module.exports = CompanyDiscoveryAgent;
