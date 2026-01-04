import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  // In-memory reminder queue (replace with BullMQ or similar in production)
  private reminders: Map<string, NodeJS.Timeout> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Schedule reminder
   */
  async scheduleReminder(reminder: ReminderData): Promise<void> {
    const now = Date.now();
    const scheduledTime = reminder.scheduledFor.getTime();
    const delay = scheduledTime - now;

    if (delay <= 0) {
      // Send immediately if time has passed
      await this.sendReminder(reminder);
      return;
    }

    // Schedule reminder
    const timeoutId = setTimeout(async () => {
      await this.sendReminder(reminder);
      this.reminders.delete(reminder.interviewId + reminder.type);
    }, delay);

    this.reminders.set(reminder.interviewId + reminder.type, timeoutId);
    this.logger.log(
      `Scheduled ${reminder.type} reminder for interview ${reminder.interviewId} at ${reminder.scheduledFor}`,
    );
  }

  /**
   * Cancel reminders for interview
   */
  async cancelReminders(interviewId: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, timeoutId] of this.reminders.entries()) {
      if (key.startsWith(interviewId)) {
        clearTimeout(timeoutId);
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.reminders.delete(key));
    this.logger.log(`Cancelled reminders for interview ${interviewId}`);
  }

  /**
   * Send reminder
   */
  private async sendReminder(data: ReminderData): Promise<void> {
    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id: data.interviewId },
        include: {
          template: true,
          createdBy: true,
        },
      });

      if (!interview || !interview.scheduledAt) {
        this.logger.warn(`Interview ${data.interviewId} not found or not scheduled`);
        return;
      }

      const subject =
        data.type === '24_HOURS'
          ? `Interview Reminder: ${interview.template.title}`
          : `Interview Starting Soon: ${interview.template.title}`;

      const message = this.buildReminderMessage(interview, data.type);

      // TODO: Send email via email service
      // For now, just log
      this.logger.log(`Sending ${data.type} reminder for interview ${data.interviewId}`);
      this.logger.log(`Recipients: ${data.recipients.join(', ')}`);
      this.logger.log(`Subject: ${subject}`);

      // In production, use email service:
      // for (const recipient of data.recipients) {
      //   await this.emailService.send({
      //     to: recipient,
      //     subject,
      //     html: message,
      //   });
      // }
    } catch (error: any) {
      this.logger.error(`Failed to send reminder: ${error.message}`);
    }
  }

  /**
   * Build reminder email message
   */
  private buildReminderMessage(interview: any, type: string): string {
    const scheduledAt = new Date(interview.scheduledAt);
    const timeStr = scheduledAt.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: interview.timezone,
    });

    const joinLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/interview/${interview.joinToken}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Interview Reminder</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is a reminder that your interview for <strong>${interview.template.title}</strong> is scheduled for:</p>
            <p style="font-size: 18px; font-weight: bold; text-align: center; padding: 20px; background-color: white; border-radius: 5px;">
              ${timeStr}
            </p>
            <p style="text-align: center;">
              <a href="${joinLink}" class="button">Join Interview</a>
            </p>
            <p>If you have any questions or need to reschedule, please contact the recruiter.</p>
            <p>Best regards,<br>InterWiz Team</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export interface ReminderData {
  interviewId: string;
  type: '24_HOURS' | '1_HOUR';
  scheduledFor: Date;
  recipients: string[];
}

