import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class SelectSlotDto {
  @IsDateString({}, { message: 'Valid date string is required' })
  @IsNotEmpty({ message: 'Selected slot is required' })
  selectedSlot: string; // ISO format

  @IsString()
  @IsNotEmpty({ message: 'Timezone is required' })
  timezone: string;
}

export class RescheduleDto {
  @IsDateString({}, { message: 'Valid date string is required' })
  @IsNotEmpty({ message: 'New slot is required' })
  newSlot: string; // ISO format
}

