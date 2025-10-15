// Simple Embedding Service (Hash-based like SecureDoc)
// No external dependencies - fast and free
const crypto = require('crypto');

class EmbeddingService {
  /**
   * Generate simple hash-based embedding for text
   * This is similar to SecureDoc's approach - fast and no API quota
   */
  generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Normalize text
    const normalized = text.toLowerCase().trim();
    
    // Create multiple hash-based features
    const features = [];
    
    // 1. Character-level features (128 dimensions)
    for (let i = 0; i < 128; i++) {
      const hash = crypto.createHash('md5')
        .update(normalized + i.toString())
        .digest();
      features.push(hash[0] / 255); // Normalize to 0-1
    }
    
    // 2. Word-level features (128 dimensions)
    const words = normalized.split(/\s+/);
    for (let i = 0; i < 128; i++) {
      const wordIndex = i % words.length;
      const hash = crypto.createHash('md5')
        .update(words[wordIndex] + i.toString())
        .digest();
      features.push(hash[0] / 255);
    }
    
    // 3. Bigram features (128 dimensions)
    const bigrams = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(words[i] + ' ' + words[i + 1]);
    }
    for (let i = 0; i < 128; i++) {
      if (bigrams.length > 0) {
        const bigramIndex = i % bigrams.length;
        const hash = crypto.createHash('md5')
          .update(bigrams[bigramIndex] + i.toString())
          .digest();
        features.push(hash[0] / 255);
      } else {
        features.push(0);
      }
    }
    
    // Total: 384-dimensional embedding
    return features;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Chunk document into smaller pieces for better retrieval
   */
  chunkDocument(content, chunkSize = 500) {
    const chunks = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      if ((currentChunk + trimmed).length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          content: currentChunk.trim(),
        });
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmed;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        index: chunkIndex,
        content: currentChunk.trim(),
      });
    }

    return chunks;
  }

  /**
   * Find most similar chunks to query
   */
  findSimilar(queryEmbedding, chunks, topK = 5) {
    const similarities = chunks.map(chunk => ({
      ...chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top K results
    return similarities.slice(0, topK);
  }
}

module.exports = new EmbeddingService();
