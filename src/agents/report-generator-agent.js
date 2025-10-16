// Report Generator Agent
// Orchestrates ESG report generation with parallel section creation
// Supports multiple formats: PDF, Excel, HTML
// Implements GRI, SASB, TCFD templates

const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');
const ContentWriterAgent = require('./sub-agents/content-writer-agent');
const ChartBuilderAgent = require('./sub-agents/chart-builder-agent');
const FormatterAgent = require('./sub-agents/formatter-agent');

class ReportGeneratorAgent {
  constructor() {
    this.name = 'ReportGeneratorAgent';
    this.templates = ['GRI', 'SASB', 'TCFD', 'Custom'];
  }

  /**
   * Main execution - Orchestrate report generation
   */
  async execute(state) {
    console.log(`\n📄 [${this.name}] Starting ESG report generation...`);
    
    const startTime = Date.now();
    const { companyInfo, esgData, emissions, reportConfig } = state;

    try {
      // Step 1: Determine report template
      const template = reportConfig?.template || 'GRI';
      console.log(`   📋 Using template: ${template}`);

      // Step 2: Define report sections based on template
      const sections = this.defineReportSections(template, esgData, emissions);
      console.log(`   📑 Generating ${sections.length} sections in parallel...`);

      // Step 3: Generate sections in parallel
      const sectionResults = await this.generateSectionsParallel(
        sections,
        companyInfo,
        esgData,
        emissions,
        template
      );

      // Step 4: Generate charts in parallel
      console.log(`   📊 Generating visualizations...`);
      const charts = await this.generateCharts(esgData, emissions);

      // Step 5: Assemble complete report
      const reportContent = this.assembleReport(
        sectionResults,
        charts,
        companyInfo,
        template
      );

      // Step 6: Format report in requested formats
      const formats = reportConfig?.formats || ['PDF', 'HTML'];
      console.log(`   🎨 Formatting report: ${formats.join(', ')}...`);
      
      const formattedReports = await this.formatReports(
        reportContent,
        formats,
        companyInfo,
        template
      );

      // Step 7: Log the action
      const duration = Date.now() - startTime;
      await agentLogger.logAction(
        this.name,
        state.userId,
        'generate_report',
        { companyInfo, template, formats },
        { reportContent, formattedReports },
        'success',
        null,
        duration
      );

      // Step 8: Broadcast completion
      await messageQueue.publishMessage(
        this.name,
        'OrchestratorAgent',
        'report_generated',
        { formattedReports },
        state.taskId
      );

      console.log(`✅ [${this.name}] Report generated successfully`);
      console.log(`   Template: ${template}`);
      console.log(`   Sections: ${sections.length}`);
      console.log(`   Charts: ${charts.length}`);
      console.log(`   Formats: ${formats.join(', ')}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

      return {
        ...state,
        report: {
          content: reportContent,
          formatted: formattedReports,
          template,
          generatedAt: new Date().toISOString(),
        },
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Generated ${template} ESG report in ${formats.join(', ')} format(s)`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);

      await agentLogger.logAction(
        this.name,
        state.userId,
        'generate_report',
        { companyInfo },
        null,
        'error',
        error
      );

      return {
        ...state,
        errors: [...state.errors, { agent: this.name, error: error.message }],
      };
    }
  }

  /**
   * Define report sections based on template
   */
  defineReportSections(template, esgData, emissions) {
    const baseSections = [
      { id: 'executive_summary', title: 'Executive Summary', priority: 1 },
      { id: 'company_overview', title: 'Company Overview', priority: 2 },
      { id: 'methodology', title: 'Methodology & Scope', priority: 3 },
    ];

    const templateSections = {
      GRI: [
        ...baseSections,
        { id: 'gri_environmental', title: 'Environmental Performance (GRI 300)', priority: 4 },
        { id: 'gri_social', title: 'Social Performance (GRI 400)', priority: 5 },
        { id: 'gri_governance', title: 'Governance (GRI 200)', priority: 6 },
        { id: 'gri_emissions', title: 'Emissions (GRI 305)', priority: 7 },
        { id: 'gri_materiality', title: 'Materiality Assessment', priority: 8 },
      ],
      SASB: [
        ...baseSections,
        { id: 'sasb_environmental', title: 'Environmental Capital', priority: 4 },
        { id: 'sasb_social', title: 'Social Capital', priority: 5 },
        { id: 'sasb_human', title: 'Human Capital', priority: 6 },
        { id: 'sasb_business', title: 'Business Model & Innovation', priority: 7 },
        { id: 'sasb_leadership', title: 'Leadership & Governance', priority: 8 },
      ],
      TCFD: [
        ...baseSections,
        { id: 'tcfd_governance', title: 'Governance', priority: 4 },
        { id: 'tcfd_strategy', title: 'Strategy', priority: 5 },
        { id: 'tcfd_risk', title: 'Risk Management', priority: 6 },
        { id: 'tcfd_metrics', title: 'Metrics & Targets', priority: 7 },
        { id: 'tcfd_scenarios', title: 'Scenario Analysis', priority: 8 },
      ],
      Custom: [
        ...baseSections,
        { id: 'environmental', title: 'Environmental Impact', priority: 4 },
        { id: 'social', title: 'Social Responsibility', priority: 5 },
        { id: 'governance', title: 'Corporate Governance', priority: 6 },
        { id: 'emissions', title: 'Carbon Footprint', priority: 7 },
      ],
    };

    const sections = templateSections[template] || templateSections.Custom;
    
    // Add conclusion section
    sections.push({ id: 'conclusion', title: 'Conclusion & Next Steps', priority: 99 });

    return sections;
  }

  /**
   * Generate all sections in parallel
   */
  async generateSectionsParallel(sections, companyInfo, esgData, emissions, template) {
    const contentWriter = new ContentWriterAgent();

    // Execute all sections in parallel
    const sectionPromises = sections.map(async (section) => {
      try {
        console.log(`      ↳ Generating: ${section.title}...`);
        
        const content = await contentWriter.execute({
          section,
          companyInfo,
          esgData,
          emissions,
          template,
        });

        console.log(`      ✓ ${section.title} complete`);
        
        return {
          ...section,
          content,
          success: true,
        };
      } catch (error) {
        console.error(`      ✗ ${section.title} failed:`, error.message);
        return {
          ...section,
          content: `Error generating section: ${error.message}`,
          success: false,
        };
      }
    });

    const results = await Promise.all(sectionPromises);
    
    // Sort by priority
    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate charts and visualizations
   */
  async generateCharts(esgData, emissions) {
    const chartBuilder = new ChartBuilderAgent();

    const chartSpecs = [
      {
        id: 'emissions_breakdown',
        type: 'pie',
        title: 'Emissions by Scope',
        data: emissions,
      },
      {
        id: 'emissions_trend',
        type: 'line',
        title: 'Emissions Trend',
        data: emissions,
      },
      {
        id: 'esg_score',
        type: 'bar',
        title: 'ESG Performance',
        data: esgData,
      },
      {
        id: 'environmental_metrics',
        type: 'radar',
        title: 'Environmental Metrics',
        data: esgData?.environmental,
      },
    ];

    // Generate charts in parallel
    const chartPromises = chartSpecs.map(async (spec) => {
      try {
        const chart = await chartBuilder.execute(spec);
        return { ...spec, chart, success: true };
      } catch (error) {
        console.warn(`      ⚠️  Chart ${spec.id} failed:`, error.message);
        return { ...spec, chart: null, success: false };
      }
    });

    const results = await Promise.all(chartPromises);
    return results.filter(r => r.success);
  }

  /**
   * Assemble complete report from sections and charts
   */
  assembleReport(sections, charts, companyInfo, template) {
    const report = {
      metadata: {
        title: `${companyInfo.name} ESG Report`,
        subtitle: `${template} Framework`,
        company: companyInfo.name,
        reportingPeriod: new Date().getFullYear(),
        generatedDate: new Date().toISOString(),
        template,
      },
      sections: sections.map(section => ({
        id: section.id,
        title: section.title,
        content: section.content,
        pageBreak: true,
      })),
      charts: charts.map(chart => ({
        id: chart.id,
        title: chart.title,
        type: chart.type,
        data: chart.chart,
      })),
      footer: {
        disclaimer: 'This report was generated using AI-powered ESG analysis tools. Data should be verified for accuracy.',
        contact: companyInfo.email || companyInfo.website,
      },
    };

    return report;
  }

  /**
   * Format reports in multiple formats
   */
  async formatReports(reportContent, formats, companyInfo, template) {
    const formatter = new FormatterAgent();
    const formattedReports = {};

    // Format each requested format in parallel
    const formatPromises = formats.map(async (format) => {
      try {
        console.log(`      ↳ Formatting ${format}...`);
        
        const formatted = await formatter.execute({
          reportContent,
          format,
          companyInfo,
          template,
        });

        console.log(`      ✓ ${format} complete`);
        
        return { format, data: formatted, success: true };
      } catch (error) {
        console.error(`      ✗ ${format} failed:`, error.message);
        return { format, data: null, success: false, error: error.message };
      }
    });

    const results = await Promise.all(formatPromises);

    results.forEach(result => {
      if (result.success) {
        formattedReports[result.format] = result.data;
      }
    });

    return formattedReports;
  }

  /**
   * Validate report completeness
   */
  validateReport(report) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check required sections
    const requiredSections = ['executive_summary', 'company_overview', 'methodology'];
    requiredSections.forEach(sectionId => {
      const section = report.sections.find(s => s.id === sectionId);
      if (!section || !section.content) {
        validation.errors.push(`Missing required section: ${sectionId}`);
        validation.isValid = false;
      }
    });

    // Check charts
    if (report.charts.length === 0) {
      validation.warnings.push('No charts generated');
    }

    return validation;
  }
}

module.exports = ReportGeneratorAgent;
