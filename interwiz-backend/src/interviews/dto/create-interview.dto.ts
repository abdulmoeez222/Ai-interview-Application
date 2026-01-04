import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilitySlotDto {
  @IsString()
  @IsNotEmpty({ message: 'Start time is required' })
  startTime: string; // ISO format

  @IsString()
  @IsNotEmpty({ message: 'End time is required' })
  endTime: string; // ISO format
}

export class CreateInterviewDto {
  @IsEmail({}, { message: 'Valid email is required' })
  candidateEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Candidate name is required' })
  candidateName: string;

  @IsString()
  @IsOptional()
  candidatePhone?: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Template ID is required' })
  templateId: string;

  @IsString()
  @IsOptional()
  timezone?: string; // Default to user's timezone

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availabilitySlots?: AvailabilitySlotDto[]; // For scheduling

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

