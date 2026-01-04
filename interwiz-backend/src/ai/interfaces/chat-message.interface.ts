export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string; // Default: 'gpt-4-turbo-preview'
  temperature?: number; // 0-2, default: 0.7
  maxTokens?: number;
  stream?: boolean;
}

export interface JSONSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

