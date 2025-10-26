// Auth0 Authentication & Authorization Middleware
const { auth } = require('express-oauth2-jwt-bearer');
const config = require('../config');

// JWT validation middleware
const checkJwt = auth({
  audience: config.auth0.audience,
  issuerBaseURL: config.auth0.issuerBaseURL,
  tokenSigningAlg: 'RS256',
});

// Role-based access control
const ROLES = {
  COMPANY_ADMIN: 'Company Admin',
  ESG_CONSULTANT: 'ESG Consultant',
  AUDITOR: 'Auditor',
  REGULATOR: 'Regulator',
};

// Permissions mapping
const PERMISSIONS = {
  'read:companies': [ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT, ROLES.AUDITOR, ROLES.REGULATOR],
  'write:companies': [ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT],
  'read:reports': [ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT, ROLES.AUDITOR, ROLES.REGULATOR],
  'write:reports': [ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT],
  'approve:reports': [ROLES.AUDITOR],
  'read:esg_data': [ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT, ROLES.AUDITOR, ROLES.REGULATOR],
  'write:esg_data': [ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT],
};

/**
 * Check if user has required role
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRoles = req.auth?.payload?.['https://esg-copilot.com/roles'] || [];
    
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${allowedRoles.join(' or ')}`,
      });
    }
    
    next();
  };
};

/**
 * Check if user has required permission
 */
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    const userPermissions = req.auth?.payload?.permissions || [];
    
    const hasPermission = permissions.some(perm => userPermissions.includes(perm));
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required permission: ${permissions.join(' or ')}`,
      });
    }
    
    next();
  };
};

/**
 * Check if user can access specific company
 * Company Admins can only access their own company
 * Consultants, Auditors, Regulators can access all
 */
const requireCompanyAccess = (req, res, next) => {
  const userRoles = req.auth?.payload?.['https://esg-copilot.com/roles'] || [];
  const userId = req.auth?.payload?.sub;
  const companyId = req.params.companyId || req.body.companyId;
  
  // Consultants, Auditors, Regulators have access to all companies
  if (
    userRoles.includes(ROLES.ESG_CONSULTANT) ||
    userRoles.includes(ROLES.AUDITOR) ||
    userRoles.includes(ROLES.REGULATOR)
  ) {
    return next();
  }
  
  // Company Admins can only access their own company
  if (userRoles.includes(ROLES.COMPANY_ADMIN)) {
    const userCompanyId = req.auth?.payload?.['https://esg-copilot.com/company_id'];
    
    if (companyId && companyId !== userCompanyId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own company',
      });
    }
    
    // Set company ID for Company Admins
    req.companyId = userCompanyId;
    return next();
  }
  
  return res.status(403).json({
    error: 'Forbidden',
    message: 'No company access',
  });
};

/**
 * Extract user info from JWT and log Token Vault contents
 */
const extractUserInfo = (req, res, next) => {
  if (req.auth?.payload) {
    // Extract API keys from Token Vault
    const apiKeys = req.auth.payload['https://esg-copilot.com/api_keys'] || {};
    
    req.user = {
      id: req.auth.payload.sub,
      email: req.auth.payload['https://esg-copilot.com/email'] || req.auth.payload.email,
      roles: req.auth.payload['https://esg-copilot.com/roles'] || [],
      companyId: req.auth.payload['https://esg-copilot.com/company_id'],
      permissions: req.auth.payload.permissions || [],
      api_keys: apiKeys, // ✅ ADD API KEYS TO req.user
    };
    
    // 🔍 LOG TOKEN VAULT CONTENTS FOR VERIFICATION (Disabled - too verbose)
    // console.log('\n🔐 ===== AUTH0 TOKEN VAULT VERIFICATION =====');
    // console.log('User:', req.user.email);
    // console.log('Roles:', req.user.roles);
    // console.log('Permissions:', req.user.permissions);
    // 
    // console.log('\n🔑 API Keys in JWT Token Vault:');
    // console.log('  - climatiq_api_key:', apiKeys.climatiq_api_key ? '✅ Present' : '❌ Missing');
    // console.log('  - google_maps_api_key:', apiKeys.google_maps_api_key ? '✅ Present' : '❌ Missing');
    // console.log('  - pinecone_api_key:', apiKeys.pinecone_api_key ? '✅ Present' : '❌ Missing');
    // console.log('  - sendgrid_api_key:', apiKeys.sendgrid_api_key ? '✅ Present' : '❌ Missing');
    // console.log('==========================================\n');
  }
  next();
};

module.exports = {
  checkJwt,
  requireRole,
  requirePermission,
  requireCompanyAccess,
  extractUserInfo,
  ROLES,
  PERMISSIONS,
};
