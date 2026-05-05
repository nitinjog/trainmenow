import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { ScrapedContent } from './scraperEngine';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window & typeof globalThis);

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html);
}

export function processContent(scraped: ScrapedContent[]): string[] {
  return scraped
    .filter(item => item.wordCount > 50)
    .sort((a, b) => b.wordCount - a.wordCount)
    .map(item => `# ${item.title}\nSource: ${item.url}\n\n${item.body}`);
}

export function chunkText(text: string, maxChars = 3000): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = text.lastIndexOf(' ', i + maxChars);
    chunks.push(text.slice(i, end === -1 ? i + maxChars : end));
    i = end === -1 ? i + maxChars : end + 1;
  }
  return chunks;
}
