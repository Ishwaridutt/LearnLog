import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { endActivitySchema, segmentEditSchema, segmentEndSchema } from '@study/shared';
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

  @Patch('segments/:id')
  editSegment(@Param('id') id: string, @Body(new ZodPipe(segmentEditSchema)) body: { startedAt: string; endedAt: string }) {
    return this.timer.editSegment(id, new Date(body.startedAt), new Date(body.endedAt));
  }

  @Delete('segments/:id')
  deleteSegment(@Param('id') id: string) {
    return this.timer.deleteSegment(id);
  }

  @Delete('activities/:id')
  cancelRevision(@Param('id') id: string) {
    return this.timer.cancelRevision(id);
  }
}
