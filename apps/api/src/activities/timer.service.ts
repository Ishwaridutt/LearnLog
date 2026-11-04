import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TimeSegment } from '@prisma/client';
import {
  ActionResult,
  applyRevision,
  Grade,
  isEarlyRevision,
  scheduleAfterLearning,
  ScheduleState,
  studyDay,
  TimerActivity,
  TimerState,
  TopicStatus,
} from '@study/shared';
import { OpenSegment, toActivity } from '../common/mappers';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { SettingsService } from '../profile/settings.service';

type AutoPaused = ActionResult['autoPaused'];

/** Archived topics and topics in archived fields can't run a timer. */
function assertActive(topic: { archivedAt: Date | null; field: { archivedAt: Date | null } }) {
  if (topic.field.archivedAt) throw new BadRequestException('This study field is archived. Unarchive it first.');
  if (topic.archivedAt) throw new BadRequestException('This topic is archived. Unarchive it first.');
}

/**
 * The timer engine (REQUIREMENTS §6.7). Invariant: at most one TimeSegment with
 * endedAt = null exists in the whole database. Every mutation runs in a transaction.
 */
@Injectable()
export class TimerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** The single running segment, or null. */
  async openSegment(tx: Tx = this.prisma): Promise<OpenSegment | null> {
    return tx.timeSegment.findFirst({
      where: { endedAt: null },
      select: { id: true, activityId: true, startedAt: true },
    });
  }

  private async closeSegment(tx: Tx, seg: Pick<TimeSegment, 'id' | 'activityId' | 'startedAt'>, at: Date, edited = false) {
    const end = at < seg.startedAt ? seg.startedAt : at;
    const secs = Math.max(0, Math.round((end.getTime() - seg.startedAt.getTime()) / 1000));
    await tx.timeSegment.update({ where: { id: seg.id }, data: { endedAt: end, ...(edited ? { edited: true } : {}) } });
    return tx.activity.update({
      where: { id: seg.activityId },
      data: { totalSeconds: { increment: secs } },
      include: { topic: { select: { name: true } } },
    });
  }

  /** Close whatever is running (auto-pause) and open a segment for `activityId`. */
  private async runActivity(tx: Tx, activityId: string, now: Date): Promise<AutoPaused> {
    const open = await this.openSegment(tx);
    let autoPaused: AutoPaused = null;
    if (open) {
      if (open.activityId === activityId) return null; // already running
      const paused = await this.closeSegment(tx, open, now);
      autoPaused = { topicName: paused.topic.name, totalSeconds: paused.totalSeconds };
    }
    await tx.timeSegment.create({ data: { activityId, startedAt: now } });
    return autoPaused;
  }

  /** Pause the running segment if it belongs to one of these topics (used by archive/delete). */
  async pauseIfOwnedBy(tx: Tx, topicIds: string[]) {
    const open = await tx.timeSegment.findFirst({
      where: { endedAt: null, activity: { topicId: { in: topicIds } } },
    });
    if (open) await this.closeSegment(tx, open, new Date());
  }

  startLearning(topicId: string): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const topic = await tx.topic.findUnique({
        where: { id: topicId },
        include: { activities: { where: { type: 'LEARNING' } }, field: { select: { archivedAt: true } } },
      });
      if (!topic) throw new NotFoundException('Topic not found');
      assertActive(topic);
      const now = new Date();
      let learning = topic.activities[0];
      if (learning?.status === 'COMPLETED') {
        throw new BadRequestException('Learning is already completed. Start a revision instead.');
      }
      if (!learning) {
        learning = await tx.activity.create({
          data: { topicId, type: 'LEARNING', status: 'IN_PROGRESS', startedAt: now },
        });
        await tx.topic.update({ where: { id: topicId }, data: { status: 'IN_PROGRESS', startedAt: now } });
      }
      return { autoPaused: await this.runActivity(tx, learning.id, now) };
    });
  }

  startRevision(topicId: string): Promise<ActionResult & { activityId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const topic = await tx.topic.findUnique({
        where: { id: topicId },
        include: { activities: { where: { status: 'IN_PROGRESS' } }, field: { select: { archivedAt: true } } },
      });
      if (!topic) throw new NotFoundException('Topic not found');
      assertActive(topic);
      if (topic.status !== 'COMPLETED' && topic.status !== 'MASTERED') {
        throw new BadRequestException('Finish learning this topic before revising it.');
      }
      const now = new Date();
      const existing = topic.activities.find((a) => a.type === 'REVISION');
      if (existing) {
        return { activityId: existing.id, autoPaused: await this.runActivity(tx, existing.id, now) };
      }
      const s = await this.settings.get(tx);
      const today = studyDay(now, s.dayStartHour);
      const activity = await tx.activity.create({
        data: {
          topicId,
          type: 'REVISION',
          status: 'IN_PROGRESS',
          startedAt: now,
          isEarly: isEarlyRevision({ status: topic.status as TopicStatus, nextDueDay: topic.nextDueDay }, today),
          stepAtStart: topic.reviewStep,
          dueDayAtStart: topic.nextDueDay,
        },
      });
      return { activityId: activity.id, autoPaused: await this.runActivity(tx, activity.id, now) };
    });
  }

  private async inProgressActivity(tx: Tx, activityId: string) {
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
      include: { topic: { include: { field: { select: { archivedAt: true } } } } },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.status !== 'IN_PROGRESS') throw new BadRequestException('Activity is already completed');
    return activity;
  }

  pause(activityId: string): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.inProgressActivity(tx, activityId);
      const open = await this.openSegment(tx);
      if (open && open.activityId === activityId) await this.closeSegment(tx, open, new Date());
      return { autoPaused: null };
    });
  }

  resume(activityId: string): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const activity = await this.inProgressActivity(tx, activityId);
      assertActive(activity.topic);
      return { autoPaused: await this.runActivity(tx, activityId, new Date()) };
    });
  }

  end(activityId: string, grade?: Grade): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const activity = await this.inProgressActivity(tx, activityId);
      if (activity.type === 'REVISION' && !grade) {
        throw new BadRequestException('Grade the revision: FORGOT, HARD or GOOD.');
      }
      const now = new Date();
      const open = await this.openSegment(tx);
      if (open && open.activityId === activityId) await this.closeSegment(tx, open, now);

      const s = await this.settings.get(tx);
      const day = studyDay(now, s.dayStartHour);
      await tx.activity.update({
        where: { id: activityId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          completedDay: day,
          grade: activity.type === 'REVISION' ? grade : null,
        },
      });

      const topic = activity.topic;
      if (activity.type === 'LEARNING') {
        await tx.topic.update({
          where: { id: topic.id },
          data: { ...scheduleAfterLearning(day, s.revisionIntervals), completedAt: now },
        });
      } else {
        const current: ScheduleState = {
          status: topic.status as TopicStatus,
          reviewStep: topic.reviewStep,
          nextDueDay: topic.nextDueDay,
          forgotCount: topic.forgotCount,
        };
        const next = applyRevision(current, {
          grade: grade!,
          isEarly: activity.isEarly,
          completedDay: day,
          intervals: s.revisionIntervals,
        });
        await tx.topic.update({
          where: { id: topic.id },
          data: { ...next, lastRevisedAt: now, revisionCount: { increment: 1 } },
        });
      }
      return { autoPaused: null };
    });
  }

  /** Long-session guard (§6.7): close the running segment at a chosen earlier time. */
  setRunningEnd(segmentId: string, endedAt: Date): Promise<ActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const seg = await tx.timeSegment.findUnique({ where: { id: segmentId } });
      if (!seg) throw new NotFoundException('Segment not found');
      if (seg.endedAt) throw new BadRequestException('This session is no longer running');
      if (endedAt <= seg.startedAt) throw new BadRequestException('End time must be after the start time');
      if (endedAt > new Date()) throw new BadRequestException('End time cannot be in the future');
      await this.closeSegment(tx, seg, endedAt, true);
      return { autoPaused: null };
    });
  }

  async current(): Promise<TimerState> {
    const open = await this.openSegment();
    const acts = await this.prisma.activity.findMany({
      where: { status: 'IN_PROGRESS', topic: { archivedAt: null, field: { archivedAt: null } } },
      include: {
        topic: { select: { name: true, fieldId: true, field: { select: { name: true } } } },
        segments: { select: { endedAt: true }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });
    const toTimer = (a: (typeof acts)[number]): TimerActivity => ({
      ...toActivity(a, open),
      topicName: a.topic.name,
      fieldId: a.topic.fieldId,
      fieldName: a.topic.field.name,
      segmentId: open && open.activityId === a.id ? open.id : null,
    });
    const lastTouched = (a: (typeof acts)[number]) => a.segments[0]?.endedAt?.getTime() ?? a.startedAt.getTime();
    const runningAct = acts.find((a) => open && a.id === open.activityId);
    const paused = acts
      .filter((a) => a !== runningAct)
      .sort((a, b) => lastTouched(b) - lastTouched(a))
      .map(toTimer);
    return { running: runningAct ? toTimer(runningAct) : null, paused };
  }
}
