// Feedback Generator Sub-Agent
// Generates actionable feedback for report improvement
// Synthesizes insights from validation, benchmarks, and anomalies

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class FeedbackGeneratorAgent {
  constructor() {
    this.name = 'FeedbackGeneratorAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3,
    });
  }

  /**
   * Execute feedback generation
   */
  async execute(params) {
    const { validationResults, anomalyResults, benchmarkResults, report } = params;

    console.log(`      💡 [${this.name}] Generating feedback...`);

    try {
      const feedback = [];

      // Generate feedback from validation issues
      const validationFeedback = this.generateValidationFeedback(validationResults);
      feedback.push(...validationFeedback);

      // Generate feedback from anomalies
      const anomalyFeedback = this.generateAnomalyFeedback(anomalyResults);
      feedback.push(...anomalyFeedback);

      // Generate feedback from benchmark comparisons
      const benchmarkFeedback = this.generateBenchmarkFeedback(benchmarkResults);
      feedback.push(...benchmarkFeedback);

      // Generate AI-powered strategic feedback
      const strategicFeedback = await this.generateStrategicFeedback(
        validationResults,
        anomalyResults,
        benchmarkResults,
        report
      );
      feedback.push(...strategicFeedback);

      // Prioritize and deduplicate feedback
      const prioritizedFeedback = this.prioritizeFeedback(feedback);

      console.log(`      ✅ Generated ${prioritizedFeedback.length} feedback items`);

      return prioritizedFeedback;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Feedback generation error:`, error.message);
      throw error;
    }
  }

  /**
   * Generate feedback from validation results
   */
  generateValidationFeedback(validationResults) {
    const feedback = [];

    if (!validationResults) return feedback;

    // Process errors
    validationResults.errors?.forEach(error => {
      feedback.push({
        id: `validation_error_${Date.now()}_${Math.random()}`,
        type: 'validation',
        priority: 'critical',
        category: 'Structure',
        issue: error,
        recommendation: this.getValidationRecommendation(error),
        impact: 'Report may not meet compliance standards',
        effort: 'medium',
        suggestedFix: this.getSuggestedFix(error),
      });
    });

    // Process warnings
    validationResults.warnings?.forEach(warning => {
      feedback.push({
        id: `validation_warning_${Date.now()}_${Math.random()}`,
        type: 'validation',
        priority: 'medium',
        category: 'Completeness',
        issue: warning,
        recommendation: this.getValidationRecommendation(warning),
        impact: 'Report quality may be reduced',
        effort: 'low',
        suggestedFix: this.getSuggestedFix(warning),
      });
    });

    // Process missing data
    validationResults.missingData?.forEach(missing => {
      feedback.push({
        id: `validation_missing_${Date.now()}_${Math.random()}`,
        type: 'validation',
        priority: 'high',
        category: 'Data Completeness',
        issue: missing,
        recommendation: 'Add missing data or section to improve report completeness',
        impact: 'Incomplete reporting may affect stakeholder trust',
        effort: 'medium',
        suggestedFix: `Collect and add: ${missing}`,
      });
    });

    return feedback;
  }

  /**
   * Generate feedback from anomalies
   */
  generateAnomalyFeedback(anomalyResults) {
    const feedback = [];

    if (!anomalyResults || !anomalyResults.anomalies) return feedback;

    anomalyResults.anomalies.forEach(anomaly => {
      feedback.push({
        id: `anomaly_${Date.now()}_${Math.random()}`,
        type: 'anomaly',
        priority: this.mapSeverityToPriority(anomaly.severity),
        category: this.capitalizeCategory(anomaly.category),
        issue: anomaly.description,
        recommendation: anomaly.recommendation || 'Review and correct data',
        impact: this.getAnomalyImpact(anomaly.severity),
        effort: anomaly.severity === 'critical' ? 'high' : 'medium',
        suggestedFix: this.getAnomalySuggestedFix(anomaly),
        metadata: {
          field: anomaly.field,
          value: anomaly.value,
          expectedRange: anomaly.expectedRange,
        },
      });
    });

    return feedback;
  }

  /**
   * Generate feedback from benchmark comparisons
   */
  generateBenchmarkFeedback(benchmarkResults) {
    const feedback = [];

    if (!benchmarkResults || !benchmarkResults.comparisons) return feedback;

    benchmarkResults.comparisons.forEach(comparison => {
      // Only provide feedback for below-average or poor performance
      if (comparison.performance === 'below_average' || comparison.performance === 'poor') {
        feedback.push({
          id: `benchmark_${Date.now()}_${Math.random()}`,
          type: 'benchmark',
          priority: comparison.performance === 'poor' ? 'high' : 'medium',
          category: comparison.category,
          issue: `${comparison.category} performance is ${comparison.performance.replace('_', ' ')} compared to industry`,
          recommendation: this.getBenchmarkRecommendation(comparison),
          impact: 'May affect competitive positioning and stakeholder perception',
          effort: 'high',
          suggestedFix: this.getBenchmarkSuggestedFix(comparison),
          metadata: {
            performance: comparison.performance,
            betterThanBenchmark: comparison.betterThanBenchmark,
          },
        });
      }

      // Highlight excellent performance as positive feedback
      if (comparison.performance === 'excellent') {
        feedback.push({
          id: `benchmark_positive_${Date.now()}_${Math.random()}`,
          type: 'benchmark',
          priority: 'low',
          category: comparison.category,
          issue: `${comparison.category} performance is excellent`,
          recommendation: 'Continue current practices and consider sharing best practices',
          impact: 'Positive - can be highlighted in stakeholder communications',
          effort: 'low',
          isPositive: true,
        });
      }
    });

    // Add insights from benchmark analysis
    if (benchmarkResults.insights) {
      benchmarkResults.insights.forEach(insight => {
        feedback.push({
          id: `benchmark_insight_${Date.now()}_${Math.random()}`,
          type: 'strategic',
          priority: insight.priority || 'medium',
          category: insight.area,
          issue: insight.finding,
          recommendation: insight.recommendation,
          impact: insight.potentialImpact,
          effort: 'medium',
        });
      });
    }

    return feedback;
  }

  /**
   * Generate AI-powered strategic feedback
   */
  async generateStrategicFeedback(validationResults, anomalyResults, benchmarkResults, report) {
    const feedback = [];

    try {
      const prompt = `As an ESG expert, provide strategic feedback for improving this ESG report.

Validation Score: ${validationResults.score}/100
Anomalies Found: ${anomalyResults.totalAnomalies}
Data Quality: ${anomalyResults.dataQualityScore}/100
Benchmark Performance: ${benchmarkResults.overallPerformance}

Report Template: ${report.content?.metadata?.template}

Provide 3-5 high-level strategic recommendations in JSON format:
{
  "feedback": [
    {
      "category": "Strategy|Communication|Data|Compliance",
      "issue": "High-level observation",
      "recommendation": "Strategic action to take",
      "priority": "high|medium|low",
      "impact": "Expected business impact",
      "effort": "low|medium|high",
      "timeline": "Suggested timeframe"
    }
  ]
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

      if (analysis.feedback && Array.isArray(analysis.feedback)) {
        analysis.feedback.forEach(item => {
          feedback.push({
            id: `strategic_${Date.now()}_${Math.random()}`,
            type: 'strategic',
            ...item,
          });
        });
      }
    } catch (error) {
      console.warn(`      ⚠️  Strategic feedback generation failed:`, error.message);
    }

    return feedback;
  }

  /**
   * Prioritize and deduplicate feedback
   */
  prioritizeFeedback(feedback) {
    // Remove duplicates based on similar issues
    const uniqueFeedback = this.deduplicateFeedback(feedback);

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    uniqueFeedback.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, sort by impact
      const impactOrder = { high: 0, medium: 1, low: 2 };
      const aImpact = typeof a.impact === 'string' && a.impact.toLowerCase().includes('high') ? 0 : 
                      typeof a.impact === 'string' && a.impact.toLowerCase().includes('medium') ? 1 : 2;
      const bImpact = typeof b.impact === 'string' && b.impact.toLowerCase().includes('high') ? 0 : 
                      typeof b.impact === 'string' && b.impact.toLowerCase().includes('medium') ? 1 : 2;
      
      return aImpact - bImpact;
    });

    return uniqueFeedback;
  }

  /**
   * Deduplicate similar feedback items
   */
  deduplicateFeedback(feedback) {
    const seen = new Set();
    const unique = [];

    feedback.forEach(item => {
      const key = `${item.category}_${item.issue}`.toLowerCase().replace(/\s+/g, '_');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });

    return unique;
  }

  /**
   * Get validation recommendation
   */
  getValidationRecommendation(issue) {
    const lowerIssue = issue.toLowerCase();

    if (lowerIssue.includes('missing')) {
      return 'Add the missing component to ensure report completeness';
    }
    if (lowerIssue.includes('content') && lowerIssue.includes('short')) {
      return 'Expand section content with more detailed information and metrics';
    }
    if (lowerIssue.includes('metadata')) {
      return 'Add required metadata fields to report header';
    }
    if (lowerIssue.includes('section')) {
      return 'Include all required sections per framework standards';
    }
    if (lowerIssue.includes('visualization') || lowerIssue.includes('chart')) {
      return 'Add data visualizations to improve report readability';
    }

    return 'Review and correct the identified issue';
  }

  /**
   * Get suggested fix for validation issues
   */
  getSuggestedFix(issue) {
    const lowerIssue = issue.toLowerCase();

    if (lowerIssue.includes('executive summary')) {
      return 'Add executive summary section with key highlights';
    }
    if (lowerIssue.includes('methodology')) {
      return 'Add methodology section explaining data collection and calculation methods';
    }
    if (lowerIssue.includes('conclusion')) {
      return 'Add conclusion section with next steps and commitments';
    }

    return null;
  }

  /**
   * Get suggested fix for anomalies
   */
  getAnomalySuggestedFix(anomaly) {
    if (anomaly.type === 'range_violation') {
      return `Verify ${anomaly.field} value - should be within ${anomaly.expectedRange}`;
    }
    if (anomaly.type === 'logical_inconsistency') {
      return `Recalculate ${anomaly.field} to ensure logical consistency`;
    }
    if (anomaly.type === 'statistical_outlier') {
      return `Review ${anomaly.field} calculation methodology`;
    }

    return anomaly.recommendation;
  }

  /**
   * Get benchmark recommendation
   */
  getBenchmarkRecommendation(comparison) {
    const category = comparison.category.toLowerCase();

    if (category.includes('emission')) {
      return 'Implement emissions reduction initiatives: energy efficiency, renewable energy, carbon offsets';
    }
    if (category.includes('environmental')) {
      return 'Increase renewable energy adoption and improve waste management practices';
    }
    if (category.includes('social')) {
      return 'Enhance diversity programs, employee training, and retention initiatives';
    }
    if (category.includes('governance')) {
      return 'Strengthen board independence and implement comprehensive governance policies';
    }

    return 'Implement improvement initiatives to reach industry average performance';
  }

  /**
   * Get benchmark suggested fix
   */
  getBenchmarkSuggestedFix(comparison) {
    if (comparison.metrics && comparison.metrics.length > 0) {
      const worstMetric = comparison.metrics.reduce((worst, current) => {
        const currentDiff = parseFloat(current.difference);
        const worstDiff = parseFloat(worst.difference);
        return (current.lowerIsBetter ? currentDiff > worstDiff : currentDiff < worstDiff) ? current : worst;
      });

      return `Focus on improving ${worstMetric.name}: currently ${worstMetric.companyValue}${worstMetric.unit}, benchmark is ${worstMetric.benchmarkValue}${worstMetric.unit}`;
    }

    return null;
  }

  /**
   * Map severity to priority
   */
  mapSeverityToPriority(severity) {
    const map = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    return map[severity] || 'medium';
  }

  /**
   * Capitalize category
   */
  capitalizeCategory(category) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Get anomaly impact description
   */
  getAnomalyImpact(severity) {
    const impacts = {
      critical: 'Critical - May invalidate report or cause compliance issues',
      high: 'High - Significantly affects data credibility',
      medium: 'Medium - May raise questions from stakeholders',
      low: 'Low - Minor data quality concern',
    };
    return impacts[severity] || 'Unknown impact';
  }
}

module.exports = FeedbackGeneratorAgent;
