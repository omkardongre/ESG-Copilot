// ESG Data Collection Agent
// Orchestrates parallel data collection from multiple sources (EPA, AI estimator, web scraper)
// Implements fan-out/gather pattern for parallel execution

const agentLogger = require('./agent-logger');
const EPADataCollectorAgent = require('./sub-agents/epa-data-collector-agent');
const WebScraperAgent = require('./sub-agents/web-scraper-agent');
const AIEstimatorAgent = require('./sub-agents/ai-estimator-agent');

class ESGDataCollectionAgent {
  constructor() {
    this.name = 'ESGDataCollectionAgent';
    this.subAgents = [EPADataCollectorAgent, WebScraperAgent, AIEstimatorAgent];
  }

  /**
   * Main execution - Parallel fan-out/gather pattern
   */
  async execute(state) {
    console.log(`\n📊 [${this.name}] Starting ESG data collection...`);
    console.log(`Company: ${state.companyData?.name || 'Unknown'}`);

    try {
      // Step 1: Execute sub-agents in parallel (fan-out)
      console.log('   ↳ Executing sub-agents in parallel...');
      const subAgentResults = await Promise.allSettled(this.subAgents.map(async (subAgent) => {
        try {
          console.log(`  ↳ Starting ${subAgent.name}...`);
          const result = await subAgent.execute(state);
          console.log(`  ✓ ${subAgent.name} completed`);
          return { agent: subAgent.name, result, success: true };
        } catch (error) {
          console.error(`  ✗ ${subAgent.name} failed:`, error.message);
          return { agent: subAgent.name, error: error.message, success: false };
        }
      });

      // Step 2: Gather - Wait for all sub-agents to complete
      const subAgentResults = await Promise.all(subAgentPromises);
      console.log(`🔄 [${this.name}] Gathering results from sub-agents...`);

      // Step 3: Merge results
      const mergedData = this.mergeResults(subAgentResults);
      
      // Step 4: Validate data quality
      const validationResult = this.validateData(mergedData);

      // Step 5: Log the action
      await agentLogger.logAction(
        this.name,
        state.userId,
        'collect_esg_data',
        { companyId: state.companyId, companyName: state.companyData?.name },
        { mergedData, validation: validationResult },
        'success'
      );

      console.log(`✅ [${this.name}] Data collection complete`);
      console.log(`   Sources: ${mergedData.sources.join(', ')}`);
      console.log(`   Metrics collected: ${mergedData.metricsCount}`);

      // Step 6: Update state
      return {
        ...state,
        esgData: mergedData,
        currentStep: 'emissions_calculation',
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Collected ESG data from ${mergedData.sources.length} sources`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);
      
      await agentLogger.logAction(
        this.name,
        state.userId,
        'collect_esg_data',
        { companyId: state.companyId },
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
   * Merge results from all sub-agents
   */
  mergeResults(subAgentResults) {
    const merged = {
      environmental: {},
      social: {},
      governance: {},
      sources: [],
      metricsCount: 0,
      subAgentResults: [],
    };

    for (const result of subAgentResults) {
      if (!result.success) {
        console.log(`⚠️  [${this.name}] Skipping failed sub-agent: ${result.agent}`);
        continue;
      }

      const data = result.result;
      
      // Merge environmental data
      if (data.environmental) {
        merged.environmental = { ...merged.environmental, ...data.environmental };
      }

      // Merge social data
      if (data.social) {
        merged.social = { ...merged.social, ...data.social };
      }

      // Merge governance data
      if (data.governance) {
        merged.governance = { ...merged.governance, ...data.governance };
      }

      // Track sources
      if (data.source && !merged.sources.includes(data.source)) {
        merged.sources.push(data.source);
      }

      // Store sub-agent result
      merged.subAgentResults.push({
        agent: result.agent,
        success: true,
        dataPoints: Object.keys(data.environmental || {}).length +
                    Object.keys(data.social || {}).length +
                    Object.keys(data.governance || {}).length,
      });
    }

    // Count total metrics
    merged.metricsCount = 
      Object.keys(merged.environmental).length +
      Object.keys(merged.social).length +
      Object.keys(merged.governance).length;

    return merged;
  }

  /**
   * Validate data quality
   */
  validateData(mergedData) {
    const validation = {
      isValid: true,
      warnings: [],
      coverage: {
        environmental: Object.keys(mergedData.environmental).length > 0,
        social: Object.keys(mergedData.social).length > 0,
        governance: Object.keys(mergedData.governance).length > 0,
      },
    };

    // Check for missing categories
    if (!validation.coverage.environmental) {
      validation.warnings.push('No environmental data collected');
    }
    if (!validation.coverage.social) {
      validation.warnings.push('No social data collected');
    }
    if (!validation.coverage.governance) {
      validation.warnings.push('No governance data collected');
    }

    // Check for minimum data threshold
    if (mergedData.metricsCount < 5) {
      validation.warnings.push(`Only ${mergedData.metricsCount} metrics collected (recommended: 10+)`);
    }

    validation.isValid = validation.warnings.length === 0;

    return validation;
  }

  /**
   * Retry failed sub-agents
   */
  async retryFailedSubAgents(state, failedAgents) {
    console.log(`🔄 [${this.name}] Retrying ${failedAgents.length} failed sub-agents...`);

    const retryPromises = failedAgents.map(async (agentName) => {
      const subAgent = this.subAgents.find(a => a.name === agentName);
      if (!subAgent) return null;

      try {
        console.log(`  ↳ Retrying ${subAgent.name}...`);
        const result = await subAgent.execute(state);
        console.log(`  ✓ ${subAgent.name} retry succeeded`);
        return { agent: subAgent.name, result, success: true };
      } catch (error) {
        console.error(`  ✗ ${subAgent.name} retry failed:`, error.message);
        return { agent: subAgent.name, error: error.message, success: false };
      }
    });

    return await Promise.all(retryPromises);
  }
}

module.exports = new ESGDataCollectionAgent();
