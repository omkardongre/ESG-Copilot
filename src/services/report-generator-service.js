// Report Generator Service (F4) - Multi-Agent Orchestration with Iterative Refinement
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const geminiClient = require('../utils/gemini-client');
const bigQueryClient = require('../utils/bigquery-client');
const companyService = require('./company-service');
const regulationResearchService = require('./regulation-research-service');
const esgDataCollectionService = require('./esg-data-collection-service');
const RAGService = require('./rag-service');

// Import writer sub-agents
const executiveSummaryWriter = require('../agents/sub-agents/executive-summary-writer-agent');
const environmentalWriter = require('../agents/sub-agents/environmental-section-writer-agent');
const socialWriter = require('../agents/sub-agents/social-section-writer-agent');
const governanceWriter = require('../agents/sub-agents/governance-section-writer-agent');
const reviewCritiqueAgent = require('../agents/sub-agents/review-critique-agent');

class ReportGeneratorService {
  /**
   * Generate ESG report for a company using multi-agent orchestration
   * Implements parallel fan-out/gather + iterative refinement loop
   */
  async generateReport(companyId, framework = 'GRI', userId) {
    console.log(`📄 Generating ${framework} report for company: ${companyId}`);
    console.log(`   🤖 Using multi-agent orchestration (4 parallel writers + 1 reviewer)`);

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

    const state = { company, regulations, esgData, framework };

    // Step 2: Generate report content using multi-agent orchestration with review loop
    // Read max iterations from environment variable (default: 3)
    const maxIterations = parseInt(process.env.REPORT_REFINEMENT_ITERATIONS || '3', 10);
    const reportContent = await this.generateReportContentWithReview(state, maxIterations);

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

    // Step 4: Ingest report into Pinecone for RAG
    console.log(`\n📊 Ingesting report into Pinecone for RAG...`);
    await this.ingestReportToPinecone({
      reportId,
      companyId,
      framework,
      content: reportContent,
    });

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
   * Generate report content with iterative refinement loop
   */
  async generateReportContentWithReview(state, maxIterations = 3) {
    console.log(`   🔄 Starting iterative refinement loop (max ${maxIterations} iterations)`);

    let reportContent = null;
    let iteration = 0;
    let approved = false;

    while (!approved && iteration < maxIterations) {
      iteration++;
      console.log(`   📝 Iteration ${iteration}/${maxIterations}`);

      // Generate report content (parallel execution)
      reportContent = await this.generateReportContent(state);

      // Review report quality
      const review = await reviewCritiqueAgent.execute(state, reportContent);

      if (review.approved) {
        approved = true;
        console.log(`   ✅ Report approved after ${iteration} iteration(s)`);
      } else {
        console.log(`   ⚠️  Report needs revision: ${review.feedback}`);
        
        if (iteration < maxIterations) {
          console.log(`   🔄 Revising report...`);
          // In a real implementation, we would pass feedback to writers
          // For now, we'll regenerate with the same state
        } else {
          console.log(`   ⚠️  Max iterations reached - using current version`);
        }
      }
    }

    return reportContent;
  }

  /**
   * Generate report content using 4 parallel writer agents
   */
  async generateReportContent(state) {
    console.log(`   ⚡ Spawning 4 writer agents in parallel...`);

    const startTime = Date.now();

    try {
      // PARALLEL EXECUTION: Run 4 writers simultaneously (fan-out)
      const [execSummary, envSection, socSection, govSection] = await Promise.all([
        executiveSummaryWriter.execute(state, null),
        environmentalWriter.execute(state, null),
        socialWriter.execute(state, null),
        governanceWriter.execute(state, null),
      ]);

      const executionTime = Date.now() - startTime;
      console.log(`   ✅ All 4 writers completed in ${executionTime}ms (parallel execution)`);

      // GATHER RESULTS: Assemble final report
      const reportContent = {
        executiveSummary: execSummary.executiveSummary,
        environmental: envSection.environmental,
        social: socSection.social,
        governance: govSection.governance,
        compliance: govSection.compliance || {
          overview: 'Compliance information not available',
          regulations: [],
        },
        recommendations: await this.generateRecommendations(state),
      };

      console.log(`   📊 Report assembly complete`);

      return reportContent;
    } catch (error) {
      console.error(`   ❌ Multi-agent report generation failed:`, error.message);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate recommendations (simple AI call)
   */
  async generateRecommendations(state) {
    try {
      const prompt = `
Based on this company's ESG performance, provide 3-5 actionable recommendations for improvement.

Company: ${state.company.name}
Industry: ${state.company.industry}
ESG Data Points: ${state.esgData.length}

Respond with JSON array of strings:
["Recommendation 1", "Recommendation 2", "Recommendation 3"]
`;

      const result = await geminiClient.generateJSON(prompt);
      return Array.isArray(result) ? result : ['Continue ESG data collection', 'Improve reporting transparency', 'Set measurable targets'];
    } catch (error) {
      return ['Continue ESG data collection', 'Improve reporting transparency', 'Set measurable targets'];
    }
  }

  /**
   * LEGACY METHOD - Kept for backward compatibility
   * Use generateReportContentWithReview() instead for multi-agent orchestration
   */
  async generateReportContentLegacy(company, regulations, esgData, framework) {
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
      WHERE r.report_id = '${reportId}'
      LIMIT 1
    `;

    const rows = await bigQueryClient.query(query);
    
    if (rows.length === 0) {
      throw new Error('Report not found');
    }

    const report = rows[0];
    const content = JSON.parse(report.content);

    // Create PDF with beautiful formatting
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    const pdfPath = path.join(__dirname, '../../reports', `${reportId}.pdf`);

    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Color palette
    const colors = {
      primary: '#059669',    // Green
      secondary: '#0284c7',  // Blue
      accent: '#dc2626',     // Red
      text: '#1f2937',       // Dark gray
      lightGray: '#6b7280'   // Light gray
    };

    // Title Page with gradient effect
    doc.rect(0, 0, doc.page.width, 250).fill('#f0fdf4');
    doc.fillColor(colors.primary)
       .fontSize(32)
       .font('Helvetica-Bold')
       .text(`🌍 ${report.framework} Sustainability Report`, 50, 80, { align: 'center' });
    
    doc.fillColor(colors.text)
       .fontSize(24)
       .font('Helvetica')
       .text(report.company_name, { align: 'center' });
    
    doc.moveDown(2);
    doc.fillColor(colors.lightGray)
       .fontSize(12)
       .text(`📅 Reporting Period: ${report.reporting_period}`, { align: 'center' })
       .text(`🏭 Industry: ${report.industry}`, { align: 'center' })
       .text(`🌐 Country: ${report.country}`, { align: 'center' });

    // Executive Summary
    doc.addPage();
    doc.fillColor(colors.primary)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('📋 Executive Summary', 50, 50);
    
    doc.moveTo(50, 80).lineTo(545, 80).strokeColor(colors.primary).stroke();
    doc.moveDown(1);
    
    doc.fillColor(colors.text)
       .fontSize(11)
       .font('Helvetica')
       .text(content.executiveSummary, { align: 'justify' });

    // Environmental Section
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 100).fill('#ecfdf5');
    doc.fillColor(colors.primary)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('🌱 Environmental Performance', 50, 40);
    
    doc.moveTo(50, 70).lineTo(545, 70).strokeColor(colors.primary).stroke();
    doc.moveDown(2);
    
    doc.fillColor(colors.text)
       .fontSize(11)
       .font('Helvetica')
       .text(content.environmental.overview, 50, 110, { align: 'justify' });
    
    doc.moveDown(1.5);
    doc.fillColor(colors.secondary)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('📊 Key Metrics');
    doc.moveDown(0.5);
    
    content.environmental.keyMetrics.forEach((metric, idx) => {
      doc.fillColor(colors.primary)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`${idx + 1}. ${metric.metric}: ${metric.value}`, { indent: 20 });
      doc.fillColor(colors.lightGray)
         .fontSize(10)
         .font('Helvetica')
         .text(metric.analysis, { indent: 40, align: 'justify' });
      doc.moveDown(0.5);
    });

    // Social Section
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 100).fill('#eff6ff');
    doc.fillColor(colors.secondary)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('👥 Social Performance', 50, 40);
    
    doc.moveTo(50, 70).lineTo(545, 70).strokeColor(colors.secondary).stroke();
    doc.moveDown(2);
    
    doc.fillColor(colors.text)
       .fontSize(11)
       .font('Helvetica')
       .text(content.social.overview, 50, 110, { align: 'justify' });
    
    doc.moveDown(1.5);
    doc.fillColor(colors.secondary)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('📊 Key Metrics');
    doc.moveDown(0.5);
    
    content.social.keyMetrics.forEach((metric, idx) => {
      doc.fillColor(colors.secondary)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`${idx + 1}. ${metric.metric}: ${metric.value}`, { indent: 20 });
      doc.fillColor(colors.lightGray)
         .fontSize(10)
         .font('Helvetica')
         .text(metric.analysis, { indent: 40, align: 'justify' });
      doc.moveDown(0.5);
    });

    // Governance Section
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 100).fill('#fef2f2');
    doc.fillColor(colors.accent)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('⚖️ Governance', 50, 40);
    
    doc.moveTo(50, 70).lineTo(545, 70).strokeColor(colors.accent).stroke();
    doc.moveDown(2);
    
    doc.fillColor(colors.text)
       .fontSize(11)
       .font('Helvetica')
       .text(content.governance.overview, 50, 110, { align: 'justify' });
    
    doc.moveDown(1.5);
    doc.fillColor(colors.accent)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('📊 Key Metrics');
    doc.moveDown(0.5);
    
    content.governance.keyMetrics.forEach((metric, idx) => {
      doc.fillColor(colors.accent)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`${idx + 1}. ${metric.metric}: ${metric.value}`, { indent: 20 });
      doc.fillColor(colors.lightGray)
         .fontSize(10)
         .font('Helvetica')
         .text(metric.analysis, { indent: 40, align: 'justify' });
      doc.moveDown(0.5);
    });

    // Recommendations
    doc.addPage();
    doc.fillColor(colors.primary)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('💡 Recommendations', 50, 50);
    
    doc.moveTo(50, 80).lineTo(545, 80).strokeColor(colors.primary).stroke();
    doc.moveDown(1.5);
    
    content.recommendations.forEach((rec, index) => {
      doc.fillColor(colors.text)
         .fontSize(11)
         .font('Helvetica')
         .text(`${index + 1}. ${rec}`, { indent: 20, align: 'justify' });
      doc.moveDown(0.5);
    });

    // Footer on every page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(colors.lightGray)
         .fontSize(8)
         .font('Helvetica')
         .text(
           `Generated by ESG Copilot 🚀 | ${new Date().toLocaleDateString()} | Page ${i + 1} of ${pages.count}`,
           50,
           doc.page.height - 50,
           { align: 'center' }
         );
    }

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
      WHERE r.report_id = '${reportId}'
      LIMIT 1
    `;

    const rows = await bigQueryClient.query(query);
    
    if (rows.length === 0) {
      throw new Error('Report not found');
    }

    const report = rows[0];
    
    // Parse content if it's a string
    if (typeof report.content === 'string') {
      report.content = JSON.parse(report.content);
    }
    
    return report;
  }

  /**
   * Get all reports across all companies
   */
  async getAllReports() {
    const query = `
      SELECT 
        r.report_id, 
        r.company_id,
        c.name as company_name,
        r.framework, 
        r.reporting_period, 
        r.status, 
        r.generated_at, 
        r.generated_by,
        r.approved_at
      FROM \`${bigQueryClient.datasetId}.reports\` r
      JOIN \`${bigQueryClient.datasetId}.companies\` c ON r.company_id = c.company_id
      ORDER BY r.generated_at DESC
    `;

    return await bigQueryClient.query(query);
  }

  /**
   * Get all reports for a company
   */
  async getCompanyReports(companyId) {
    const query = `
      SELECT 
        r.report_id, 
        r.company_id,
        c.name as company_name,
        r.framework, 
        r.reporting_period, 
        r.status, 
        r.generated_at, 
        r.generated_by,
        r.approved_at
      FROM \`${bigQueryClient.datasetId}.reports\` r
      JOIN \`${bigQueryClient.datasetId}.companies\` c ON r.company_id = c.company_id
      WHERE r.company_id = '${companyId}'
      ORDER BY r.generated_at DESC
    `;

    return await bigQueryClient.query(query);
  }

  /**
   * Approve report (Auditor only)
   */
  async approveReport(reportId, userId) {
    const query = `
      UPDATE \`${bigQueryClient.datasetId}.reports\`
      SET status = 'approved',
          approved_by = '${userId}',
          approved_at = CURRENT_TIMESTAMP()
      WHERE report_id = '${reportId}'
    `;

    await bigQueryClient.query(query);
    
    console.log(`✅ Report approved: ${reportId} by ${userId}`);
    
    return await this.getReport(reportId);
  }

  /**
   * ✅ PRODUCTION: Ingest report into Pinecone for RAG
   */
  async ingestReportToPinecone({ reportId, companyId, framework, content }) {
    try {
      // Get API keys from environment
      const pineconeApiKey = process.env.PINECONE_API_KEY;
      const googleApiKey = process.env.GOOGLE_API_KEY;

      if (!pineconeApiKey || !googleApiKey) {
        console.warn('   ⚠️  Pinecone or Google API key not found - skipping RAG ingestion');
        return;
      }

      // Initialize RAG service
      const ragService = new RAGService(pineconeApiKey, googleApiKey);

      // Extract text chunks from report content
      const documents = [];
      
      console.log(`   🔍 Debug  - Report content keys:`, Object.keys(content));

      // 1. Executive Summary
      if (content.executiveSummary) {
        documents.push({
          id: `${reportId}-executive-summary`,
          text: content.executiveSummary,
          metadata: {
            company_id: companyId,
            report_id: reportId,
            framework: framework,
            section: 'Executive Summary',
            type: 'report',
          },
        });
      }

      // 2. Environmental Section
      if (content.environmental) {
        const envText = this.extractSectionText(content.environmental);
        if (envText) {
          documents.push({
            id: `${reportId}-environmental`,
            text: envText,
            metadata: {
              company_id: companyId,
              report_id: reportId,
              framework: framework,
              section: 'Environmental',
              type: 'report',
            },
          });
        }
      }

      // 3. Social Section
      if (content.social) {
        const socialText = this.extractSectionText(content.social);
        if (socialText) {
          documents.push({
            id: `${reportId}-social`,
            text: socialText,
            metadata: {
              company_id: companyId,
              report_id: reportId,
              framework: framework,
              section: 'Social',
              type: 'report',
            },
          });
        }
      }

      // 4. Governance Section
      if (content.governance) {
        const govText = this.extractSectionText(content.governance);
        if (govText) {
          documents.push({
            id: `${reportId}-governance`,
            text: govText,
            metadata: {
              company_id: companyId,
              report_id: reportId,
              framework: framework,
              section: 'Governance',
              type: 'report',
            },
          });
        }
      }

      // Ingest all documents into Pinecone
      console.log(`   📤 Ingesting ${documents.length} sections into Pinecone...`);
      await ragService.batchAddDocuments({
        documents,
        companyId,
        userId: 'system', // System-generated report
      });
      console.log(`   ✅ Report ingested into Pinecone successfully`);

    } catch (error) {
      console.error('   ❌ Error ingesting report to Pinecone:', error.message);
      // Don't throw - report generation should succeed even if RAG ingestion fails
    }
  }

  /**
   * Extract text from report section
   */
  extractSectionText(section) {
    if (!section) return '';

    let text = '';

    // Add overview/narrative
    if (section.overview) {
      text += section.overview + '\n\n';
    } else if (section.narrative) {
      text += section.narrative + '\n\n';
    }

    // Add key metrics
    if (section.keyMetrics && Array.isArray(section.keyMetrics)) {
      text += '**Key Metrics:**\n';
      section.keyMetrics.forEach(metric => {
        text += `- ${metric.metric}: ${metric.value}\n`;
        if (metric.analysis) {
          text += `  ${metric.analysis}\n`;
        }
      });
      text += '\n';
    }

    // Add initiatives
    if (section.initiatives && Array.isArray(section.initiatives)) {
      text += '**Initiatives:**\n';
      section.initiatives.forEach(initiative => {
        text += `- ${initiative}\n`;
      });
      text += '\n';
    }

    // Add targets
    if (section.targets && Array.isArray(section.targets)) {
      text += '**Targets:**\n';
      section.targets.forEach(target => {
        text += `- ${target}\n`;
      });
      text += '\n';
    }

    // Fallback: Add metrics if exists (old structure)
    if (section.metrics && Array.isArray(section.metrics)) {
      section.metrics.forEach(metric => {
        text += `${metric.name}: ${metric.value} ${metric.unit || ''}\n`;
        if (metric.description) {
          text += `${metric.description}\n`;
        }
      });
    }

    return text.trim();
  }
}

module.exports = new ReportGeneratorService();
