import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  historyQuerySchema,
  HistoryQuery,
  topicCreateSchema,
  TopicListQuery,
  topicListQuerySchema,
  topicUpdateSchema,
} from '@study/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { TopicsService } from './topics.service';

@Controller()
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get('fields/:fieldId/topics')
  list(@Param('fieldId') fieldId: string, @Query(new ZodPipe(topicListQuerySchema)) q: TopicListQuery) {
    return this.topics.list(fieldId, q);
  }

  @Post('fields/:fieldId/topics')
  create(@Param('fieldId') fieldId: string, @Body(new ZodPipe(topicCreateSchema)) body: z.output<typeof topicCreateSchema>) {
    return this.topics.create(fieldId, body);
  }

  @Get('fields/:fieldId/revisions')
  revisions(@Param('fieldId') fieldId: string) {
    return this.topics.revisions(fieldId);
  }

  @Get('fields/:fieldId/history')
  history(@Param('fieldId') fieldId: string, @Query(new ZodPipe(historyQuerySchema)) q: HistoryQuery) {
    return this.topics.history(fieldId, q);
  }

  @Get('topics/:id')
  detail(@Param('id') id: string) {
    return this.topics.detail(id);
  }

  @Patch('topics/:id')
  update(@Param('id') id: string, @Body(new ZodPipe(topicUpdateSchema)) body: z.output<typeof topicUpdateSchema>) {
    return this.topics.update(id, body);
  }

  @Post('topics/:id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string) {
    return this.topics.setArchived(id, true);
  }

  @Post('topics/:id/unarchive')
  @HttpCode(200)
  unarchive(@Param('id') id: string) {
    return this.topics.setArchived(id, false);
  }

  @Post('topics/:id/pull-back')
  @HttpCode(200)
  pullBack(@Param('id') id: string) {
    return this.topics.pullBack(id);
  }

  @Delete('topics/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.topics.remove(id);
  }
}
