// Workflow Graph - LangGraph orchestration
// Defines the agent execution flow with conditional routing

const { StateGraph, START, END } = require('@langchain/langgraph');
const { AgentState } = require('./agent-state');
const OrchestratorAgent = require('./orchestrator-agent');
const CompanyDiscoveryAgent = require('./company-discovery-agent');
const RegulationResearchAgent = require('./regulation-research-agent');
const ESGDataCollectionAgent = require('./esg-data-collection-agent');

// Initialize agents
const orchestrator = new OrchestratorAgent();
const companyDiscovery = new CompanyDiscoveryAgent();
const regulationResearch = new RegulationResearchAgent();
const esgDataCollection = new ESGDataCollectionAgent();

/**
 * Route from orchestrator based on workflow plan
 */
function routeAfterOrchestrator(state) {
  const { currentStep } = state;
  console.log(`🔀 Routing from orchestrator to: ${currentStep}\n`);
  
  if (currentStep === 'company_discovery') return 'company_discovery';
  if (currentStep === 'regulation_research') return 'regulation_research';
  if (currentStep === 'data_collection') return 'data_collection';
  if (currentStep === 'complete') return END;
  
  return END;
}

/**
 * Route after regulation research
 */
function routeAfterRegulationResearch(state) {
  console.log('🔀 Routing after regulation research to: complete\n');
  return END;
}

/**
 * Route after data collection
 */
function routeAfterDataCollection(state) {
  console.log('🔀 Routing after data collection to: complete\n');
  return END;
}

/**
 * Create the agent workflow graph
 */
function createWorkflowGraph() {
  const workflow = new StateGraph(AgentState)
    .addNode('orchestrator', async (state) => await orchestrator.execute(state))
    .addNode('company_discovery', async (state) => await companyDiscovery.execute(state))
    .addNode('regulation_research', async (state) => await regulationResearch.execute(state))
    .addNode('data_collection', async (state) => await esgDataCollection.execute(state))
    .addEdge(START, 'orchestrator')
    .addConditionalEdges('orchestrator', routeAfterOrchestrator)
    .addConditionalEdges('company_discovery', (state) => {
      console.log('🔀 Routing after company discovery to: regulation_research\n');
      return 'regulation_research';
    })
    .addConditionalEdges('regulation_research', routeAfterRegulationResearch)
    .addConditionalEdges('data_collection', routeAfterDataCollection);

  return workflow.compile();
}

module.exports = { createWorkflowGraph };
