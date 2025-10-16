// BigQuery Client for ESG Copilot
const { BigQuery } = require('@google-cloud/bigquery');
const config = require('../config');
const fs = require('fs');
const path = require('path');

class BigQueryClient {
  constructor() {
    // Read service account key file
    let credentials = null;
    
    if (config.gcp.credentials) {
      const credentialsPath = path.resolve(process.cwd(), config.gcp.credentials);
      
      if (fs.existsSync(credentialsPath)) {
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        console.log('✅ BigQuery credentials loaded from:', credentialsPath);
      } else {
        console.warn('⚠️  Service account file not found:', credentialsPath);
      }
    } else {
      console.warn('⚠️  GOOGLE_APPLICATION_CREDENTIALS not set in .env');
    }
    
    // Initialize BigQuery with explicit project ID
    const projectId = config.gcp.projectId;
    console.log('📊 Initializing BigQuery with project:', projectId);
    
    this.bigquery = new BigQuery({
      projectId: projectId,
      credentials: credentials, // Use 'credentials' for now (deprecation warning is OK)
    });
    
    this.projectId = projectId;
    this.datasetId = config.gcp.datasetId;
    console.log('📊 BigQuery dataset:', `${projectId}.${this.datasetId}`);
  }

  /**
   * Execute a query
   */
  async query(sql, params = []) {
    const options = {
      query: sql,
      params: params,
      location: config.gcp.region || 'us-central1', // Use env variable
    };

    try {
      const [rows] = await this.bigquery.query(options);
      return rows;
    } catch (error) {
      console.error('BigQuery query error:', error);
      throw error;
    }
  }

  /**
   * Insert rows into a table
   */
  async insert(tableId, rows) {
    try {
      await this.bigquery
        .dataset(this.datasetId)
        .table(tableId)
        .insert(rows);
      return { success: true };
    } catch (error) {
      console.error(`BigQuery insert error (${tableId}):`, error);
      throw error;
    }
  }

  /**
   * Get table reference
   */
  getTable(tableId) {
    return this.bigquery.dataset(this.datasetId).table(tableId);
  }
}

module.exports = new BigQueryClient();
