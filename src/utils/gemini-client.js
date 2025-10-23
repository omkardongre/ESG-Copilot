// Gemini AI Client for ESG Copilot
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class GeminiClient {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    
    // Use Gemini 2.5 Flash for best JSON generation
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
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
   * Generate structured JSON output with production-level error handling
   * Uses Gemini 2.5 Flash with retry logic and robust parsing
   */
  async generateJSON(prompt, options = {}) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature || 0.3, // Lower temp for more consistent JSON
            maxOutputTokens: options.maxTokens || 8192,
            responseMimeType: 'application/json', // Native JSON mode
          },
        });

        const response = result.response;
        let text = response.text();
        
        // Clean the response (remove any BOM, whitespace, etc.)
        text = text.trim();
        
        // Try to parse
        try {
          return JSON.parse(text);
        } catch (parseError) {
          // If JSON.parse fails, try to extract JSON from the response
          console.warn(`⚠️  JSON parse attempt ${attempt} failed, trying extraction...`);
          
          // Try to find JSON object in the response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          
          throw parseError;
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ JSON generation attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`🔄 Retrying in ${attempt} second(s)...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // All retries failed
    console.error('💥 All JSON generation attempts failed');
    throw new Error(`Failed to generate valid JSON after ${maxRetries} attempts: ${lastError?.message}`);
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
