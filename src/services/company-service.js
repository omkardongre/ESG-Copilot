// Company Discovery Service (F1)
const { v4: uuidv4 } = require('uuid');
const bigQueryClient = require('../utils/bigquery-client');

class CompanyService {
  /**
   * Create a new company
   */
  async createCompany(data, userId) {
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
      public_status: data.publicStatus || 'private',
      compliance_requirements: data.complianceRequirements || [],
      status: 'active',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await bigQueryClient.insert('companies', [company]);
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
      throw new Error('Company not found');
    }

    // Merge updates with existing data
    const updatedCompany = {
      ...existingCompany,
      name: data.name !== undefined ? data.name : existingCompany.name,
      industry: data.industry !== undefined ? data.industry : existingCompany.industry,
      country: data.country !== undefined ? data.country : existingCompany.country,
      city: data.city !== undefined ? data.city : existingCompany.city,
      website: data.website !== undefined ? data.website : existingCompany.website,
      employees: data.employees !== undefined ? data.employees : existingCompany.employees,
      revenue: data.revenue !== undefined ? data.revenue : existingCompany.revenue,
      updated_at: new Date().toISOString(),
    };

    // Delete old record
    const deleteQuery = `
      DELETE FROM \`${bigQueryClient.projectId}.${bigQueryClient.datasetId}.companies\`
      WHERE company_id = '${companyId}'
    `;
    await bigQueryClient.query(deleteQuery);

    // Insert updated record
    await bigQueryClient.insert('companies', [updatedCompany]);
    
    return updatedCompany;
  }

  /**
   * Get companies for a user based on role
   */
  async getCompaniesForUser(user) {
    if (user.roles.includes('Company Admin')) {
      // Company Admin sees only their company
      if (!user.companyId) {
        return [];
      }
      const company = await this.getCompanyById(user.companyId);
      return company ? [company] : [];
    }

    // Consultants, Auditors, Regulators see all companies
    return await this.searchCompanies();
  }
}

module.exports = new CompanyService();
