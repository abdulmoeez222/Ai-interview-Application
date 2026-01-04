import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { QuestionGeneratorService } from './question-generator.service';
import { ResponseEvaluatorService } from './response-evaluator.service';
import { ConversationManagerService } from './conversation-manager.service';
import {
  InterviewSession,
  InterviewTurn,
  InterviewSummary,
  Question,
  ConversationContext,
} from '../interfaces/interview-state.interface';

@Injectable()
export class InterviewOrchestratorService {
  private readonly logger = new Logger(InterviewOrchestratorService.name);

  constructor(
    private prisma: PrismaService,
    private openaiService: OpenAIService,
    private questionGenerator: QuestionGeneratorService,
    private responseEvaluator: ResponseEvaluatorService,
    private conversationManager: ConversationManagerService,
  ) {}

  /**
   * Start interview session
   */
  async startInterview(interviewId: string): Promise<InterviewSession> {
    // Load interview
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        template: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status !== 'ONGOING') {
      throw new BadRequestException(
        'Interview must be in ONGOING status to start AI session',
      );
    }

    // Create session
    const sessionId = await this.conversationManager.createSession(interview);

    // Get context
    const context = await this.conversationManager.getContext(sessionId);

    // Generate opening message
    const openingMessage =
      await this.questionGenerator.generateOpeningMessage(
        interview.candidateName,
        interview.template.jobTitle,
      );

    // Add opening message to history
    await this.conversationManager.addMessage(
      sessionId,
      'assistant',
      openingMessage,
    );

    // Get first question
    const firstQuestion = this.conversationManager.getCurrentQuestion(context);

    if (!firstQuestion) {
      throw new BadRequestException('No questions found in template');
    }

    // Adapt question to context
    const adaptedQuestion = await this.questionGenerator.adaptQuestionToContext(
      firstQuestion,
      context.candidateInfo,
      interview.template.jobDescription || undefined,
    );

    // Add question to history
    await this.conversationManager.addMessage(
      sessionId,
      'assistant',
      adaptedQuestion,
    );

    // Update context
    const updatedContext = await this.conversationManager.getContext(sessionId);

    return {
      sessionId,
      interviewId,
      openingMessage,
      firstQuestion: {
        ...firstQuestion,
        text: adaptedQuestion,
      },
      context: updatedContext,
    };
  }

  /**
   * Process candidate response
   */
  async processResponse(
    sessionId: string,
    responseText: string,
  ): Promise<InterviewTurn> {
    // Get context
    const context = await this.conversationManager.getContext(sessionId);

    // Add response to history
    await this.conversationManager.addMessage(sessionId, 'user', responseText);

    // Get current question
    const currentQuestion = this.conversationManager.getCurrentQuestion(
      context,
    );

    if (!currentQuestion) {
      // Interview complete
      return this.handleInterviewComplete(sessionId);
    }

    // Evaluate response
    const evaluation = await this.responseEvaluator.evaluateResponse(
      currentQuestion,
      responseText,
    );

    // Get or initialize response tracking
    const questionId = currentQuestion.id;
    const existingResponse = context.responses[questionId] || {
      text: responseText,
      score: evaluation.score,
      followUpsAsked: 0,
      evaluation: this.responseEvaluator.generateEvaluationText(evaluation),
    };

    // Check if follow-up is needed
    const needsFollowUp = await this.responseEvaluator.needsFollowUp(
      evaluation,
      existingResponse.followUpsAsked,
      responseText.length,
    );

    let nextQuestion: Question | null = null;
    let isComplete = false;

    if (needsFollowUp) {
      // Generate follow-up question
      const followUpText = await this.questionGenerator.generateFollowUp(
        currentQuestion.text,
        responseText,
        currentQuestion.scoringCriteria,
      );

      existingResponse.followUpsAsked++;
      context.responses[questionId] = existingResponse;
      await this.conversationManager.updateContext(context);

      // Add follow-up to history
      await this.conversationManager.addMessage(
        sessionId,
        'assistant',
        followUpText,
      );

      nextQuestion = {
        ...currentQuestion,
        text: followUpText,
      };
    } else {
      // Save response
      context.responses[questionId] = existingResponse;
      await this.conversationManager.updateContext(context);

      // Save to database
      await this.saveResponseToDatabase(
        context.interviewId,
        currentQuestion,
        responseText,
        evaluation,
      );

      // Move to next question
      isComplete = await this.conversationManager.moveToNextQuestion(sessionId);

      if (!isComplete) {
        // Get next question
        const updatedContext = await this.conversationManager.getContext(
          sessionId,
        );
        const nextQuestionData =
          this.conversationManager.getCurrentQuestion(updatedContext);

        if (nextQuestionData) {
          // Check if moving to new assessment
          if (
            updatedContext.currentAssessmentIndex >
            context.currentAssessmentIndex
          ) {
            // Generate transition message
            const prevAssessment =
              context.template.assessments[context.currentAssessmentIndex]
                .assessment.name;
            const nextAssessment =
              updatedContext.template.assessments[
                updatedContext.currentAssessmentIndex
              ].assessment.name;

            const transition =
              await this.questionGenerator.generateTransitionMessage(
                prevAssessment,
                nextAssessment,
              );

            await this.conversationManager.addMessage(
              sessionId,
              'assistant',
              transition,
            );
          }

          // Adapt next question
          const interview = await this.prisma.interview.findUnique({
            where: { id: context.interviewId },
            include: { template: true },
          });

          const adaptedNextQuestion =
            await this.questionGenerator.adaptQuestionToContext(
              nextQuestionData,
              context.candidateInfo,
              interview?.template.jobDescription || undefined,
            );

          await this.conversationManager.addMessage(
            sessionId,
            'assistant',
            adaptedNextQuestion,
          );

          nextQuestion = {
            ...nextQuestionData,
            text: adaptedNextQuestion,
          };
        }
      }
    }

    const progress = this.conversationManager.getProgress(
      await this.conversationManager.getContext(sessionId),
    );

    return {
      response: {
        text: responseText,
        score: evaluation.score,
        evaluation: this.responseEvaluator.generateEvaluationText(evaluation),
      },
      nextQuestion,
      isComplete,
      progress,
    };
  }

  /**
   * Complete interview and generate summary
   */
  async completeInterview(sessionId: string): Promise<InterviewSummary> {
    const context = await this.conversationManager.getContext(sessionId);

    // Calculate overall score
    const scores = Object.values(context.responses).map((r) => r.score);
    const overallScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    // Calculate score breakdown by assessment
    const scoreBreakdown: Record<string, number> = {};
    context.template.assessments.forEach((ta) => {
      const assessmentId = ta.assessmentId;
      const assessmentResponses = Object.entries(context.responses).filter(
        ([questionId]) => {
          // Find which assessment this question belongs to
          const questions = (ta.assessment.questions as any[]) || [];
          return questions.some((q) => q.id === questionId);
        },
      );

      if (assessmentResponses.length > 0) {
        const avgScore =
          assessmentResponses.reduce(
            (sum, [, response]) => sum + response.score,
            0,
          ) / assessmentResponses.length;
        scoreBreakdown[assessmentId] = Math.round(avgScore);
      }
    });

    // Generate final evaluation
    const allEvaluations = Object.values(context.responses)
      .map((r) => r.evaluation)
      .filter(Boolean)
      .join('\n\n');

    const summaryPrompt = `Based on this interview evaluation, provide:
1. Overall assessment (2-3 sentences)
2. Key strengths (3-5 points)
3. Key weaknesses (2-3 points)
4. Final recommendation (hire/no-hire/maybe)
5. Insights (3-5 actionable insights)

Interview Evaluations:
${allEvaluations}

Overall Score: ${overallScore}/100

Return structured summary.`;

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an expert recruiter summarizing interview results. Be objective and constructive.',
      },
      { role: 'user' as const, content: summaryPrompt },
    ];

    let evaluation = '';
    let strengths: string[] = [];
    let weaknesses: string[] = [];
    let recommendation: 'hire' | 'no-hire' | 'maybe' = 'maybe';
    let insights: string[] = [];

    try {
      const summary = await this.openaiService.chat(messages, {
        temperature: 0.5,
        maxTokens: 500,
      });
      evaluation = summary;

      // Extract structured data (simple parsing)
      const lines = summary.split('\n');
      let currentSection = '';
      for (const line of lines) {
        if (line.toLowerCase().includes('strength')) {
          currentSection = 'strengths';
        } else if (line.toLowerCase().includes('weakness')) {
          currentSection = 'weaknesses';
        } else if (line.toLowerCase().includes('recommendation')) {
          if (line.toLowerCase().includes('hire') && !line.toLowerCase().includes('no')) {
            recommendation = 'hire';
          } else if (line.toLowerCase().includes('no-hire')) {
            recommendation = 'no-hire';
          }
        } else if (line.toLowerCase().includes('insight')) {
          currentSection = 'insights';
        } else if (line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
          const item = line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
          if (currentSection === 'strengths' && item) {
            strengths.push(item);
          } else if (currentSection === 'weaknesses' && item) {
            weaknesses.push(item);
          } else if (currentSection === 'insights' && item) {
            insights.push(item);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error}`);
      evaluation = 'Summary generation failed';
    }

    // Update interview in database
    await this.prisma.interview.update({
      where: { id: context.interviewId },
      data: {
        overallScore,
        scoreBreakdown: scoreBreakdown as any,
        aiEvaluation: evaluation,
        recommendation: recommendation.toUpperCase(),
      },
    });

    // Clean up session
    await this.conversationManager.deleteSession(sessionId);

    return {
      interviewId: context.interviewId,
      overallScore,
      scoreBreakdown,
      evaluation,
      strengths: strengths.length > 0 ? strengths : ['No specific strengths identified'],
      weaknesses: weaknesses.length > 0 ? weaknesses : ['No major weaknesses identified'],
      recommendation,
      insights: insights.length > 0 ? insights : ['Continue evaluation process'],
    };
  }

  /**
   * Save response to database
   */
  private async saveResponseToDatabase(
    interviewId: string,
    question: Question,
    responseText: string,
    evaluation: any,
  ): Promise<void> {
    // Find assessment ID for this question
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        template: {
          include: {
            assessments: {
              include: {
                assessment: true,
              },
            },
          },
        },
      },
    });

    if (!interview) {
      return;
    }

    // Find which assessment contains this question
    let assessmentId = '';
    for (const ta of interview.template.assessments) {
      const questions = (ta.assessment.questions as any[]) || [];
      if (questions.some((q) => q.id === question.id)) {
        assessmentId = ta.assessmentId;
        break;
      }
    }

    if (!assessmentId) {
      this.logger.warn(`Could not find assessment for question ${question.id}`);
      return;
    }

    // Check if response already exists
    const existing = await this.prisma.interviewResponse.findFirst({
      where: {
        interviewId,
        questionId: question.id,
      },
    });

    if (existing) {
      // Update existing
      await this.prisma.interviewResponse.update({
        where: { id: existing.id },
        data: {
          responseText,
          score: evaluation.score,
          evaluation: this.responseEvaluator.generateEvaluationText(evaluation),
        },
      });
    } else {
      // Create new
      await this.prisma.interviewResponse.create({
        data: {
          interviewId,
          assessmentId,
          questionId: question.id,
          questionText: question.text,
          responseText,
          score: evaluation.score,
          evaluation: this.responseEvaluator.generateEvaluationText(evaluation),
          timeSpent: question.timeLimit || 120,
          order: question.order,
        },
      });
    }
  }

  /**
   * Handle interview completion
   */
  private handleInterviewComplete(sessionId: string): InterviewTurn {
    return {
      response: {
        text: '',
        score: 0,
        evaluation: '',
      },
      nextQuestion: null,
      isComplete: true,
      progress: {
        currentAssessment: 0,
        totalAssessments: 0,
        currentQuestion: 0,
        totalQuestions: 0,
      },
    };
  }
}

