import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { OpenAIService } from './services/openai.service';
import { QuestionGeneratorService } from './services/question-generator.service';
import { ResponseEvaluatorService } from './services/response-evaluator.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import { InterviewOrchestratorService } from './services/interview-orchestrator.service';
import { SpeechToTextService } from './services/speech-to-text.service';
import { TextToSpeechService } from './services/text-to-speech.service';

@Module({
  imports: [ConfigModule],
  controllers: [AIController],
  providers: [
    OpenAIService,
    QuestionGeneratorService,
    ResponseEvaluatorService,
    ConversationManagerService,
    InterviewOrchestratorService,
    SpeechToTextService,
    TextToSpeechService,
  ],
  exports: [
    OpenAIService,
    InterviewOrchestratorService,
    SpeechToTextService,
    TextToSpeechService,
  ],
})
export class AIModule {}

