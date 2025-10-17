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

      // Return fallback deadlines
      return this.getFallbackDeadlines(regulations);
    }
  }

  /**
   * Get fallback deadlines if web search fails
   */
  getFallbackDeadlines(regulations) {
    const now = new Date();
    const currentYear = now.getFullYear();

    const deadlines = regulations.map(reg => {
      // Default deadline: end of current year or 6 months from now
      let deadline = new Date(currentYear, 11, 31); // Dec 31 this year

      // Specific deadlines for known regulations
      if (reg.name.includes('CSRD')) {
        deadline = new Date(currentYear + 1, 5, 30); // June 30 next year
      } else if (reg.name.includes('SEC') || reg.name.includes('Climate')) {
        deadline = new Date(currentYear, 11, 31); // Dec 31 this year
      } else if (reg.name.includes('SB 253')) {
        deadline = new Date(2026, 5, 1); // June 1, 2026 (Scope 1/2)
      } else if (reg.name.includes('SB 261')) {
        deadline = new Date(2026, 0, 1); // January 1, 2026
      }

      return {
        regulation: reg.name,
        deadline: deadline.toISOString().split('T')[0],
        description: `${reg.name} compliance reporting`,
        recurring: true,
        frequency: 'annual',
        nextDeadline: new Date(deadline.getFullYear() + 1, deadline.getMonth(), deadline.getDate())
          .toISOString()
          .split('T')[0],
        source: 'Estimated based on typical reporting cycles',
      };
    });

    console.log(`      ⚠️  [${this.name}] Using fallback deadlines (${deadlines.length})`);

    return { deadlines };
  }
}

module.exports = new DeadlineCalculatorAgent();
