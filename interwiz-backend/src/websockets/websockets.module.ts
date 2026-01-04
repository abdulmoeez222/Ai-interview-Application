import { Module } from '@nestjs/common';
import { InterviewGateway } from './gateways/interview.gateway';
import { InterviewSessionManager } from './services/interview-session.manager';
import { SpeechModule } from '../speech/speech.module';
import { AIModule } from '../ai/ai.module';
import { InterviewsModule } from '../interviews/interviews.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SpeechModule,
    AIModule,
    InterviewsModule,
    AuthModule,
  ],
  providers: [
    InterviewGateway,
    InterviewSessionManager,
  ],
  exports: [
    InterviewGateway,
    InterviewSessionManager,
  ],
})
export class WebSocketsModule {}

