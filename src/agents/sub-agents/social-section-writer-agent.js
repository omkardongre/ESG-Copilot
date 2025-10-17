// Social Section Writer Sub-Agent
// Generates social section following GRI 400 series standards

const geminiClient = require('../../utils/gemini-client');

class SocialSectionWriterAgent {
  constructor() {
    this.name = 'SocialSectionWriterAgent';
  }

  /**
   * Execute social section writing
   */
  async execute(state, previousResults) {
    console.log(`      👥 [${this.name}] Writing social section (GRI 400 series)...`);

    const { company, esgData, framework } = state;
    const social = esgData.filter(d => d.category === 'social');

    try {
      const prompt = `
You are an expert ESG report writer specializing in social reporting (GRI 400 series standards).

Company: ${company.name} (${company.industry})
Framework: ${framework}

Social Data (${social.length} metrics):
${social.map(d => `- ${d.metric_name}: ${d.metric_value} ${d.unit}`).join('\n') || 'No data available'}

Task: Write a comprehensive social section following ${framework} standards that includes:
1. Overview paragraph describing social performance
2. Key metrics with analysis (employee welfare, diversity, safety, community)
3. Social initiatives and programs
4. Targets and commitments

Respond with JSON:
{
  "social": {
    "overview": "Paragraph describing social performance",
    "keyMetrics": [
      {"metric": "metric name", "value": "value with unit", "analysis": "brief analysis"}
    ],
    "initiatives": ["List of social initiatives"],
    "targets": ["List of social targets"]
  }
}

Be specific and use actual data provided. Follow ${framework} reporting standards.
`;

      const result = await geminiClient.generateJSON(prompt);

      if (!result || !result.social) {
        throw new Error('Failed to generate social section');
      }

      console.log(`      ✅ [${this.name}] Social section written (${result.social.keyMetrics?.length || 0} metrics)`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw new Error(`Social section generation failed: ${error.message}`);
    }
  }
}

module.exports = new SocialSectionWriterAgent();
