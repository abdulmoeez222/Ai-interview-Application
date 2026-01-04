'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, CheckCircle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { templatesAPI } from '@/lib/templates-api';
import { interviewsAPI } from '@/lib/interviews-api';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesAPI.getAll,
  });

  const { data: interviews } = useQuery({
    queryKey: ['interviews'],
    queryFn: interviewsAPI.getAll,
  });

  const activeInterviews = interviews?.filter(
    (i) => i.status === 'PENDING' || i.status === 'REQUESTED' || i.status === 'SCHEDULED' || i.status === 'IN_PROGRESS' || i.status === 'ONGOING'
  ).length || 0;

  const completedInterviews = interviews?.filter(
    (i) => i.status === 'COMPLETED'
  ).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your interviews today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Templates
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {templates?.length === 0 ? 'Create your first template' : 'Interview templates'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Interviews
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeInterviews}</div>
            <p className="text-xs text-muted-foreground">
              {activeInterviews === 0 ? 'No active interviews' : 'In progress or pending'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedInterviews}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-4">
            <Button onClick={() => router.push('/dashboard/templates/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/interviews/new')}
              disabled={!templates?.length}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Interview
            </Button>
          </div>
          {!templates?.length && (
            <p className="text-sm text-muted-foreground">
              Create a template first before starting interviews
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

