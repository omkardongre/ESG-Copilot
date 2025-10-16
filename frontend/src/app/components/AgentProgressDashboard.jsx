'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, XCircle, Clock } from 'lucide-react';

export default function AgentProgressDashboard({ taskId }) {
  const [agentStates, setAgentStates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;

    const fetchAgentProgress = async () => {
      try {
        const response = await fetch(`/api/agents/progress/${taskId}`);
        const data = await response.json();
        setAgentStates(data.agents || []);
      } catch (error) {
        console.error('Failed to fetch agent progress:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchAgentProgress();

    // Poll every 2 seconds
    const interval = setInterval(fetchAgentProgress, 2000);

    return () => clearInterval(interval);
  }, [taskId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-400" />;
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'default',
      in_progress: 'secondary',
      failed: 'destructive',
      pending: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const calculateOverallProgress = () => {
    if (agentStates.length === 0) return 0;
    const totalProgress = agentStates.reduce((sum, agent) => sum + (agent.progress || 0), 0);
    return Math.round(totalProgress / agentStates.length);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>Task ID: {taskId}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Completion</span>
              <span className="text-muted-foreground">{calculateOverallProgress()}%</span>
            </div>
            <Progress value={calculateOverallProgress()} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Agent List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agentStates.map((agent) => (
          <Card key={agent.agent_id} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(agent.status)}
                  <CardTitle className="text-base">{agent.agent_name}</CardTitle>
                </div>
                {getStatusBadge(agent.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{agent.progress || 0}%</span>
                </div>
                <Progress value={agent.progress || 0} className="h-1.5" />
              </div>

              {/* Current Action */}
              {agent.current_action && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Current: </span>
                  <span className="font-medium">{agent.current_action}</span>
                </div>
              )}

              {/* Sub-agents */}
              {agent.sub_agents && agent.sub_agents.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Sub-agents: </span>
                  <span className="font-medium">{agent.sub_agents.length}</span>
                </div>
              )}

              {/* Duration */}
              {agent.duration_ms && (
                <div className="text-xs text-muted-foreground">
                  Duration: {(agent.duration_ms / 1000).toFixed(1)}s
                </div>
              )}

              {/* Error Message */}
              {agent.status === 'failed' && agent.error_message && (
                <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                  {agent.error_message}
                </div>
              )}
            </CardContent>

            {/* Status Indicator Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 ${
                agent.status === 'completed'
                  ? 'bg-green-500'
                  : agent.status === 'in_progress'
                  ? 'bg-blue-500 animate-pulse'
                  : agent.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-gray-200'
              }`}
            />
          </Card>
        ))}
      </div>

      {/* Agent Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agentStates
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              .map((agent, index) => (
                <div key={agent.agent_id} className="flex items-start gap-4">
                  {/* Timeline Connector */}
                  <div className="flex flex-col items-center">
                    {getStatusIcon(agent.status)}
                    {index < agentStates.length - 1 && (
                      <div className="w-0.5 h-12 bg-gray-200 mt-2" />
                    )}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{agent.agent_name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(agent.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {agent.current_action || agent.status}
                    </p>
                    {agent.completed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed at {new Date(agent.completed_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
