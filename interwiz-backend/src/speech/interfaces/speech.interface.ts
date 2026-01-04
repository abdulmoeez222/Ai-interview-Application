import { WebSocket } from 'ws';

export interface RealtimeSession {
  token: string;
  websocket: WebSocket;
  sampleRate: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  words: Word[];
  utterances?: Utterance[];
  isFinal: boolean;
}

export interface Word {
  text: string;
  start: number; // milliseconds
  end: number;
  confidence: number;
}

export interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TTSOptions {
  model?: string;
  stability?: number; // 0-1, how consistent voice is
  similarity?: number; // 0-1, how similar to original voice
  style?: number; // 0-1, how expressive
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  settings: {
    stability: number;
    similarity: number;
    style: number;
  };
}

