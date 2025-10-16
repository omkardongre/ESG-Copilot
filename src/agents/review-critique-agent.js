// Review & Critique Agent
// Validates ESG reports, detects anomalies, compares against benchmarks
// Provides actionable feedback for iterative refinement

const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');
const ReportValidatorAgent = require('./sub-agents/report-validator-agent');
const BenchmarkComparatorAgent = require('./sub-agents/benchmark-comparator-agent');
const AnomalyDetectorAgent = require('./sub-agents/anomaly-detector-agent');
const FeedbackGeneratorAgent = require('./sub-agents/feedback-generator-agent');

class ReviewCritiqueAgent {
  constructor() {
    this.name = 'ReviewCritiqueAgent';
    this.maxIterations = 3; // Maximum refinement iterations
  }

  /**
   * Main execution - Multi-stage review and critique
   */
  async execute(state) {
    console.log(`\n🔍 [${this.name}] Starting report review and critique...`);

    const startTime = Date.now();
    const { report, companyInfo, esgData, emissions } = state;

    if (!report || !report.content) {
      throw new Error('No report available for review');
    }

    try {
      // Stage 1: Validate report structure and completeness
      console.log(`   📋 Stage 1: Validating report structure...`);
      const validationResults = await this.validateReport(report, companyInfo);

      // Stage 2: Detect data anomalies and inconsistencies
      console.log(`   🔎 Stage 2: Detecting anomalies...`);
      const anomalyResults = await this.detectAnomalies(esgData, emissions, companyInfo);

      // Stage 3: Compare against industry benchmarks
      console.log(`   📊 Stage 3: Comparing against benchmarks...`);
      const benchmarkResults = await this.compareBenchmarks(esgData, emissions, companyInfo);

      // Stage 4: Generate comprehensive feedback
      console.log(`   💡 Stage 4: Generating feedback...`);
      const feedback = await this.generateFeedback(
        validationResults,
        anomalyResults,
        benchmarkResults,
        report
      );

      // Stage 5: Calculate overall quality score
      const qualityScore = this.calculateQualityScore(
        validationResults,
        anomalyResults,
        benchmarkResults
      );

      // Compile review results
      const reviewResults = {
        validation: validationResults,
        anomalies: anomalyResults,
        benchmarks: benchmarkResults,
        feedback: feedback,
        qualityScore: qualityScore,
        reviewedAt: new Date().toISOString(),
        needsRefinement: qualityScore.overall < 70,
      };

      // Log the action
      const duration = Date.now() - startTime;
      await agentLogger.logAction(
        this.name,
        state.userId,
        'review_report',
        { companyInfo, qualityScore: qualityScore.overall },
        { reviewResults },
        'success',
        null,
        duration
      );

      // Broadcast results
      await messageQueue.publishMessage(
        this.name,
        'OrchestratorAgent',
        'review_completed',
        { reviewResults },
        state.taskId
      );

      console.log(`✅ [${this.name}] Review complete`);
      console.log(`   Quality Score: ${qualityScore.overall}/100`);
      console.log(`   Validation: ${validationResults.score}/100`);
      console.log(`   Anomalies Found: ${anomalyResults.anomalies.length}`);
      console.log(`   Benchmark Performance: ${benchmarkResults.overallPerformance}`);
      console.log(`   Feedback Items: ${feedback.length}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

      return {
        ...state,
        review: reviewResults,
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Report reviewed - Quality Score: ${qualityScore.overall}/100. ${feedback.length} feedback items generated.`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);

      await agentLogger.logAction(
        this.name,
        state.userId,
        'review_report',
        { companyInfo },
        null,
        'error',
        error
      );

      return {
        ...state,
        errors: [...state.errors, { agent: this.name, error: error.message }],
      };
    }
  }

  /**
   * Validate report structure and completeness
   */
  async validateReport(report, companyInfo) {
    const validator = new ReportValidatorAgent();
    
    try {
      const results = await validator.execute({
        report,
        companyInfo,
      });

      return results;
    } catch (error) {
      console.error(`   ❌ Validation failed:`, error.message);
      return {
        isValid: false,
        score: 0,
        errors: [error.message],
        warnings: [],
        missingData: [],
      };
    }
  }

  /**
   * Detect anomalies and inconsistencies in data
   */
  async detectAnomalies(esgData, emissions, companyInfo) {
    const detector = new AnomalyDetectorAgent();

    try {
      const results = await detector.execute({
        esgData,
        emissions,
        companyInfo,
      });

      return results;
    } catch (error) {
      console.error(`   ❌ Anomaly detection failed:`, error.message);
      return {
        anomalies: [],
        severity: 'unknown',
        dataQualityScore: 50,
      };
    }
  }

  /**
   * Compare against industry benchmarks
   */
  async compareBenchmarks(esgData, emissions, companyInfo) {
    const comparator = new BenchmarkComparatorAgent();

    try {
      const results = await comparator.execute({
        esgData,
        emissions,
        companyInfo,
      });

      return results;
    } catch (error) {
      console.error(`   ❌ Benchmark comparison failed:`, error.message);
      return {
        comparisons: [],
        overallPerformance: 'unknown',
        industryRank: null,
      };
    }
  }

  /**
   * Generate comprehensive feedback
   */
  async generateFeedback(validationResults, anomalyResults, benchmarkResults, report) {
    const generator = new FeedbackGeneratorAgent();

    try {
      const feedback = await generator.execute({
        validationResults,
        anomalyResults,
        benchmarkResults,
        report,
      });

      return feedback;
    } catch (error) {
      console.error(`   ❌ Feedback generation failed:`, error.message);
      return [];
    }
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(validationResults, anomalyResults, benchmarkResults) {
    // Validation score (40% weight)
    const validationScore = validationResults.score || 0;

    // Data quality score (30% weight) - inverse of anomalies
    const dataQualityScore = anomalyResults.dataQualityScore || 50;

    // Benchmark performance score (30% weight)
    const benchmarkScore = this.getBenchmarkScore(benchmarkResults.overallPerformance);

    const overall = Math.round(
      validationScore * 0.4 + dataQualityScore * 0.3 + benchmarkScore * 0.3
    );

    return {
      overall,
      validation: validationScore,
      dataQuality: dataQualityScore,
      benchmark: benchmarkScore,
      breakdown: {
        validation: '40%',
        dataQuality: '30%',
        benchmark: '30%',
      },
    };
  }

  /**
   * Convert benchmark performance to score
   */
  getBenchmarkScore(performance) {
    const scoreMap = {
      'excellent': 95,
      'above_average': 80,
      'average': 60,
      'below_average': 40,
      'poor': 20,
      'unknown': 50,
    };

    return scoreMap[performance] || 50;
  }

  /**
   * Iterative refinement loop
   */
  async refineReport(state) {
    console.log(`\n🔄 [${this.name}] Starting iterative refinement...`);

    let currentState = state;
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`\n   Iteration ${iteration}/${this.maxIterations}`);

      // Review current report
      const reviewedState = await this.execute(currentState);

      // Check if refinement is needed
      if (!reviewedState.review?.needsRefinement) {
        console.log(`   ✅ Quality threshold met. Refinement complete.`);
        break;
      }

      // Apply feedback to improve report
      console.log(`   🔧 Applying feedback for refinement...`);
      currentState = await this.applyFeedback(reviewedState);

      // Prevent infinite loops
      if (iteration === this.maxIterations) {
        console.log(`   ⚠️  Max iterations reached. Stopping refinement.`);
      }
    }

    return currentState;
  }

  /**
   * Apply feedback to improve report
   */
  async applyFeedback(state) {
    const { review, report } = state;

    if (!review || !review.feedback || review.feedback.length === 0) {
      return state;
    }

    // Group feedback by priority
    const criticalFeedback = review.feedback.filter(f => f.priority === 'critical');
    const highFeedback = review.feedback.filter(f => f.priority === 'high');

    console.log(`      Critical issues: ${criticalFeedback.length}`);
    console.log(`      High priority issues: ${highFeedback.length}`);

    // Apply critical fixes first
    for (const feedback of criticalFeedback) {
      if (feedback.suggestedFix) {
        console.log(`      Applying fix: ${feedback.issue}`);
        // In production, this would trigger report regeneration with fixes
      }
    }

    return state;
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(reviewResults) {
    const recommendations = [];

    // Validation recommendations
    if (reviewResults.validation.score < 80) {
      recommendations.push({
        category: 'Structure',
        priority: 'high',
        recommendation: 'Improve report completeness by adding missing sections',
        impact: 'high',
      });
    }

    // Anomaly recommendations
    if (reviewResults.anomalies.anomalies.length > 0) {
      recommendations.push({
        category: 'Data Quality',
        priority: 'critical',
        recommendation: 'Review and correct data anomalies detected',
        impact: 'critical',
      });
    }

    // Benchmark recommendations
    if (reviewResults.benchmarks.overallPerformance === 'below_average' ||
        reviewResults.benchmarks.overallPerformance === 'poor') {
      recommendations.push({
        category: 'Performance',
        priority: 'high',
        recommendation: 'Implement initiatives to improve ESG performance to industry standards',
        impact: 'high',
      });
    }

    return recommendations;
  }
}

module.exports = ReviewCritiqueAgent;
