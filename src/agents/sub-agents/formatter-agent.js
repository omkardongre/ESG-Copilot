// Formatter Sub-Agent
// Formats ESG reports into PDF, Excel, and HTML
// Uses PDFKit for PDF, ExcelJS for Excel, and custom HTML templates

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class FormatterAgent {
  constructor() {
    this.name = 'FormatterAgent';
    this.outputDir = path.join(process.cwd(), 'reports');
  }

  /**
   * Execute report formatting
   */
  async execute(params) {
    const { reportContent, format, companyInfo, template } = params;

    try {
      // Ensure output directory exists
      await this.ensureOutputDir();

      // Format based on requested format
      const formatters = {
        PDF: () => this.formatPDF(reportContent, companyInfo, template),
        EXCEL: () => this.formatExcel(reportContent, companyInfo, template),
        HTML: () => this.formatHTML(reportContent, companyInfo, template),
      };

      const formatter = formatters[format.toUpperCase()];
      if (!formatter) {
        throw new Error(`Unsupported format: ${format}`);
      }

      const result = await formatter();
      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error formatting ${format}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Format report as PDF
   */
  async formatPDF(reportContent, companyInfo, template) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50,
      },
      info: {
        Title: reportContent.metadata.title,
        Author: companyInfo.name,
        Subject: `${template} ESG Report`,
        Keywords: 'ESG, Sustainability, Report',
      },
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Cover page
    this.addPDFCoverPage(doc, reportContent.metadata, companyInfo);

    // Table of contents
    doc.addPage();
    this.addPDFTableOfContents(doc, reportContent.sections);

    // Sections
    reportContent.sections.forEach((section, index) => {
      doc.addPage();
      this.addPDFSection(doc, section, index + 1);
    });

    // Charts
    if (reportContent.charts && reportContent.charts.length > 0) {
      doc.addPage();
      doc.fontSize(20).text('Visualizations', { underline: true });
      doc.moveDown();

      reportContent.charts.forEach(chart => {
        if (chart.data) {
          try {
            const imageBuffer = Buffer.from(chart.data, 'base64');
            doc.image(imageBuffer, {
              fit: [500, 300],
              align: 'center',
            });
            doc.moveDown();
            doc.fontSize(12).text(chart.title, { align: 'center' });
            doc.moveDown(2);
          } catch (error) {
            console.warn(`Failed to embed chart ${chart.id}:`, error.message);
          }
        }
      });
    }

    // Footer
    this.addPDFFooter(doc, reportContent.footer);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const filename = `${companyInfo.name.replace(/\s+/g, '_')}_ESG_Report_${template}_${Date.now()}.pdf`;
        const filepath = path.join(this.outputDir, filename);

        fs.writeFile(filepath, pdfBuffer)
          .then(() => {
            resolve({
              format: 'PDF',
              filename,
              filepath,
              size: pdfBuffer.length,
              buffer: pdfBuffer,
            });
          })
          .catch(reject);
      });

      doc.on('error', reject);
    });
  }

  /**
   * Add PDF cover page
   */
  addPDFCoverPage(doc, metadata, companyInfo) {
    doc.fontSize(30).text(metadata.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(metadata.subtitle, { align: 'center' });
    doc.moveDown(3);

    doc.fontSize(14).text(`Company: ${companyInfo.name}`, { align: 'center' });
    doc.text(`Reporting Period: ${metadata.reportingPeriod}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).text(`Generated: ${new Date(metadata.generatedDate).toLocaleDateString()}`, {
      align: 'center',
    });
  }

  /**
   * Add PDF table of contents
   */
  addPDFTableOfContents(doc, sections) {
    doc.fontSize(20).text('Table of Contents', { underline: true });
    doc.moveDown();

    sections.forEach((section, index) => {
      doc.fontSize(12).text(`${index + 1}. ${section.title}`);
      doc.moveDown(0.5);
    });
  }

  /**
   * Add PDF section
   */
  addPDFSection(doc, section, number) {
    doc.fontSize(18).text(`${number}. ${section.title}`, { underline: true });
    doc.moveDown();

    // Split content into paragraphs
    const paragraphs = section.content.split('\n\n');
    paragraphs.forEach(paragraph => {
      if (paragraph.trim()) {
        doc.fontSize(11).text(paragraph.trim(), {
          align: 'justify',
          lineGap: 5,
        });
        doc.moveDown();
      }
    });
  }

  /**
   * Add PDF footer
   */
  addPDFFooter(doc, footer) {
    doc.addPage();
    doc.fontSize(16).text('Disclaimer', { underline: true });
    doc.moveDown();
    doc.fontSize(10).text(footer.disclaimer, { align: 'justify' });
    doc.moveDown();
    doc.fontSize(10).text(`Contact: ${footer.contact}`);
  }

  /**
   * Format report as Excel
   */
  async formatExcel(reportContent, companyInfo, template) {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = companyInfo.name;
    workbook.created = new Date();
    workbook.modified = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.addExcelSummary(summarySheet, reportContent.metadata, companyInfo);

    // Sections sheet
    const sectionsSheet = workbook.addWorksheet('Report Content');
    this.addExcelSections(sectionsSheet, reportContent.sections);

    // Data sheet (if emissions data available)
    if (reportContent.sections.some(s => s.id.includes('emission'))) {
      const dataSheet = workbook.addWorksheet('Emissions Data');
      this.addExcelEmissionsData(dataSheet, reportContent);
    }

    // Charts sheet
    if (reportContent.charts && reportContent.charts.length > 0) {
      const chartsSheet = workbook.addWorksheet('Visualizations');
      this.addExcelCharts(chartsSheet, reportContent.charts);
    }

    const filename = `${companyInfo.name.replace(/\s+/g, '_')}_ESG_Report_${template}_${Date.now()}.xlsx`;
    const filepath = path.join(this.outputDir, filename);

    await workbook.xlsx.writeFile(filepath);

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      format: 'EXCEL',
      filename,
      filepath,
      size: buffer.length,
      buffer,
    };
  }

  /**
   * Add Excel summary sheet
   */
  addExcelSummary(sheet, metadata, companyInfo) {
    sheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 50 },
    ];

    sheet.addRow({ field: 'Report Title', value: metadata.title });
    sheet.addRow({ field: 'Framework', value: metadata.subtitle });
    sheet.addRow({ field: 'Company', value: companyInfo.name });
    sheet.addRow({ field: 'Reporting Period', value: metadata.reportingPeriod });
    sheet.addRow({ field: 'Generated Date', value: new Date(metadata.generatedDate).toLocaleDateString() });

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
  }

  /**
   * Add Excel sections
   */
  addExcelSections(sheet, sections) {
    sheet.columns = [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Content', key: 'content', width: 100 },
    ];

    sections.forEach(section => {
      sheet.addRow({
        section: section.title,
        content: section.content,
      });
    });

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    // Wrap text
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { wrapText: true, vertical: 'top' };
      }
    });
  }

  /**
   * Add Excel emissions data
   */
  addExcelEmissionsData(sheet, reportContent) {
    sheet.columns = [
      { header: 'Scope', key: 'scope', width: 20 },
      { header: 'Emissions (tonnes CO2e)', key: 'emissions', width: 25 },
      { header: 'Percentage', key: 'percentage', width: 15 },
    ];

    // Extract emissions data from sections (simplified)
    sheet.addRow({ scope: 'Scope 1 (Direct)', emissions: 'N/A', percentage: 'N/A' });
    sheet.addRow({ scope: 'Scope 2 (Electricity)', emissions: 'N/A', percentage: 'N/A' });
    sheet.addRow({ scope: 'Scope 3 (Indirect)', emissions: 'N/A', percentage: 'N/A' });
    sheet.addRow({ scope: 'Total', emissions: 'N/A', percentage: '100%' });

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
  }

  /**
   * Add Excel charts info
   */
  addExcelCharts(sheet, charts) {
    sheet.columns = [
      { header: 'Chart ID', key: 'id', width: 30 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Type', key: 'type', width: 15 },
    ];

    charts.forEach(chart => {
      sheet.addRow({
        id: chart.id,
        title: chart.title,
        type: chart.type,
      });
    });

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
  }

  /**
   * Format report as HTML
   */
  async formatHTML(reportContent, companyInfo, template) {
    const html = this.generateHTML(reportContent, companyInfo, template);

    const filename = `${companyInfo.name.replace(/\s+/g, '_')}_ESG_Report_${template}_${Date.now()}.html`;
    const filepath = path.join(this.outputDir, filename);

    await fs.writeFile(filepath, html, 'utf8');

    return {
      format: 'HTML',
      filename,
      filepath,
      size: Buffer.byteLength(html, 'utf8'),
      html,
    };
  }

  /**
   * Generate HTML content
   */
  generateHTML(reportContent, companyInfo, template) {
    const { metadata, sections, charts, footer } = reportContent;

    const chartsHTML = charts
      .map(
        chart => `
      <div class="chart">
        <h3>${chart.title}</h3>
        <img src="${chart.data ? `data:image/png;base64,${chart.data}` : ''}" alt="${chart.title}" />
      </div>
    `
      )
      .join('');

    const sectionsHTML = sections
      .map(
        (section, index) => `
      <section id="section-${index}">
        <h2>${index + 1}. ${section.title}</h2>
        <div class="content">
          ${section.content.split('\n\n').map(p => `<p>${p}</p>`).join('')}
        </div>
      </section>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
    }
    
    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    header p {
      font-size: 1.2em;
      opacity: 0.9;
    }
    
    .metadata {
      background: #f8f9fa;
      padding: 20px 40px;
      border-bottom: 1px solid #dee2e6;
    }
    
    .metadata p {
      margin: 5px 0;
      color: #666;
    }
    
    nav {
      background: #343a40;
      padding: 15px 40px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    nav ul {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    
    nav a {
      color: white;
      text-decoration: none;
      font-size: 0.9em;
      transition: color 0.3s;
    }
    
    nav a:hover {
      color: #667eea;
    }
    
    main {
      padding: 40px;
    }
    
    section {
      margin-bottom: 50px;
      padding-bottom: 30px;
      border-bottom: 1px solid #e9ecef;
    }
    
    section:last-child {
      border-bottom: none;
    }
    
    h2 {
      color: #667eea;
      font-size: 1.8em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    
    .content p {
      margin-bottom: 15px;
      text-align: justify;
    }
    
    .charts {
      margin-top: 50px;
      padding: 40px;
      background: #f8f9fa;
    }
    
    .charts h2 {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .chart {
      margin-bottom: 40px;
      text-align: center;
    }
    
    .chart h3 {
      color: #495057;
      margin-bottom: 20px;
    }
    
    .chart img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    footer {
      background: #343a40;
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    footer p {
      margin-bottom: 10px;
      opacity: 0.8;
    }
    
    @media print {
      nav {
        display: none;
      }
      
      section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${metadata.title}</h1>
      <p>${metadata.subtitle}</p>
    </header>
    
    <div class="metadata">
      <p><strong>Company:</strong> ${companyInfo.name}</p>
      <p><strong>Reporting Period:</strong> ${metadata.reportingPeriod}</p>
      <p><strong>Generated:</strong> ${new Date(metadata.generatedDate).toLocaleDateString()}</p>
      <p><strong>Framework:</strong> ${template}</p>
    </div>
    
    <nav>
      <ul>
        ${sections.map((s, i) => `<li><a href="#section-${i}">${s.title}</a></li>`).join('')}
      </ul>
    </nav>
    
    <main>
      ${sectionsHTML}
    </main>
    
    ${
      charts.length > 0
        ? `
    <div class="charts">
      <h2>Visualizations</h2>
      ${chartsHTML}
    </div>
    `
        : ''
    }
    
    <footer>
      <p>${footer.disclaimer}</p>
      <p><strong>Contact:</strong> ${footer.contact}</p>
      <p>&copy; ${new Date().getFullYear()} ${companyInfo.name}. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>
    `.trim();
  }
}

module.exports = FormatterAgent;
