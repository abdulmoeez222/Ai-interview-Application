import {
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';

export class ScoringCriteriaDto {
  @IsString()
  @IsNotEmpty({ message: 'Rubric is required' })
  rubric: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'At least 2 key points are required' })
  @IsString({ each: true })
  keyPoints: string[];

  @IsNumber()
  @Min(0, { message: 'Max score must be at least 0' })
  @Max(100, { message: 'Max score cannot exceed 100' })
  maxScore: number;

  @IsNumber()
  @Min(0, { message: 'Weight must be at least 0' })
  @Max(1, { message: 'Weight cannot exceed 1' })
  weight: number;
}

