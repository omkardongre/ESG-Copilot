const express = require('express');
const router = express.Router();
const { checkJwt, extractUserInfo } = require('../middleware/auth0');
const ChatAgent = require('../agents/chat-agent');
const RAGService = require('../services/rag-service');

/**
 * POST /api/chat
 * AI Chat with Permission-Aware RAG
 * ✅ Company-level data isolation
 * ✅ LangChain.js + Gemini 2.0 Flash
 * ✅ Token Vault for API keys
 */
router.post('/', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id || req.body.companyId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    console.log(`\n💬 Chat request from user: ${userId}`);
    console.log(`   Company: ${companyId}`);
    console.log(`   Message: "${message}"`);

    // ✅ PRODUCTION: Get API keys from Token Vault (JWT)
    const apiKeys = req.user.api_keys || {};
    const googleApiKey = process.env.GOOGLE_API_KEY; // Google API key from .env
    const pineconeApiKey = apiKeys.pinecone_api_key;

    console.log(`   🔍 Debug - Google API Key: ${googleApiKey ? 'Present' : 'MISSING'}`);
    console.log(`   🔍 Debug - Google API Key Type: ${typeof googleApiKey}`);
    console.log(`   🔍 Debug - Google API Key Length: ${googleApiKey?.length || 0}`);
    console.log(`   🔍 Debug - Pinecone API Key: ${pineconeApiKey ? 'Present' : 'MISSING'}`);

    if (!googleApiKey || typeof googleApiKey !== 'string' || googleApiKey.trim() === '') {
      console.error('   ❌ GOOGLE_API_KEY is invalid!');
      console.error('   📝 Value:', googleApiKey);
      console.error('   📝 Type:', typeof googleApiKey);
      return res.status(500).json({
        error: 'Google API key not configured',
        message: 'GOOGLE_API_KEY environment variable is missing or invalid. Please restart the server.',
      });
    }

    if (!pineconeApiKey) {
      return res.status(400).json({
        error: 'Pinecone API key not found in Token Vault',
        message: 'Please configure Pinecone API key in Auth0 Token Vault',
      });
    }

    console.log(`   🔐 Retrieved Pinecone API key from Token Vault`);

    // ✅ OpenFGA: Pass config for fine-grained authorization
    const openFGAConfig = {
      enabled: true,
      storeId: process.env.OPENFGA_STORE_ID || 'default-store',
      apiUrl: process.env.OPENFGA_API_URL || 'https://api.fga.dev',
    };

    // ✅ Extract user permissions from JWT
    const userPermissions = req.user.permissions || [];
    const userEmail = req.user.email || userId;
    const userRoles = req.user.roles || [];

    // Execute Chat Agent with OpenFGA support
    const agent = new ChatAgent({ 
      googleApiKey, 
      pineconeApiKey,
      openFGAConfig, // Pass OpenFGA config for fine-grained authorization
    });
    
    const result = await agent.chat({
      message,
      companyId,
      userId,
      conversationId,
      userPermissions, // Pass user permissions for OpenFGA
      userEmail, // Pass user email for FGA Store
      userRoles, // Pass user roles for FGA Store
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/ingest
 * Ingest documents into RAG knowledge base
 * ✅ Company-level data isolation
 */
router.post('/ingest', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { documents, companyId } = req.body;
    const userId = req.user.id;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: 'Documents array is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    console.log(`\n📚 Ingesting ${documents.length} documents for company: ${companyId}`);

    // ✅ PRODUCTION: Get API keys from Token Vault
    const apiKeys = req.user.api_keys || {};
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const pineconeApiKey = apiKeys.pinecone_api_key;

    if (!pineconeApiKey) {
      return res.status(400).json({
        error: 'Pinecone API key not found in Token Vault',
        message: 'Please configure Pinecone API key in Auth0 Token Vault',
      });
    }

    // Execute RAG ingestion
    const ragService = new RAGService(pineconeApiKey, googleApiKey);
    const results = await ragService.batchAddDocuments({
      documents,
      companyId,
      userId,
    });

    res.json({
      success: true,
      documentsIngested: results.length,
      results,
    });
  } catch (error) {
    console.error('❌ Ingest error:', error);
    res.status(500).json({
      error: 'Failed to ingest documents',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/chat/history/:conversationId
 * Clear conversation history
 */
router.delete('/history/:conversationId', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const companyId = req.user.company_id || req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const apiKeys = req.user.api_keys || {};
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const pineconeApiKey = apiKeys.pinecone_api_key;

    const agent = new ChatAgent({ googleApiKey, pineconeApiKey });
    agent.clearHistory(companyId, conversationId);

    res.json({
      success: true,
      message: 'Conversation history cleared',
    });
  } catch (error) {
    console.error('❌ Clear history error:', error);
    res.status(500).json({
      error: 'Failed to clear history',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/history/:conversationId
 * Get conversation history
 */
router.get('/history/:conversationId', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const companyId = req.user.company_id || req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const apiKeys = req.user.api_keys || {};
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const pineconeApiKey = apiKeys.pinecone_api_key;

    const agent = new ChatAgent({ googleApiKey, pineconeApiKey });
    const history = agent.getHistory(companyId, conversationId);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('❌ Get history error:', error);
    res.status(500).json({
      error: 'Failed to get history',
      message: error.message,
    });
  }
});

module.exports = router;
