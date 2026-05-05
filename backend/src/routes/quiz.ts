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
    const quiz = await generateQuizForModule(moduleId, questionCount);
    res.json(quiz);
  } catch (err) { next(err); }
});

router.post('/submit', async (req: AuthRequest, res, next) => {
  try {
    const { moduleId, questions, answers } = SubmitSchema.parse(req.body);
    const { score, totalPoints, percentage, passed, feedback } = gradeQuiz(questions, answers);

    const result = await prisma.quizResult.create({
      data: {
        userId: req.userId!,
        moduleId,
        score,
        totalPoints,
        percentage,
        passed,
        answers: { userAnswers: answers, feedback },
      },
    });

    res.json({ resultId: result.id, score, totalPoints, percentage, passed, feedback });
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
