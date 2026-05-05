import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Brain, Clock } from 'lucide-react';
import { curriculumApi } from '@/services/api';
import { useLearningStore } from '@/stores/learningStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FollowUpQuestion } from '@/types';

const DURATIONS = ['1 hour', '1 day', '3 days', '1 week', '2 weeks', '1 month'];
const LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: "I'm new to this" },
  { value: 'intermediate', label: 'Intermediate', desc: 'I know the basics' },
  { value: 'advanced', label: 'Advanced', desc: 'I want to go deep' },
];

type Step = 'topic' | 'duration' | 'level' | 'followup' | 'submitting';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { setCurrentJourney } = useLearningStore();

  const [step, setStep] = useState<Step>('topic');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [journeyId, setJourneyId] = useState('');
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState('');

  async function handleTopicDuration() {
    if (!topic.trim() || !duration) return;
    setLoadingQuestions(true);
    setError('');
    try {
      const { data } = await curriculumApi.initiate(topic.trim(), duration);
      setJourneyId(data.journeyId);
      setQuestions(data.questions);
      setStep('followup');
    } catch {
      setError('Failed to generate questions. Please try again.');
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleSubmit() {
    setStep('submitting');
    try {
      await curriculumApi.followUp(journeyId, answers, level, []);
      setCurrentJourney({
        id: journeyId,
        userId: '',
        topic,
        duration,
        experienceLevel: level,
        goals: [],
        status: 'scraping_queued',
        createdAt: new Date().toISOString(),
      });
      navigate(`/learn/${journeyId}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('followup');
    }
  }

  const variants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8 text-white">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-90" />
          <h1 className="text-3xl font-bold">Train Me Now</h1>
          <p className="opacity-80 mt-1">AI-powered personalized learning</p>
        </div>

        <Card>
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {step === 'topic' && (
                <motion.div key="topic" variants={variants} initial="enter" animate="center" exit="exit">
                  <h2 className="text-xl font-semibold mb-2">What do you want to learn?</h2>
                  <p className="text-muted-foreground text-sm mb-6">Be specific — "machine learning for image classification" beats "AI".</p>
                  <Input
                    placeholder="e.g. React hooks, Python for data science, Docker..."
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && topic.trim() && setStep('duration')}
                    className="mb-4"
                    autoFocus
                  />
                  <Button
                    className="w-full"
                    disabled={!topic.trim()}
                    onClick={() => setStep('duration')}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === 'duration' && (
                <motion.div key="duration" variants={variants} initial="enter" animate="center" exit="exit">
                  <button className="flex items-center text-sm text-muted-foreground mb-4 hover:text-foreground" onClick={() => setStep('topic')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </button>
                  <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    How long can you study?
                  </h2>
                  <p className="text-muted-foreground text-sm mb-6">We'll tailor the depth of content accordingly.</p>
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`py-3 rounded-lg border text-sm font-medium transition-colors ${
                          duration === d
                            ? 'bg-primary text-white border-primary'
                            : 'border-input hover:border-primary hover:text-primary'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Your level</p>
                    <div className="grid grid-cols-3 gap-2">
                      {LEVELS.map(l => (
                        <button
                          key={l.value}
                          onClick={() => setLevel(l.value as typeof level)}
                          className={`py-3 px-2 rounded-lg border text-left transition-colors ${
                            level === l.value
                              ? 'bg-primary text-white border-primary'
                              : 'border-input hover:border-primary'
                          }`}
                        >
                          <div className="text-sm font-medium">{l.label}</div>
                          <div className={`text-xs ${level === l.value ? 'text-white/80' : 'text-muted-foreground'}`}>{l.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                  <Button
                    className="w-full"
                    disabled={!duration || loadingQuestions}
                    onClick={handleTopicDuration}
                  >
                    {loadingQuestions ? 'Generating questions...' : <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>}
                  </Button>
                </motion.div>
              )}

              {step === 'followup' && (
                <motion.div key="followup" variants={variants} initial="enter" animate="center" exit="exit">
                  <h2 className="text-xl font-semibold mb-1">A few quick questions</h2>
                  <p className="text-muted-foreground text-sm mb-6">Help us personalize your curriculum.</p>
                  <div className="space-y-5">
                    {questions.map(q => (
                      <div key={q.id}>
                        <label className="text-sm font-medium block mb-2">{q.question}</label>
                        {q.type === 'single_choice' && q.options ? (
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                                className={`py-2 px-3 rounded-lg border text-sm transition-colors text-left ${
                                  answers[q.id] === opt
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-input hover:border-primary'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : q.type === 'scale' ? (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button
                                key={n}
                                onClick={() => setAnswers(a => ({ ...a, [q.id]: String(n) }))}
                                className={`w-10 h-10 rounded-full border text-sm font-medium transition-colors ${
                                  answers[q.id] === String(n)
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-input hover:border-primary'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Input
                            placeholder="Your answer..."
                            value={answers[q.id] || ''}
                            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
                  <Button className="w-full mt-6" onClick={handleSubmit}>
                    Build My Curriculum <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === 'submitting' && (
                <motion.div key="submitting" variants={variants} initial="enter" animate="center" exit="exit" className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-secondary mx-auto mb-4 animate-pulse" />
                  <h2 className="text-xl font-semibold mb-2">Building your curriculum…</h2>
                  <p className="text-muted-foreground text-sm">
                    AI is searching the web and organizing content for <strong>{topic}</strong>.
                    This takes 1–2 minutes.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
