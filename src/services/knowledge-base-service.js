// Permission-Aware RAG Knowledge Base Service (F6)
// Now using LangChain.js for modern RAG implementation
const { v4: uuidv4 } = require('uuid');
const bigQueryClient = require('../utils/bigquery-client');
const embeddingService = require('../utils/embedding-service'); // Fallback
const langchainRAG = require('../utils/langchain-rag-service'); // Modern RAG
const geminiClient = require('../utils/gemini-client');

class KnowledgeBaseService {
  constructor() {
    // Dual implementation: LangChain (modern) + hash-based (fallback)
    this.useLangChain = true; // Toggle for modern vs simple
    this.documentChunks = new Map(); // Fallback storage
    this.initialized = false;
  }

  /**
   * Upload and index a document with permissions
   * This is the KEY feature - documents are tagged with company_id and access_level
   */
  async uploadDocument(documentData, userId) {
    const {
      title,
      content,
      companyId,
      accessLevel, // 'public', 'company', 'admin_only'
      category, // 'regulation', 'standard', 'policy', 'report'
      tags,
    } = documentData;

    if (!title || !content || !companyId) {
      throw new Error('Missing required fields: title, content, companyId');
    }

    console.log(`📄 Uploading document: ${title} for company ${companyId}`);

    // Generate document ID
    const documentId = uuidv4();

    // Chunk the document
    const chunks = embeddingService.chunkDocument(content);
    console.log(`✂️  Split into ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    const chunksWithEmbeddings = [];
    for (const chunk of chunks) {
      const embedding = embeddingService.generateEmbedding(chunk.content);
      
      const chunkId = uuidv4();
      chunksWithEmbeddings.push({
        chunk_id: chunkId,
        document_id: documentId,
        company_id: companyId,
        chunk_index: chunk.index,
        content: chunk.content,
        embedding: JSON.stringify(embedding), // Store as JSON in BigQuery
        created_at: new Date().toISOString(),
      });

      // Cache in memory for fast retrieval
      this.documentChunks.set(chunkId, {
        chunk_id: chunkId,
        document_id: documentId,
        company_id: companyId,
        content: chunk.content,
        embedding: embedding,
        access_level: accessLevel,
      });
    }

    // Store document metadata in BigQuery
    const documentRecord = {
      document_id: documentId,
      company_id: companyId,
      title: title,
      category: category || 'general',
      access_level: accessLevel || 'company',
      tags: tags ? JSON.stringify(tags) : null,
      chunk_count: chunks.length,
      uploaded_by: userId,
      created_at: new Date().toISOString(),
    };

    await bigQueryClient.insert('documents', [documentRecord]);

    // Store chunks in BigQuery
    await bigQueryClient.insert('document_chunks', chunksWithEmbeddings);

    console.log(`✅ Document uploaded: ${documentId} with ${chunks.length} chunks`);

    return {
      documentId,
      title,
      chunkCount: chunks.length,
      companyId,
      accessLevel,
    };
  }

  /**
   * Initialize RAG system by loading documents for a user
   * This implements "Limit Knowledge" - only load accessible documents
   */
  async initialize(user) {
    console.log(`🔄 Initializing knowledge base for user: ${user.email}`);

    // Get documents user can access (PERMISSION FILTERING!)
    const accessibleDocuments = await this.getAccessibleDocuments(user);

    console.log(`📚 Found ${accessibleDocuments.length} accessible documents`);

    if (this.useLangChain && accessibleDocuments.length > 0) {
      // Modern approach: Use LangChain with Google embeddings
      try {
        const stats = await langchainRAG.initializeForUser(user.id, accessibleDocuments);
        console.log(`✅ LangChain RAG initialized: ${stats.documentCount} docs, ${stats.chunkCount} chunks`);
        this.initialized = true;
        return stats;
      } catch (error) {
        console.error('❌ LangChain initialization failed, falling back to hash-based:', error);
        this.useLangChain = false; // Fallback
      }
    }

    // Fallback: Hash-based embeddings
    this.documentChunks.clear();
    
    if (accessibleDocuments.length > 0) {
      const documentIds = accessibleDocuments.map(d => d.document_id);
      
      const query = `
        SELECT *
        FROM \`${bigQueryClient.datasetId}.document_chunks\`
        WHERE document_id IN UNNEST(@documentIds)
      `;

      const chunks = await bigQueryClient.query(query, [documentIds]);

      // Cache chunks with embeddings
      for (const chunk of chunks) {
        const embedding = JSON.parse(chunk.embedding);
        const doc = accessibleDocuments.find(d => d.document_id === chunk.document_id);
        
        this.documentChunks.set(chunk.chunk_id, {
          chunk_id: chunk.chunk_id,
          document_id: chunk.document_id,
          company_id: chunk.company_id,
          content: chunk.content,
          embedding: embedding,
          access_level: doc.access_level,
        });
      }

      console.log(`✅ Loaded ${chunks.length} chunks into memory (hash-based fallback)`);
    }

    this.initialized = true;
  }

  /**
   * Get documents accessible to user (CRITICAL for "Limit Knowledge")
   */
  async getAccessibleDocuments(user) {
    let query = `
      SELECT *
      FROM \`${bigQueryClient.datasetId}.documents\`
      WHERE 1=1
    `;

    const params = [];

    // Permission logic based on role
    if (user.roles.includes('Auditor') || user.roles.includes('Regulator')) {
      // Auditors and Regulators see all documents
      query += ` ORDER BY created_at DESC`;
    } else if (user.roles.includes('ESG Consultant')) {
      // Consultants see their clients' documents
      // For demo, we'll show all for now
      query += ` ORDER BY created_at DESC`;
    } else if (user.roles.includes('Company Admin')) {
      // Company Admins only see their company's documents
      query += ` AND company_id = @companyId`;
      params.push(user.companyId);
      query += ` ORDER BY created_at DESC`;
    } else {
      // Default: no access
      return [];
    }

    return await bigQueryClient.query(query, params);
  }

  /**
   * Search knowledge base with permission filtering (RAG Query)
   * This is the CORE RAG functionality with Auth0 "Limit Knowledge"
   */
  async search(query, user, topK = 5) {
    if (!this.initialized) {
      await this.initialize(user);
    }

    console.log(`🔍 Searching knowledge base: "${query}" for user: ${user.email}`);

    if (this.useLangChain) {
      // Modern approach: LangChain semantic search
      try {
        const results = await langchainRAG.search(user.id, query, topK);
        console.log(`✅ LangChain found ${results.length} relevant chunks`);
        
        return results.map(r => ({
          documentId: r.metadata.documentId,
          content: r.content,
          similarity: r.similarity,
          companyId: r.metadata.companyId,
          method: 'langchain',
        }));
      } catch (error) {
        console.error('❌ LangChain search failed, falling back:', error);
        this.useLangChain = false;
      }
    }

    // Fallback: Hash-based search
    const queryEmbedding = embeddingService.generateEmbedding(query);

    // Get ONLY chunks user can access (PERMISSION FILTERING!)
    const accessibleChunks = Array.from(this.documentChunks.values()).filter(chunk => {
      // Filter by company access
      if (user.roles.includes('Auditor') || user.roles.includes('Regulator')) {
        return true; // See all
      } else if (user.roles.includes('Company Admin')) {
        return chunk.company_id === user.companyId;
      } else if (user.roles.includes('ESG Consultant')) {
        return true; // For demo, consultants see all
      }
      return false;
    });

    console.log(`📊 Searching ${accessibleChunks.length} accessible chunks (hash-based)`);

    if (accessibleChunks.length === 0) {
      return [];
    }

    // Find similar chunks
    const results = embeddingService.findSimilar(queryEmbedding, accessibleChunks, topK);

    console.log(`✅ Found ${results.length} relevant chunks`);

    return results.map(r => ({
      documentId: r.document_id,
      content: r.content,
      similarity: r.similarity,
      companyId: r.company_id,
      method: 'hash-based',
    }));
  }

  /**
   * Answer question using RAG
   */
  async answerQuestion(question, user) {
    console.log(`❓ Answering question: "${question}"`);

    // Search knowledge base (permission-filtered)
    const relevantChunks = await this.search(question, user, 3);

    if (relevantChunks.length === 0) {
      return {
        answer: "I don't have enough information to answer that question based on your accessible documents.",
        sources: [],
      };
    }

    // Build context from relevant chunks
    const context = relevantChunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
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
        sources: relevantChunks.map((chunk, i) => ({
          index: i + 1,
          documentId: chunk.documentId,
          content: chunk.content.substring(0, 200) + '...',
          similarity: chunk.similarity,
        })),
      };
    } catch (error) {
      console.error('Error generating answer:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Get all documents for a company
   */
  async getDocuments(companyId, user) {
    // Check access
    if (user.roles.includes('Company Admin') && user.companyId !== companyId) {
      throw new Error('You can only view documents for your own company');
    }

    const query = `
      SELECT *
      FROM \`${bigQueryClient.datasetId}.documents\`
      WHERE company_id = @companyId
      ORDER BY created_at DESC
    `;

    return await bigQueryClient.query(query, [companyId]);
  }
}

module.exports = new KnowledgeBaseService();
