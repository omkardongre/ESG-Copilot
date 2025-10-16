// ESG Copilot Configuration
require('dotenv').config();

module.exports = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Auth0
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    audience: process.env.AUTH0_API_IDENTIFIER,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  },

  // Google Cloud
  gcp: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    datasetId: process.env.DATASET_ID || 'esg_copilot_data',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    region: process.env.CLOUD_PROJECT_REGION || 'us-central1',
  },

  // Gemini AI
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.MODEL || 'gemini-2.0-flash-exp',
    temperature: parseFloat(process.env.TEMPERATURE) || 0.2,
  },

  // Email
  email: {
    smtpServer: process.env.SMTP_SERVER || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT) || 587,
    username: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
    fromEmail: process.env.FROM_EMAIL,
  },

  // Service Ports
  services: {
    companyFinder: parseInt(process.env.COMPANY_FINDER_PORT) || 8081,
    complianceManager: parseInt(process.env.COMPLIANCE_MANAGER_PORT) || 8082,
    esgResearchAgent: parseInt(process.env.ESG_RESEARCH_AGENT_PORT) || 8084,
    reportGenerator: parseInt(process.env.REPORT_GENERATOR_PORT) || 8085,
  },
};
