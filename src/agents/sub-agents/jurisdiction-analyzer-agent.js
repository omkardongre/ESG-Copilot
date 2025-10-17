// Jurisdiction Analyzer Sub-Agent
// Determines applicable laws and regulations by country/region using web search

const geminiClient = require('../../utils/gemini-client');

class JurisdictionAnalyzerAgent {
  constructor() {
    this.name = 'JurisdictionAnalyzerAgent';
  }

  /**
   * Execute jurisdiction analysis with web search
   */
  async execute(state, previousResults) {
    console.log(`      📍 [${this.name}] Analyzing jurisdiction with web search...`);

    const companyData = state.companyData;

    try {
      const prompt = `You are an ESG compliance expert with access to real-time web search. SEARCH THE WEB to identify applicable ESG regulations for this company based on jurisdiction.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry || 'General Business'}
- Country: ${companyData.country || 'United States'}
- State/Region: ${companyData.state || 'Not specified'}
- Employees: ${companyData.employees || 100}
- Revenue: ${companyData.revenue || 'Not specified'}
- Public/Private: ${companyData.isPublic ? 'Public' : 'Private'}

Task:
1. SEARCH THE WEB for latest ESG regulations in ${companyData.country} for ${companyData.industry} industry
2. Focus on federal/national, state/regional, and local regulations
3. Find regulations passed in 2024-2025
4. Identify mandatory vs voluntary requirements

Respond with a JSON array of regulations:
[
  {
    "name": "string",
    "type": "mandatory|voluntary",
    "jurisdiction": "string (country/state)",
    "description": "string",
    "applicability": "string (why it applies to this company)",
    "priority": "high|medium|low"
  }
]

Examples to search for:
- US: SEC Climate Disclosure Rule, California SB 253/261
- EU: CSRD, SFDR, EU Taxonomy
- UK: TCFD, Modern Slavery Act
- Global: GHG Protocol

Only include regulations found via web search that apply to this company.
`;

      const result = await geminiClient.generateJSONWithSearch(prompt);

      if (!result || !Array.isArray(result)) {
        throw new Error('Failed to get regulations from web search');
      }

      console.log(`      ✅ [${this.name}] Found ${result.length} regulations via web search`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      
      // Return fallback based on country
      return this.getFallbackRegulations(companyData);
    }
  }

  /**
   * Get fallback regulations if web search fails
   */
  getFallbackRegulations(companyData) {
    const country = companyData.country || 'United States';
    
    const regulations = {
      'United States': [
        {
          name: 'SEC Climate Disclosure Rule',
          type: 'mandatory',
          jurisdiction: 'United States',
          description: 'Requires public companies to disclose climate-related risks',
          applicability: 'Public companies',
          priority: 'high',
        },
        {
          name: 'California SB 253 (Climate Corporate Data Accountability Act)',
          type: 'mandatory',
          jurisdiction: 'California, USA',
          description: 'Requires companies to disclose Scope 1, 2, and 3 emissions',
          applicability: 'Companies with >$1B revenue doing business in CA',
          priority: 'medium',
        },
      ],
      'United Kingdom': [
        {
          name: 'TCFD Reporting',
          type: 'mandatory',
          jurisdiction: 'United Kingdom',
          description: 'Task Force on Climate-related Financial Disclosures',
          applicability: 'Large companies and financial institutions',
          priority: 'high',
        },
      ],
    };

    console.log(`      ⚠️  [${this.name}] Using fallback regulations for ${country}`);

    return regulations[country] || [];
  }
}

module.exports = new JurisdictionAnalyzerAgent();
