import { ChatMessage } from './chat-message.interface';
import { Template, Assessment } from '@prisma/client';

export interface Question {
  id: string;
  text: string;
  type: string;
  expectedAnswer?: string;
  followUpPrompts?: string[];
  scoringCriteria: {
    rubric: string;
    keyPoints: string[];
    maxScore: number;
    weight: number;
  };
  timeLimit?: number;
  order: number;
}

export interface ConversationContext {
  sessionId: string;
  interviewId: string;
  template: any; // Template with assessments
  currentAssessmentIndex: number;
  currentQuestionIndex: number;
  conversationHistory: ChatMessage[];
  candidateInfo: {
    name: string;
    email: string;
  };
  responses: {
    [questionId: string]: {
      text: string;
      score: number;
      followUpsAsked: number;
      evaluation?: string;
    };
  };
}

export interface InterviewSession {
  sessionId: string;
  interviewId: string;
  openingMessage: string;
  firstQuestion: Question;
  context: ConversationContext;
}

export interface InterviewTurn {
  response: {
    text: string;
    score: number;
    evaluation: string;
  };
  nextQuestion: Question | null;
  isComplete: boolean;
  progress: {
    currentAssessment: number;
    totalAssessments: number;
    currentQuestion: number;
    totalQuestions: number;
  };
}

export interface InterviewSummary {
  interviewId: string;
  overallScore: number;
  scoreBreakdown: Record<string, number>;
  evaluation: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'hire' | 'no-hire' | 'maybe';
  insights: string[];
}

export interface EvaluationResult {
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendation: 'hire' | 'no-hire' | 'maybe';
  reasoning: string;
}

