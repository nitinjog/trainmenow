import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, Clock, ExternalLink, Loader2, PenLine } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { curriculumApi } from '@/services/api';
import { useLearningStore } from '@/stores/learningStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { TrainingModule, SubModule } from '@/types';

export default function LearnPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { notes, updateNote, updateProgress, progress } = useLearningStore();
  const [activeSubmodule, setActiveSubmodule] = useState<SubModule | null>(null);
  const [note, setNote] = useState('');

  const { data: modules, isLoading } = useQuery({
    queryKey: ['modules', moduleId],
    queryFn: () => curriculumApi.getModules(moduleId!).then(r => r.data as TrainingModule[]),
    refetchInterval: (query) => {
      const d = query.state.data as TrainingModule[] | undefined;
      return !d || d.length === 0 ? 5000 : false;
    },
  });

  const module = modules?.[0];
  const submodules: SubModule[] = module?.content?.modules || [];
  const overallProgress = submodules.length > 0
    ? submodules.reduce((sum, sm) => sum + (progress[`${module?.id}-${sm.id}`] || 0), 0) / submodules.length
    : 0;

  function handleSelectSubmodule(sm: SubModule) {
    setActiveSubmodule(sm);
    setNote(notes[sm.id] || '');
    const key = `${module?.id}-${sm.id}`;
    updateProgress(key, Math.max(progress[key] || 0, 50));
  }

  function handleMarkComplete() {
    if (!activeSubmodule || !module) return;
    const key = `${module.id}-${activeSubmodule.id}`;
    updateProgress(key, 100);
    curriculumApi.updateProgress(moduleId!, {
      moduleId: module.id,
      submoduleId: activeSubmodule.id,
      completionPercentage: 100,
      timeSpent: activeSubmodule.duration,
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your course…</p>
        </div>
      </div>
    );
  }

  if (!module || submodules.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-secondary mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2">Your curriculum is being prepared</h2>
          <p className="text-muted-foreground text-sm mb-4">
            AI is researching and organizing content. This usually takes 1–3 minutes.
          </p>
          <div className="text-xs text-muted-foreground">
            Checking for updates every 5 seconds…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            ← Dashboard
          </button>
          <span className="font-semibold text-sm truncate max-w-xs">{module.title}</span>
          <Button size="sm" onClick={() => navigate(`/quiz/${module.id}`)}>
            Take Quiz
          </Button>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <div className="flex items-center gap-2">
            <Progress value={overallProgress} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{Math.round(overallProgress)}%</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0">
          <div className="sticky top-24">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Modules</h3>
            <div className="space-y-1">
              {submodules.map((sm, i) => {
                const pct = progress[`${module.id}-${sm.id}`] || 0;
                return (
                  <button
                    key={sm.id}
                    onClick={() => handleSelectSubmodule(sm)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                      activeSubmodule?.id === sm.id
                        ? 'bg-primary text-white'
                        : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{i + 1}. {sm.title}</span>
                      {pct >= 100 && <span className="text-xs">✓</span>}
                    </div>
                    <div className="flex items-center gap-1 opacity-70">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">{formatDuration(sm.duration)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {!activeSubmodule ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-2xl">{module.title}</CardTitle>
                  <p className="text-muted-foreground">{module.description}</p>
                </CardHeader>
                <CardContent>
                  <h3 className="font-semibold mb-3">Learning Objectives</h3>
                  <ul className="space-y-2">
                    {module.content.objectives?.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <div className="grid md:grid-cols-2 gap-3">
                {submodules.map((sm, i) => (
                  <Card key={sm.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSelectSubmodule(sm)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{i + 1}. {sm.title}</h4>
                        <Badge variant="outline" className="text-xs">{formatDuration(sm.duration)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{sm.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{activeSubmodule.title}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" /> {formatDuration(activeSubmodule.duration)}
                  </p>
                </div>
                <Button onClick={handleMarkComplete} variant="outline" size="sm">
                  Mark Complete ✓
                </Button>
              </div>

              {/* Content */}
              <Card className="mb-4">
                <CardContent className="pt-6 prose prose-sm max-w-none">
                  <ReactMarkdown>{activeSubmodule.content}</ReactMarkdown>
                </CardContent>
              </Card>

              {/* Exercises */}
              {activeSubmodule.exercises?.length > 0 && (
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" /> Practice Exercises
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {activeSubmodule.exercises.map((ex, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="font-bold text-primary">{i + 1}.</span> {ex}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Resources */}
              {activeSubmodule.resources?.length > 0 && (
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-primary" /> Resources
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {activeSubmodule.resources.map((r, i) => (
                        <li key={i}>
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {r.title}
                            <span className="text-muted-foreground text-xs">({r.source})</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-primary" /> My Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full text-sm border rounded-md p-3 min-h-[120px] resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Jot down anything important…"
                    value={note}
                    onChange={e => {
                      setNote(e.target.value);
                      updateNote(activeSubmodule.id, e.target.value);
                    }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
