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
      FROM \`${bigQueryClient.datasetId}.companies\`
      WHERE company_id = @companyId
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
      FROM \`${bigQueryClient.datasetId}.companies\`
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
    const updates = [];
    const params = [companyId];

    if (data.name) {
      updates.push('name = @name');
      params.push(data.name);
    }
    if (data.industry) {
      updates.push('industry = @industry');
      params.push(data.industry);
    }
    if (data.country) {
      updates.push('country = @country');
      params.push(data.country);
    }
    if (data.employees !== undefined) {
      updates.push('employees = @employees');
      params.push(data.employees);
    }
    if (data.revenue !== undefined) {
      updates.push('revenue = @revenue');
      params.push(data.revenue);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP()');

    const query = `
      UPDATE \`${bigQueryClient.datasetId}.companies\`
      SET ${updates.join(', ')}
      WHERE company_id = @companyId
    `;

    await bigQueryClient.query(query, params);
    return await this.getCompanyById(companyId);
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
