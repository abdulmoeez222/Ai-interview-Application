import { api } from './api';
import { AuthResponse } from '@/types';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authAPI = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  getProfile: async (): Promise<any> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

