import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TextToSpeechDto {
  @IsString()
  @IsNotEmpty({ message: 'Text is required' })
  text: string;

  @IsString()
  @IsOptional()
  voiceProfile?: string; // professional, friendly, energetic
}

