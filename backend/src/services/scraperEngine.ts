import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';
import { ScrapingPlan, ContentResource } from './geminiService';

export interface ScrapedContent {
  url: string;
  title: string;
  body: string;
  wordCount: number;
  contentType: 'article' | 'video' | 'course' | 'paper' | 'other';
  scrapedAt: Date;
}

export interface DiscoveryResult {
  textContent: string[];
  resources: ContentResource[];
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

  async executePlan(plan: ScrapingPlan): Promise<DiscoveryResult> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    try {
      const primaryQuery = plan.searchQueries[0] || '';
      const videoQueries = plan.searchQueries.slice(0, 3).map(q => `${q} tutorial`);

      // Run API-based discovery in parallel (no Playwright needed for these)
      const [youtubeRes, wikiRes, devtoRes] = await Promise.allSettled([
        this.discoverYouTube(videoQueries),
        this.discoverWikipedia(primaryQuery),
        this.discoverDevTo(primaryQuery),
      ]);

      // Discover article URLs via SerpAPI if available
      const urls = await this.discoverUrls(plan.searchQueries, plan.targetDomains);

      // Scrape articles for text context (not YouTube — it blocks bots)
      const articleUrls = urls.filter(u => !u.includes('youtube.com') && !u.includes('youtu.be'));
      const scraped: ScrapedContent[] = [];
      for (const batch of this.chunk(articleUrls.slice(0, 10), 3)) {
        const results = await Promise.allSettled(
          batch.map(url => this.extractContent(url, context))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) scraped.push(r.value);
        }
        await this.delay(1000);
      }

      // Convert scraped article pages to resources (real, verified URLs)
      const articleResources: ContentResource[] = scraped.map(s => ({
        url: s.url,
        title: s.title,
        description: s.body.substring(0, 200),
        type: 'article' as const,
        source: this.extractDomain(s.url),
      }));

      const resources: ContentResource[] = [
        ...(youtubeRes.status === 'fulfilled' ? youtubeRes.value : []),
        ...(wikiRes.status === 'fulfilled' ? wikiRes.value : []),
        ...(devtoRes.status === 'fulfilled' ? devtoRes.value : []),
        ...articleResources,
      ];

      const textContent = scraped
        .filter(s => s.wordCount > 50)
        .sort((a, b) => b.wordCount - a.wordCount)
        .map(s => `# ${s.title}\nSource: ${s.url}\n\n${s.body}`);

      logger.info('Discovery complete', {
        youtube: youtubeRes.status === 'fulfilled' ? youtubeRes.value.length : 'failed',
        wikipedia: wikiRes.status === 'fulfilled' ? wikiRes.value.length : 'failed',
        devto: devtoRes.status === 'fulfilled' ? devtoRes.value.length : 'failed',
        articles: articleResources.length,
        totalResources: resources.length,
      });

      return { textContent, resources };
    } finally {
      await context.close();
    }
  }

  private async discoverYouTube(queries: string[]): Promise<ContentResource[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      logger.info('No YOUTUBE_API_KEY set — skipping YouTube discovery');
      return [];
    }

    const resources: ContentResource[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: '5',
          key: apiKey,
          relevanceLanguage: 'en',
          order: 'relevance',
        });
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        if (!resp.ok) {
          logger.warn('YouTube API error', { status: resp.status, query });
          continue;
        }
        const data = await resp.json() as any;
        for (const item of data.items || []) {
          const videoId = item.id?.videoId;
          if (!videoId || seen.has(videoId)) continue;
          seen.add(videoId);
          resources.push({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: item.snippet.title,
            description: (item.snippet.description || '').substring(0, 200),
            type: 'video',
            source: item.snippet.channelTitle || 'YouTube',
            thumbnail: item.snippet.thumbnails?.medium?.url,
          });
        }
      } catch (err) {
        logger.warn('YouTube search error', { err, query });
      }
    }

    return resources;
  }

  private async discoverWikipedia(query: string): Promise<ContentResource[]> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        srlimit: '5',
        srprop: 'snippet',
      });
      const resp = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'TrainMeNow/1.0 (educational platform; contact@trainmenow.app)' },
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      return (data.query?.search || []).map((item: any) => ({
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        title: item.title,
        description: (item.snippet || '').replace(/<[^>]+>/g, '').trim(),
        type: 'reference' as const,
        source: 'Wikipedia',
      }));
    } catch (err) {
      logger.warn('Wikipedia API error', { err });
      return [];
    }
  }

  private async discoverDevTo(query: string): Promise<ContentResource[]> {
    try {
      // Dev.to tags are single words, no spaces
      const tag = query.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
      const params = new URLSearchParams({ tag, per_page: '6', top: '365' });
      const resp = await fetch(`https://dev.to/api/articles?${params}`, {
        headers: { 'User-Agent': 'TrainMeNow/1.0' },
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        url: item.url,
        title: item.title,
        description: item.description || '',
        type: 'article' as const,
        source: item.user?.name ? `Dev.to — ${item.user.name}` : 'Dev.to',
      }));
    } catch (err) {
      logger.warn('Dev.to API error', { err });
      return [];
    }
  }

  private async discoverUrls(queries: string[], domains: string[]): Promise<string[]> {
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      logger.warn('No SERPAPI_KEY — skipping web search');
      return [];
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

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
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
