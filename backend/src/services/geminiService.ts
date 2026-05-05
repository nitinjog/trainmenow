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
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17',
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

  async organizeContent(rawContent: string[], topic: string, duration: string): Promise<OrganizedModule> {
    const truncated = rawContent.map(c => c.substring(0, 2000)).join('\n\n---\n\n');
    const prompt = `Organize the following scraped content into a structured training module for topic "${topic}" optimized for ${duration} of study.
Content:
${truncated}

Return JSON: { "title": "string", "description": "string", "objectives": ["string"], "totalHours": number, "modules": [{"id": "string", "title": "string", "description": "string", "duration": number, "content": "string", "resources": [{"title": "string", "url": "string", "type": "string", "source": "string"}], "exercises": ["string"], "order": number}] }`;

    return this.callWithJson(prompt, 0.4, 4000);
  }

  async generateQuiz(moduleContent: string, questionCount = 10): Promise<QuizData> {
    const prompt = `Generate a ${questionCount}-question quiz based on this training module content. Mix multiple choice, true/false, and short answer. Cover all major topics.
Content: ${moduleContent.substring(0, 8000)}

Return JSON: { "title": "string", "questions": [{"id": "string", "type": "multiple_choice"|"true_false"|"short_answer", "question": "string", "options": ["string"], "correctAnswer": "string", "explanation": "string", "points": number}] }`;

    return this.callWithJson(prompt, 0.5, 3000);
  }

  private async callWithJson(prompt: string, temperature: number, maxTokens: number): Promise<any> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      });
      const text = result.response.text();
      return this.parseJson(text);
    } catch (error) {
      logger.error('Gemini API error', { error });
      throw error;
    }
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
