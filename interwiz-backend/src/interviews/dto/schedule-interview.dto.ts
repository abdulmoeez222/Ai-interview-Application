import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class ScheduleInterviewDto {
  @IsDateString({}, { message: 'Valid date string is required' })
  @IsNotEmpty({ message: 'Selected slot is required' })
  selectedSlot: string; // ISO format

  @IsString()
  @IsNotEmpty({ message: 'Timezone is required' })
  timezone: string;
}

