// Gemini AI Client for ESG Copilot
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class GeminiClient {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model,
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
}

module.exports = new GeminiClient();
