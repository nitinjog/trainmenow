import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function createCertificate(userId: string, moduleId: string, score: number) {
  const certificateNumber = `TMN-${uuidv4().substring(0, 8).toUpperCase()}-${Date.now()}`;

  const cert = await prisma.certificate.create({
    data: { userId, moduleId, certificateNumber, score },
    include: { user: true, module: true },
  });

  return {
    id: cert.id,
    userName: cert.user.name,
    courseTitle: cert.module.title,
    completionDate: cert.createdAt,
    score: cert.score,
    certificateNumber: cert.certificateNumber,
    awardedBy: cert.awardedBy,
  };
}
