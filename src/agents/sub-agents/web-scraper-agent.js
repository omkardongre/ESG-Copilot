// Web Scraper Sub-Agent
// Extracts ESG data from company websites using Puppeteer

const puppeteer = require('puppeteer');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class WebScraperAgent {
  constructor() {
    this.name = 'WebScraperAgent';
    this.llm = new ChatGoogleGenerativeAI({
      model: process.env.MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });
  }

  /**
   * Execute web scraping for ESG data
   */
  async execute(state, previousResults) {
    console.log(`      🌐 [${this.name}] Scraping company website...`);

    const companyData = state.companyData || state.companyInfo;
    const website = companyData?.website || previousResults?.website;

    if (!website) {
      console.log(`      ⚠️  [${this.name}] No website URL provided - skipping`);
      return null; // Return null so it can be handled gracefully
    }

    try {
      // Step 1: Scrape website content
      const scrapedContent = await this.scrapeWebsite(website);

      // Step 2: Extract ESG-relevant sections
      const esgSections = await this.extractESGSections(scrapedContent, website);

      // Step 3: Parse ESG data using AI
      const esgData = await this.parseESGData(esgSections, companyData);

      console.log(`      ✅ [${this.name}] Extracted ${esgData.length} ESG metrics`);

      // Return data in format expected by ESG data collection service
      const result = {
        environmental: {},
        social: null,
        governance: null,
      };

      // Group data by category
      esgData.forEach(item => {
        if (item.category === 'environmental') {
          result.environmental[item.metric_name] = `${item.metric_value} ${item.unit}`;
        } else if (item.category === 'social') {
          if (!result.social) result.social = {};
          result.social[item.metric_name] = `${item.metric_value} ${item.unit}`;
        } else if (item.category === 'governance') {
          if (!result.governance) result.governance = {};
          result.governance[item.metric_name] = `${item.metric_value} ${item.unit}`;
        }
      });

      return result;
    } catch (error) {
      console.error(`      ❌ [${this.name}] Scraping failed:`, error.message);
      return null; // Return null on error for graceful degradation
    }
  }

  /**
   * Scrape website content using Puppeteer
   */
  async scrapeWebsite(url) {
    console.log(`         📄 Fetching content from: ${url}`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();

      // Set default timeout for all operations
      page.setDefaultTimeout(45000);

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Use 'domcontentloaded' instead of 'networkidle2' for faster, more reliable loading
      // networkidle2 can timeout on sites with persistent connections (analytics, chat widgets, etc.)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 40000,
      });

      // Wait a bit for dynamic content to render (using Promise instead of deprecated waitForTimeout)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract text content
      const content = await page.evaluate(() => {
        // Remove script and style tags
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(script => script.remove());

        // Get main content
        const body = document.body;
        return body.innerText;
      });

      // Also try to find ESG-specific pages
      const esgLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const esgKeywords = [
          'sustainability',
          'esg',
          'environment',
          'social',
          'governance',
          'responsibility',
          'impact',
          'carbon',
          'emissions',
        ];

        return links
          .filter(link => {
            const text = link.textContent.toLowerCase();
            const href = link.href.toLowerCase();
            return esgKeywords.some(keyword => text.includes(keyword) || href.includes(keyword));
          })
          .map(link => ({
            text: link.textContent.trim(),
            url: link.href,
          }))
          .slice(0, 5); // Limit to 5 links
      });

      // Scrape ESG-specific pages if found
      let esgPageContent = '';
      if (esgLinks.length > 0) {
        console.log(`         📑 Found ${esgLinks.length} ESG-related pages`);
        
        for (const link of esgLinks.slice(0, 2)) {
          // Scrape max 2 ESG pages
          try {
            await page.goto(link.url, {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });

            // Wait for content to render (using Promise instead of deprecated waitForTimeout)
            await new Promise(resolve => setTimeout(resolve, 1500));

            const pageText = await page.evaluate(() => {
              const scripts = document.querySelectorAll('script, style, noscript');
              scripts.forEach(script => script.remove());
              return document.body.innerText;
            });

            esgPageContent += `\n\n=== ${link.text} ===\n${pageText}`;
          } catch (err) {
            console.warn(`         ⚠️  Failed to scrape ${link.url}: ${err.message}`);
          }
        }
      }

      return {
        mainContent: content,
        esgContent: esgPageContent,
        esgLinks: esgLinks,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Extract ESG-relevant sections from scraped content
   */
  async extractESGSections(scrapedContent, url) {
    const { mainContent, esgContent } = scrapedContent;

    // Combine content, prioritize ESG-specific pages
    const fullContent = esgContent || mainContent;

    // Truncate to avoid token limits (keep first 10000 chars)
    const truncatedContent = fullContent.substring(0, 10000);

    console.log(`         🔍 Analyzing content (${truncatedContent.length} chars)`);

    const prompt = `You are an ESG data extraction expert. Analyze the following website content and extract ESG-relevant information.

Website: ${url}

Content:
${truncatedContent}

Extract the following ESG information if available:
1. Environmental metrics (emissions, energy use, waste, water, renewable energy %)
2. Social metrics (employee count, diversity %, safety incidents, community programs)
3. Governance metrics (board diversity, ethics policies, certifications)
4. Sustainability goals and commitments
5. ESG reports or certifications mentioned

Respond in JSON format:
{
  "environmental": [
    {"metric": "GHG Emissions", "value": "1000", "unit": "tonnes CO2e", "year": "2023"}
  ],
  "social": [
    {"metric": "Employee Count", "value": "500", "unit": "employees", "year": "2023"}
  ],
  "governance": [
    {"metric": "Board Diversity", "value": "40", "unit": "% women", "year": "2023"}
  ],
  "goals": ["Net zero by 2030", "100% renewable energy by 2025"],
  "certifications": ["ISO 14001", "B Corp"]
}

If no ESG data is found, return empty arrays.`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content;

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn(`         ⚠️  AI extraction failed:`, error.message);
      return {
        environmental: [],
        social: [],
        governance: [],
        goals: [],
        certifications: [],
      };
    }
  }

  /**
   * Parse ESG sections into standardized data format
   */
  async parseESGData(esgSections, companyInfo) {
    const esgData = [];

    // Process environmental metrics
    if (esgSections.environmental) {
      esgSections.environmental.forEach(metric => {
        esgData.push({
          category: 'environmental',
          metric_name: metric.metric,
          metric_value: metric.value,
          unit: metric.unit,
          reporting_period: metric.year || new Date().getFullYear().toString(),
          data_source: 'company_website',
          verified: false,
        });
      });
    }

    // Process social metrics
    if (esgSections.social) {
      esgSections.social.forEach(metric => {
        esgData.push({
          category: 'social',
          metric_name: metric.metric,
          metric_value: metric.value,
          unit: metric.unit,
          reporting_period: metric.year || new Date().getFullYear().toString(),
          data_source: 'company_website',
          verified: false,
        });
      });
    }

    // Process governance metrics
    if (esgSections.governance) {
      esgSections.governance.forEach(metric => {
        esgData.push({
          category: 'governance',
          metric_name: metric.metric,
          metric_value: metric.value,
          unit: metric.unit,
          reporting_period: metric.year || new Date().getFullYear().toString(),
          data_source: 'company_website',
          verified: false,
        });
      });
    }

    // Add goals as qualitative data
    if (esgSections.goals && esgSections.goals.length > 0) {
      esgData.push({
        category: 'governance',
        metric_name: 'Sustainability Goals',
        metric_value: esgSections.goals.join('; '),
        unit: 'text',
        reporting_period: new Date().getFullYear().toString(),
        data_source: 'company_website',
        verified: false,
      });
    }

    // Add certifications
    if (esgSections.certifications && esgSections.certifications.length > 0) {
      esgData.push({
        category: 'governance',
        metric_name: 'ESG Certifications',
        metric_value: esgSections.certifications.join(', '),
        unit: 'text',
        reporting_period: new Date().getFullYear().toString(),
        data_source: 'company_website',
        verified: false,
      });
    }

    return esgData;
  }
}

module.exports = new WebScraperAgent();
