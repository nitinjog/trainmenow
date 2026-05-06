import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateQuizForModule, gradeQuiz } from '../services/quizGenerator';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const GenerateSchema = z.object({
  moduleId: z.string().uuid(),
  questionCount: z.number().min(5).max(20).default(10),
});

const SubmitSchema = z.object({
  moduleId: z.string().uuid(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
    question: z.string(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string(),
    explanation: z.string(),
    points: z.number(),
  })),
  answers: z.record(z.string()),
});

router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { moduleId, questionCount } = GenerateSchema.parse(req.body);
    const userId = req.userId!;

    // Check if user has a stored quiz and previously passed this module
    const [storedQuiz, lastResult] = await Promise.all([
      prisma.storedQuiz.findUnique({ where: { userId_moduleId: { userId, moduleId } } }),
      prisma.quizResult.findFirst({
        where: { userId, moduleId },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    // Return stored quiz if user last passed — they can retake the same quiz
    if (storedQuiz && lastResult?.passed) {
      return res.json(storedQuiz.quizData);
    }

    // Generate fresh quiz
    const quiz = await generateQuizForModule(moduleId, questionCount);

    // Save/replace the stored quiz for this user+module
    await prisma.storedQuiz.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: { userId, moduleId, quizData: quiz as object },
      update: { quizData: quiz as object },
    });

    res.json(quiz);
  } catch (err) { next(err); }
});

router.post('/submit', async (req: AuthRequest, res, next) => {
  try {
    const { moduleId, questions, answers } = SubmitSchema.parse(req.body);
    const userId = req.userId!;
    const { score, totalPoints, percentage, passed, feedback } = gradeQuiz(questions, answers);

    await prisma.quizResult.create({
      data: {
        userId,
        moduleId,
        score,
        totalPoints,
        percentage,
        passed,
        answers: { userAnswers: answers, feedback },
      },
    });

    // Failed: delete stored quiz so next attempt generates a fresh one
    if (!passed) {
      await prisma.storedQuiz.deleteMany({ where: { userId, moduleId } });
    }

    res.json({ score, totalPoints, percentage, passed, feedback });
  } catch (err) { next(err); }
});

router.get('/:id/results', async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.quizResult.findFirstOrThrow({
      where: { id: req.params.id, userId: req.userId! },
    });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
