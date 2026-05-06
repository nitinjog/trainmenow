import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import { quizApi, certificateApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Question, QuizData, QuizResult } from '@/types';

type Phase = 'loading' | 'quiz' | 'results';

export default function QuizPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  async function loadQuiz() {
    setPhase('loading');
    setError('');
    try {
      const { data } = await quizApi.generate(moduleId!);
      setQuiz(data);
      setPhase('quiz');
    } catch {
      setError('Failed to generate quiz. Please try again.');
      setPhase('loading');
    }
  }

  useEffect(() => { loadQuiz(); }, []);

  async function handleSubmit() {
    if (!quiz) return;
    try {
      const { data } = await quizApi.submit(moduleId!, quiz.questions, answers);
      setResults(data);
      setPhase('results');

      if (data.passed) {
        const { data: cert } = await certificateApi.generate(moduleId!, Math.round(data.percentage));
        setCertificateId(cert.id || cert.certificateId);
      }
    } catch {
      setError('Failed to submit quiz.');
    }
  }

  function selectAnswer(questionId: string, answer: string) {
    setAnswers(a => ({ ...a, [questionId]: answer }));
    setShowExplanation(false);
  }

  const question: Question | undefined = quiz?.questions[current];
  const progress = quiz ? ((current + 1) / quiz.questions.length) * 100 : 0;
  const isAnswered = question ? !!answers[question.id] : false;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-secondary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Generating your quiz…</p>
          {error && (
            <div className="mt-4">
              <p className="text-red-500 text-sm mb-2">{error}</p>
              <Button onClick={loadQuiz}>Try Again</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'results' && results) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              {results.passed ? (
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              ) : (
                <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              )}

              <h2 className="text-2xl font-bold mb-1">
                {results.passed ? 'Congratulations!' : 'Not quite yet'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {results.passed
                  ? 'You passed! Your certificate is ready.'
                  : `You scored ${Math.round(results.percentage)}%. You need 70% to pass.`}
              </p>

              <div className="bg-muted rounded-xl p-6 mb-6">
                <div className="text-4xl font-bold text-primary mb-1">{Math.round(results.percentage)}%</div>
                <div className="text-sm text-muted-foreground">{results.score} / {results.totalPoints} points</div>
              </div>

              <div className="space-y-3">
                {results.passed && certificateId && (
                  <Button className="w-full" onClick={() => navigate(`/certificate/${certificateId}`)}>
                    View Certificate
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={() => {
                  setAnswers({});
                  setCurrent(0);
                  loadQuiz();
                }}>
                  {results.passed ? 'Retake Quiz' : 'Try Again'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate(`/learn/${moduleId}`)}>
                  Back to Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/learn/${moduleId}`)} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Course
          </button>
          <span className="text-sm font-medium">{quiz?.title}</span>
          <Badge variant="outline">
            <Timer className="h-3 w-3 mr-1" />
            {current + 1}/{quiz?.questions.length}
          </Badge>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2">
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{question.type.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className="text-xs">{question.points} pt{question.points !== 1 ? 's' : ''}</Badge>
                </div>
                <CardTitle className="text-lg leading-relaxed">{question.question}</CardTitle>
              </CardHeader>
              <CardContent>
                {question.type === 'multiple_choice' || question.type === 'true_false' ? (
                  <div className="space-y-2">
                    {(question.options || (question.type === 'true_false' ? ['True', 'False'] : [])).map(opt => (
                      <button
                        key={opt}
                        onClick={() => selectAnswer(question.id, opt)}
                        className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                          answers[question.id] === opt
                            ? 'bg-primary text-white border-primary'
                            : 'border-input hover:border-primary hover:bg-muted'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className="w-full border rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Type your answer…"
                    value={answers[question.id] || ''}
                    onChange={e => selectAnswer(question.id, e.target.value)}
                  />
                )}

                {isAnswered && showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-muted rounded-lg text-sm"
                  >
                    <span className="font-medium">Explanation: </span>{question.explanation}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => { setCurrent(c => c - 1); setShowExplanation(false); }}
            disabled={current === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>

          {isAnswered && !showExplanation && (
            <Button variant="ghost" size="sm" onClick={() => setShowExplanation(true)}>
              Show hint
            </Button>
          )}

          {current < (quiz?.questions.length || 0) - 1 ? (
            <Button
              onClick={() => { setCurrent(c => c + 1); setShowExplanation(false); }}
              disabled={!isAnswered}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={Object.keys(answers).length < (quiz?.questions.length || 0)}
            >
              Submit Quiz
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center mt-3">{error}</p>}
      </main>
    </div>
  );
}
