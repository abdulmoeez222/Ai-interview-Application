import {
  IsArray,
  IsString,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
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

export class CreateAvailabilityDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one availability slot is required' })
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availabilitySlots: AvailabilitySlotDto[];

  @IsString()
  @IsNotEmpty({ message: 'Timezone is required' })
  timezone: string;
}

