// Company Routes (F1)
const express = require('express');
const router = express.Router();
const companyService = require('../services/company-service');
const { checkJwt, extractUserInfo, requireRole, requirePermission, requireCompanyAccess, ROLES } = require('../middleware/auth0');
const { auditMiddleware } = require('../middleware/audit-logger');

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * GET /api/companies
 * Get all companies (filtered by user role)
 */
router.get('/', auditMiddleware('list_companies', 'companies'), async (req, res) => {
  try {
    console.log('📋 Fetching companies for user:', req.user);
    const companies = await companyService.getCompaniesForUser(req.user);
    console.log('✅ Found companies:', companies.length);
    res.json({ companies });
  } catch (error) {
    console.error('❌ Error fetching companies:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch companies',
      details: error.message 
    });
  }
});

/**
 * POST /api/companies
 * Create a new company (Consultant or Company Admin)
 */
router.post(
  '/',
  requirePermission('write:companies'), // Use permission instead of role
  auditMiddleware('create_company', 'companies'),
  async (req, res) => {
    try {
      const { name, industry, country, city, website, employees, revenue, publicStatus, complianceRequirements } = req.body;

      if (!name || !industry || !country) {
        return res.status(400).json({ error: 'Missing required fields: name, industry, country' });
      }

      const company = await companyService.createCompany(
        {
          name,
          industry,
          country,
          city,
          website,
          employees,
          revenue,
          publicStatus,
          complianceRequirements,
        },
        req.user.id
      );

      res.status(201).json({ company });
    } catch (error) {
      console.error('❌ Error creating company:', error);
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ 
        error: 'Failed to create company',
        details: error.message 
      });
    }
  }
);

/**
 * GET /api/companies/:companyId
 * Get company by ID
 */
router.get(
  '/:companyId',
  requirePermission('read:companies'),
  auditMiddleware('view_company', 'companies'),
  async (req, res) => {
    try {
      const company = await companyService.getCompanyById(req.params.companyId);

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({ company });
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  }
);

/**
 * PUT /api/companies/:companyId
 * Update company
 */
router.put(
  '/:companyId',
  requirePermission('write:companies'),
  auditMiddleware('update_company', 'companies'),
  async (req, res) => {
    try {
      const company = await companyService.updateCompany(req.params.companyId, req.body);

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({ company });
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  }
);

/**
 * GET /api/companies/search
 * Search companies by filters
 */
router.get('/search', auditMiddleware('search_companies', 'companies'), async (req, res) => {
  try {
    const { industry, country, minEmployees } = req.query;

    const companies = await companyService.searchCompanies({
      industry,
      country,
      minEmployees: minEmployees ? parseInt(minEmployees) : undefined,
    });

    res.json({ companies });
  } catch (error) {
    console.error('Error searching companies:', error);
    res.status(500).json({ error: 'Failed to search companies' });
  }
});

module.exports = router;
