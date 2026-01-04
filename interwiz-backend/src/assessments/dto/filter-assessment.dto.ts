import {
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AssessmentType, Difficulty } from '@prisma/client';

export class FilterAssessmentDto {
  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsString()
  skill?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}

