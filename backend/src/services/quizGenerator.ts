import { PrismaClient } from '@prisma/client';
import geminiService, { QuizData } from './geminiService';

const prisma = new PrismaClient();

export async function generateQuizForModule(moduleId: string, questionCount = 10): Promise<QuizData> {
  const module = await prisma.trainingModule.findUniqueOrThrow({ where: { id: moduleId } });
  const content = JSON.stringify(module.content);
  return geminiService.generateQuiz(content, questionCount);
}

export function gradeQuiz(
  questions: QuizData['questions'],
  userAnswers: Record<string, string>
): { score: number; totalPoints: number; percentage: number; passed: boolean; feedback: Record<string, { correct: boolean; explanation: string }> } {
  let score = 0;
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const feedback: Record<string, { correct: boolean; explanation: string }> = {};

  for (const q of questions) {
    const userAnswer = (userAnswers[q.id] || '').toLowerCase().trim();
    const correct = q.correctAnswer.toLowerCase().trim();
    const isCorrect = userAnswer === correct;
    if (isCorrect) score += q.points;
    feedback[q.id] = { correct: isCorrect, explanation: q.explanation };
  }

  const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
  return { score, totalPoints, percentage, passed: percentage >= 70, feedback };
}
