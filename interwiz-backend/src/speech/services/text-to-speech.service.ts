import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Readable } from 'stream';
import { TTSOptions, Voice, VoiceSettings } from '../interfaces/speech.interface';

@Injectable()
export class TextToSpeechService {
  private readonly logger = new Logger(TextToSpeechService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  // Pre-configured voices
  private readonly voices = {
    ava_professional: 'EXAVITQu4vr4xnSDxMaL', // Female, professional
    ava_friendly: 'ThT5KcBeYPX3keUQqHPh', // Female, warm
    ava_energetic: '21m00Tcm4TlvDq8ikWAM', // Female, enthusiastic
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ELEVENLABS_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('ELEVENLABS_API_KEY not configured');
    }
  }

  /**
   * Convert text to speech
   * Returns audio buffer
   */
  async textToSpeech(
    text: string,
    voiceId: string = this.voices.ava_professional,
    options?: TTSOptions,
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: options?.model || 'eleven_multilingual_v2',
          voice_settings: {
            stability: options?.stability || 0.5,
            similarity_boost: options?.similarity || 0.75,
            style: options?.style || 0.0,
            use_speaker_boost: true,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error('Text-to-speech failed', error.message);
      throw new Error('Voice synthesis failed');
    }
  }

  /**
   * Streaming text-to-speech
   * For real-time playback
   */
  async streamTextToSpeech(
    text: string,
    voiceId: string = this.voices.ava_professional,
  ): Promise<Readable> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          text,
          model_id: 'eleven_multilingual_v2',
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Streaming TTS failed', error.message);
      throw new Error('Voice streaming failed');
    }
  }

  /**
   * Get all available voices
   */
  async getVoices(): Promise<Voice[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      });

      return response.data.voices || [];
    } catch (error: any) {
      this.logger.error('Failed to get voices', error.message);
      return [];
    }
  }

  /**
   * Get voice by ID with settings
   */
  async getVoiceSettings(voiceId: string): Promise<VoiceSettings> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/voices/${voiceId}/settings`,
        {
          headers: { 'xi-api-key': this.apiKey },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get voice settings', error.message);
      throw new Error('Voice settings unavailable');
    }
  }

  /**
   * Get character/word count for cost estimation
   */
  estimateCost(text: string): { characters: number; estimatedCost: number } {
    const characters = text.length;
    const costPer1000Chars = 0.30; // ElevenLabs pricing (approximate)
    const estimatedCost = (characters / 1000) * costPer1000Chars;

    return { characters, estimatedCost };
  }

  /**
   * Get default voice ID
   */
  getDefaultVoiceId(): string {
    return this.voices.ava_professional;
  }

  /**
   * Get voice ID by name
   */
  getVoiceIdByName(name: string): string | null {
    const voiceMap: Record<string, string> = {
      professional: this.voices.ava_professional,
      friendly: this.voices.ava_friendly,
      energetic: this.voices.ava_energetic,
    };

    return voiceMap[name.toLowerCase()] || null;
  }
}

