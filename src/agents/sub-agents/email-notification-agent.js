// Email Notification Sub-Agent
// Sends professional email notifications using Nodemailer
// Supports HTML templates, attachments, and tracking

const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailNotificationAgent {
  constructor() {
    this.name = 'EmailNotificationAgent';
    this.transporter = this.createTransporter();
  }

  /**
   * Create Nodemailer transporter
   */
  createTransporter() {
    // Support multiple email providers
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

    if (emailProvider === 'gmail') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
        },
      });
    } else if (emailProvider === 'sendgrid') {
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });
    } else {
      // Generic SMTP
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }

  /**
   * Execute email notifications
   */
  async execute(params) {
    const { workflow, stakeholders, report, review, companyInfo, authSetup } = params;

    console.log(`      📧 [${this.name}] Sending notifications...`);

    try {
      const sent = [];
      const failed = [];

      // Send to each approver
      for (const approver of workflow.approvers) {
        try {
          const stakeholder = stakeholders.list.find(s => s.id === approver.stakeholderId);
          
          if (!stakeholder || !stakeholder.email) {
            console.warn(`      ⚠️  No email for stakeholder ${approver.stakeholderId}`);
            failed.push({ stakeholderId: approver.stakeholderId, reason: 'No email address' });
            continue;
          }

          // Get approval token for this stakeholder
          const token = authSetup.tokens.find(t => t.stakeholderId === approver.stakeholderId);

          // Send approval request email
          await this.sendApprovalRequest({
            stakeholder,
            workflow,
            report,
            review,
            companyInfo,
            token: token?.token,
          });

          sent.push({
            stakeholderId: approver.stakeholderId,
            email: stakeholder.email,
            sentAt: new Date().toISOString(),
          });

          console.log(`      ✓ Sent to ${stakeholder.email}`);
        } catch (error) {
          console.error(`      ✗ Failed to send to ${approver.stakeholderId}:`, error.message);
          failed.push({
            stakeholderId: approver.stakeholderId,
            reason: error.message,
          });
        }
      }

      // Send CC notifications to observers
      const observers = stakeholders.list.filter(s => s.role === 'observer');
      for (const observer of observers) {
        try {
          await this.sendObserverNotification({
            stakeholder: observer,
            workflow,
            report,
            companyInfo,
          });

          sent.push({
            stakeholderId: observer.id,
            email: observer.email,
            sentAt: new Date().toISOString(),
            type: 'observer',
          });
        } catch (error) {
          console.warn(`      ⚠️  Failed to notify observer ${observer.email}:`, error.message);
        }
      }

      console.log(`      ✅ Sent ${sent.length} notifications, ${failed.length} failed`);

      return {
        sent,
        failed,
        totalSent: sent.length,
        totalFailed: failed.length,
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw error;
    }
  }

  /**
   * Send approval request email
   */
  async sendApprovalRequest(params) {
    const { stakeholder, workflow, report, review, companyInfo, token } = params;

    const approvalUrl = this.generateApprovalUrl(workflow.id, stakeholder.id, token);
    const rejectUrl = this.generateRejectUrl(workflow.id, stakeholder.id, token);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 30px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .approve { background: #28a745; color: white; }
    .reject { background: #dc3545; color: white; }
    .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .score { font-size: 24px; font-weight: bold; color: #667eea; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ESG Report Approval Request</h1>
    </div>
    <div class="content">
      <p>Dear ${stakeholder.name},</p>
      
      <p>A new ESG report for <strong>${companyInfo.name}</strong> is ready for your review and approval.</p>
      
      <div class="info-box">
        <h3>Report Details</h3>
        <p><strong>Framework:</strong> ${report.content?.metadata?.template}</p>
        <p><strong>Reporting Period:</strong> ${report.content?.metadata?.reportingPeriod}</p>
        <p><strong>Generated:</strong> ${new Date(report.content?.metadata?.generatedDate).toLocaleDateString()}</p>
      </div>

      <div class="info-box">
        <h3>Quality Assessment</h3>
        <p><strong>Overall Quality Score:</strong> <span class="score">${review?.qualityScore?.overall || 'N/A'}/100</span></p>
        <p><strong>Validation Score:</strong> ${review?.qualityScore?.validation || 'N/A'}/100</p>
        <p><strong>Data Quality:</strong> ${review?.qualityScore?.dataQuality || 'N/A'}/100</p>
        <p><strong>Benchmark Performance:</strong> ${review?.benchmarks?.overallPerformance || 'N/A'}</p>
        <p><strong>Anomalies Found:</strong> ${review?.anomalies?.totalAnomalies || 0}</p>
      </div>

      ${review?.feedback && review.feedback.length > 0 ? `
      <div class="info-box">
        <h3>Key Feedback Items</h3>
        <ul>
          ${review.feedback.slice(0, 3).map(f => `<li><strong>${f.category}:</strong> ${f.issue}</li>`).join('')}
        </ul>
        ${review.feedback.length > 3 ? `<p><em>...and ${review.feedback.length - 3} more items</em></p>` : ''}
      </div>
      ` : ''}

      <div class="info-box">
        <h3>Approval Workflow</h3>
        <p><strong>Workflow ID:</strong> ${workflow.id}</p>
        <p><strong>Required Approvals:</strong> ${workflow.requiredApprovals}</p>
        <p><strong>Expires:</strong> ${new Date(workflow.expiresAt).toLocaleDateString()}</p>
      </div>

      <p><strong>Action Required:</strong></p>
      <p>Please review the report and provide your decision:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${approvalUrl}" class="button approve">✅ Approve Report</a>
        <a href="${rejectUrl}" class="button reject">❌ Reject Report</a>
      </div>

      <p style="font-size: 12px; color: #666;">
        <strong>Note:</strong> This approval link is valid for 7 days and can only be used once. 
        If you have questions, please contact the report administrator.
      </p>
    </div>
    <div class="footer">
      <p>This is an automated notification from SustainaPilot ESG Platform</p>
      <p>&copy; ${new Date().getFullYear()} ${companyInfo.name}</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
      to: stakeholder.email,
      subject: `[Action Required] ESG Report Approval - ${companyInfo.name}`,
      html: htmlContent,
      text: this.generatePlainTextVersion(stakeholder, workflow, report, review, companyInfo, approvalUrl, rejectUrl),
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Send observer notification
   */
  async sendObserverNotification(params) {
    const { stakeholder, workflow, report, companyInfo } = params;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ESG Report - FYI</h1>
    </div>
    <div class="content">
      <p>Dear ${stakeholder.name},</p>
      
      <p>This is to inform you that a new ESG report for <strong>${companyInfo.name}</strong> has been submitted for approval.</p>
      
      <div class="info-box">
        <h3>Report Details</h3>
        <p><strong>Framework:</strong> ${report.content?.metadata?.template}</p>
        <p><strong>Reporting Period:</strong> ${report.content?.metadata?.reportingPeriod}</p>
        <p><strong>Status:</strong> Pending Approval</p>
        <p><strong>Required Approvals:</strong> ${workflow.requiredApprovals}</p>
      </div>

      <p>You will be notified once the report has been approved and published.</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
      to: stakeholder.email,
      subject: `[FYI] ESG Report Submitted for Approval - ${companyInfo.name}`,
      html: htmlContent,
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Send publication notification
   */
  async sendPublicationNotification(params) {
    const { report, workflow, companyInfo } = params;

    const stakeholderEmails = workflow.approvers
      .map(a => a.email)
      .filter(Boolean);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ ESG Report Published</h1>
    </div>
    <div class="content">
      <p>The ESG report for <strong>${companyInfo.name}</strong> has been approved and published.</p>
      <p><strong>Framework:</strong> ${report.content?.metadata?.template}</p>
      <p><strong>Published:</strong> ${new Date().toLocaleDateString()}</p>
      <p>Thank you for your participation in the approval process.</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
      to: stakeholderEmails,
      subject: `✅ ESG Report Published - ${companyInfo.name}`,
      html: htmlContent,
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Send rejection notification
   */
  async sendRejectionNotification(params) {
    const { report, workflow, companyInfo } = params;

    const rejector = workflow.approvers.find(a => a.status === 'rejected');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ ESG Report Rejected</h1>
    </div>
    <div class="content">
      <p>The ESG report for <strong>${companyInfo.name}</strong> has been rejected.</p>
      <p><strong>Rejected by:</strong> ${rejector?.name || 'Unknown'}</p>
      <p><strong>Comments:</strong> ${rejector?.comments || 'No comments provided'}</p>
      <p>The report will need to be revised and resubmitted.</p>
    </div>
  </div>
</body>
</html>
    `;

    const stakeholderEmails = workflow.approvers
      .map(a => a.email)
      .filter(Boolean);

    const mailOptions = {
      from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
      to: stakeholderEmails,
      subject: `❌ ESG Report Rejected - ${companyInfo.name}`,
      html: htmlContent,
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Send reminder notifications
   */
  async sendReminderNotifications(params) {
    const { workflow, pendingApprovers, companyInfo } = params;

    for (const approver of pendingApprovers) {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ffc107; color: #333; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Reminder: ESG Report Approval Pending</h1>
    </div>
    <div class="content">
      <p>Dear ${approver.name},</p>
      <p>This is a friendly reminder that your approval is still pending for the ESG report.</p>
      <p><strong>Company:</strong> ${companyInfo.name}</p>
      <p><strong>Expires:</strong> ${new Date(workflow.expiresAt).toLocaleDateString()}</p>
      <p>Please review and provide your decision at your earliest convenience.</p>
    </div>
  </div>
</body>
</html>
      `;

      const mailOptions = {
        from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
        to: approver.email,
        subject: `🔔 Reminder: ESG Report Approval Pending - ${companyInfo.name}`,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
    }
  }

  /**
   * Send escalation notifications
   */
  async sendEscalationNotifications(params) {
    const { workflow, escalationContacts, companyInfo } = params;

    for (const contact of escalationContacts) {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Escalation: Overdue ESG Report Approval</h1>
    </div>
    <div class="content">
      <p>Dear ${contact.name},</p>
      <p>An ESG report approval workflow has expired without completion.</p>
      <p><strong>Company:</strong> ${companyInfo.name}</p>
      <p><strong>Workflow ID:</strong> ${workflow.id}</p>
      <p><strong>Expired:</strong> ${new Date(workflow.expiresAt).toLocaleDateString()}</p>
      <p><strong>Pending Approvals:</strong> ${workflow.pendingApprovals}</p>
      <p>Please take appropriate action to resolve this issue.</p>
    </div>
  </div>
</body>
</html>
      `;

      const mailOptions = {
        from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
        to: contact.email,
        subject: `⚠️ Escalation: Overdue ESG Report Approval - ${companyInfo.name}`,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
    }
  }

  /**
   * Send cancellation notifications
   */
  async sendCancellationNotifications(params) {
    const { workflow, reason, companyInfo } = params;

    const stakeholderEmails = workflow.approvers
      .map(a => a.email)
      .filter(Boolean);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6c757d; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚫 ESG Report Workflow Cancelled</h1>
    </div>
    <div class="content">
      <p>The ESG report approval workflow for <strong>${companyInfo.name}</strong> has been cancelled.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>No further action is required.</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${companyInfo.name} ESG Team" <${process.env.EMAIL_USER}>`,
      to: stakeholderEmails,
      subject: `🚫 ESG Report Workflow Cancelled - ${companyInfo.name}`,
      html: htmlContent,
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Generate approval URL
   */
  generateApprovalUrl(workflowId, stakeholderId, token) {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/approval/approve?workflow=${workflowId}&stakeholder=${stakeholderId}&token=${token}`;
  }

  /**
   * Generate reject URL
   */
  generateRejectUrl(workflowId, stakeholderId, token) {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/approval/reject?workflow=${workflowId}&stakeholder=${stakeholderId}&token=${token}`;
  }

  /**
   * Generate plain text version
   */
  generatePlainTextVersion(stakeholder, workflow, report, review, companyInfo, approvalUrl, rejectUrl) {
    return `
ESG Report Approval Request

Dear ${stakeholder.name},

A new ESG report for ${companyInfo.name} is ready for your review and approval.

Report Details:
- Framework: ${report.content?.metadata?.template}
- Reporting Period: ${report.content?.metadata?.reportingPeriod}
- Quality Score: ${review?.qualityScore?.overall || 'N/A'}/100

Action Required:
Please review the report and provide your decision:

Approve: ${approvalUrl}
Reject: ${rejectUrl}

This link is valid for 7 days.

---
This is an automated notification from SustainaPilot ESG Platform
© ${new Date().getFullYear()} ${companyInfo.name}
    `.trim();
  }
}

module.exports = EmailNotificationAgent;
