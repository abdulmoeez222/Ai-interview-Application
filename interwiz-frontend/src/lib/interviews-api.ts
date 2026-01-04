import { api } from './api';
import { Interview, CreateInterviewDto } from '@/types';

export interface InterviewReport {
  interview: Interview;
  responses: Array<{
    questionText: string;
    responseText: string;
    responseAudioUrl?: string;
    score: number;
    feedback: string;
  }>;
  overallScore: number;
  recommendation: 'HIRE' | 'NO_HIRE' | 'MAYBE';
  aiEvaluation: string;
  duration: number;
}

export const interviewsAPI = {
  getAll: async (): Promise<Interview[]> => {
    const response = await api.get<Interview[]>('/interviews');
    return response.data;
  },

  getOne: async (id: string): Promise<Interview> => {
    const response = await api.get<Interview>(`/interviews/${id}`);
    return response.data;
  },

  create: async (data: CreateInterviewDto): Promise<Interview> => {
    const response = await api.post<Interview>('/interviews', data);
    return response.data;
  },

  cancel: async (id: string): Promise<void> => {
    await api.delete(`/interviews/${id}`);
  },

  getReport: async (id: string): Promise<InterviewReport> => {
    const response = await api.get<InterviewReport>(`/interviews/${id}/report`);
    return response.data;
  },

  // Public endpoints for candidates
  getPublicInterview: async (token: string): Promise<Interview> => {
    const response = await api.get<Interview>(`/interviews/public/${token}`);
    return response.data;
  },
};

