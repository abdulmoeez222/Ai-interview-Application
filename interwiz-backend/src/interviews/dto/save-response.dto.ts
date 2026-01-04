import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class SaveResponseDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Assessment ID is required' })
  assessmentId: string;

  @IsString()
  @IsNotEmpty({ message: 'Question ID is required' })
  questionId: string;

  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  questionText: string;

  @IsString()
  @IsNotEmpty({ message: 'Response text is required' })
  responseText: string; // Transcribed response

  @IsString()
  @IsOptional()
  responseAudioUrl?: string; // URL to audio recording

  @IsNumber()
  @Min(0, { message: 'Score must be at least 0' })
  @Max(100, { message: 'Score cannot exceed 100' })
  @IsOptional()
  score?: number; // AI-generated score

  @IsString()
  @IsOptional()
  evaluation?: string; // AI evaluation text

  @IsNumber()
  @Min(0, { message: 'Time spent must be at least 0' })
  @IsNotEmpty({ message: 'Time spent is required' })
  timeSpent: number; // seconds
}

