// Zero Knowledge Leakage Validator
// Validates that AI agent responses don't leak unauthorized information
// Implements multi-layer validation for data privacy and security

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { getInstance: getQueryEnforcer } = require('./query-authorization-enforcer');

class ZeroKnowledgeValidator {
  constructor() {
    this.name = 'ZeroKnowledgeValidator';
    
    // Initialize AI for semantic validation
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });

    this.queryEnforcer = getQueryEnforcer();
  }

  /**
   * Validate agent response for knowledge leakage
   */
  async validateResponse(response, userContext, sourceData = null) {
    console.log(`🔒 [ZeroKnowledge] Validating response for user ${userContext.userId}`);

    try {
      const validationResults = {
        passed: true,
        violations: [],
        redactions: [],
        confidence: 100,
      };

      // Layer 1: Pattern-based validation
      const patternViolations = this.validatePatterns(response, userContext);
      if (patternViolations.length > 0) {
        validationResults.violations.push(...patternViolations);
        validationResults.passed = false;
      }

      // Layer 2: Entity-based validation
      const entityViolations = await this.validateEntities(response, userContext);
      if (entityViolations.length > 0) {
        validationResults.violations.push(...entityViolations);
        validationResults.passed = false;
      }

      // Layer 3: Semantic validation (AI-powered)
      const semanticViolations = await this.validateSemantic(response, userContext, sourceData);
      if (semanticViolations.length > 0) {
        validationResults.violations.push(...semanticViolations);
        validationResults.passed = false;
      }

      // Layer 4: Cross-company data leakage
      const crossCompanyViolations = this.validateCrossCompanyLeakage(response, userContext);
      if (crossCompanyViolations.length > 0) {
        validationResults.violations.push(...crossCompanyViolations);
        validationResults.passed = false;
      }

      // Layer 5: PII and sensitive data detection
      const piiViolations = this.validatePII(response, userContext);
      if (piiViolations.length > 0) {
        validationResults.violations.push(...piiViolations);
        validationResults.passed = false;
      }

      // Calculate confidence score
      validationResults.confidence = this.calculateConfidence(validationResults.violations);

      if (!validationResults.passed) {
        console.warn(`⚠️  [ZeroKnowledge] Validation failed: ${validationResults.violations.length} violations`);
      } else {
        console.log(`✅ [ZeroKnowledge] Validation passed`);
      }

      return validationResults;
    } catch (error) {
      console.error(`❌ [ZeroKnowledge] Validation error:`, error.message);
      throw error;
    }
  }

  /**
   * Layer 1: Pattern-based validation
   */
  validatePatterns(response, userContext) {
    const violations = [];

    // Check for API keys or tokens
    const apiKeyPattern = /[A-Za-z0-9]{32,}/g;
    const apiKeyMatches = response.match(apiKeyPattern);
    if (apiKeyMatches) {
      violations.push({
        type: 'api_key_exposure',
        severity: 'critical',
        description: 'Potential API key or token detected in response',
        matches: apiKeyMatches.length,
      });
    }

    // Check for email addresses (except user's own)
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = response.match(emailPattern);
    if (emailMatches) {
      const unauthorizedEmails = emailMatches.filter(email => 
        email.toLowerCase() !== userContext.email?.toLowerCase()
      );
      if (unauthorizedEmails.length > 0) {
        violations.push({
          type: 'email_exposure',
          severity: 'high',
          description: 'Unauthorized email addresses detected',
          count: unauthorizedEmails.length,
        });
      }
    }

    // Check for phone numbers
    const phonePattern = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
    const phoneMatches = response.match(phonePattern);
    if (phoneMatches) {
      violations.push({
        type: 'phone_exposure',
        severity: 'high',
        description: 'Phone numbers detected in response',
        count: phoneMatches.length,
      });
    }

    // Check for credit card numbers
    const ccPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
    const ccMatches = response.match(ccPattern);
    if (ccMatches) {
      violations.push({
        type: 'credit_card_exposure',
        severity: 'critical',
        description: 'Potential credit card numbers detected',
        count: ccMatches.length,
      });
    }

    // Check for SSN or similar identifiers
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssnMatches = response.match(ssnPattern);
    if (ssnMatches) {
      violations.push({
        type: 'ssn_exposure',
        severity: 'critical',
        description: 'Potential SSN or similar identifiers detected',
        count: ssnMatches.length,
      });
    }

    return violations;
  }

  /**
   * Layer 2: Entity-based validation
   */
  async validateEntities(response, userContext) {
    const violations = [];

    // Extract company names
    const companyPattern = /\b[A-Z][a-zA-Z0-9\s&,\.]{2,50}(?:Inc|LLC|Ltd|Corp|Corporation|Company)\b/g;
    const companyMatches = response.match(companyPattern);

    if (companyMatches) {
      // Check if mentioned companies are authorized
      const unauthorizedCompanies = companyMatches.filter(company => {
        // User should only see their own company's data
        return !company.toLowerCase().includes(userContext.companyName?.toLowerCase() || '');
      });

      if (unauthorizedCompanies.length > 0) {
        violations.push({
          type: 'unauthorized_company_mention',
          severity: 'high',
          description: 'Response mentions companies user should not have access to',
          entities: unauthorizedCompanies,
        });
      }
    }

    // Check for employee names (if not authorized)
    if (!userContext.roles.includes('admin') && !userContext.roles.includes('hr_manager')) {
      const namePattern = /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g;
      const nameMatches = response.match(namePattern);
      
      if (nameMatches && nameMatches.length > 3) {
        violations.push({
          type: 'employee_name_exposure',
          severity: 'medium',
          description: 'Multiple employee names detected without authorization',
          count: nameMatches.length,
        });
      }
    }

    return violations;
  }

  /**
   * Layer 3: Semantic validation using AI
   */
  async validateSemantic(response, userContext, sourceData) {
    try {
      const prompt = `You are a security validator. Analyze this AI response for potential data leakage.

User Context:
- Company: ${userContext.companyName || 'Unknown'}
- Roles: ${userContext.roles.join(', ')}
- Department: ${userContext.department || 'Unknown'}

AI Response:
${response}

Check for:
1. Information about other companies
2. Confidential financial data not authorized for this user
3. Personal information of other employees
4. Internal system details or credentials
5. Data that seems outside user's scope

Respond in JSON format:
{
  "violations": [
    {
      "type": "semantic_leakage",
      "severity": "high|medium|low",
      "description": "What leaked and why it's a problem",
      "excerpt": "Relevant excerpt from response"
    }
  ],
  "safe": true/false
}

If no violations, return {"violations": [], "safe": true}`;

      const aiResponse = await this.llm.invoke(prompt);
      let content = aiResponse.content;

      // Extract JSON
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }

      const analysis = JSON.parse(content);

      return analysis.violations || [];
    } catch (error) {
      console.warn(`⚠️  [ZeroKnowledge] Semantic validation failed:`, error.message);
      return [];
    }
  }

  /**
   * Layer 4: Cross-company data leakage validation
   */
  validateCrossCompanyLeakage(response, userContext) {
    const violations = [];

    // Check for company IDs that don't match user's company
    const companyIdPattern = /company[_-]?id[:\s]+['"]?([a-zA-Z0-9-]+)['"]?/gi;
    const matches = [...response.matchAll(companyIdPattern)];

    for (const match of matches) {
      const companyId = match[1];
      if (companyId !== userContext.companyId) {
        violations.push({
          type: 'cross_company_leakage',
          severity: 'critical',
          description: 'Response contains data from unauthorized company',
          unauthorizedCompanyId: companyId,
        });
      }
    }

    return violations;
  }

  /**
   * Layer 5: PII and sensitive data detection
   */
  validatePII(response, userContext) {
    const violations = [];

    // Check for salary information
    const salaryPattern = /\$\d{2,3},?\d{3,}/g;
    const salaryMatches = response.match(salaryPattern);
    if (salaryMatches && !userContext.roles.includes('admin') && !userContext.roles.includes('hr_manager')) {
      violations.push({
        type: 'salary_exposure',
        severity: 'high',
        description: 'Salary information detected without authorization',
        count: salaryMatches.length,
      });
    }

    // Check for addresses
    const addressPattern = /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)/gi;
    const addressMatches = response.match(addressPattern);
    if (addressMatches) {
      violations.push({
        type: 'address_exposure',
        severity: 'medium',
        description: 'Physical addresses detected',
        count: addressMatches.length,
      });
    }

    // Check for dates of birth
    const dobPattern = /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g;
    const dobMatches = response.match(dobPattern);
    if (dobMatches) {
      violations.push({
        type: 'dob_exposure',
        severity: 'high',
        description: 'Dates of birth detected',
        count: dobMatches.length,
      });
    }

    return violations;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(violations) {
    if (violations.length === 0) return 100;

    let score = 100;

    violations.forEach(violation => {
      switch (violation.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Redact violations from response
   */
  redactViolations(response, violations) {
    let redactedResponse = response;
    const redactions = [];

    violations.forEach(violation => {
      switch (violation.type) {
        case 'api_key_exposure':
          redactedResponse = redactedResponse.replace(/[A-Za-z0-9]{32,}/g, '[REDACTED_API_KEY]');
          redactions.push({ type: 'api_key', count: violation.matches });
          break;

        case 'email_exposure':
          redactedResponse = redactedResponse.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            '[REDACTED_EMAIL]'
          );
          redactions.push({ type: 'email', count: violation.count });
          break;

        case 'phone_exposure':
          redactedResponse = redactedResponse.replace(
            /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g,
            '[REDACTED_PHONE]'
          );
          redactions.push({ type: 'phone', count: violation.count });
          break;

        case 'credit_card_exposure':
          redactedResponse = redactedResponse.replace(
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
            '[REDACTED_CC]'
          );
          redactions.push({ type: 'credit_card', count: violation.count });
          break;

        case 'ssn_exposure':
          redactedResponse = redactedResponse.replace(
            /\b\d{3}-\d{2}-\d{4}\b/g,
            '[REDACTED_SSN]'
          );
          redactions.push({ type: 'ssn', count: violation.count });
          break;

        case 'salary_exposure':
          redactedResponse = redactedResponse.replace(
            /\$\d{2,3},?\d{3,}/g,
            '[REDACTED_SALARY]'
          );
          redactions.push({ type: 'salary', count: violation.count });
          break;
      }
    });

    return { redactedResponse, redactions };
  }

  /**
   * Validate and sanitize response
   */
  async validateAndSanitize(response, userContext, sourceData = null) {
    console.log(`🔒 [ZeroKnowledge] Validating and sanitizing response...`);

    try {
      // Validate response
      const validationResults = await this.validateResponse(response, userContext, sourceData);

      // If violations found, redact them
      if (!validationResults.passed) {
        const { redactedResponse, redactions } = this.redactViolations(
          response,
          validationResults.violations
        );

        console.log(`🔒 [ZeroKnowledge] Applied ${redactions.length} redactions`);

        return {
          response: redactedResponse,
          original: response,
          validationResults,
          redactions,
          sanitized: true,
        };
      }

      return {
        response,
        validationResults,
        sanitized: false,
      };
    } catch (error) {
      console.error(`❌ [ZeroKnowledge] Validation and sanitization failed:`, error.message);
      throw error;
    }
  }

  /**
   * Audit validation results
   */
  async auditValidation(validationResults, userContext) {
    try {
      console.log(`📊 [ZeroKnowledge] Auditing validation results...`);

      // In production: Store in BigQuery or audit log service
      const auditLog = {
        userId: userContext.userId,
        timestamp: new Date().toISOString(),
        passed: validationResults.passed,
        violationCount: validationResults.violations.length,
        confidence: validationResults.confidence,
        violations: validationResults.violations,
      };

      console.log(`   Violations: ${auditLog.violationCount}`);
      console.log(`   Confidence: ${auditLog.confidence}%`);

      // Log critical violations
      const criticalViolations = validationResults.violations.filter(v => v.severity === 'critical');
      if (criticalViolations.length > 0) {
        console.error(`🚨 [ZeroKnowledge] CRITICAL: ${criticalViolations.length} critical violations detected`);
      }
    } catch (error) {
      console.warn(`⚠️  [ZeroKnowledge] Failed to audit validation:`, error.message);
    }
  }

  /**
   * Generate validation report
   */
  generateReport(validationResults) {
    const report = {
      summary: {
        passed: validationResults.passed,
        confidence: validationResults.confidence,
        totalViolations: validationResults.violations.length,
      },
      violationsByType: {},
      violationsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      recommendations: [],
    };

    // Group violations
    validationResults.violations.forEach(violation => {
      // By type
      if (!report.violationsByType[violation.type]) {
        report.violationsByType[violation.type] = 0;
      }
      report.violationsByType[violation.type]++;

      // By severity
      report.violationsBySeverity[violation.severity]++;
    });

    // Generate recommendations
    if (report.violationsBySeverity.critical > 0) {
      report.recommendations.push('Immediate action required: Critical data leakage detected');
    }
    if (report.violationsBySeverity.high > 0) {
      report.recommendations.push('Review and enhance data access controls');
    }
    if (report.summary.confidence < 70) {
      report.recommendations.push('Consider additional validation layers');
    }

    return report;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  ZeroKnowledgeValidator,
  getInstance: () => {
    if (!instance) {
      instance = new ZeroKnowledgeValidator();
    }
    return instance;
  },
};
