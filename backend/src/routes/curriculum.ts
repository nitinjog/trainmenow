import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import geminiService from '../services/geminiService';
import { enqueueScrapingJob } from '../services/queueService';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const InitiateSchema = z.object({
  topic: z.string().min(1).max(500),
  duration: z.string().min(1),
});

const FollowUpSchema = z.object({
  journeyId: z.string().uuid(),
  answers: z.record(z.string()),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  goals: z.array(z.string()),
});

// POST /api/v1/curriculum/initiate
router.post('/initiate', async (req: AuthRequest, res, next) => {
  try {
    const { topic, duration } = InitiateSchema.parse(req.body);
    const questions = await geminiService.generateFollowUpQuestions(topic, duration);

    const journey = await prisma.learningJourney.create({
      data: { userId: req.userId!, topic, duration, status: 'awaiting_followup' },
    });

    res.status(201).json({ journeyId: journey.id, questions });
  } catch (err) { next(err); }
});

// POST /api/v1/curriculum/follow-up
router.post('/follow-up', async (req: AuthRequest, res, next) => {
  try {
    const { journeyId, answers, experienceLevel, goals } = FollowUpSchema.parse(req.body);

    const journey = await prisma.learningJourney.update({
      where: { id: journeyId, userId: req.userId! },
      data: { experienceLevel, goals, status: 'scraping_queued' },
    });

    const jobId = await enqueueScrapingJob({
      journeyId,
      topic: journey.topic,
      duration: journey.duration,
      userProfile: { experienceLevel, goals, answers },
    });

    res.json({ jobId, message: 'Curriculum generation started' });
  } catch (err) { next(err); }
});

// GET /api/v1/curriculum/:id/modules
router.get('/:id/modules', async (req: AuthRequest, res, next) => {
  try {
    const journey = await prisma.learningJourney.findFirstOrThrow({
      where: { id: req.params.id, userId: req.userId! },
      include: { modules: true },
    });
    res.json({ status: journey.status, modules: journey.modules });
  } catch (err) { next(err); }
});

// GET /api/v1/curriculum/:id/progress
router.get('/:id/progress', async (req: AuthRequest, res, next) => {
  try {
    const progress = await prisma.progress.findMany({
      where: { userId: req.userId!, module: { journeyId: req.params.id } },
    });
    res.json(progress);
  } catch (err) { next(err); }
});

// POST /api/v1/curriculum/:id/progress
router.post('/:id/progress', async (req: AuthRequest, res, next) => {
  try {
    const { moduleId, submoduleId, completionPercentage, timeSpent } = req.body;

    const progress = await prisma.progress.upsert({
      where: { id: `${req.userId}-${moduleId}-${submoduleId || 'main'}` },
      update: { completionPercentage, timeSpent, lastAccessed: new Date() },
      create: {
        id: `${req.userId}-${moduleId}-${submoduleId || 'main'}`,
        userId: req.userId!,
        moduleId,
        submoduleId,
        completionPercentage,
        timeSpent,
        status: completionPercentage >= 100 ? 'completed' : 'in_progress',
      },
    });
    res.json(progress);
  } catch (err) { next(err); }
});

// GET /api/v1/curriculum (list all journeys for user)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const journeys = await prisma.learningJourney.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(journeys);
  } catch (err) { next(err); }
});

export default router;
