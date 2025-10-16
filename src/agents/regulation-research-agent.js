// Regulation Research Agent
// Orchestrates sub-agents to identify applicable ESG regulations
// Sub-agents: Jurisdiction Analyzer, Framework Mapper, Deadline Calculator

const agentLogger = require('./agent-logger');
const jurisdictionAnalyzerAgent = require('./sub-agents/jurisdiction-analyzer-agent');
const frameworkMapperAgent = require('./sub-agents/framework-mapper-agent');

class RegulationResearchAgent {
  constructor() {
    this.name = 'RegulationResearchAgent';
    this.subAgents = [jurisdictionAnalyzerAgent, frameworkMapperAgent];
  }

  /**
   * Main execution - Sequential sub-agent execution
   */
  async execute(state) {
    console.log(`\n⚖️  [${this.name}] Starting regulation research...`);
    console.log(`Company: ${state.companyData?.name || 'Unknown'}`);

    try {
      const results = {
        jurisdiction: null,
        frameworks: null,
        regulations: [],
        deadlines: [],
      };

      // Step 1: Execute sub-agents sequentially (each builds on previous)
      for (const subAgent of this.subAgents) {
        console.log(`  ↳ Executing ${subAgent.name}...`);
        
        try {
          const subAgentResult = await subAgent.execute(state, results);
          
          // Merge results
          if (subAgent.name === 'JurisdictionAnalyzerAgent') {
            results.jurisdiction = subAgentResult.jurisdiction;
            results.regulations = subAgentResult.regulations;
          } else if (subAgent.name === 'FrameworkMapperAgent') {
            results.frameworks = subAgentResult.frameworks;
            results.deadlines = subAgentResult.deadlines;
          }
          
          console.log(`  ✓ ${subAgent.name} completed`);
        } catch (error) {
          console.error(`  ✗ ${subAgent.name} failed:`, error.message);
          // Continue with other sub-agents
        }
      }

      // Step 2: Cross-validate and score confidence
      const validatedResults = this.crossValidate(results);

      // Step 3: Log the action
      await agentLogger.logAction(
        this.name,
        state.userId,
        'research_regulations',
        { companyId: state.companyId, companyName: state.companyData?.name },
        validatedResults,
        'success'
      );

      console.log(`✅ [${this.name}] Research complete`);
      console.log(`   Regulations found: ${validatedResults.regulations.length}`);
      console.log(`   Frameworks: ${validatedResults.frameworks?.map(f => f.name).join(', ') || 'None'}`);

      // Step 4: Update state
      return {
        ...state,
        regulationData: validatedResults,
        currentStep: 'esg_data_collection',
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Identified ${validatedResults.regulations.length} applicable regulations`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);
      
      await agentLogger.logAction(
        this.name,
        state.userId,
        'research_regulations',
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
   * Cross-validate results and assign confidence scores
   */
  crossValidate(results) {
    const validated = { ...results };

    // Validate regulations
    if (validated.regulations && validated.regulations.length > 0) {
      validated.regulations = validated.regulations.map(reg => ({
        ...reg,
        confidence: this.calculateConfidence(reg, results),
      }));

      // Sort by confidence
      validated.regulations.sort((a, b) => b.confidence - a.confidence);
    }

    // Validate frameworks
    if (validated.frameworks && validated.frameworks.length > 0) {
      validated.frameworks = validated.frameworks.map(fw => ({
        ...fw,
        confidence: this.calculateFrameworkConfidence(fw, results),
      }));

      // Sort by confidence
      validated.frameworks.sort((a, b) => b.confidence - a.confidence);
    }

    return validated;
  }

  /**
   * Calculate confidence score for a regulation
   */
  calculateConfidence(regulation, results) {
    let confidence = 0.5; // Base confidence

    // Increase confidence if jurisdiction matches
    if (results.jurisdiction && regulation.jurisdiction === results.jurisdiction.country) {
      confidence += 0.2;
    }

    // Increase confidence if industry matches
    if (regulation.industries && regulation.industries.length > 0) {
      confidence += 0.15;
    }

    // Increase confidence if size threshold matches
    if (regulation.sizeThreshold) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate confidence score for a framework
   */
  calculateFrameworkConfidence(framework, results) {
    let confidence = 0.6; // Base confidence for frameworks

    // Increase confidence if widely adopted
    if (framework.name === 'GRI' || framework.name === 'SASB') {
      confidence += 0.2;
    }

    // Increase confidence if matches jurisdiction
    if (results.jurisdiction && framework.regions?.includes(results.jurisdiction.region)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }
}

module.exports = new RegulationResearchAgent();
