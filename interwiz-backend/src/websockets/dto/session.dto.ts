import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class JoinInterviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Interview ID is required' })
  interviewId: string;
}

export class ObserveInterviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Interview ID is required' })
  interviewId: string;
}

export class StartInterviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Session ID is required' })
  sessionId: string;
}

export class AudioChunkDto {
  @IsString()
  @IsNotEmpty({ message: 'Audio data is required' })
  audioData: string; // base64 encoded
}

export class ResponseCompleteDto {
  @IsString()
  @IsNotEmpty({ message: 'Transcription is required' })
  transcription: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;
}

export class ProctorEventDto {
  @IsString()
  @IsNotEmpty({ message: 'Event type is required' })
  type: 'face-detection' | 'tab-switch' | 'fullscreen-exit' | 'suspicious-activity';

  @IsString()
  @IsNotEmpty({ message: 'Severity is required' })
  severity: 'low' | 'medium' | 'high';

  @IsObject()
  @IsNotEmpty({ message: 'Event data is required' })
  data: any;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  message: string;
}

