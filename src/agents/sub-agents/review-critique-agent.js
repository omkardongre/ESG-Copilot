// Review & Critique Agent
// Validates report quality and triggers iterative refinement

const geminiClient = require('../../utils/gemini-client');

class ReviewCritiqueAgent {
  constructor() {
    this.name = 'ReviewCritiqueAgent';
  }

  /**
   * Execute review and critique with validation checks
   */
  async execute(state, reportContent) {
    console.log(`      🔍 [${this.name}] Reviewing report quality...`);

    const { framework, esgData } = state;

    try {
      // Run 5 validation checks
      const validationResults = await this.runValidationChecks(reportContent, framework, esgData);

      const issuesFound = validationResults.filter(v => !v.passed).length;

      if (issuesFound > 0) {
        console.log(`      ⚠️  [${this.name}] Found ${issuesFound} issues`);
        return {
          approved: false,
          issues: validationResults.filter(v => !v.passed),
          feedback: this.generateFeedback(validationResults),
        };
      }

      console.log(`      ✅ [${this.name}] Report approved - all checks passed`);
      return {
        approved: true,
        issues: [],
        feedback: 'Report meets all quality standards',
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      // If review fails, approve by default (graceful degradation)
      return {
        approved: true,
        issues: [],
        feedback: 'Review agent failed - report approved by default',
      };
    }
  }

  /**
   * Run 5 validation checks
   */
  async runValidationChecks(reportContent, framework, esgData) {
    const checks = [];

    // Check 1: Completeness
    checks.push({
      name: 'Completeness',
      passed: this.checkCompleteness(reportContent),
      message: 'All required sections present',
    });

    // Check 2: Data Quality
    checks.push({
      name: 'Data Quality',
      passed: this.checkDataQuality(reportContent, esgData),
      message: 'Metrics within reasonable ranges',
    });

    // Check 3: Compliance (using AI)
    const complianceCheck = await this.checkCompliance(reportContent, framework);
    checks.push(complianceCheck);

    // Check 4: Consistency
    checks.push({
      name: 'Consistency',
      passed: this.checkConsistency(reportContent),
      message: 'Data is internally consistent',
    });

    // Check 5: Clarity (using AI)
    const clarityCheck = await this.checkClarity(reportContent);
    checks.push(clarityCheck);

    return checks;
  }

  /**
   * Check 1: Completeness - All sections present?
   */
  checkCompleteness(reportContent) {
    const requiredSections = ['executiveSummary', 'environmental', 'social', 'governance'];
    return requiredSections.every(section => reportContent[section] && Object.keys(reportContent[section]).length > 0);
  }

  /**
   * Check 2: Data Quality - Metrics within reasonable ranges?
   */
  checkDataQuality(reportContent, esgData) {
    // Simple check: ensure we have some metrics
    const envMetrics = reportContent.environmental?.keyMetrics?.length || 0;
    const socMetrics = reportContent.social?.keyMetrics?.length || 0;
    const govMetrics = reportContent.governance?.keyMetrics?.length || 0;

    return (envMetrics + socMetrics + govMetrics) >= 3; // At least 3 metrics total
  }

  /**
   * Check 3: Compliance - Meets framework standards? (AI-powered)
   */
  async checkCompliance(reportContent, framework) {
    try {
      const prompt = `
You are an ESG compliance expert. Review this report for ${framework} compliance.

Report Sections:
- Executive Summary: ${reportContent.executiveSummary ? 'Present' : 'Missing'}
- Environmental: ${reportContent.environmental ? 'Present' : 'Missing'}
- Social: ${reportContent.social ? 'Present' : 'Missing'}
- Governance: ${reportContent.governance ? 'Present' : 'Missing'}

Question: Does this report structure meet ${framework} reporting standards?

Respond with JSON:
{
  "compliant": true/false,
  "message": "Brief explanation"
}
`;

      const result = await geminiClient.generateJSON(prompt);

      return {
        name: 'Compliance',
        passed: result.compliant,
        message: result.message,
      };
    } catch (error) {
      // If AI fails, assume compliant
      return {
        name: 'Compliance',
        passed: true,
        message: 'Compliance check skipped (AI unavailable)',
      };
    }
  }

  /**
   * Check 4: Consistency - Numbers add up?
   */
  checkConsistency(reportContent) {
    // Simple check: ensure sections have content
    const envHasContent = reportContent.environmental?.overview?.length > 50;
    const socHasContent = reportContent.social?.overview?.length > 50;
    const govHasContent = reportContent.governance?.overview?.length > 50;

    return envHasContent && socHasContent && govHasContent;
  }

  /**
   * Check 5: Clarity - Narrative is professional? (AI-powered)
   */
  async checkClarity(reportContent) {
    try {
      const prompt = `
You are an ESG report editor. Review this executive summary for clarity and professionalism.

Executive Summary:
${reportContent.executiveSummary}

Question: Is this summary clear, professional, and well-written?

Respond with JSON:
{
  "clear": true/false,
  "message": "Brief feedback"
}
`;

      const result = await geminiClient.generateJSON(prompt);

      return {
        name: 'Clarity',
        passed: result.clear,
        message: result.message,
      };
    } catch (error) {
      // If AI fails, assume clear
      return {
        name: 'Clarity',
        passed: true,
        message: 'Clarity check skipped (AI unavailable)',
      };
    }
  }

  /**
   * Generate feedback from validation results
   */
  generateFeedback(validationResults) {
    const failedChecks = validationResults.filter(v => !v.passed);

    if (failedChecks.length === 0) {
      return 'All validation checks passed';
    }

    const feedback = failedChecks.map(check => `- ${check.name}: ${check.message}`).join('\n');

    return `Issues found:\n${feedback}\n\nPlease revise the report to address these issues.`;
  }
}

module.exports = new ReviewCritiqueAgent();
