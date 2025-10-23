const express = require('express');
const router = express.Router();
const { checkJwt, extractUserInfo } = require('../middleware/auth0');
const OutreachAgent = require('../agents/outreach-agent');

/**
 * POST /api/outreach/send/:companyId/:reportId
 * Send email notifications to stakeholders
 * ✅ Uses Token Vault for SendGrid API key
 * ✅ No fallback logic - production-ready
 */
router.post('/send/:companyId/:reportId', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { companyId, reportId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log(`\n📧 Sending outreach for company: ${companyId}, report: ${reportId}`);
    console.log(`   User: ${userEmail}`);

    // ✅ PRODUCTION: Get SendGrid API key from Token Vault (JWT)
    const apiKeys = req.user.api_keys || {};
    const sendgridApiKey = apiKeys.sendgrid_api_key;

    if (!sendgridApiKey) {
      return res.status(400).json({
        error: 'SendGrid API key not found in Token Vault',
        message: 'Please configure SendGrid API key in Auth0 Token Vault',
      });
    }

    console.log(`   🔐 Retrieved SendGrid API key from Token Vault`);

    // Execute Outreach Agent
    const agent = new OutreachAgent(sendgridApiKey);
    const result = await agent.execute({
      companyId,
      reportId,
      userId,
      userEmail,
      taskId: `outreach-${Date.now()}`,
    });

    if (result.errors && result.errors.length > 0) {
      return res.status(500).json({
        error: 'Outreach failed',
        details: result.errors,
      });
    }

    res.json({
      success: true,
      outreach: result.outreach,
      message: `Outreach completed - ${result.outreach.emails_sent} emails sent`,
    });
  } catch (error) {
    console.error('❌ Outreach error:', error);
    res.status(500).json({
      error: 'Failed to send outreach',
      message: error.message,
    });
  }
});

/**
 * GET /api/outreach/status/:outreachId
 * Get outreach status
 */
router.get('/status/:outreachId', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { outreachId } = req.params;

    // In production, fetch from database
    res.json({
      outreach_id: outreachId,
      status: 'completed',
      message: 'Outreach status endpoint - implement database lookup',
    });
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      error: 'Failed to get outreach status',
      message: error.message,
    });
  }
});

module.exports = router;
