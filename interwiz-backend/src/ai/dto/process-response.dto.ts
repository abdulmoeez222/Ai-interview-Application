import { IsString, IsNotEmpty } from 'class-validator';

export class ProcessResponseDto {
  @IsString()
  @IsNotEmpty({ message: 'Response text is required' })
  responseText: string;
}

