// Governance Section Writer Sub-Agent
// Generates governance section following GRI 200 series standards

const geminiClient = require('../../utils/gemini-client');

class GovernanceSectionWriterAgent {
  constructor() {
    this.name = 'GovernanceSectionWriterAgent';
  }

  /**
   * Execute governance section writing
   */
  async execute(state, previousResults) {
    console.log(`      ⚖️  [${this.name}] Writing governance section (GRI 200 series)...`);

    const { company, esgData, framework, regulations } = state;
    const governance = esgData.filter(d => d.category === 'governance');

    try {
      const prompt = `
You are an expert ESG report writer specializing in governance reporting (GRI 200 series standards).

Company: ${company.name} (${company.industry})
Framework: ${framework}

Governance Data (${governance.length} metrics):
${governance.map(d => `- ${d.metric_name}: ${d.metric_value} ${d.unit}`).join('\n') || 'No data available'}

Applicable Regulations: ${regulations.length}

Task: Write a comprehensive governance section following ${framework} standards that includes:
1. Overview paragraph describing governance practices
2. Key metrics with analysis (board composition, ethics, compliance)
3. Governance initiatives and policies
4. Compliance status

Respond with JSON:
{
  "governance": {
    "overview": "Paragraph describing governance practices",
    "keyMetrics": [
      {"metric": "metric name", "value": "value with unit", "analysis": "brief analysis"}
    ],
    "initiatives": ["List of governance initiatives"],
    "policies": ["List of governance policies"]
  },
  "compliance": {
    "overview": "Paragraph on regulatory compliance",
    "regulations": [
      {"name": "regulation name", "status": "compliant|in-progress|not-applicable", "notes": "brief notes"}
    ]
  }
}

Be specific and use actual data provided. Follow ${framework} reporting standards.
`;

      const result = await geminiClient.generateJSON(prompt);

      if (!result || !result.governance) {
        throw new Error('Failed to generate governance section');
      }

      console.log(`      ✅ [${this.name}] Governance section written (${result.governance.keyMetrics?.length || 0} metrics)`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw new Error(`Governance section generation failed: ${error.message}`);
    }
  }
}

module.exports = new GovernanceSectionWriterAgent();
