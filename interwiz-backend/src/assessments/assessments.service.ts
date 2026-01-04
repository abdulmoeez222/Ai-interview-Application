import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  FilterAssessmentDto,
  CreateQuestionDto,
} from './dto';
import { PaginatedResponse } from './interfaces/paginated-response.interface';
import { Question } from './interfaces/question.interface';
import { AssessmentType, Difficulty } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all assessments with filters and pagination
   */
  async findAll(
    filter: FilterAssessmentDto,
  ): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      skill,
      difficulty,
      isPublic,
    } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      deletedAt: null, // Soft delete filter
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Type filter
    if (type) {
      where.type = type;
    }

    // Difficulty filter
    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Public filter
    if (isPublic !== undefined) {
      where.OR = [
        { isPublic: true },
        ...(where.OR || []),
      ];
    }

    // Skill filter
    if (skill) {
      where.skillsEvaluated = {
        has: skill,
      };
    }

    // Get total count
    const total = await this.prisma.assessment.count({ where });

    // Get assessments
    const assessments = await this.prisma.assessment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            templateAssessments: true,
          },
        },
      },
    });

    // Format response
    const formattedAssessments = assessments.map((assessment) => {
      const questions = assessment.questions as Question[];
      return {
        id: assessment.id,
        name: assessment.name,
        type: assessment.type,
        description: assessment.description,
        duration: assessment.duration,
        difficulty: assessment.difficulty,
        skillsEvaluated: assessment.skillsEvaluated,
        usageCount: assessment._count.templateAssessments,
        isPublic: assessment.isPublic,
        questionCount: questions?.length || 0,
        createdBy: {
          id: assessment.createdBy.id,
          firstName: assessment.createdBy.firstName,
          lastName: assessment.createdBy.lastName,
        },
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
      };
    });

    return {
      data: formattedAssessments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one assessment by ID
   */
  async findOne(id: string): Promise<any> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            templateAssessments: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const questions = (assessment.questions as Question[]) || [];

    return {
      id: assessment.id,
      name: assessment.name,
      type: assessment.type,
      description: assessment.description,
      duration: assessment.duration,
      difficulty: assessment.difficulty,
      skillsEvaluated: assessment.skillsEvaluated,
      usageCount: assessment._count.templateAssessments,
      isPublic: assessment.isPublic,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        expectedAnswer: q.expectedAnswer,
        followUpPrompts: q.followUpPrompts,
        scoringCriteria: q.scoringCriteria,
        timeLimit: q.timeLimit,
        order: q.order,
      })),
      createdBy: {
        id: assessment.createdBy.id,
        firstName: assessment.createdBy.firstName,
        lastName: assessment.createdBy.lastName,
      },
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    };
  }

  /**
   * Find assessments by skill
   */
  async findBySkill(skill: string): Promise<any[]> {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        skillsEvaluated: {
          has: skill,
        },
        deletedAt: null,
        OR: [
          { isPublic: true },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            templateAssessments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assessments.map((assessment) => ({
      id: assessment.id,
      name: assessment.name,
      type: assessment.type,
      description: assessment.description,
      duration: assessment.duration,
      difficulty: assessment.difficulty,
      skillsEvaluated: assessment.skillsEvaluated,
      usageCount: assessment._count.templateAssessments,
      isPublic: assessment.isPublic,
      createdBy: {
        id: assessment.createdBy.id,
        firstName: assessment.createdBy.firstName,
        lastName: assessment.createdBy.lastName,
      },
      createdAt: assessment.createdAt,
    }));
  }

  /**
   * Get all assessment types
   */
  getTypes(): string[] {
    return Object.values(AssessmentType);
  }

  /**
   * Create a new assessment
   */
  async create(dto: CreateAssessmentDto, userId: string): Promise<any> {
    // Validate questions
    this.validateQuestions(dto.questions);

    // Calculate duration from questions
    const calculatedDuration = this.calculateDuration(dto.questions);

    // Validate duration
    if (dto.duration && Math.abs(dto.duration - calculatedDuration) > 1) {
      throw new BadRequestException(
        `Duration mismatch. Calculated duration from questions: ${calculatedDuration} minutes, provided: ${dto.duration} minutes`,
      );
    }

    // Warn if duration > 20 minutes
    if (calculatedDuration > 20) {
      // Just a warning, not an error
      console.warn(`Assessment duration (${calculatedDuration} min) exceeds recommended 20 minutes`);
    }

    // Error if duration > 30 minutes
    if (calculatedDuration > 30) {
      throw new BadRequestException(
        'Assessment duration cannot exceed 30 minutes',
      );
    }

    // Add IDs to questions
    const questionsWithIds: Question[] = dto.questions.map((q) => ({
      id: uuidv4(),
      ...q,
    }));

    // Create assessment
    const assessment = await this.prisma.assessment.create({
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        duration: calculatedDuration,
        difficulty: dto.difficulty,
        skillsEvaluated: dto.skillsEvaluated,
        questions: questionsWithIds,
        isPublic: dto.isPublic || false,
        userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.findOne(assessment.id);
  }

  /**
   * Update an assessment
   */
  async update(
    id: string,
    dto: UpdateAssessmentDto,
    userId: string,
  ): Promise<any> {
    // Check if assessment exists
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check permissions (user owns assessment or is admin)
    // Note: Admin check would require checking user role
    if (assessment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this assessment',
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.type) updateData.type = dto.type;
    if (dto.description) updateData.description = dto.description;
    if (dto.difficulty) updateData.difficulty = dto.difficulty;
    if (dto.skillsEvaluated) updateData.skillsEvaluated = dto.skillsEvaluated;
    if (dto.isPublic !== undefined) updateData.isPublic = dto.isPublic;

    // Handle questions update
    if (dto.questions) {
      this.validateQuestions(dto.questions);

      // Add IDs to new questions
      const questionsWithIds: Question[] = dto.questions.map((q) => ({
        id: q.id || uuidv4(),
        ...q,
      }));

      updateData.questions = questionsWithIds;

      // Recalculate duration
      const calculatedDuration = this.calculateDuration(dto.questions);
      updateData.duration = calculatedDuration;

      // Validate duration
      if (calculatedDuration > 30) {
        throw new BadRequestException(
          'Assessment duration cannot exceed 30 minutes',
        );
      }
    }

    // Update assessment
    await this.prisma.assessment.update({
      where: { id },
      data: updateData,
    });

    return this.findOne(id);
  }

  /**
   * Delete an assessment
   */
  async delete(id: string, userId: string): Promise<void> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            templateAssessments: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check permissions
    if (assessment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this assessment',
      );
    }

    // Check if used in templates
    if (assessment._count.templateAssessments > 0) {
      // Soft delete only
      await this.prisma.assessment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });
    } else {
      // Hard delete if not used
      await this.prisma.assessment.delete({
        where: { id },
      });
    }
  }

  /**
   * Add question to assessment
   */
  async addQuestion(
    assessmentId: string,
    question: CreateQuestionDto,
    userId: string,
  ): Promise<Question> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        deletedAt: null,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check permissions
    if (assessment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this assessment',
      );
    }

    const questions = (assessment.questions as Question[]) || [];

    // Add new question with ID
    const newQuestion: Question = {
      id: uuidv4(),
      ...question,
    };

    questions.push(newQuestion);

    // Validate questions
    this.validateQuestions(questions);

    // Recalculate duration
    const newDuration = this.calculateDuration(questions);

    if (newDuration > 30) {
      throw new BadRequestException(
        'Adding this question would exceed the 30-minute limit',
      );
    }

    // Update assessment
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        questions,
        duration: newDuration,
      },
    });

    return newQuestion;
  }

  /**
   * Update a question in assessment
   */
  async updateQuestion(
    assessmentId: string,
    questionId: string,
    updates: Partial<Question>,
    userId: string,
  ): Promise<Question> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        deletedAt: null,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check permissions
    if (assessment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this assessment',
      );
    }

    const questions = (assessment.questions as Question[]) || [];
    const questionIndex = questions.findIndex((q) => q.id === questionId);

    if (questionIndex === -1) {
      throw new NotFoundException('Question not found');
    }

    // Update question
    questions[questionIndex] = {
      ...questions[questionIndex],
      ...updates,
      id: questionId, // Preserve ID
    };

    // Validate questions
    this.validateQuestions(questions);

    // Recalculate duration
    const newDuration = this.calculateDuration(questions);

    if (newDuration > 30) {
      throw new BadRequestException(
        'Updating this question would exceed the 30-minute limit',
      );
    }

    // Update assessment
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        questions,
        duration: newDuration,
      },
    });

    return questions[questionIndex];
  }

  /**
   * Delete a question from assessment
   */
  async deleteQuestion(
    assessmentId: string,
    questionId: string,
    userId: string,
  ): Promise<void> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        deletedAt: null,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check permissions
    if (assessment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this assessment',
      );
    }

    const questions = (assessment.questions as Question[]) || [];

    if (questions.length <= 3) {
      throw new BadRequestException(
        'Cannot delete question. Assessment must have at least 3 questions',
      );
    }

    // Remove question
    const filteredQuestions = questions.filter((q) => q.id !== questionId);

    if (filteredQuestions.length === questions.length) {
      throw new NotFoundException('Question not found');
    }

    // Reorder questions
    filteredQuestions.forEach((q, index) => {
      q.order = index + 1;
    });

    // Validate questions
    this.validateQuestions(filteredQuestions);

    // Recalculate duration
    const newDuration = this.calculateDuration(filteredQuestions);

    // Update assessment
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        questions: filteredQuestions,
        duration: newDuration,
      },
    });
  }

  /**
   * Reorder questions in assessment
   */
  async reorderQuestions(
    assessmentId: string,
    questionIds: string[],
    userId: string,
  ): Promise<void> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        deletedAt: null,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check permissions
    if (assessment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this assessment',
      );
    }

    const questions = (assessment.questions as Question[]) || [];

    if (questionIds.length !== questions.length) {
      throw new BadRequestException(
        'Question IDs count must match questions count',
      );
    }

    // Create a map for quick lookup
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Reorder questions
    const reorderedQuestions: Question[] = questionIds.map((id, index) => {
      const question = questionMap.get(id);
      if (!question) {
        throw new BadRequestException(`Question with ID ${id} not found`);
      }
      return {
        ...question,
        order: index + 1,
      };
    });

    // Validate questions
    this.validateQuestions(reorderedQuestions);

    // Update assessment
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        questions: reorderedQuestions,
      },
    });
  }

  /**
   * Calculate total duration from questions
   */
  private calculateDuration(questions: Question[] | CreateQuestionDto[]): number {
    const totalSeconds = questions.reduce((sum, q) => {
      const timeLimit = q.timeLimit || 120; // Default 2 minutes if not specified
      return sum + timeLimit;
    }, 0);

    // Add buffer time (30 seconds between questions)
    const bufferTime = (questions.length - 1) * 30;
    const totalWithBuffer = totalSeconds + bufferTime;

    // Convert to minutes and round to 1 decimal place
    return Math.round((totalWithBuffer / 60) * 10) / 10;
  }

  /**
   * Validate questions
   */
  private validateQuestions(questions: Question[] | CreateQuestionDto[]): void {
    if (!questions || questions.length < 3) {
      throw new BadRequestException('At least 3 questions are required');
    }

    // Check for sequential orders
    const orders = questions.map((q) => q.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        throw new BadRequestException(
          'Question orders must be sequential (1, 2, 3, ...)',
        );
      }
    }

    // Check for duplicate question IDs (if they have IDs)
    const questionIds = questions
      .map((q) => (q as Question).id)
      .filter(Boolean);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException('Duplicate question IDs found');
    }

    // Validate weights sum to 1.0
    const totalWeight = questions.reduce(
      (sum, q) => sum + (q.scoringCriteria?.weight || 0),
      0,
    );
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new BadRequestException(
        `Question weights must sum to 1.0. Current sum: ${totalWeight}`,
      );
    }

    // Validate each question has scoring criteria
    questions.forEach((q, index) => {
      if (!q.scoringCriteria) {
        throw new BadRequestException(
          `Question ${index + 1} must have scoring criteria`,
        );
      }
      if (!q.scoringCriteria.keyPoints || q.scoringCriteria.keyPoints.length < 2) {
        throw new BadRequestException(
          `Question ${index + 1} must have at least 2 key points`,
        );
      }
    });
  }
}

