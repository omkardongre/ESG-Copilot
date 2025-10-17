// Gemini AI Client for ESG Copilot
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class GeminiClient {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model,
    });
    
    // Model with Google Search grounding for real-time web search
    this.modelWithSearch = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Supports grounding
    });
  }

  /**
   * Generate content with Gemini
   */
  async generate(prompt, options = {}) {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || config.gemini.temperature,
          topP: options.topP || 0.95,
          topK: options.topK || 40,
          maxOutputTokens: options.maxOutputTokens || 8192,
        },
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini generation error:', error);
      throw error;
    }
  }

  /**
   * Generate structured JSON output
   */
  async generateJSON(prompt, options = {}) {
    const jsonPrompt = `${prompt}\n\nRespond with valid JSON only, no markdown or explanation.`;
    const text = await this.generate(jsonPrompt, options);
    
    try {
      // Remove markdown code blocks if present
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('Raw response:', text);
      throw new Error('Failed to parse JSON response from Gemini');
    }
  }

  /**
   * Generate content with Google Search grounding (real-time web search)
   * Uses Gemini 2.0 Flash with dynamic retrieval
   */
  async generateWithSearch(prompt, options = {}) {
    try {
      console.log('🔍 Using Gemini with Google Search grounding...');
      
      const result = await this.modelWithSearch.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: options.maxOutputTokens || 8192,
        },
        tools: [{
          googleSearch: {} // Enable Google Search grounding
        }],
      });

      const response = await result.response;
      const text = response.text();
      
      // Log search grounding metadata if available
      if (response.candidates && response.candidates[0]?.groundingMetadata) {
        const metadata = response.candidates[0].groundingMetadata;
        console.log('✅ Search grounding used:', {
          searchQueries: metadata.searchEntryPoint?.renderedContent || 'N/A',
          webSearchQueriesCount: metadata.webSearchQueries?.length || 0
        });
      }
      
      return text;
    } catch (error) {
      console.error('❌ Gemini with search error:', error);
      throw error;
    }
  }

  /**
   * Generate JSON with Google Search grounding
   */
  async generateJSONWithSearch(prompt, options = {}) {
    const jsonPrompt = `${prompt}\n\nRespond with valid JSON only, no markdown or explanation.`;
    const text = await this.generateWithSearch(jsonPrompt, options);
    
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('Raw response:', text);
      throw new Error('Failed to parse JSON response from Gemini with search');
    }
  }
}

module.exports = new GeminiClient();
