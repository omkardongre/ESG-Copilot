// ESG Data Collection Routes (F3)
const express = require('express');
const router = express.Router();
const esgDataCollectionService = require('../services/esg-data-collection-service');
const companyService = require('../services/company-service');
const { checkJwt, extractUserInfo, requireCompanyAccess, requireRole, ROLES } = require('../middleware/auth0');
const { auditMiddleware } = require('../middleware/audit-logger');

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * POST /api/esg-data/collect/:companyId
 * Collect ESG data from external sources (EPA, website scraping)
 */
router.post(
  '/collect/:companyId',
  requireCompanyAccess,
  requireRole(ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT),
  auditMiddleware('collect_esg_data', 'esg_data'),
  async (req, res) => {
    try {
      const { companyId } = req.params;

      // Get company data
      const company = await companyService.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Collect ESG data
      const result = await esgDataCollectionService.collectESGData(companyId, company);

      res.json({
        message: 'ESG data collection completed',
        ...result,
      });
    } catch (error) {
      console.error('Error collecting ESG data:', error);
      res.status(500).json({ error: 'Failed to collect ESG data' });
    }
  }
);

/**
 * GET /api/esg-data/:companyId
 * Get ESG data for a company
 */
router.get(
  '/:companyId',
  requireCompanyAccess,
  auditMiddleware('view_esg_data', 'esg_data'),
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const { category } = req.query;

      const data = await esgDataCollectionService.getESGData(companyId, category);

      res.json({
        companyId,
        category: category || 'all',
        data,
        count: data.length,
      });
    } catch (error) {
      console.error('Error fetching ESG data:', error);
      res.status(500).json({ error: 'Failed to fetch ESG data' });
    }
  }
);

/**
 * POST /api/esg-data/:companyId/manual
 * Add manual ESG data entry
 */
router.post(
  '/:companyId/manual',
  requireCompanyAccess,
  requireRole(ROLES.COMPANY_ADMIN, ROLES.ESG_CONSULTANT),
  auditMiddleware('add_manual_esg_data', 'esg_data'),
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const { category, metricName, metricValue, unit, reportingPeriod, verified } = req.body;

      if (!category || !metricName || metricValue === undefined) {
        return res.status(400).json({ 
          error: 'Missing required fields: category, metricName, metricValue' 
        });
      }

      const record = await esgDataCollectionService.addManualData(companyId, {
        category,
        metricName,
        metricValue,
        unit,
        reportingPeriod,
        verified,
      });

      res.status(201).json({
        message: 'Manual ESG data added successfully',
        record,
      });
    } catch (error) {
      console.error('Error adding manual ESG data:', error);
      res.status(500).json({ error: 'Failed to add manual ESG data' });
    }
  }
);

module.exports = router;
