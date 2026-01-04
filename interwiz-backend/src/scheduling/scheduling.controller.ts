import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { OutlookCalendarService } from './services/outlook-calendar.service';
import { TimezoneService } from './services/timezone.service';
import {
  CreateAvailabilityDto,
  SelectSlotDto,
  RescheduleDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('scheduling')
@UseGuards(JwtAuthGuard)
export class SchedulingController {
  constructor(
    private schedulingService: SchedulingService,
    private googleCalendar: GoogleCalendarService,
    private outlookCalendar: OutlookCalendarService,
    private timezoneService: TimezoneService,
  ) {}

  @Post('interviews/:interviewId/availability')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAvailability(
    @Param('interviewId') interviewId: string,
    @Body() dto: CreateAvailabilityDto,
    @CurrentUser() user: any,
  ) {
    // Verify interview ownership
    const interview = await this.schedulingService.getScheduleByInterviewId(interviewId);
    if (interview.interview.createdBy.id !== user.id) {
      throw new Error('Unauthorized');
    }

    return this.schedulingService.createSchedule(interviewId, dto);
  }

  @Get('schedules/:scheduleId/available-slots')
  @HttpCode(HttpStatus.OK)
  async getAvailableSlots(
    @Param('scheduleId') scheduleId: string,
    @Query('timezone') timezone: string = 'UTC',
  ) {
    return this.schedulingService.getAvailableSlots(scheduleId, timezone);
  }

  @Post('schedules/:scheduleId/select-slot')
  @HttpCode(HttpStatus.OK)
  async selectSlot(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: SelectSlotDto,
  ) {
    return this.schedulingService.selectSlot(scheduleId, dto);
  }

  @Put('schedules/:scheduleId/reschedule')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async reschedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: RescheduleDto,
    @CurrentUser() user: any,
  ) {
    return this.schedulingService.reschedule(scheduleId, dto);
  }

  @Delete('schedules/:scheduleId')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('scheduleId') scheduleId: string,
    @CurrentUser() user: any,
  ) {
    await this.schedulingService.cancel(scheduleId);
  }

  @Get('interviews/:interviewId/schedule')
  @HttpCode(HttpStatus.OK)
  async getSchedule(@Param('interviewId') interviewId: string) {
    return this.schedulingService.getScheduleByInterviewId(interviewId);
  }

  // Calendar integration endpoints
  @Get('calendar/google/auth-url')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async getGoogleAuthUrl(@CurrentUser() user: any) {
    return {
      authUrl: this.googleCalendar.getAuthUrl(user.id),
    };
  }

  @Post('calendar/google/connect')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async connectGoogleCalendar(
    @Body() body: { code: string },
    @CurrentUser() user: any,
  ) {
    const tokens = await this.googleCalendar.getTokens(body.code);
    // TODO: Store tokens in database
    return {
      message: 'Google Calendar connected successfully',
      connected: true,
    };
  }

  @Get('calendar/outlook/auth-url')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async getOutlookAuthUrl(@CurrentUser() user: any) {
    return {
      authUrl: this.outlookCalendar.getAuthUrl(user.id),
    };
  }

  @Post('calendar/outlook/connect')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async connectOutlookCalendar(
    @Body() body: { code: string },
    @CurrentUser() user: any,
  ) {
    const tokens = await this.outlookCalendar.getTokens(body.code);
    // TODO: Store tokens in database
    return {
      message: 'Outlook Calendar connected successfully',
      connected: true,
    };
  }

  @Get('timezones')
  @HttpCode(HttpStatus.OK)
  async getTimezones() {
    return {
      timezones: this.timezoneService.getAllTimezones(),
    };
  }
}

