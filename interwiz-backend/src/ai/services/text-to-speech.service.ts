import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TextToSpeechService {
  private readonly logger = new Logger(TextToSpeechService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';
  private readonly voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Professional female voice

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ELEVENLABS_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('ELEVENLABS_API_KEY not configured');
    }
  }

  /**
   * Convert text to speech and return audio buffer
   */
  async textToSpeech(text: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      this.logger.log(`Generating speech for: ${text.substring(0, 50)}...`);

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${this.voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
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

      const buffer = Buffer.from(response.data);
      this.logger.log(`Speech generated: ${buffer.length} bytes`);

      return buffer;
    } catch (error: any) {
      this.logger.error('Text-to-speech error:', error.message);
      throw new Error('Failed to generate speech');
    }
  }

  /**
   * Convert text to speech and save to file
   */
  async textToSpeechFile(text: string, outputPath: string): Promise<string> {
    try {
      const audioBuffer = await this.textToSpeech(text);

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(outputPath, audioBuffer);

      this.logger.log(`Audio saved to: ${outputPath}`);
      return outputPath;
    } catch (error: any) {
      this.logger.error('Save audio error:', error.message);
      throw new Error('Failed to save audio file');
    }
  }
}

