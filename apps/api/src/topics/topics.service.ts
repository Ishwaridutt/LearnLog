import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  addDays,
  Grade,
  weakness,
  WeakTopic,
  HistoryQuery,
  HistoryRow,
  LinkInput,
  pullBack,
  RevisionLists,
  ScheduleState,
  studyDay,
  Topic,
  TopicDetail,
  TopicListQuery,
  TopicStatus,
} from '@study/shared';
import { TimerService } from '../activities/timer.service';
import { toActivity, toSegment, toTopic, topicInclude, TopicWithRelations } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../profile/settings.service';

interface TopicData {
  name?: string;
  description?: string | null;
  recallPrompt?: string | null;
  links?: LinkInput[];
  skipRevision?: boolean;
}

const linkRows = (links: LinkInput[]) => links.map((l, i) => ({ label: l.label, url: l.url, sortOrder: i }));

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly timer: TimerService,
  ) {}

  private async field(fieldId: string) {
    const f = await this.prisma.studyField.findUnique({ where: { id: fieldId } });
    if (!f) throw new NotFoundException('Subject not found');
    return f;
  }

  private async topicRow(id: string) {
    const t = await this.prisma.topic.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Topic not found');
    return t;
  }

  async create(fieldId: string, input: TopicData & { name: string }): Promise<TopicDetail> {
    const f = await this.field(fieldId);
    if (f.archivedAt) throw new BadRequestException('Unarchive this subject before adding topics');
    const t = await this.prisma.topic.create({
      data: {
        fieldId,
        name: input.name,
        description: input.description ?? null,
        recallPrompt: input.recallPrompt ?? null,
        skipRevision: input.skipRevision ?? false,
        links: { create: linkRows(input.links ?? []) },
      },
    });
    return this.detail(t.id);
  }

  async detail(id: string): Promise<TopicDetail> {
    const t = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        links: true,
        field: { select: { name: true } },
        activities: { include: { segments: { orderBy: { startedAt: 'asc' } } }, orderBy: { startedAt: 'desc' } },
      },
    });
    if (!t) throw new NotFoundException('Topic not found');
    const [open, intervals] = await Promise.all([this.timer.openSegment(), this.settings.intervalsFor(t.fieldId)]);
    return {
      ...toTopic(t, open),
      fieldName: t.field.name,
      intervals,
      activities: t.activities.map((a) => ({ ...toActivity(a, open), segments: a.segments.map(toSegment) })),
    };
  }

  async update(id: string, input: TopicData): Promise<TopicDetail> {
    const current = await this.topicRow(id);
    const { links, skipRevision, ...fields } = input;
    const scheduleChange = skipRevision === undefined ? {} : await this.skipRevisionChange(current, skipRevision);
    await this.prisma.$transaction(async (tx) => {
      await tx.topic.update({ where: { id }, data: { ...fields, ...scheduleChange } });
      if (links) {
        await tx.topicLink.deleteMany({ where: { topicId: id } });
        await tx.topicLink.createMany({ data: linkRows(links).map((l) => ({ ...l, topicId: id })) });
      }
    });
    return this.detail(id);
  }

  /**
   * Turning "no revision needed" on drops the topic from the queue (its step is kept for history).
   * Turning it off on a completed topic starts revisions again from step 1, due tomorrow.
   */
  private async skipRevisionChange(t: { status: string; skipRevision: boolean; fieldId: string }, skip: boolean) {
    if (skip === t.skipRevision) return {};
    if (t.status === 'MASTERED') throw new BadRequestException('Mastered topics are already out of the revision queue');
    if (skip) return { skipRevision: true, nextDueDay: null };
    if (t.status !== 'COMPLETED') return { skipRevision: false };
    const s = await this.settings.get();
    const intervals = await this.settings.intervalsFor(t.fieldId);
    return {
      skipRevision: false,
      reviewStep: 0,
      nextDueDay: addDays(studyDay(new Date(), s.dayStartHour), intervals[0]),
    };
  }

  async setArchived(id: string, archived: boolean): Promise<TopicDetail> {
    await this.topicRow(id);
    await this.prisma.$transaction(async (tx) => {
      if (archived) await this.timer.pauseIfOwnedBy(tx, [id]);
      await tx.topic.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    });
    return this.detail(id);
  }

  async remove(id: string) {
    await this.topicRow(id);
    await this.prisma.topic.delete({ where: { id } });
  }

  async pullBack(id: string): Promise<TopicDetail> {
    const t = await this.topicRow(id);
    if (t.status !== 'MASTERED') throw new BadRequestException('Only Mastered topics can be pulled back');
    const s = await this.settings.get();
    const state: ScheduleState = {
      status: t.status as TopicStatus,
      reviewStep: t.reviewStep,
      nextDueDay: t.nextDueDay,
      forgotCount: t.forgotCount,
    };
    const next = pullBack(state, studyDay(new Date(), s.dayStartHour), await this.settings.intervalsFor(t.fieldId));
    await this.prisma.topic.update({ where: { id }, data: next });
    return this.detail(id);
  }

  async list(fieldId: string, q: TopicListQuery): Promise<Topic[]> {
    await this.field(fieldId);
    const where: Prisma.TopicWhereInput = { fieldId, archivedAt: null };
    if (q.q) where.name = { contains: q.q }; // SQLite LIKE: case-insensitive for ASCII
    if (q.status) where.status = q.status;
    if (q.tab === 'revised') where.revisionCount = { gt: 0 };
    if (q.tab === 'ongoing') where.activities = { some: { status: 'IN_PROGRESS' } };

    const [rows, open] = await Promise.all([
      this.prisma.topic.findMany({ where, include: topicInclude }),
      this.timer.openSegment(),
    ]);

    const dir = q.order === 'asc' ? 1 : -1;
    const key = (t: TopicWithRelations) => (q.sort === 'completedAt' ? t.completedAt : t.createdAt)?.getTime() ?? null;
    rows.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka === null && kb === null) return b.createdAt.getTime() - a.createdAt.getTime();
      if (ka === null) return 1; // never-completed topics always sort last
      if (kb === null) return -1;
      return (ka - kb) * dir;
    });
    return rows.map((t) => toTopic(t, open));
  }

  /** §6.6 revision lists. */
  async revisions(fieldId: string): Promise<RevisionLists> {
    await this.field(fieldId);
    const s = await this.settings.get();
    const today = studyDay(new Date(), s.dayStartHour);
    const rows = await this.prisma.topic.findMany({
      where: {
        fieldId,
        archivedAt: null,
        status: 'COMPLETED',
        skipRevision: false,
        nextDueDay: { not: null, lte: addDays(today, 2) },
        activities: { none: { status: 'IN_PROGRESS' } },
      },
      include: topicInclude,
    });
    const open = await this.timer.openSegment();
    const byDue = (a: TopicWithRelations, b: TopicWithRelations) =>
      a.nextDueDay!.localeCompare(b.nextDueDay!) || (a.reviewStep ?? 0) - (b.reviewStep ?? 0) || a.name.localeCompare(b.name);
    return {
      today,
      cap: s.dailyRevisionCap,
      intervals: await this.settings.intervalsFor(fieldId),
      dueNow: rows.filter((t) => t.nextDueDay! <= today).sort(byDue).map((t) => toTopic(t, open)),
      upcoming: rows.filter((t) => t.nextDueDay! > today).sort(byDue).map((t) => toTopic(t, open)),
    };
  }

  /** F-24: topics with ≥2 Forgot in their last 5 graded revisions, worst first. */
  async weak(fieldId: string): Promise<WeakTopic[]> {
    await this.field(fieldId);
    const [rows, open] = await Promise.all([
      this.prisma.topic.findMany({
        where: { fieldId, archivedAt: null, skipRevision: false, status: { in: ['COMPLETED', 'MASTERED'] } },
        include: topicInclude,
      }),
      this.timer.openSegment(),
    ]);
    const out: WeakTopic[] = [];
    for (const t of rows) {
      const graded = t.activities
        .filter((a) => a.type === 'REVISION' && a.status === 'COMPLETED' && a.grade)
        .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
      const w = weakness(graded.map((a) => a.grade as Grade));
      if (!w.weak) continue;
      const lastForgot = graded.find((a) => a.grade === 'FORGOT');
      out.push({
        ...toTopic(t, open),
        recentForgots: w.recentForgots,
        recentGraded: w.recentGraded,
        lastForgotAt: lastForgot?.completedAt?.toISOString() ?? null,
        recallRate: graded.length ? graded.filter((a) => a.grade === 'GOOD').length / graded.length : null,
      });
    }
    return out.sort((a, b) => b.recentForgots - a.recentForgots || (b.lastForgotAt ?? '').localeCompare(a.lastForgotAt ?? ''));
  }

  async history(fieldId: string, q: HistoryQuery): Promise<HistoryRow[]> {
    await this.field(fieldId);
    const s = await this.settings.get();
    const where: Prisma.ActivityWhereInput = { topic: { fieldId, ...(q.q ? { name: { contains: q.q } } : {}) } };
    if (q.type) where.type = q.type;
    if (q.grade) where.grade = q.grade;
    const [rows, open] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: { topic: { select: { name: true, archivedAt: true } } },
        orderBy: { startedAt: 'desc' },
        take: 2000,
      }),
      this.timer.openSegment(),
    ]);
    return rows
      .filter((a) => {
        const d = studyDay(a.startedAt, s.dayStartHour);
        return (!q.from || d >= q.from) && (!q.to || d <= q.to);
      })
      .map((a) => ({ ...toActivity(a, open), topicName: a.topic.name, topicArchived: !!a.topic.archivedAt }));
  }
}
