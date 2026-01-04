import {
  IsString,
  IsNotEmpty,
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

export class CreateTemplateAssessmentDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Assessment ID is required' })
  assessmentId: string;

  @Min(0, { message: 'Weightage must be between 0 and 100' })
  @Max(100, { message: 'Weightage must be between 0 and 100' })
  weightage: number;

  @Min(1, { message: 'Order must be at least 1' })
  order: number;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(400, { message: 'Description must not exceed 400 characters' })
  description: string;

  @IsEnum(Domain, { message: 'Invalid domain' })
  @IsNotEmpty({ message: 'Domain is required' })
  domain: Domain;

  @IsString()
  @IsNotEmpty({ message: 'Job title is required' })
  @MaxLength(100, { message: 'Job title must not exceed 100 characters' })
  jobTitle: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: 'Job description must not exceed 5000 characters' })
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
  @Type(() => CreateTemplateAssessmentDto)
  @MinLength(1, { message: 'At least one assessment is required' })
  assessments: CreateTemplateAssessmentDto[];
}

