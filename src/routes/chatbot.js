// AI Chatbot Routes
const express = require('express');
const router = express.Router();
const chatbotService = require('../services/chatbot-service');
const { checkJwt, extractUserInfo, requireCompanyAccess } = require('../middleware/auth0');
const { auditMiddleware } = require('../middleware/audit-logger');

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * POST /api/chatbot/chat
 * Send message to AI chatbot
 */
router.post(
  '/chat',
  auditMiddleware('chat_message', 'chat'),
  async (req, res) => {
    try {
      const { message, companyId } = req.body;

      if (!message) {
        return res.status(400).json({
          error: 'Missing required field: message',
        });
      }

      const result = await chatbotService.chat(message, req.user, companyId);

      res.json({
        message,
        ...result,
      });
    } catch (error) {
      console.error('Error processing chat message:', error);
      res.status(500).json({
        error: 'Failed to process chat message',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/chatbot/history/:companyId
 * Get chat history for a company
 */
router.get(
  '/history/:companyId',
  requireCompanyAccess,
  auditMiddleware('view_chat_history', 'chat'),
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const { limit } = req.query;

      const history = await chatbotService.getChatHistory(
        req.user.id,
        companyId,
        parseInt(limit) || 10
      );

      res.json({
        companyId,
        history,
        count: history.length,
      });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({
        error: 'Failed to fetch chat history',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/chatbot/suggestions/:companyId
 * Get suggested questions
 */
router.get(
  '/suggestions/:companyId',
  requireCompanyAccess,
  async (req, res) => {
    try {
      const { companyId } = req.params;

      const suggestions = await chatbotService.getSuggestedQuestions(req.user, companyId);

      res.json({
        companyId,
        suggestions,
      });
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      res.status(500).json({
        error: 'Failed to fetch suggestions',
        details: error.message,
      });
    }
  }
);

module.exports = router;
