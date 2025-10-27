// Company Routes (F1)
const express = require("express");
const router = express.Router();
const companyService = require("../services/company-service");
const {
  checkJwt,
  extractUserInfo,
  requireRole,
  requirePermission,
  requireCompanyAccess,
  ROLES,
} = require("../middleware/auth0");
const { auditMiddleware } = require("../middleware/audit-logger");

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * GET /api/companies
 * Get all companies (filtered by user role)
 */
router.get('/', auditMiddleware('list_companies', 'companies'), async (req, res) => {
  try {
    // console.log('📋 Fetching companies for user:', req.user);
    const companies = await companyService.getCompaniesForUser(req.user);
    // console.log('✅ Found companies:', companies.length);
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
        req.user.id,
        req.user.roles, // Pass user roles for Auth0 metadata update
        req.user.email  // Pass user email for FGA Store tuple creation
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
 * DELETE /api/companies/:companyId
 * Delete company (Company Admin or ESG Consultant only)
 * ✅ Also deletes associated RAG documents from Pinecone
 */
router.delete(
  '/:companyId',
  requirePermission('write:companies'),
  auditMiddleware('delete_company', 'companies'),
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const user = req.user;

      console.log(`🗑️ Delete request for company ${companyId} by user ${user.id}`);

      // ✅ Authorization: Company Admin can only delete their own company
      if (user.roles.includes('Company Admin')) {
        const company = await companyService.getCompanyById(companyId);
        
        if (!company) {
          return res.status(404).json({ error: 'Company not found' });
        }

        // Check if user created this company or if it's their assigned company
        const canDelete = company.created_by === user.id || user.companyId === companyId;
        
        if (!canDelete) {
          console.log(`❌ Company Admin ${user.id} cannot delete company ${companyId}`);
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'You can only delete your own company' 
          });
        }
      }

      // ✅ ESG Consultant can delete any company (no check needed)

      // Delete company and associated RAG documents
      const result = await companyService.deleteCompany(companyId, user);

      res.json({ 
        success: true,
        message: 'Company and associated data deleted successfully',
        ...result
      });
    } catch (error) {
      console.error('❌ Error deleting company:', error);
      res.status(500).json({ 
        error: 'Failed to delete company',
        details: error.message 
      });
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

/**
 * POST /api/companies/:id/send-stakeholder-email
 * Send ESG report email to stakeholders
 */
router.post(
  '/:id/send-stakeholder-email',
  auditMiddleware('send_stakeholder_email', 'companies'),
  async (req, res) => {
    try {
      const companyId = req.params.id;
      const { emails, reportId } = req.body;
      const user = req.user;

      // Validate input
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid input',
          message: 'Please provide an array of email addresses' 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter((email) => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid email addresses',
          message: `Invalid emails: ${invalidEmails.join(', ')}` 
        });
      }

      // Get company details
      const company = await companyService.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Send emails to stakeholders
      const result = await companyService.sendStakeholderEmails(
        companyId,
        emails,
        reportId,
        user
      );

      res.json({ 
        success: true,
        message: `Email sent to ${emails.length} stakeholder(s)`,
        ...result
      });
    } catch (error) {
      console.error('❌ Error sending stakeholder emails:', error);
      res.status(500).json({ 
        error: 'Failed to send emails',
        details: error.message 
      });
    }
  }
);

module.exports = router;
