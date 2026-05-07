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

  async executePlan(plan: ScrapingPlan, courseDuration: string): Promise<DiscoveryResult> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    try {
      const primaryQuery = plan.searchQueries[0] || '';
      const videoQueries = plan.searchQueries.slice(0, 3).map(q => `${q} tutorial`);
      const maxVidMin = this.maxVideoMinutes(this.parseCourseDurationMinutes(courseDuration));

      const [youtubeRes, wikiRes, devtoRes] = await Promise.allSettled([
        this.discoverYouTube(videoQueries, maxVidMin),
        this.discoverWikipedia(primaryQuery),
        this.discoverDevTo(primaryQuery),
      ]);

      const urls = await this.discoverUrls(plan.searchQueries, plan.targetDomains);
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
        maxVidMin,
      });

      return { textContent, resources };
    } finally {
      await context.close();
    }
  }

  // --- YouTube discovery with duration filtering ---

  private async discoverYouTube(queries: string[], maxVideoMinutes: number): Promise<ContentResource[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      logger.info('No YOUTUBE_API_KEY set — skipping YouTube discovery');
      return [];
    }

    // Collect candidate video IDs + snippet data across all queries
    const candidates: Array<{ videoId: string; snippet: any }> = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: '10',
          key: apiKey,
          relevanceLanguage: 'en',
          order: 'relevance',
        });
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        if (!resp.ok) {
          logger.warn('YouTube search error', { status: resp.status, query });
          continue;
        }
        const data = await resp.json() as any;
        for (const item of data.items || []) {
          const videoId = item.id?.videoId;
          if (!videoId || seen.has(videoId)) continue;
          seen.add(videoId);
          candidates.push({ videoId, snippet: item.snippet });
        }
      } catch (err) {
        logger.warn('YouTube search error', { err, query });
      }
    }

    if (candidates.length === 0) return [];

    // Batch-fetch video durations (videos endpoint, 1 unit per video vs 100 for search)
    const durationMap = await this.fetchVideoDurations(
      candidates.map(c => c.videoId),
      apiKey
    );

    const maxSeconds = maxVideoMinutes * 60;
    const minSeconds = 90; // skip < 90 s (clips, trailers)

    const resources: ContentResource[] = [];
    for (const { videoId, snippet } of candidates) {
      const seconds = durationMap.get(videoId);
      if (seconds === undefined || seconds < minSeconds || seconds > maxSeconds) continue;
      resources.push({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title,
        description: (snippet.description || '').substring(0, 200),
        type: 'video',
        source: snippet.channelTitle || 'YouTube',
        thumbnail: snippet.thumbnails?.medium?.url,
        videoDuration: this.formatSeconds(seconds),
      });
    }

    logger.info('YouTube discovery', {
      candidates: candidates.length,
      afterFilter: resources.length,
      maxVideoMinutes,
    });

    return resources;
  }

  private async fetchVideoDurations(videoIds: string[], apiKey: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    // API allows up to 50 IDs per request
    for (const batch of this.chunk(videoIds, 50)) {
      try {
        const params = new URLSearchParams({
          part: 'contentDetails',
          id: batch.join(','),
          key: apiKey,
        });
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
        if (!resp.ok) continue;
        const data = await resp.json() as any;
        for (const item of data.items || []) {
          const secs = this.parseIsoDuration(item.contentDetails?.duration || '');
          if (secs > 0) result.set(item.id, secs);
        }
      } catch (err) {
        logger.warn('YouTube duration fetch error', { err });
      }
    }
    return result;
  }

  // PT1H23M45S → seconds
  private parseIsoDuration(iso: string): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || '0') * 3600)
      + (parseInt(m[2] || '0') * 60)
      + parseInt(m[3] || '0');
  }

  // seconds → "12:34" or "1:05:22"
  private formatSeconds(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // "1 hour" / "8 hours" / "30 hours" → minutes
  private parseCourseDurationMinutes(duration: string): number {
    const m = duration.match(/(\d+)\s*hour/i);
    return m ? parseInt(m[1]) * 60 : 120;
  }

  // Map course length to a sensible per-video cap
  private maxVideoMinutes(courseMinutes: number): number {
    if (courseMinutes <= 120) return 20;   // 1–2 h course → max 20 min video
    if (courseMinutes <= 240) return 30;   // 3–4 h course → max 30 min video
    if (courseMinutes <= 480) return 45;   // 5–8 h course → max 45 min video
    return 60;                             // 15–30 h course → max 60 min video
  }

  // --- Wikipedia ---

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

  // --- Dev.to ---

  private async discoverDevTo(query: string): Promise<ContentResource[]> {
    try {
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

  // --- SerpAPI web search ---

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

  // --- Playwright article scraping ---

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
