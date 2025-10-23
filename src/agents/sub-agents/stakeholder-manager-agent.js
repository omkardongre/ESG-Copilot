// Stakeholder Manager Sub-Agent
// Manages stakeholder database, roles, and communication preferences
// Integrates with BigQuery for persistent storage

const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');

class StakeholderManagerAgent {
  constructor() {
    this.name = 'StakeholderManagerAgent';
    
    // Initialize BigQuery
    this.bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    this.datasetId = process.env.BIGQUERY_DATASET || 'esg_platform';
    this.tableId = 'stakeholders';
  }

  /**
   * Execute stakeholder loading
   */
  async execute(params) {
    const { companyInfo, userId, reportType } = params;

    console.log(`      👥 [${this.name}] Loading stakeholders...`);

    try {
      // Load stakeholders from BigQuery
      const stakeholders = await this.getStakeholders(companyInfo.id || companyInfo.name);

      // If no stakeholders found, create default set
      if (stakeholders.length === 0) {
        console.log(`      ℹ️  No stakeholders found, creating defaults...`);
        const defaultStakeholders = await this.createDefaultStakeholders(companyInfo, userId);
        stakeholders.push(...defaultStakeholders);
      }

      // Filter stakeholders by report type relevance
      const relevantStakeholders = this.filterByReportType(stakeholders, reportType);

      // Categorize stakeholders
      const categorized = this.categorizeStakeholders(relevantStakeholders);

      console.log(`      ✅ Loaded ${stakeholders.length} stakeholders`);
      console.log(`      Approvers: ${categorized.approvers.length}`);
      console.log(`      Reviewers: ${categorized.reviewers.length}`);
      console.log(`      Observers: ${categorized.observers.length}`);

      return {
        list: stakeholders,
        relevant: relevantStakeholders,
        categorized,
        total: stakeholders.length,
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      
      // Fallback to default stakeholders
      if (process.env.NODE_ENV === 'development') {
        console.warn(`      ⚠️  Using default stakeholders (development mode)`);
        return this.getDefaultStakeholders(companyInfo);
      }
      
      throw error;
    }
  }

  /**
   * Get stakeholders from BigQuery
   */
  async getStakeholders(companyId) {
    try {
      const query = `
        SELECT 
          id,
          company_id,
          name,
          email,
          role,
          title,
          department,
          phone,
          preferences,
          active,
          created_at,
          updated_at
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE company_id = @companyId
          AND active = true
        ORDER BY role, name
      `;

      const options = {
        query,
        params: { companyId },
      };

      const [rows] = await this.bigquery.query(options);
      
      return rows.map(row => ({
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        email: row.email,
        role: row.role,
        title: row.title,
        department: row.department,
        phone: row.phone,
        preferences: row.preferences ? JSON.parse(row.preferences) : {},
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error(`      ❌ BigQuery query failed:`, error.message);
      throw error;
    }
  }

  /**
   * Create stakeholder
   */
  async createStakeholder(stakeholderData) {
    try {
      const stakeholder = {
        id: uuidv4(),
        company_id: stakeholderData.companyId,
        name: stakeholderData.name,
        email: stakeholderData.email,
        role: stakeholderData.role || 'observer',
        title: stakeholderData.title || null,
        department: stakeholderData.department || null,
        phone: stakeholderData.phone || null,
        preferences: JSON.stringify(stakeholderData.preferences || {}),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.bigquery
        .dataset(this.datasetId)
        .table(this.tableId)
        .insert([stakeholder]);

      console.log(`      ✓ Created stakeholder: ${stakeholder.email}`);

      return {
        ...stakeholder,
        preferences: JSON.parse(stakeholder.preferences),
      };
    } catch (error) {
      console.error(`      ❌ Failed to create stakeholder:`, error.message);
      throw error;
    }
  }

  /**
   * Update stakeholder
   */
  async updateStakeholder(stakeholderId, updates) {
    try {
      const updateFields = [];
      const params = { stakeholderId };

      if (updates.name) {
        updateFields.push('name = @name');
        params.name = updates.name;
      }
      if (updates.email) {
        updateFields.push('email = @email');
        params.email = updates.email;
      }
      if (updates.role) {
        updateFields.push('role = @role');
        params.role = updates.role;
      }
      if (updates.title) {
        updateFields.push('title = @title');
        params.title = updates.title;
      }
      if (updates.department) {
        updateFields.push('department = @department');
        params.department = updates.department;
      }
      if (updates.preferences) {
        updateFields.push('preferences = @preferences');
        params.preferences = JSON.stringify(updates.preferences);
      }

      updateFields.push('updated_at = @updatedAt');
      params.updatedAt = new Date().toISOString();

      const query = `
        UPDATE \`${this.datasetId}.${this.tableId}\`
        SET ${updateFields.join(', ')}
        WHERE id = @stakeholderId
      `;

      await this.bigquery.query({ query, params });

      console.log(`      ✓ Updated stakeholder: ${stakeholderId}`);
    } catch (error) {
      console.error(`      ❌ Failed to update stakeholder:`, error.message);
      throw error;
    }
  }

  /**
   * Delete stakeholder (soft delete)
   */
  async deleteStakeholder(stakeholderId) {
    try {
      const query = `
        UPDATE \`${this.datasetId}.${this.tableId}\`
        SET active = false, updated_at = @updatedAt
        WHERE id = @stakeholderId
      `;

      const params = {
        stakeholderId,
        updatedAt: new Date().toISOString(),
      };

      await this.bigquery.query({ query, params });

      console.log(`      ✓ Deleted stakeholder: ${stakeholderId}`);
    } catch (error) {
      console.error(`      ❌ Failed to delete stakeholder:`, error.message);
      throw error;
    }
  }

  /**
   * Create default stakeholders for a company
   */
  async createDefaultStakeholders(companyInfo, userId) {
    const defaults = [
      {
        companyId: companyInfo.id || companyInfo.name,
        name: 'ESG Director',
        email: companyInfo.email || 'esg@company.com',
        role: 'approver',
        title: 'Director of ESG',
        department: 'Sustainability',
        preferences: {
          emailNotifications: true,
          reportTypes: ['GRI', 'SASB', 'TCFD'],
        },
      },
      {
        companyId: companyInfo.id || companyInfo.name,
        name: 'CFO',
        email: 'cfo@company.com',
        role: 'approver',
        title: 'Chief Financial Officer',
        department: 'Finance',
        preferences: {
          emailNotifications: true,
          reportTypes: ['GRI', 'SASB'],
        },
      },
      {
        companyId: companyInfo.id || companyInfo.name,
        name: 'Sustainability Manager',
        email: 'sustainability@company.com',
        role: 'reviewer',
        title: 'Sustainability Manager',
        department: 'Sustainability',
        preferences: {
          emailNotifications: true,
          reportTypes: ['GRI', 'SASB', 'TCFD', 'Custom'],
        },
      },
    ];

    const created = [];
    for (const stakeholder of defaults) {
      try {
        const newStakeholder = await this.createStakeholder(stakeholder);
        created.push(newStakeholder);
      } catch (error) {
        console.warn(`      ⚠️  Failed to create default stakeholder:`, error.message);
      }
    }

    return created;
  }

  /**
   * Get default stakeholders (fallback for development)
   */
  getDefaultStakeholders(companyInfo) {
    return {
      list: [
        {
          id: 'default-1',
          companyId: companyInfo.id || companyInfo.name,
          name: 'ESG Director',
          email: companyInfo.email || 'esg@company.com',
          role: 'approver',
          title: 'Director of ESG',
          department: 'Sustainability',
          preferences: { emailNotifications: true },
          active: true,
        },
        {
          id: 'default-2',
          companyId: companyInfo.id || companyInfo.name,
          name: 'CFO',
          email: 'cfo@company.com',
          role: 'approver',
          title: 'Chief Financial Officer',
          department: 'Finance',
          preferences: { emailNotifications: true },
          active: true,
        },
      ],
      relevant: [],
      categorized: {
        approvers: [],
        reviewers: [],
        observers: [],
      },
      total: 2,
    };
  }

  /**
   * Filter stakeholders by report type
   */
  filterByReportType(stakeholders, reportType) {
    if (!reportType) return stakeholders;

    return stakeholders.filter(s => {
      if (!s.preferences || !s.preferences.reportTypes) {
        return true; // Include if no preferences set
      }
      return s.preferences.reportTypes.includes(reportType);
    });
  }

  /**
   * Categorize stakeholders by role
   */
  categorizeStakeholders(stakeholders) {
    return {
      approvers: stakeholders.filter(s => s.role === 'approver'),
      reviewers: stakeholders.filter(s => s.role === 'reviewer'),
      observers: stakeholders.filter(s => s.role === 'observer'),
    };
  }

  /**
   * Get escalation contacts
   */
  async getEscalationContacts(params) {
    const { companyInfo, userId } = params;

    try {
      const stakeholders = await this.getStakeholders(companyInfo.id || companyInfo.name);

      // Find senior executives for escalation
      const escalationContacts = stakeholders.filter(s => {
        const title = s.title?.toLowerCase() || '';
        return (
          title.includes('ceo') ||
          title.includes('president') ||
          title.includes('chief') ||
          title.includes('vp') ||
          title.includes('director')
        );
      });

      return escalationContacts;
    } catch (error) {
      console.error(`      ❌ Failed to get escalation contacts:`, error.message);
      return [];
    }
  }

  /**
   * Get stakeholder by email
   */
  async getStakeholderByEmail(email, companyId) {
    try {
      const query = `
        SELECT *
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE email = @email
          AND company_id = @companyId
          AND active = true
        LIMIT 1
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { email, companyId },
      });

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`      ❌ Failed to get stakeholder by email:`, error.message);
      return null;
    }
  }

  /**
   * Get stakeholders by role
   */
  async getStakeholdersByRole(companyId, role) {
    try {
      const query = `
        SELECT *
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE company_id = @companyId
          AND role = @role
          AND active = true
        ORDER BY name
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { companyId, role },
      });

      return rows;
    } catch (error) {
      console.error(`      ❌ Failed to get stakeholders by role:`, error.message);
      return [];
    }
  }

  /**
   * Get stakeholders by department
   */
  async getStakeholdersByDepartment(companyId, department) {
    try {
      const query = `
        SELECT *
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE company_id = @companyId
          AND department = @department
          AND active = true
        ORDER BY name
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { companyId, department },
      });

      return rows;
    } catch (error) {
      console.error(`      ❌ Failed to get stakeholders by department:`, error.message);
      return [];
    }
  }

  /**
   * Update stakeholder preferences
   */
  async updatePreferences(stakeholderId, preferences) {
    try {
      const query = `
        UPDATE \`${this.datasetId}.${this.tableId}\`
        SET preferences = @preferences, updated_at = @updatedAt
        WHERE id = @stakeholderId
      `;

      const params = {
        stakeholderId,
        preferences: JSON.stringify(preferences),
        updatedAt: new Date().toISOString(),
      };

      await this.bigquery.query({ query, params });

      console.log(`      ✓ Updated preferences for ${stakeholderId}`);
    } catch (error) {
      console.error(`      ❌ Failed to update preferences:`, error.message);
      throw error;
    }
  }

  /**
   * Bulk import stakeholders
   */
  async bulkImport(stakeholders) {
    try {
      const rows = stakeholders.map(s => ({
        id: uuidv4(),
        company_id: s.companyId,
        name: s.name,
        email: s.email,
        role: s.role || 'observer',
        title: s.title || null,
        department: s.department || null,
        phone: s.phone || null,
        preferences: JSON.stringify(s.preferences || {}),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await this.bigquery
        .dataset(this.datasetId)
        .table(this.tableId)
        .insert(rows);

      console.log(`      ✅ Imported ${rows.length} stakeholders`);

      return rows.length;
    } catch (error) {
      console.error(`      ❌ Bulk import failed:`, error.message);
      throw error;
    }
  }

  /**
   * Export stakeholders to CSV
   */
  async exportToCSV(companyId) {
    try {
      const stakeholders = await this.getStakeholders(companyId);

      const csv = [
        'ID,Name,Email,Role,Title,Department,Phone,Active',
        ...stakeholders.map(s =>
          `${s.id},${s.name},${s.email},${s.role},${s.title || ''},${s.department || ''},${s.phone || ''},${s.active}`
        ),
      ].join('\n');

      return csv;
    } catch (error) {
      console.error(`      ❌ Export failed:`, error.message);
      throw error;
    }
  }
}

module.exports = StakeholderManagerAgent;
