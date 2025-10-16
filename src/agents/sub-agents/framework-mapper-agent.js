// Framework Mapper Sub-Agent
// Recommends ESG reporting frameworks (GRI, SASB, TCFD, etc.)

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class FrameworkMapperAgent {
  constructor() {
    this.name = 'FrameworkMapperAgent';
    this.llm = new ChatGoogleGenerativeAI({
      modelName: process.env.MODEL || 'gemini-2.0-flash-exp',
      temperature: 0.1,
    });
  }

  /**
   * Execute framework mapping
   */
  async execute(state, previousResults) {
    console.log(`      📋 [${this.name}] Mapping frameworks...`);

    const companyData = state.companyData;
    const jurisdiction = previousResults?.jurisdiction;

    try {
      const prompt = `You are an ESG reporting expert. Recommend appropriate ESG reporting frameworks for this company.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry || 'General Business'}
- Country: ${jurisdiction?.country || companyData.country || 'United States'}
- Employees: ${companyData.employees || 100}
- Public/Private: ${companyData.isPublic ? 'Public' : 'Private'}

Applicable Regulations:
${previousResults?.regulations?.map(r => `- ${r.name}`).join('\n') || 'None identified'}

Recommend frameworks and return JSON:
{
  "frameworks": [
    {
      "name": "string (GRI, SASB, TCFD, CDP, etc.)",
      "fullName": "string",
      "description": "string",
      "reason": "string (why recommended)",
      "priority": "string (primary, secondary, optional)",
      "regions": ["array of applicable regions"],
      "industries": ["array of applicable industries"]
    }
  ],
  "deadlines": [
    {
      "regulation": "string",
      "deadline": "string (YYYY-MM-DD)",
      "description": "string",
      "recurring": boolean
    }
  ]
}

Common frameworks:
- GRI (Global Reporting Initiative): Universal, comprehensive
- SASB (Sustainability Accounting Standards Board): Industry-specific, investor-focused
- TCFD (Task Force on Climate-related Financial Disclosures): Climate risk
- CDP (Carbon Disclosure Project): Environmental data
- ISSB (International Sustainability Standards Board): New global standard

Return ONLY the JSON object, no other text.`;

      const response = await this.llm.invoke(prompt);
      const content = response.content;

      // Extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const result = JSON.parse(jsonMatch[0]);

      console.log(`      ✅ [${this.name}] Recommended ${result.frameworks?.length || 0} frameworks`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      
      // Return fallback frameworks
      return this.getFallbackFrameworks(companyData);
    }
  }

  /**
   * Get fallback frameworks if AI fails
   */
  getFallbackFrameworks(companyData) {
    const currentYear = new Date().getFullYear();
    
    return {
      frameworks: [
        {
          name: 'GRI',
          fullName: 'Global Reporting Initiative',
          description: 'Comprehensive sustainability reporting standard',
          reason: 'Most widely adopted framework globally',
          priority: 'primary',
          regions: ['Global'],
          industries: ['All'],
        },
        {
          name: 'SASB',
          fullName: 'Sustainability Accounting Standards Board',
          description: 'Industry-specific sustainability standards',
          reason: 'Investor-focused, industry-specific metrics',
          priority: 'secondary',
          regions: ['North America', 'Global'],
          industries: [companyData.industry || 'General Business'],
        },
        {
          name: 'TCFD',
          fullName: 'Task Force on Climate-related Financial Disclosures',
          description: 'Climate risk disclosure framework',
          reason: 'Increasingly mandatory for climate reporting',
          priority: 'primary',
          regions: ['Global'],
          industries: ['All'],
        },
      ],
      deadlines: [
        {
          regulation: 'Annual ESG Report',
          deadline: `${currentYear}-12-31`,
          description: 'End of fiscal year ESG reporting',
          recurring: true,
        },
      ],
    };
  }
}

module.exports = new FrameworkMapperAgent();
