import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InterviewOrchestratorService } from './services/interview-orchestrator.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import { ProcessResponseDto } from './dto';
import { ConversationContext } from './interfaces/interview-state.interface';

@Controller('ai/interview')
export class AIController {
  constructor(
    private orchestrator: InterviewOrchestratorService,
    private conversationManager: ConversationManagerService,
  ) {}

  @Post(':interviewId/start')
  @HttpCode(HttpStatus.CREATED)
  async startInterview(@Param('interviewId') interviewId: string) {
    return this.orchestrator.startInterview(interviewId);
  }

  @Post('sessions/:sessionId/respond')
  @HttpCode(HttpStatus.OK)
  async processResponse(
    @Param('sessionId') sessionId: string,
    @Body() body: ProcessResponseDto,
  ) {
    return this.orchestrator.processResponse(sessionId, body.responseText);
  }

  @Post('sessions/:sessionId/complete')
  @HttpCode(HttpStatus.OK)
  async completeInterview(@Param('sessionId') sessionId: string) {
    return this.orchestrator.completeInterview(sessionId);
  }

  @Get('sessions/:sessionId/context')
  @HttpCode(HttpStatus.OK)
  async getContext(
    @Param('sessionId') sessionId: string,
  ): Promise<ConversationContext> {
    return this.conversationManager.getContext(sessionId);
  }
}

