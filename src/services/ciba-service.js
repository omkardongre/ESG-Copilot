// CIBA (Client-Initiated Backchannel Authentication) Service
// Implements Auth0 Asynchronous Authorization for Human-in-the-Loop agent actions

const axios = require('axios');

class CIBAService {
  constructor() {
    this.domain = process.env.AUTH0_DOMAIN;
    this.clientId = process.env.AUTH0_CLIENT_ID;
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET;
    this.audience = process.env.AUTH0_AUDIENCE || 'https://esg-copilot.com/api';
    
    if (!this.domain || !this.clientId || !this.clientSecret) {
      console.warn('⚠️ CIBA Service: Auth0 credentials not configured');
    } else {
      console.log('✅ CIBA Service initialized for asynchronous authorization');
    }
  }

  /**
   * Request user approval for sensitive agent action
   * @param {string} userId - Auth0 user ID (sub claim)
   * @param {string} actionType - Type of action (e.g., 'send_emails', 'publish_report', 'delete_data')
   * @param {object} actionDetails - Detailed context for the action
   * @param {string} bindingMessage - Short message shown to user (max 20 chars)
   * @returns {Promise<{authReqId: string, expiresIn: number}>}
   */
  async requestApproval(userId, actionType, actionDetails, bindingMessage) {
    try {
      console.log(`\n🔐 [CIBA] Requesting user approval for action: ${actionType}`);
      console.log(`   👤 User: ${userId}`);
      console.log(`   📝 Binding Message: "${bindingMessage}"`);
      
      // Build authorization_details for Rich Authorization Request (RAR)
      const authorizationDetails = [{
        type: actionType,
        ...actionDetails,
        timestamp: new Date().toISOString(),
      }];

      // Initiate CIBA request
      const response = await axios.post(
        `https://${this.domain}/bc-authorize`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'openid profile email',
          login_hint: JSON.stringify({
            format: 'iss_sub',
            iss: `https://${this.domain}/`,
            sub: userId,
          }),
          binding_message: bindingMessage,
          audience: this.audience,
          authorization_details: JSON.stringify(authorizationDetails),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { auth_req_id, expires_in } = response.data;
      
      console.log(`✅ [CIBA] Approval request sent`);
      console.log(`   🆔 Auth Request ID: ${auth_req_id}`);
      console.log(`   ⏱️  Expires in: ${expires_in} seconds`);
      console.log(`   📱 User will receive push notification to approve/deny`);

      return {
        authReqId: auth_req_id,
        expiresIn: expires_in,
      };
    } catch (error) {
      console.error('❌ [CIBA] Failed to request approval:', error.response?.data || error.message);
      throw new Error(`CIBA approval request failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Poll for user's approval decision
   * @param {string} authReqId - Auth request ID from requestApproval()
   * @returns {Promise<{approved: boolean, accessToken?: string, error?: string}>}
   */
  async pollApproval(authReqId) {
    try {
      const response = await axios.post(
        `https://${this.domain}/oauth/token`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'urn:openid:params:grant-type:ciba',
          auth_req_id: authReqId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, id_token } = response.data;
      
      console.log(`✅ [CIBA] User APPROVED the action`);
      
      return {
        approved: true,
        accessToken: access_token,
        idToken: id_token,
      };
    } catch (error) {
      const errorCode = error.response?.data?.error;
      
      if (errorCode === 'authorization_pending') {
        // User hasn't responded yet
        return {
          approved: false,
          error: 'pending',
        };
      } else if (errorCode === 'access_denied') {
        // User denied the request
        console.log(`❌ [CIBA] User DENIED the action`);
        return {
          approved: false,
          error: 'denied',
        };
      } else if (errorCode === 'expired_token') {
        // Request expired
        console.log(`⏱️ [CIBA] Approval request EXPIRED`);
        return {
          approved: false,
          error: 'expired',
        };
      } else {
        // Other error
        console.error('❌ [CIBA] Polling error:', error.response?.data || error.message);
        return {
          approved: false,
          error: error.response?.data?.error_description || error.message,
        };
      }
    }
  }

  /**
   * Wait for user approval with polling
   * @param {string} authReqId - Auth request ID
   * @param {number} maxWaitSeconds - Maximum time to wait (default: 120 seconds)
   * @param {number} pollIntervalSeconds - Polling interval (default: 5 seconds)
   * @returns {Promise<{approved: boolean, accessToken?: string, error?: string}>}
   */
  async waitForApproval(authReqId, maxWaitSeconds = 120, pollIntervalSeconds = 5) {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    const pollIntervalMs = pollIntervalSeconds * 1000;

    console.log(`\n⏳ [CIBA] Waiting for user approval (max ${maxWaitSeconds}s)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.pollApproval(authReqId);

      if (result.approved) {
        return result;
      }

      if (result.error === 'denied' || result.error === 'expired') {
        return result;
      }

      // Still pending, wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout
    console.log(`⏱️ [CIBA] Approval request timed out after ${maxWaitSeconds}s`);
    return {
      approved: false,
      error: 'timeout',
    };
  }

  /**
   * Request approval for sending emails to stakeholders
   */
  async requestEmailApproval(userId, emailCount, companyName, recipientEmails) {
    return this.requestApproval(
      userId,
      'send_stakeholder_emails',
      {
        action: 'Send ESG Report Emails',
        company: companyName,
        recipient_count: emailCount,
        recipients: recipientEmails.slice(0, 3), // Show first 3 emails
        description: `Send ESG report to ${emailCount} stakeholder(s)`,
      },
      `Send to ${emailCount} emails`
    );
  }

  /**
   * Request approval for publishing ESG report
   */
  async requestReportPublishApproval(userId, companyName, framework, reportId) {
    return this.requestApproval(
      userId,
      'publish_esg_report',
      {
        action: 'Publish ESG Report',
        company: companyName,
        framework: framework,
        report_id: reportId,
        description: `Publish ${framework} report for ${companyName}`,
      },
      `Publish ${framework} report`
    );
  }

  /**
   * Request approval for deleting company data
   */
  async requestDeleteApproval(userId, companyName, companyId) {
    return this.requestApproval(
      userId,
      'delete_company_data',
      {
        action: 'Delete Company Data',
        company: companyName,
        company_id: companyId,
        description: `Delete all data for ${companyName}`,
        warning: 'This action cannot be undone',
      },
      `Delete ${companyName}`
    );
  }
}

module.exports = new CIBAService();
