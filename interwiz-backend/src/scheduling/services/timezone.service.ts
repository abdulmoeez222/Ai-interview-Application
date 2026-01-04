import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class TimezoneService {
  /**
   * Convert time from one timezone to another
   */
  convertTimezone(date: Date, fromTz: string, toTz: string): Date {
    try {
      // Use Intl API for timezone conversion
      const fromDate = new Date(date.toLocaleString('en-US', { timeZone: fromTz }));
      const toDate = new Date(date.toLocaleString('en-US', { timeZone: toTz }));
      
      // Calculate offset difference
      const fromOffset = fromDate.getTime() - date.getTime();
      const toOffset = toDate.getTime() - date.getTime();
      const offsetDiff = toOffset - fromOffset;
      
      return new Date(date.getTime() + offsetDiff);
    } catch (error) {
      throw new BadRequestException(`Invalid timezone: ${fromTz} or ${toTz}`);
    }
  }

  /**
   * Get current time in specific timezone
   */
  getCurrentTime(timezone: string): Date {
    try {
      const now = new Date();
      const localTime = now.toLocaleString('en-US', { timeZone: timezone });
      return new Date(localTime);
    } catch (error) {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  /**
   * Format date in specific timezone
   */
  format(
    date: Date,
    timezone: string,
    format: string = 'YYYY-MM-DD HH:mm:ss',
  ): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      const hour = parts.find((p) => p.type === 'hour')?.value;
      const minute = parts.find((p) => p.type === 'minute')?.value;
      const second = parts.find((p) => p.type === 'second')?.value;

      return format
        .replace('YYYY', year || '')
        .replace('MM', month || '')
        .replace('DD', day || '')
        .replace('HH', hour || '')
        .replace('mm', minute || '')
        .replace('ss', second || '');
    } catch (error) {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  /**
   * Get all supported timezones
   */
  getAllTimezones(): string[] {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (error) {
      // Fallback to common timezones
      return [
        'UTC',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
      ];
    }
  }

  /**
   * Validate timezone
   */
  isValidTimezone(timezone: string): boolean {
    try {
      const timezones = this.getAllTimezones();
      return timezones.includes(timezone);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get timezone offset in minutes
   */
  getTimezoneOffset(timezone: string, date: Date = new Date()): number {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return (tzDate.getTime() - utcDate.getTime()) / 60000;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Convert date to ISO string with timezone
   */
  toISOStringWithTimezone(date: Date, timezone: string): string {
    const offset = this.getTimezoneOffset(timezone, date);
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  }
}

