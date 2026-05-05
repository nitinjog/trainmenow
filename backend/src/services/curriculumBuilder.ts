import { PrismaClient } from '@prisma/client';
import geminiService from './geminiService';
import scraperEngine from './scraperEngine';
import { processContent } from './contentProcessor';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export async function buildCurriculum(
  journeyId: string,
  topic: string,
  duration: string,
  userProfile: Record<string, unknown>
): Promise<string> {
  logger.info('Building curriculum', { journeyId, topic });

  const plan = await geminiService.designScrapingPlan(topic, duration, userProfile);
  logger.info('Scraping plan designed', { queries: plan.searchQueries.length });

  const scraped = await scraperEngine.executePlan(plan);
  logger.info('Content scraped', { count: scraped.length });

  const processedContent = processContent(scraped);
  const organized = await geminiService.organizeContent(processedContent, topic, duration);

  const module = await prisma.trainingModule.create({
    data: {
      journeyId,
      title: organized.title,
      description: organized.description,
      totalDuration: Math.round(organized.totalHours * 60),
      objectives: organized.objectives,
      content: organized as any,
    },
  });

  await prisma.learningJourney.update({
    where: { id: journeyId },
    data: { status: 'module_ready' },
  });

  logger.info('Curriculum built', { moduleId: module.id });
  return module.id;
}
