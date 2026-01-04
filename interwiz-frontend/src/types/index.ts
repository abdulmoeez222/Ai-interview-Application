export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  role: 'RECRUITER' | 'ADMIN';
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  jobTitle: string;
  totalDuration: number;
  assessments: TemplateAssessment[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateAssessment {
  assessmentId: string;
  assessment: Assessment;
  weightage: number;
  order: number;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'BEHAVIORAL' | 'TECHNICAL' | 'SITUATIONAL';
  questions: Question[];
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  text: string;
  type: 'BEHAVIORAL' | 'TECHNICAL' | 'SITUATIONAL';
  order: number;
  scoringCriteria: ScoringCriteria;
}

export interface ScoringCriteria {
  rubric: string;
  keyPoints: string[];
  maxScore: number;
}

export interface Interview {
  id: string;
  candidateEmail: string;
  candidateName: string;
  templateId: string;
  template?: Template;
  status: 'REQUESTED' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'IN_PROGRESS';
  joinToken: string;
  inviteToken?: string;
  currentQuestionIndex: number;
  responses?: InterviewResponse[];
  overallScore?: number;
  aiEvaluation?: string;
  recommendation?: 'HIRE' | 'NO_HIRE' | 'MAYBE';
  recordingUrl?: string;
  transcriptUrl?: string;
  scheduledAt?: string;
  timezone?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewResponse {
  questionId: string;
  questionText: string;
  responseText: string;
  responseAudioUrl?: string;
  score: number;
  evaluation: string;
  timeSpent: number;
  timestamp: string;
}

export interface CreateTemplateDto {
  title: string;
  description: string;
  jobTitle: string;
  domain?: 'ENGINEERING' | 'SALES' | 'MARKETING' | 'CUSTOMER_SUPPORT' | 'PRODUCT' | 'DESIGN' | 'DATA_SCIENCE' | 'OTHER';
  jobDescription?: string;
  jobDescriptionUrl?: string;
  type?: 'SCREENING' | 'IN_DEPTH';
  tags?: string[];
  assessments: Array<{
    assessmentId: string;
    weightage: number;
    order: number;
  }>;
}

export interface CreateInterviewDto {
  candidateEmail: string;
  candidateName: string;
  templateId: string;
  scheduledAt?: string;
  timezone?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InterviewSession {
  sessionId: string;
  currentQuestion: Question;
  progress: {
    current: number;
    total: number;
  };
}

export interface QuestionAudio {
  id: string;
  text: string;
  audioUrl: string;
  type: string;
}

