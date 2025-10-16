// Approval Workflow Sub-Agent
// Manages approval workflows with state tracking and business rules
// Supports sequential, parallel, and hybrid approval patterns

const { v4: uuidv4 } = require('uuid');
const IORedis = require('ioredis');

class ApprovalWorkflowAgent {
  constructor() {
    this.name = 'ApprovalWorkflowAgent';
    
    // Initialize Redis for workflow state management
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn(`      ⚠️  Redis connection failed after ${times} attempts`);
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      },
    });

    this.redis.on('error', (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`      ⚠️  Redis error (development mode):`, err.message);
      }
    });
  }

  /**
   * Execute workflow creation
   */
  async execute(params) {
    const { report, review, stakeholders, companyInfo, userId } = params;

    console.log(`      ✅ [${this.name}] Creating approval workflow...`);

    try {
      // Determine approval pattern
      const approvalPattern = this.determineApprovalPattern(stakeholders, report);

      // Create workflow
      const workflow = {
        id: uuidv4(),
        type: approvalPattern.type,
        status: 'pending',
        reportId: report.content?.metadata?.title || 'ESG Report',
        companyId: companyInfo.id || companyInfo.name,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        requiredApprovals: approvalPattern.requiredApprovals,
        approvers: approvalPattern.approvers,
        rules: approvalPattern.rules,
        metadata: {
          qualityScore: review?.qualityScore?.overall,
          anomaliesCount: review?.anomalies?.totalAnomalies,
          template: report.content?.metadata?.template,
        },
      };

      // Save workflow to Redis
      await this.saveWorkflow(workflow);

      console.log(`      ✅ Workflow created: ${workflow.id}`);
      console.log(`      Pattern: ${workflow.type}`);
      console.log(`      Approvers: ${workflow.approvers.length}`);
      console.log(`      Required approvals: ${workflow.requiredApprovals}`);

      return workflow;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw error;
    }
  }

  /**
   * Determine approval pattern based on stakeholders and report
   */
  determineApprovalPattern(stakeholders, report) {
    const approvers = stakeholders.list.filter(s => s.role === 'approver');
    
    // Default: All approvers must approve (unanimous)
    let pattern = {
      type: 'unanimous',
      requiredApprovals: approvers.length,
      approvers: approvers.map(a => ({
        stakeholderId: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        status: 'pending',
        order: null, // null = parallel
      })),
      rules: {
        allowParallel: true,
        requireAll: true,
        allowDelegation: false,
      },
    };

    // If high-risk report, require sequential approval
    const qualityScore = report.review?.qualityScore?.overall;
    if (qualityScore && qualityScore < 70) {
      pattern.type = 'sequential';
      pattern.rules.allowParallel = false;
      
      // Assign order based on seniority
      pattern.approvers = pattern.approvers.map((a, index) => ({
        ...a,
        order: index + 1,
      }));
    }

    // If many approvers (>5), use majority voting
    if (approvers.length > 5) {
      pattern.type = 'majority';
      pattern.requiredApprovals = Math.ceil(approvers.length / 2);
      pattern.rules.requireAll = false;
    }

    // If critical anomalies, escalate to senior approvers
    const criticalAnomalies = report.review?.anomalies?.criticalAnomalies || 0;
    if (criticalAnomalies > 0) {
      const seniorApprovers = approvers.filter(a => 
        a.title?.toLowerCase().includes('director') || 
        a.title?.toLowerCase().includes('vp') ||
        a.title?.toLowerCase().includes('chief')
      );
      
      if (seniorApprovers.length > 0) {
        pattern.approvers = seniorApprovers.map(a => ({
          stakeholderId: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          status: 'pending',
          order: null,
        }));
        pattern.requiredApprovals = seniorApprovers.length;
      }
    }

    return pattern;
  }

  /**
   * Process approval decision
   */
  async processApproval(params) {
    const { workflowId, stakeholderId, decision, comments, verifiedUser } = params;

    console.log(`      ✅ Processing ${decision} from ${stakeholderId}...`);

    try {
      // Load workflow
      const workflow = await this.loadWorkflow(workflowId);

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      if (workflow.status !== 'pending') {
        throw new Error(`Workflow ${workflowId} is not pending (status: ${workflow.status})`);
      }

      // Find approver
      const approverIndex = workflow.approvers.findIndex(
        a => a.stakeholderId === stakeholderId
      );

      if (approverIndex === -1) {
        throw new Error(`Stakeholder ${stakeholderId} is not an approver for this workflow`);
      }

      const approver = workflow.approvers[approverIndex];

      if (approver.status !== 'pending') {
        throw new Error(`Approval already processed for ${stakeholderId}`);
      }

      // Check if it's this approver's turn (for sequential workflows)
      if (workflow.type === 'sequential') {
        const currentOrder = approver.order;
        const previousApprovers = workflow.approvers.filter(a => a.order < currentOrder);
        const allPreviousApproved = previousApprovers.every(a => a.status === 'approved');

        if (!allPreviousApproved) {
          throw new Error('Previous approvers must approve first (sequential workflow)');
        }
      }

      // Update approver status
      workflow.approvers[approverIndex] = {
        ...approver,
        status: decision, // 'approved' or 'rejected'
        comments: comments,
        decidedAt: new Date().toISOString(),
        decidedBy: verifiedUser.email,
      };

      // Update workflow status
      workflow.updatedAt = new Date().toISOString();
      workflow.lastAction = {
        stakeholderId,
        decision,
        timestamp: new Date().toISOString(),
      };

      // Check if workflow is complete
      const approvedCount = workflow.approvers.filter(a => a.status === 'approved').length;
      const rejectedCount = workflow.approvers.filter(a => a.status === 'rejected').length;

      if (decision === 'rejected') {
        // Any rejection fails the workflow
        workflow.status = 'rejected';
        workflow.completedAt = new Date().toISOString();
      } else if (approvedCount >= workflow.requiredApprovals) {
        // Sufficient approvals
        workflow.status = 'approved';
        workflow.completedAt = new Date().toISOString();
      } else {
        // Still pending
        workflow.pendingApprovals = workflow.requiredApprovals - approvedCount;
      }

      // Save updated workflow
      await this.saveWorkflow(workflow);

      console.log(`      ✅ Workflow updated: ${workflow.status}`);
      console.log(`      Approved: ${approvedCount}/${workflow.requiredApprovals}`);

      return workflow;
    } catch (error) {
      console.error(`      ❌ Approval processing error:`, error.message);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getStatus(workflowId) {
    try {
      const workflow = await this.loadWorkflow(workflowId);

      if (!workflow) {
        return {
          found: false,
          workflowId,
        };
      }

      const approvedCount = workflow.approvers.filter(a => a.status === 'approved').length;
      const rejectedCount = workflow.approvers.filter(a => a.status === 'rejected').length;
      const pendingCount = workflow.approvers.filter(a => a.status === 'pending').length;

      return {
        found: true,
        workflowId: workflow.id,
        status: workflow.status,
        type: workflow.type,
        createdAt: workflow.createdAt,
        expiresAt: workflow.expiresAt,
        completedAt: workflow.completedAt,
        approvers: {
          total: workflow.approvers.length,
          approved: approvedCount,
          rejected: rejectedCount,
          pending: pendingCount,
        },
        requiredApprovals: workflow.requiredApprovals,
        isExpired: new Date() > new Date(workflow.expiresAt),
      };
    } catch (error) {
      console.error(`      ❌ Failed to get workflow status:`, error.message);
      throw error;
    }
  }

  /**
   * Cancel workflow
   */
  async cancel(params) {
    const { workflowId, reason, userId } = params;

    try {
      const workflow = await this.loadWorkflow(workflowId);

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      workflow.status = 'cancelled';
      workflow.cancelledAt = new Date().toISOString();
      workflow.cancelledBy = userId;
      workflow.cancelReason = reason;

      await this.saveWorkflow(workflow);

      console.log(`      ✅ Workflow cancelled: ${workflowId}`);

      return workflow;
    } catch (error) {
      console.error(`      ❌ Failed to cancel workflow:`, error.message);
      throw error;
    }
  }

  /**
   * Save workflow to Redis
   */
  async saveWorkflow(workflow) {
    try {
      const key = `workflow:${workflow.id}`;
      const value = JSON.stringify(workflow);
      
      // Save with 30-day expiration
      await this.redis.setex(key, 30 * 24 * 60 * 60, value);
      
      // Also maintain an index by company
      await this.redis.sadd(`workflows:company:${workflow.companyId}`, workflow.id);
    } catch (error) {
      // Fallback to in-memory storage for development
      if (process.env.NODE_ENV === 'development') {
        if (!global.workflowCache) {
          global.workflowCache = new Map();
        }
        global.workflowCache.set(workflow.id, workflow);
        console.warn(`      ⚠️  Using in-memory workflow storage (development mode)`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load workflow from Redis
   */
  async loadWorkflow(workflowId) {
    try {
      const key = `workflow:${workflowId}`;
      const value = await this.redis.get(key);
      
      if (!value) {
        return null;
      }
      
      return JSON.parse(value);
    } catch (error) {
      // Fallback to in-memory storage for development
      if (process.env.NODE_ENV === 'development' && global.workflowCache) {
        const workflow = global.workflowCache.get(workflowId);
        if (workflow) {
          console.warn(`      ⚠️  Using in-memory workflow storage (development mode)`);
          return workflow;
        }
      }
      
      console.error(`      ❌ Failed to load workflow:`, error.message);
      return null;
    }
  }

  /**
   * Get workflows by company
   */
  async getWorkflowsByCompany(companyId) {
    try {
      const workflowIds = await this.redis.smembers(`workflows:company:${companyId}`);
      
      const workflows = [];
      for (const id of workflowIds) {
        const workflow = await this.loadWorkflow(id);
        if (workflow) {
          workflows.push(workflow);
        }
      }
      
      return workflows;
    } catch (error) {
      console.error(`      ❌ Failed to get workflows by company:`, error.message);
      return [];
    }
  }

  /**
   * Get pending workflows
   */
  async getPendingWorkflows(companyId) {
    const workflows = await this.getWorkflowsByCompany(companyId);
    return workflows.filter(w => w.status === 'pending');
  }

  /**
   * Get expired workflows
   */
  async getExpiredWorkflows(companyId) {
    const workflows = await this.getWorkflowsByCompany(companyId);
    const now = new Date();
    
    return workflows.filter(w => 
      w.status === 'pending' && new Date(w.expiresAt) < now
    );
  }

  /**
   * Extend workflow expiration
   */
  async extendExpiration(workflowId, additionalDays) {
    try {
      const workflow = await this.loadWorkflow(workflowId);

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const currentExpiry = new Date(workflow.expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      workflow.expiresAt = newExpiry.toISOString();
      workflow.extensionHistory = workflow.extensionHistory || [];
      workflow.extensionHistory.push({
        extendedAt: new Date().toISOString(),
        additionalDays,
        newExpiresAt: newExpiry.toISOString(),
      });

      await this.saveWorkflow(workflow);

      console.log(`      ✅ Workflow expiration extended by ${additionalDays} days`);

      return workflow;
    } catch (error) {
      console.error(`      ❌ Failed to extend workflow:`, error.message);
      throw error;
    }
  }

  /**
   * Delegate approval to another stakeholder
   */
  async delegateApproval(params) {
    const { workflowId, fromStakeholderId, toStakeholderId, reason } = params;

    try {
      const workflow = await this.loadWorkflow(workflowId);

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      if (!workflow.rules.allowDelegation) {
        throw new Error('Delegation is not allowed for this workflow');
      }

      const approverIndex = workflow.approvers.findIndex(
        a => a.stakeholderId === fromStakeholderId
      );

      if (approverIndex === -1) {
        throw new Error(`Stakeholder ${fromStakeholderId} is not an approver`);
      }

      workflow.approvers[approverIndex].delegatedTo = toStakeholderId;
      workflow.approvers[approverIndex].delegationReason = reason;
      workflow.approvers[approverIndex].delegatedAt = new Date().toISOString();

      await this.saveWorkflow(workflow);

      console.log(`      ✅ Approval delegated from ${fromStakeholderId} to ${toStakeholderId}`);

      return workflow;
    } catch (error) {
      console.error(`      ❌ Failed to delegate approval:`, error.message);
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

module.exports = ApprovalWorkflowAgent;
