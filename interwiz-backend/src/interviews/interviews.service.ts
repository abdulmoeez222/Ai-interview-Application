import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInterviewDto,
  ScheduleInterviewDto,
  SaveResponseDto,
  FilterInterviewDto,
} from './dto';
import { PaginatedResponse } from './interfaces/paginated-response.interface';
import { InterviewReport } from './interfaces/interview-report.interface';
import { ScoreBreakdown, ProctorData } from './interfaces/interview.interface';
import { InterviewStatus } from '@prisma/client';
import { SpeechToTextService } from '../ai/services/speech-to-text.service';
import { TextToSpeechService } from '../ai/services/text-to-speech.service';
import { OpenAIService } from '../ai/services/openai.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class InterviewsService {
  constructor(
    private prisma: PrismaService,
    private speechToText: SpeechToTextService,
    private textToSpeech: TextToSpeechService,
    private openai: OpenAIService,
  ) {}

  /**
   * Find all interviews with filters and pagination
   */
  async findAll(
    filter: FilterInterviewDto,
    userId: string,
  ): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 10,
      status,
      templateId,
      domain,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId, // Only show interviews created by this user
    };

    // Status filter
    if (status) {
      where.status = status;
    }

    // Template filter
    if (templateId) {
      where.templateId = templateId;
    }

    // Domain filter (through template)
    if (domain) {
      where.template = {
        domain,
      };
    }

    // Search filter
    if (search) {
      where.OR = [
        { candidateName: { contains: search, mode: 'insensitive' } },
        { candidateEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Get total count
    const total = await this.prisma.interview.count({ where });

    // Get interviews
    const interviews = await this.prisma.interview.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        template: {
          select: {
            id: true,
            title: true,
            domain: true,
            totalDuration: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    // Format response
    const formattedInterviews = interviews.map((interview) => ({
      id: interview.id,
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      startedAt: interview.startedAt,
      completedAt: interview.completedAt,
      overallScore: interview.overallScore,
      trustScore: interview.trustScore,
      template: interview.template,
      responseCount: interview._count.responses,
      createdAt: interview.createdAt,
    }));

    return {
      data: formattedInterviews,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one interview by ID
   */
  async findOne(id: string, userId: string): Promise<any> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        id,
        userId, // Check ownership
      },
      include: {
        template: {
          include: {
            assessments: {
              include: {
                assessment: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    duration: true,
                    skillsEvaluated: true,
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        responses: {
          orderBy: {
            order: 'asc',
          },
        },
        schedule: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    const scoreBreakdown = interview.scoreBreakdown as ScoreBreakdown | null;
    const proctorData = interview.proctorData as ProctorData | null;

    return {
      id: interview.id,
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      candidatePhone: interview.candidatePhone,
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      startedAt: interview.startedAt,
      completedAt: interview.completedAt,
      duration: interview.duration,
      overallScore: interview.overallScore,
      scoreBreakdown,
      trustScore: interview.trustScore,
      recordingUrl: interview.recordingUrl,
      transcriptUrl: interview.transcriptUrl,
      proctorData,
      metadata: interview.metadata,
      template: interview.template,
      responses: interview.responses,
      schedule: interview.schedule,
      createdBy: interview.createdBy,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
    };
  }

  /**
   * Find interview by token (public endpoint)
   */
  async findByToken(token: string): Promise<any> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        OR: [
          { joinToken: token },
          { inviteToken: token },
        ],
      },
      include: {
        template: {
          select: {
            id: true,
            title: true,
            description: true,
            domain: true,
            totalDuration: true,
          },
        },
        schedule: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    // Check if expired
    if (interview.status === 'REQUESTED' && interview.expiresAt < new Date()) {
      await this.prisma.interview.update({
        where: { id: interview.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Interview scheduling link has expired');
    }

    // Don't expose sensitive data for candidates
    return {
      id: interview.id,
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      expiresAt: interview.expiresAt,
      timezone: interview.timezone,
      template: interview.template,
      schedule: interview.schedule,
    };
  }

  /**
   * Create a new interview
   */
  async create(dto: CreateInterviewDto, userId: string): Promise<any> {
    // Validate template exists
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      include: {
        assessments: {
          include: {
            assessment: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Generate tokens
    const { inviteToken, joinToken } = this.generateTokens();

    // Set expiry date (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create interview
    const interview = await this.prisma.interview.create({
      data: {
        candidateEmail: dto.candidateEmail,
        candidateName: dto.candidateName,
        candidatePhone: dto.candidatePhone,
        templateId: dto.templateId,
        status: 'REQUESTED',
        joinToken,
        inviteToken,
        expiresAt,
        timezone: dto.timezone || 'UTC',
        metadata: dto.metadata || {},
        userId,
      },
    });

    // Create schedule if availability slots provided
    if (dto.availabilitySlots && dto.availabilitySlots.length > 0) {
      await this.prisma.schedule.create({
        data: {
          interviewId: interview.id,
          availabilitySlots: dto.availabilitySlots,
        },
      });
    }

    // TODO: Send invitation email to candidate
    // const schedulingLink = `${process.env.FRONTEND_URL}/schedule/${inviteToken}`;
    // await this.emailService.sendInterviewInvite(...);

    return this.findOne(interview.id, userId);
  }

  /**
   * Schedule interview (candidate selects time slot)
   */
  async schedule(interviewId: string, dto: ScheduleInterviewDto): Promise<any> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { schedule: true },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status !== 'REQUESTED') {
      throw new BadRequestException('Interview is not in REQUESTED status');
    }

    if (interview.expiresAt < new Date()) {
      throw new BadRequestException('Interview scheduling link has expired');
    }

    // Validate selected slot is in availability slots
    if (interview.schedule) {
      const availabilitySlots = interview.schedule.availabilitySlots as any[];
      const selectedSlot = new Date(dto.selectedSlot);
      const isValid = availabilitySlots.some((slot) => {
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        return selectedSlot >= slotStart && selectedSlot <= slotEnd;
      });

      if (!isValid) {
        throw new BadRequestException('Selected slot is not in available slots');
      }
    }

    // Update interview
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: new Date(dto.selectedSlot),
        timezone: dto.timezone,
      },
    });

    // Get template for duration
    const template = await this.prisma.template.findUnique({
      where: { id: interview.templateId },
      select: { totalDuration: true },
    });

    // Update schedule with selected slot
    if (interview.schedule) {
      await this.prisma.schedule.update({
        where: { interviewId },
        data: {
          selectedSlot: {
            startTime: dto.selectedSlot,
            endTime: new Date(
              new Date(dto.selectedSlot).getTime() +
                (template?.totalDuration || 30) * 60000,
            ).toISOString(),
          },
        },
      });
    }

    // TODO: Send confirmation email
    // TODO: Create calendar event
    // TODO: Schedule reminder 1 hour before

    return this.findByToken(interview.inviteToken);
  }

  /**
   * Start interview
   */
  async start(interviewId: string): Promise<any> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        id: interviewId,
        status: {
          in: ['REQUESTED', 'SCHEDULED'],
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found or cannot be started');
    }

    // Initialize proctoring data
    const proctorData: ProctorData = {
      faceDetections: [],
      tabSwitches: 0,
      fullscreenExits: 0,
      suspiciousActivity: [],
    };

    // Update interview
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'ONGOING',
        startedAt: new Date(),
        proctorData,
      },
    });

    return this.findByToken(interview.joinToken);
  }

  /**
   * Start interview - generates audio for first question
   */
  async startInterview(interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        template: {
          include: {
            assessments: {
              include: {
                assessment: {
                  include: {
                    questions: {
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status !== 'REQUESTED' && interview.status !== 'SCHEDULED') {
      throw new BadRequestException('Interview already started or cannot be started');
    }

    // Get all questions from all assessments in order
    const allQuestions: any[] = [];
    interview.template.assessments.forEach((templateAssessment) => {
      templateAssessment.assessment.questions.forEach((question) => {
        allQuestions.push({
          ...question,
          assessmentId: templateAssessment.assessmentId,
        });
      });
    });

    if (allQuestions.length === 0) {
      throw new BadRequestException('Template has no questions');
    }

    const firstQuestion = allQuestions[0];

    // Generate audio for first question
    const audioPath = path.join(
      process.cwd(),
      'uploads',
      'questions',
      `${interviewId}-q0.mp3`,
    );

    await this.textToSpeech.textToSpeechFile(firstQuestion.text, audioPath);

    // Initialize proctoring data
    const proctorData: ProctorData = {
      faceDetections: [],
      tabSwitches: 0,
      fullscreenExits: 0,
      suspiciousActivity: [],
    };

    // Update interview status
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'ONGOING',
        startedAt: new Date(),
        currentQuestionIndex: 0,
        proctorData,
      },
    });

    return {
      sessionId: interviewId,
      currentQuestion: {
        id: firstQuestion.id,
        text: firstQuestion.text,
        audioUrl: `/uploads/questions/${interviewId}-q0.mp3`,
        type: firstQuestion.type,
      },
      progress: {
        current: 1,
        total: allQuestions.length,
      },
    };
  }

  /**
   * Submit audio response and get next question
   */
  async submitResponse(interviewId: string, audioFile: Express.Multer.File) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        template: {
          include: {
            assessments: {
              include: {
                assessment: {
                  include: {
                    questions: {
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status !== 'ONGOING') {
      throw new BadRequestException('Interview is not in progress');
    }

    // Get all questions
    const allQuestions: any[] = [];
    interview.template.assessments.forEach((templateAssessment) => {
      templateAssessment.assessment.questions.forEach((question) => {
        allQuestions.push({
          ...question,
          assessmentId: templateAssessment.assessmentId,
        });
      });
    });

    const currentQuestionIndex = interview.currentQuestionIndex || 0;
    const currentQuestion = allQuestions[currentQuestionIndex];

    if (!currentQuestion) {
      throw new BadRequestException('No current question found');
    }

    // Transcribe audio
    const transcription = await this.speechToText.transcribeAudio(audioFile.path);

    // Evaluate response
    const evaluation = await this.openai.evaluateResponse(
      {
        text: currentQuestion.text,
        type: currentQuestion.type,
        scoringCriteria: currentQuestion.scoringCriteria,
      },
      transcription,
    );

    // Save response
    const responses = (interview.responses as any[]) || [];
    const responseData = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      responseText: transcription,
      responseAudioUrl: `/uploads/responses/${path.basename(audioFile.path)}`,
      score: evaluation.score,
      evaluation: evaluation.feedback,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      timestamp: new Date().toISOString(),
    };
    responses.push(responseData);

    // Check if interview is complete
    const nextIndex = currentQuestionIndex + 1;
    const isComplete = nextIndex >= allQuestions.length;

    if (isComplete) {
      // Calculate overall score
      const overallScore =
        responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length;

      // Generate final evaluation
      const finalEval = await this.openai.generateFinalEvaluation(
        responses,
        interview.template.jobTitle || 'Position',
      );

      // Update interview
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: {
          responses: responses,
          overallScore,
          aiEvaluation: finalEval.evaluation,
          recommendation: finalEval.recommendation as any,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        evaluation: {
          score: evaluation.score,
          feedback: evaluation.feedback,
        },
        isComplete: true,
        progress: {
          current: allQuestions.length,
          total: allQuestions.length,
        },
      };
    } else {
      // Generate next question audio
      const nextQuestion = allQuestions[nextIndex];
      const audioPath = path.join(
        process.cwd(),
        'uploads',
        'questions',
        `${interviewId}-q${nextIndex}.mp3`,
      );

      await this.textToSpeech.textToSpeechFile(nextQuestion.text, audioPath);

      // Update interview
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: {
          responses: responses,
          currentQuestionIndex: nextIndex,
        },
      });

      return {
        evaluation: {
          score: evaluation.score,
          feedback: evaluation.feedback,
        },
        nextQuestion: {
          id: nextQuestion.id,
          text: nextQuestion.text,
          audioUrl: `/uploads/questions/${interviewId}-q${nextIndex}.mp3`,
          type: nextQuestion.type,
        },
        isComplete: false,
        progress: {
          current: nextIndex + 1,
          total: allQuestions.length,
        },
      };
    }
  }

  /**
   * Complete interview (called by frontend)
   */
  async completeInterview(interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status === 'COMPLETED') {
      return { message: 'Interview already completed' };
    }

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return { message: 'Interview completed' };
  }

  /**
   * Complete interview
   */
  async complete(interviewId: string): Promise<any> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        id: interviewId,
        status: 'ONGOING',
      },
      include: {
        responses: true,
        template: {
          include: {
            assessments: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found or not in progress');
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      interview.responses,
      interview.template.assessments,
    );

    // Calculate trust score
    const proctorData = interview.proctorData as ProctorData | null;
    const trustScore = proctorData
      ? this.calculateTrustScore(proctorData)
      : null;

    // Calculate duration
    const duration = interview.startedAt
      ? (new Date().getTime() - interview.startedAt.getTime()) / 60000
      : null;

    // Calculate score breakdown
    const scoreBreakdown = this.calculateScoreBreakdown(
      interview.responses,
      interview.template.assessments,
    );

    // Update interview
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        overallScore,
        trustScore,
        duration,
        scoreBreakdown,
      },
    });

    // TODO: Generate report
    // TODO: Send report email to recruiter

    return this.findOne(interviewId, interview.userId);
  }

  /**
   * Cancel interview
   */
  async cancel(interviewId: string, userId: string): Promise<void> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        id: interviewId,
        userId,
        status: {
          not: 'COMPLETED',
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found or cannot be cancelled');
    }

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'CANCELLED',
      },
    });

    // TODO: Send cancellation email
    // TODO: Delete calendar event
  }

  /**
   * Save interview response
   */
  async saveResponse(
    interviewId: string,
    dto: SaveResponseDto,
  ): Promise<any> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        id: interviewId,
        status: 'ONGOING',
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found or not in progress');
    }

    // Check if response already exists
    const existingResponse = await this.prisma.interviewResponse.findFirst({
      where: {
        interviewId,
        questionId: dto.questionId,
      },
    });

    if (existingResponse) {
      // Update existing response
      const updated = await this.prisma.interviewResponse.update({
        where: { id: existingResponse.id },
        data: {
          responseText: dto.responseText,
          responseAudioUrl: dto.responseAudioUrl,
          score: dto.score,
          evaluation: dto.evaluation,
          timeSpent: dto.timeSpent,
        },
      });
      return updated;
    }

    // Create new response
    const response = await this.prisma.interviewResponse.create({
      data: {
        interviewId,
        assessmentId: dto.assessmentId,
        questionId: dto.questionId,
        questionText: dto.questionText,
        responseText: dto.responseText,
        responseAudioUrl: dto.responseAudioUrl,
        score: dto.score,
        evaluation: dto.evaluation,
        timeSpent: dto.timeSpent,
        order: interview.currentQuestionIndex + 1,
      },
    });

    // Update current question index
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        currentQuestionIndex: interview.currentQuestionIndex + 1,
      },
    });

    return response;
  }

  /**
   * Get all responses for interview
   */
  async getResponses(interviewId: string): Promise<any[]> {
    const responses = await this.prisma.interviewResponse.findMany({
      where: { interviewId },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return responses;
  }

  /**
   * Generate interview report
   */
  async generateReport(interviewId: string): Promise<InterviewReport> {
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
        responses: {
          orderBy: {
            order: 'asc',
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    const scoreBreakdown = interview.scoreBreakdown as ScoreBreakdown | null;
    const proctorData = interview.proctorData as ProctorData | null;

    // Generate insights
    const insights = this.generateInsights(interview.responses, scoreBreakdown);

    return {
      interview: {
        id: interview.id,
        candidateName: interview.candidateName,
        candidateEmail: interview.candidateEmail,
        status: interview.status,
        scheduledAt: interview.scheduledAt,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        duration: interview.duration,
      },
      scores: {
        overallScore: interview.overallScore,
        scoreBreakdown: scoreBreakdown || {},
        recommendation: interview.recommendation,
        trustScore: interview.trustScore,
      },
      template: {
        id: interview.template.id,
        title: interview.template.title,
        domain: interview.template.domain,
      },
      responses: interview.responses.map((r) => ({
        assessmentId: r.assessmentId,
        assessmentName:
          interview.template.assessments.find(
            (ta) => ta.assessmentId === r.assessmentId,
          )?.assessment.name || 'Unknown',
        questionId: r.questionId,
        questionText: r.questionText,
        responseText: r.responseText,
        score: r.score,
        evaluation: r.evaluation,
        timeSpent: r.timeSpent,
      })),
      proctoring: {
        summary: proctorData || {
          faceDetections: [],
          tabSwitches: 0,
          fullscreenExits: 0,
          suspiciousActivity: [],
        },
        trustScore: interview.trustScore,
      },
      media: {
        recordingUrl: interview.recordingUrl,
        transcriptUrl: interview.transcriptUrl,
      },
      insights,
      createdAt: interview.createdAt,
    };
  }

  /**
   * Update proctoring data
   */
  async updateProctorData(
    interviewId: string,
    data: Partial<ProctorData>,
  ): Promise<void> {
    const interview = await this.prisma.interview.findFirst({
      where: {
        id: interviewId,
        status: 'ONGOING',
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found or not in progress');
    }

    const currentProctorData = (interview.proctorData as ProctorData) || {
      faceDetections: [],
      tabSwitches: 0,
      fullscreenExits: 0,
      suspiciousActivity: [],
    };

    // Merge data
    const updatedProctorData: ProctorData = {
      faceDetections: data.faceDetections || currentProctorData.faceDetections,
      tabSwitches:
        (currentProctorData.tabSwitches || 0) + (data.tabSwitches || 0),
      fullscreenExits:
        (currentProctorData.fullscreenExits || 0) +
        (data.fullscreenExits || 0),
      suspiciousActivity: [
        ...(currentProctorData.suspiciousActivity || []),
        ...(data.suspiciousActivity || []),
      ],
    };

    // Calculate trust score
    const trustScore = this.calculateTrustScore(updatedProctorData);

    // Update interview
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        proctorData: updatedProctorData,
        trustScore,
      },
    });
  }

  /**
   * Calculate overall score from responses
   */
  private calculateOverallScore(
    responses: any[],
    templateAssessments: any[],
  ): number {
    if (responses.length === 0) {
      return 0;
    }

    // Group responses by assessment
    const assessmentScores: { [key: string]: number[] } = {};
    responses.forEach((response) => {
      if (response.score !== null) {
        if (!assessmentScores[response.assessmentId]) {
          assessmentScores[response.assessmentId] = [];
        }
        assessmentScores[response.assessmentId].push(response.score);
      }
    });

    // Calculate weighted average
    let totalWeightedScore = 0;
    let totalWeight = 0;

    templateAssessments.forEach((ta) => {
      const scores = assessmentScores[ta.assessmentId] || [];
      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const weight = ta.weightage / 100;
        totalWeightedScore += avgScore * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
  }

  /**
   * Calculate score breakdown by assessment
   */
  private calculateScoreBreakdown(
    responses: any[],
    templateAssessments: any[],
  ): ScoreBreakdown {
    const breakdown: ScoreBreakdown = {};

    templateAssessments.forEach((ta) => {
      const assessmentResponses = responses.filter(
        (r) => r.assessmentId === ta.assessmentId,
      );
      const scores = assessmentResponses
        .map((r) => r.score)
        .filter((s) => s !== null) as number[];

      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        breakdown[ta.assessmentId] = {
          score: Math.round(avgScore),
          maxScore: 100,
          percentage: Math.round(avgScore),
          responses: scores.length,
        };
      }
    });

    return breakdown;
  }

  /**
   * Calculate trust score from proctoring data
   */
  private calculateTrustScore(proctorData: ProctorData): number {
    let score = 100;

    // Penalize multiple faces detected
    const multipleFaces = proctorData.faceDetections.filter(
      (fd) => fd.facesDetected > 1,
    ).length;
    score -= multipleFaces * 5; // -5 per detection with multiple faces

    // Penalize tab switches
    score -= proctorData.tabSwitches * 3; // -3 per tab switch

    // Penalize fullscreen exits
    score -= proctorData.fullscreenExits * 10; // -10 per exit

    // Penalize suspicious activity
    score -= proctorData.suspiciousActivity.length * 15; // -15 per suspicious activity

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate insights from responses
   */
  private generateInsights(
    responses: any[],
    scoreBreakdown: ScoreBreakdown | null,
  ): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (scoreBreakdown) {
      // Find highest and lowest scoring assessments
      const scores = Object.entries(scoreBreakdown).map(([id, data]) => ({
        id,
        percentage: data.percentage,
      }));

      const sorted = scores.sort((a, b) => b.percentage - a.percentage);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];

      if (top && top.percentage >= 80) {
        strengths.push(`Strong performance in assessment (${top.percentage}%)`);
      }

      if (bottom && bottom.percentage < 60) {
        weaknesses.push(
          `Needs improvement in assessment (${bottom.percentage}%)`,
        );
        recommendations.push(
          'Consider additional training or clarification on this area',
        );
      }
    }

    // Analyze response times
    const avgTime = responses.reduce((sum, r) => sum + r.timeSpent, 0) / responses.length;
    if (avgTime < 60) {
      strengths.push('Quick and concise responses');
    } else if (avgTime > 300) {
      weaknesses.push('Response times are longer than average');
      recommendations.push('Practice articulating thoughts more concisely');
    }

    return {
      strengths: strengths.length > 0 ? strengths : ['No specific strengths identified'],
      weaknesses: weaknesses.length > 0 ? weaknesses : ['No major weaknesses identified'],
      recommendations: recommendations.length > 0 ? recommendations : ['Continue current performance'],
    };
  }

  /**
   * Generate secure random tokens
   */
  private generateTokens(): { inviteToken: string; joinToken: string } {
    return {
      inviteToken: uuidv4() + uuidv4(), // Double UUID for extra security
      joinToken: uuidv4() + uuidv4(),
    };
  }
}

