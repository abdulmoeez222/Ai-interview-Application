import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InterviewSession, Progress } from '../interfaces/session.interface';

@Injectable()
export class InterviewSessionManager {
  private readonly logger = new Logger(InterviewSessionManager.name);
  // In-memory storage (replace with Redis in production)
  private sessions: Map<string, InterviewSession> = new Map();

  constructor(private prisma: PrismaService) {
    // Clean up expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 3600000);
  }

  /**
   * Create new interview session
   */
  async createSession(
    interview: any,
    socketId: string,
  ): Promise<InterviewSession> {
    const sessionId = `session:${interview.id}:${Date.now()}`;

    // Get template with assessments
    const template = await this.prisma.template.findUnique({
      where: { id: interview.templateId },
      include: {
        assessments: {
          include: {
            assessment: true,
          },
        },
      },
    });

    const totalQuestions = template?.assessments.reduce((sum, ta) => {
      const questions = (ta.assessment.questions as any[]) || [];
      return sum + questions.length;
    }, 0) || 0;

    const session: InterviewSession = {
      id: sessionId,
      interviewId: interview.id,
      candidateSocketId: socketId,
      recruiterSocketIds: [],
      isActive: false,
      currentQuestionId: null,
      currentQuestion: null,
      currentAssessmentId: null,
      currentQuestionStartTime: null,
      progress: {
        currentAssessment: 0,
        totalAssessments: template?.assessments.length || 0,
        currentQuestion: 0,
        totalQuestions,
      },
      trustScore: 100,
      createdAt: new Date(),
    };

    // Store in memory (24h expiration handled by cleanup)
    this.sessions.set(sessionId, session);

    // Also store by interview ID for lookup
    this.sessions.set(`interview:${interview.id}`, session);

    this.logger.log(`Created session ${sessionId} for interview ${interview.id}`);
    return session;
  }

  /**
   * Get session by session ID
   */
  async getSession(sessionId: string): Promise<InterviewSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  /**
   * Get session by interview ID
   */
  async getSessionByInterviewId(interviewId: string): Promise<InterviewSession | null> {
    return this.sessions.get(`interview:${interviewId}`) || null;
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    updates: Partial<InterviewSession>,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);

    // Also update by interview ID if exists
    const interviewSession = this.sessions.get(`interview:${session.interviewId}`);
    if (interviewSession && interviewSession.id === sessionId) {
      this.sessions.set(`interview:${session.interviewId}`, updated);
    }
  }

  /**
   * Update progress
   */
  async updateProgress(sessionId: string, progress: Progress): Promise<void> {
    await this.updateSession(sessionId, { progress });
  }

  /**
   * Add recruiter observer
   */
  async addRecruiterObserver(sessionId: string, socketId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session.recruiterSocketIds.includes(socketId)) {
      session.recruiterSocketIds.push(socketId);
      await this.updateSession(sessionId, {
        recruiterSocketIds: session.recruiterSocketIds,
      });
    }
  }

  /**
   * Remove participant
   */
  async removeParticipant(sessionId: string, socketId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    const updatedRecruiters = session.recruiterSocketIds.filter(
      (id) => id !== socketId,
    );

    // If candidate disconnects, mark session as inactive
    if (session.candidateSocketId === socketId) {
      await this.updateSession(sessionId, {
        isActive: false,
        candidateSocketId: '', // Mark as disconnected
        recruiterSocketIds: updatedRecruiters,
      });
    } else {
      await this.updateSession(sessionId, {
        recruiterSocketIds: updatedRecruiters,
      });
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    this.sessions.delete(sessionId);
    this.sessions.delete(`interview:${session.interviewId}`);
  }

  /**
   * Clean up expired sessions (older than 24 hours)
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, session] of this.sessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > 86400000) {
        // 24 hours
        expired.push(key);
      }
    }

    expired.forEach((key) => this.sessions.delete(key));
    if (expired.length > 0) {
      this.logger.log(`Cleaned up ${expired.length} expired sessions`);
    }
  }

  /**
   * Get all active sessions for an interview
   */
  async getActiveSessions(interviewId: string): Promise<InterviewSession[]> {
    const sessions: InterviewSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.interviewId === interviewId && session.isActive) {
        sessions.push(session);
      }
    }
    return sessions;
  }
}

