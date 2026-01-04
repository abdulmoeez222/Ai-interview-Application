import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, FilterTemplateDto } from './dto';
import { PaginatedResponse } from './interfaces/paginated-response.interface';
import { Template, Domain, TemplateType } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all templates with filters and pagination
   */
  async findAll(
    filter: FilterTemplateDto,
    userId: string,
  ): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 6,
      search,
      type,
      domain,
      createdBy,
      tags,
      sortBy = 'latest',
      isPublic,
    } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      deletedAt: null, // Soft delete filter
    };

    // Build AND conditions array for complex queries
    const andConditions: any[] = [];

    // Search filter
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // Type filter
    if (type) {
      where.type = type;
    }

    // Domain filter
    if (domain) {
      where.domain = domain;
    }

    // Created by filter
    if (createdBy) {
      if (createdBy === 'all') {
        // Show all templates (public + user's own)
        andConditions.push({
          OR: [
            { userId },
            { isPublic: true },
          ],
        });
      } else {
        where.userId = createdBy;
      }
    } else {
      // Default: show user's templates + public templates
      andConditions.push({
        OR: [
          { userId },
          { isPublic: true },
        ],
      });
    }

    // Public filter
    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    // Tags filter
    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      };
    }

    // Combine AND conditions if any
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Build orderBy
    let orderBy: any = {};
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'duration':
        orderBy = { totalDuration: 'desc' };
        break;
      case 'latest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get total count
    const total = await this.prisma.template.count({ where });

    // Get templates
    const templates = await this.prisma.template.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
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
        _count: {
          select: {
            assessments: true,
          },
        },
      },
    });

    // Format response
    const formattedTemplates = templates.map((template) => {
      const skillsSet = new Set<string>();
      template.assessments.forEach((ta) => {
        ta.assessment.skillsEvaluated.forEach((skill) => skillsSet.add(skill));
      });

      return {
        id: template.id,
        title: template.title,
        description: template.description,
        domain: template.domain,
        type: template.type,
        totalDuration: template.totalDuration,
        assessmentCount: template._count.assessments,
        skillCount: skillsSet.size,
        tags: template.tags,
        isPublic: template.isPublic,
        createdBy: {
          id: template.createdBy.id,
          firstName: template.createdBy.firstName,
          lastName: template.createdBy.lastName,
        },
        createdAt: template.createdAt,
      };
    });

    return {
      data: formattedTemplates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one template by ID
   */
  async findOne(id: string, userId: string): Promise<any> {
    const template = await this.prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { userId }, // User's own template
          { isPublic: true }, // Public template
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
        clonedFrom: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Format assessments
    const formattedAssessments = template.assessments.map((ta) => ({
      id: ta.assessment.id,
      name: ta.assessment.name,
      type: ta.assessment.type,
      duration: ta.assessment.duration,
      weightage: ta.weightage,
      scoreImpact: ta.scoreImpact,
      order: ta.order,
      skillsEvaluated: ta.assessment.skillsEvaluated,
    }));

    return {
      id: template.id,
      title: template.title,
      description: template.description,
      domain: template.domain,
      jobTitle: template.jobTitle,
      jobDescription: template.jobDescription,
      jobDescriptionUrl: template.jobDescriptionUrl,
      type: template.type,
      totalDuration: template.totalDuration,
      tags: template.tags,
      assessments: formattedAssessments,
      clonedFrom: template.clonedFrom
        ? {
            id: template.clonedFrom.id,
            title: template.clonedFrom.title,
          }
        : null,
      createdBy: {
        id: template.createdBy.id,
        firstName: template.createdBy.firstName,
        lastName: template.createdBy.lastName,
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * Create a new template
   */
  async create(dto: CreateTemplateDto, userId: string): Promise<any> {
    // Validate job description
    if (!dto.jobDescription && !dto.jobDescriptionUrl) {
      throw new BadRequestException(
        'Either job description or job description URL is required',
      );
    }

    // Check for duplicate title (per user)
    const existingTemplate = await this.prisma.template.findFirst({
      where: {
        title: dto.title,
        userId,
        deletedAt: null,
      },
    });

    if (existingTemplate) {
      throw new BadRequestException(
        'A template with this title already exists',
      );
    }

    // Validate assessments
    if (!dto.assessments || dto.assessments.length === 0) {
      throw new BadRequestException('At least one assessment is required');
    }

    // Validate weightages sum to 100
    const totalWeightage = dto.assessments.reduce(
      (sum, a) => sum + a.weightage,
      0,
    );
    if (Math.abs(totalWeightage - 100) > 0.01) {
      throw new BadRequestException(
        'Assessment weightages must sum to 100%',
      );
    }

    // Validate assessment IDs exist
    const assessmentIds = dto.assessments.map((a) => a.assessmentId);
    const assessments = await this.prisma.assessment.findMany({
      where: {
        id: { in: assessmentIds },
      },
    });

    if (assessments.length !== assessmentIds.length) {
      throw new BadRequestException('One or more assessment IDs are invalid');
    }

    // Calculate total duration
    const totalDuration = await this.calculateDuration(assessmentIds);

    // Validate duration
    if (totalDuration > 60) {
      throw new BadRequestException(
        'Total interview duration cannot exceed 60 minutes',
      );
    }

    // Create template with assessments
    const template = await this.prisma.template.create({
      data: {
        title: dto.title,
        description: dto.description,
        domain: dto.domain,
        jobTitle: dto.jobTitle,
        jobDescription: dto.jobDescription,
        jobDescriptionUrl: dto.jobDescriptionUrl,
        type: dto.type || 'SCREENING',
        tags: dto.tags || [],
        totalDuration,
        userId,
        assessments: {
          create: dto.assessments.map((a) => ({
            assessmentId: a.assessmentId,
            weightage: a.weightage,
            scoreImpact: a.weightage, // Default to same as weightage
            order: a.order,
          })),
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assessments: {
          include: {
            assessment: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return this.findOne(template.id, userId);
  }

  /**
   * Update a template
   */
  async update(
    id: string,
    dto: UpdateTemplateDto,
    userId: string,
  ): Promise<any> {
    // Check if template exists and user has permission
    const template = await this.prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check permissions (user owns template or is admin)
    if (template.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this template',
      );
    }

    // Validate job description if updating
    if (
      dto.jobDescription === null &&
      dto.jobDescriptionUrl === null &&
      !template.jobDescription &&
      !template.jobDescriptionUrl
    ) {
      throw new BadRequestException(
        'Either job description or job description URL is required',
      );
    }

    // Check for duplicate title if updating title
    if (dto.title && dto.title !== template.title) {
      const existingTemplate = await this.prisma.template.findFirst({
        where: {
          title: dto.title,
          userId,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existingTemplate) {
        throw new BadRequestException(
          'A template with this title already exists',
        );
      }
    }

    // Handle assessments update
    let totalDuration = template.totalDuration;
    if (dto.assessments && dto.assessments.length > 0) {
      // Validate weightages
      const totalWeightage = dto.assessments.reduce(
        (sum, a) => sum + (a.weightage || 0),
        0,
      );
      if (Math.abs(totalWeightage - 100) > 0.01) {
        throw new BadRequestException(
          'Assessment weightages must sum to 100%',
        );
      }

      // Validate assessment IDs
      const assessmentIds = dto.assessments
        .map((a) => a.assessmentId)
        .filter(Boolean);
      if (assessmentIds.length > 0) {
        const assessments = await this.prisma.assessment.findMany({
          where: {
            id: { in: assessmentIds },
          },
        });

        if (assessments.length !== assessmentIds.length) {
          throw new BadRequestException(
            'One or more assessment IDs are invalid',
          );
        }

        // Calculate new duration
        totalDuration = await this.calculateDuration(assessmentIds);

        // Validate duration
        if (totalDuration > 60) {
          throw new BadRequestException(
            'Total interview duration cannot exceed 60 minutes',
          );
        }

        // Delete existing assessments
        await this.prisma.templateAssessment.deleteMany({
          where: { templateId: id },
        });

        // Create new assessments
        await this.prisma.templateAssessment.createMany({
          data: dto.assessments.map((a) => ({
            templateId: id,
            assessmentId: a.assessmentId!,
            weightage: a.weightage!,
            scoreImpact: a.weightage!,
            order: a.order!,
          })),
        });
      }
    }

    // Update template
    const updatedTemplate = await this.prisma.template.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        domain: dto.domain,
        jobTitle: dto.jobTitle,
        jobDescription: dto.jobDescription,
        jobDescriptionUrl: dto.jobDescriptionUrl,
        type: dto.type,
        tags: dto.tags,
        isPublic: dto.isPublic,
        totalDuration,
      },
    });

    return this.findOne(updatedTemplate.id, userId);
  }

  /**
   * Delete a template (soft delete)
   */
  async delete(id: string, userId: string): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check permissions
    if (template.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this template',
      );
    }

    // Soft delete
    await this.prisma.template.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Clone a template
   */
  async clone(id: string, userId: string): Promise<any> {
    const originalTemplate = await this.prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { userId }, // User's own template
          { isPublic: true }, // Public template
        ],
      },
      include: {
        assessments: {
          include: {
            assessment: true,
          },
        },
      },
    });

    if (!originalTemplate) {
      throw new NotFoundException('Template not found');
    }

    // Create cloned template
    const clonedTemplate = await this.prisma.template.create({
      data: {
        title: `Clone_${originalTemplate.title}`,
        description: originalTemplate.description,
        domain: originalTemplate.domain,
        jobTitle: originalTemplate.jobTitle,
        jobDescription: originalTemplate.jobDescription,
        jobDescriptionUrl: originalTemplate.jobDescriptionUrl,
        type: originalTemplate.type,
        tags: originalTemplate.tags,
        totalDuration: originalTemplate.totalDuration,
        clonedFromId: originalTemplate.id,
        userId,
        assessments: {
          create: originalTemplate.assessments.map((ta) => ({
            assessmentId: ta.assessmentId,
            weightage: ta.weightage,
            scoreImpact: ta.scoreImpact,
            order: ta.order,
          })),
        },
      },
    });

    return this.findOne(clonedTemplate.id, userId);
  }

  /**
   * Calculate total duration from assessment IDs
   */
  async calculateDuration(assessmentIds: string[]): Promise<number> {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        id: { in: assessmentIds },
      },
      select: {
        duration: true,
      },
    });

    return assessments.reduce((sum, a) => sum + a.duration, 0);
  }

  /**
   * Validate weightages sum to 100
   */
  validateWeightages(assessments: { weightage: number }[]): boolean {
    const total = assessments.reduce((sum, a) => sum + a.weightage, 0);
    return Math.abs(total - 100) < 0.01;
  }
}

