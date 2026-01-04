import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly apiUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || '';
  }

  /**
   * Get authorization URL for OAuth
   */
  getAuthUrl(userId: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('Google Calendar not configured');
    }

    const scopes = ['https://www.googleapis.com/auth/calendar.events'];
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: userId, // Pass user ID in state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange auth code for tokens
   */
  async getTokens(code: string): Promise<any> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to exchange auth code', error.message);
      throw new BadRequestException('Failed to authenticate with Google Calendar');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to refresh token', error.message);
      throw new BadRequestException('Failed to refresh Google Calendar token');
    }
  }

  /**
   * Get user access token
   */
  private async getAccessToken(userId: string): Promise<string> {
    // In production, store tokens in database
    // For now, return from config or throw error
    const integration = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!integration) {
      throw new BadRequestException('User not found');
    }

    // TODO: Store and retrieve tokens from database
    // For now, return empty (will fail gracefully)
    throw new BadRequestException('Google Calendar not connected. Please connect your calendar first.');
  }

  /**
   * Create calendar event
   */
  async createEvent(userId: string, event: any): Promise<any> {
    try {
      const accessToken = await this.getAccessToken(userId);

      const response = await axios.post(
        `${this.apiUrl}/calendars/primary/events`,
        {
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          attendees: event.attendees,
          reminders: event.reminders,
          conferenceData: event.conferenceData, // For Google Meet links
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            sendUpdates: 'all',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to create calendar event', error.message);
      // Don't throw - allow interview to proceed without calendar
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
        `${this.apiUrl}/calendars/primary/events/${eventId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            sendUpdates: 'all',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to update calendar event', error.message);
      return null;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken(userId);

      await axios.delete(
        `${this.apiUrl}/calendars/primary/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            sendUpdates: 'all',
          },
        },
      );
    } catch (error: any) {
      this.logger.error('Failed to delete calendar event', error.message);
      // Don't throw - allow deletion to proceed
    }
  }

  /**
   * Check if user has connected Google Calendar
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

