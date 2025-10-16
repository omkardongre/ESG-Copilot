import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE,
});

export async function GET(request, { params }) {
  try {
    const { taskId } = params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Query agent states for this task
    const query = `
      SELECT 
        agent_id,
        SPLIT(agent_id, '_')[OFFSET(0)] as agent_name,
        task_id,
        state,
        progress,
        status,
        created_at,
        updated_at
      FROM \`esg_copilot_data.agent_state\`
      WHERE task_id = @taskId
      ORDER BY created_at ASC
    `;

    const options = {
      query,
      params: { taskId },
    };

    const [rows] = await bigquery.query(options);

    // Parse state JSON
    const agents = rows.map(row => ({
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      task_id: row.task_id,
      state: row.state ? JSON.parse(row.state) : {},
      progress: row.progress || 0,
      status: row.status || 'pending',
      created_at: row.created_at,
      updated_at: row.updated_at,
      current_action: row.state ? JSON.parse(row.state).currentAction : null,
      sub_agents: row.state ? JSON.parse(row.state).subAgents : [],
      duration_ms: row.state ? JSON.parse(row.state).durationMs : null,
      error_message: row.state ? JSON.parse(row.state).errorMessage : null,
    }));

    // Get task info
    const taskQuery = `
      SELECT 
        task_id,
        user_id,
        goal,
        status,
        result,
        created_at,
        completed_at
      FROM \`esg_copilot_data.agent_tasks\`
      WHERE task_id = @taskId
      LIMIT 1
    `;

    const [taskRows] = await bigquery.query({
      query: taskQuery,
      params: { taskId },
    });

    const task = taskRows[0] || null;

    return NextResponse.json({
      task: task ? {
        task_id: task.task_id,
        user_id: task.user_id,
        goal: task.goal,
        status: task.status,
        result: task.result ? JSON.parse(task.result) : null,
        created_at: task.created_at,
        completed_at: task.completed_at,
      } : null,
      agents,
      totalAgents: agents.length,
      completedAgents: agents.filter(a => a.status === 'completed').length,
      failedAgents: agents.filter(a => a.status === 'failed').length,
    });
  } catch (error) {
    console.error('Error fetching agent progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent progress', details: error.message },
      { status: 500 }
    );
  }
}
