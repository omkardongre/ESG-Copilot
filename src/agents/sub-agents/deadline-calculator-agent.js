// Deadline Calculator Sub-Agent
// Calculates compliance deadlines using web search for latest information

const geminiClient = require('../../utils/gemini-client');

class DeadlineCalculatorAgent {
  constructor() {
    this.name = 'DeadlineCalculatorAgent';
  }

  /**
   * Execute deadline calculation with web search
   */
  async execute(state, previousResults) {
    console.log(`      📅 [${this.name}] Calculating deadlines with web search...`);

    const companyData = state.companyData;
    const regulations = previousResults?.regulations || [];

    if (regulations.length === 0) {
      console.log(`      ⚠️  [${this.name}] No regulations to calculate deadlines for`);
      return { deadlines: [] };
    }

    try {
      const prompt = `
You are an ESG compliance expert with access to real-time web search. SEARCH THE WEB to find the latest compliance deadlines for these regulations.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry || 'General Business'}
- Country: ${companyData.country || 'United States'}
- Employees: ${companyData.employees || 100}
- Revenue: ${companyData.revenue || 'Not specified'}

Identified Regulations:
${regulations.map((r, i) => `${i + 1}. ${r.name} (${r.jurisdiction})`).join('\n')}

Task:
1. SEARCH THE WEB for the latest compliance deadlines for each regulation
2. Find specific dates for reporting requirements
3. Identify recurring vs one-time deadlines
4. Check for any upcoming changes or new requirements in 2024-2025

CRITICAL: The "deadline" field MUST be in YYYY-MM-DD format (e.g., "2027-01-01", NOT just "2027").
If only a year is known, use January 1st of that year (e.g., "2027" becomes "2027-01-01").
If only a month and year are known, use the 1st of that month (e.g., "June 2027" becomes "2027-06-01").

Respond with a JSON array of deadlines:
[
  {
    "regulation": "Regulation name",
    "deadline": "YYYY-MM-DD",
    "description": "What needs to be submitted",
    "recurring": true/false,
    "frequency": "annual|quarterly|one-time",
    "nextDeadline": "YYYY-MM-DD (if recurring)",
    "source": "Where you found this information (web search result)"
  }
]

Only include deadlines you found via web search. If no specific deadline found, estimate based on typical reporting cycles.
`;

      const result = await geminiClient.generateJSONWithSearch(prompt);

      if (!result || !Array.isArray(result)) {
        throw new Error('Failed to get deadlines from web search');
      }

      console.log(`      ✅ [${this.name}] Calculated ${result.length} deadlines via web search`);

      return { deadlines: result };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);

      // NO FALLBACK - Production-ready: fail with clear error
      throw new Error(`Failed to calculate deadlines via web search: ${error.message}`);
    }
  }
}

module.exports = new DeadlineCalculatorAgent();
