// AI Chatbot Service with Role-Aware Responses
const geminiClient = require('../utils/gemini-client');
const knowledgeBaseService = require('./knowledge-base-service');
const companyService = require('./company-service');
const esgDataCollectionService = require('./esg-data-collection-service');
const regulationResearchService = require('./regulation-research-service');
const bigQueryClient = require('../utils/bigquery-client');
const { v4: uuidv4 } = require('uuid');

class ChatbotService {
  /**
   * Process chat message with role-aware context
   */
  async chat(message, user, companyId = null) {
    console.log(`💬 Chat message from ${user.email}: "${message}"`);

    // Determine company context
    const targetCompanyId = companyId || user.companyId;
    
    if (!targetCompanyId) {
      return {
        response: "Please specify a company or ensure you're associated with one.",
        sources: [],
      };
    }

    // Check access
    if (user.roles.includes('Company Admin') && user.companyId !== targetCompanyId) {
      return {
        response: "You can only access information for your own company.",
        sources: [],
      };
    }

    // Build context based on user role and company
    const context = await this.buildContext(message, user, targetCompanyId);

    // Generate role-aware response
    const response = await this.generateResponse(message, context, user);

    // Store chat history
    await this.storeChatHistory(user.id, targetCompanyId, message, response.answer);

    return {
      response: response.answer,
      sources: response.sources,
      context: context.summary,
    };
  }

  /**
   * Build context from multiple sources based on user permissions
   */
  async buildContext(message, user, companyId) {
    const context = {
      company: null,
      regulations: [],
      esgData: [],
      knowledgeBase: [],
      summary: '',
    };

    try {
      // 1. Get company information
      const company = await companyService.getCompanyById(companyId);
      if (company) {
        context.company = {
          name: company.name,
          industry: company.industry,
          country: company.country,
          employees: company.employees,
        };
      }

      // 2. Get applicable regulations
      const regulations = await regulationResearchService.getComplianceRequirements(companyId);
      context.regulations = regulations.slice(0, 3).map(r => ({
        name: r.regulation_name,
        jurisdiction: r.jurisdiction,
        deadline: r.compliance_deadline,
      }));

      // 3. Get ESG data summary
      const esgData = await esgDataCollectionService.getESGData(companyId);
      if (esgData.length > 0) {
        const categories = {
          environmental: esgData.filter(d => d.category === 'environmental').length,
          social: esgData.filter(d => d.category === 'social').length,
          governance: esgData.filter(d => d.category === 'governance').length,
        };
        context.esgData = categories;
      }

      // 4. Search knowledge base (permission-filtered RAG)
      const kbResults = await knowledgeBaseService.search(message, user, 3);
      context.knowledgeBase = kbResults.map(r => ({
        content: r.content.substring(0, 300),
        similarity: r.similarity,
      }));

      // Build summary
      context.summary = this.buildContextSummary(context);

    } catch (error) {
      console.error('Error building context:', error);
    }

    return context;
  }

  /**
   * Build context summary for AI
   */
  buildContextSummary(context) {
    let summary = '';

    if (context.company) {
      summary += `Company: ${context.company.name} (${context.company.industry}, ${context.company.country})\n`;
    }

    if (context.regulations.length > 0) {
      summary += `\nApplicable Regulations:\n`;
      context.regulations.forEach(r => {
        summary += `- ${r.name} (${r.jurisdiction})\n`;
      });
    }

    if (context.esgData) {
      summary += `\nESG Data Available:\n`;
      summary += `- Environmental: ${context.esgData.environmental} metrics\n`;
      summary += `- Social: ${context.esgData.social} metrics\n`;
      summary += `- Governance: ${context.esgData.governance} metrics\n`;
    }

    if (context.knowledgeBase.length > 0) {
      summary += `\nRelevant Documents:\n`;
      context.knowledgeBase.forEach((doc, i) => {
        summary += `[${i + 1}] ${doc.content}...\n`;
      });
    }

    return summary;
  }

  /**
   * Generate AI response with role-aware prompting
   */
  async generateResponse(message, context, user) {
    const roleContext = this.getRoleContext(user.roles);

    const prompt = `
You are an ESG (Environmental, Social, Governance) compliance assistant for ${context.company?.name || 'a company'}.

Your role: ${roleContext}

Company Context:
${context.summary}

User Question: ${message}

Instructions:
1. Answer based on the provided context
2. Be specific and reference regulations/data when available
3. If context is insufficient, say so clearly
4. Provide actionable advice when appropriate
5. Reference sources using [1], [2], etc.

Generate a helpful, professional response:
`;

    try {
      const answer = await geminiClient.generateContent(prompt);

      return {
        answer: answer,
        sources: context.knowledgeBase.map((doc, i) => ({
          index: i + 1,
          content: doc.content,
          similarity: doc.similarity,
        })),
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Get role-specific context for AI
   */
  getRoleContext(roles) {
    if (roles.includes('Auditor')) {
      return 'You are assisting an auditor. Provide detailed, compliance-focused information with emphasis on verification and accuracy.';
    } else if (roles.includes('ESG Consultant')) {
      return 'You are assisting an ESG consultant. Provide strategic advice and best practices for multiple clients.';
    } else if (roles.includes('Company Admin')) {
      return 'You are assisting a company administrator. Provide practical, actionable guidance for their specific company.';
    } else if (roles.includes('Regulator')) {
      return 'You are assisting a regulator. Provide oversight-focused information with emphasis on compliance status.';
    }
    return 'You are an ESG compliance assistant.';
  }

  /**
   * Store chat history for audit and learning
   */
  async storeChatHistory(userId, companyId, message, response) {
    try {
      const record = {
        chat_id: uuidv4(),
        user_id: userId,
        company_id: companyId,
        message: message,
        response: response.substring(0, 1000), // Limit size
        created_at: new Date().toISOString(),
      };

      await bigQueryClient.insert('chat_history', [record]);
    } catch (error) {
      console.error('Error storing chat history:', error);
      // Don't fail the chat if storage fails
    }
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(userId, companyId, limit = 10) {
    const query = `
      SELECT chat_id, message, response, created_at
      FROM \`${bigQueryClient.datasetId}.chat_history\`
      WHERE user_id = @userId
        AND company_id = @companyId
      ORDER BY created_at DESC
      LIMIT @limit
    `;

    return await bigQueryClient.query(query, [userId, companyId, limit]);
  }

  /**
   * Get suggested questions based on company context
   */
  async getSuggestedQuestions(user, companyId) {
    const company = await companyService.getCompanyById(companyId);
    
    if (!company) {
      return [];
    }

    const suggestions = [
      `What ESG regulations apply to ${company.name}?`,
      `How do I calculate our carbon footprint?`,
      `What are the GRI reporting requirements?`,
      `How can we improve our ESG score?`,
      `What is the deadline for CSRD compliance?`,
    ];

    // Role-specific suggestions
    if (user.roles.includes('Auditor')) {
      suggestions.push(
        `Show me the audit trail for ${company.name}`,
        `What documents need verification?`
      );
    } else if (user.roles.includes('Company Admin')) {
      suggestions.push(
        `How do I upload ESG data?`,
        `Generate a sustainability report`
      );
    }

    return suggestions.slice(0, 5);
  }
}

module.exports = new ChatbotService();
