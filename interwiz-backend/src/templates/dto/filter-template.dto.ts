import {
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Domain, TemplateType } from '@prisma/client';

export class FilterTemplateDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsIn([6, 12, 24, 48, 100])
  @Type(() => Number)
  @IsOptional()
  limit?: number = 6;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(TemplateType)
  @IsOptional()
  type?: TemplateType;

  @IsEnum(Domain)
  @IsOptional()
  domain?: Domain;

  @IsString()
  @IsOptional()
  createdBy?: string; // 'all' or userId

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsIn(['latest', 'oldest', 'duration'])
  @IsOptional()
  sortBy?: 'latest' | 'oldest' | 'duration';

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isPublic?: boolean;
}

