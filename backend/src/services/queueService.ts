import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { buildCurriculum } from './curriculumBuilder';
import logger from '../utils/logger';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const scrapingQueue = new Queue('scraping', { connection });

const jobStatuses = new Map<string, { status: string; moduleId?: string; error?: string }>();

new Worker(
  'scraping',
  async (job: Job) => {
    const { journeyId, topic, duration, userProfile } = job.data;
    jobStatuses.set(job.id!, { status: 'processing' });
    try {
      const moduleId = await buildCurriculum(journeyId, topic, duration, userProfile);
      jobStatuses.set(job.id!, { status: 'completed', moduleId });
    } catch (err: any) {
      jobStatuses.set(job.id!, { status: 'failed', error: err.message });
      throw err;
    }
  },
  { connection }
);

export function getJobStatus(jobId: string) {
  return jobStatuses.get(jobId) || { status: 'unknown' };
}

export async function enqueueScrapingJob(data: {
  journeyId: string;
  topic: string;
  duration: string;
  userProfile: Record<string, unknown>;
}): Promise<string> {
  const job = await scrapingQueue.add('scrape', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  });
  jobStatuses.set(job.id!, { status: 'queued' });
  logger.info('Scraping job enqueued', { jobId: job.id });
  return job.id!;
}
