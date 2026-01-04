import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ValidateNested,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Domain, TemplateType } from '@prisma/client';

export class UpdateTemplateAssessmentDto {
  @IsUUID()
  @IsOptional()
  assessmentId?: string;

  @Min(0, { message: 'Weightage must be between 0 and 100' })
  @Max(100, { message: 'Weightage must be between 0 and 100' })
  @IsOptional()
  weightage?: number;

  @Min(1, { message: 'Order must be at least 1' })
  @IsOptional()
  order?: number;
}

export class UpdateTemplateDto {
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(400, { message: 'Description must not exceed 400 characters' })
  @IsOptional()
  description?: string;

  @IsEnum(Domain, { message: 'Invalid domain' })
  @IsOptional()
  domain?: Domain;

  @IsString()
  @MaxLength(100, { message: 'Job title must not exceed 100 characters' })
  @IsOptional()
  jobTitle?: string;

  @IsString()
  @MaxLength(5000, { message: 'Job description must not exceed 5000 characters' })
  @IsOptional()
  jobDescription?: string;

  @IsUrl({}, { message: 'Job description URL must be a valid URL' })
  @IsOptional()
  jobDescriptionUrl?: string;

  @IsEnum(TemplateType, { message: 'Type must be SCREENING or IN_DEPTH' })
  @IsOptional()
  type?: TemplateType;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3, { message: 'Maximum 3 tags allowed' })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateAssessmentDto)
  @IsOptional()
  assessments?: UpdateTemplateAssessmentDto[];

  @IsOptional()
  isPublic?: boolean;
}

