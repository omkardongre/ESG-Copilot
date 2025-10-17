// Orchestrator Agent - Master Controller
// Plans workflows, delegates to specialized agents, monitors progress

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { v4: uuidv4 } = require('uuid');
const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');

class OrchestratorAgent {
  constructor() {
    this.name = 'OrchestratorAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.2,
    });
  }

  /**
   * Main orchestration logic
   * Analyzes the goal and creates a workflow plan
   */
  async execute(state) {
    console.log(`\n🎯 [${this.name}] Starting orchestration...`);
    console.log(`Goal: ${state.goal}`);

    try {
      // Step 1: Analyze the goal and create workflow plan
      const workflowPlan = await this.planWorkflow(state);
      
      // Step 2: Broadcast workflow plan to all agents via message queue
      await messageQueue.broadcast(
        this.name,
        'workflow_plan_created',
        { workflowPlan, taskId: state.taskId },
        state.taskId
      );
      
      // Step 3: Log the orchestration
      await agentLogger.logAction(
        this.name,
        state.userId,
        'plan_workflow',
        { goal: state.goal },
        { workflowPlan },
        'success'
      );

      // Step 4: Update state with the plan
      return {
        ...state,
        workflowPlan,
        currentStep: workflowPlan[0]?.step || 'complete',
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Created workflow plan with ${workflowPlan.length} steps`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);
      
      await agentLogger.logAction(
        this.name,
        state.userId,
        'plan_workflow',
        { goal: state.goal },
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
   * Plan the workflow based on the goal
   * Uses LLM to intelligently determine required steps
   */
  async planWorkflow(state) {
    const prompt = `You are an ESG Copilot orchestrator. Analyze this goal and create a step-by-step workflow plan.

Goal: ${state.goal}

Company Context:
- Company ID: ${state.companyId || 'Not specified'}
- Company Name: ${state.companyData?.name || 'Not specified'}
- Industry: ${state.companyData?.industry || 'Not specified'}

Available Agents:
1. RegulationResearchAgent - Identifies applicable ESG regulations
2. ESGDataCollectionAgent - Gathers ESG metrics from multiple sources
3. EmissionsCalculatorAgent - Calculates carbon footprint
4. ReportGeneratorAgent - Creates ESG reports
5. ReviewAgent - Validates report quality

Create a workflow plan as a JSON array of steps. Each step should have:
- step: The agent to execute (e.g., "regulation_research")
- description: What this step accomplishes
- dependencies: Array of previous steps required (empty if none)

Example:
[
  {
    "step": "regulation_research",
    "description": "Identify applicable ESG regulations for the company",
    "dependencies": []
  },
  {
    "step": "esg_data_collection",
    "description": "Collect ESG data from EPA and other sources",
    "dependencies": ["regulation_research"]
  }
]

Return ONLY the JSON array, no other text.`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content;
      
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to extract workflow plan from LLM response');
      }

      const workflowPlan = JSON.parse(jsonMatch[0]);
      console.log(`📋 [${this.name}] Created workflow plan with ${workflowPlan.length} steps`);
      
      return workflowPlan;
    } catch (error) {
      console.error(`❌ [${this.name}] Error planning workflow:`, error.message);
      
      // Fallback to default workflow for report generation
      return this.getDefaultWorkflow(state.goal);
    }
  }

  /**
   * Get default workflow if LLM planning fails
   */
  getDefaultWorkflow(goal) {
    const lowerGoal = goal.toLowerCase();

    // Report generation workflow
    if (lowerGoal.includes('report') || lowerGoal.includes('generate')) {
      return [
        {
          step: 'regulation_research',
          description: 'Identify applicable ESG regulations',
          dependencies: [],
        },
        {
          step: 'esg_data_collection',
          description: 'Collect ESG data from multiple sources',
          dependencies: ['regulation_research'],
        },
        {
          step: 'emissions_calculation',
          description: 'Calculate carbon footprint',
          dependencies: ['esg_data_collection'],
        },
        {
          step: 'report_generation',
          description: 'Generate ESG report',
          dependencies: ['regulation_research', 'esg_data_collection', 'emissions_calculation'],
        },
        {
          step: 'review',
          description: 'Review and validate report',
          dependencies: ['report_generation'],
        },
      ];
    }

    // Data collection only
    if (lowerGoal.includes('collect') || lowerGoal.includes('data')) {
      return [
        {
          step: 'esg_data_collection',
          description: 'Collect ESG data from multiple sources',
          dependencies: [],
        },
      ];
    }

    // Regulation research only
    if (lowerGoal.includes('regulation') || lowerGoal.includes('compliance')) {
      return [
        {
          step: 'regulation_research',
          description: 'Identify applicable ESG regulations',
          dependencies: [],
        },
      ];
    }

    // Default: full workflow
    return [
      {
        step: 'regulation_research',
        description: 'Identify applicable ESG regulations',
        dependencies: [],
      },
      {
        step: 'esg_data_collection',
        description: 'Collect ESG data from multiple sources',
        dependencies: [],
      },
    ];
  }

  /**
   * Determine next step in workflow
   */
  getNextStep(state) {
    const { workflowPlan, currentStep, agentsExecuted } = state;

    if (!workflowPlan || workflowPlan.length === 0) {
      return 'complete';
    }

    // Find current step index
    const currentIndex = workflowPlan.findIndex(s => s.step === currentStep);

    // If at the end, complete
    if (currentIndex === workflowPlan.length - 1) {
      return 'complete';
    }

    // Get next step
    const nextStep = workflowPlan[currentIndex + 1];

    // Check if dependencies are met
    const dependenciesMet = nextStep.dependencies.every(dep =>
      agentsExecuted.some(agent => agent.toLowerCase().includes(dep.replace('_', '')))
    );

    if (!dependenciesMet) {
      console.log(`⏸️  [${this.name}] Dependencies not met for ${nextStep.step}`);
      return 'wait';
    }

    return nextStep.step;
  }

  /**
   * Monitor agent progress
   */
  async monitorProgress(state) {
    const totalSteps = state.workflowPlan?.length || 0;
    const completedSteps = state.agentsExecuted?.length || 0;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    console.log(`📊 [${this.name}] Progress: ${progress}% (${completedSteps}/${totalSteps} steps)`);

    return progress;
  }
}

module.exports = OrchestratorAgent;
