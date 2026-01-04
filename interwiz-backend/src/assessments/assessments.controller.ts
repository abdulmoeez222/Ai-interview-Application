import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  FilterAssessmentDto,
  CreateQuestionDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Question } from './interfaces/question.interface';

@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() filter: FilterAssessmentDto) {
    return this.assessmentsService.findAll(filter);
  }

  @Get('types')
  @HttpCode(HttpStatus.OK)
  getTypes(): string[] {
    return this.assessmentsService.getTypes();
  }

  @Get('by-skill/:skill')
  @HttpCode(HttpStatus.OK)
  async findBySkill(@Param('skill') skill: string) {
    return this.assessmentsService.findBySkill(skill);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.assessmentsService.findOne(id);
  }

  @Post()
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.assessmentsService.delete(id, user.id);
  }

  @Post(':id/questions')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async addQuestion(
    @Param('id') id: string,
    @Body() question: CreateQuestionDto,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.addQuestion(id, question, user.id);
  }

  @Put(':id/questions/:questionId')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() updates: Partial<Question>,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.updateQuestion(id, questionId, updates, user.id);
  }

  @Delete(':id/questions/:questionId')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: any,
  ) {
    await this.assessmentsService.deleteQuestion(id, questionId, user.id);
  }

  @Post(':id/questions/reorder')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async reorderQuestions(
    @Param('id') id: string,
    @Body() body: { questionIds: string[] },
    @CurrentUser() user: any,
  ) {
    await this.assessmentsService.reorderQuestions(id, body.questionIds, user.id);
  }
}

