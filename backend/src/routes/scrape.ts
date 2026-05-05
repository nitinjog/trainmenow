import { Router } from 'express';
import { z } from 'zod';
import { enqueueScrapingJob, getJobStatus } from '../services/queueService';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const ExecuteSchema = z.object({
  journeyId: z.string().uuid(),
  topic: z.string(),
  duration: z.string(),
  userProfile: z.record(z.unknown()),
});

router.post('/execute', async (req: AuthRequest, res, next) => {
  try {
    const data = ExecuteSchema.parse(req.body);
    const jobId = await enqueueScrapingJob(data);
    res.json({ jobId });
  } catch (err) { next(err); }
});

router.get('/:jobId/status', (req, res) => {
  const status = getJobStatus(req.params.jobId);
  res.json(status);
});

export default router;
