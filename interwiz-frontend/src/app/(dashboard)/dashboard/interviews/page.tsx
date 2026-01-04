'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Calendar, User, FileText, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { interviewsAPI } from '@/lib/interviews-api';
import { Interview } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ONGOING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  REQUESTED: 'Requested',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export default function InterviewsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch interviews
  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: interviewsAPI.getAll,
  });

  // Filter interviews
  const filteredInterviews = interviews?.filter((interview) => {
    const matchesSearch =
      interview.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      interview.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/interview/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Interview link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interviews</h1>
          <p className="text-muted-foreground mt-1">
            Manage and review candidate interviews
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/interviews/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Interview
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by candidate name or email..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="ONGOING">Ongoing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Interviews Table */}
      {filteredInterviews && filteredInterviews.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInterviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{interview.candidateName}</div>
                      <div className="text-sm text-muted-foreground">
                        {interview.candidateEmail}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{interview.template?.title || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[interview.status] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {statusLabels[interview.status] || interview.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {interview.overallScore !== null && interview.overallScore !== undefined ? (
                      <div className="flex items-center space-x-2">
                        <div className="font-semibold">
                          {Math.round(interview.overallScore)}%
                        </div>
                        {interview.recommendation && (
                          <Badge
                            variant={
                              interview.recommendation === 'HIRE'
                                ? 'default'
                                : interview.recommendation === 'NO_HIRE'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {interview.recommendation}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{format(new Date(interview.createdAt), 'MMM dd, yyyy')}</div>
                      <div className="text-muted-foreground">
                        {formatDistanceToNow(new Date(interview.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(interview.status === 'PENDING' || interview.status === 'REQUESTED' || interview.status === 'SCHEDULED') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(interview.joinToken)}
                        >
                          Copy Link
                        </Button>
                      )}
                      {interview.status === 'COMPLETED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/interviews/${interview.id}/report`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Report
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No interviews found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first interview to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => router.push('/dashboard/interviews/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Interview
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

