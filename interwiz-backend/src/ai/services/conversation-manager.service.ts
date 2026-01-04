import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationContext } from '../interfaces/interview-state.interface';

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);
  // In-memory storage (replace with Redis in production)
  private sessionStore: Map<string, ConversationContext> = new Map();

  constructor(private prisma: PrismaService) {
    // Clean up expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 3600000);
  }

  /**
   * Create new interview session
   */
  async createSession(interview: any): Promise<string> {
    const sessionId = `interview:${interview.id}:${Date.now()}`;

    // Load full template with assessments
    const template = await this.prisma.template.findUnique({
      where: { id: interview.templateId },
      include: {
        assessments: {
          include: {
            assessment: {
              select: {
                id: true,
                name: true,
                type: true,
                duration: true,
                questions: true,
                skillsEvaluated: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const context: ConversationContext = {
      sessionId,
      interviewId: interview.id,
      template: template as any,
      currentAssessmentIndex: 0,
      currentQuestionIndex: 0,
      conversationHistory: [],
      candidateInfo: {
        name: interview.candidateName,
        email: interview.candidateEmail,
      },
      responses: {},
    };

    // Store in memory (24h expiration handled by cleanup)
    this.sessionStore.set(sessionId, context);

    this.logger.log(`Created session ${sessionId} for interview ${interview.id}`);
    return sessionId;
  }

  /**
   * Get session context
   */
  async getContext(sessionId: string): Promise<ConversationContext> {
    const context = this.sessionStore.get(sessionId);
    if (!context) {
      throw new NotFoundException('Session not found or expired');
    }
    return context;
  }

  /**
   * Update session context
   */
  async updateContext(context: ConversationContext): Promise<void> {
    this.sessionStore.set(context.sessionId, context);
  }

  /**
   * Add message to conversation history
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    const context = await this.getContext(sessionId);
    context.conversationHistory.push({ role, content });
    await this.updateContext(context);
  }

  /**
   * Get current question from context
   */
  getCurrentQuestion(context: ConversationContext): any {
    if (
      context.currentAssessmentIndex >= context.template.assessments.length
    ) {
      return null; // Interview complete
    }

    const assessment =
      context.template.assessments[context.currentAssessmentIndex];
    const questions = (assessment.assessment.questions as any[]) || [];

    if (context.currentQuestionIndex >= questions.length) {
      return null; // Assessment complete
    }

    return questions[context.currentQuestionIndex];
  }

  /**
   * Move to next question
   */
  async moveToNextQuestion(sessionId: string): Promise<boolean> {
    const context = await this.getContext(sessionId);
    const currentAssessment =
      context.template.assessments[context.currentAssessmentIndex];
    const questions = (currentAssessment.assessment.questions as any[]) || [];

    // Move to next question
    context.currentQuestionIndex++;

    // Check if we've finished current assessment
    if (context.currentQuestionIndex >= questions.length) {
      // Move to next assessment
      context.currentAssessmentIndex++;
      context.currentQuestionIndex = 0;

      // Check if interview is complete
      if (
        context.currentAssessmentIndex >=
        context.template.assessments.length
      ) {
        await this.updateContext(context);
        return true; // Interview complete
      }
    }

    await this.updateContext(context);
    return false; // Not complete
  }

  /**
   * Get interview progress
   */
  getProgress(context: ConversationContext): {
    currentAssessment: number;
    totalAssessments: number;
    currentQuestion: number;
    totalQuestions: number;
  } {
    const currentAssessment =
      context.template.assessments[context.currentAssessmentIndex];
    const questions = (currentAssessment?.assessment.questions as any[]) || [];

    return {
      currentAssessment: context.currentAssessmentIndex + 1,
      totalAssessments: context.template.assessments.length,
      currentQuestion: context.currentQuestionIndex + 1,
      totalQuestions: questions.length,
    };
  }

  /**
   * Clean up expired sessions (older than 24 hours)
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, context] of this.sessionStore.entries()) {
      // Extract timestamp from sessionId (format: interview:ID:timestamp)
      const timestamp = parseInt(sessionId.split(':')[2]);
      if (now - timestamp > 86400000) {
        // 24 hours
        expired.push(sessionId);
      }
    }

    expired.forEach((id) => this.sessionStore.delete(id));
    if (expired.length > 0) {
      this.logger.log(`Cleaned up ${expired.length} expired sessions`);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessionStore.delete(sessionId);
  }
}

