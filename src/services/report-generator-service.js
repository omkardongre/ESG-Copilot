// Report Generator Service (F4)
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const geminiClient = require('../utils/gemini-client');
const bigQueryClient = require('../utils/bigquery-client');
const companyService = require('./company-service');
const regulationResearchService = require('./regulation-research-service');
const esgDataCollectionService = require('./esg-data-collection-service');

class ReportGeneratorService {
  /**
   * Generate ESG report for a company
   */
  async generateReport(companyId, framework = 'GRI', userId) {
    console.log(`📄 Generating ${framework} report for company: ${companyId}`);

    // Step 1: Gather all data
    const company = await companyService.getCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const regulations = await regulationResearchService.getComplianceRequirements(companyId);
    const esgData = await esgDataCollectionService.getESGData(companyId);

    if (esgData.length === 0) {
      throw new Error('No ESG data available. Please collect ESG data first.');
    }

    // Step 2: Generate report content using AI
    const reportContent = await this.generateReportContent(company, regulations, esgData, framework);

    // Step 3: Create report record
    const reportId = uuidv4();
    const reportRecord = {
      report_id: reportId,
      company_id: companyId,
      framework: framework,
      reporting_period: new Date().getFullYear().toString(),
      status: 'draft',
      generated_by: userId,
      generated_at: new Date().toISOString(),
      approved_by: null,
      approved_at: null,
      content: JSON.stringify(reportContent),
    };

    await bigQueryClient.insert('reports', [reportRecord]);

    return {
      reportId,
      companyId,
      companyName: company.name,
      framework,
      status: 'draft',
      content: reportContent,
    };
  }

  /**
   * Generate report content using Gemini AI
   */
  async generateReportContent(company, regulations, esgData, framework) {
    console.log(`🤖 Using Gemini AI to generate ${framework} report content...`);

    // Organize ESG data by category
    const environmental = esgData.filter(d => d.category === 'environmental');
    const social = esgData.filter(d => d.category === 'social');
    const governance = esgData.filter(d => d.category === 'governance');

    const prompt = `
You are an expert ESG report writer. Generate a comprehensive ${framework} sustainability report for this company.

Company Information:
- Name: ${company.name}
- Industry: ${company.industry}
- Country: ${company.country}
- Employees: ${company.employees || 'Not disclosed'}
- Revenue: ${company.revenue ? '$' + company.revenue.toLocaleString() : 'Not disclosed'}

Applicable Regulations:
${regulations.map(r => `- ${r.regulation_name} (${r.jurisdiction})`).join('\n') || 'None identified'}

Environmental Data (${environmental.length} metrics):
${environmental.map(d => `- ${d.metric_name}: ${d.metric_value} ${d.unit}`).join('\n') || 'No data available'}

Social Data (${social.length} metrics):
${social.map(d => `- ${d.metric_name}: ${d.metric_value} ${d.unit}`).join('\n') || 'No data available'}

Governance Data (${governance.length} metrics):
${governance.map(d => `- ${d.metric_name}: ${d.metric_value} ${d.unit}`).join('\n') || 'No data available'}

Generate a ${framework} report with the following structure in JSON format:

{
  "executiveSummary": "2-3 paragraph executive summary highlighting key ESG performance and initiatives",
  "environmental": {
    "overview": "Paragraph describing environmental performance",
    "keyMetrics": [
      {"metric": "metric name", "value": "value with unit", "analysis": "brief analysis"}
    ],
    "initiatives": ["List of environmental initiatives"],
    "targets": ["List of environmental targets"]
  },
  "social": {
    "overview": "Paragraph describing social performance",
    "keyMetrics": [
      {"metric": "metric name", "value": "value with unit", "analysis": "brief analysis"}
    ],
    "initiatives": ["List of social initiatives"],
    "targets": ["List of social targets"]
  },
  "governance": {
    "overview": "Paragraph describing governance practices",
    "keyMetrics": [
      {"metric": "metric name", "value": "value with unit", "analysis": "brief analysis"}
    ],
    "initiatives": ["List of governance initiatives"],
    "policies": ["List of governance policies"]
  },
  "compliance": {
    "overview": "Paragraph on regulatory compliance",
    "regulations": [
      {"name": "regulation name", "status": "compliant|in-progress|not-applicable", "notes": "brief notes"}
    ]
  },
  "recommendations": [
    "List of 3-5 recommendations for improvement"
  ]
}

Write professionally and use actual data provided. Be specific and analytical.
`;

    try {
      const content = await geminiClient.generateJSON(prompt, { temperature: 0.3 });
      
      if (!content.executiveSummary || !content.environmental) {
        throw new Error('AI generated incomplete report structure');
      }

      console.log(`✅ Report content generated successfully`);
      return content;
    } catch (error) {
      console.error('Error generating report content:', error);
      throw new Error(`Failed to generate report content: ${error.message}`);
    }
  }

  /**
   * Generate PDF from report
   */
  async generatePDF(reportId) {
    console.log(`📄 Generating PDF for report: ${reportId}`);

    // Get report from BigQuery
    const query = `
      SELECT r.*, c.name as company_name, c.industry, c.country
      FROM \`${bigQueryClient.datasetId}.reports\` r
      JOIN \`${bigQueryClient.datasetId}.companies\` c ON r.company_id = c.company_id
      WHERE r.report_id = @reportId
      LIMIT 1
    `;

    const rows = await bigQueryClient.query(query, [reportId]);
    
    if (rows.length === 0) {
      throw new Error('Report not found');
    }

    const report = rows[0];
    const content = JSON.parse(report.content);

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    const pdfPath = path.join(__dirname, '../../reports', `${reportId}.pdf`);

    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Title Page
    doc.fontSize(24).text(`${report.framework} Sustainability Report`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(report.company_name, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Reporting Period: ${report.reporting_period}`, { align: 'center' });
    doc.text(`Industry: ${report.industry}`, { align: 'center' });
    doc.text(`Country: ${report.country}`, { align: 'center' });
    doc.moveDown(2);

    // Executive Summary
    doc.addPage();
    doc.fontSize(16).text('Executive Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(content.executiveSummary, { align: 'justify' });
    doc.moveDown(2);

    // Environmental Section
    doc.addPage();
    doc.fontSize(16).text('Environmental Performance', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(content.environmental.overview, { align: 'justify' });
    doc.moveDown();
    
    doc.fontSize(13).text('Key Metrics:', { underline: true });
    doc.moveDown(0.5);
    content.environmental.keyMetrics.forEach(metric => {
      doc.fontSize(11).text(`• ${metric.metric}: ${metric.value}`, { indent: 20 });
      doc.fontSize(10).text(`  ${metric.analysis}`, { indent: 40 });
      doc.moveDown(0.5);
    });

    // Social Section
    doc.addPage();
    doc.fontSize(16).text('Social Performance', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(content.social.overview, { align: 'justify' });
    doc.moveDown();
    
    doc.fontSize(13).text('Key Metrics:', { underline: true });
    doc.moveDown(0.5);
    content.social.keyMetrics.forEach(metric => {
      doc.fontSize(11).text(`• ${metric.metric}: ${metric.value}`, { indent: 20 });
      doc.fontSize(10).text(`  ${metric.analysis}`, { indent: 40 });
      doc.moveDown(0.5);
    });

    // Governance Section
    doc.addPage();
    doc.fontSize(16).text('Governance', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(content.governance.overview, { align: 'justify' });
    doc.moveDown();
    
    doc.fontSize(13).text('Key Metrics:', { underline: true });
    doc.moveDown(0.5);
    content.governance.keyMetrics.forEach(metric => {
      doc.fontSize(11).text(`• ${metric.metric}: ${metric.value}`, { indent: 20 });
      doc.fontSize(10).text(`  ${metric.analysis}`, { indent: 40 });
      doc.moveDown(0.5);
    });

    // Recommendations
    doc.addPage();
    doc.fontSize(16).text('Recommendations', { underline: true });
    doc.moveDown();
    content.recommendations.forEach((rec, index) => {
      doc.fontSize(11).text(`${index + 1}. ${rec}`, { indent: 20 });
      doc.moveDown(0.5);
    });

    // Footer
    doc.fontSize(8).text(
      `Generated by ESG Copilot on ${new Date().toLocaleDateString()}`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        console.log(`✅ PDF generated: ${pdfPath}`);
        resolve(pdfPath);
      });
      stream.on('error', reject);
    });
  }

  /**
   * Get report by ID
   */
  async getReport(reportId) {
    const query = `
      SELECT r.*, c.name as company_name
      FROM \`${bigQueryClient.datasetId}.reports\` r
      JOIN \`${bigQueryClient.datasetId}.companies\` c ON r.company_id = c.company_id
      WHERE r.report_id = @reportId
      LIMIT 1
    `;

    const rows = await bigQueryClient.query(query, [reportId]);
    
    if (rows.length === 0) {
      throw new Error('Report not found');
    }

    const report = rows[0];
    report.content = JSON.parse(report.content);
    
    return report;
  }

  /**
   * Get all reports for a company
   */
  async getCompanyReports(companyId) {
    const query = `
      SELECT report_id, framework, reporting_period, status, generated_at, approved_at
      FROM \`${bigQueryClient.datasetId}.reports\`
      WHERE company_id = @companyId
      ORDER BY generated_at DESC
    `;

    return await bigQueryClient.query(query, [companyId]);
  }

  /**
   * Approve report (Auditor only)
   */
  async approveReport(reportId, userId) {
    const query = `
      UPDATE \`${bigQueryClient.datasetId}.reports\`
      SET status = 'approved',
          approved_by = @userId,
          approved_at = CURRENT_TIMESTAMP()
      WHERE report_id = @reportId
    `;

    await bigQueryClient.query(query, [reportId, userId]);
    
    console.log(`✅ Report approved: ${reportId} by ${userId}`);
    
    return await this.getReport(reportId);
  }
}

module.exports = new ReportGeneratorService();
