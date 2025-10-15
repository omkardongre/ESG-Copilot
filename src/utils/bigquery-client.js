// BigQuery Client for ESG Copilot
const { BigQuery } = require('@google-cloud/bigquery');
const config = require('../config');

class BigQueryClient {
  constructor() {
    this.bigquery = new BigQuery({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.credentials,
    });
    this.datasetId = config.gcp.datasetId;
  }

  /**
   * Execute a query
   */
  async query(sql, params = []) {
    const options = {
      query: sql,
      params: params,
      location: 'US',
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
