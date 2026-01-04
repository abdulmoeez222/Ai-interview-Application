import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class OutlookCalendarService {
  private readonly logger = new Logger(OutlookCalendarService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly apiUrl = 'https://graph.microsoft.com/v1.0';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('OUTLOOK_REDIRECT_URI') || '';
  }

  /**
   * Get authorization URL for OAuth
   */
  getAuthUrl(userId: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('Outlook Calendar not configured');
    }

    const scopes = ['Calendars.ReadWrite', 'offline_access'];
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      response_mode: 'query',
      state: userId,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange auth code for tokens
   */
  async getTokens(code: string): Promise<any> {
    try {
      const response = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to exchange auth code', error.message);
      throw new BadRequestException('Failed to authenticate with Outlook Calendar');
    }
  }

  /**
   * Get user access token
   */
  private async getAccessToken(userId: string): Promise<string> {
    // TODO: Store and retrieve tokens from database
    throw new BadRequestException('Outlook Calendar not connected. Please connect your calendar first.');
  }

  /**
   * Create calendar event
   */
  async createEvent(userId: string, event: any): Promise<any> {
    try {
      const accessToken = await this.getAccessToken(userId);

      const response = await axios.post(
        `${this.apiUrl}/me/events`,
        {
          subject: event.summary,
          body: {
            contentType: 'HTML',
            content: event.description,
          },
          start: {
            dateTime: event.start.dateTime,
            timeZone: event.start.timeZone,
          },
          end: {
            dateTime: event.end.dateTime,
            timeZone: event.end.timeZone,
          },
          attendees: event.attendees?.map((a: any) => ({
            emailAddress: { address: a.email },
            type: 'required',
          })),
          isReminderOn: true,
          reminderMinutesBeforeStart: 60,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to create Outlook event', error.message);
      return null;
    }
  }

  /**
   * Update calendar event
   */
  async updateEvent(userId: string, eventId: string, updates: any): Promise<any> {
    try {
      const accessToken = await this.getAccessToken(userId);

      const response = await axios.patch(
        `${this.apiUrl}/me/events/${eventId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to update Outlook event', error.message);
      return null;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken(userId);

      await axios.delete(`${this.apiUrl}/me/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to delete Outlook event', error.message);
    }
  }

  /**
   * Check if user has connected Outlook Calendar
   */
  async isConnected(userId: string): Promise<boolean> {
    try {
      await this.getAccessToken(userId);
      return true;
    } catch {
      return false;
    }
  }
}

