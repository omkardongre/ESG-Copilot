// Regulation Research Service (F2) - Multi-Agent Orchestration
const { v4: uuidv4 } = require('uuid');
const geminiClient = require('../utils/gemini-client');
const bigQueryClient = require('../utils/bigquery-client');

// Import sub-agents
const jurisdictionAnalyzer = require('../agents/sub-agents/jurisdiction-analyzer-agent');
const frameworkMapper = require('../agents/sub-agents/framework-mapper-agent');
const deadlineCalculator = require('../agents/sub-agents/deadline-calculator-agent');

class RegulationResearchService {
  /**
   * Research applicable ESG regulations for a company using multi-agent orchestration
   * Implements parallel fan-out/gather pattern with 3 specialized agents
   */
  async researchRegulations(companyId, companyData) {
    console.log(`🔍 Researching regulations for company: ${companyData.name}`);
    console.log(`   🤖 Using multi-agent orchestration (hybrid parallel + sequential)`);

    const state = { companyData };

    try {
      const startTime = Date.now();
      
      // PHASE 1: Run jurisdiction analyzer and framework mapper in parallel
      console.log(`   ⚡ Phase 1: Spawning 2 agents in parallel...`);
      const [regulations, frameworks] = await Promise.all([
        jurisdictionAnalyzer.execute(state, null),
        frameworkMapper.execute(state, null),
      ]);

      const phase1Time = Date.now() - startTime;
      console.log(`   ✅ Phase 1 completed in ${phase1Time}ms`);

      // PHASE 2: Run deadline calculator with regulations from phase 1
      console.log(`   ⚡ Phase 2: Running deadline calculator with ${regulations.length} regulations...`);
      const deadlineResult = await deadlineCalculator.execute(state, { regulations });

      const executionTime = Date.now() - startTime;
      console.log(`   ✅ All agents completed in ${executionTime}ms (hybrid execution)`);

      // GATHER RESULTS: Aggregate from all agents
      const deadlines = deadlineResult.deadlines || [];
      const regulationsFound = regulations.length || 0;
      const frameworksFound = frameworks.length || 0;
      const deadlinesFound = deadlines.length || 0;

      console.log(`   📊 Aggregated results:`);
      console.log(`      - Regulations: ${regulationsFound}`);
      console.log(`      - Frameworks: ${frameworksFound}`);
      console.log(`      - Deadlines: ${deadlinesFound}`);

      // Step 4: Store in BigQuery
      const complianceRequirements = regulations.map((reg, index) => ({
        requirement_id: uuidv4(),
        company_id: companyId,
        regulation_name: reg.name,
        regulation_type: reg.type,
        jurisdiction: reg.jurisdiction,
        description: reg.description,
        deadline: deadlines[index]?.deadline || this.getDefaultDeadline(),
        framework: frameworks[0] || 'GRI',
        status: 'pending',
        created_at: new Date().toISOString(),
      }));

      if (complianceRequirements.length > 0) {
        console.log(`   💾 Storing ${complianceRequirements.length} compliance requirements in BigQuery`);
        await bigQueryClient.insert('compliance_requirements', complianceRequirements);
      }

      return {
        regulations,
        frameworks,
        deadlines,
        complianceRequirements,
        regulationsFound,
      };
    } catch (error) {
      console.error(`   ❌ Multi-agent orchestration failed:`, error.message);
      throw new Error(`Regulation research failed: ${error.message}`);
    }
  }

  /**
   * Get default deadline (6 months from now)
   */
  getDefaultDeadline() {
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + 6);
    return deadline.toISOString().split('T')[0];
  }

  /**
   * LEGACY METHOD - Kept for backward compatibility
   * Use researchRegulations() instead for multi-agent orchestration
   */
  async identifyRegulations(companyData) {
    const prompt = `
You are an ESG compliance expert with access to real-time web search. Search the web and analyze this company to identify ALL applicable ESG regulations.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry}
- Country: ${companyData.country}
- Employees: ${companyData.employees || 'Unknown'}
- Revenue: ${companyData.revenue ? '$' + companyData.revenue.toLocaleString() : 'Unknown'}
- Public Status: ${companyData.public_status || 'private'}

Task: 
1. SEARCH THE WEB for latest ESG regulations in ${companyData.country} for ${companyData.industry} industry
2. Identify regulations based on:
   - Company location (country-specific regulations)
   - Industry sector (industry-specific requirements)
   - Company size (employee/revenue thresholds)
   - Public vs private status
3. Verify current compliance deadlines and requirements

Search for these and other relevant regulations:
- EU CSRD (Corporate Sustainability Reporting Directive)
- SEC Climate Disclosure Rules (US public companies)
- TCFD (Task Force on Climate-related Financial Disclosures)
- UK Modern Slavery Act
- California Transparency in Supply Chains Act
- EU Taxonomy Regulation
- SFDR (Sustainable Finance Disclosure Regulation)
- Any NEW regulations passed in 2024-2025

Respond with a JSON array of regulations:
[
  {
    "name": "Regulation name",
    "type": "mandatory|voluntary",
    "jurisdiction": "Country/Region",
    "description": "Brief description of requirements",
    "applicability": "Why this applies to the company",
    "priority": "high|medium|low"
  }
]

Only include regulations that ACTUALLY apply to this company based on your web search. Be specific about applicability.
`;

    try {
      console.log('🔍 Searching web for latest ESG regulations...');
      const result = await geminiClient.generateJSONWithSearch(prompt);
      
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Gemini AI with web search returned no regulations. The AI model may be unavailable or unable to analyze this company profile.');
      }
      
      console.log(`✅ Found ${result.length} applicable regulations via web search`);
      return result;
    } catch (error) {
      console.error('❌ AI regulation research with web search failed:', error.message);
      // NO FALLBACK - Let it fail with clear error message
      throw new Error(`AI regulation research failed: ${error.message}. Please try again or check your Gemini API configuration.`);
    }
  }

  /**
   * Recommend ESG reporting frameworks using Gemini AI
   */
  async recommendFrameworks(companyData, regulations) {
    const prompt = `
You are an ESG reporting expert. Recommend the most appropriate ESG reporting framework(s) for this company.

Company Information:
- Name: ${companyData.name}
- Industry: ${companyData.industry}
- Country: ${companyData.country}
- Employees: ${companyData.employees || 'Unknown'}
- Public Status: ${companyData.public_status || 'private'}

Applicable Regulations:
${regulations.map(r => `- ${r.name} (${r.jurisdiction})`).join('\n')}

Available Frameworks:
1. GRI (Global Reporting Initiative) - Most comprehensive, globally recognized
2. SASB (Sustainability Accounting Standards Board) - Industry-specific, investor-focused
3. TCFD (Task Force on Climate-related Financial Disclosures) - Climate-focused
4. CDP (Carbon Disclosure Project) - Environmental focus
5. ESRS (European Sustainability Reporting Standards) - EU CSRD compliance
6. ISSB (International Sustainability Standards Board) - New global baseline

Task: Recommend 1-3 frameworks that best fit this company's needs.

Respond with a JSON array:
[
  {
    "framework": "Framework name",
    "reason": "Why this framework is recommended",
    "priority": 1
  }
]

Order by priority (1 = highest).
`;

    try {
      const result = await geminiClient.generateJSON(prompt);
      
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Gemini AI returned no framework recommendations.');
      }
      
      const frameworks = result;
      return regulations.map((_, index) => 
        frameworks[index]?.framework || frameworks[0]?.framework || 'GRI'
      );
    } catch (error) {
      console.error('❌ AI framework recommendation failed:', error.message);
      // NO FALLBACK - Let it fail with clear error message
      throw new Error(`AI framework recommendation failed: ${error.message}. Please try again.`);
    }
  }

  /**
   * Calculate compliance deadlines
   */
  calculateDeadlines(regulations) {
    const now = new Date();
    
    return regulations.map(reg => {
      // Default deadlines based on regulation type
      const deadlineMap = {
        'EU CSRD': new Date(now.getFullYear() + 1, 5, 30), // June 30 next year
        'SEC Climate': new Date(now.getFullYear(), 11, 31), // Dec 31 this year
        'TCFD': new Date(now.getFullYear(), 11, 31), // Dec 31 this year
      };

      // Find matching deadline
      for (const [key, deadline] of Object.entries(deadlineMap)) {
        if (reg.name.includes(key)) {
          // Return DATE format (YYYY-MM-DD) for BigQuery
          return deadline.toISOString().split('T')[0];
        }
      }

      // Default: 6 months from now
      const defaultDeadline = new Date(now);
      defaultDeadline.setMonth(defaultDeadline.getMonth() + 6);
      // Return DATE format (YYYY-MM-DD) for BigQuery
      return defaultDeadline.toISOString().split('T')[0];
    });
  }

  /**
   * Fallback regulations when AI fails
   */
  getFallbackRegulations(companyData) {
    const regulations = [];

    // EU companies
    if (['Germany', 'France', 'Netherlands', 'Spain', 'Italy'].includes(companyData.country)) {
      if (companyData.employees >= 250) {
        regulations.push({
          name: 'EU CSRD (Corporate Sustainability Reporting Directive)',
          type: 'mandatory',
          jurisdiction: 'European Union',
          description: 'Mandatory ESG reporting for large companies',
          applicability: 'Company has 250+ employees in EU',
          priority: 'high',
        });
      }
    }

    // US public companies
    if (companyData.country === 'United States' && companyData.public_status === 'public') {
      regulations.push({
        name: 'SEC Climate Disclosure Rules',
        type: 'mandatory',
        jurisdiction: 'United States',
        description: 'Climate-related disclosure requirements for public companies',
        applicability: 'Public company in the US',
        priority: 'high',
      });
    }

    // TCFD - recommended for all large companies
    if (companyData.employees >= 500 || companyData.revenue >= 100000000) {
      regulations.push({
        name: 'TCFD Recommendations',
        type: 'voluntary',
        jurisdiction: 'Global',
        description: 'Climate-related financial disclosures',
        applicability: 'Large company with significant climate risk',
        priority: 'medium',
      });
    }

    // Default GRI for everyone
    if (regulations.length === 0) {
      regulations.push({
        name: 'GRI Standards (Voluntary)',
        type: 'voluntary',
        jurisdiction: 'Global',
        description: 'Comprehensive sustainability reporting framework',
        applicability: 'Recommended for all companies',
        priority: 'medium',
      });
    }

    return regulations;
  }

  /**
   * Get compliance requirements for a company
   */
  async getComplianceRequirements(companyId) {
    const query = `
      SELECT *
      FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.compliance_requirements\`
      WHERE company_id = ?
      ORDER BY deadline ASC
    `;

    return await bigQueryClient.query(query, [companyId]);
  }
}

module.exports = new RegulationResearchService();
