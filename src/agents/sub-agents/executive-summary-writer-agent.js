// Executive Summary Writer Sub-Agent
// Generates executive summary section of ESG report

const geminiClient = require('../../utils/gemini-client');

class ExecutiveSummaryWriterAgent {
  constructor() {
    this.name = 'ExecutiveSummaryWriterAgent';
  }

  /**
   * Execute executive summary writing
   */
  async execute(state, previousResults) {
    console.log(`      📝 [${this.name}] Writing executive summary...`);

    const { company, regulations, esgData, framework } = state;

    try {
      const prompt = `
You are an expert ESG report writer. Write a compelling executive summary for this ${framework} sustainability report.

Company Information:
- Name: ${company.name}
- Industry: ${company.industry}
- Country: ${company.country}
- Employees: ${company.employees || 'Not disclosed'}

Regulations: ${regulations.length} applicable
ESG Data Points: ${esgData.length} metrics collected

Task: Write a 2-3 paragraph executive summary that:
1. Highlights key ESG performance and achievements
2. Mentions major challenges and risks
3. Outlines strategic priorities for sustainability
4. Is professional, concise, and data-driven

Respond with JSON:
{
  "executiveSummary": "2-3 paragraph executive summary text here"
}
`;

      const result = await geminiClient.generateJSON(prompt);

      if (!result || !result.executiveSummary) {
        throw new Error('Failed to generate executive summary');
      }

      console.log(`      ✅ [${this.name}] Executive summary written (${result.executiveSummary.length} chars)`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw new Error(`Executive summary generation failed: ${error.message}`);
    }
  }
}

module.exports = new ExecutiveSummaryWriterAgent();
