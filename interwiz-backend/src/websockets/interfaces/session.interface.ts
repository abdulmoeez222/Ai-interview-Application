export interface InterviewSession {
  id: string;
  interviewId: string;
  aiSessionId?: string;
  candidateSocketId: string;
  recruiterSocketIds: string[];
  isActive: boolean;
  currentQuestionId: string | null;
  currentQuestion: string | null;
  currentAssessmentId: string | null;
  currentQuestionStartTime: number | null;
  progress: Progress;
  trustScore: number;
  interruptedAt?: Date;
  interruptionReason?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface Progress {
  currentAssessment: number;
  totalAssessments: number;
  currentQuestion: number;
  totalQuestions: number;
}

export interface ProctorEvent {
  type: 'face-detection' | 'tab-switch' | 'fullscreen-exit' | 'suspicious-activity';
  severity: 'low' | 'medium' | 'high';
  data: any;
  message: string;
  timestamp?: Date;
}

