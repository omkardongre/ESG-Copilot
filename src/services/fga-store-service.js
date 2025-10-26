/**
 * Auth0 FGA Store Service - External Authorization Service
 * ✅ Production-level integration with Auth0 FGA Store
 * ✅ Tuple management for user-company-document relationships
 * ✅ Real-time authorization checks via FGA API
 * ✅ Document-level access control
 */

const { OpenFgaClient } = require('@openfga/sdk');

class FGAStoreService {
  constructor() {
    // Initialize OpenFGA Client with credentials from .env
    this.storeId = process.env.FGA_STORE_ID;
    this.apiUrl = process.env.FGA_API_URL;
    this.clientId = process.env.FGA_CLIENT_ID;
    this.clientSecret = process.env.FGA_CLIENT_SECRET;
    this.apiAudience = process.env.FGA_API_AUDIENCE;
    this.modelId = process.env.FGA_MODEL_ID;

    // Check if FGA is enabled
    this.enabled = !!(this.storeId && this.apiUrl && this.clientId && this.clientSecret);

    if (this.enabled) {
      this.client = new OpenFgaClient({
        apiUrl: this.apiUrl,
        storeId: this.storeId,
        credentials: {
          method: 'client_credentials',
          config: {
            apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER || 'auth.fga.dev',
            apiAudience: this.apiAudience,
            clientId: this.clientId,
            clientSecret: this.clientSecret,
          },
        },
      });

      console.log('✅ Auth0 FGA Store Service initialized');
      console.log(`   📍 Store ID: ${this.storeId}`);
      console.log(`   🌐 API URL: ${this.apiUrl}`);
    } else {
      console.log('⚠️ Auth0 FGA Store Service disabled (missing credentials)');
    }
  }

  /**
   * Check if user can view a document
   * @param {string} userId - User email or Auth0 ID
   * @param {string} documentId - Document ID
   * @returns {Promise<boolean>} - True if user can view document
   */
  async canViewDocument(userId, documentId) {
    if (!this.enabled) {
      console.log('⚠️ FGA Store disabled, skipping authorization check');
      return true; // Fallback to application logic
    }

    try {
      const response = await this.client.check({
        user: `user:${userId}`,
        relation: 'can_view',
        object: `document:${documentId}`,
      });

      const allowed = response.allowed;
      console.log(`🔐 [FGA Check] User ${userId} can_view document:${documentId} = ${allowed}`);
      return allowed;
    } catch (error) {
      console.error('❌ FGA check error:', error);
      return false; // Deny on error
    }
  }

  /**
   * Check if user can edit a document
   * @param {string} userId - User email or Auth0 ID
   * @param {string} documentId - Document ID
   * @returns {Promise<boolean>} - True if user can edit document
   */
  async canEditDocument(userId, documentId) {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.client.check({
        user: `user:${userId}`,
        relation: 'can_edit',
        object: `document:${documentId}`,
      });

      return response.allowed;
    } catch (error) {
      console.error('❌ FGA check error:', error);
      return false;
    }
  }

  /**
   * Check if user can delete a document
   * @param {string} userId - User email or Auth0 ID
   * @param {string} documentId - Document ID
   * @returns {Promise<boolean>} - True if user can delete document
   */
  async canDeleteDocument(userId, documentId) {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.client.check({
        user: `user:${userId}`,
        relation: 'can_delete',
        object: `document:${documentId}`,
      });

      return response.allowed;
    } catch (error) {
      console.error('❌ FGA check error:', error);
      return false;
    }
  }

  /**
   * Create tuple: User is admin of company
   * @param {string} userId - User email or Auth0 ID
   * @param {string} companyId - Company ID
   */
  async assignUserAsCompanyAdmin(userId, companyId) {
    if (!this.enabled) {
      console.log('⚠️ FGA Store disabled, skipping tuple creation');
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `user:${userId}`,
            relation: 'admin',
            object: `company:${companyId}`,
          },
        ],
      });

      console.log(`✅ [FGA Tuple] Created: user:${userId} admin company:${companyId}`);
    } catch (error) {
      console.error('❌ FGA write error:', error);
      throw error;
    }
  }

  /**
   * Create tuple: User is viewer of company (for ESG Consultant, Auditor, Regulator)
   * @param {string} userId - User email or Auth0 ID
   * @param {string} companyId - Company ID
   */
  async assignUserAsCompanyViewer(userId, companyId) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `user:${userId}`,
            relation: 'viewer',
            object: `company:${companyId}`,
          },
        ],
      });

      console.log(`✅ [FGA Tuple] Created: user:${userId} viewer company:${companyId}`);
    } catch (error) {
      console.error('❌ FGA write error:', error);
      throw error;
    }
  }

  /**
   * Create tuple: Document belongs to company
   * @param {string} documentId - Document ID
   * @param {string} companyId - Company ID
   */
  async assignDocumentToCompany(documentId, companyId) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `company:${companyId}`,
            relation: 'company',
            object: `document:${documentId}`,
          },
        ],
      });

      console.log(`✅ [FGA Tuple] Created: company:${companyId} company document:${documentId}`);
    } catch (error) {
      console.error('❌ FGA write error:', error);
      throw error;
    }
  }

  /**
   * Create tuple: User is owner of document
   * @param {string} userId - User email or Auth0 ID
   * @param {string} documentId - Document ID
   */
  async assignUserAsDocumentOwner(userId, documentId) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `user:${userId}`,
            relation: 'owner',
            object: `document:${documentId}`,
          },
        ],
      });

      console.log(`✅ [FGA Tuple] Created: user:${userId} owner document:${documentId}`);
    } catch (error) {
      console.error('❌ FGA write error:', error);
      throw error;
    }
  }

  /**
   * Create tuple: User is owner of report
   * @param {string} userId - User email or Auth0 ID
   * @param {string} reportId - Report ID
   */
  async assignUserAsReportOwner(userId, reportId) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `user:${userId}`,
            relation: 'owner',
            object: `report:${reportId}`,
          },
        ],
      });

      console.log(`✅ [FGA Tuple] Created: user:${userId} owner report:${reportId}`);
    } catch (error) {
      console.error('❌ FGA write error:', error);
      throw error;
    }
  }

  /**
   * Create tuple: Report belongs to company
   * @param {string} reportId - Report ID
   * @param {string} companyId - Company ID
   */
  async assignReportToCompany(reportId, companyId) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `company:${companyId}`,
            relation: 'company',
            object: `report:${reportId}`,
          },
        ],
      });

      console.log(`✅ [FGA Tuple] Created: company:${companyId} company report:${reportId}`);
    } catch (error) {
      console.error('❌ FGA write error:', error);
      throw error;
    }
  }

  /**
   * Batch create tuples for new company and admin
   * @param {string} userId - User email or Auth0 ID
   * @param {string} companyId - Company ID
   */
  async setupNewCompanyAdmin(userId, companyId) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        writes: [
          {
            user: `user:${userId}`,
            relation: 'admin',
            object: `company:${companyId}`,
          },
        ],
      });

      console.log(`✅ [FGA Setup] New company admin: user:${userId} → company:${companyId}`);
    } catch (error) {
      console.error('❌ FGA setup error:', error);
      throw error;
    }
  }

  /**
   * Setup viewer access for ESG Consultant/Auditor/Regulator to all companies
   * @param {string} userId - User email or Auth0 ID
   * @param {string[]} companyIds - Array of company IDs
   */
  async setupGlobalViewer(userId, companyIds) {
    if (!this.enabled) {
      return;
    }

    try {
      const writes = companyIds.map(companyId => ({
        user: `user:${userId}`,
        relation: 'viewer',
        object: `company:${companyId}`,
      }));

      await this.client.write({ writes });

      console.log(`✅ [FGA Setup] Global viewer: user:${userId} → ${companyIds.length} companies`);
    } catch (error) {
      console.error('❌ FGA setup error:', error);
      throw error;
    }
  }

  /**
   * List all objects user can view
   * @param {string} userId - User email or Auth0 ID
   * @param {string} objectType - Type of object (document, report)
   * @returns {Promise<string[]>} - Array of object IDs user can view
   */
  async listUserObjects(userId, objectType = 'document') {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await this.client.listObjects({
        user: `user:${userId}`,
        relation: 'can_view',
        type: objectType,
      });

      const objects = response.objects || [];
      console.log(`🔐 [FGA List] User ${userId} can view ${objects.length} ${objectType}s`);
      return objects;
    } catch (error) {
      console.error('❌ FGA list error:', error);
      return [];
    }
  }

  /**
   * Delete tuple
   * @param {string} userId - User email or Auth0 ID
   * @param {string} relation - Relation (admin, viewer, owner)
   * @param {string} object - Object (company:id, document:id, report:id)
   */
  async deleteTuple(userId, relation, object) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.write({
        deletes: [
          {
            user: `user:${userId}`,
            relation: relation,
            object: object,
          },
        ],
      });

      console.log(`✅ [FGA Delete] Removed: user:${userId} ${relation} ${object}`);
    } catch (error) {
      console.error('❌ FGA delete error:', error);
      throw error;
    }
  }

  /**
   * Check if FGA Store is enabled and healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    if (!this.enabled) {
      return false;
    }

    try {
      // Try a simple check operation
      await this.client.check({
        user: 'user:health-check',
        relation: 'can_view',
        object: 'document:health-check',
      });

      console.log('✅ FGA Store health check passed');
      return true;
    } catch (error) {
      console.error('❌ FGA Store health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new FGAStoreService();
