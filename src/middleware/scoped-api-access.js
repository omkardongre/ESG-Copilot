// Scoped API Access Middleware
// Enforces user-specific API access permissions
// Integrates with Token Vault for secure key retrieval

const { getInstance: getTokenVaultClient } = require('../common/token-vault-client');
const jwt = require('jsonwebtoken');

/**
 * Middleware to enforce scoped API access
 */
async function scopedApiAccess(req, res, next) {
  try {
    // Extract user from JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization token provided',
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.AUTH0_CLIENT_SECRET);
    
    // Attach user info to request
    req.user = {
      id: decoded.sub || decoded.userId,
      email: decoded.email,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
    };

    // Attach scoped API access helper
    req.getApiKey = async (serviceName, scopes = []) => {
      const tokenVault = getTokenVaultClient();
      return await tokenVault.getScopedApiKey(req.user.id, serviceName, scopes);
    };

    // Attach access checker
    req.checkApiAccess = async (serviceName, requiredScopes = []) => {
      const tokenVault = getTokenVaultClient();
      return await tokenVault.checkAccess(req.user.id, serviceName, requiredScopes);
    };

    next();
  } catch (error) {
    console.error('❌ [ScopedAPIAccess] Authorization failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Authorization token has expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'InvalidToken',
        message: 'Invalid authorization token',
      });
    }

    return res.status(500).json({
      error: 'AuthorizationError',
      message: 'Failed to verify authorization',
    });
  }
}

/**
 * Require specific API access scopes
 */
function requireApiScopes(serviceName, requiredScopes = []) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      const tokenVault = getTokenVaultClient();
      const accessCheck = await tokenVault.checkAccess(
        req.user.id,
        serviceName,
        requiredScopes
      );

      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions for ${serviceName}`,
          required: requiredScopes,
          missing: accessCheck.missingScopes,
        });
      }

      // Attach granted scopes to request
      req.grantedScopes = accessCheck.grantedScopes;

      next();
    } catch (error) {
      console.error('❌ [RequireAPIScopes] Access check failed:', error.message);
      return res.status(500).json({
        error: 'AccessCheckError',
        message: 'Failed to verify API access permissions',
      });
    }
  };
}

/**
 * Rate limiting per user and service
 */
const rateLimitStore = new Map();

function rateLimit(serviceName, maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const key = `${req.user.id}:${serviceName}`;
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    
    if (!entry) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    // Reset if window expired
    if (now >= entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    // Check limit
    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      
      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', entry.resetAt.toString());
      res.set('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        error: 'RateLimitExceeded',
        message: `Rate limit exceeded for ${serviceName}`,
        limit: maxRequests,
        retryAfter,
      });
    }

    // Increment counter
    entry.count++;

    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
    res.set('X-RateLimit-Reset', entry.resetAt.toString());

    next();
  };
}

/**
 * Audit API access
 */
async function auditApiAccess(req, res, next) {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;

    // Log API access
    const duration = Date.now() - startTime;
    
    logApiAccess({
      userId: req.user?.id,
      email: req.user?.email,
      method: req.method,
      path: req.path,
      service: req.service || 'unknown',
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.send(data);
  };

  next();
}

/**
 * Log API access to audit trail
 */
function logApiAccess(accessLog) {
  // In production, send to logging service (e.g., BigQuery, CloudWatch)
  console.log(`📊 [APIAudit] ${accessLog.method} ${accessLog.path} - ${accessLog.statusCode} (${accessLog.duration}ms) - User: ${accessLog.email}`);

  // Store in database for compliance
  // await storeAuditLog(accessLog);
}

/**
 * Service-specific middleware factories
 */
const serviceMiddleware = {
  /**
   * Climatiq API access
   */
  climatiq: (scopes = ['read']) => [
    scopedApiAccess,
    requireApiScopes('climatiq', scopes),
    rateLimit('climatiq', 1000, 3600000), // 1000 requests per hour
    auditApiAccess,
  ],

  /**
   * Google Maps API access
   */
  googleMaps: (scopes = ['read']) => [
    scopedApiAccess,
    requireApiScopes('google_maps', scopes),
    rateLimit('google_maps', 2500, 86400000), // 2500 requests per day
    auditApiAccess,
  ],

  /**
   * EPA API access
   */
  epa: (scopes = ['read']) => [
    scopedApiAccess,
    requireApiScopes('epa', scopes),
    rateLimit('epa', 500, 3600000), // 500 requests per hour
    auditApiAccess,
  ],

  /**
   * Google AI (Gemini) API access
   */
  googleAI: (scopes = ['read']) => [
    scopedApiAccess,
    requireApiScopes('google_ai', scopes),
    rateLimit('google_ai', 60, 60000), // 60 requests per minute
    auditApiAccess,
  ],

  /**
   * BigQuery access
   */
  bigquery: (scopes = ['read']) => [
    scopedApiAccess,
    requireApiScopes('bigquery', scopes),
    rateLimit('bigquery', 100, 60000), // 100 requests per minute
    auditApiAccess,
  ],
};

/**
 * Helper to inject API keys into agent context
 */
async function injectApiKeys(userId, services = []) {
  const tokenVault = getTokenVaultClient();
  
  try {
    const { keys, errors } = await tokenVault.bulkGetApiKeys(userId, services);

    if (errors.length > 0) {
      console.warn(`⚠️  [ScopedAPIAccess] Failed to retrieve some keys:`, errors);
    }

    return keys;
  } catch (error) {
    console.error(`❌ [ScopedAPIAccess] Failed to inject API keys:`, error.message);
    throw error;
  }
}

/**
 * Middleware to inject API keys into agent execution context
 */
function withApiKeys(services = []) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      // Inject API keys into request context
      req.apiKeys = await injectApiKeys(req.user.id, services);

      next();
    } catch (error) {
      console.error(`❌ [WithAPIKeys] Failed to inject API keys:`, error.message);
      return res.status(500).json({
        error: 'APIKeyInjectionError',
        message: 'Failed to retrieve API keys',
      });
    }
  };
}

module.exports = {
  scopedApiAccess,
  requireApiScopes,
  rateLimit,
  auditApiAccess,
  serviceMiddleware,
  injectApiKeys,
  withApiKeys,
};
