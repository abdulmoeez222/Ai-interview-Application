import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SpeechToTextService } from '../services/speech-to-text.service';
import { TextToSpeechService } from '../services/text-to-speech.service';
import { VoiceManagerService } from '../services/voice-manager.service';
import { RealtimeSession } from '../interfaces/speech.interface';

@WebSocketGateway({
  namespace: 'interview-audio',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class InterviewAudioGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InterviewAudioGateway.name);
  private sessions = new Map<string, RealtimeSession>();

  constructor(
    private sttService: SpeechToTextService,
    private ttsService: TextToSpeechService,
    private voiceManager: VoiceManagerService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up any sessions associated with this client
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.websocket.readyState === 1) {
        // WebSocket.OPEN
        this.sttService.closeSession(session.websocket);
      }
      this.sessions.delete(sessionId);
    }
  }

  @SubscribeMessage('start-speech-session')
  async handleStartSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; voiceProfile?: string },
  ): Promise<void> {
    try {
      // Create AssemblyAI realtime session
      const realtimeSession = await this.sttService.createRealtimeSession();

      // Store session
      this.sessions.set(data.sessionId, realtimeSession);

      // Listen for transcriptions
      this.sttService.onTranscriptionResult(
        realtimeSession.websocket,
        (result) => {
          // Send transcription back to client
          client.emit('transcription', {
            text: result.text,
            confidence: result.confidence,
            isFinal: result.isFinal,
          });
        },
      );

      client.emit('session-ready', {
        sampleRate: realtimeSession.sampleRate,
        sessionId: data.sessionId,
      });
    } catch (error: any) {
      this.logger.error('Failed to start speech session', error);
      client.emit('error', { message: 'Failed to start speech session' });
    }
  }

  @SubscribeMessage('audio-chunk')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; audioData: string },
  ): Promise<void> {
    try {
      const session = this.sessions.get(data.sessionId);
      if (!session) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(data.audioData, 'base64');

      // Send to AssemblyAI
      await this.sttService.sendAudioChunk(session.websocket, audioBuffer);
    } catch (error: any) {
      this.logger.error('Failed to process audio chunk', error);
      client.emit('error', { message: 'Failed to process audio chunk' });
    }
  }

  @SubscribeMessage('end-speech-session')
  handleEndSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): void {
    try {
      const session = this.sessions.get(data.sessionId);
      if (session) {
        this.sttService.closeSession(session.websocket);
        this.sessions.delete(data.sessionId);
      }

      client.emit('session-ended', { sessionId: data.sessionId });
    } catch (error: any) {
      this.logger.error('Failed to end session', error);
      client.emit('error', { message: 'Failed to end session' });
    }
  }

  @SubscribeMessage('speak-text')
  async handleSpeakText(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string; voiceProfile?: string },
  ): Promise<void> {
    try {
      const profile = this.voiceManager.getVoiceProfile(
        data.voiceProfile || 'professional',
      );

      // Generate speech
      const audioBuffer = await this.ttsService.textToSpeech(
        data.text,
        profile.id,
        profile.settings,
      );

      // Convert to base64 and send
      const base64Audio = audioBuffer.toString('base64');
      client.emit('audio-ready', {
        audioData: base64Audio,
        format: 'wav',
      });
    } catch (error: any) {
      this.logger.error('Failed to generate speech', error);
      client.emit('error', { message: 'Failed to generate speech' });
    }
  }
}

