// Emissions Calculator Agent
// Calculates carbon footprint (Scope 1, 2, 3) using Climatiq API

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const axios = require('axios');
const agentLogger = require('./agent-logger');
const messageQueue = require('./message-queue');

class EmissionsCalculatorAgent {
  constructor(tokenVaultApiKeys = null) {
    this.name = 'EmissionsCalculatorAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.5-flash',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });

    // ✅ PRODUCTION: Get API key from Token Vault (JWT)
    this.climatiqApiKey = tokenVaultApiKeys?.climatiq_api_key || null;
    this.climatiqBaseUrl = 'https://api.climatiq.io/data/v1';
    
    if (!this.climatiqApiKey) {
      console.warn('⚠️  [EmissionsCalculatorAgent] No Climatiq API key in Token Vault');
    }
  }

  /**
   * Main execution method
   */
  async execute(state) {
    console.log(`\n🌍 [${this.name}] Starting emissions calculation...`);

    const startTime = Date.now();
    const { companyInfo, esgData } = state;

    try {
      // Step 1: Extract activity data from ESG data
      const activityData = this.extractActivityData(esgData);

      // Step 2: Calculate Scope 1 emissions (direct)
      const scope1 = await this.calculateScope1(activityData, companyInfo);

      // Step 3: Calculate Scope 2 emissions (electricity)
      const scope2 = await this.calculateScope2(activityData, companyInfo);

      // Step 4: Calculate Scope 3 emissions (indirect)
      const scope3 = await this.calculateScope3(activityData, companyInfo);

      // Step 5: Aggregate results
      const emissions = {
        scope1,
        scope2,
        scope3,
        total: {
          co2e_kg: scope1.co2e_kg + scope2.co2e_kg + scope3.co2e_kg,
          co2e_tonnes: (scope1.co2e_kg + scope2.co2e_kg + scope3.co2e_kg) / 1000,
        },
        breakdown: this.createBreakdown(scope1, scope2, scope3),
        calculation_date: new Date().toISOString(),
        data_quality: this.assessDataQuality(activityData),
      };

      // Step 6: Log the action
      const duration = Date.now() - startTime;
      await agentLogger.logAction(
        this.name,
        state.userId,
        'calculate_emissions',
        { companyInfo, activityData },
        { emissions },
        'success',
        null,
        duration
      );

      // Step 7: Broadcast results
      await messageQueue.publishMessage(
        this.name,
        'OrchestratorAgent',
        'emissions_calculated',
        { emissions },
        state.taskId
      );

      console.log(`✅ [${this.name}] Total emissions: ${emissions.total.co2e_tonnes.toFixed(2)} tonnes CO2e`);
      console.log(`   Scope 1: ${scope1.co2e_tonnes.toFixed(2)} tonnes`);
      console.log(`   Scope 2: ${scope2.co2e_tonnes.toFixed(2)} tonnes`);
      console.log(`   Scope 3: ${scope3.co2e_tonnes.toFixed(2)} tonnes`);

      return {
        ...state,
        emissions,
        agentsExecuted: [...state.agentsExecuted, this.name],
        messages: [
          ...state.messages,
          {
            role: 'agent',
            agent: this.name,
            content: `Calculated total emissions: ${emissions.total.co2e_tonnes.toFixed(2)} tonnes CO2e`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ [${this.name}] Error:`, error.message);

      await agentLogger.logAction(
        this.name,
        state.userId,
        'calculate_emissions',
        { companyInfo },
        null,
        'error',
        error
      );

      return {
        ...state,
        errors: [...state.errors, { agent: this.name, error: error.message }],
      };
    }
  }

  /**
   * Extract activity data from ESG data
   */
  extractActivityData(esgData) {
    const activityData = {
      energy: {},
      transport: {},
      waste: {},
      water: {},
      other: {},
    };

    if (!esgData || esgData.length === 0) {
      return activityData;
    }

    console.log(`   📊 Extracting activity data from ${esgData.length} ESG metrics...`);

    esgData.forEach(item => {
      const metricName = item.metric_name?.toLowerCase() || '';
      const metricValue = item.metric_value;
      
      // Handle both string and number values
      let value;
      if (typeof metricValue === 'string') {
        // Extract number from strings like "1,234 kWh" or "$1,234"
        const numMatch = metricValue.match(/([\d,]+\.?\d*)/);        if (numMatch) {
          value = parseFloat(numMatch[1].replace(/,/g, ''));
        }
      } else {
        value = parseFloat(metricValue);
      }

      if (isNaN(value) || value <= 0) return;

      // Energy consumption (broad matching)
      if (metricName.includes('electricity') || metricName.includes('energy') || metricName.includes('kwh') || metricName.includes('power')) {
        if (metricName.includes('renewable') || metricName.includes('solar') || metricName.includes('wind')) {
          activityData.energy.renewable_kwh = (activityData.energy.renewable_kwh || 0) + value;
          console.log(`      ✅ Renewable energy: ${value} kWh`);
        } else {
          activityData.energy.total_kwh = (activityData.energy.total_kwh || 0) + value;
          console.log(`      ✅ Total energy: ${value} kWh`);
        }
      }

      // Natural gas
      if (metricName.includes('natural gas') || metricName.includes('gas consumption') || metricName.includes('gas usage')) {
        activityData.energy.natural_gas_kwh = (activityData.energy.natural_gas_kwh || 0) + value;
        console.log(`      ✅ Natural gas: ${value} kWh`);
      }

      // Fuel
      if (metricName.includes('fuel') || metricName.includes('diesel') || metricName.includes('gasoline') || metricName.includes('petrol')) {
        activityData.transport.fuel_liters = (activityData.transport.fuel_liters || 0) + value;
        console.log(`      ✅ Fuel: ${value} liters`);
      }

      // Waste
      if (metricName.includes('waste') || metricName.includes('garbage') || metricName.includes('trash')) {
        activityData.waste.total_kg = (activityData.waste.total_kg || 0) + value;
        console.log(`      ✅ Waste: ${value} kg`);
      }

      // Water
      if (metricName.includes('water')) {
        activityData.water.total_m3 = (activityData.water.total_m3 || 0) + value;
        console.log(`      ✅ Water: ${value} m³`);
      }
    });

    console.log(`   📊 Extracted activity data:`, JSON.stringify(activityData, null, 2));
    return activityData;
  }

  /**
   * Calculate Scope 1 emissions (direct emissions from owned sources)
   */
  async calculateScope1(activityData, companyInfo) {
    console.log(`   🔥 Calculating Scope 1 (direct emissions)...`);

    let totalCO2e = 0;
    const breakdown = [];

    try {
      // Natural gas combustion
      if (activityData.energy.natural_gas_kwh) {
        const gasEmissions = await this.calculateClimatiq({
          activity_id: 'fuel_type_natural_gas',
          region: companyInfo.country || 'US',
          parameters: {
            energy: activityData.energy.natural_gas_kwh,
            energy_unit: 'kWh',
          },
        });

        if (gasEmissions) {
          totalCO2e += gasEmissions.co2e;
          breakdown.push({
            source: 'Natural Gas',
            co2e_kg: gasEmissions.co2e,
            activity: activityData.energy.natural_gas_kwh,
            unit: 'kWh',
          });
        }
      }

      // Company vehicles (fuel combustion)
      if (activityData.transport.fuel_liters) {
        const fuelEmissions = await this.calculateClimatiq({
          activity_id: 'fuel_type_diesel',
          region: companyInfo.country || 'US',
          parameters: {
            fuel_amount: activityData.transport.fuel_liters,
            fuel_amount_unit: 'l',
          },
        });

        if (fuelEmissions) {
          totalCO2e += fuelEmissions.co2e;
          breakdown.push({
            source: 'Fuel Combustion',
            co2e_kg: fuelEmissions.co2e,
            activity: activityData.transport.fuel_liters,
            unit: 'liters',
          });
        }
      }

      // ✅ PRODUCTION: Scope 1 is optional (many companies don't have direct fuel data)
      if (totalCO2e === 0) {
        console.log(`   ℹ️  No Scope 1 data (natural gas/fuel) - this is normal for companies without direct fuel combustion`);
        breakdown.push({
          source: 'No direct fuel combustion',
          co2e_kg: 0,
          activity: 'N/A',
          unit: 'N/A',
        });
      }
    } catch (error) {
      // ✅ PRODUCTION: Log error but don't fail (Scope 1 is optional)
      console.warn(`   ⚠️  Scope 1 calculation error: ${error.message}`);
      breakdown.push({
        source: 'Calculation error',
        co2e_kg: 0,
        activity: 'N/A',
        unit: 'N/A',
        error: error.message,
      });
    }

    return {
      co2e_kg: totalCO2e,
      co2e_tonnes: totalCO2e / 1000,
      breakdown,
    };
  }

  /**
   * Calculate Scope 2 emissions (purchased electricity)
   */
  async calculateScope2(activityData, companyInfo) {
    console.log(`   ⚡ Calculating Scope 2 (electricity)...`);

    let totalCO2e = 0;
    const breakdown = [];

    try {
      if (activityData.energy.total_kwh) {
        const electricityEmissions = await this.calculateClimatiq({
          activity_id: 'electricity-supply_grid-source_supplier_mix',
          region: companyInfo.country || 'US',
          parameters: {
            energy: activityData.energy.total_kwh,
            energy_unit: 'kWh',
          },
        });

        if (electricityEmissions) {
          totalCO2e = electricityEmissions.co2e;
          breakdown.push({
            source: 'Grid Electricity',
            co2e_kg: electricityEmissions.co2e,
            activity: activityData.energy.total_kwh,
            unit: 'kWh',
          });

          // Subtract renewable energy if available
          if (activityData.energy.renewable_kwh) {
            const renewableOffset = (activityData.energy.renewable_kwh / activityData.energy.total_kwh) * totalCO2e;
            totalCO2e -= renewableOffset;
            breakdown.push({
              source: 'Renewable Energy Offset',
              co2e_kg: -renewableOffset,
              activity: activityData.energy.renewable_kwh,
              unit: 'kWh',
            });
          }
        }
      }

      // ✅ PRODUCTION: Scope 2 is REQUIRED (electricity is core data)
      if (totalCO2e === 0) {
        throw new Error('No Scope 2 activity data (electricity) available. Please collect energy consumption data first.');
      }
    } catch (error) {
      // ✅ PRODUCTION: Fail fast if Scope 2 fails (this is required)
      throw new Error(`Scope 2 calculation failed: ${error.message}`);
    }

    return {
      co2e_kg: totalCO2e,
      co2e_tonnes: totalCO2e / 1000,
      breakdown,
    };
  }

  /**
   * Calculate Scope 3 emissions (supply chain, waste, etc.)
   */
  async calculateScope3(activityData, companyInfo) {
    console.log(`   🌐 Calculating Scope 3 (supply chain)...`);

    let totalCO2e = 0;
    const breakdown = [];

    // ✅ PRODUCTION: Scope 3 requires complex supply chain data
    // Climatiq's waste factors use monetary units ($/€), not weight
    // For production, we skip Scope 3 unless we have spend data
    console.log(`   ℹ️  Scope 3 requires supply chain spend data (not available in basic ESG metrics)`);
    
    if (activityData.waste.total_kg) {
      console.log(`   ℹ️  Waste data found (${activityData.waste.total_kg} kg) but Climatiq requires monetary spend, not weight`);
    }

    breakdown.push({
      source: 'Scope 3 requires supply chain spend data',
      co2e_kg: 0,
      activity: 'N/A',
      unit: 'N/A',
      note: 'Climatiq Scope 3 factors use monetary units (USD/EUR), not activity units',
    });

    return {
      co2e_kg: totalCO2e,
      co2e_tonnes: totalCO2e / 1000,
      breakdown,
    };
  }

  /**
   * Call Climatiq API for emission calculation
   */
  async calculateClimatiq(params) {
    if (!this.climatiqApiKey) {
      throw new Error('Climatiq API key not found in Token Vault. Please configure it in Auth0.');
    }

    try {
      // ✅ PRODUCTION: Normalize region to ISO 3166-1 alpha-2 code
      let region = params.region || 'US';
      const regionMap = {
        'United States': 'US',
        'USA': 'US',
        'United Kingdom': 'GB',
        'UK': 'GB',
        'Canada': 'CA',
        'Australia': 'AU',
        'Germany': 'DE',
        'France': 'FR',
        'India': 'IN',
        'China': 'CN',
        'Japan': 'JP',
      };
      region = regionMap[region] || region;

      const requestBody = {
        emission_factor: {
          activity_id: params.activity_id,
          data_version: '^27',
          region: region,
        },
        parameters: params.parameters,
      };

      console.log(`      🌐 Climatiq API request:`, JSON.stringify(requestBody, null, 2));

      const response = await axios.post(
        `${this.climatiqBaseUrl}/estimate`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.climatiqApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`      ✅ Climatiq response: ${response.data.co2e} kg CO2e`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Climatiq API key');
      }
      if (error.response?.data) {
        console.error(`      ❌ Climatiq API error:`, error.response.data);
        throw new Error(`Climatiq API error: ${error.response.data.message || error.message}`);
      }
      throw new Error(`Climatiq API error: ${error.message}`);
    }
  }

  /**
   * Estimate Scope 1 emissions based on company size
   */
  estimateScope1(companyInfo) {
    const employees = this.estimateEmployees(companyInfo);
    // Average: 2 tonnes CO2e per employee per year for Scope 1
    return employees * 2000; // kg
  }

  /**
   * Estimate Scope 2 emissions based on company size
   */
  estimateScope2(companyInfo) {
    const employees = this.estimateEmployees(companyInfo);
    // Average: 3 tonnes CO2e per employee per year for Scope 2
    return employees * 3000; // kg
  }

  /**
   * Estimate Scope 3 emissions based on company size
   */
  estimateScope3(companyInfo) {
    const employees = this.estimateEmployees(companyInfo);
    // Average: 5 tonnes CO2e per employee per year for Scope 3
    return employees * 5000; // kg
  }

  /**
   * Estimate employee count from company info
   */
  estimateEmployees(companyInfo) {
    if (companyInfo.employees) return companyInfo.employees;
    if (companyInfo.estimatedEmployees) {
      // Parse range like "10-50"
      const match = companyInfo.estimatedEmployees.match(/(\d+)-(\d+)/);
      if (match) {
        return (parseInt(match[1]) + parseInt(match[2])) / 2;
      }
    }
    // Default: small company
    return 25;
  }

  /**
   * Create emissions breakdown
   */
  createBreakdown(scope1, scope2, scope3) {
    const total = scope1.co2e_kg + scope2.co2e_kg + scope3.co2e_kg;

    return {
      scope1_percentage: ((scope1.co2e_kg / total) * 100).toFixed(1),
      scope2_percentage: ((scope2.co2e_kg / total) * 100).toFixed(1),
      scope3_percentage: ((scope3.co2e_kg / total) * 100).toFixed(1),
    };
  }

  /**
   * Assess data quality
   */
  assessDataQuality(activityData) {
    let score = 0;
    let total = 0;

    const checks = [
      activityData.energy.total_kwh,
      activityData.energy.natural_gas_kwh,
      activityData.transport.fuel_liters,
      activityData.waste.total_kg,
    ];

    checks.forEach(check => {
      total++;
      if (check) score++;
    });

    const percentage = (score / total) * 100;

    if (percentage >= 75) return 'High';
    if (percentage >= 50) return 'Medium';
    if (percentage >= 25) return 'Low';
    return 'Estimated';
  }
}

module.exports = EmissionsCalculatorAgent;
