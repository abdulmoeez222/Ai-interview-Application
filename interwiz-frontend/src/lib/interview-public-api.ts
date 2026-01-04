import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create separate axios instance for public endpoints (no auth)
export const publicApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface StartInterviewResponse {
  sessionId: string;
  currentQuestion: {
    id: string;
    text: string;
    audioUrl: string;
    type: string;
  };
  progress: {
    current: number;
    total: number;
  };
}

export interface SubmitResponseRequest {
  audioBlob: Blob;
  transcription?: string;
}

export interface SubmitResponseResponse {
  evaluation: {
    score: number;
    feedback: string;
  };
  nextQuestion?: {
    id: string;
    text: string;
    audioUrl: string;
    type: string;
  };
  isComplete: boolean;
  progress: {
    current: number;
    total: number;
  };
}

export const interviewPublicAPI = {
  // Get interview by token
  getInterview: async (token: string) => {
    const response = await publicApi.get(`/interviews/public/${token}`);
    return response.data;
  },

  // Start interview
  startInterview: async (interviewId: string): Promise<StartInterviewResponse> => {
    const response = await publicApi.post(`/interviews/${interviewId}/start`);
    return response.data;
  },

  // Submit response
  submitResponse: async (
    interviewId: string,
    data: SubmitResponseRequest
  ): Promise<SubmitResponseResponse> => {
    const formData = new FormData();
    formData.append('audio', data.audioBlob, 'response.webm');
    if (data.transcription) {
      formData.append('transcription', data.transcription);
    }

    const response = await publicApi.post(
      `/interviews/${interviewId}/responses`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Complete interview
  completeInterview: async (interviewId: string) => {
    const response = await publicApi.post(`/interviews/${interviewId}/complete`);
    return response.data;
  },
};

