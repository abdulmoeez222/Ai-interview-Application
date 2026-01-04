import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  UseGuards,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InterviewSessionManager } from '../services/interview-session.manager';
import { SpeechToTextService } from '../../speech/services/speech-to-text.service';
import { TextToSpeechService } from '../../speech/services/text-to-speech.service';
import { AudioProcessorService } from '../../speech/services/audio-processor.service';
import { InterviewOrchestratorService } from '../../ai/services/interview-orchestrator.service';
import { InterviewsService } from '../../interviews/interviews.service';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import {
  JoinInterviewDto,
  ObserveInterviewDto,
  StartInterviewDto,
  AudioChunkDto,
  ResponseCompleteDto,
  ProctorEventDto,
} from '../dto';
import { ProctorEvent } from '../interfaces/session.interface';

@Injectable()
@WebSocketGateway({
  namespace: 'interview',
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class InterviewGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InterviewGateway.name);

  constructor(
    private sessionManager: InterviewSessionManager,
    private sttService: SpeechToTextService,
    private ttsService: TextToSpeechService,
    private audioProcessor: AudioProcessorService,
    private orchestrator: InterviewOrchestratorService,
    private interviewsService: InterviewsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Handle new client connection
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      const userType = (client.handshake.query.userType as string) || 'candidate';

      this.logger.log(`Client connecting: ${client.id}, type: ${userType}`);

      // Validate connection
      const user = await this.validateConnection(token, userType);

      // Store user info in socket
      client.data.user = user;
      client.data.userType = userType;

      // Send connection success
      client.emit('connected', {
        message: 'Connected successfully',
        userId: user.id,
        userType,
        timestamp: new Date(),
      });
    } catch (error: any) {
      this.logger.error('Connection failed', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnect
   */
  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);

    const sessionId = client.data.sessionId;
    if (sessionId) {
      try {
        await this.sessionManager.removeParticipant(sessionId, client.id);

        // If candidate disconnects during interview, pause it
        if (client.data.userType === 'candidate') {
          await this.handleInterviewInterruption(sessionId, 'disconnect');
        }

        // Close STT session if exists
        const sttSession = client.data.sttSession;
        if (sttSession) {
          this.sttService.closeSession(sttSession.websocket);
        }
      } catch (error: any) {
        this.logger.error('Error during disconnect cleanup', error.message);
      }
    }
  }

  /**
   * Candidate joins interview
   */
  @SubscribeMessage('join-interview')
  async handleJoinInterview(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinInterviewDto,
  ): Promise<void> {
    try {
      // For candidates, token is the interview join token
      const joinToken = client.handshake.auth?.token;
      
      // Find interview by token
      const interview = await this.prisma.interview.findFirst({
        where: {
          OR: [
            { joinToken },
            { inviteToken: joinToken },
          ],
          id: data.interviewId,
        },
        include: {
          template: {
            include: {
              assessments: {
                include: {
                  assessment: true,
                },
              },
            },
          },
        },
      });

      if (!interview) {
        client.emit('error', { message: 'Interview not found or invalid token' });
        return;
      }

      // Check if interview is in correct status
      if (interview.status !== 'ONGOING' && interview.status !== 'SCHEDULED') {
        client.emit('error', { message: 'Interview is not available' });
        return;
      }

      // Create or get existing session
      let session = await this.sessionManager.getSessionByInterviewId(data.interviewId);
      
      if (!session) {
        session = await this.sessionManager.createSession(interview, client.id);
      } else {
        // Update candidate socket ID
        await this.sessionManager.updateSession(session.id, {
          candidateSocketId: client.id,
        });
      }

      // Store session ID in socket
      client.data.sessionId = session.id;

      // Join room for this interview
      client.join(`interview:${data.interviewId}`);

      // Notify recruiters (if watching)
      this.server.to(`interview:${data.interviewId}`).emit('candidate-joined', {
        candidateName: interview.candidateName,
        timestamp: new Date(),
      });

      // Send interview details to candidate
      client.emit('interview-ready', {
        sessionId: session.id,
        template: {
          id: interview.template.id,
          title: interview.template.title,
          totalDuration: interview.template.totalDuration,
        },
        estimatedDuration: interview.template.totalDuration,
        status: interview.status,
      });

      this.logger.log(`Candidate joined interview: ${data.interviewId}`);
    } catch (error: any) {
      this.logger.error('Failed to join interview', error.message);
      client.emit('error', { message: 'Failed to join interview' });
    }
  }

  /**
   * Recruiter observes interview
   */
  @SubscribeMessage('observe-interview')
  @UseGuards(WsJwtGuard)
  async handleObserveInterview(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ObserveInterviewDto,
  ): Promise<void> {
    try {
      // Verify recruiter owns this interview
      const interview = await this.interviewsService.findOne(
        data.interviewId,
        client.data.user.id,
      );

      // Join room
      client.join(`interview:${data.interviewId}`);
      client.data.observingInterviewId = data.interviewId;

      // Get current session state
      const session = await this.sessionManager.getSessionByInterviewId(data.interviewId);

      // Add recruiter to session
      if (session) {
        await this.sessionManager.addRecruiterObserver(session.id, client.id);
      }

      // Send current state to recruiter
      client.emit('observation-started', {
        interview: {
          id: interview.id,
          candidateName: interview.candidateName,
          candidateEmail: interview.candidateEmail,
          status: interview.status,
        },
        session: session || null,
        isLive: session?.isActive || false,
      });

      this.logger.log(`Recruiter observing interview: ${data.interviewId}`);
    } catch (error: any) {
      this.logger.error('Failed to observe interview', error.message);
      client.emit('error', { message: 'Failed to observe interview' });
    }
  }

  /**
   * Start interview
   */
  @SubscribeMessage('start-interview')
  async handleStartInterview(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartInterviewDto,
  ): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(data.sessionId);

      // Start AI interview
      const aiSession = await this.orchestrator.startInterview(session.interviewId);

      // Update session state
      await this.sessionManager.updateSession(data.sessionId, {
        aiSessionId: aiSession.sessionId,
        isActive: true,
        startedAt: new Date(),
      });

      // Initialize STT session
      const sttSession = await this.sttService.createRealtimeSession();
      client.data.sttSession = sttSession;

      // Listen for transcriptions
      this.sttService.onTranscriptionResult(sttSession.websocket, (result) => {
        // Send to candidate
        client.emit('transcription', {
          text: result.text,
          isFinal: result.isFinal,
          confidence: result.confidence,
        });

        // Send to observing recruiters
        this.server.to(`interview:${session.interviewId}`).emit('live-transcript', {
          text: result.text,
          isFinal: result.isFinal,
          timestamp: new Date(),
        });
      });

      // Generate audio for first question
      const questionAudioUrl = await this.generateQuestionAudio(
        aiSession.firstQuestion.text,
        session.interviewId,
      );

      // Send first question to candidate
      client.emit('question', {
        questionId: aiSession.firstQuestion.id,
        text: aiSession.firstQuestion.text,
        audioUrl: questionAudioUrl,
        type: aiSession.firstQuestion.type,
        order: aiSession.firstQuestion.order,
      });

      // Update session with current question
      await this.sessionManager.updateSession(data.sessionId, {
        currentQuestionId: aiSession.firstQuestion.id,
        currentQuestion: aiSession.firstQuestion.text,
        currentQuestionStartTime: Date.now(),
      });

      // Notify observers
      this.server.to(`interview:${session.interviewId}`).emit('interview-started', {
        timestamp: new Date(),
        firstQuestion: aiSession.firstQuestion.text,
      });

      this.logger.log(`Interview started: ${data.sessionId}`);
    } catch (error: any) {
      this.logger.error('Failed to start interview', error.message);
      client.emit('error', { message: 'Failed to start interview' });
    }
  }

  /**
   * Receive audio chunk from candidate
   */
  @SubscribeMessage('audio-chunk')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AudioChunkDto,
  ): Promise<void> {
    try {
      const sttSession = client.data.sttSession;
      if (!sttSession) {
        client.emit('error', { message: 'STT session not initialized' });
        return;
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(data.audioData, 'base64');

      // Send to AssemblyAI
      await this.sttService.sendAudioChunk(sttSession.websocket, audioBuffer);
    } catch (error: any) {
      this.logger.error('Failed to process audio chunk', error.message);
      client.emit('error', { message: 'Failed to process audio chunk' });
    }
  }

  /**
   * Candidate finishes speaking (response complete)
   */
  @SubscribeMessage('response-complete')
  async handleResponseComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ResponseCompleteDto,
  ): Promise<void> {
    try {
      const sessionId = client.data.sessionId;
      if (!sessionId) {
        client.emit('error', { message: 'No active session' });
        return;
      }

      const session = await this.sessionManager.getSession(sessionId);

      if (!session.aiSessionId) {
        client.emit('error', { message: 'AI session not initialized' });
        return;
      }

      // Process response with AI
      const turn = await this.orchestrator.processResponse(
        session.aiSessionId,
        data.transcription,
      );

      // Get current question info from session
      const currentQuestion = await this.getCurrentQuestionFromSession(session);

      // Save response
      if (currentQuestion) {
        await this.interviewsService.saveResponse(session.interviewId, {
          assessmentId: session.currentAssessmentId || '',
          questionId: currentQuestion.id,
          questionText: currentQuestion.text,
          responseText: data.transcription,
          responseAudioUrl: data.audioUrl,
          score: turn.response.score,
          evaluation: turn.response.evaluation,
          timeSpent: session.currentQuestionStartTime
            ? Math.floor((Date.now() - session.currentQuestionStartTime) / 1000)
            : 0,
        });
      }

      // Update progress
      await this.sessionManager.updateProgress(sessionId, turn.progress);

      // Send progress to observers
      this.server.to(`interview:${session.interviewId}`).emit('progress-update', {
        progress: turn.progress,
        score: turn.response.score,
        evaluation: turn.response.evaluation,
        timestamp: new Date(),
      });

      if (turn.isComplete) {
        // Interview complete
        await this.handleInterviewComplete(client, sessionId);
      } else if (turn.nextQuestion) {
        // Send next question
        const questionAudioUrl = await this.generateQuestionAudio(
          turn.nextQuestion.text,
          session.interviewId,
        );

        client.emit('question', {
          questionId: turn.nextQuestion.id,
          text: turn.nextQuestion.text,
          audioUrl: questionAudioUrl,
          type: turn.nextQuestion.type,
          order: turn.nextQuestion.order,
        });

        // Update session state
        await this.sessionManager.updateSession(sessionId, {
          currentQuestionId: turn.nextQuestion.id,
          currentQuestion: turn.nextQuestion.text,
          currentQuestionStartTime: Date.now(),
        });

        // Notify observers
        this.server.to(`interview:${session.interviewId}`).emit('question-asked', {
          questionId: turn.nextQuestion.id,
          text: turn.nextQuestion.text,
          timestamp: new Date(),
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to process response', error.message);
      client.emit('error', { message: 'Failed to process response' });
    }
  }

  /**
   * Proctoring event (face detection, tab switch, etc.)
   */
  @SubscribeMessage('proctor-event')
  async handleProctorEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ProctorEventDto,
  ): Promise<void> {
    try {
      const sessionId = client.data.sessionId;
      if (!sessionId) {
        return;
      }

      const session = await this.sessionManager.getSession(sessionId);

      // Update proctoring data
      await this.interviewsService.updateProctorData(session.interviewId, {
        [data.type]: data.data,
      });

      // Alert recruiter if suspicious
      if (data.severity === 'high') {
        this.server.to(`interview:${session.interviewId}`).emit('proctor-alert', {
          type: data.type,
          message: data.message,
          severity: data.severity,
          timestamp: new Date(),
        });
      }

      // Update trust score
      const interview = await this.prisma.interview.findUnique({
        where: { id: session.interviewId },
        select: { proctorData: true },
      });

      if (interview?.proctorData) {
        const proctorData = interview.proctorData as any;
        const trustScore = this.calculateTrustScore(proctorData);
        await this.sessionManager.updateSession(sessionId, { trustScore });

        // Notify observers of trust score change
        this.server.to(`interview:${session.interviewId}`).emit('trust-score-update', {
          trustScore,
          timestamp: new Date(),
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to process proctor event', error.message);
    }
  }

  /**
   * Heartbeat to keep connection alive
   */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket): void {
    client.emit('heartbeat-ack', { timestamp: Date.now() });
  }

  /**
   * Complete interview
   */
  private async handleInterviewComplete(
    client: Socket,
    sessionId: string,
  ): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(sessionId);

      // Complete in AI orchestrator
      const summary = await this.orchestrator.completeInterview(session.aiSessionId!);

      // Complete interview in database
      await this.interviewsService.complete(session.interviewId);

      // Close STT session
      const sttSession = client.data.sttSession;
      if (sttSession) {
        this.sttService.closeSession(sttSession.websocket);
      }

      // Send completion to candidate
      client.emit('interview-complete', {
        message: 'Interview completed successfully',
        summary: {
          overallScore: summary.overallScore,
          recommendation: summary.recommendation,
        },
        timestamp: new Date(),
      });

      // Notify observers
      this.server.to(`interview:${session.interviewId}`).emit('interview-completed', {
        summary,
        timestamp: new Date(),
      });

      // Mark session as inactive
      await this.sessionManager.updateSession(sessionId, {
        isActive: false,
        completedAt: new Date(),
      });

      this.logger.log(`Interview completed: ${sessionId}`);
    } catch (error: any) {
      this.logger.error('Failed to complete interview', error.message);
      client.emit('error', { message: 'Failed to complete interview' });
    }
  }

  /**
   * Handle interview interruption
   */
  private async handleInterviewInterruption(
    sessionId: string,
    reason: string,
  ): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(sessionId);

      // Notify observers
      this.server.to(`interview:${session.interviewId}`).emit('interview-interrupted', {
        reason,
        timestamp: new Date(),
      });

      // Mark session as paused
      await this.sessionManager.updateSession(sessionId, {
        isActive: false,
        interruptedAt: new Date(),
        interruptionReason: reason,
      });

      this.logger.warn(`Interview interrupted: ${sessionId}, reason: ${reason}`);
    } catch (error: any) {
      this.logger.error('Failed to handle interruption', error.message);
    }
  }

  /**
   * Generate audio for question using TTS
   */
  private async generateQuestionAudio(
    text: string,
    interviewId: string,
  ): Promise<string> {
    try {
      // Get interview to determine voice profile
      const interview = await this.prisma.interview.findUnique({
        where: { id: interviewId },
        include: { template: true },
      });

      // Use default professional voice for now
      const audioBuffer = await this.ttsService.textToSpeech(text);

      // Upload audio
      const audioUrl = await this.audioProcessor.uploadAudio(
        audioBuffer,
        interviewId,
        'question',
      );

      return audioUrl;
    } catch (error: any) {
      this.logger.error('Failed to generate question audio', error.message);
      return ''; // Return empty string if TTS fails
    }
  }

  /**
   * Calculate trust score based on proctoring data
   */
  private calculateTrustScore(proctorData: any): number {
    let score = 100;

    // Penalize multiple faces detected
    const faceDetections = proctorData.faceDetections || [];
    const multipleFaces = faceDetections.filter((fd: any) => fd.facesDetected > 1).length;
    score -= multipleFaces * 5;

    // Penalize tab switches
    score -= (proctorData.tabSwitches || 0) * 3;

    // Penalize fullscreen exits
    score -= (proctorData.fullscreenExits || 0) * 10;

    // Penalize suspicious activity
    score -= (proctorData.suspiciousActivity?.length || 0) * 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Validate connection token
   */
  private async validateConnection(
    token: string,
    userType: string,
  ): Promise<any> {
    if (userType === 'recruiter') {
      // Validate JWT token
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET'),
        });

        return {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      } catch (error) {
        throw new Error('Invalid JWT token');
      }
    } else {
      // For candidates, token is interview join token
      // We'll validate it when they join the interview
      return {
        id: 'candidate',
        type: 'candidate',
      };
    }
  }

  /**
   * Get current question from session
   */
  private async getCurrentQuestionFromSession(session: any): Promise<any> {
    // This would need to query the template to get question details
    // For now, return basic info from session
    if (session.currentQuestionId && session.currentQuestion) {
      return {
        id: session.currentQuestionId,
        text: session.currentQuestion,
      };
    }
    return null;
  }
}

