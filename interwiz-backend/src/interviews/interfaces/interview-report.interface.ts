import { ScoreBreakdown, ProctorData } from './interview.interface';

export interface InterviewReport {
  interview: {
    id: string;
    candidateName: string;
    candidateEmail: string;
    status: string;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    duration: number | null;
  };
  scores: {
    overallScore: number | null;
    scoreBreakdown: ScoreBreakdown;
    recommendation: string | null;
    trustScore: number | null;
  };
  template: {
    id: string;
    title: string;
    domain: string;
  };
  responses: Array<{
    assessmentId: string;
    assessmentName: string;
    questionId: string;
    questionText: string;
    responseText: string;
    score: number | null;
    evaluation: string | null;
    timeSpent: number;
  }>;
  proctoring: {
    summary: ProctorData;
    trustScore: number | null;
  };
  media: {
    recordingUrl: string | null;
    transcriptUrl: string | null;
  };
  insights: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  createdAt: Date;
}

