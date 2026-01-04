import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WebSocket } from 'ws';
import {
  RealtimeSession,
  TranscriptionResult,
} from '../interfaces/speech.interface';

@Injectable()
export class SpeechToTextService {
  private readonly logger = new Logger(SpeechToTextService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.assemblyai.com/v2';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ASSEMBLYAI_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('ASSEMBLYAI_API_KEY not configured');
    }
  }

  /**
   * Real-time transcription using WebSocket
   * Used during live interviews
   */
  async createRealtimeSession(): Promise<RealtimeSession> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      // Get temporary token for WebSocket connection
      const response = await axios.post(
        `${this.baseUrl}/realtime/token`,
        { expires_in: 3600 }, // 1 hour
        {
          headers: { authorization: this.apiKey },
        },
      );

      const token = response.data.token;
      const ws = new WebSocket(
        `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`,
      );

      return {
        token,
        websocket: ws,
        sampleRate: 16000,
      };
    } catch (error: any) {
      this.logger.error('Failed to create realtime session', error.message);
      throw new Error('Speech-to-text service unavailable');
    }
  }

  /**
   * Send audio chunk to AssemblyAI for transcription
   */
  async sendAudioChunk(ws: WebSocket, audioChunk: Buffer): Promise<void> {
    if (ws.readyState === WebSocket.OPEN) {
      // Convert to base64 and send
      const base64Audio = audioChunk.toString('base64');
      ws.send(JSON.stringify({ audio_data: base64Audio }));
    } else {
      this.logger.warn('WebSocket not open, cannot send audio chunk');
    }
  }

  /**
   * Listen for transcription results
   */
  onTranscriptionResult(
    ws: WebSocket,
    callback: (result: TranscriptionResult) => void,
  ): void {
    ws.on('message', (data: Buffer) => {
      try {
        const result = JSON.parse(data.toString());

        if (result.message_type === 'FinalTranscript') {
          callback({
            text: result.text,
            confidence: result.confidence || 0.9,
            words: result.words || [],
            isFinal: true,
          });
        } else if (result.message_type === 'PartialTranscript') {
          callback({
            text: result.text,
            confidence: result.confidence || 0.7,
            words: [],
            isFinal: false,
          });
        }
      } catch (error) {
        this.logger.error('Failed to parse transcription result', error);
      }
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error', error);
    });

    ws.on('close', () => {
      this.logger.log('WebSocket connection closed');
    });
  }

  /**
   * Transcribe pre-recorded audio file
   * Used for async transcription or stored recordings
   */
  async transcribeFile(audioUrl: string): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      // Submit audio file for transcription
      const submitResponse = await axios.post(
        `${this.baseUrl}/transcript`,
        {
          audio_url: audioUrl,
          language_code: 'en',
          punctuate: true,
          format_text: true,
          speaker_labels: true, // Detect multiple speakers
        },
        {
          headers: { authorization: this.apiKey },
        },
      );

      const transcriptId = submitResponse.data.id;

      // Poll for completion
      const transcript = await this.pollTranscription(transcriptId);

      return {
        text: transcript.text || '',
        confidence: transcript.confidence || 0.9,
        words: transcript.words || [],
        utterances: transcript.utterances || [],
        isFinal: true,
      };
    } catch (error: any) {
      this.logger.error('Failed to transcribe file', error.message);
      throw new Error('Transcription failed');
    }
  }

  /**
   * Poll transcription status until complete
   */
  private async pollTranscription(
    transcriptId: string,
    maxAttempts = 60,
  ): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/transcript/${transcriptId}`,
          {
            headers: { authorization: this.apiKey },
          },
        );

        const status = response.data.status;

        if (status === 'completed') {
          return response.data;
        } else if (status === 'error') {
          throw new Error('Transcription failed');
        }

        // Wait 1 second before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (i === maxAttempts - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Transcription timeout');
  }

  /**
   * Upload audio file to AssemblyAI for transcription
   */
  async uploadAudio(audioBuffer: Buffer): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/upload`,
        audioBuffer,
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/octet-stream',
          },
        },
      );

      return response.data.upload_url;
    } catch (error: any) {
      this.logger.error('Failed to upload audio', error.message);
      throw new Error('Audio upload failed');
    }
  }

  /**
   * Close realtime session
   */
  closeSession(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ terminate_session: true }));
      } catch (error) {
        this.logger.error('Error sending terminate message', error);
      }
    }
    ws.close();
  }
}

