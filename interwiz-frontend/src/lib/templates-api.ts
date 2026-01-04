import { api } from './api';
import { Template, CreateTemplateDto } from '@/types';

export const templatesAPI = {
  getAll: async (): Promise<Template[]> => {
    const response = await api.get<Template[]>('/templates');
    return response.data;
  },

  getOne: async (id: string): Promise<Template> => {
    const response = await api.get<Template>(`/templates/${id}`);
    return response.data;
  },

  create: async (data: CreateTemplateDto): Promise<Template> => {
    const response = await api.post<Template>('/templates', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateTemplateDto>): Promise<Template> => {
    const response = await api.put<Template>(`/templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },
};

