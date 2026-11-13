import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { calendarQuerySchema, dayParamSchema, timelineQuerySchema, type TimelineQuery } from '@study/shared';
import { ZodPipe } from '../common/zod.pipe';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('streak')
  streak() {
    return this.stats.streak();
  }

  @Get('calendar')
  calendar(@Query(new ZodPipe(calendarQuerySchema)) q: { from?: string; to?: string }) {
    return this.stats.calendar(q.from, q.to);
  }

  @Get('timeline')
  timeline(@Query(new ZodPipe(timelineQuerySchema)) q: TimelineQuery) {
    return this.stats.timeline(q.from, q.to);
  }

  @Get('day')
  today() {
    return this.stats.day();
  }

  @Get('day/:day')
  day(@Param('day', new ZodPipe(dayParamSchema)) day: string) {
    return this.stats.day(day);
  }
}

@Module({ controllers: [StatsController], providers: [StatsService] })
export class StatsModule {}
