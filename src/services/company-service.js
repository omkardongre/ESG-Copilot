// Company Discovery Service (F1)
const { v4: uuidv4 } = require("uuid");
const bigQueryClient = require("../utils/bigquery-client");
const { ManagementClient } = require("auth0");
const fgaStoreService = require("./fga-store-service");

class CompanyService {
  constructor() {
    // Initialize Auth0 Management Client for updating user metadata
    this.managementClient = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
    });
  }

  /**
   * Create a new company
   */
  async createCompany(data, userId, userRole, userEmail) {
    const companyId = uuidv4();

    const company = {
      company_id: companyId,
      name: data.name,
      industry: data.industry,
      country: data.country,
      city: data.city || null,
      website: data.website || null,
      employees: data.employees || null,
      revenue: data.revenue || null,
      public_status: data.publicStatus || "private",
      compliance_requirements: data.complianceRequirements || [],
      status: "active",
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await bigQueryClient.insert("companies", [company]);

    // ✅ Auth0 Integration: Update Company Admin's app_metadata with companyId
    if (userRole && userRole.includes("Company Admin")) {
      try {
        await this.managementClient.users.update(
          { id: userId },
          {
            app_metadata: {
              companyId: companyId,
              companyName: data.name,
            },
          }
        );
        console.log(
          `✅ Updated Auth0 app_metadata for Company Admin ${userId} with companyId: ${companyId}`
        );
      } catch (error) {
        console.error(
          `⚠️ Failed to update Auth0 metadata for ${userId}:`,
          error.message
        );
        // Don't fail the company creation if Auth0 update fails
      }
    }

    // ✅ FGA Store Integration: Create tuples for new company
    if (fgaStoreService.enabled && userEmail) {
      try {
        if (userRole && userRole.includes("Company Admin")) {
          // Create tuple: user is admin of company
          await fgaStoreService.assignUserAsCompanyAdmin(userEmail, companyId);

          // ✅ PRODUCTION: Auto-grant viewer access to global roles
          const globalViewers = [
            "consultant@esgfirm.com",
            "auditor@sustainapilot.com",
            "regulator@epa.gov",
          ];

          for (const viewerEmail of globalViewers) {
            try {
              await fgaStoreService.assignUserAsCompanyViewer(
                viewerEmail,
                companyId
              );
              console.log(
                `✅ [FGA] Auto-granted viewer access: ${viewerEmail} → company:${companyId}`
              );
            } catch (viewerError) {
              console.warn(
                `⚠️ [FGA] Failed to grant viewer access to ${viewerEmail}:`,
                viewerError.message
              );
            }
          }
        } else if (
          userRole &&
          (userRole.includes("ESG Consultant") ||
            userRole.includes("Auditor") ||
            userRole.includes("Regulator"))
        ) {
          // Create tuple: user is viewer of company
          await fgaStoreService.assignUserAsCompanyViewer(userEmail, companyId);
        }

        console.log(`✅ FGA tuples created for company: ${companyId}`);
      } catch (fgaError) {
        console.error(
          "⚠️ FGA tuple creation failed (non-blocking):",
          fgaError.message
        );
        // Don't fail company creation if FGA fails
      }
    }

    return company;
  }

  /**
   * Get company by ID
   */
  async getCompanyById(companyId) {
    const query = `
      SELECT *
      FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.companies\`
      WHERE company_id = ?
      LIMIT 1
    `;

    const rows = await bigQueryClient.query(query, [companyId]);
    return rows[0] || null;
  }

  /**
   * Search companies
   */
  async searchCompanies(filters = {}) {
    let query = `
      SELECT *
      FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.companies\`
      WHERE status = 'active'
    `;

    const params = [];

    if (filters.industry) {
      query += ` AND industry = @industry`;
      params.push(filters.industry);
    }

    if (filters.country) {
      query += ` AND country = @country`;
      params.push(filters.country);
    }

    if (filters.minEmployees) {
      query += ` AND employees >= @minEmployees`;
      params.push(filters.minEmployees);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    return await bigQueryClient.query(query, params);
  }

  /**
   * Update company
   */
  async updateCompany(companyId, data) {
    // Get existing company first
    const existingCompany = await this.getCompanyById(companyId);
    if (!existingCompany) {
      throw new Error("Company not found");
    }

    // Merge updates with existing data
    const updatedCompany = {
      ...existingCompany,
      name: data.name !== undefined ? data.name : existingCompany.name,
      industry:
        data.industry !== undefined ? data.industry : existingCompany.industry,
      country:
        data.country !== undefined ? data.country : existingCompany.country,
      city: data.city !== undefined ? data.city : existingCompany.city,
      website:
        data.website !== undefined ? data.website : existingCompany.website,
      employees:
        data.employees !== undefined
          ? data.employees
          : existingCompany.employees,
      revenue:
        data.revenue !== undefined ? data.revenue : existingCompany.revenue,
      updated_at: new Date().toISOString(),
    };

    // ✅ Try UPDATE first, fallback to DELETE+INSERT if streaming buffer error
    try {
      const updateQuery = `
        UPDATE \`${bigQueryClient.projectId}.${
        bigQueryClient.datasetId
      }.companies\`
        SET 
          name = '${updatedCompany.name.replace(/'/g, "\\'")}',
          industry = '${updatedCompany.industry.replace(/'/g, "\\'")}',
          country = '${updatedCompany.country.replace(/'/g, "\\'")}',
          city = '${(updatedCompany.city || "").replace(/'/g, "\\'")}',
          website = '${(updatedCompany.website || "").replace(/'/g, "\\'")}',
          employees = ${updatedCompany.employees || 0},
          revenue = ${updatedCompany.revenue || 0},
          updated_at = CURRENT_TIMESTAMP()
        WHERE company_id = '${companyId}'
      `;

      await bigQueryClient.query(updateQuery);

      console.log(`✅ Company ${companyId} updated via UPDATE statement`);
    } catch (updateError) {
      // ✅ Fallback: If streaming buffer error, use DELETE+INSERT
      if (updateError.message?.includes("streaming buffer")) {
        console.warn(
          `⚠️ Streaming buffer detected, using DELETE+INSERT workaround...`
        );

        // Delete old record
        const deleteQuery = `
          DELETE FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.companies\`
          WHERE company_id = '${companyId}'
        `;

        try {
          await bigQueryClient.query(deleteQuery);
          // Insert updated record
          await bigQueryClient.insert("companies", [updatedCompany]);
          console.log(`✅ Company ${companyId} updated via DELETE+INSERT`);
        } catch (fallbackError) {
          if (fallbackError.message?.includes("streaming buffer")) {
            throw new Error(
              "Company was recently created. Please wait 90 seconds before editing."
            );
          }
          throw fallbackError;
        }
      } else {
        throw updateError;
      }
    }

    return updatedCompany;
  }

  /**
   * Get companies for a user based on role
   */
  async getCompaniesForUser(user) {
    if (user.roles.includes("Company Admin")) {
      // Company Admin sees only their company
      if (!user.companyId) {
        // ✅ If no company_id in JWT, show companies created by this user
        console.log(
          `📋 Company Admin ${user.id} - fetching companies by created_by (no companyId in JWT)`
        );
        const allCompanies = await this.searchCompanies();
        const userCompanies = allCompanies.filter(
          (c) => c.created_by === user.id
        );
        console.log(
          `✅ Found ${userCompanies.length} companies created by user ${user.id}`
        );
        return userCompanies;
      }
      const company = await this.getCompanyById(user.companyId);
      return company ? [company] : [];
    }

    // Consultants, Auditors, Regulators see all companies
    return await this.searchCompanies();
  }

  /**
   * ✅ PRODUCTION: Delete company and associated RAG documents
   */
  async deleteCompany(companyId, user) {
    console.log(`🗑️ Deleting company ${companyId} and associated data...`);

    try {
      // Step 1: Get company details before deletion
      const company = await this.getCompanyById(companyId);

      if (!company) {
        throw new Error("Company not found");
      }

      // Step 2: Delete from BigQuery (with streaming buffer handling)
      try {
        const deleteQuery = `
          DELETE FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.companies\`
          WHERE company_id = '${companyId}'
        `;

        await bigQueryClient.query(deleteQuery);

        console.log(`✅ Company ${companyId} deleted from BigQuery`);
      } catch (bqError) {
        // ✅ Handle streaming buffer error (recently inserted data)
        if (bqError.message?.includes("streaming buffer")) {
          console.warn(
            `⚠️ BigQuery streaming buffer error, using workaround...`
          );

          // Workaround: Mark as deleted instead of actual deletion
          const updateQuery = `
            UPDATE \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.companies\`
            SET status = 'deleted', updated_at = CURRENT_TIMESTAMP()
            WHERE company_id = '${companyId}'
          `;

          try {
            await bigQueryClient.query(updateQuery);
            console.log(
              `✅ Company ${companyId} marked as deleted (streaming buffer workaround)`
            );
          } catch (updateError) {
            // If update also fails, wait and retry delete
            console.warn(
              `⚠️ Update also failed, scheduling deletion for later...`
            );
            // In production, you'd queue this for later processing
            throw new Error(
              "Company was recently created. Please wait 90 seconds and try again."
            );
          }
        } else {
          throw bqError;
        }
      }

      // Step 3: Delete associated RAG documents from Pinecone
      const ragDeleted = await this.deleteCompanyRAGDocuments(companyId, user);

      return {
        companyId,
        companyName: company.name,
        bigQueryDeleted: true,
        ragDocumentsDeleted: ragDeleted.deleted,
        ragDocumentsCount: ragDeleted.count,
      };
    } catch (error) {
      console.error(`❌ Error deleting company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * ✅ PRODUCTION: Delete company's RAG documents from Pinecone
   */
  async deleteCompanyRAGDocuments(companyId, user) {
    console.log(`🗑️ Deleting RAG documents for company ${companyId}...`);

    try {
      // Get API keys from user's Token Vault
      const pineconeApiKey = user.api_keys?.pinecone_api_key;

      if (!pineconeApiKey) {
        console.warn(
          `⚠️ No Pinecone API key found for user ${user.id}, skipping RAG deletion`
        );
        return { deleted: false, count: 0, reason: "No Pinecone API key" };
      }

      // Initialize RAG service
      const RAGService = require("./rag-service");
      const ragService = new RAGService(pineconeApiKey, null);

      // Delete all documents for this company
      await ragService.deleteCompanyDocuments(companyId);

      console.log(`✅ RAG documents deleted for company ${companyId}`);

      return { deleted: true, count: "all", reason: "Success" };
    } catch (error) {
      console.error(
        `❌ Error deleting RAG documents for company ${companyId}:`,
        error
      );
      // Don't throw - company deletion should succeed even if RAG deletion fails
      return { deleted: false, count: 0, reason: error.message };
    }
  }

  /**
   * Send ESG report emails to stakeholders
   */
  async sendStakeholderEmails(companyId, emails, reportId, user) {
    try {
      // Get SendGrid API key from user's api_keys (populated by Auth0 middleware)
      const sendgridApiKey = user?.api_keys?.sendgrid_api_key;

      if (!sendgridApiKey) {
        throw new Error(
          "SendGrid API key not found. Please configure it in your Auth0 user metadata."
        );
      }

      console.log(`   🔐 Retrieved SendGrid API key from user metadata`);

      // Get company details
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      // Validate company object
      if (!company.name) {
        console.error("Invalid company object:", company);
        throw new Error("Invalid company data. Company name is missing.");
      }

      console.log(`   ✅ Found company: ${company.name}`);

      // Get latest report if reportId not provided
      let report;
      const reportService = require("./report-generator-service");

      if (reportId) {
        // getReport returns a single report object, not an array
        report = await reportService.getReport(reportId);
      } else {
        // Get latest report for this company - returns array
        const reports = await reportService.getCompanyReports(companyId);
        if (!reports || reports.length === 0) {
          throw new Error(
            "No report found for this company. Please generate a report first using one of the report generation buttons (GRI, SASB, or TCFD)."
          );
        }
        report = reports[0]; // Latest report
      }

      // Validate report object
      if (!report || !report.report_id || !report.framework) {
        console.error("Invalid report object:", report);
        throw new Error("Invalid report data. Please regenerate the report.");
      }

      console.log(
        `   ✅ Found report: ${report.framework} (${report.report_id})`
      );

      // Send emails using SendGrid
      const sgMail = require("@sendgrid/mail");
      sgMail.setApiKey(sendgridApiKey);

      const emailPromises = emails.map(async (email) => {
        const msg = {
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || "noreply@esgcopilot.com",
          subject: `ESG Report Ready - ${company.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">ESG Report Ready</h2>
              <p>Dear Stakeholder,</p>
              <p>The ESG report for <strong>${
                company.name
              }</strong> is now ready for review.</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Report Details</h3>
                <p><strong>Framework:</strong> ${report.framework}</p>
                <p><strong>Reporting Period:</strong> ${
                  report.reporting_period
                }</p>
                <p><strong>Generated:</strong> ${new Date(
                  report.generated_at
                ).toLocaleDateString()}</p>
              </div>

              <p>Please log in to the ESG Copilot platform to view the full report.</p>
              
              <div style="margin: 30px 0;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:3000"
                }/dashboard/reports/${report.report_id}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Full Report
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #6b7280; font-size: 12px;">
                Generated by ESG Copilot | ${new Date().toLocaleDateString()}
              </p>
            </div>
          `,
        };

        return sgMail.send(msg);
      });

      await Promise.all(emailPromises);

      console.log(
        `✅ Sent emails to ${emails.length} stakeholder(s) for company ${companyId}`
      );

      return {
        emailsSent: emails.length,
        reportId: report.report_id,
        companyName: company.name,
      };
    } catch (error) {
      console.error(`❌ Error sending stakeholder emails:`, error);
      throw new Error(`Failed to send emails: ${error.message}`);
    }
  }
}

module.exports = new CompanyService();
