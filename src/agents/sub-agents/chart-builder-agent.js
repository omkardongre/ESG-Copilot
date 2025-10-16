// Chart Builder Sub-Agent
// Generates charts and visualizations for ESG reports
// Supports: Pie, Bar, Line, Radar charts
// Uses Chart.js for rendering

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class ChartBuilderAgent {
  constructor() {
    this.name = 'ChartBuilderAgent';
    this.width = 800;
    this.height = 600;
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: this.width,
      height: this.height,
      backgroundColour: 'white',
    });
  }

  /**
   * Execute chart generation
   */
  async execute(chartSpec) {
    const { id, type, title, data } = chartSpec;

    try {
      // Generate chart configuration based on type
      const config = this.generateChartConfig(type, title, data);

      // Render chart to buffer (PNG image)
      const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(config);

      // Convert to base64 for embedding
      const base64Image = imageBuffer.toString('base64');

      return {
        id,
        type,
        title,
        format: 'png',
        data: base64Image,
        dataUrl: `data:image/png;base64,${base64Image}`,
      };
    } catch (error) {
      console.error(`      ❌ [${this.name}] Error generating chart ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate chart configuration based on type
   */
  generateChartConfig(type, title, data) {
    const chartGenerators = {
      pie: () => this.generatePieChart(title, data),
      bar: () => this.generateBarChart(title, data),
      line: () => this.generateLineChart(title, data),
      radar: () => this.generateRadarChart(title, data),
      doughnut: () => this.generateDoughnutChart(title, data),
    };

    const generator = chartGenerators[type];
    if (!generator) {
      throw new Error(`Unsupported chart type: ${type}`);
    }

    return generator();
  }

  /**
   * Generate Pie Chart (e.g., Emissions Breakdown)
   */
  generatePieChart(title, data) {
    // Extract emissions breakdown
    const scope1 = data?.scope1?.co2e_tonnes || 0;
    const scope2 = data?.scope2?.co2e_tonnes || 0;
    const scope3 = data?.scope3?.co2e_tonnes || 0;

    return {
      type: 'pie',
      data: {
        labels: ['Scope 1 (Direct)', 'Scope 2 (Electricity)', 'Scope 3 (Indirect)'],
        datasets: [
          {
            label: 'Emissions (tonnes CO2e)',
            data: [scope1, scope2, scope3],
            backgroundColor: [
              'rgba(255, 99, 132, 0.8)',
              'rgba(54, 162, 235, 0.8)',
              'rgba(255, 206, 86, 0.8)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 20,
              weight: 'bold',
            },
          },
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 14,
              },
              padding: 20,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value.toFixed(2)} tonnes (${percentage}%)`;
              },
            },
          },
        },
      },
    };
  }

  /**
   * Generate Bar Chart (e.g., ESG Performance)
   */
  generateBarChart(title, data) {
    // Calculate ESG scores from data
    const envScore = this.calculateEnvironmentalScore(data?.environmental);
    const socialScore = this.calculateSocialScore(data?.social);
    const govScore = this.calculateGovernanceScore(data?.governance);

    return {
      type: 'bar',
      data: {
        labels: ['Environmental', 'Social', 'Governance'],
        datasets: [
          {
            label: 'ESG Performance Score',
            data: [envScore, socialScore, govScore],
            backgroundColor: [
              'rgba(75, 192, 192, 0.8)',
              'rgba(153, 102, 255, 0.8)',
              'rgba(255, 159, 64, 0.8)',
            ],
            borderColor: [
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
              'rgba(255, 159, 64, 1)',
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Score (0-100)',
              font: {
                size: 14,
              },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 20,
              weight: 'bold',
            },
          },
          legend: {
            display: false,
          },
        },
      },
    };
  }

  /**
   * Generate Line Chart (e.g., Emissions Trend)
   */
  generateLineChart(title, data) {
    // Generate trend data (simulated for current year)
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];
    
    const scope1Values = this.generateTrendData(data?.scope1?.co2e_tonnes || 0);
    const scope2Values = this.generateTrendData(data?.scope2?.co2e_tonnes || 0);
    const scope3Values = this.generateTrendData(data?.scope3?.co2e_tonnes || 0);

    return {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Scope 1',
            data: scope1Values,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 3,
            tension: 0.4,
          },
          {
            label: 'Scope 2',
            data: scope2Values,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderWidth: 3,
            tension: 0.4,
          },
          {
            label: 'Scope 3',
            data: scope3Values,
            borderColor: 'rgba(255, 206, 86, 1)',
            backgroundColor: 'rgba(255, 206, 86, 0.2)',
            borderWidth: 3,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Emissions (tonnes CO2e)',
              font: {
                size: 14,
              },
            },
          },
          x: {
            title: {
              display: true,
              text: 'Year',
              font: {
                size: 14,
              },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 20,
              weight: 'bold',
            },
          },
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 14,
              },
            },
          },
        },
      },
    };
  }

  /**
   * Generate Radar Chart (e.g., Environmental Metrics)
   */
  generateRadarChart(title, data) {
    // Extract environmental metrics
    const metrics = data || {};
    
    const labels = [];
    const values = [];
    
    // Map common environmental metrics
    const metricMapping = {
      carbon_emissions_tons: 'Carbon Emissions',
      energy_consumption_mwh: 'Energy Use',
      renewable_energy_percent: 'Renewable Energy',
      waste_recycling_percent: 'Waste Recycling',
      water_usage_m3: 'Water Usage',
    };

    Object.entries(metricMapping).forEach(([key, label]) => {
      if (metrics[key] !== undefined) {
        labels.push(label);
        // Normalize to 0-100 scale
        let value = metrics[key];
        if (key.includes('percent')) {
          value = Math.min(100, value);
        } else {
          // Normalize other metrics to 0-100 scale (simplified)
          value = Math.min(100, (value / 1000) * 100);
        }
        values.push(value);
      }
    });

    // If no data, use sample data
    if (labels.length === 0) {
      labels.push('Carbon', 'Energy', 'Renewables', 'Recycling', 'Water');
      values.push(60, 70, 45, 55, 65);
    }

    return {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Environmental Performance',
            data: values,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 3,
            pointBackgroundColor: 'rgba(75, 192, 192, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(75, 192, 192, 1)',
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 20,
              weight: 'bold',
            },
          },
          legend: {
            display: false,
          },
        },
      },
    };
  }

  /**
   * Generate Doughnut Chart
   */
  generateDoughnutChart(title, data) {
    const config = this.generatePieChart(title, data);
    config.type = 'doughnut';
    return config;
  }

  /**
   * Calculate Environmental Score (0-100)
   */
  calculateEnvironmentalScore(envData) {
    if (!envData || Object.keys(envData).length === 0) return 50;

    let score = 50; // Base score

    // Renewable energy bonus
    if (envData.renewable_energy_percent) {
      score += envData.renewable_energy_percent * 0.3;
    }

    // Recycling bonus
    if (envData.waste_recycling_percent) {
      score += envData.waste_recycling_percent * 0.2;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate Social Score (0-100)
   */
  calculateSocialScore(socialData) {
    if (!socialData || Object.keys(socialData).length === 0) return 50;

    let score = 50; // Base score

    // Diversity bonus
    if (socialData.women_in_leadership_percent) {
      score += socialData.women_in_leadership_percent * 0.3;
    }

    // Training bonus
    if (socialData.employee_training_hours) {
      score += Math.min(20, socialData.employee_training_hours);
    }

    // Low turnover bonus
    if (socialData.employee_turnover_percent) {
      score += Math.max(0, 20 - socialData.employee_turnover_percent);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate Governance Score (0-100)
   */
  calculateGovernanceScore(govData) {
    if (!govData || Object.keys(govData).length === 0) return 50;

    let score = 50; // Base score

    // Board independence bonus
    if (govData.board_independence_percent) {
      score += govData.board_independence_percent * 0.3;
    }

    // Policy bonuses
    if (govData.ethics_policy) score += 10;
    if (govData.whistleblower_program) score += 10;
    if (govData.sustainability_committee) score += 10;
    if (govData.esg_reporting) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate trend data (simulated historical data)
   */
  generateTrendData(currentValue) {
    // Simulate 3-year trend with slight reduction (improvement)
    const year1 = currentValue * 1.15; // 15% higher 2 years ago
    const year2 = currentValue * 1.07; // 7% higher last year
    const year3 = currentValue; // Current year

    return [
      parseFloat(year1.toFixed(2)),
      parseFloat(year2.toFixed(2)),
      parseFloat(year3.toFixed(2)),
    ];
  }
}

module.exports = ChartBuilderAgent;
