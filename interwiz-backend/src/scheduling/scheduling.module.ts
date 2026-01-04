import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { OutlookCalendarService } from './services/outlook-calendar.service';
import { ReminderService } from './services/reminder.service';
import { TimezoneService } from './services/timezone.service';

@Module({
  controllers: [SchedulingController],
  providers: [
    SchedulingService,
    GoogleCalendarService,
    OutlookCalendarService,
    ReminderService,
    TimezoneService,
  ],
  exports: [
    SchedulingService,
    TimezoneService,
    ReminderService,
  ],
})
export class SchedulingModule {}

