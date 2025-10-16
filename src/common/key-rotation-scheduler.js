// Key Rotation Scheduler
// Automated API key rotation for enhanced security
// Supports scheduled rotation, emergency rotation, and compliance tracking

const { getInstance: getTokenVaultClient } = require('./token-vault-client');
const cron = require('node-cron');
const { BigQuery } = require('@google-cloud/bigquery');

class KeyRotationScheduler {
  constructor() {
    this.name = 'KeyRotationScheduler';
    this.tokenVault = getTokenVaultClient();
    this.scheduledJobs = new Map();
    
    // Initialize BigQuery for rotation logs
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
    });

    this.datasetId = process.env.BIGQUERY_DATASET || 'esg_platform';
    this.rotationTableId = 'key_rotations';
  }

  /**
   * Start the key rotation scheduler
   */
  start() {
    console.log('🔄 [KeyRotation] Starting key rotation scheduler...');

    // Schedule daily rotation check at 2 AM
    this.scheduledJobs.set(
      'daily_check',
      cron.schedule('0 2 * * *', () => this.checkAndRotateKeys())
    );

    // Schedule weekly compliance report on Mondays at 9 AM
    this.scheduledJobs.set(
      'weekly_report',
      cron.schedule('0 9 * * 1', () => this.generateComplianceReport())
    );

    console.log('✅ [KeyRotation] Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('🛑 [KeyRotation] Stopping scheduler...');
    
    this.scheduledJobs.forEach((job, name) => {
      job.stop();
      console.log(`   Stopped: ${name}`);
    });

    this.scheduledJobs.clear();
    console.log('✅ [KeyRotation] Scheduler stopped');
  }

  /**
   * Check and rotate keys that are due
   */
  async checkAndRotateKeys() {
    console.log('🔍 [KeyRotation] Checking for keys due for rotation...');

    try {
      // Get all keys from rotation schedule
      const keysToRotate = await this.getKeysForRotation();

      console.log(`   Found ${keysToRotate.length} keys due for rotation`);

      const results = {
        success: [],
        failed: [],
      };

      for (const keyInfo of keysToRotate) {
        try {
          await this.rotateKey(keyInfo);
          results.success.push(keyInfo);
        } catch (error) {
          console.error(`   ❌ Failed to rotate ${keyInfo.service} for user ${keyInfo.userId}:`, error.message);
          results.failed.push({ ...keyInfo, error: error.message });
        }
      }

      console.log(`✅ [KeyRotation] Rotation complete: ${results.success.length} success, ${results.failed.length} failed`);

      // Send notification if there were failures
      if (results.failed.length > 0) {
        await this.notifyRotationFailures(results.failed);
      }

      return results;
    } catch (error) {
      console.error('❌ [KeyRotation] Check and rotate failed:', error.message);
      throw error;
    }
  }

  /**
   * Get keys that need rotation
   */
  async getKeysForRotation() {
    try {
      const query = `
        SELECT 
          user_id,
          service,
          last_rotated,
          rotation_interval_days,
          next_rotation_date
        FROM \`${this.datasetId}.${this.rotationTableId}\`
        WHERE next_rotation_date <= CURRENT_DATE()
          AND active = true
        ORDER BY next_rotation_date ASC
      `;

      const [rows] = await this.bigquery.query(query);

      return rows.map(row => ({
        userId: row.user_id,
        service: row.service,
        lastRotated: row.last_rotated,
        rotationInterval: row.rotation_interval_days,
        nextRotationDate: row.next_rotation_date,
      }));
    } catch (error) {
      console.error('❌ [KeyRotation] Failed to get keys for rotation:', error.message);
      
      // Fallback: return default rotation schedule
      if (process.env.NODE_ENV === 'development') {
        return this.getDefaultRotationSchedule();
      }
      
      throw error;
    }
  }

  /**
   * Rotate a specific key
   */
  async rotateKey(keyInfo) {
    console.log(`   🔄 Rotating ${keyInfo.service} for user ${keyInfo.userId}...`);

    try {
      // Generate new API key (service-specific logic)
      const newKey = await this.generateNewApiKey(keyInfo.service);

      // Rotate in Token Vault
      await this.tokenVault.rotateApiKey(keyInfo.userId, keyInfo.service, newKey);

      // Update rotation schedule
      await this.updateRotationSchedule(keyInfo.userId, keyInfo.service);

      // Log rotation
      await this.logRotation({
        userId: keyInfo.userId,
        service: keyInfo.service,
        rotatedAt: new Date().toISOString(),
        reason: 'scheduled_rotation',
        success: true,
      });

      console.log(`   ✅ Rotated ${keyInfo.service}`);
    } catch (error) {
      // Log failure
      await this.logRotation({
        userId: keyInfo.userId,
        service: keyInfo.service,
        rotatedAt: new Date().toISOString(),
        reason: 'scheduled_rotation',
        success: false,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Emergency key rotation
   */
  async emergencyRotation(userId, service, reason) {
    console.log(`🚨 [KeyRotation] Emergency rotation: ${service} for user ${userId}`);
    console.log(`   Reason: ${reason}`);

    try {
      // Generate new key immediately
      const newKey = await this.generateNewApiKey(service);

      // Rotate in Token Vault
      await this.tokenVault.rotateApiKey(userId, service, newKey);

      // Log emergency rotation
      await this.logRotation({
        userId,
        service,
        rotatedAt: new Date().toISOString(),
        reason: `emergency: ${reason}`,
        success: true,
        emergency: true,
      });

      // Send notification
      await this.notifyEmergencyRotation(userId, service, reason);

      console.log(`✅ [KeyRotation] Emergency rotation complete`);

      return { success: true, service, rotatedAt: new Date().toISOString() };
    } catch (error) {
      console.error(`❌ [KeyRotation] Emergency rotation failed:`, error.message);
      
      await this.logRotation({
        userId,
        service,
        rotatedAt: new Date().toISOString(),
        reason: `emergency: ${reason}`,
        success: false,
        error: error.message,
        emergency: true,
      });

      throw error;
    }
  }

  /**
   * Generate new API key (service-specific)
   */
  async generateNewApiKey(service) {
    // In production, this would call service-specific key generation APIs
    // For now, return a placeholder that indicates rotation is needed
    
    console.log(`   🔑 Generating new key for ${service}...`);

    // Service-specific key generation logic
    const generators = {
      climatiq: () => this.generateClimatiqKey(),
      google_maps: () => this.generateGoogleMapsKey(),
      epa: () => this.generateEPAKey(),
      google_ai: () => this.generateGoogleAIKey(),
      bigquery: () => this.generateBigQueryKey(),
    };

    const generator = generators[service];
    if (!generator) {
      throw new Error(`No key generator for service: ${service}`);
    }

    return await generator();
  }

  /**
   * Service-specific key generators
   */
  async generateClimatiqKey() {
    // In production: Call Climatiq API to generate new key
    // For now: Return indication that manual rotation is needed
    return {
      key: 'CLIMATIQ_KEY_ROTATION_REQUIRED',
      manual: true,
      instructions: 'Generate new key at https://www.climatiq.io/dashboard/api-keys',
    };
  }

  async generateGoogleMapsKey() {
    return {
      key: 'GOOGLE_MAPS_KEY_ROTATION_REQUIRED',
      manual: true,
      instructions: 'Generate new key at https://console.cloud.google.com/apis/credentials',
    };
  }

  async generateEPAKey() {
    return {
      key: 'EPA_KEY_ROTATION_REQUIRED',
      manual: true,
      instructions: 'Request new key from EPA',
    };
  }

  async generateGoogleAIKey() {
    return {
      key: 'GOOGLE_AI_KEY_ROTATION_REQUIRED',
      manual: true,
      instructions: 'Generate new key at https://makersuite.google.com/app/apikey',
    };
  }

  async generateBigQueryKey() {
    return {
      key: 'BIGQUERY_KEY_ROTATION_REQUIRED',
      manual: true,
      instructions: 'Generate new service account key at https://console.cloud.google.com/iam-admin/serviceaccounts',
    };
  }

  /**
   * Update rotation schedule
   */
  async updateRotationSchedule(userId, service) {
    try {
      const query = `
        UPDATE \`${this.datasetId}.${this.rotationTableId}\`
        SET 
          last_rotated = CURRENT_TIMESTAMP(),
          next_rotation_date = DATE_ADD(CURRENT_DATE(), INTERVAL rotation_interval_days DAY),
          rotation_count = rotation_count + 1
        WHERE user_id = @userId
          AND service = @service
      `;

      await this.bigquery.query({
        query,
        params: { userId, service },
      });
    } catch (error) {
      console.error('❌ [KeyRotation] Failed to update rotation schedule:', error.message);
    }
  }

  /**
   * Log rotation event
   */
  async logRotation(rotationLog) {
    try {
      const row = {
        user_id: rotationLog.userId,
        service: rotationLog.service,
        rotated_at: rotationLog.rotatedAt,
        reason: rotationLog.reason,
        success: rotationLog.success,
        error: rotationLog.error || null,
        emergency: rotationLog.emergency || false,
      };

      await this.bigquery
        .dataset(this.datasetId)
        .table('rotation_logs')
        .insert([row]);
    } catch (error) {
      console.error('⚠️  [KeyRotation] Failed to log rotation:', error.message);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport() {
    console.log('📊 [KeyRotation] Generating compliance report...');

    try {
      const query = `
        SELECT 
          service,
          COUNT(*) as total_keys,
          SUM(CASE WHEN DATE_DIFF(CURRENT_DATE(), DATE(last_rotated), DAY) <= rotation_interval_days THEN 1 ELSE 0 END) as compliant_keys,
          AVG(DATE_DIFF(CURRENT_DATE(), DATE(last_rotated), DAY)) as avg_days_since_rotation,
          MAX(DATE_DIFF(CURRENT_DATE(), DATE(last_rotated), DAY)) as max_days_since_rotation
        FROM \`${this.datasetId}.${this.rotationTableId}\`
        WHERE active = true
        GROUP BY service
        ORDER BY service
      `;

      const [rows] = await this.bigquery.query(query);

      const report = {
        generatedAt: new Date().toISOString(),
        services: rows.map(row => ({
          service: row.service,
          totalKeys: row.total_keys,
          compliantKeys: row.compliant_keys,
          complianceRate: ((row.compliant_keys / row.total_keys) * 100).toFixed(2) + '%',
          avgDaysSinceRotation: Math.round(row.avg_days_since_rotation),
          maxDaysSinceRotation: row.max_days_since_rotation,
        })),
      };

      console.log('✅ [KeyRotation] Compliance report generated');
      console.log(JSON.stringify(report, null, 2));

      return report;
    } catch (error) {
      console.error('❌ [KeyRotation] Failed to generate compliance report:', error.message);
      throw error;
    }
  }

  /**
   * Notify rotation failures
   */
  async notifyRotationFailures(failures) {
    console.warn(`⚠️  [KeyRotation] ${failures.length} rotation failures - sending notifications`);
    
    // In production: Send email/Slack notifications
    failures.forEach(failure => {
      console.warn(`   - ${failure.service} for user ${failure.userId}: ${failure.error}`);
    });
  }

  /**
   * Notify emergency rotation
   */
  async notifyEmergencyRotation(userId, service, reason) {
    console.log(`📧 [KeyRotation] Notifying emergency rotation: ${service}`);
    
    // In production: Send immediate notification
    console.log(`   User: ${userId}`);
    console.log(`   Service: ${service}`);
    console.log(`   Reason: ${reason}`);
  }

  /**
   * Get default rotation schedule (development fallback)
   */
  getDefaultRotationSchedule() {
    const services = ['climatiq', 'google_maps', 'epa', 'google_ai', 'bigquery'];
    const now = new Date();
    
    return services.map(service => ({
      userId: 'default_user',
      service,
      lastRotated: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
      rotationInterval: 90,
      nextRotationDate: now.toISOString(),
    }));
  }

  /**
   * Set rotation policy for a service
   */
  async setRotationPolicy(userId, service, intervalDays) {
    try {
      const row = {
        user_id: userId,
        service,
        rotation_interval_days: intervalDays,
        last_rotated: new Date().toISOString(),
        next_rotation_date: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
        active: true,
        rotation_count: 0,
      };

      await this.bigquery
        .dataset(this.datasetId)
        .table(this.rotationTableId)
        .insert([row]);

      console.log(`✅ [KeyRotation] Set rotation policy: ${service} every ${intervalDays} days`);
    } catch (error) {
      console.error('❌ [KeyRotation] Failed to set rotation policy:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  KeyRotationScheduler,
  getInstance: () => {
    if (!instance) {
      instance = new KeyRotationScheduler();
    }
    return instance;
  },
};
