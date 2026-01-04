import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
   * Transcribe audio file to text
   */
  async transcribeAudio(audioPath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      this.logger.log(`Transcribing audio: ${audioPath}`);

      // Upload audio file
      const uploadResponse = await axios.post(
        `${this.baseUrl}/upload`,
        require('fs').readFileSync(audioPath),
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/octet-stream',
          },
        },
      );

      const audioUrl = uploadResponse.data.upload_url;

      // Start transcription
      const transcriptResponse = await axios.post(
        `${this.baseUrl}/transcript`,
        {
          audio_url: audioUrl,
          language_code: 'en',
        },
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/json',
          },
        },
      );

      const transcriptId = transcriptResponse.data.id;

      // Poll for completion
      let transcript: any;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max

      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `${this.baseUrl}/transcript/${transcriptId}`,
          {
            headers: { authorization: this.apiKey },
          },
        );

        transcript = statusResponse.data;

        if (transcript.status === 'completed') {
          break;
        }

        if (transcript.status === 'error') {
          throw new Error(`Transcription failed: ${transcript.error}`);
        }

        // Wait 5 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      }

      if (transcript.status !== 'completed') {
        throw new Error('Transcription timeout');
      }

      this.logger.log(`Transcription complete: ${transcript.text?.substring(0, 50)}...`);
      return transcript.text || '';
    } catch (error: any) {
      this.logger.error('Transcription error:', error.message);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Transcribe audio buffer
   */
  async transcribeBuffer(audioBuffer: Buffer): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      // Upload audio buffer
      const uploadResponse = await axios.post(
        `${this.baseUrl}/upload`,
        audioBuffer,
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/octet-stream',
          },
        },
      );

      const audioUrl = uploadResponse.data.upload_url;

      // Start transcription
      const transcriptResponse = await axios.post(
        `${this.baseUrl}/transcript`,
        {
          audio_url: audioUrl,
          language_code: 'en',
        },
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/json',
          },
        },
      );

      const transcriptId = transcriptResponse.data.id;

      // Poll for completion
      let transcript: any;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `${this.baseUrl}/transcript/${transcriptId}`,
          {
            headers: { authorization: this.apiKey },
          },
        );

        transcript = statusResponse.data;

        if (transcript.status === 'completed') {
          break;
        }

        if (transcript.status === 'error') {
          throw new Error(`Transcription failed: ${transcript.error}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      }

      if (transcript.status !== 'completed') {
        throw new Error('Transcription timeout');
      }

      return transcript.text || '';
    } catch (error: any) {
      this.logger.error('Buffer transcription error:', error.message);
      throw new Error('Failed to transcribe audio buffer');
    }
  }
}

