// Regulation Research Routes (F2)
const express = require('express');
const router = express.Router();
const regulationResearchService = require('../services/regulation-research-service');
const companyService = require('../services/company-service');
const { checkJwt, extractUserInfo, requirePermission, requireCompanyAccess, ROLES } = require('../middleware/auth0');
const { auditMiddleware } = require('../middleware/audit-logger');

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * POST /api/regulations/research/:companyId
 * Research regulations for a company
 */
router.post(
  '/research/:companyId',
  requirePermission('execute:agents'),
  auditMiddleware('research_regulations', 'regulations'),
  async (req, res) => {
    try {
      const { companyId } = req.params;

      // Get company data
      const company = await companyService.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Research regulations
      const result = await regulationResearchService.researchRegulations(companyId, company);

      res.json({
        message: 'Regulation research completed',
        companyId,
        companyName: company.name,
        regulationsFound: result.regulations.length,
        regulations: result.regulations,
        frameworks: result.frameworks,
        deadlines: result.deadlines,
      });
    } catch (error) {
      console.error('Error researching regulations:', error);
      res.status(500).json({ error: 'Failed to research regulations' });
    }
  }
);

/**
 * GET /api/regulations/:companyId
 * Get compliance requirements for a company
 */
router.get(
  '/:companyId',
  requirePermission('read:companies'),
  auditMiddleware('view_regulations', 'regulations'),
  async (req, res) => {
    try {
      const { companyId } = req.params;

      const requirements = await regulationResearchService.getComplianceRequirements(companyId);

      res.json({
        companyId,
        requirements,
        count: requirements.length,
      });
    } catch (error) {
      console.error('Error fetching compliance requirements:', error);
      res.status(500).json({ error: 'Failed to fetch compliance requirements' });
    }
  }
);

module.exports = router;
