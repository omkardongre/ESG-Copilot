// Report Generator Routes (F4)
const express = require('express');
const router = express.Router();
const reportGeneratorService = require('../services/report-generator-service');
const { checkJwt, extractUserInfo, requirePermission, requireCompanyAccess, requireRole, ROLES } = require('../middleware/auth0');
const { auditMiddleware } = require('../middleware/audit-logger');

// Apply JWT validation and user extraction to all routes
router.use(checkJwt);
router.use(extractUserInfo);

/**
 * POST /api/reports/generate/:companyId
 * Generate ESG report for a company
 */
router.post(
  '/generate/:companyId',
  requirePermission('execute:agents'),
  auditMiddleware('generate_report', 'reports'),
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const { framework } = req.body;

      if (!framework) {
        return res.status(400).json({ 
          error: 'Missing required field: framework (GRI, SASB, or TCFD)' 
        });
      }

      if (!['GRI', 'SASB', 'TCFD'].includes(framework)) {
        return res.status(400).json({ 
          error: 'Invalid framework. Must be GRI, SASB, or TCFD' 
        });
      }

      const result = await reportGeneratorService.generateReport(
        companyId,
        framework,
        req.user.id
      );

      res.status(201).json({
        message: 'Report generated successfully',
        ...result,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      
      // Return specific error messages (no dummy fallbacks)
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('No ESG data')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ 
        error: 'Failed to generate report',
        details: error.message 
      });
    }
  }
);

/**
 * GET /api/reports
 * Get all reports (if no companyId) or reports for specific company
 */
router.get(
  '/',
  requirePermission('read:reports'),
  auditMiddleware('list_reports', 'reports'),
  async (req, res) => {
    try {
      const { companyId } = req.query;

      // If companyId provided, get reports for that company
      if (companyId) {
        const reports = await reportGeneratorService.getCompanyReports(companyId);
        return res.json({
          companyId,
          reports,
          count: reports.length,
        });
      }

      // Otherwise, get ALL reports across all companies
      const allReports = await reportGeneratorService.getAllReports();

      res.json({
        reports: allReports,
        count: allReports.length,
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ 
        error: 'Failed to fetch reports',
        details: error.message 
      });
    }
  }
);

/**
 * GET /api/reports/:reportId
 * Get report by ID
 */
router.get(
  '/:reportId',
  auditMiddleware('view_report', 'reports'),
  async (req, res) => {
    try {
      const { reportId } = req.params;

      const report = await reportGeneratorService.getReport(reportId);

      // Check company access
      const userRoles = req.user.roles;
      const userCompanyId = req.user.companyId;

      if (
        userRoles.includes(ROLES.COMPANY_ADMIN) &&
        report.company_id !== userCompanyId
      ) {
        return res.status(403).json({ 
          error: 'You can only view reports for your own company' 
        });
      }

      res.json({ report });
    } catch (error) {
      console.error('Error fetching report:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ 
        error: 'Failed to fetch report',
        details: error.message 
      });
    }
  }
);

/**
 * GET /api/reports/company/:companyId
 * Get all reports for a company
 */
router.get(
  '/company/:companyId',
  requirePermission('read:reports'),
  auditMiddleware('list_reports', 'reports'),
  async (req, res) => {
    try {
      const { companyId } = req.params;

      const reports = await reportGeneratorService.getCompanyReports(companyId);

      res.json({
        companyId,
        reports,
        count: reports.length,
      });
    } catch (error) {
      console.error('Error fetching company reports:', error);
      res.status(500).json({ 
        error: 'Failed to fetch company reports',
        details: error.message 
      });
    }
  }
);

/**
 * POST /api/reports/:reportId/approve
 * Approve a report (Auditor only)
 */
router.post(
  '/:reportId/approve',
  requireRole(ROLES.AUDITOR),
  auditMiddleware('approve_report', 'reports'),
  async (req, res) => {
    try {
      const { reportId } = req.params;

      const report = await reportGeneratorService.approveReport(reportId, req.user.id);

      res.json({
        message: 'Report approved successfully',
        report,
      });
    } catch (error) {
      console.error('Error approving report:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ 
        error: 'Failed to approve report',
        details: error.message 
      });
    }
  }
);

/**
 * GET /api/reports/:reportId/pdf
 * Generate and download PDF
 */
router.get(
  '/:reportId/pdf',
  auditMiddleware('download_pdf', 'reports'),
  async (req, res) => {
    try {
      const { reportId } = req.params;

      // Check access first
      const report = await reportGeneratorService.getReport(reportId);
      
      const userRoles = req.user.roles;
      const userCompanyId = req.user.companyId;

      if (
        userRoles.includes(ROLES.COMPANY_ADMIN) &&
        report.company_id !== userCompanyId
      ) {
        return res.status(403).json({ 
          error: 'You can only download reports for your own company' 
        });
      }

      const pdfPath = await reportGeneratorService.generatePDF(reportId);

      res.download(pdfPath, `ESG_Report_${reportId}.pdf`, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          res.status(500).json({ 
            error: 'Failed to download PDF',
            details: err.message 
          });
        }
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ 
        error: 'Failed to generate PDF',
        details: error.message 
      });
    }
  }
);

module.exports = router;
