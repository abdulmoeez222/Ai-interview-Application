'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, User, Calendar, Clock, Award } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { interviewsAPI } from '@/lib/interviews-api';
import { format } from 'date-fns';

export default function InterviewReportPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const { data: report, isLoading } = useQuery({
    queryKey: ['interview-report', interviewId],
    queryFn: () => interviewsAPI.getReport(interviewId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Report not found</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'HIRE':
        return <Badge className="bg-green-600">Recommend Hire</Badge>;
      case 'NO_HIRE':
        return <Badge variant="destructive">Do Not Hire</Badge>;
      case 'MAYBE':
        return <Badge variant="secondary">Maybe</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Interview Report</h1>
          <p className="text-muted-foreground mt-1">
            Detailed analysis and scoring
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{report.interview.candidateName}</CardTitle>
              <CardDescription className="text-base mt-1">
                {report.interview.candidateEmail}
              </CardDescription>
            </div>
            {getRecommendationBadge(report.recommendation)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="font-medium">{report.interview.template?.jobTitle || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="font-medium">
                  {report.interview.completedAt
                    ? format(new Date(report.interview.completedAt), 'MMM dd, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{report.duration} min</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Award className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(report.overallScore)}`}>
                  {Math.round(report.overallScore)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Evaluation */}
      <Card>
        <CardHeader>
          <CardTitle>AI Evaluation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-line">
            {report.aiEvaluation || 'No evaluation available'}
          </p>
        </CardContent>
      </Card>

      {/* Question Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Question-by-Question Analysis</CardTitle>
          <CardDescription>
            Detailed breakdown of each response
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {report.responses && report.responses.length > 0 ? (
            report.responses.map((response, index) => (
              <div key={index}>
                {index > 0 && <Separator className="my-6" />}
                <div className="space-y-4">
                  {/* Question */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">
                        Question {index + 1}
                      </h3>
                      <Badge
                        className={
                          response.score >= 80
                            ? 'bg-green-100 text-green-800'
                            : response.score >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }
                      >
                        {Math.round(response.score)}%
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{response.questionText}</p>
                  </div>

                  {/* Answer */}
                  <div>
                    <h4 className="font-medium mb-2">Candidate's Answer:</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm">{response.responseText}</p>
                    </div>
                    {response.responseAudioUrl && (
                      <audio controls className="mt-2 w-full">
                        <source src={response.responseAudioUrl} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                    )}
                  </div>

                  {/* Feedback */}
                  <div>
                    <h4 className="font-medium mb-2">AI Feedback:</h4>
                    <p className="text-sm text-muted-foreground">{response.feedback}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No responses available yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

