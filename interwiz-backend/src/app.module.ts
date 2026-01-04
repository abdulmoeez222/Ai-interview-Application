import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TemplatesModule } from './templates/templates.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { InterviewsModule } from './interviews/interviews.module';
import { AIModule } from './ai/ai.module';
import { SpeechModule } from './speech/speech.module';
import { WebSocketsModule } from './websockets/websockets.module';
import { SchedulingModule } from './scheduling/scheduling.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    TemplatesModule,
    AssessmentsModule,
    InterviewsModule,
    AIModule,
    SpeechModule,
    WebSocketsModule,
    SchedulingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

