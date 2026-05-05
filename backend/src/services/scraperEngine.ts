import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';
import { ScrapingPlan } from './geminiService';

export interface ScrapedContent {
  url: string;
  title: string;
  body: string;
  wordCount: number;
  contentType: 'article' | 'video' | 'course' | 'paper' | 'other';
  scrapedAt: Date;
}

class ScraperEngine {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    }
    return this.browser;
  }

  async executePlan(plan: ScrapingPlan): Promise<ScrapedContent[]> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'TrainMeNow-Bot/1.0 (Educational Content Aggregation)',
    });

    try {
      const urls = await this.discoverUrls(plan.searchQueries, plan.targetDomains);
      const results: ScrapedContent[] = [];

      for (const batch of this.chunk(urls.slice(0, 15), 3)) {
        const batchResults = await Promise.allSettled(
          batch.map(url => this.extractContent(url, context))
        );
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) results.push(r.value);
        }
        await this.delay(1000);
      }

      return results;
    } finally {
      await context.close();
    }
  }

  private async discoverUrls(queries: string[], domains: string[]): Promise<string[]> {
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      logger.warn('No SERPAPI_KEY — using fallback search');
      return this.fallbackSearch(queries);
    }

    const urls: string[] = [];
    for (const query of queries.slice(0, 5)) {
      try {
        const domainFilter = domains.length ? `site:${domains[0]} OR site:${domains[1] || domains[0]}` : '';
        const q = encodeURIComponent(`${query} ${domainFilter}`);
        const resp = await fetch(`https://serpapi.com/search.json?q=${q}&api_key=${serpApiKey}&num=5`);
        const data = await resp.json() as any;
        const links = (data.organic_results || []).map((r: any) => r.link).filter(Boolean);
        urls.push(...links);
      } catch (err) {
        logger.error('SerpAPI error', { err });
      }
    }
    return [...new Set(urls)];
  }

  private async fallbackSearch(queries: string[]): Promise<string[]> {
    // Return empty — scraping without search in fallback mode returns nothing
    // This prevents scraping arbitrary URLs without a search backend
    logger.warn('No search API configured, skipping URL discovery');
    return [];
  }

  private async extractContent(url: string, context: BrowserContext): Promise<ScrapedContent | null> {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const html = await page.content();
      const $ = cheerio.load(html);

      $('script, style, nav, footer, header, aside, .ad, [class*="advertisement"]').remove();

      const title = $('h1').first().text().trim()
        || $('title').text().trim()
        || url;

      const body = ($('article, main, [role="main"], .content, .post-content, .entry-content').text()
        || $('body').text())
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000);

      if (!body || body.length < 100) return null;

      return {
        url,
        title,
        body,
        wordCount: body.split(/\s+/).length,
        contentType: this.detectType(url, $),
        scrapedAt: new Date(),
      };
    } catch (err) {
      logger.error(`Failed to scrape ${url}`, { err });
      return null;
    } finally {
      await page.close();
    }
  }

  private detectType(url: string, $: cheerio.CheerioAPI): ScrapedContent['contentType'] {
    if (url.includes('youtube.com') || url.includes('vimeo.com')) return 'video';
    if (url.includes('arxiv.org') || url.includes('scholar.google')) return 'paper';
    if (url.includes('coursera') || url.includes('udemy') || url.includes('edx')) return 'course';
    if ($('article').length > 0) return 'article';
    return 'other';
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default new ScraperEngine();
