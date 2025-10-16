// Agent Routes - API endpoints for agent execution
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createWorkflowGraph } = require('../agents/workflow-graph');
const agentLogger = require('../agents/agent-logger');
const bigQueryClient = require('../utils/bigquery-client');

/**
 * POST /api/agents/execute
 * Execute an agent workflow
 */
router.post('/execute', async (req, res) => {
  try {
    const { goal, companyId, companyData } = req.body;

    if (!goal) {
      return res.status(400).json({ error: 'Goal is required' });
    }

    // Get user from Auth0 token (if available)
    const userId = req.user?.sub || 'anonymous';
    const userPermissions = req.user?.permissions || [];

    console.log(`\n🚀 Starting agent workflow...`);
    console.log(`Goal: ${goal}`);
    console.log(`User: ${userId}`);

    // Create task ID
    const taskId = uuidv4();

    // Log task creation
    await agentLogger.logTaskCreation(taskId, userId, goal, 'OrchestratorAgent');

    // Initialize state
    const initialState = {
      userId,
      userPermissions,
      taskId,
      goal,
      companyId: companyId || null,
      companyData: companyData || {},
      currentStep: 'start',
      workflowPlan: [],
      regulationData: null,
      esgData: null,
      emissionsData: null,
      reportDraft: null,
      reportFinal: null,
      reviewFeedback: null,
      agentsExecuted: [],
      errors: [],
      iterationCount: 0,
      maxIterations: 3,
      result: null,
      messages: [],
    };

    // Create and execute workflow
    const workflow = createWorkflowGraph();
    
    console.log(`\n🔄 Executing workflow graph...`);
    const finalState = await workflow.invoke(initialState);

    console.log(`\n✅ Workflow complete!`);
    console.log(`Agents executed: ${finalState.agentsExecuted.join(', ')}`);

    // Log task completion
    await agentLogger.logTaskCompletion(
      taskId,
      finalState.agentsExecuted,
      {
        regulationData: finalState.regulationData,
        esgData: finalState.esgData,
      },
      'completed'
    );

    // Return result
    res.json({
      success: true,
      taskId,
      goal,
      agentsExecuted: finalState.agentsExecuted,
      result: {
        regulationData: finalState.regulationData,
        esgData: finalState.esgData,
        emissionsData: finalState.emissionsData,
      },
      messages: finalState.messages,
      errors: finalState.errors,
    });
  } catch (error) {
    console.error('❌ Agent execution error:', error);
    res.status(500).json({
      error: 'Agent execution failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/tasks/:userId
 * Get task history for a user
 */
router.get('/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const tasks = await agentLogger.getTaskHistory(userId, limit);

    res.json({
      success: true,
      userId,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({
      error: 'Failed to fetch task history',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/logs/:userId
 * Get agent logs for a user
 */
router.get('/logs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const logs = await agentLogger.getAgentLogs(userId, limit);

    res.json({
      success: true,
      userId,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error fetching agent logs:', error);
    res.status(500).json({
      error: 'Failed to fetch agent logs',
      message: error.message,
    });
  }
});

/**
 * POST /api/agents/test
 * Test agent execution with sample data
 */
router.post('/test', async (req, res) => {
  try {
    console.log('\n🧪 Testing agent workflow...');

    const testState = {
      userId: 'test-user',
      userPermissions: ['read:companies', 'write:reports'],
      taskId: uuidv4(),
      goal: 'Generate ESG report for test company',
      companyId: 'test-company-123',
      companyData: {
        name: 'Test Manufacturing Co.',
        industry: 'Manufacturing',
        country: 'United States',
        state: 'California',
        employees: 250,
        revenue: '$50M',
        isPublic: false,
      },
      currentStep: 'start',
      workflowPlan: [],
      regulationData: null,
      esgData: null,
      emissionsData: null,
      reportDraft: null,
      reportFinal: null,
      reviewFeedback: null,
      agentsExecuted: [],
      errors: [],
      iterationCount: 0,
      maxIterations: 3,
      result: null,
      messages: [],
    };

    const workflow = createWorkflowGraph();
    const finalState = await workflow.invoke(testState);

    console.log('\n✅ Test complete!');

    res.json({
      success: true,
      message: 'Agent workflow test completed',
      agentsExecuted: finalState.agentsExecuted,
      result: {
        regulationData: finalState.regulationData,
        esgData: finalState.esgData,
      },
      errors: finalState.errors,
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
    });
  }
});

module.exports = router;
