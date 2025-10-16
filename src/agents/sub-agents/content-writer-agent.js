// Content Writer Sub-Agent
// Uses Gemini AI to generate professional ESG report content
// Adapts writing style based on template (GRI, SASB, TCFD)

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class ContentWriterAgent {
  constructor() {
    this.name = 'ContentWriterAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3, // Slightly higher for creative writing
    });
  }

  /**
   * Execute content generation for a report section
   */
  async execute(params) {
    const { section, companyInfo, esgData, emissions, template } = params;

    try {
      // Generate content based on section type
      const content = await this.generateSectionContent(
        section,
        companyInfo,
        esgData,
        emissions,
        template
      );

      return content;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error generating ${section.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate content for a specific section
   */
  async generateSectionContent(section, companyInfo, esgData, emissions, template) {
    const sectionGenerators = {
      executive_summary: () => this.generateExecutiveSummary(companyInfo, esgData, emissions, template),
      company_overview: () => this.generateCompanyOverview(companyInfo),
      methodology: () => this.generateMethodology(template),
      
      // GRI sections
      gri_environmental: () => this.generateGRIEnvironmental(esgData, emissions),
      gri_social: () => this.generateGRISocial(esgData),
      gri_governance: () => this.generateGRIGovernance(esgData),
      gri_emissions: () => this.generateGRIEmissions(emissions),
      gri_materiality: () => this.generateGRIMateriality(companyInfo, esgData),
      
      // SASB sections
      sasb_environmental: () => this.generateSASBEnvironmental(esgData, emissions),
      sasb_social: () => this.generateSASBSocial(esgData),
      sasb_human: () => this.generateSASBHuman(esgData),
      sasb_business: () => this.generateSASBBusiness(companyInfo, esgData),
      sasb_leadership: () => this.generateSASBLeadership(esgData),
      
      // TCFD sections
      tcfd_governance: () => this.generateTCFDGovernance(esgData),
      tcfd_strategy: () => this.generateTCFDStrategy(companyInfo, emissions),
      tcfd_risk: () => this.generateTCFDRisk(emissions),
      tcfd_metrics: () => this.generateTCFDMetrics(emissions),
      tcfd_scenarios: () => this.generateTCFDScenarios(companyInfo, emissions),
      
      // Custom sections
      environmental: () => this.generateEnvironmental(esgData, emissions),
      social: () => this.generateSocial(esgData),
      governance: () => this.generateGovernance(esgData),
      emissions: () => this.generateEmissions(emissions),
      
      conclusion: () => this.generateConclusion(companyInfo, esgData, emissions, template),
    };

    const generator = sectionGenerators[section.id];
    if (!generator) {
      return this.generateGenericSection(section, companyInfo, esgData, emissions);
    }

    return await generator();
  }

  /**
   * Generate Executive Summary
   */
  async generateExecutiveSummary(companyInfo, esgData, emissions, template) {
    const prompt = `Write a professional executive summary for an ESG report using the ${template} framework.

Company: ${companyInfo.name}
Industry: ${companyInfo.industry || 'Not specified'}
Reporting Period: ${new Date().getFullYear()}

Key Data:
- Total Emissions: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e
- Scope 1: ${emissions?.scope1?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 2: ${emissions?.scope2?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 3: ${emissions?.scope3?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Data Quality: ${emissions?.data_quality || 'N/A'}

Write a compelling 3-4 paragraph executive summary that:
1. Introduces the company's ESG commitment
2. Highlights key achievements and metrics
3. Acknowledges challenges and areas for improvement
4. Outlines future goals and commitments

Use professional, formal language appropriate for stakeholders and investors.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate Company Overview
   */
  async generateCompanyOverview(companyInfo) {
    const prompt = `Write a company overview section for an ESG report.

Company Information:
- Name: ${companyInfo.name}
- Industry: ${companyInfo.industry || 'Not specified'}
- Location: ${companyInfo.country || 'Not specified'}
- Employees: ${companyInfo.employees || 'Not specified'}
- Website: ${companyInfo.website || 'Not specified'}

Write 2-3 paragraphs covering:
1. Company background and mission
2. Business operations and market presence
3. ESG relevance to the business model

Keep it factual and professional.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate Methodology section
   */
  async generateMethodology(template) {
    const prompt = `Write a methodology section for an ESG report following the ${template} framework.

Explain:
1. Data collection methods (web scraping, AI estimation, API integration)
2. Calculation methodologies (Climatiq API for emissions)
3. Reporting boundaries and scope
4. Data quality and verification processes
5. Alignment with ${template} standards

Be specific about the tools and methods used. 2-3 paragraphs.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate GRI Environmental section (GRI 300 series)
   */
  async generateGRIEnvironmental(esgData, emissions) {
    const envData = esgData?.environmental || {};
    
    const prompt = `Write the Environmental Performance section for a GRI report (GRI 300 series).

Available Data:
${JSON.stringify(envData, null, 2)}

Emissions Data:
- Total: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e
- Breakdown: ${JSON.stringify(emissions?.breakdown || {}, null, 2)}

Cover GRI 300 topics:
- Materials (GRI 301)
- Energy (GRI 302)
- Water (GRI 303)
- Biodiversity (GRI 304)
- Emissions (GRI 305)
- Waste (GRI 306)

Write 3-4 paragraphs with specific metrics and performance indicators.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate GRI Social section (GRI 400 series)
   */
  async generateGRISocial(esgData) {
    const socialData = esgData?.social || {};
    
    const prompt = `Write the Social Performance section for a GRI report (GRI 400 series).

Available Data:
${JSON.stringify(socialData, null, 2)}

Cover GRI 400 topics:
- Employment (GRI 401)
- Labor Relations (GRI 402)
- Health & Safety (GRI 403)
- Training & Education (GRI 404)
- Diversity & Equal Opportunity (GRI 405)
- Non-discrimination (GRI 406)

Write 3-4 paragraphs highlighting social impact and employee welfare.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate GRI Governance section (GRI 200 series)
   */
  async generateGRIGovernance(esgData) {
    const govData = esgData?.governance || {};
    
    const prompt = `Write the Governance section for a GRI report (GRI 200 series).

Available Data:
${JSON.stringify(govData, null, 2)}

Cover GRI 200 topics:
- Economic Performance (GRI 201)
- Anti-corruption (GRI 205)
- Anti-competitive Behavior (GRI 206)
- Tax (GRI 207)

Write 2-3 paragraphs on governance structure, ethics, and compliance.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate GRI Emissions section (GRI 305)
   */
  async generateGRIEmissions(emissions) {
    const prompt = `Write a detailed GRI 305 (Emissions) section.

Emissions Data:
- Total: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e
- Scope 1: ${emissions?.scope1?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 2: ${emissions?.scope2?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 3: ${emissions?.scope3?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Data Quality: ${emissions?.data_quality || 'N/A'}

Breakdown:
${JSON.stringify(emissions?.breakdown || {}, null, 2)}

Write 3-4 paragraphs covering:
1. GHG emissions inventory (Scope 1, 2, 3)
2. Emission intensity metrics
3. Reduction initiatives and targets
4. Methodology and data quality

Be specific and data-driven.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate GRI Materiality Assessment
   */
  async generateGRIMateriality(companyInfo, esgData) {
    const prompt = `Write a Materiality Assessment section for a GRI report.

Company: ${companyInfo.name}
Industry: ${companyInfo.industry || 'General Business'}

Available ESG Data:
- Environmental metrics: ${Object.keys(esgData?.environmental || {}).length}
- Social metrics: ${Object.keys(esgData?.social || {}).length}
- Governance metrics: ${Object.keys(esgData?.governance || {}).length}

Explain:
1. Materiality assessment process
2. Key material topics identified
3. Stakeholder engagement
4. Impact on business and society

Write 2-3 paragraphs.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate TCFD Governance section
   */
  async generateTCFDGovernance(esgData) {
    const prompt = `Write the Governance section for a TCFD report.

Describe:
1. Board oversight of climate-related risks and opportunities
2. Management's role in assessing and managing climate risks
3. Climate governance structure

Use available governance data:
${JSON.stringify(esgData?.governance || {}, null, 2)}

Write 2-3 paragraphs following TCFD recommendations.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate TCFD Strategy section
   */
  async generateTCFDStrategy(companyInfo, emissions) {
    const prompt = `Write the Strategy section for a TCFD report.

Company: ${companyInfo.name}
Industry: ${companyInfo.industry || 'General Business'}
Current Emissions: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e

Cover:
1. Climate-related risks and opportunities
2. Impact on business, strategy, and financial planning
3. Resilience of strategy under different climate scenarios

Write 3-4 paragraphs with strategic insights.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate TCFD Risk Management section
   */
  async generateTCFDRisk(emissions) {
    const prompt = `Write the Risk Management section for a TCFD report.

Current Emissions Profile:
- Scope 1: ${emissions?.scope1?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 2: ${emissions?.scope2?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 3: ${emissions?.scope3?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes

Describe:
1. Processes for identifying climate-related risks
2. Processes for managing climate-related risks
3. Integration into overall risk management

Write 2-3 paragraphs.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate TCFD Metrics & Targets section
   */
  async generateTCFDMetrics(emissions) {
    const prompt = `Write the Metrics & Targets section for a TCFD report.

Current Metrics:
- Total GHG Emissions: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e
- Scope 1: ${emissions?.scope1?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 2: ${emissions?.scope2?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes
- Scope 3: ${emissions?.scope3?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes

Cover:
1. Metrics used to assess climate-related risks and opportunities
2. Scope 1, 2, and 3 GHG emissions
3. Targets and performance against targets

Write 2-3 paragraphs with specific metrics.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate TCFD Scenario Analysis
   */
  async generateTCFDScenarios(companyInfo, emissions) {
    const prompt = `Write a Scenario Analysis section for a TCFD report.

Company: ${companyInfo.name}
Current Emissions: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e

Analyze climate scenarios:
1. 1.5°C warming scenario (Paris Agreement aligned)
2. 2°C warming scenario
3. Business-as-usual scenario (3-4°C)

For each scenario, discuss:
- Physical risks (extreme weather, sea level rise)
- Transition risks (policy, technology, market changes)
- Business implications

Write 3-4 paragraphs.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate SASB Environmental Capital section
   */
  async generateSASBEnvironmental(esgData, emissions) {
    const prompt = `Write the Environmental Capital section for a SASB report.

Environmental Data:
${JSON.stringify(esgData?.environmental || {}, null, 2)}

Emissions:
${JSON.stringify(emissions, null, 2)}

Cover SASB environmental topics:
- GHG Emissions
- Air Quality
- Energy Management
- Water & Wastewater Management
- Waste & Hazardous Materials Management
- Ecological Impacts

Write 3-4 paragraphs with industry-specific metrics.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate SASB Social Capital section
   */
  async generateSASBSocial(esgData) {
    const prompt = `Write the Social Capital section for a SASB report.

Social Data:
${JSON.stringify(esgData?.social || {}, null, 2)}

Cover:
- Customer Privacy
- Data Security
- Access & Affordability
- Product Quality & Safety
- Customer Welfare
- Selling Practices & Product Labeling

Write 2-3 paragraphs.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate SASB Human Capital section
   */
  async generateSASBHuman(esgData) {
    const prompt = `Write the Human Capital section for a SASB report.

Social/HR Data:
${JSON.stringify(esgData?.social || {}, null, 2)}

Cover:
- Labor Practices
- Employee Health & Safety
- Employee Engagement, Diversity & Inclusion

Write 2-3 paragraphs on workforce management.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate SASB Business Model & Innovation section
   */
  async generateSASBBusiness(companyInfo, esgData) {
    const prompt = `Write the Business Model & Innovation section for a SASB report.

Company: ${companyInfo.name}
Industry: ${companyInfo.industry || 'General Business'}

Cover:
- Product Design & Lifecycle Management
- Business Model Resilience
- Supply Chain Management
- Materials Sourcing & Efficiency
- Physical Impacts of Climate Change

Write 2-3 paragraphs on sustainable innovation.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate SASB Leadership & Governance section
   */
  async generateSASBLeadership(esgData) {
    const prompt = `Write the Leadership & Governance section for a SASB report.

Governance Data:
${JSON.stringify(esgData?.governance || {}, null, 2)}

Cover:
- Business Ethics
- Competitive Behavior
- Management of the Legal & Regulatory Environment
- Critical Incident Risk Management
- Systemic Risk Management

Write 2-3 paragraphs.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate generic Environmental section
   */
  async generateEnvironmental(esgData, emissions) {
    return this.generateGRIEnvironmental(esgData, emissions);
  }

  /**
   * Generate generic Social section
   */
  async generateSocial(esgData) {
    return this.generateGRISocial(esgData);
  }

  /**
   * Generate generic Governance section
   */
  async generateGovernance(esgData) {
    return this.generateGRIGovernance(esgData);
  }

  /**
   * Generate generic Emissions section
   */
  async generateEmissions(emissions) {
    return this.generateGRIEmissions(emissions);
  }

  /**
   * Generate Conclusion
   */
  async generateConclusion(companyInfo, esgData, emissions, template) {
    const prompt = `Write a conclusion section for an ESG report (${template} framework).

Company: ${companyInfo.name}
Total Emissions: ${emissions?.total?.co2e_tonnes?.toFixed(2) || 'N/A'} tonnes CO2e

Summarize:
1. Key findings and achievements
2. Areas for improvement
3. Next steps and future commitments
4. Call to action for stakeholders

Write 2-3 paragraphs with an inspiring, forward-looking tone.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }

  /**
   * Generate generic section content
   */
  async generateGenericSection(section, companyInfo, esgData, emissions) {
    const prompt = `Write content for the "${section.title}" section of an ESG report.

Company: ${companyInfo.name}

Available Data:
- ESG Data: ${JSON.stringify(esgData, null, 2)}
- Emissions: ${JSON.stringify(emissions, null, 2)}

Write 2-3 professional paragraphs relevant to this section.`;

    const response = await this.llm.invoke(prompt);
    return response.content;
  }
}

module.exports = ContentWriterAgent;
