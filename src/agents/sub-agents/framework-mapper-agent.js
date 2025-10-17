// Framework Mapper Sub-Agent
// Recommends ESG reporting frameworks (GRI, SASB, TCFD, etc.) using AI reasoning

const geminiClient = require('../../utils/gemini-client');

class FrameworkMapperAgent {
  constructor() {
    this.name = 'FrameworkMapperAgent';
  }

  /**
   * Execute framework mapping with AI reasoning
   */
  async execute(state, previousResults) {
    console.log(`      📋 [${this.name}] Mapping frameworks with AI reasoning...`);

    const companyData = state.companyData;
    const regulations = previousResults || [];

    try {
      const prompt = `You are an ESG reporting expert. Recommend appropriate ESG reporting frameworks for this company based on AI reasoning.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry || 'General Business'}
- Country: ${companyData.country || 'United States'}
- Employees: ${companyData.employees || 100}
- Public/Private: ${companyData.isPublic ? 'Public' : 'Private'}

Applicable Regulations:
${regulations.map(r => `- ${r.name} (${r.jurisdiction})`).join('\n') || 'None identified'}

Task: Recommend 1-3 frameworks that best fit this company's needs.

Common frameworks:
- GRI (Global Reporting Initiative): Universal, comprehensive
- SASB (Sustainability Accounting Standards Board): Industry-specific, investor-focused
- TCFD (Task Force on Climate-related Financial Disclosures): Climate risk
- CDP (Carbon Disclosure Project): Environmental data
- ESRS (European Sustainability Reporting Standards): EU CSRD compliance
- ISSB (International Sustainability Standards Board): New global standard

Respond with a JSON array of framework names (strings):
["Framework 1", "Framework 2", "Framework 3"]

Example: ["TCFD (Task Force on Climate-related Financial Disclosures)", "GRI (Global Reporting Initiative)", "SASB (Sustainability Accounting Standards Board)"]
`;

      const result = await geminiClient.generateJSON(prompt);

      if (!result || !Array.isArray(result)) {
        throw new Error('Failed to get frameworks from AI');
      }

      console.log(`      ✅ [${this.name}] Recommended ${result.length} frameworks via AI reasoning`);

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
    console.log(`      ⚠️  [${this.name}] Using fallback frameworks`);
    
    return [
      'TCFD (Task Force on Climate-related Financial Disclosures)',
      'GRI (Global Reporting Initiative)',
      'SASB (Sustainability Accounting Standards Board)',
    ];
  }
}

module.exports = new FrameworkMapperAgent();
