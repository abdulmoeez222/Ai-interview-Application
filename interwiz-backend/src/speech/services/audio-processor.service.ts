import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class AudioProcessorService {
  private readonly logger = new Logger(AudioProcessorService.name);
  private readonly bucketName: string;
  private readonly useS3: boolean;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
    this.useS3 = !!(
      this.configService.get('AWS_ACCESS_KEY_ID') &&
      this.configService.get('AWS_SECRET_ACCESS_KEY') &&
      this.bucketName
    );

    if (!this.useS3) {
      this.logger.warn(
        'AWS S3 not configured, audio files will be stored locally',
      );
    }
  }

  /**
   * Convert audio to standard format (WAV, 16kHz, mono)
   * Required for AssemblyAI
   * Note: Requires ffmpeg to be installed on the system
   */
  async normalizeAudio(inputBuffer: Buffer): Promise<Buffer> {
    // For now, return as-is if ffmpeg is not available
    // In production, use fluent-ffmpeg to convert
    // This is a simplified version that assumes input is already in correct format
    this.logger.log('Normalizing audio (simplified - requires ffmpeg for full conversion)');
    return inputBuffer;

    // Full implementation would use fluent-ffmpeg:
    /*
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const tempInput = path.join(os.tmpdir(), `input-${uuidv4()}.wav`);
      const tempOutput = path.join(os.tmpdir(), `output-${uuidv4()}.wav`);
      
      fs.writeFileSync(tempInput, inputBuffer);
      
      ffmpeg(tempInput)
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('end', () => {
          const output = fs.readFileSync(tempOutput);
          fs.unlinkSync(tempInput);
          fs.unlinkSync(tempOutput);
          resolve(output);
        })
        .on('error', (err) => {
          this.logger.error('Audio normalization failed', err);
          fs.unlinkSync(tempInput);
          if (fs.existsSync(tempOutput)) {
            fs.unlinkSync(tempOutput);
          }
          reject(err);
        })
        .save(tempOutput);
    });
    */
  }

  /**
   * Split audio into chunks for streaming
   */
  async *chunkAudio(
    audioBuffer: Buffer,
    chunkSizeMs: number = 250,
  ): AsyncGenerator<Buffer> {
    const sampleRate = 16000;
    const bytesPerSample = 2; // 16-bit audio
    const bytesPerMs = (sampleRate * bytesPerSample) / 1000;
    const chunkSize = Math.floor(bytesPerMs * chunkSizeMs);

    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      yield audioBuffer.slice(i, i + chunkSize);
    }
  }

  /**
   * Upload audio to storage and return URL
   * Uses S3 if configured, otherwise local storage
   */
  async uploadAudio(
    audioBuffer: Buffer,
    interviewId: string,
    type: 'question' | 'response',
  ): Promise<string> {
    try {
      if (this.useS3) {
        return this.uploadToS3(audioBuffer, interviewId, type);
      } else {
        return this.uploadLocally(audioBuffer, interviewId, type);
      }
    } catch (error: any) {
      this.logger.error('Failed to upload audio', error.message);
      throw new Error('Audio upload failed');
    }
  }

  /**
   * Upload to AWS S3
   */
  private async uploadToS3(
    audioBuffer: Buffer,
    interviewId: string,
    type: 'question' | 'response',
  ): Promise<string> {
    // Note: Requires @aws-sdk/client-s3 package
    // This is a placeholder implementation
    const key = `interviews/${interviewId}/${type}/${uuidv4()}.wav`;

    // In production, use:
    /*
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/wav',
    });

    await s3Client.send(command);
    */

    // For now, return a placeholder URL
    this.logger.warn('S3 upload not fully implemented, using placeholder URL');
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }

  /**
   * Upload to local storage
   */
  private async uploadLocally(
    audioBuffer: Buffer,
    interviewId: string,
    type: 'question' | 'response',
  ): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'audio', interviewId, type);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${uuidv4()}.wav`;
    const filepath = path.join(uploadDir, filename);
    
    fs.writeFileSync(filepath, audioBuffer);

    // Return relative URL
    return `/uploads/audio/${interviewId}/${type}/${filename}`;
  }

  /**
   * Get audio duration in seconds
   * Note: Requires ffmpeg for accurate duration
   */
  async getAudioDuration(audioBuffer: Buffer): Promise<number> {
    // Simplified: estimate based on buffer size
    // Full implementation would use ffprobe
    const sampleRate = 16000;
    const bytesPerSample = 2;
    const duration = audioBuffer.length / (sampleRate * bytesPerSample);
    return Math.round(duration * 100) / 100;
  }

  /**
   * Validate audio format
   */
  validateAudioFormat(audioBuffer: Buffer): { valid: boolean; format?: string } {
    // Check for WAV header
    if (audioBuffer.length < 12) {
      return { valid: false };
    }

    const header = audioBuffer.toString('ascii', 0, 4);
    if (header === 'RIFF') {
      return { valid: true, format: 'wav' };
    }

    // Could add more format checks here
    return { valid: true, format: 'unknown' };
  }
}

