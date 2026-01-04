import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { OutlookCalendarService } from './services/outlook-calendar.service';
import { ReminderService } from './services/reminder.service';
import { TimezoneService } from './services/timezone.service';
import {
  CreateAvailabilityDto,
  SelectSlotDto,
  RescheduleDto,
} from './dto';
import { AvailabilitySlot } from './interfaces/availability.interface';
import { ScheduleStatus, CalendarProvider } from '@prisma/client';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
    private outlookCalendar: OutlookCalendarService,
    private reminderService: ReminderService,
    private timezoneService: TimezoneService,
  ) {}

  /**
   * Create schedule for interview with availability slots
   */
  async createSchedule(
    interviewId: string,
    dto: CreateAvailabilityDto,
  ): Promise<any> {
    // Validate interview exists
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { template: true },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    // Validate timezone
    if (!this.timezoneService.isValidTimezone(dto.timezone)) {
      throw new BadRequestException(`Invalid timezone: ${dto.timezone}`);
    }

    // Validate slots don't overlap
    this.validateSlots(dto.availabilitySlots);

    // Check if schedule already exists
    const existing = await this.prisma.schedule.findUnique({
      where: { interviewId },
    });

    if (existing) {
      // Update existing schedule
      const schedule = await this.prisma.schedule.update({
        where: { interviewId },
        data: {
          availabilitySlots: dto.availabilitySlots as any,
          timezone: dto.timezone,
          status: 'PENDING',
        },
      });

      return schedule;
    }

    // Create new schedule
    const schedule = await this.prisma.schedule.create({
      data: {
        interviewId,
        availabilitySlots: dto.availabilitySlots as any,
        timezone: dto.timezone,
        status: 'PENDING',
      },
      include: {
        interview: {
          select: {
            id: true,
            candidateName: true,
            candidateEmail: true,
          },
        },
      },
    });

    return schedule;
  }

  /**
   * Candidate selects time slot
   */
  async selectSlot(
    scheduleId: string,
    dto: SelectSlotDto,
  ): Promise<any> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        interview: {
          include: {
            template: true,
            createdBy: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Validate timezone
    if (!this.timezoneService.isValidTimezone(dto.timezone)) {
      throw new BadRequestException(`Invalid timezone: ${dto.timezone}`);
    }

    // Parse selected slot
    const selectedSlot = new Date(dto.selectedSlot);

    // Validate selected slot is in availability
    const availabilitySlots = schedule.availabilitySlots as AvailabilitySlot[];
    const isValid = this.isSlotAvailable(selectedSlot, availabilitySlots, schedule.timezone);

    if (!isValid) {
      throw new BadRequestException('Selected slot is not available');
    }

    // Check if slot is in the past
    if (selectedSlot < new Date()) {
      throw new BadRequestException('Cannot select a time slot in the past');
    }

    // Update schedule
    const updated = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        selectedSlot: {
          startTime: selectedSlot.toISOString(),
          endTime: new Date(
            selectedSlot.getTime() +
              (schedule.interview.template.totalDuration || 30) * 60000,
          ).toISOString(),
        },
        candidateTimezone: dto.timezone,
        status: 'CONFIRMED',
      },
    });

    // Update interview status
    await this.prisma.interview.update({
      where: { id: schedule.interviewId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: selectedSlot,
        timezone: dto.timezone,
      },
    });

    // Create calendar event
    try {
      const calendarEvent = await this.createCalendarEvent(
        schedule.interview,
        selectedSlot,
      );

      if (calendarEvent) {
        await this.prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            calendarEventId: calendarEvent.id,
            calendarProvider: calendarEvent.provider as CalendarProvider,
          },
        });
      }
    } catch (error: any) {
      this.logger.warn(`Failed to create calendar event: ${error.message}`);
      // Continue without calendar event
    }

    // Schedule reminders
    await this.scheduleReminders(schedule.interview, selectedSlot);

    return updated;
  }

  /**
   * Get available slots in candidate's timezone
   */
  async getAvailableSlots(
    scheduleId: string,
    candidateTimezone: string,
  ): Promise<AvailabilitySlot[]> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (!this.timezoneService.isValidTimezone(candidateTimezone)) {
      throw new BadRequestException(`Invalid timezone: ${candidateTimezone}`);
    }

    const slots = schedule.availabilitySlots as AvailabilitySlot[];

    // Convert to candidate timezone
    return slots.map((slot) => ({
      startTime: this.timezoneService.convertTimezone(
        new Date(slot.startTime),
        schedule.timezone,
        candidateTimezone,
      ).toISOString(),
      endTime: this.timezoneService.convertTimezone(
        new Date(slot.endTime),
        schedule.timezone,
        candidateTimezone,
      ).toISOString(),
    }));
  }

  /**
   * Reschedule interview
   */
  async reschedule(scheduleId: string, dto: RescheduleDto): Promise<any> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { interview: { include: { createdBy: true } } },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const newSlot = new Date(dto.newSlot);

    // Validate new slot is in the future
    if (newSlot < new Date()) {
      throw new BadRequestException('Cannot reschedule to a time in the past');
    }

    // Update schedule
    const updated = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        selectedSlot: {
          startTime: newSlot.toISOString(),
          endTime: new Date(
            newSlot.getTime() +
              (schedule.interview.template.totalDuration || 30) * 60000,
          ).toISOString(),
        },
        status: 'RESCHEDULED',
      },
    });

    // Update interview
    await this.prisma.interview.update({
      where: { id: schedule.interviewId },
      data: {
        scheduledAt: newSlot,
      },
    });

    // Update calendar event
    if (schedule.calendarEventId) {
      try {
        if (schedule.calendarProvider === 'GOOGLE_CALENDAR') {
          await this.googleCalendar.updateEvent(
            schedule.interview.createdBy.id,
            schedule.calendarEventId,
            {
              start: {
                dateTime: newSlot.toISOString(),
                timeZone: schedule.interview.timezone,
              },
              end: {
                dateTime: new Date(
                  newSlot.getTime() +
                    (schedule.interview.template.totalDuration || 30) * 60000,
                ).toISOString(),
                timeZone: schedule.interview.timezone,
              },
            },
          );
        } else if (schedule.calendarProvider === 'OUTLOOK') {
          await this.outlookCalendar.updateEvent(
            schedule.interview.createdBy.id,
            schedule.calendarEventId,
            {
              start: {
                dateTime: newSlot.toISOString(),
                timeZone: schedule.interview.timezone,
              },
              end: {
                dateTime: new Date(
                  newSlot.getTime() +
                    (schedule.interview.template.totalDuration || 30) * 60000,
                ).toISOString(),
                timeZone: schedule.interview.timezone,
              },
            },
          );
        }
      } catch (error: any) {
        this.logger.warn(`Failed to update calendar event: ${error.message}`);
      }
    }

    // Reschedule reminders
    await this.reminderService.cancelReminders(schedule.interviewId);
    await this.scheduleReminders(schedule.interview, newSlot);

    return updated;
  }

  /**
   * Cancel scheduled interview
   */
  async cancel(scheduleId: string): Promise<void> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { interview: { include: { createdBy: true } } },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Delete calendar event
    if (schedule.calendarEventId) {
      try {
        if (schedule.calendarProvider === 'GOOGLE_CALENDAR') {
          await this.googleCalendar.deleteEvent(
            schedule.interview.createdBy.id,
            schedule.calendarEventId,
          );
        } else if (schedule.calendarProvider === 'OUTLOOK') {
          await this.outlookCalendar.deleteEvent(
            schedule.interview.createdBy.id,
            schedule.calendarEventId,
          );
        }
      } catch (error: any) {
        this.logger.warn(`Failed to delete calendar event: ${error.message}`);
      }
    }

    // Cancel reminders
    await this.reminderService.cancelReminders(schedule.interviewId);

    // Update status
    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: 'CANCELLED' },
    });

    // Update interview status
    await this.prisma.interview.update({
      where: { id: schedule.interviewId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Get schedule by interview ID
   */
  async getScheduleByInterviewId(interviewId: string): Promise<any> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { interviewId },
      include: {
        interview: {
          select: {
            id: true,
            candidateName: true,
            candidateEmail: true,
            status: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  /**
   * Create calendar event
   */
  private async createCalendarEvent(
    interview: any,
    scheduledAt: Date,
  ): Promise<{ id: string; provider: string } | null> {
    const duration = interview.template.totalDuration || 30; // minutes
    const endTime = new Date(scheduledAt.getTime() + duration * 60000);

    const event = {
      summary: `Interview: ${interview.template.title}`,
      description: `Interview with ${interview.candidateName}\n\nPosition: ${interview.template.jobTitle}\n\nJoin link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/interview/${interview.joinToken}`,
      start: {
        dateTime: scheduledAt.toISOString(),
        timeZone: interview.timezone || 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: interview.timezone || 'UTC',
      },
      attendees: [
        { email: interview.createdBy.email },
        { email: interview.candidateEmail },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    // Try Google Calendar first
    try {
      const googleEvent = await this.googleCalendar.createEvent(
        interview.createdBy.id,
        event,
      );
      if (googleEvent) {
        return { id: googleEvent.id, provider: 'GOOGLE_CALENDAR' };
      }
    } catch (error) {
      this.logger.warn('Google Calendar event creation failed');
    }

    // Try Outlook Calendar
    try {
      const outlookEvent = await this.outlookCalendar.createEvent(
        interview.createdBy.id,
        event,
      );
      if (outlookEvent) {
        return { id: outlookEvent.id, provider: 'OUTLOOK' };
      }
    } catch (error) {
      this.logger.warn('Outlook Calendar event creation failed');
    }

    // Return null if both fail (interview can proceed without calendar)
    return null;
  }

  /**
   * Schedule email reminders
   */
  private async scheduleReminders(
    interview: any,
    scheduledAt: Date,
  ): Promise<void> {
    // Reminder 24 hours before
    const reminder24h = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > new Date()) {
      await this.reminderService.scheduleReminder({
        interviewId: interview.id,
        type: '24_HOURS',
        scheduledFor: reminder24h,
        recipients: [interview.candidateEmail, interview.createdBy.email],
      });
    }

    // Reminder 1 hour before
    const reminder1h = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
    if (reminder1h > new Date()) {
      await this.reminderService.scheduleReminder({
        interviewId: interview.id,
        type: '1_HOUR',
        scheduledFor: reminder1h,
        recipients: [interview.candidateEmail, interview.createdBy.email],
      });
    }
  }

  /**
   * Validate availability slots
   */
  private validateSlots(slots: AvailabilitySlot[]): void {
    if (slots.length === 0) {
      throw new BadRequestException('At least one availability slot is required');
    }

    // Check for overlaps
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (this.slotsOverlap(slots[i], slots[j])) {
          throw new BadRequestException('Availability slots cannot overlap');
        }
      }

      // Validate slot times
      const start = new Date(slots[i].startTime);
      const end = new Date(slots[i].endTime);

      if (start >= end) {
        throw new BadRequestException('Start time must be before end time');
      }

      if (start < new Date()) {
        throw new BadRequestException('Cannot create slots in the past');
      }
    }
  }

  /**
   * Check if slots overlap
   */
  private slotsOverlap(slot1: AvailabilitySlot, slot2: AvailabilitySlot): boolean {
    const start1 = new Date(slot1.startTime);
    const end1 = new Date(slot1.endTime);
    const start2 = new Date(slot2.startTime);
    const end2 = new Date(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Check if selected slot is available
   */
  private isSlotAvailable(
    selected: Date,
    availabilitySlots: AvailabilitySlot[],
    timezone: string,
  ): boolean {
    return availabilitySlots.some((slot) => {
      const start = new Date(slot.startTime);
      const end = new Date(slot.endTime);

      // Convert to same timezone for comparison
      const selectedInTz = this.timezoneService.convertTimezone(
        selected,
        'UTC',
        timezone,
      );
      const startInTz = this.timezoneService.convertTimezone(start, 'UTC', timezone);
      const endInTz = this.timezoneService.convertTimezone(end, 'UTC', timezone);

      return selectedInTz >= startInTz && selectedInTz <= endInTz;
    });
  }
}

