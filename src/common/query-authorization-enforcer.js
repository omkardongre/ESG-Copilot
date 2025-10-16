// Query-Level Authorization Enforcer
// Enforces fine-grained authorization on database queries and RAG pipelines
// Prevents unauthorized data access at the query level

const { BigQuery } = require('@google-cloud/bigquery');
const jwt = require('jsonwebtoken');

class QueryAuthorizationEnforcer {
  constructor() {
    this.name = 'QueryAuthorizationEnforcer';
    
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    });

    this.datasetId = process.env.BIGQUERY_DATASET || 'esg_platform';
  }

  /**
   * Enforce authorization on BigQuery query
   */
  async enforceQuery(query, userContext) {
    console.log(`🔒 [QueryAuth] Enforcing authorization for user ${userContext.userId}`);

    try {
      // Parse and validate query
      const parsedQuery = this.parseQuery(query);

      // Check table access permissions
      await this.checkTableAccess(parsedQuery.tables, userContext);

      // Inject row-level security filters
      const secureQuery = this.injectSecurityFilters(query, userContext);

      // Validate no privilege escalation
      this.validateNoPrivilegeEscalation(secureQuery, userContext);

      console.log(`✅ [QueryAuth] Query authorized`);

      return {
        authorizedQuery: secureQuery,
        originalQuery: query,
        appliedFilters: this.getAppliedFilters(userContext),
        userId: userContext.userId,
      };
    } catch (error) {
      console.error(`❌ [QueryAuth] Authorization failed:`, error.message);
      throw new Error(`Query authorization failed: ${error.message}`);
    }
  }

  /**
   * Parse SQL query to extract tables and operations
   */
  parseQuery(query) {
    const tables = [];
    const operations = [];

    // Extract table names (simple regex-based parsing)
    const fromMatch = query.match(/FROM\s+`?([a-zA-Z0-9_\.]+)`?/gi);
    if (fromMatch) {
      fromMatch.forEach(match => {
        const table = match.replace(/FROM\s+`?/i, '').replace(/`/g, '');
        tables.push(table);
      });
    }

    const joinMatch = query.match(/JOIN\s+`?([a-zA-Z0-9_\.]+)`?/gi);
    if (joinMatch) {
      joinMatch.forEach(match => {
        const table = match.replace(/JOIN\s+`?/i, '').replace(/`/g, '');
        tables.push(table);
      });
    }

    // Detect operations
    if (query.match(/SELECT/i)) operations.push('read');
    if (query.match(/INSERT/i)) operations.push('write');
    if (query.match(/UPDATE/i)) operations.push('update');
    if (query.match(/DELETE/i)) operations.push('delete');

    return { tables, operations };
  }

  /**
   * Check if user has access to tables
   */
  async checkTableAccess(tables, userContext) {
    for (const table of tables) {
      const hasAccess = await this.hasTablePermission(table, userContext);
      
      if (!hasAccess) {
        throw new Error(`Access denied to table: ${table}`);
      }
    }
  }

  /**
   * Check table permission for user
   */
  async hasTablePermission(table, userContext) {
    // Check user roles and permissions
    const { roles, permissions, companyId } = userContext;

    // Admin has access to all tables
    if (roles.includes('admin')) {
      return true;
    }

    // Define table access rules
    const tableRules = {
      'esg_data': ['admin', 'esg_manager', 'analyst'],
      'emissions': ['admin', 'esg_manager', 'analyst'],
      'stakeholders': ['admin', 'esg_manager'],
      'reports': ['admin', 'esg_manager', 'analyst', 'viewer'],
      'workflows': ['admin', 'esg_manager'],
      'audit_logs': ['admin'],
    };

    const tableName = table.split('.').pop(); // Get table name without dataset
    const allowedRoles = tableRules[tableName] || [];

    // Check if user has required role
    const hasRole = roles.some(role => allowedRoles.includes(role));

    // Check specific permissions
    const hasPermission = permissions.includes(`read:${tableName}`);

    return hasRole || hasPermission;
  }

  /**
   * Inject row-level security filters
   */
  injectSecurityFilters(query, userContext) {
    const { userId, companyId, roles, department } = userContext;

    // Admin sees everything
    if (roles.includes('admin')) {
      return query;
    }

    // Build security filter
    let securityFilter = '';

    // Company-level isolation (most important)
    if (companyId) {
      securityFilter += `company_id = '${companyId}'`;
    }

    // Department-level isolation
    if (department && !roles.includes('esg_manager')) {
      if (securityFilter) securityFilter += ' AND ';
      securityFilter += `department = '${department}'`;
    }

    // User-level isolation for sensitive data
    if (query.toLowerCase().includes('stakeholders') && !roles.includes('esg_manager')) {
      if (securityFilter) securityFilter += ' AND ';
      securityFilter += `created_by = '${userId}'`;
    }

    // Inject filter into WHERE clause
    if (securityFilter) {
      if (query.match(/WHERE/i)) {
        // Append to existing WHERE clause
        query = query.replace(/WHERE/i, `WHERE (${securityFilter}) AND`);
      } else {
        // Add new WHERE clause before ORDER BY, GROUP BY, or LIMIT
        const insertPoint = query.search(/ORDER BY|GROUP BY|LIMIT/i);
        if (insertPoint > 0) {
          query = query.slice(0, insertPoint) + `WHERE ${securityFilter} ` + query.slice(insertPoint);
        } else {
          query += ` WHERE ${securityFilter}`;
        }
      }
    }

    return query;
  }

  /**
   * Validate no privilege escalation attempts
   */
  validateNoPrivilegeEscalation(query, userContext) {
    const { roles } = userContext;

    // Check for dangerous operations
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /TRUNCATE/i,
      /ALTER\s+TABLE/i,
      /GRANT/i,
      /REVOKE/i,
      /CREATE\s+USER/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        if (!roles.includes('admin')) {
          throw new Error('Unauthorized operation detected');
        }
      }
    }

    // Check for attempts to bypass security filters
    if (query.match(/company_id\s*=\s*['"].*['"]\s+OR\s+1\s*=\s*1/i)) {
      throw new Error('SQL injection attempt detected');
    }

    // Check for attempts to access system tables
    if (query.match(/INFORMATION_SCHEMA|pg_catalog|mysql\./i)) {
      if (!roles.includes('admin')) {
        throw new Error('Access to system tables denied');
      }
    }
  }

  /**
   * Get applied security filters
   */
  getAppliedFilters(userContext) {
    const filters = [];

    if (userContext.companyId) {
      filters.push({ type: 'company', value: userContext.companyId });
    }

    if (userContext.department) {
      filters.push({ type: 'department', value: userContext.department });
    }

    if (!userContext.roles.includes('admin')) {
      filters.push({ type: 'role_based', roles: userContext.roles });
    }

    return filters;
  }

  /**
   * Execute authorized query
   */
  async executeAuthorizedQuery(query, userContext) {
    console.log(`🔍 [QueryAuth] Executing authorized query...`);

    try {
      // Enforce authorization
      const { authorizedQuery } = await this.enforceQuery(query, userContext);

      // Execute query
      const [rows] = await this.bigquery.query(authorizedQuery);

      // Audit query execution
      await this.auditQueryExecution({
        userId: userContext.userId,
        query: authorizedQuery,
        rowCount: rows.length,
        executedAt: new Date().toISOString(),
      });

      console.log(`✅ [QueryAuth] Query executed: ${rows.length} rows`);

      return rows;
    } catch (error) {
      console.error(`❌ [QueryAuth] Query execution failed:`, error.message);
      
      // Audit failed attempt
      await this.auditQueryExecution({
        userId: userContext.userId,
        query: query,
        error: error.message,
        executedAt: new Date().toISOString(),
        success: false,
      });

      throw error;
    }
  }

  /**
   * Enforce authorization on RAG retrieval
   */
  async enforceRAGRetrieval(documents, userContext) {
    console.log(`🔒 [QueryAuth] Enforcing RAG authorization for ${documents.length} documents`);

    const authorizedDocs = [];

    for (const doc of documents) {
      try {
        // Check document-level permissions
        const hasAccess = await this.checkDocumentAccess(doc, userContext);
        
        if (hasAccess) {
          // Redact sensitive fields if needed
          const redactedDoc = this.redactSensitiveFields(doc, userContext);
          authorizedDocs.push(redactedDoc);
        }
      } catch (error) {
        console.warn(`⚠️  [QueryAuth] Document access denied: ${doc.id}`);
      }
    }

    console.log(`✅ [QueryAuth] Authorized ${authorizedDocs.length}/${documents.length} documents`);

    return authorizedDocs;
  }

  /**
   * Check document access permission
   */
  async checkDocumentAccess(document, userContext) {
    const { userId, companyId, roles, permissions } = userContext;

    // Admin has access to all documents
    if (roles.includes('admin')) {
      return true;
    }

    // Check company-level access
    if (document.metadata?.companyId !== companyId) {
      return false;
    }

    // Check document visibility level
    const visibility = document.metadata?.visibility || 'private';

    if (visibility === 'public') {
      return true;
    }

    if (visibility === 'company') {
      return document.metadata?.companyId === companyId;
    }

    if (visibility === 'department') {
      return document.metadata?.department === userContext.department;
    }

    if (visibility === 'private') {
      return document.metadata?.ownerId === userId;
    }

    // Check explicit permissions
    const allowedUsers = document.metadata?.allowedUsers || [];
    if (allowedUsers.includes(userId)) {
      return true;
    }

    const allowedRoles = document.metadata?.allowedRoles || [];
    if (roles.some(role => allowedRoles.includes(role))) {
      return true;
    }

    return false;
  }

  /**
   * Redact sensitive fields based on user permissions
   */
  redactSensitiveFields(document, userContext) {
    const { roles } = userContext;

    // Fields that require special permissions
    const sensitiveFields = {
      'financial_data': ['admin', 'esg_manager'],
      'employee_data': ['admin', 'hr_manager'],
      'api_keys': ['admin'],
      'internal_notes': ['admin', 'esg_manager'],
    };

    const redactedDoc = { ...document };

    Object.entries(sensitiveFields).forEach(([field, allowedRoles]) => {
      if (redactedDoc.metadata?.[field] && !roles.some(r => allowedRoles.includes(r))) {
        redactedDoc.metadata[field] = '[REDACTED]';
      }
    });

    return redactedDoc;
  }

  /**
   * Audit query execution
   */
  async auditQueryExecution(auditLog) {
    try {
      const row = {
        user_id: auditLog.userId,
        query: auditLog.query,
        row_count: auditLog.rowCount || 0,
        executed_at: auditLog.executedAt,
        success: auditLog.success !== false,
        error: auditLog.error || null,
      };

      await this.bigquery
        .dataset(this.datasetId)
        .table('query_audit_logs')
        .insert([row]);
    } catch (error) {
      console.warn(`⚠️  [QueryAuth] Failed to audit query:`, error.message);
    }
  }

  /**
   * Create user context from JWT token
   */
  createUserContext(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.AUTH0_CLIENT_SECRET);

      return {
        userId: decoded.sub || decoded.userId,
        email: decoded.email,
        companyId: decoded.companyId || decoded['https://esg-platform/company_id'],
        roles: decoded.roles || decoded['https://esg-platform/roles'] || [],
        permissions: decoded.permissions || decoded['https://esg-platform/permissions'] || [],
        department: decoded.department || decoded['https://esg-platform/department'],
      };
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Validate query result doesn't leak unauthorized data
   */
  validateQueryResult(rows, userContext) {
    // Check if any row contains data from unauthorized companies
    const unauthorizedRows = rows.filter(row => {
      if (row.company_id && row.company_id !== userContext.companyId) {
        return true;
      }
      return false;
    });

    if (unauthorizedRows.length > 0) {
      console.error(`❌ [QueryAuth] Data leakage detected: ${unauthorizedRows.length} unauthorized rows`);
      throw new Error('Query result contains unauthorized data');
    }

    return true;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  QueryAuthorizationEnforcer,
  getInstance: () => {
    if (!instance) {
      instance = new QueryAuthorizationEnforcer();
    }
    return instance;
  },
};
