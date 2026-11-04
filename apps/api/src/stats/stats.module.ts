import { Controller, Get, Module, Query } from '@nestjs/common';
import { calendarQuerySchema } from '@study/shared';
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
}

@Module({ controllers: [StatsController], providers: [StatsService] })
export class StatsModule {}
