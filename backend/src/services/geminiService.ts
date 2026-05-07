import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import logger from '../utils/logger';

const SYSTEM_PROMPT = `You are the AI Curriculum Architect for "Train Me Now - AI First Learning Academy".
Your role is to design personalized, high-quality self-learning experiences.
Always respond in valid JSON format as specified. Be concise but comprehensive.`;

class GeminiService {
  private model: GenerativeModel;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  async generateFollowUpQuestions(topic: string, duration: string): Promise<FollowUpQuestion[]> {
    const prompt = `Given the topic "${topic}" and desired duration "${duration}", generate 3-5 follow-up questions to personalize the learning experience. Questions should assess: current knowledge level, learning goals, preferred content types, practical application needs.
Return JSON: { "questions": [{"id": "string", "question": "string", "type": "single_choice"|"text"|"scale", "options": ["string"]}] }`;

    const result = await this.callWithJson(prompt, 0.7, 1000);
    return result.questions;
  }

  async designScrapingPlan(topic: string, duration: string, profile: Record<string, unknown>): Promise<ScrapingPlan> {
    const prompt = `Based on topic "${topic}", duration "${duration}", and user profile ${JSON.stringify(profile)}, design a web scraping plan.
Return JSON: { "searchQueries": ["string"], "targetDomains": ["string"], "contentTypes": ["article"|"video"|"course"|"paper"], "priority": ["string"] }`;

    return this.callWithJson(prompt, 0.3, 2000);
  }

  async organizeContent(textContent: string[], resources: ContentResource[], topic: string, duration: string): Promise<OrganizedModule> {
    const truncated = textContent.map(c => c.substring(0, 2000)).join('\n\n---\n\n');

    const resourceList = resources.slice(0, 40).map((r, i) => {
      const dur = r.videoDuration ? ` | ${r.videoDuration}` : '';
      return `[${i}] ${r.type.toUpperCase()}${dur} | "${r.title}" | source: ${r.source} | url: ${r.url}`;
    }).join('\n');

    const prompt = `Design a structured training curriculum for "${topic}" targeting ${duration} of total study time.

Reference material (scraped content for context):
${truncated || '(No scraped text — use your knowledge to write module content.)'}

Verified resources — ONLY use URLs from this exact list. Do NOT invent, guess, or modify any URL:
${resourceList || '(No external resources available — use empty resource arrays.)'}

Instructions:
- Create 4–8 progressive modules covering the topic end-to-end
- For each module assign 2–4 resources from the list above that best match that module's specific focus
- Spread VIDEO resources across different modules; do not cluster them all in one module
- For video resources, copy the duration value (e.g. "12:34") exactly from the list into the resource's "duration" field; for non-video resources set "duration" to ""
- Write each module's "content" field as clear instructional markdown (250–400 words): explain concepts, give examples, highlight key points
- Do NOT embed URLs inside the "content" text — URLs belong only in the resources array

Return JSON: { "title": "string", "description": "string", "objectives": ["string"], "totalHours": number, "modules": [{"id": "string", "title": "string", "description": "string", "duration": number, "content": "string", "resources": [{"title": "string", "url": "string", "type": "string", "source": "string", "duration": "string"}], "exercises": ["string"], "order": number}] }`;

    return this.callWithJson(prompt, 0.4, 8192);
  }

  async generateQuiz(moduleContent: string, questionCount = 10): Promise<QuizData> {
    const prompt = `Generate a ${questionCount}-question quiz based on this training module content. Mix multiple choice, true/false, and short answer. Cover all major topics.
Content: ${moduleContent.substring(0, 8000)}

Return JSON: { "title": "string", "questions": [{"id": "string", "type": "multiple_choice"|"true_false"|"short_answer", "question": "string", "options": ["string"], "correctAnswer": "string", "explanation": "string", "points": number}] }`;

    return this.callWithJson(prompt, 0.5, 3000);
  }

  private async callWithJson(prompt: string, temperature: number, maxTokens: number, attempt = 0): Promise<any> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: Math.max(maxTokens, 2048),
          responseMimeType: 'application/json',
        },
      });
      const text = result.response.text();
      if (!text || text.trim() === '') throw new Error('Empty response from Gemini');
      return this.parseJson(text);
    } catch (error: any) {
      const is429 = error?.message?.includes('429') || error?.status === 429;
      const isOverloaded = error?.message?.includes('503') || error?.message?.includes('overloaded');

      if (isOverloaded && attempt < 3) {
        const delay = (attempt + 1) * 3000;
        logger.warn(`Gemini overloaded (attempt ${attempt + 1}), retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return this.callWithJson(prompt, temperature, maxTokens, attempt + 1);
      }

      if (is429 && process.env.OPENROUTER_API_KEY) {
        logger.warn('Gemini rate-limited (429), falling back to OpenRouter');
        return this.callOpenRouter(prompt, temperature, maxTokens);
      }

      logger.error('Gemini API error', { error });
      throw error;
    }
  }

  private async callOpenRouter(prompt: string, temperature: number, maxTokens: number): Promise<any> {
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: Math.max(maxTokens, 2048),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenRouter');
    logger.info('OpenRouter fallback succeeded', { model });
    return this.parseJson(text);
  }

  private parseJson(text: string): any {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(clean);
  }
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'text' | 'scale';
  options?: string[];
}

export interface ScrapingPlan {
  searchQueries: string[];
  targetDomains: string[];
  contentTypes: ('article' | 'video' | 'course' | 'paper')[];
  priority: string[];
}

export interface ContentResource {
  url: string;
  title: string;
  description: string;
  type: 'video' | 'article' | 'reference' | 'course';
  source: string;
  thumbnail?: string;
  videoDuration?: string; // formatted: "12:34" or "1:05:22"
}

export interface OrganizedModule {
  title: string;
  description: string;
  objectives: string[];
  totalHours: number;
  modules: SubModuleData[];
}

export interface SubModuleData {
  id: string;
  title: string;
  description: string;
  duration: number;
  content: string;
  resources: ResourceData[];
  exercises: string[];
  order: number;
}

export interface ResourceData {
  title: string;
  url: string;
  type: string;
  source: string;
}

export interface QuizData {
  title: string;
  questions: QuestionData[];
}

export interface QuestionData {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

export default new GeminiService();
