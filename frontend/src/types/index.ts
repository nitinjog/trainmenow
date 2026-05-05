export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface LearningJourney {
  id: string;
  userId: string;
  topic: string;
  duration: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  status: 'awaiting_followup' | 'scraping_queued' | 'module_ready' | 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface SubModule {
  id: string;
  title: string;
  description: string;
  duration: number;
  content: string;
  resources: Resource[];
  exercises: string[];
  order: number;
}

export interface Resource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'course' | 'paper' | 'documentation';
  source: string;
}

export interface TrainingModule {
  id: string;
  journeyId: string;
  title: string;
  description: string;
  totalDuration: number;
  objectives: string[];
  content: {
    title: string;
    description: string;
    objectives: string[];
    totalHours: number;
    modules: SubModule[];
  };
  createdAt: string;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'text' | 'scale';
  options?: string[];
}

export interface Question {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

export interface QuizData {
  title: string;
  questions: Question[];
}

export interface QuizResult {
  resultId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  feedback: Record<string, { correct: boolean; explanation: string }>;
}

export interface Certificate {
  id: string;
  userName: string;
  courseTitle: string;
  completionDate: string;
  score: number;
  certificateNumber: string;
  awardedBy: string;
}

export interface Progress {
  moduleId: string;
  submoduleId?: string;
  completionPercentage: number;
  timeSpent: number;
  status: string;
}
