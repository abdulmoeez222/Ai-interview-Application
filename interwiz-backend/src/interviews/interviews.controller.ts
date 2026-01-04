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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { InterviewsService } from './interviews.service';
import {
  CreateInterviewDto,
  ScheduleInterviewDto,
  SaveResponseDto,
  FilterInterviewDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProctorData } from './interfaces/interview.interface';
import * as path from 'path';
import * as fs from 'fs';

@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  // Protected endpoints (recruiter only)
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() filter: FilterInterviewDto,
    @CurrentUser() user: any,
  ) {
    return this.interviewsService.findAll(filter, user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.interviewsService.findOne(id, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateInterviewDto,
    @CurrentUser() user: any,
  ) {
    return this.interviewsService.create(dto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    await this.interviewsService.cancel(id, user.id);
  }

  @Get(':id/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getReport(@Param('id') id: string) {
    return this.interviewsService.generateReport(id);
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getResponses(@Param('id') id: string) {
    return this.interviewsService.getResponses(id);
  }

  // Public endpoints (for candidates)
  @Get('public/:token')
  @HttpCode(HttpStatus.OK)
  async getByToken(@Param('token') token: string) {
    return this.interviewsService.findByToken(token);
  }

  @Post('public/:token/schedule')
  @HttpCode(HttpStatus.OK)
  async scheduleInterview(
    @Param('token') token: string,
    @Body() dto: ScheduleInterviewDto,
  ) {
    const interview = await this.interviewsService.findByToken(token);
    return this.interviewsService.schedule(interview.id, dto);
  }

  @Post('public/:token/join')
  @HttpCode(HttpStatus.OK)
  async joinInterview(@Param('token') token: string) {
    const interview = await this.interviewsService.findByToken(token);
    return this.interviewsService.start(interview.id);
  }

  @Post(':id/responses/text')
  @HttpCode(HttpStatus.CREATED)
  async saveResponse(
    @Param('id') id: string,
    @Body() dto: SaveResponseDto,
  ) {
    return this.interviewsService.saveResponse(id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeInterview(@Param('id') id: string) {
    return this.interviewsService.complete(id);
  }

  // Public routes for interview engine (voice-based)
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startInterview(@Param('id') id: string) {
    return this.interviewsService.startInterview(id);
  }

  @Post(':id/responses')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'responses');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `response-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async submitResponse(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    return this.interviewsService.submitResponse(id, file);
  }

  @Post(':id/proctor')
  @HttpCode(HttpStatus.OK)
  async updateProctorData(
    @Param('id') id: string,
    @Body() data: Partial<ProctorData>,
  ) {
    await this.interviewsService.updateProctorData(id, data);
    return { message: 'Proctoring data updated' };
  }
}

