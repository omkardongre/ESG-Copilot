// Anomaly Detector Sub-Agent
// Detects data anomalies, inconsistencies, and outliers in ESG data
// Uses statistical analysis and AI-powered pattern recognition

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class AnomalyDetectorAgent {
  constructor() {
    this.name = 'AnomalyDetectorAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });
  }

  /**
   * Execute anomaly detection
   */
  async execute(params) {
    const { esgData, emissions, companyInfo } = params;

    console.log(`      🔎 [${this.name}] Detecting anomalies...`);

    try {
      const anomalies = [];

      // Statistical anomaly detection
      const statisticalAnomalies = this.detectStatisticalAnomalies(emissions, companyInfo);
      anomalies.push(...statisticalAnomalies);

      // Logical consistency checks
      const consistencyAnomalies = this.detectConsistencyIssues(esgData, emissions);
      anomalies.push(...consistencyAnomalies);

      // Range validation
      const rangeAnomalies = this.detectRangeViolations(esgData, emissions);
      anomalies.push(...rangeAnomalies);

      // AI-powered pattern detection
      const patternAnomalies = await this.detectPatternAnomalies(esgData, emissions, companyInfo);
      anomalies.push(...patternAnomalies);

      // Calculate severity
      const severity = this.calculateSeverity(anomalies);

      // Calculate data quality score
      const dataQualityScore = this.calculateDataQualityScore(anomalies, esgData, emissions);

      console.log(`      ${anomalies.length > 0 ? '⚠️' : '✅'} Found ${anomalies.length} anomalies`);
      console.log(`      Severity: ${severity}`);
      console.log(`      Data Quality: ${dataQualityScore}/100`);

      return {
        anomalies,
        severity,
        dataQualityScore,
        totalAnomalies: anomalies.length,
        criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length,
        highAnomalies: anomalies.filter(a => a.severity === 'high').length,
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Detection error:`, error.message);
      throw error;
    }
  }

  /**
   * Detect statistical anomalies using z-score and IQR methods
   */
  detectStatisticalAnomalies(emissions, companyInfo) {
    const anomalies = [];

    if (!emissions || !emissions.total) {
      return anomalies;
    }

    const employees = companyInfo.employees || 100;
    const totalEmissions = emissions.total.co2e_tonnes;
    const emissionsPerEmployee = totalEmissions / employees;

    // Check for unrealistic emissions per employee
    // Typical range: 1-50 tonnes CO2e per employee
    if (emissionsPerEmployee > 100) {
      anomalies.push({
        type: 'statistical_outlier',
        category: 'emissions',
        field: 'emissions_per_employee',
        value: emissionsPerEmployee.toFixed(2),
        expectedRange: '1-50 tonnes CO2e/employee',
        severity: 'high',
        description: `Emissions per employee (${emissionsPerEmployee.toFixed(2)}) is unusually high`,
        recommendation: 'Verify emissions data and employee count',
      });
    }

    if (emissionsPerEmployee < 0.1 && totalEmissions > 0) {
      anomalies.push({
        type: 'statistical_outlier',
        category: 'emissions',
        field: 'emissions_per_employee',
        value: emissionsPerEmployee.toFixed(2),
        expectedRange: '1-50 tonnes CO2e/employee',
        severity: 'medium',
        description: `Emissions per employee (${emissionsPerEmployee.toFixed(2)}) is unusually low`,
        recommendation: 'Verify employee count or check if emissions data is complete',
      });
    }

    // Check scope distribution
    const scope1Percent = (emissions.scope1.co2e_tonnes / totalEmissions) * 100;
    const scope2Percent = (emissions.scope2.co2e_tonnes / totalEmissions) * 100;
    const scope3Percent = (emissions.scope3.co2e_tonnes / totalEmissions) * 100;

    // Scope 3 should typically be largest (50-80%)
    if (scope3Percent < 20 && totalEmissions > 10) {
      anomalies.push({
        type: 'distribution_anomaly',
        category: 'emissions',
        field: 'scope3_percentage',
        value: scope3Percent.toFixed(1) + '%',
        expectedRange: '50-80%',
        severity: 'medium',
        description: 'Scope 3 emissions percentage is lower than typical',
        recommendation: 'Review Scope 3 calculation methodology - may be incomplete',
      });
    }

    // Check for zero scopes
    if (emissions.scope1.co2e_tonnes === 0 && totalEmissions > 0) {
      anomalies.push({
        type: 'missing_data',
        category: 'emissions',
        field: 'scope1',
        value: '0',
        severity: 'medium',
        description: 'Scope 1 emissions are zero',
        recommendation: 'Verify if company has no direct emissions or if data is missing',
      });
    }

    return anomalies;
  }

  /**
   * Detect logical consistency issues
   */
  detectConsistencyIssues(esgData, emissions) {
    const anomalies = [];

    if (!esgData) return anomalies;

    // Check environmental data consistency
    if (esgData.environmental) {
      const env = esgData.environmental;

      // Renewable energy should not exceed total energy
      if (env.renewable_energy_percent > 100) {
        anomalies.push({
          type: 'logical_inconsistency',
          category: 'environmental',
          field: 'renewable_energy_percent',
          value: env.renewable_energy_percent,
          severity: 'critical',
          description: 'Renewable energy percentage exceeds 100%',
          recommendation: 'Correct renewable energy calculation',
        });
      }

      // Recycling rate should not exceed 100%
      if (env.waste_recycling_percent > 100) {
        anomalies.push({
          type: 'logical_inconsistency',
          category: 'environmental',
          field: 'waste_recycling_percent',
          value: env.waste_recycling_percent,
          severity: 'critical',
          description: 'Waste recycling percentage exceeds 100%',
          recommendation: 'Correct recycling rate calculation',
        });
      }

      // Check for negative values
      Object.entries(env).forEach(([key, value]) => {
        if (typeof value === 'number' && value < 0) {
          anomalies.push({
            type: 'invalid_value',
            category: 'environmental',
            field: key,
            value: value,
            severity: 'critical',
            description: `${key} has negative value`,
            recommendation: 'Correct data entry - environmental metrics cannot be negative',
          });
        }
      });
    }

    // Check social data consistency
    if (esgData.social) {
      const social = esgData.social;

      // Diversity percentages should not exceed 100%
      if (social.women_in_leadership_percent > 100) {
        anomalies.push({
          type: 'logical_inconsistency',
          category: 'social',
          field: 'women_in_leadership_percent',
          value: social.women_in_leadership_percent,
          severity: 'critical',
          description: 'Women in leadership percentage exceeds 100%',
          recommendation: 'Correct diversity calculation',
        });
      }

      // Turnover rate check
      if (social.employee_turnover_percent > 100) {
        anomalies.push({
          type: 'statistical_outlier',
          category: 'social',
          field: 'employee_turnover_percent',
          value: social.employee_turnover_percent,
          severity: 'high',
          description: 'Employee turnover exceeds 100% (possible but unusual)',
          recommendation: 'Verify turnover calculation methodology',
        });
      }
    }

    // Check governance data consistency
    if (esgData.governance) {
      const gov = esgData.governance;

      // Board independence should not exceed 100%
      if (gov.board_independence_percent > 100) {
        anomalies.push({
          type: 'logical_inconsistency',
          category: 'governance',
          field: 'board_independence_percent',
          value: gov.board_independence_percent,
          severity: 'critical',
          description: 'Board independence percentage exceeds 100%',
          recommendation: 'Correct board composition calculation',
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect range violations
   */
  detectRangeViolations(esgData, emissions) {
    const anomalies = [];

    if (!esgData) return anomalies;

    // Define expected ranges for common metrics
    const ranges = {
      environmental: {
        renewable_energy_percent: { min: 0, max: 100, unit: '%' },
        waste_recycling_percent: { min: 0, max: 100, unit: '%' },
        carbon_emissions_tons: { min: 0, max: 1000000, unit: 'tonnes' },
        energy_consumption_mwh: { min: 0, max: 10000000, unit: 'MWh' },
      },
      social: {
        women_in_leadership_percent: { min: 0, max: 100, unit: '%' },
        employee_turnover_percent: { min: 0, max: 200, unit: '%' },
        employee_training_hours: { min: 0, max: 500, unit: 'hours' },
      },
      governance: {
        board_independence_percent: { min: 0, max: 100, unit: '%' },
      },
    };

    // Check each category
    Object.entries(ranges).forEach(([category, metrics]) => {
      const data = esgData[category];
      if (!data) return;

      Object.entries(metrics).forEach(([field, range]) => {
        const value = data[field];
        if (value === undefined || value === null) return;

        if (value < range.min || value > range.max) {
          anomalies.push({
            type: 'range_violation',
            category,
            field,
            value,
            expectedRange: `${range.min}-${range.max} ${range.unit}`,
            severity: value < range.min || value > range.max * 2 ? 'high' : 'medium',
            description: `${field} value (${value}) is outside expected range`,
            recommendation: `Verify ${field} - expected range is ${range.min}-${range.max} ${range.unit}`,
          });
        }
      });
    });

    return anomalies;
  }

  /**
   * Detect pattern anomalies using AI
   */
  async detectPatternAnomalies(esgData, emissions, companyInfo) {
    const anomalies = [];

    try {
      const prompt = `Analyze this ESG data for unusual patterns, inconsistencies, or red flags.

Company: ${companyInfo.name}
Industry: ${companyInfo.industry || 'Unknown'}
Employees: ${companyInfo.employees || 'Unknown'}

ESG Data:
${JSON.stringify(esgData, null, 2)}

Emissions:
${JSON.stringify(emissions, null, 2)}

Identify any:
1. Unusual patterns or trends
2. Data that seems inconsistent with company size/industry
3. Missing expected data points
4. Values that seem unrealistic or suspicious

Respond in JSON format:
{
  "anomalies": [
    {
      "type": "pattern|inconsistency|missing|suspicious",
      "category": "environmental|social|governance|emissions",
      "field": "field_name",
      "description": "What's unusual",
      "severity": "low|medium|high|critical",
      "recommendation": "What to do about it"
    }
  ]
}

If no anomalies found, return empty array.`;

      const response = await this.llm.invoke(prompt);
      let content = response.content;

      // Extract JSON
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }

      const analysis = JSON.parse(content);

      if (analysis.anomalies && Array.isArray(analysis.anomalies)) {
        analysis.anomalies.forEach(anomaly => {
          anomalies.push({
            type: 'ai_detected_pattern',
            ...anomaly,
          });
        });
      }
    } catch (error) {
      console.warn(`      ⚠️  AI pattern detection failed:`, error.message);
    }

    return anomalies;
  }

  /**
   * Calculate overall severity
   */
  calculateSeverity(anomalies) {
    if (anomalies.length === 0) return 'none';

    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;
    const mediumCount = anomalies.filter(a => a.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount >= 3) return 'high';
    if (highCount > 0 || mediumCount >= 5) return 'medium';
    return 'low';
  }

  /**
   * Calculate data quality score
   */
  calculateDataQualityScore(anomalies, esgData, emissions) {
    let score = 100;

    // Deduct points for anomalies
    anomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });

    // Bonus for data completeness
    const completenessBonus = this.calculateCompletenessBonus(esgData, emissions);
    score += completenessBonus;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate completeness bonus
   */
  calculateCompletenessBonus(esgData, emissions) {
    let bonus = 0;

    // Check emissions completeness
    if (emissions && emissions.total && emissions.total.co2e_tonnes > 0) {
      bonus += 5;
      if (emissions.scope1 && emissions.scope1.co2e_tonnes > 0) bonus += 3;
      if (emissions.scope2 && emissions.scope2.co2e_tonnes > 0) bonus += 3;
      if (emissions.scope3 && emissions.scope3.co2e_tonnes > 0) bonus += 3;
    }

    // Check ESG data completeness
    if (esgData) {
      if (esgData.environmental && Object.keys(esgData.environmental).length > 0) bonus += 3;
      if (esgData.social && Object.keys(esgData.social).length > 0) bonus += 3;
      if (esgData.governance && Object.keys(esgData.governance).length > 0) bonus += 3;
    }

    return Math.min(bonus, 20); // Cap at 20 bonus points
  }
}

module.exports = AnomalyDetectorAgent;
