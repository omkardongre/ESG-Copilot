// Auth0 Authorization Sub-Agent
// Manages secure authorization for approval workflows using Auth0
// Generates time-limited tokens and verifies user permissions

const { ManagementClient, AuthenticationClient } = require('auth0');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class Auth0AuthorizationAgent {
  constructor() {
    this.name = 'Auth0AuthorizationAgent';
    
    // Initialize Auth0 Management Client
    this.managementClient = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      scope: 'read:users update:users create:users',
    });

    // Initialize Auth0 Authentication Client
    this.authClient = new AuthenticationClient({
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
    });

    // JWT secret for approval tokens
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Execute Auth0 authorization setup
   */
  async execute(params) {
    const { workflow, stakeholders, userId, companyInfo } = params;

    console.log(`      🔐 [${this.name}] Setting up authorization...`);

    try {
      const tokens = [];
      const permissions = [];

      // Generate approval tokens for each stakeholder
      for (const approver of workflow.approvers) {
        const stakeholder = stakeholders.list.find(s => s.id === approver.stakeholderId);
        
        if (!stakeholder) continue;

        // Check if user exists in Auth0
        let auth0User = await this.findOrCreateAuth0User(stakeholder);

        // Generate approval token
        const token = this.generateApprovalToken({
          workflowId: workflow.id,
          stakeholderId: stakeholder.id,
          auth0UserId: auth0User.user_id,
          email: stakeholder.email,
          role: stakeholder.role,
          expiresIn: '7d',
        });

        tokens.push({
          stakeholderId: stakeholder.id,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // Assign permissions in Auth0
        const permission = await this.assignApprovalPermissions(auth0User.user_id, workflow.id);
        permissions.push(permission);

        console.log(`      ✓ Token generated for ${stakeholder.email}`);
      }

      console.log(`      ✅ Generated ${tokens.length} authorization tokens`);

      return {
        tokens,
        permissions,
        tokensGenerated: tokens.length,
        permissionsAssigned: permissions.length,
        provider: 'Auth0',
        domain: process.env.AUTH0_DOMAIN,
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error:`, error.message);
      throw error;
    }
  }

  /**
   * Find or create Auth0 user
   */
  async findOrCreateAuth0User(stakeholder) {
    try {
      // Search for existing user by email
      const users = await this.managementClient.getUsersByEmail(stakeholder.email);

      if (users && users.length > 0) {
        console.log(`      ℹ️  Found existing Auth0 user: ${stakeholder.email}`);
        return users[0];
      }

      // Create new user if not found
      console.log(`      ➕ Creating new Auth0 user: ${stakeholder.email}`);
      
      const newUser = await this.managementClient.createUser({
        email: stakeholder.email,
        name: stakeholder.name,
        connection: 'Username-Password-Authentication', // Default connection
        email_verified: false,
        user_metadata: {
          company: stakeholder.company,
          role: stakeholder.role,
          stakeholder_id: stakeholder.id,
        },
        app_metadata: {
          esg_platform: true,
          created_by: 'outreach_agent',
        },
      });

      // Send verification email
      await this.sendVerificationEmail(newUser.user_id);

      return newUser;
    } catch (error) {
      console.error(`      ⚠️  Auth0 user operation failed for ${stakeholder.email}:`, error.message);
      
      // Fallback: return mock user object for development
      if (process.env.NODE_ENV === 'development') {
        return {
          user_id: `dev_${stakeholder.id}`,
          email: stakeholder.email,
          name: stakeholder.name,
        };
      }
      
      throw error;
    }
  }

  /**
   * Generate approval token (JWT)
   */
  generateApprovalToken(params) {
    const { workflowId, stakeholderId, auth0UserId, email, role, expiresIn } = params;

    const payload = {
      type: 'approval_token',
      workflowId,
      stakeholderId,
      auth0UserId,
      email,
      role,
      permissions: ['approve', 'reject', 'comment'],
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: expiresIn || '7d',
      issuer: 'sustainapilot',
      audience: 'esg-approval',
    });

    return token;
  }

  /**
   * Verify approval token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'sustainapilot',
        audience: 'esg-approval',
      });

      // Check if token type is correct
      if (decoded.type !== 'approval_token') {
        return {
          valid: false,
          error: 'Invalid token type',
        };
      }

      // Verify user still exists in Auth0
      const auth0User = await this.managementClient.getUser({ id: decoded.auth0UserId });

      if (!auth0User) {
        return {
          valid: false,
          error: 'User not found',
        };
      }

      return {
        valid: true,
        user: {
          auth0UserId: decoded.auth0UserId,
          stakeholderId: decoded.stakeholderId,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions,
        },
        workflowId: decoded.workflowId,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Token expired',
        };
      }

      if (error.name === 'JsonWebTokenError') {
        return {
          valid: false,
          error: 'Invalid token',
        };
      }

      console.error(`      ❌ Token verification error:`, error.message);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Assign approval permissions in Auth0
   */
  async assignApprovalPermissions(auth0UserId, workflowId) {
    try {
      // Update user metadata with workflow permissions
      await this.managementClient.updateUser(
        { id: auth0UserId },
        {
          app_metadata: {
            workflows: {
              [workflowId]: {
                permissions: ['approve', 'reject', 'comment'],
                assignedAt: new Date().toISOString(),
              },
            },
          },
        }
      );

      return {
        auth0UserId,
        workflowId,
        permissions: ['approve', 'reject', 'comment'],
        assignedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn(`      ⚠️  Failed to assign permissions:`, error.message);
      
      // Return mock permission for development
      if (process.env.NODE_ENV === 'development') {
        return {
          auth0UserId,
          workflowId,
          permissions: ['approve', 'reject', 'comment'],
          assignedAt: new Date().toISOString(),
          mock: true,
        };
      }
      
      throw error;
    }
  }

  /**
   * Revoke approval permissions
   */
  async revokeApprovalPermissions(auth0UserId, workflowId) {
    try {
      const user = await this.managementClient.getUser({ id: auth0UserId });
      
      if (user.app_metadata && user.app_metadata.workflows) {
        delete user.app_metadata.workflows[workflowId];
        
        await this.managementClient.updateUser(
          { id: auth0UserId },
          {
            app_metadata: user.app_metadata,
          }
        );
      }

      console.log(`      ✓ Revoked permissions for workflow ${workflowId}`);
    } catch (error) {
      console.warn(`      ⚠️  Failed to revoke permissions:`, error.message);
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(auth0UserId) {
    try {
      await this.managementClient.sendEmailVerification({ user_id: auth0UserId });
      console.log(`      ✓ Verification email sent`);
    } catch (error) {
      console.warn(`      ⚠️  Failed to send verification email:`, error.message);
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(auth0UserId) {
    try {
      const user = await this.managementClient.getUser({ id: auth0UserId });
      
      if (user.app_metadata && user.app_metadata.workflows) {
        return user.app_metadata.workflows;
      }

      return {};
    } catch (error) {
      console.error(`      ❌ Failed to get user permissions:`, error.message);
      return {};
    }
  }

  /**
   * Check if user has permission for workflow
   */
  async hasWorkflowPermission(auth0UserId, workflowId, permission) {
    try {
      const workflows = await this.getUserPermissions(auth0UserId);
      
      if (!workflows[workflowId]) {
        return false;
      }

      return workflows[workflowId].permissions.includes(permission);
    } catch (error) {
      console.error(`      ❌ Permission check failed:`, error.message);
      return false;
    }
  }

  /**
   * Generate passwordless login link
   */
  async generatePasswordlessLink(email, workflowId) {
    try {
      // Send passwordless email
      const response = await this.authClient.passwordless.sendEmail({
        email,
        send: 'link',
        authParams: {
          scope: 'openid profile email',
          state: workflowId,
        },
      });

      console.log(`      ✓ Passwordless link sent to ${email}`);
      return response;
    } catch (error) {
      console.error(`      ❌ Failed to generate passwordless link:`, error.message);
      throw error;
    }
  }

  /**
   * Validate Auth0 configuration
   */
  validateConfiguration() {
    const required = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.warn(`      ⚠️  Missing Auth0 configuration: ${missing.join(', ')}`);
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required Auth0 configuration: ${missing.join(', ')}`);
      }
      
      return false;
    }

    return true;
  }

  /**
   * Get Auth0 user by email
   */
  async getUserByEmail(email) {
    try {
      const users = await this.managementClient.getUsersByEmail(email);
      return users && users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error(`      ❌ Failed to get user by email:`, error.message);
      return null;
    }
  }

  /**
   * Update user metadata
   */
  async updateUserMetadata(auth0UserId, metadata) {
    try {
      await this.managementClient.updateUser(
        { id: auth0UserId },
        { user_metadata: metadata }
      );
      
      console.log(`      ✓ Updated user metadata`);
    } catch (error) {
      console.error(`      ❌ Failed to update user metadata:`, error.message);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(auth0UserId) {
    try {
      await this.managementClient.deleteUser({ id: auth0UserId });
      console.log(`      ✓ Deleted user ${auth0UserId}`);
    } catch (error) {
      console.error(`      ❌ Failed to delete user:`, error.message);
      throw error;
    }
  }
}

module.exports = Auth0AuthorizationAgent;
