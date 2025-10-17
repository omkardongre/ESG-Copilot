// Knowledge Base Routes (F6 - Permission-Aware RAG)
const express = require('express');
const router = express.Router();
const knowledgeBaseService = require('../services/knowledge-base-service');
const { checkJwt, extractUserInfo, requirePermission, requireCompanyAccess, requireRole, ROLES } = require('../middleware/auth0');
const { auditMiddleware } = require('../middleware/audit-logger');

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * POST /api/knowledge-base/upload
 * Upload document to knowledge base with permissions
 */
router.post(
  '/upload',
  requireRole(ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT),
  auditMiddleware('upload_document', 'documents'),
  async (req, res) => {
    try {
      const { title, content, companyId, accessLevel, category, tags } = req.body;

      if (!title || !content || !companyId) {
        return res.status(400).json({
          error: 'Missing required fields: title, content, companyId',
        });
      }

      // Check company access
      if (req.user.roles.includes(ROLES.COMPANY_ADMIN) && req.user.companyId !== companyId) {
        return res.status(403).json({
          error: 'You can only upload documents for your own company',
        });
      }

      const result = await knowledgeBaseService.uploadDocument(
        {
          title,
          content,
          companyId,
          accessLevel: accessLevel || 'company',
          category,
          tags,
        },
        req.user.id
      );

      res.status(201).json({
        message: 'Document uploaded successfully',
        ...result,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        error: 'Failed to upload document',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/knowledge-base/search
 * Search knowledge base (permission-filtered)
 */
router.post(
  '/search',
  auditMiddleware('search_knowledge_base', 'documents'),
  async (req, res) => {
    try {
      const { query, topK } = req.body;

      if (!query) {
        return res.status(400).json({
          error: 'Missing required field: query',
        });
      }

      const results = await knowledgeBaseService.search(query, req.user, topK || 5);

      res.json({
        query,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      res.status(500).json({
        error: 'Failed to search knowledge base',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/knowledge-base/ask
 * Ask question and get AI-generated answer (RAG)
 */
router.post(
  '/ask',
  auditMiddleware('ask_question', 'documents'),
  async (req, res) => {
    try {
      const { question } = req.body;

      if (!question) {
        return res.status(400).json({
          error: 'Missing required field: question',
        });
      }

      const result = await knowledgeBaseService.answerQuestion(question, req.user);

      res.json({
        question,
        ...result,
      });
    } catch (error) {
      console.error('Error answering question:', error);
      res.status(500).json({
        error: 'Failed to answer question',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/knowledge-base/documents/:companyId
 * Get all documents for a company
 */
router.get(
  '/documents/:companyId',
  requirePermission('read:companies'),
  auditMiddleware('list_documents', 'documents'),
  async (req, res) => {
    try {
      const { companyId } = req.params;

      const documents = await knowledgeBaseService.getDocuments(companyId, req.user);

      res.json({
        companyId,
        documents,
        count: documents.length,
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({
        error: 'Failed to fetch documents',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/knowledge-base/initialize
 * Initialize knowledge base for user (load accessible documents)
 */
router.post(
  '/initialize',
  auditMiddleware('initialize_knowledge_base', 'documents'),
  async (req, res) => {
    try {
      await knowledgeBaseService.initialize(req.user);

      res.json({
        message: 'Knowledge base initialized successfully',
        user: req.user.email,
      });
    } catch (error) {
      console.error('Error initializing knowledge base:', error);
      res.status(500).json({
        error: 'Failed to initialize knowledge base',
        details: error.message,
      });
    }
  }
);

module.exports = router;
