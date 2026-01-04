import { Module } from '@nestjs/common';
import { SpeechController } from './speech.controller';
import { SpeechToTextService } from './services/speech-to-text.service';
import { TextToSpeechService } from './services/text-to-speech.service';
import { AudioProcessorService } from './services/audio-processor.service';
import { VoiceManagerService } from './services/voice-manager.service';
import { InterviewAudioGateway } from './gateways/interview-audio.gateway';

@Module({
  controllers: [SpeechController],
  providers: [
    SpeechToTextService,
    TextToSpeechService,
    AudioProcessorService,
    VoiceManagerService,
    InterviewAudioGateway,
  ],
  exports: [
    SpeechToTextService,
    TextToSpeechService,
    AudioProcessorService,
    VoiceManagerService,
  ],
})
export class SpeechModule {}

