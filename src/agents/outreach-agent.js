// Outreach Agent
// Manages stakeholder communication, notifications, and approval workflows
// Integrates with Auth0 for secure authorization

const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');
const EmailNotificationAgent = require('./sub-agents/email-notification-agent');
const Auth0AuthorizationAgent = require('./sub-agents/auth0-authorization-agent');
const ApprovalWorkflowAgent = require('./sub-agents/approval-workflow-agent');
const StakeholderManagerAgent = require('./sub-agents/stakeholder-manager-agent');

class OutreachAgent {
  constructor() {
    this.name = 'OutreachAgent';
  }

  /**
   * Main execution - Orchestrate stakeholder outreach
   */
  async execute(state) {
    console.log(`\n📧 [${this.name}] Starting stakeholder outreach...`);

    const startTime = Date.now();
    const { report, review, companyInfo, userId } = state;

    try {
      // Step 1: Get stakeholder list
      console.log(`   👥 Step 1: Loading stakeholders...`);
      const stakeholderManager = new StakeholderManagerAgent();
      const stakeholders = await stakeholderManager.execute({
        companyInfo,
        userId,
        reportType: report?.content?.metadata?.template,
      });

      // Step 2: Create approval workflow
      console.log(`   ✅ Step 2: Creating approval workflow...`);
      const approvalWorkflow = new ApprovalWorkflowAgent();
      const workflow = await approvalWorkflow.execute({
        report,
        review,
        stakeholders,
        companyInfo,
        userId,
      });

      // Step 3: Authorize with Auth0 (async)
      console.log(`   🔐 Step 3: Setting up Auth0 authorization...`);
      const auth0Agent = new Auth0AuthorizationAgent();
      const authSetup = await auth0Agent.execute({
        workflow,
        stakeholders,
        userId,
        companyInfo,
      });

      // Step 4: Send notifications
      console.log(`   📨 Step 4: Sending notifications...`);
      const emailAgent = new EmailNotificationAgent();
      const notifications = await emailAgent.execute({
        workflow,
        stakeholders,
        report,
        review,
        companyInfo,
        authSetup,
      });

      // Compile outreach results
      const outreachResults = {
        stakeholders: stakeholders.list,
        workflow: workflow,
        authorization: authSetup,
        notifications: notifications,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      // Log the action
      const duration = Date.now() - startTime;
      await agentLogger.logAction(
        this.name,
        userId,
        'initiate_outreach',
        { companyInfo, stakeholderCount: stakeholders.list.length },
        { outreachResults },
        'success',
        null,
        duration
      );

      // Broadcast results
      await messageQueue.publishMessage(
        this.name,
        'OrchestratorAgent',
        'outreach_initiated',
        { outreachResults },
        state.taskId
      );

      console.log(`✅ [${this.name}] Outreach initiated successfully`);
      console.log(`   Stakeholders: ${stakeholders.list.length}`);
      console.log(`   Approvers: ${workflow.approvers.length}`);
      console.log(`   Notifications sent: ${notifications.sent.length}`);
      console.log(`   Auth0 tokens generated: ${authSetup.tokensGenerated}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

      return {
        ...state,
        outreach: outreachResults,
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Outreach initiated - ${notifications.sent.length} notifications sent to stakeholders`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);

      await agentLogger.logAction(
        this.name,
        userId,
        'initiate_outreach',
        { companyInfo },
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
   * Process approval response
   */
  async processApproval(state, approvalData) {
    console.log(`\n✅ [${this.name}] Processing approval response...`);

    const { workflowId, stakeholderId, decision, comments, token } = approvalData;

    try {
      // Verify Auth0 token
      const auth0Agent = new Auth0AuthorizationAgent();
      const verified = await auth0Agent.verifyToken(token);

      if (!verified.valid) {
        throw new Error('Invalid or expired authorization token');
      }

      // Update workflow
      const approvalWorkflow = new ApprovalWorkflowAgent();
      const updatedWorkflow = await approvalWorkflow.processApproval({
        workflowId,
        stakeholderId,
        decision,
        comments,
        verifiedUser: verified.user,
      });

      // Check if workflow is complete
      if (updatedWorkflow.status === 'approved') {
        console.log(`   ✅ Workflow approved - proceeding with report publication`);
        await this.publishReport(state, updatedWorkflow);
      } else if (updatedWorkflow.status === 'rejected') {
        console.log(`   ❌ Workflow rejected - notifying stakeholders`);
        await this.notifyRejection(state, updatedWorkflow);
      } else {
        console.log(`   ⏳ Workflow pending - awaiting ${updatedWorkflow.pendingApprovals} more approvals`);
      }

      return {
        ...state,
        outreach: {
          ...state.outreach,
          workflow: updatedWorkflow,
        },
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Approval processing error:`, error.message);
      throw error;
    }
  }

  /**
   * Publish approved report
   */
  async publishReport(state, workflow) {
    console.log(`   📤 Publishing approved report...`);

    const emailAgent = new EmailNotificationAgent();
    
    // Send publication notifications
    await emailAgent.sendPublicationNotification({
      report: state.report,
      workflow,
      companyInfo: state.companyInfo,
    });

    // Log publication
    await agentLogger.logAction(
      this.name,
      state.userId,
      'publish_report',
      { workflowId: workflow.id },
      { publishedAt: new Date().toISOString() },
      'success'
    );
  }

  /**
   * Notify stakeholders of rejection
   */
  async notifyRejection(state, workflow) {
    console.log(`   📧 Notifying stakeholders of rejection...`);

    const emailAgent = new EmailNotificationAgent();
    
    await emailAgent.sendRejectionNotification({
      report: state.report,
      workflow,
      companyInfo: state.companyInfo,
    });
  }

  /**
   * Send reminder notifications
   */
  async sendReminders(state) {
    console.log(`\n🔔 [${this.name}] Sending reminder notifications...`);

    const { outreach } = state;

    if (!outreach || !outreach.workflow) {
      throw new Error('No active workflow found');
    }

    // Find pending approvals
    const pendingApprovers = outreach.workflow.approvers.filter(
      a => a.status === 'pending'
    );

    if (pendingApprovers.length === 0) {
      console.log(`   ℹ️  No pending approvals - skipping reminders`);
      return state;
    }

    const emailAgent = new EmailNotificationAgent();
    
    await emailAgent.sendReminderNotifications({
      workflow: outreach.workflow,
      pendingApprovers,
      companyInfo: state.companyInfo,
    });

    console.log(`   ✅ Sent ${pendingApprovers.length} reminder(s)`);

    return state;
  }

  /**
   * Escalate overdue approvals
   */
  async escalateOverdue(state) {
    console.log(`\n⚠️  [${this.name}] Escalating overdue approvals...`);

    const { outreach } = state;

    if (!outreach || !outreach.workflow) {
      throw new Error('No active workflow found');
    }

    const now = new Date();
    const expiresAt = new Date(outreach.expiresAt);

    // Check if workflow is overdue
    if (now < expiresAt) {
      console.log(`   ℹ️  Workflow not yet overdue - expires at ${expiresAt.toISOString()}`);
      return state;
    }

    // Find escalation contacts
    const stakeholderManager = new StakeholderManagerAgent();
    const escalationContacts = await stakeholderManager.getEscalationContacts({
      companyInfo: state.companyInfo,
      userId: state.userId,
    });

    // Send escalation notifications
    const emailAgent = new EmailNotificationAgent();
    
    await emailAgent.sendEscalationNotifications({
      workflow: outreach.workflow,
      escalationContacts,
      companyInfo: state.companyInfo,
    });

    console.log(`   ✅ Escalated to ${escalationContacts.length} contact(s)`);

    return state;
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId) {
    const approvalWorkflow = new ApprovalWorkflowAgent();
    return await approvalWorkflow.getStatus(workflowId);
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(state, reason) {
    console.log(`\n🚫 [${this.name}] Cancelling workflow...`);

    const approvalWorkflow = new ApprovalWorkflowAgent();
    
    await approvalWorkflow.cancel({
      workflowId: state.outreach.workflow.id,
      reason,
      userId: state.userId,
    });

    // Notify stakeholders
    const emailAgent = new EmailNotificationAgent();
    
    await emailAgent.sendCancellationNotifications({
      workflow: state.outreach.workflow,
      reason,
      companyInfo: state.companyInfo,
    });

    console.log(`   ✅ Workflow cancelled and stakeholders notified`);

    return {
      ...state,
      outreach: {
        ...state.outreach,
        workflow: {
          ...state.outreach.workflow,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          cancelReason: reason,
        },
      },
    };
  }
}

module.exports = OutreachAgent;
