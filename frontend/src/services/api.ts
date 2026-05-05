import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Curriculum
export const curriculumApi = {
  initiate: (topic: string, duration: string) =>
    api.post('/curriculum/initiate', { topic, duration }),
  followUp: (journeyId: string, answers: Record<string, string>, experienceLevel: string, goals: string[]) =>
    api.post('/curriculum/follow-up', { journeyId, answers, experienceLevel, goals }),
  getModules: (journeyId: string) =>
    api.get(`/curriculum/${journeyId}/modules`),
  getProgress: (journeyId: string) =>
    api.get(`/curriculum/${journeyId}/progress`),
  updateProgress: (journeyId: string, data: { moduleId: string; submoduleId?: string; completionPercentage: number; timeSpent: number }) =>
    api.post(`/curriculum/${journeyId}/progress`, data),
  list: () => api.get('/curriculum'),
};

// Scraping
export const scrapeApi = {
  getStatus: (jobId: string) =>
    api.get(`/scrape/${jobId}/status`),
};

// Quiz
export const quizApi = {
  generate: (moduleId: string, questionCount = 10) =>
    api.post('/quiz/generate', { moduleId, questionCount }),
  submit: (moduleId: string, questions: unknown[], answers: Record<string, string>) =>
    api.post('/quiz/submit', { moduleId, questions, answers }),
  getResults: (id: string) =>
    api.get(`/quiz/${id}/results`),
};

// Certificate
export const certificateApi = {
  generate: (moduleId: string, score: number) =>
    api.post('/certificate/generate', { moduleId, score }),
  get: (id: string) =>
    api.get(`/certificate/${id}`),
  list: () => api.get('/certificate'),
};
