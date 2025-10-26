/**
 * Chat Agent - AI Chat with Permission-Aware RAG
 * ✅ LangChain.js for RAG pipeline
 * ✅ Google Gemini 2.0 Flash for chat
 * ✅ Company-level data isolation
 * ✅ Conversation history
 * ✅ No knowledge leakage between companies
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const RAGService = require('../services/rag-service');
const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');

class ChatAgent {
  constructor({ googleApiKey, pineconeApiKey, openFGAConfig = null }) {
    this.name = 'ChatAgent';
    
    // ✅ PRODUCTION: Validate API keys
    if (!googleApiKey) {
      throw new Error('Google API key is required for ChatAgent');
    }
    if (!pineconeApiKey) {
      throw new Error('Pinecone API key is required for ChatAgent');
    }
    
    this.googleApiKey = googleApiKey;
    this.pineconeApiKey = pineconeApiKey;
    this.openFGAConfig = openFGAConfig;
    
    // Initialize Google Generative AI (direct SDK, not LangChain)
    console.log(`   🔧 [ChatAgent] Initializing Google Generative AI...`);
    
    try {
      const genAI = new GoogleGenerativeAI(this.googleApiKey);
      const modelName = process.env.MODEL || 'gemini-pro';
      const temperature = parseFloat(process.env.TEMPERATURE) || 0.7;
      
      this.model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: temperature,
          topP: parseFloat(process.env.TOP_P) || 0.95,
          topK: parseInt(process.env.TOP_K) || 40,
          maxOutputTokens: 2048,
        },
      });
      console.log(`   ✅ [ChatAgent] Google Generative AI initialized with ${modelName}`);
    } catch (error) {
      console.error(`   ❌ [ChatAgent] Failed to initialize AI:`, error.message);
      throw error;
    }
    
    // ✅ Initialize RAG service with OpenFGA support
    this.ragService = new RAGService(pineconeApiKey, googleApiKey, openFGAConfig);
    
    // Log OpenFGA status
    if (openFGAConfig) {
      const status = this.ragService.getOpenFGAStatus();
      console.log(`   🔐 [ChatAgent] OpenFGA: ${status.enabled ? '✅ Active' : '⚠️ Not initialized'}`);
    }
    
    // Conversation history (in-memory, move to Redis for production)
    this.conversationHistory = new Map();
  }

  /**
   * Chat with user using RAG context
   */
  async chat({ message, companyId, userId, conversationId, userPermissions = [], userEmail, userRoles = [] }) {
    console.log(`\n [${this.name}] Processing chat message...`);
    console.log(`   User: ${userId}`);
    console.log(`   Company: ${companyId}`);
    console.log(`   Message: "${message}"`);
    if (this.openFGAConfig) {
      console.log(`   OpenFGA: Active`);
      console.log(`   Permissions: ${userPermissions.join(', ')}`);
    }

    const startTime = Date.now();

    try {
      // CRITICAL: Verify API keys from Token Vault
      if (!this.googleApiKey || !this.pineconeApiKey) {
        throw new Error('API keys not found in Token Vault. Please configure Google API and Pinecone API keys in Auth0.');
      }

      // Step 1: Retrieve relevant context from RAG (Auth0 FGA Store authorization)
      console.log(`   Step 1: Querying RAG with Auth0 FGA Store authorization...`);
      
      // Use External FGA Store for production-level authorization
      const ragResults = await this.ragService.queryWithFGAStore({
        query: message,
        userId,
        userEmail: userEmail || userId, // Use email for FGA
        userRoles: userRoles || [],
        companyId, // ✅ Filter by selected company
        topK: 3,
      });

      console.log(`   [FGA Store] Found ${ragResults.length} authorized documents`);

      // Step 2: Build context from RAG results
      const context = ragResults.map((result, idx) => 
        `[Document ${idx + 1}] (Score: ${result.score.toFixed(3)})\n${result.text}`
      ).join('\n\n');

      // Step 3: Get conversation history
      const historyKey = `${companyId}-${conversationId || userId}`;
      const history = this.conversationHistory.get(historyKey) || [];

      // Step 4: Build prompt with RAG context
      const systemPrompt = `You are an ESG (Environmental, Social, Governance) expert assistant helping companies with sustainability reporting and compliance.

**CRITICAL RULES:**
1. ONLY use information from the provided context documents
2. If the context doesn't contain relevant information, say "I don't have enough information about that in your company's data"
3. NEVER make up information or use general knowledge
4. Always cite which document you're referencing (e.g., "According to Document 1...")
5. Focus on the specific company's data - do not discuss other companies

**Context from company's knowledge base:**
${context || 'No relevant documents found in knowledge base.'}

**Conversation History:**
${history.map(h => `${h.role}: ${h.content}`).join('\n')}

**Current Question:**
User: ${message}

Provide a helpful, accurate response based ONLY on the context above.`;

      // Step 5: Call Google Generative AI
      console.log(`   🤖 Step 2 : Generating AI response...`);
      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const aiMessage = response.text();

      console.log(`   ✅ AI response generated (${aiMessage.length} chars)`);

      // Step 6: Update conversation history
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: aiMessage });
      
      // Keep last 10 messages
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }
      
      this.conversationHistory.set(historyKey, history);

      // Step 7: Prepare response
      const chatResult = {
        message: aiMessage,
        sources: ragResults.map(r => ({
          text: r.text.substring(0, 200) + '...',
          score: r.score,
          metadata: r.metadata,
        })),
        conversationId: conversationId || userId,
        timestamp: new Date().toISOString(),
      };

      // Log the action
      const duration = Date.now() - startTime;
      await agentLogger.logAction(
        this.name,
        userId,
        'chat',
        { companyId, message: message.substring(0, 100) },
        { response: aiMessage.substring(0, 100), sourcesCount: ragResults.length },
        'success',
        null,
        duration
      );

      // Broadcast results
      await messageQueue.publishMessage(
        this.name,
        'OrchestratorAgent',
        'chat_completed',
        { chatResult },
        `chat-${Date.now()}`
      );

      console.log(`✅ [${this.name}] Chat completed successfully`);
      console.log(`   Response length: ${aiMessage.length} chars`);
      console.log(`   Sources used: ${ragResults.length}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

      return chatResult;
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);

      await agentLogger.logAction(
        this.name,
        userId,
        'chat',
        { companyId, message },
        null,
        'error',
        error
      );

      throw error;
    }
  }

  /**
   * ✅ PRODUCTION: Clear conversation history
   */
  clearHistory(companyId, conversationId) {
    const historyKey = `${companyId}-${conversationId}`;
    this.conversationHistory.delete(historyKey);
    console.log(`✅ Cleared conversation history: ${historyKey}`);
  }

  /**
   * ✅ PRODUCTION: Get conversation history
   */
  getHistory(companyId, conversationId) {
    const historyKey = `${companyId}-${conversationId}`;
    return this.conversationHistory.get(historyKey) || [];
  }
}

module.exports = ChatAgent;
