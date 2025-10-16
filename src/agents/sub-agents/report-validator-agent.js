// Report Validator Sub-Agent
// Validates ESG report structure, completeness, and compliance
// Checks for missing data, required sections, and framework adherence

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class ReportValidatorAgent {
  constructor() {
    this.name = 'ReportValidatorAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });
  }

  /**
   * Execute report validation
   */
  async execute(params) {
    const { report, companyInfo } = params;

    console.log(`      🔍 [${this.name}] Validating report...`);

    try {
      // Validation checks
      const structureCheck = this.validateStructure(report);
      const completenessCheck = this.validateCompleteness(report);
      const frameworkCheck = this.validateFrameworkCompliance(report);
      const dataCheck = await this.validateDataQuality(report);
      const metadataCheck = this.validateMetadata(report, companyInfo);

      // Compile results
      const errors = [
        ...structureCheck.errors,
        ...completenessCheck.errors,
        ...frameworkCheck.errors,
        ...dataCheck.errors,
        ...metadataCheck.errors,
      ];

      const warnings = [
        ...structureCheck.warnings,
        ...completenessCheck.warnings,
        ...frameworkCheck.warnings,
        ...dataCheck.warnings,
        ...metadataCheck.warnings,
      ];

      const missingData = [
        ...completenessCheck.missingData,
        ...dataCheck.missingData,
      ];

      // Calculate validation score
      const score = this.calculateValidationScore(
        structureCheck,
        completenessCheck,
        frameworkCheck,
        dataCheck,
        metadataCheck
      );

      const isValid = errors.length === 0 && score >= 70;

      console.log(`      ${isValid ? '✅' : '⚠️'} Validation score: ${score}/100`);
      console.log(`      Errors: ${errors.length}, Warnings: ${warnings.length}`);

      return {
        isValid,
        score,
        errors,
        warnings,
        missingData,
        checks: {
          structure: structureCheck,
          completeness: completenessCheck,
          framework: frameworkCheck,
          dataQuality: dataCheck,
          metadata: metadataCheck,
        },
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Validation error:`, error.message);
      throw error;
    }
  }

  /**
   * Validate report structure
   */
  validateStructure(report) {
    const errors = [];
    const warnings = [];
    let score = 100;

    // Check for required top-level properties
    if (!report.content) {
      errors.push('Missing report content');
      score -= 50;
    }

    if (!report.content?.metadata) {
      errors.push('Missing report metadata');
      score -= 20;
    }

    if (!report.content?.sections || report.content.sections.length === 0) {
      errors.push('Missing report sections');
      score -= 30;
    }

    // Check section structure
    if (report.content?.sections) {
      report.content.sections.forEach((section, index) => {
        if (!section.id) {
          warnings.push(`Section ${index} missing ID`);
          score -= 2;
        }
        if (!section.title) {
          warnings.push(`Section ${index} missing title`);
          score -= 2;
        }
        if (!section.content || section.content.trim().length === 0) {
          warnings.push(`Section "${section.title}" has no content`);
          score -= 5;
        }
      });
    }

    return {
      passed: errors.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
    };
  }

  /**
   * Validate report completeness
   */
  validateCompleteness(report) {
    const errors = [];
    const warnings = [];
    const missingData = [];
    let score = 100;

    const template = report.content?.metadata?.template || 'Custom';

    // Required sections by template
    const requiredSections = this.getRequiredSections(template);

    const presentSections = report.content?.sections?.map(s => s.id) || [];

    requiredSections.forEach(requiredId => {
      if (!presentSections.includes(requiredId)) {
        missingData.push(`Missing required section: ${requiredId}`);
        score -= 15;
      }
    });

    // Check for minimum content length
    if (report.content?.sections) {
      report.content.sections.forEach(section => {
        if (section.content && section.content.length < 100) {
          warnings.push(`Section "${section.title}" content is too short (${section.content.length} chars)`);
          score -= 3;
        }
      });
    }

    // Check for charts/visualizations
    if (!report.content?.charts || report.content.charts.length === 0) {
      warnings.push('No visualizations included in report');
      score -= 10;
    }

    // Check for footer/disclaimer
    if (!report.content?.footer) {
      warnings.push('Missing report footer/disclaimer');
      score -= 5;
    }

    return {
      passed: missingData.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
      missingData,
    };
  }

  /**
   * Get required sections by template
   */
  getRequiredSections(template) {
    const sectionMap = {
      GRI: [
        'executive_summary',
        'company_overview',
        'methodology',
        'gri_environmental',
        'gri_social',
        'gri_governance',
        'conclusion',
      ],
      SASB: [
        'executive_summary',
        'company_overview',
        'methodology',
        'sasb_environmental',
        'sasb_social',
        'sasb_human',
        'conclusion',
      ],
      TCFD: [
        'executive_summary',
        'company_overview',
        'methodology',
        'tcfd_governance',
        'tcfd_strategy',
        'tcfd_risk',
        'tcfd_metrics',
        'conclusion',
      ],
      Custom: [
        'executive_summary',
        'company_overview',
        'methodology',
        'conclusion',
      ],
    };

    return sectionMap[template] || sectionMap.Custom;
  }

  /**
   * Validate framework compliance
   */
  validateFrameworkCompliance(report) {
    const errors = [];
    const warnings = [];
    let score = 100;

    const template = report.content?.metadata?.template;

    if (!template) {
      warnings.push('No framework template specified');
      score -= 10;
      return { passed: true, score, errors, warnings };
    }

    // Framework-specific validation
    const sections = report.content?.sections || [];

    if (template === 'GRI') {
      // Check for GRI-specific sections
      const hasGRI300 = sections.some(s => s.id.includes('gri_environmental'));
      const hasGRI400 = sections.some(s => s.id.includes('gri_social'));
      const hasGRI200 = sections.some(s => s.id.includes('gri_governance'));

      if (!hasGRI300) warnings.push('Missing GRI 300 (Environmental) series');
      if (!hasGRI400) warnings.push('Missing GRI 400 (Social) series');
      if (!hasGRI200) warnings.push('Missing GRI 200 (Economic/Governance) series');

      score -= (!hasGRI300 ? 10 : 0) + (!hasGRI400 ? 10 : 0) + (!hasGRI200 ? 10 : 0);
    }

    if (template === 'TCFD') {
      // Check for TCFD pillars
      const hasGovernance = sections.some(s => s.id.includes('tcfd_governance'));
      const hasStrategy = sections.some(s => s.id.includes('tcfd_strategy'));
      const hasRisk = sections.some(s => s.id.includes('tcfd_risk'));
      const hasMetrics = sections.some(s => s.id.includes('tcfd_metrics'));

      if (!hasGovernance) warnings.push('Missing TCFD Governance pillar');
      if (!hasStrategy) warnings.push('Missing TCFD Strategy pillar');
      if (!hasRisk) warnings.push('Missing TCFD Risk Management pillar');
      if (!hasMetrics) warnings.push('Missing TCFD Metrics & Targets pillar');

      score -= (!hasGovernance ? 10 : 0) + (!hasStrategy ? 10 : 0) + 
              (!hasRisk ? 10 : 0) + (!hasMetrics ? 10 : 0);
    }

    if (template === 'SASB') {
      // Check for SASB capitals
      const hasEnv = sections.some(s => s.id.includes('sasb_environmental'));
      const hasSocial = sections.some(s => s.id.includes('sasb_social'));
      const hasHuman = sections.some(s => s.id.includes('sasb_human'));

      if (!hasEnv) warnings.push('Missing SASB Environmental Capital');
      if (!hasSocial) warnings.push('Missing SASB Social Capital');
      if (!hasHuman) warnings.push('Missing SASB Human Capital');

      score -= (!hasEnv ? 10 : 0) + (!hasSocial ? 10 : 0) + (!hasHuman ? 10 : 0);
    }

    return {
      passed: errors.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
    };
  }

  /**
   * Validate data quality using AI
   */
  async validateDataQuality(report) {
    const errors = [];
    const warnings = [];
    const missingData = [];
    let score = 100;

    try {
      // Sample sections for AI validation
      const sections = report.content?.sections || [];
      const sampleSections = sections.slice(0, 3); // Validate first 3 sections

      for (const section of sampleSections) {
        const prompt = `Analyze this ESG report section for data quality issues.

Section: ${section.title}
Content: ${section.content.substring(0, 1000)}

Identify:
1. Vague or unsubstantiated claims
2. Missing specific metrics or data points
3. Inconsistencies or contradictions
4. Lack of evidence or sources

Respond in JSON format:
{
  "issues": [
    {"type": "vague_claim", "description": "...", "severity": "low|medium|high"}
  ],
  "missingMetrics": ["..."],
  "score": 0-100
}`;

        const response = await this.llm.invoke(prompt);
        let content = response.content;

        // Extract JSON
        if (content.includes('```json')) {
          content = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          content = content.split('```')[1].split('```')[0].trim();
        }

        const analysis = JSON.parse(content);

        // Process issues
        if (analysis.issues) {
          analysis.issues.forEach(issue => {
            if (issue.severity === 'high') {
              errors.push(`${section.title}: ${issue.description}`);
              score -= 10;
            } else if (issue.severity === 'medium') {
              warnings.push(`${section.title}: ${issue.description}`);
              score -= 5;
            } else {
              warnings.push(`${section.title}: ${issue.description}`);
              score -= 2;
            }
          });
        }

        // Process missing metrics
        if (analysis.missingMetrics) {
          analysis.missingMetrics.forEach(metric => {
            missingData.push(`${section.title}: Missing ${metric}`);
            score -= 3;
          });
        }
      }
    } catch (error) {
      console.warn(`      ⚠️  AI data quality check failed:`, error.message);
      warnings.push('AI-powered data quality check unavailable');
      score -= 10;
    }

    return {
      passed: errors.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
      missingData,
    };
  }

  /**
   * Validate metadata
   */
  validateMetadata(report, companyInfo) {
    const errors = [];
    const warnings = [];
    let score = 100;

    const metadata = report.content?.metadata;

    if (!metadata) {
      errors.push('Missing report metadata');
      return { passed: false, score: 0, errors, warnings };
    }

    // Required metadata fields
    if (!metadata.title) {
      errors.push('Missing report title');
      score -= 20;
    }

    if (!metadata.company) {
      errors.push('Missing company name in metadata');
      score -= 15;
    } else if (metadata.company !== companyInfo.name) {
      warnings.push('Company name mismatch between metadata and company info');
      score -= 5;
    }

    if (!metadata.reportingPeriod) {
      warnings.push('Missing reporting period');
      score -= 10;
    }

    if (!metadata.generatedDate) {
      warnings.push('Missing generation date');
      score -= 5;
    }

    if (!metadata.template) {
      warnings.push('Missing framework template specification');
      score -= 10;
    }

    return {
      passed: errors.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
    };
  }

  /**
   * Calculate overall validation score
   */
  calculateValidationScore(structure, completeness, framework, dataQuality, metadata) {
    // Weighted average
    const weights = {
      structure: 0.25,
      completeness: 0.30,
      framework: 0.20,
      dataQuality: 0.15,
      metadata: 0.10,
    };

    const score = Math.round(
      structure.score * weights.structure +
      completeness.score * weights.completeness +
      framework.score * weights.framework +
      dataQuality.score * weights.dataQuality +
      metadata.score * weights.metadata
    );

    return Math.max(0, Math.min(100, score));
  }
}

module.exports = ReportValidatorAgent;
