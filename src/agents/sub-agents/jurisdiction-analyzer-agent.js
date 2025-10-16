// Jurisdiction Analyzer Sub-Agent
// Determines applicable laws and regulations by country/region

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class JurisdictionAnalyzerAgent {
  constructor() {
    this.name = 'JurisdictionAnalyzerAgent';
    this.llm = new ChatGoogleGenerativeAI({
      modelName: process.env.MODEL || 'gemini-2.0-flash-exp',
      temperature: 0.1,
    });
  }

  /**
   * Execute jurisdiction analysis
   */
  async execute(state, previousResults) {
    console.log(`      📍 [${this.name}] Analyzing jurisdiction...`);

    const companyData = state.companyData;

    try {
      const prompt = `You are an ESG compliance expert. Identify applicable ESG regulations for this company based on jurisdiction.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry || 'General Business'}
- Country: ${companyData.country || 'United States'}
- State/Region: ${companyData.state || 'Not specified'}
- Employees: ${companyData.employees || 100}
- Revenue: ${companyData.revenue || 'Not specified'}
- Public/Private: ${companyData.isPublic ? 'Public' : 'Private'}

Analyze and return JSON:
{
  "jurisdiction": {
    "country": "string",
    "region": "string (e.g., North America, EU)",
    "state": "string (if applicable)"
  },
  "regulations": [
    {
      "name": "string",
      "jurisdiction": "string",
      "description": "string",
      "applicability": "string (why it applies)",
      "industries": ["array of applicable industries"],
      "sizeThreshold": "string (employee/revenue threshold)",
      "mandatory": boolean,
      "reportingFrequency": "string (annual, quarterly, etc.)"
    }
  ]
}

Examples of regulations to consider:
- US: SEC Climate Disclosure Rule, California SB 253/261
- EU: CSRD, SFDR, EU Taxonomy
- UK: TCFD, Streamlined Energy & Carbon Reporting
- Global: GHG Protocol

Return ONLY the JSON object, no other text.`;

      const response = await this.llm.invoke(prompt);
      const content = response.content;

      // Extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const result = JSON.parse(jsonMatch[0]);

      console.log(`      ✅ [${this.name}] Found ${result.regulations?.length || 0} regulations`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      
      // Return fallback based on country
      return this.getFallbackRegulations(companyData);
    }
  }

  /**
   * Get fallback regulations if AI fails
   */
  getFallbackRegulations(companyData) {
    const country = companyData.country || 'United States';
    
    const regulations = {
      'United States': [
        {
          name: 'SEC Climate Disclosure Rule',
          jurisdiction: 'United States',
          description: 'Requires public companies to disclose climate-related risks',
          applicability: 'Public companies',
          industries: ['All'],
          sizeThreshold: 'Public companies',
          mandatory: true,
          reportingFrequency: 'Annual',
        },
        {
          name: 'California SB 253 (Climate Corporate Data Accountability Act)',
          jurisdiction: 'California, US',
          description: 'Requires companies to disclose Scope 1, 2, and 3 emissions',
          applicability: 'Companies with >$1B revenue doing business in CA',
          industries: ['All'],
          sizeThreshold: '>$1 billion revenue',
          mandatory: true,
          reportingFrequency: 'Annual',
        },
      ],
      'United Kingdom': [
        {
          name: 'TCFD Reporting',
          jurisdiction: 'United Kingdom',
          description: 'Task Force on Climate-related Financial Disclosures',
          applicability: 'Large companies and financial institutions',
          industries: ['All'],
          sizeThreshold: '>500 employees or listed',
          mandatory: true,
          reportingFrequency: 'Annual',
        },
      ],
    };

    return {
      jurisdiction: {
        country,
        region: country === 'United States' ? 'North America' : 'Other',
        state: companyData.state || null,
      },
      regulations: regulations[country] || [],
    };
  }
}

module.exports = new JurisdictionAnalyzerAgent();
