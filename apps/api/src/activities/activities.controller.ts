import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { endActivitySchema, segmentEndSchema } from '@study/shared';
import { ZodPipe } from '../common/zod.pipe';
import { TimerService } from './timer.service';

@Controller()
export class ActivitiesController {
  constructor(private readonly timer: TimerService) {}

  @Get('timer/current')
  current() {
    return this.timer.current();
  }

  @Post('topics/:id/learning/start')
  @HttpCode(200)
  startLearning(@Param('id') id: string) {
    return this.timer.startLearning(id);
  }

  @Post('topics/:id/revisions/start')
  @HttpCode(200)
  startRevision(@Param('id') id: string) {
    return this.timer.startRevision(id);
  }

  @Post('activities/:id/pause')
  @HttpCode(200)
  pause(@Param('id') id: string) {
    return this.timer.pause(id);
  }

  @Post('activities/:id/resume')
  @HttpCode(200)
  resume(@Param('id') id: string) {
    return this.timer.resume(id);
  }

  @Post('activities/:id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @Body(new ZodPipe(endActivitySchema)) body: { grade?: 'FORGOT' | 'HARD' | 'GOOD' }) {
    return this.timer.end(id, body.grade);
  }

  @Post('segments/:id/end')
  @HttpCode(200)
  endSegment(@Param('id') id: string, @Body(new ZodPipe(segmentEndSchema)) body: { endedAt: string }) {
    return this.timer.setRunningEnd(id, new Date(body.endedAt));
  }
}
