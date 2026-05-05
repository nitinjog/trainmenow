import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Award, LogOut } from 'lucide-react';
import { curriculumApi, certificateApi } from '@/services/api';
import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { LearningJourney } from '@/types';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'outline' }> = {
  awaiting_followup: { label: 'Setting up', variant: 'secondary' },
  scraping_queued: { label: 'Preparing content', variant: 'secondary' },
  module_ready: { label: 'Ready', variant: 'success' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useUserStore();

  const { data: journeys = [] } = useQuery({
    queryKey: ['journeys'],
    queryFn: () => curriculumApi.list().then(r => r.data as LearningJourney[]),
  });

  const { data: certs = [] } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => certificateApi.list().then(r => r.data),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-primary">Train Me Now</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hi, {user?.name}</span>
            <Button variant="ghost" size="icon" onClick={clearAuth}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">My Learning</h1>
            <p className="text-muted-foreground">{journeys.length} course{journeys.length !== 1 ? 's' : ''} started</p>
          </div>
          <Button onClick={() => navigate('/onboarding')}>
            <Plus className="h-4 w-4 mr-2" />
            New Course
          </Button>
        </div>

        {journeys.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <BookOpen className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Start your first course</h2>
            <p className="text-muted-foreground mb-6">
              Enter any topic and let AI build a personalized curriculum for you.
            </p>
            <Button size="lg" onClick={() => navigate('/onboarding')}>
              Get Started
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {journeys.map((journey, i) => {
              const statusInfo = STATUS_LABELS[journey.status] || { label: journey.status, variant: 'outline' as const };
              return (
                <motion.div
                  key={journey.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      if (['module_ready', 'in_progress', 'completed'].includes(journey.status)) {
                        navigate(`/learn/${journey.id}`);
                      }
                    }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base leading-snug">{journey.topic}</CardTitle>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Duration: {journey.duration} · Started {formatDate(journey.createdAt)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {certs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Certificates
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {certs.map((cert: any) => (
                <Card key={cert.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/certificate/${cert.id}`)}>
                  <CardContent className="pt-4">
                    <p className="font-medium text-sm">{cert.module?.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(cert.createdAt)} · Score: {cert.score}%</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
