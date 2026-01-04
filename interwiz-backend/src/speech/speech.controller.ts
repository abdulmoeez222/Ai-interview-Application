import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeechToTextService } from './services/speech-to-text.service';
import { TextToSpeechService } from './services/text-to-speech.service';
import { AudioProcessorService } from './services/audio-processor.service';
import { VoiceManagerService } from './services/voice-manager.service';
import { TextToSpeechDto } from './dto';

@Controller('speech')
export class SpeechController {
  constructor(
    private sttService: SpeechToTextService,
    private ttsService: TextToSpeechService,
    private audioProcessor: AudioProcessorService,
    private voiceManager: VoiceManagerService,
  ) {}

  @Post('text-to-speech')
  @HttpCode(HttpStatus.OK)
  async textToSpeech(@Body() body: TextToSpeechDto): Promise<{ audioUrl: string }> {
    const profile = this.voiceManager.getVoiceProfile(
      body.voiceProfile || 'professional',
    );

    const audioBuffer = await this.ttsService.textToSpeech(
      body.text,
      profile.id,
      profile.settings,
    );

    // Upload to storage
    const audioUrl = await this.audioProcessor.uploadAudio(
      audioBuffer,
      'demo',
      'question',
    );

    return { audioUrl };
  }

  @Post('speech-to-text')
  @UseInterceptors(FileInterceptor('audio'))
  @HttpCode(HttpStatus.OK)
  async speechToText(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ transcription: string; confidence: number }> {
    if (!file) {
      throw new Error('Audio file is required');
    }

    // Normalize audio
    const normalized = await this.audioProcessor.normalizeAudio(file.buffer);

    // Upload to AssemblyAI
    const audioUrl = await this.sttService.uploadAudio(normalized);

    // Transcribe
    const result = await this.sttService.transcribeFile(audioUrl);

    return {
      transcription: result.text,
      confidence: result.confidence,
    };
  }

  @Get('voices')
  @HttpCode(HttpStatus.OK)
  async getVoices() {
    return this.voiceManager.getAllProfiles();
  }

  @Get('estimate-cost')
  @HttpCode(HttpStatus.OK)
  async estimateCost(
    @Query('text') text: string,
  ): Promise<{ characters: number; estimatedCost: number }> {
    if (!text) {
      return { characters: 0, estimatedCost: 0 };
    }
    return this.ttsService.estimateCost(text);
  }
}

