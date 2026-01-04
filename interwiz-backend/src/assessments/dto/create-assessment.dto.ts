import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssessmentType, Difficulty } from '@prisma/client';
import { CreateQuestionDto } from './create-question.dto';

export class CreateAssessmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Assessment name is required' })
  @MaxLength(200, { message: 'Name must not exceed 200 characters' })
  name: string;

  @IsEnum(AssessmentType, { message: 'Invalid assessment type' })
  type: AssessmentType;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description: string;

  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 minute' })
  @Max(60, { message: 'Duration cannot exceed 60 minutes' })
  duration: number; // minutes

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @ArrayMinSize(3, { message: 'At least 3 questions are required' })
  questions: CreateQuestionDto[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: 'Maximum 10 skills allowed' })
  @ArrayMinSize(1, { message: 'At least one skill is required' })
  skillsEvaluated: string[];

  @IsEnum(Difficulty, { message: 'Difficulty must be EASY, MEDIUM, or HARD' })
  difficulty: Difficulty;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

