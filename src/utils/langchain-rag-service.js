// Modern RAG Implementation with LangChain.js
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const config = require('../config');

class LangChainRAGService {
  constructor() {
    this.vectorStores = new Map(); // Per-user vector stores for permission isolation
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.gemini.apiKey,
      modelName: 'embedding-001', // Google's embedding model
    });
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  /**
   * Initialize vector store for a user with permission-filtered documents
   */
  async initializeForUser(userId, documents) {
    console.log(`🔄 Initializing LangChain RAG for user: ${userId}`);

    // Convert to LangChain Document format with metadata
    const langchainDocs = documents.map(doc => new Document({
      pageContent: doc.content,
      metadata: {
        documentId: doc.document_id,
        companyId: doc.company_id,
        title: doc.title,
        category: doc.category,
        accessLevel: doc.access_level,
      },
    }));

    // Split documents into chunks
    const splitDocs = await this.textSplitter.splitDocuments(langchainDocs);
    console.log(`✂️  Split ${documents.length} documents into ${splitDocs.length} chunks`);

    // Create vector store with embeddings
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      this.embeddings
    );

    // Cache for this user
    this.vectorStores.set(userId, {
      vectorStore,
      lastUpdated: new Date(),
      documentCount: documents.length,
      chunkCount: splitDocs.length,
    });

    console.log(`✅ Vector store initialized for user ${userId}`);

    return {
      documentCount: documents.length,
      chunkCount: splitDocs.length,
    };
  }

  /**
   * Search with semantic similarity (permission-filtered)
   */
  async search(userId, query, topK = 5) {
    const userStore = this.vectorStores.get(userId);
    
    if (!userStore) {
      throw new Error('Vector store not initialized for user. Call initializeForUser first.');
    }

    console.log(`🔍 Searching for: "${query}" (user: ${userId})`);

    // Semantic search using embeddings
    const results = await userStore.vectorStore.similaritySearchWithScore(query, topK);

    // Format results
    const formattedResults = results.map(([doc, score]) => ({
      content: doc.pageContent,
      score: score,
      metadata: doc.metadata,
      similarity: 1 - score, // Convert distance to similarity (0-1)
    }));

    console.log(`✅ Found ${formattedResults.length} relevant chunks`);

    return formattedResults;
  }

  /**
   * Answer question using RAG with LangChain
   */
  async answerQuestion(userId, question, geminiClient) {
    console.log(`❓ Answering question with LangChain RAG: "${question}"`);

    // Search for relevant context
    const relevantDocs = await this.search(userId, question, 3);

    if (relevantDocs.length === 0) {
      return {
        answer: "I don't have enough information to answer that question based on your accessible documents.",
        sources: [],
        method: 'langchain-rag',
      };
    }

    // Build context from retrieved documents
    const context = relevantDocs
      .map((doc, i) => `[${i + 1}] ${doc.content}`)
      .join('\n\n');

    // Generate answer using Gemini
    const prompt = `
You are an ESG (Environmental, Social, Governance) compliance expert assistant.

Answer the following question based ONLY on the provided context. If the context doesn't contain enough information, say so.

Context:
${context}

Question: ${question}

Provide a clear, concise answer. Reference the context sources using [1], [2], etc.
`;

    try {
      const answer = await geminiClient.generateContent(prompt);

      return {
        answer: answer,
        sources: relevantDocs.map((doc, i) => ({
          index: i + 1,
          content: doc.content.substring(0, 200) + '...',
          similarity: doc.similarity,
          metadata: doc.metadata,
        })),
        method: 'langchain-rag',
        contextUsed: relevantDocs.length,
      };
    } catch (error) {
      console.error('Error generating answer:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Add new document to existing vector store
   */
  async addDocument(userId, document) {
    const userStore = this.vectorStores.get(userId);
    
    if (!userStore) {
      throw new Error('Vector store not initialized for user.');
    }

    // Convert to LangChain Document
    const langchainDoc = new Document({
      pageContent: document.content,
      metadata: {
        documentId: document.document_id,
        companyId: document.company_id,
        title: document.title,
        category: document.category,
        accessLevel: document.access_level,
      },
    });

    // Split into chunks
    const splitDocs = await this.textSplitter.splitDocuments([langchainDoc]);

    // Add to vector store
    await userStore.vectorStore.addDocuments(splitDocs);

    userStore.documentCount += 1;
    userStore.chunkCount += splitDocs.length;
    userStore.lastUpdated = new Date();

    console.log(`✅ Added document to vector store: ${document.title}`);

    return {
      chunksAdded: splitDocs.length,
    };
  }

  /**
   * Get vector store stats for user
   */
  getStats(userId) {
    const userStore = this.vectorStores.get(userId);
    
    if (!userStore) {
      return null;
    }

    return {
      documentCount: userStore.documentCount,
      chunkCount: userStore.chunkCount,
      lastUpdated: userStore.lastUpdated,
      initialized: true,
    };
  }

  /**
   * Clear vector store for user
   */
  clearUserStore(userId) {
    this.vectorStores.delete(userId);
    console.log(`🗑️  Cleared vector store for user: ${userId}`);
  }

  /**
   * Clear all vector stores
   */
  clearAll() {
    this.vectorStores.clear();
    console.log(`🗑️  Cleared all vector stores`);
  }
}

module.exports = new LangChainRAGService();
