// Emissions API Routes
const express = require('express');
const router = express.Router();
const { checkJwt, extractUserInfo } = require('../middleware/auth0');
const EmissionsCalculatorAgent = require('../agents/emissions-calculator-agent');
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const dataset = bigquery.dataset('esg_copilot_data');

/**
 * POST /api/emissions/calculate/:companyId
 * Calculate carbon emissions for a company (Scope 1, 2, 3)
 * ✅ Uses Token Vault for Climatiq API key
 * ✅ No fallback logic - production-ready
 */
router.post('/calculate/:companyId', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { companyId } = req.params;
    const user = req.user;

    console.log(`\n🌍 Calculating emissions for company: ${companyId}`);
    console.log(`   User: ${user.email}`);

    // Step 1: Get company info
    const [companyRows] = await dataset.table('companies').getRows({
      filter: [
        { property: 'company_id', value: companyId },
      ],
    });

    if (companyRows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyInfo = companyRows[0];

    // Step 2: Get ESG data (needed for emissions calculation)
    const [esgRows] = await dataset.table('esg_data').getRows({
      filter: [
        { property: 'company_id', value: companyId },
      ],
    });

    if (esgRows.length === 0) {
      return res.status(400).json({
        error: 'No ESG data found. Please collect ESG data first using the "Collect ESG Data" agent.',
      });
    }

    console.log(`   ✅ Found ${esgRows.length} ESG data points`);

    // Step 3: Get API keys from Token Vault (JWT)
    const apiKeys = req.auth.payload['https://esg-copilot.com/api_keys'] || {};
    
    if (!apiKeys.climatiq_api_key) {
      return res.status(400).json({
        error: 'Climatiq API key not found in Token Vault. Please configure it in Auth0.',
        hint: 'Add CLIMATIQ_API_KEY to Auth0 Action secrets and redeploy the Action.',
      });
    }

    console.log(`   🔐 Retrieved Climatiq API key from Token Vault`);

    // Step 4: Initialize agent with Token Vault keys
    const agent = new EmissionsCalculatorAgent(apiKeys);

    // Step 5: Execute emissions calculation
    const state = {
      companyInfo,
      esgData: esgRows,
      userId: user.id,
      taskId: `emissions-${Date.now()}`,
      agentsExecuted: [],
      messages: [],
      errors: [],
    };

    const result = await agent.execute(state);

    if (result.errors.length > 0) {
      return res.status(500).json({
        error: 'Emissions calculation failed',
        details: result.errors,
      });
    }

    // Step 6: Store emissions in BigQuery
    const emissions = result.emissions;
    const emissionsRow = {
      emissions_id: `emissions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      company_id: companyId,
      scope1_co2e_tonnes: emissions.scope1.co2e_tonnes,
      scope2_co2e_tonnes: emissions.scope2.co2e_tonnes,
      scope3_co2e_tonnes: emissions.scope3.co2e_tonnes,
      total_co2e_tonnes: emissions.total.co2e_tonnes,
      breakdown: JSON.stringify(emissions.breakdown),
      data_quality: emissions.data_quality,
      calculation_date: emissions.calculation_date,
      calculated_by: user.email,
      created_at: new Date().toISOString(),
    };

    await dataset.table('emissions').insert([emissionsRow]);
    console.log(`   💾 Stored emissions in BigQuery`);

    // Step 7: Return result
    res.json({
      message: 'Emissions calculated successfully',
      companyId,
      companyName: companyInfo.name,
      emissions: {
        total: emissions.total,
        scope1: emissions.scope1,
        scope2: emissions.scope2,
        scope3: emissions.scope3,
        breakdown: emissions.breakdown,
        data_quality: emissions.data_quality,
      },
      calculation_date: emissions.calculation_date,
    });

  } catch (error) {
    console.error('❌ Emissions calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate emissions',
      message: error.message,
    });
  }
});

/**
 * GET /api/emissions/:companyId
 * Get emissions history for a company
 */
router.get('/:companyId', checkJwt, extractUserInfo, async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await dataset.table('emissions').getRows({
      filter: [
        { property: 'company_id', value: companyId },
      ],
    });

    res.json({
      companyId,
      emissions: rows,
      count: rows.length,
    });

  } catch (error) {
    console.error('❌ Error fetching emissions:', error);
    res.status(500).json({ error: 'Failed to fetch emissions' });
  }
});

module.exports = router;
