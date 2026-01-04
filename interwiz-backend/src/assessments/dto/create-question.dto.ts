import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScoringCriteriaDto } from './scoring-criteria.dto';

export enum QuestionType {
  OPEN_ENDED = 'OPEN_ENDED',
  BEHAVIORAL = 'BEHAVIORAL',
  TECHNICAL = 'TECHNICAL',
  SITUATIONAL = 'SITUATIONAL',
  CODING = 'CODING',
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  text: string;

  @IsEnum(QuestionType, { message: 'Invalid question type' })
  type: QuestionType;

  @IsString()
  @IsOptional()
  expectedAnswer?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  followUpPrompts?: string[];

  @ValidateNested()
  @Type(() => ScoringCriteriaDto)
  scoringCriteria: ScoringCriteriaDto;

  @IsNumber()
  @Min(30, { message: 'Time limit must be at least 30 seconds' })
  @IsOptional()
  timeLimit?: number;

  @IsNumber()
  @Min(1, { message: 'Order must be at least 1' })
  order: number;
}

