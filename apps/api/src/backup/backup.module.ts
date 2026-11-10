import { BadRequestException, Body, Controller, Get, Header, HttpCode, Module, Post, Res } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ImportFile, importSchema, localDay } from '@study/shared';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

export const EXPORT_SCHEMA_VERSION = 1;

// Rows come straight from an export file; the database validates their columns.
type Rows = any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

@Controller()
export class BackupController {
  constructor(private readonly prisma: PrismaService) {}

  /** F-17: full JSON dump of every table. */
  @Get('export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  async export(@Res({ passthrough: true }) res: Response) {
    const [profile, settings, fields, topics, links, activities, segments, focusSessions] = await Promise.all([
      this.prisma.profile.findMany(),
      this.prisma.settings.findMany(),
      this.prisma.studyField.findMany(),
      this.prisma.topic.findMany(),
      this.prisma.topicLink.findMany(),
      this.prisma.activity.findMany(),
      this.prisma.timeSegment.findMany(),
      this.prisma.focusSession.findMany(),
    ]);
    res.setHeader('Content-Disposition', `attachment; filename="learnlog-${localDay(new Date())}.json"`);
    return {
      // Internal file identifier, kept as 'study-tracker' so older backups still import.
      app: 'study-tracker',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: { profile, settings, fields, topics, links, activities, segments, focusSessions },
    };
  }

  /** F-22: replace ALL data with the contents of an export file, atomically. */
  @Post('import')
  @HttpCode(200)
  async import(@Body(new ZodPipe(importSchema)) file: ImportFile) {
    const d = file.data;
    const open = (d.segments as Rows).filter((s) => s.endedAt === null || s.endedAt === undefined).length;
    if (open > 1) throw new BadRequestException('Invalid backup: more than one running timer');
    const activeFocus = (d.focusSessions as Rows).filter((s) => s.status === 'RUNNING' || s.status === 'PAUSED').length;
    if (activeFocus > 1) throw new BadRequestException('Invalid backup: more than one active focus session');
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Children first is not needed: deleting fields cascades to topics/links/activities/segments.
          await tx.focusSession.deleteMany(); // not cascaded: its topic link is SET NULL
          await tx.studyField.deleteMany();
          await tx.profile.deleteMany();
          await tx.settings.deleteMany();
          if (d.profile.length) await tx.profile.createMany({ data: d.profile as Rows });
          if (d.settings.length) await tx.settings.createMany({ data: d.settings as Rows });
          if (d.fields.length) await tx.studyField.createMany({ data: d.fields as Rows });
          if (d.topics.length) await tx.topic.createMany({ data: d.topics as Rows });
          if (d.links.length) await tx.topicLink.createMany({ data: d.links as Rows });
          if (d.activities.length) await tx.activity.createMany({ data: d.activities as Rows });
          if (d.segments.length) await tx.timeSegment.createMany({ data: d.segments as Rows });
          if (d.focusSessions.length) await tx.focusSession.createMany({ data: d.focusSessions as Rows });
        },
        { timeout: 60_000 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientValidationError || e instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException('Invalid backup file: its rows do not match this app version. Nothing was changed.');
      }
      throw e;
    }
    return {
      imported: {
        fields: d.fields.length,
        topics: d.topics.length,
        activities: d.activities.length,
      },
    };
  }
}

@Module({ controllers: [BackupController] })
export class BackupModule {}
