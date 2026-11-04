import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { fieldCreateSchema, fieldUpdateSchema } from '@study/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { FieldsService } from './fields.service';

@Controller('fields')
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Get()
  list(@Query('archived') archived?: string) {
    return this.fields.list(archived === 'true');
  }

  @Post()
  create(@Body(new ZodPipe(fieldCreateSchema)) body: z.output<typeof fieldCreateSchema>) {
    return this.fields.create(body);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.fields.summary(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodPipe(fieldUpdateSchema)) body: z.output<typeof fieldUpdateSchema>) {
    return this.fields.update(id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string) {
    return this.fields.setArchived(id, true);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  unarchive(@Param('id') id: string) {
    return this.fields.setArchived(id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.fields.remove(id);
  }
}
