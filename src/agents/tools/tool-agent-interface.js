// Standard Tool-as-Agent Interface
// Defines the contract that all tool agents must implement

class ToolAgentInterface {
  constructor() {
    this.name = 'ToolAgentInterface';
    this.version = '1.0.0';
  }

  /**
   * Execute the tool action
   * @param {Object} params - Parameters for the tool
   * @param {string} params.userId - User ID for authorization
   * @param {string} params.action - Action to perform
   * @param {Object} params.data - Action-specific data
   * @returns {Promise<Object>} Result object with success, data, and metadata
   */
  async execute(params) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Get tool capabilities
   * @returns {Object} Tool metadata and supported actions
   */
  getCapabilities() {
    return {
      name: this.name,
      version: this.version,
      actions: this.getSupportedActions(),
      requiredPermissions: this.getRequiredPermissions(),
      rateLimit: this.getRateLimit(),
    };
  }

  /**
   * Get supported actions
   * @returns {Array<string>} List of supported action names
   */
  getSupportedActions() {
    throw new Error('getSupportedActions() must be implemented by subclass');
  }

  /**
   * Get required permissions
   * @returns {Array<string>} List of required permission scopes
   */
  getRequiredPermissions() {
    return ['read'];
  }

  /**
   * Get rate limit info
   * @returns {Object} Rate limit configuration
   */
  getRateLimit() {
    return {
      requests: 100,
      window: 3600, // 1 hour in seconds
    };
  }

  /**
   * Validate parameters
   * @param {Object} params - Parameters to validate
   * @param {Array<string>} required - Required parameter names
   * @returns {Object} Validation result
   */
  validateParams(params, required = []) {
    const missing = required.filter(key => !(key in params));
    
    if (missing.length > 0) {
      return {
        valid: false,
        errors: missing.map(key => `Missing required parameter: ${key}`),
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Handle errors with retry logic
   * @param {Error} error - Error object
   * @param {Function} retryFn - Function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Result or error
   */
  async handleError(error, retryFn, maxRetries = 3) {
    console.error(`❌ [${this.name}] Error:`, error.message);

    // Check if error is retryable
    if (this.isRetryableError(error) && maxRetries > 0) {
      const delay = this.getRetryDelay(maxRetries);
      console.log(`   ⏳ Retrying in ${delay}ms... (${maxRetries} attempts left)`);
      
      await this.sleep(delay);
      return await retryFn(maxRetries - 1);
    }

    return {
      success: false,
      error: error.message,
      code: error.response?.status || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.response?.status);
  }

  /**
   * Get retry delay with exponential backoff
   * @param {number} retriesLeft - Number of retries remaining
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay(retriesLeft) {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = baseDelay * Math.pow(2, 3 - retriesLeft);
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log tool action
   * @param {string} action - Action performed
   * @param {Object} params - Action parameters
   * @param {Object} result - Action result
   */
  async logAction(action, params, result) {
    console.log(`📊 [${this.name}] ${action}:`, {
      userId: params.userId,
      success: result.success,
      timestamp: result.timestamp,
    });

    // In production: Send to BigQuery or logging service
  }
}

module.exports = ToolAgentInterface;
