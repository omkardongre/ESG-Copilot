// Agent Logging Service
// Logs all agent actions to BigQuery for audit trail and monitoring

const { v4: uuidv4 } = require('uuid');
const bigQueryClient = require('../utils/bigquery-client');

class AgentLogger {
  /**
   * Log agent action
   */
  async logAction(agentName, userId, action, input, output, status = 'success', error = null) {
    const logEntry = {
      log_id: uuidv4(),
      agent_name: agentName,
      user_id: userId,
      company_id: input?.companyId || null,
      action,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
      duration_ms: null, // Will be calculated if needed
      status,
      error_message: error ? error.message : null,
      timestamp: new Date().toISOString(),
    };

    try {
      await bigQueryClient.insert('agent_logs', [logEntry]);
      console.log(`📝 [${agentName}] Logged action: ${action} (${status})`);
    } catch (err) {
      console.error(`❌ Failed to log agent action:`, err.message);
    }

    return logEntry;
  }

  /**
   * Log agent state transition
   */
  async logStateTransition(agentId, userId, taskId, state, progress, status) {
    const stateEntry = {
      agent_id: agentId,
      user_id: userId,
      task_id: taskId,
      state: JSON.stringify(state),
      progress,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await bigQueryClient.insert('agent_state', [stateEntry]);
      console.log(`📊 [${agentId}] State transition: ${status} (${progress}%)`);
    } catch (err) {
      console.error(`❌ Failed to log state transition:`, err.message);
    }

    return stateEntry;
  }

  /**
   * Log task creation
   */
  async logTaskCreation(taskId, userId, goal, orchestratorId) {
    const taskEntry = {
      task_id: taskId,
      user_id: userId,
      goal,
      orchestrator_id: orchestratorId,
      agents_involved: [],
      status: 'started',
      result: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    try {
      await bigQueryClient.insert('agent_tasks', [taskEntry]);
      console.log(`🎯 Task created: ${taskId}`);
    } catch (err) {
      console.error(`❌ Failed to log task creation:`, err.message);
    }

    return taskEntry;
  }

  /**
   * Log task completion
   */
  async logTaskCompletion(taskId, agentsInvolved, result, status = 'completed') {
    const updateData = {
      task_id: taskId,
      agents_involved: agentsInvolved,
      status,
      result: JSON.stringify(result),
      completed_at: new Date().toISOString(),
    };

    try {
      // In a real implementation, this would update the existing task record
      // For now, we'll insert a completion log
      await bigQueryClient.insert('agent_tasks', [updateData]);
      console.log(`✅ Task completed: ${taskId} (${status})`);
    } catch (err) {
      console.error(`❌ Failed to log task completion:`, err.message);
    }

    return updateData;
  }

  /**
   * Get agent logs for a user
   */
  async getAgentLogs(userId, limit = 50) {
    const query = `
      SELECT *
      FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.agent_logs\`
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    return await bigQueryClient.query(query, [userId, limit]);
  }

  /**
   * Get task history for a user
   */
  async getTaskHistory(userId, limit = 20) {
    const query = `
      SELECT *
      FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.agent_tasks\`
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return await bigQueryClient.query(query, [userId, limit]);
  }
}

module.exports = new AgentLogger();
