// Environmental Section Writer Sub-Agent
// Generates environmental section following GRI 300 series standards

const geminiClient = require('../../utils/gemini-client');

class EnvironmentalSectionWriterAgent {
  constructor() {
    this.name = 'EnvironmentalSectionWriterAgent';
  }

  /**
   * Execute environmental section writing
   */
  async execute(state, previousResults) {
    console.log(`      🌍 [${this.name}] Writing environmental section (GRI 300 series)...`);

    const { company, esgData, framework } = state;
    const environmental = esgData.filter(d => d.category === 'environmental');

    try {
      const prompt = `
You are an expert ESG report writer specializing in environmental reporting (GRI 300 series standards).

Company: ${company.name} (${company.industry})
Framework: ${framework}

Environmental Data (${environmental.length} metrics):
${environmental.map(d => `- ${d.metric_name}: ${d.metric_value} ${d.unit}`).join('\n') || 'No data available'}

Task: Write a comprehensive environmental section following ${framework} standards that includes:
1. Overview paragraph describing environmental performance
2. Key metrics with analysis
3. Environmental initiatives and programs
4. Targets and commitments

Respond with JSON:
{
  "environmental": {
    "overview": "Paragraph describing environmental performance",
    "keyMetrics": [
      {"metric": "metric name", "value": "value with unit", "analysis": "brief analysis"}
    ],
    "initiatives": ["List of environmental initiatives"],
    "targets": ["List of environmental targets"]
  }
}

Be specific and use actual data provided. Follow ${framework} reporting standards.
`;

      const result = await geminiClient.generateJSON(prompt);

      if (!result || !result.environmental) {
        throw new Error('Failed to generate environmental section');
      }

      console.log(`      ✅ [${this.name}] Environmental section written (${result.environmental.keyMetrics?.length || 0} metrics)`);

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw new Error(`Environmental section generation failed: ${error.message}`);
    }
  }
}

module.exports = new EnvironmentalSectionWriterAgent();
