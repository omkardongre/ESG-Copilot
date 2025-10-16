// Agent State Management
// Defines the shared state structure for all agents in the workflow

const { Annotation } = require('@langchain/langgraph');

/**
 * AgentState - Shared state across all agents
 * This is the "memory" that agents read from and write to
 */
const AgentState = Annotation.Root({
  // User context
  userId: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  
  userPermissions: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  // Task information
  taskId: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  goal: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // Company context
  companyId: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  companyData: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => ({}),
  }),

  // Agent workflow state
  currentStep: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 'start',
  }),

  workflowPlan: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  // Data collection results
  regulationData: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  esgData: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  emissionsData: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // Report generation
  reportDraft: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  reportFinal: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  reviewFeedback: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // Agent execution tracking
  agentsExecuted: Annotation({
    reducer: (x, y) => [...(x || []), ...(Array.isArray(y) ? y : [y])],
    default: () => [],
  }),

  // Error handling
  errors: Annotation({
    reducer: (x, y) => [...(x || []), ...(Array.isArray(y) ? y : [y])],
    default: () => [],
  }),

  // Iteration control
  iterationCount: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),

  maxIterations: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 3,
  }),

  // Final result
  result: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // Messages for agent communication
  messages: Annotation({
    reducer: (x, y) => [...(x || []), ...(Array.isArray(y) ? y : [y])],
    default: () => [],
  }),
});

module.exports = { AgentState };
