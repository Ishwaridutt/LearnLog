import { Controller, Get, Header, Module, Res } from '@nestjs/common';
import type { Response } from 'express';
import { localDay } from '@study/shared';
import { PrismaService } from '../prisma/prisma.service';

export const EXPORT_SCHEMA_VERSION = 1;

@Controller('export')
export class BackupController {
  constructor(private readonly prisma: PrismaService) {}

  /** F-17: full JSON dump of every table. */
  @Get()
  @Header('Content-Type', 'application/json; charset=utf-8')
  async export(@Res({ passthrough: true }) res: Response) {
    const [profile, settings, fields, topics, links, activities, segments] = await Promise.all([
      this.prisma.profile.findMany(),
      this.prisma.settings.findMany(),
      this.prisma.studyField.findMany(),
      this.prisma.topic.findMany(),
      this.prisma.topicLink.findMany(),
      this.prisma.activity.findMany(),
      this.prisma.timeSegment.findMany(),
    ]);
    res.setHeader('Content-Disposition', `attachment; filename="study-tracker-${localDay(new Date())}.json"`);
    return {
      app: 'study-tracker',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: { profile, settings, fields, topics, links, activities, segments },
    };
  }
}

@Module({ controllers: [BackupController] })
export class BackupModule {}
