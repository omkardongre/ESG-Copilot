// Audit Logging Middleware
const { v4: uuidv4 } = require('uuid');
const bigQueryClient = require('../utils/bigquery-client');

/**
 * Log action to BigQuery audit_logs table
 */
async function logAudit(data) {
  const logEntry = {
    log_id: uuidv4(),
    user_id: data.userId || null,
    user_email: data.userEmail || null,
    user_role: data.userRole || null,
    action: data.action,
    resource: data.resource || null,
    resource_id: data.resourceId || null,
    status: data.status || 'success',
    error_message: data.errorMessage || null,
    ip_address: data.ipAddress || null,
    user_agent: data.userAgent || null,
    timestamp: new Date().toISOString(),
  };

  try {
    await bigQueryClient.insert('audit_logs', [logEntry]);
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - audit logging failure shouldn't break the request
  }
}

/**
 * Middleware to automatically log API requests
 */
const auditMiddleware = (action, resource) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to log after response
    res.json = function (data) {
      const status = res.statusCode >= 400 ? 'failure' : 'success';
      const errorMessage = status === 'failure' ? data.message || data.error : null;

      // Log audit entry (async, don't wait)
      logAudit({
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.roles?.[0],
        action: action || `${req.method} ${req.path}`,
        resource: resource || req.path.split('/')[1],
        resourceId: req.params.id || req.params.companyId || req.params.reportId,
        status,
        errorMessage,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      }).catch(err => console.error('Audit log error:', err));

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

module.exports = {
  logAudit,
  auditMiddleware,
};
