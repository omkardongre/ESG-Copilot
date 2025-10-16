// Workflow Graph - LangGraph orchestration
// Defines the agent execution flow with conditional routing

const { StateGraph, END } = require('@langchain/langgraph');
const { AgentState } = require('./agent-state');
const orchestratorAgent = require('./orchestrator-agent');
const regulationResearchAgent = require('./regulation-research-agent');
const esgDataCollectionAgent = require('./esg-data-collection-agent');

/**
 * Create the agent workflow graph
 */
function createWorkflowGraph() {
  // Initialize the state graph
  const workflow = new StateGraph(AgentState);

  // Add nodes (agents)
  workflow.addNode('orchestrator', async (state) => {
    return await orchestratorAgent.execute(state);
  });

  workflow.addNode('regulation_research', async (state) => {
    return await regulationResearchAgent.execute(state);
  });

  workflow.addNode('esg_data_collection', async (state) => {
    return await esgDataCollectionAgent.execute(state);
  });

  // Set entry point
  workflow.setEntryPoint('orchestrator');

  // Add conditional edges based on workflow plan
  workflow.addConditionalEdges(
    'orchestrator',
    routeFromOrchestrator,
    {
      regulation_research: 'regulation_research',
      esg_data_collection: 'esg_data_collection',
      complete: END,
    }
  );

  workflow.addConditionalEdges(
    'regulation_research',
    routeAfterRegulationResearch,
    {
      esg_data_collection: 'esg_data_collection',
      complete: END,
    }
  );

  workflow.addConditionalEdges(
    'esg_data_collection',
    routeAfterDataCollection,
    {
      complete: END,
    }
  );

  // Compile the graph
  return workflow.compile();
}

/**
 * Route from orchestrator based on workflow plan
 */
function routeFromOrchestrator(state) {
  const { workflowPlan, currentStep } = state;

  if (!workflowPlan || workflowPlan.length === 0) {
    console.log('🏁 No workflow plan, ending');
    return 'complete';
  }

  console.log(`🔀 Routing from orchestrator to: ${currentStep}`);
  
  // Map step names to node names
  const stepMapping = {
    regulation_research: 'regulation_research',
    esg_data_collection: 'esg_data_collection',
    emissions_calculation: 'esg_data_collection', // For now, handled by data collection
    report_generation: 'complete', // Not implemented yet
    review: 'complete', // Not implemented yet
    complete: 'complete',
  };

  return stepMapping[currentStep] || 'complete';
}

/**
 * Route after regulation research
 */
function routeAfterRegulationResearch(state) {
  const { workflowPlan, agentsExecuted } = state;

  // Find next step in workflow
  const nextStep = findNextStep(workflowPlan, agentsExecuted, 'regulation_research');
  
  console.log(`🔀 Routing after regulation research to: ${nextStep}`);

  if (nextStep === 'esg_data_collection') {
    return 'esg_data_collection';
  }

  return 'complete';
}

/**
 * Route after data collection
 */
function routeAfterDataCollection(state) {
  const { workflowPlan, agentsExecuted } = state;

  // Find next step in workflow
  const nextStep = findNextStep(workflowPlan, agentsExecuted, 'esg_data_collection');
  
  console.log(`🔀 Routing after data collection to: ${nextStep}`);

  // For now, end after data collection
  // In future, route to emissions calculation or report generation
  return 'complete';
}

/**
 * Helper: Find next step in workflow
 */
function findNextStep(workflowPlan, agentsExecuted, currentAgent) {
  if (!workflowPlan || workflowPlan.length === 0) {
    return 'complete';
  }

  // Find current step index
  const currentIndex = workflowPlan.findIndex(step => 
    currentAgent.toLowerCase().includes(step.step.replace('_', ''))
  );

  if (currentIndex === -1 || currentIndex === workflowPlan.length - 1) {
    return 'complete';
  }

  // Get next step
  const nextStep = workflowPlan[currentIndex + 1];

  // Check if dependencies are met
  const dependenciesMet = nextStep.dependencies.every(dep =>
    agentsExecuted.some(agent => agent.toLowerCase().includes(dep.replace('_', '')))
  );

  if (!dependenciesMet) {
    console.log(`⏸️  Dependencies not met for ${nextStep.step}`);
    return 'complete';
  }

  return nextStep.step;
}

module.exports = { createWorkflowGraph };
