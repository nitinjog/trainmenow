import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createCertificate } from '../services/certificateService';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const GenerateSchema = z.object({
  moduleId: z.string().uuid(),
  score: z.number().min(0).max(100),
});

router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { moduleId, score } = GenerateSchema.parse(req.body);

    // Verify the user passed the quiz
    const quizResult = await prisma.quizResult.findFirst({
      where: { userId: req.userId!, moduleId, passed: true },
      orderBy: { completedAt: 'desc' },
    });

    if (!quizResult) {
      return res.status(403).json({ error: 'Must pass the quiz before generating a certificate' });
    }

    // Check if certificate already exists
    const existing = await prisma.certificate.findFirst({
      where: { userId: req.userId!, moduleId },
    });
    if (existing) {
      return res.json({ certificateId: existing.id, certificateNumber: existing.certificateNumber });
    }

    const cert = await createCertificate(req.userId!, moduleId, score);
    res.status(201).json(cert);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const cert = await prisma.certificate.findFirstOrThrow({
      where: { id: req.params.id, userId: req.userId! },
      include: { user: true, module: true },
    });
    res.json({
      id: cert.id,
      userName: cert.user.name,
      courseTitle: cert.module.title,
      completionDate: cert.createdAt,
      score: cert.score,
      certificateNumber: cert.certificateNumber,
      awardedBy: cert.awardedBy,
    });
  } catch (err) { next(err); }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const certs = await prisma.certificate.findMany({
      where: { userId: req.userId! },
      include: { module: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(certs);
  } catch (err) { next(err); }
});

export default router;
