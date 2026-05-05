import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import curriculumRoutes from './routes/curriculum';
import scrapeRoutes from './routes/scrape';
import quizRoutes from './routes/quiz';
import certificateRoutes from './routes/certificate';
import authRoutes from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/curriculum', authenticate, curriculumRoutes);
app.use('/api/v1/scrape', authenticate, scrapeRoutes);
app.use('/api/v1/quiz', authenticate, quizRoutes);
app.use('/api/v1/certificate', authenticate, certificateRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Public certificate verification endpoint
app.get('/api/v1/verify/:certificateNumber', async (req, res) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber: req.params.certificateNumber },
      include: { user: true, module: true },
    });
    if (!cert) return res.status(404).json({ valid: false });
    res.json({
      valid: true,
      userName: cert.user.name,
      courseTitle: cert.module.title,
      completionDate: cert.createdAt,
      score: cert.score,
      certificateNumber: cert.certificateNumber,
    });
  } finally {
    await prisma.$disconnect();
  }
});

app.use(errorHandler);

export default app;
