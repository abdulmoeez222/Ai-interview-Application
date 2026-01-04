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
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  FilterTemplateDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() filter: FilterTemplateDto,
    @CurrentUser() user: any,
  ) {
    return this.templatesService.findAll(filter, user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.templatesService.findOne(id, user.id);
  }

  @Post()
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: any,
  ) {
    return this.templatesService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: any,
  ) {
    return this.templatesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.templatesService.delete(id, user.id);
  }

  @Post(':id/clone')
  @Roles('RECRUITER', 'ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async clone(@Param('id') id: string, @CurrentUser() user: any) {
    return this.templatesService.clone(id, user.id);
  }
}

