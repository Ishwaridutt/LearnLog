import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, StudyField } from '@prisma/client';
import { addDays, computePace, FieldSummary, FieldTile, Grade, weakness } from '@study/shared';
import { TimerService } from '../activities/timer.service';
import { OpenSegment } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { parseIntervals, SettingsService } from '../profile/settings.service';

/** Validated create/update body (zod output). `undefined` = leave unchanged, `null` = clear. */
export interface FieldInput {
  name?: string;
  description?: string | null;
  color?: string;
  revisionIntervals?: number[] | null;
  targetTopicCount?: number | null;
  targetDate?: string | null;
}

interface TopicRow {
  id: string;
  fieldId: string;
  status: string;
  nextDueDay: string | null;
  archivedAt: Date | null;
  revisionCount: number;
  skipRevision: boolean;
}
interface ActRow {
  id: string;
  topicId: string;
  type: string;
  status: string;
  grade: string | null;
  isEarly: boolean;
  totalSeconds: number;
  completedAt: Date | null;
}

/** Aggregates for one field, shared by the landing tiles and the field header. */
function aggregate(
  field: StudyField,
  topics: TopicRow[],
  acts: ActRow[],
  open: OpenSegment | null,
  today: string,
  globalIntervals: number[],
) {
  const live = new Set(topics.filter((t) => !t.archivedAt).map((t) => t.id));
  const openTopicIds = new Set(acts.filter((a) => a.status === 'IN_PROGRESS').map((a) => a.topicId));
  const runningAct = open ? acts.find((a) => a.id === open.activityId) : undefined;
  const upcomingEnd = addDays(today, 2);

  let learningSeconds = 0;
  let revisionSeconds = 0;
  let good = 0;
  let graded = 0;
  for (const a of acts) {
    if (a.type === 'LEARNING') learningSeconds += a.totalSeconds;
    else revisionSeconds += a.totalSeconds;
    if (a.type === 'REVISION' && a.status === 'COMPLETED' && a.grade && !a.isEarly) {
      graded++;
      if (a.grade === 'GOOD') good++;
    }
  }

  const visible = topics.filter((t) => live.has(t.id));
  const reviewable = visible.filter((t) => t.status === 'COMPLETED' && t.nextDueDay && !openTopicIds.has(t.id));
  const dueCount = reviewable.filter((t) => t.nextDueDay! <= today).length;
  const upcomingCount = reviewable.filter((t) => t.nextDueDay! > today && t.nextDueDay! <= upcomingEnd).length;
  const ongoing = acts.filter((a) => a.status === 'IN_PROGRESS' && live.has(a.topicId));
  const liveSince = runningAct ? open!.startedAt.toISOString() : null;

  // F-24: weak = ≥2 Forgot in a topic's last 5 graded revisions.
  const gradesByTopic = new Map<string, { at: number; grade: Grade }[]>();
  for (const a of acts) {
    if (a.type !== 'REVISION' || a.status !== 'COMPLETED' || !a.grade || !a.completedAt) continue;
    const list = gradesByTopic.get(a.topicId) ?? [];
    list.push({ at: a.completedAt.getTime(), grade: a.grade as Grade });
    gradesByTopic.set(a.topicId, list);
  }
  const weakCount = visible.filter((t) => {
    if (t.skipRevision || (t.status !== 'COMPLETED' && t.status !== 'MASTERED')) return false;
    const g = (gradesByTopic.get(t.id) ?? []).sort((x, y) => y.at - x.at).map((x) => x.grade);
    return weakness(g).weak;
  }).length;

  const completedCount = visible.filter((t) => t.status === 'COMPLETED' || t.status === 'MASTERED').length;
  // F-25
  const pace =
    field.targetTopicCount && field.targetDate
      ? computePace({
          target: field.targetTopicCount,
          targetDate: field.targetDate,
          startDay: field.targetStartDay ?? today,
          baseline: field.targetBaseline ?? 0,
          completed: completedCount,
          today,
        })
      : null;
  const customIntervals = parseIntervals(field.revisionIntervals);

  const tile: FieldTile = {
    id: field.id,
    name: field.name,
    description: field.description,
    color: field.color,
    archivedAt: field.archivedAt?.toISOString() ?? null,
    createdAt: field.createdAt.toISOString(),
    totalSeconds: learningSeconds + revisionSeconds,
    liveSince,
    topicCount: visible.length,
    completedCount,
    masteredCount: visible.filter((t) => t.status === 'MASTERED').length,
    running: !!runningAct && live.has(runningAct.topicId),
    paused: ongoing.some((a) => a.id !== runningAct?.id),
    dueCount,
    upcomingCount,
    weakCount,
    pace,
    targetTopicCount: field.targetTopicCount,
    targetDate: field.targetDate,
    customIntervals,
  };

  const summary: FieldSummary = {
    field: tile,
    today,
    learningSeconds,
    revisionSeconds,
    learningLiveSince: runningAct?.type === 'LEARNING' ? liveSince : null,
    revisionLiveSince: runningAct?.type === 'REVISION' ? liveSince : null,
    counts: {
      notStarted: visible.filter((t) => t.status === 'NOT_STARTED').length,
      inProgress: visible.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: tile.completedCount,
      mastered: tile.masteredCount,
    },
    recallRate: graded ? good / graded : null,
    tabs: {
      ongoing: ongoing.length,
      all: visible.length,
      revised: visible.filter((t) => t.revisionCount > 0).length,
      due: dueCount,
      upcoming: upcomingCount,
      weak: weakCount,
    },
    intervals: customIntervals ?? globalIntervals,
  };
  return { tile, summary };
}

@Injectable()
export class FieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly timer: TimerService,
  ) {}

  private async load(fieldIds: string[]) {
    const [topics, acts, open, settings] = await Promise.all([
      this.prisma.topic.findMany({
        where: { fieldId: { in: fieldIds } },
        select: { id: true, fieldId: true, status: true, nextDueDay: true, archivedAt: true, revisionCount: true, skipRevision: true },
      }),
      this.prisma.activity.findMany({
        where: { topic: { fieldId: { in: fieldIds } } },
        select: {
          id: true,
          topicId: true,
          type: true,
          status: true,
          grade: true,
          isEarly: true,
          totalSeconds: true,
          completedAt: true,
          topic: { select: { fieldId: true } },
        },
      }),
      this.timer.openSegment(),
      this.settings.get(),
    ]);
    const today = await this.settings.today();
    return { topics, acts, open, today, globalIntervals: settings.revisionIntervals };
  }

  async list(archived: boolean): Promise<FieldTile[]> {
    const fields = await this.prisma.studyField.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      orderBy: { createdAt: 'asc' },
    });
    const { topics, acts, open, today, globalIntervals } = await this.load(fields.map((f) => f.id));
    return fields.map(
      (f) =>
        aggregate(
          f,
          topics.filter((t) => t.fieldId === f.id),
          acts.filter((a) => a.topic.fieldId === f.id),
          open,
          today,
          globalIntervals,
        ).tile,
    );
  }

  async find(id: string) {
    const field = await this.prisma.studyField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException('Subject not found');
    return field;
  }

  async summary(id: string): Promise<FieldSummary> {
    const field = await this.find(id);
    const { topics, acts, open, today, globalIntervals } = await this.load([id]);
    return aggregate(field, topics, acts, open, today, globalIntervals).summary;
  }

  private async assertUniqueName(name: string, exceptId?: string) {
    const all = await this.prisma.studyField.findMany({ select: { id: true, name: true } });
    if (all.some((f) => f.id !== exceptId && f.name.toLowerCase() === name.toLowerCase())) {
      throw new ConflictException(`A subject named "${name}" already exists`);
    }
  }

  /** Turn validated input into column values, handling F-25 targets and F-26 intervals. */
  private async toData(input: FieldInput, existing: StudyField | null): Promise<Prisma.StudyFieldUncheckedUpdateInput> {
    const data: Prisma.StudyFieldUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.color !== undefined) data.color = input.color;
    if (input.revisionIntervals !== undefined) {
      data.revisionIntervals = input.revisionIntervals ? JSON.stringify(input.revisionIntervals) : null;
    }

    if (input.targetTopicCount !== undefined || input.targetDate !== undefined) {
      const count = input.targetTopicCount !== undefined ? input.targetTopicCount : (existing?.targetTopicCount ?? null);
      const date = input.targetDate !== undefined ? input.targetDate : (existing?.targetDate ?? null);
      if ((count == null) !== (date == null)) {
        throw new BadRequestException('Set both a target number of topics and a target date, or neither.');
      }
      if (count == null) {
        Object.assign(data, { targetTopicCount: null, targetDate: null, targetStartDay: null, targetBaseline: null });
      } else if (count !== existing?.targetTopicCount || date !== existing?.targetDate) {
        const today = await this.settings.today();
        if (date! < today) throw new BadRequestException('The target date must be today or later.');
        // A new or changed target re-plans from today, starting at what is already completed.
        const baseline = existing
          ? await this.prisma.topic.count({
              where: { fieldId: existing.id, archivedAt: null, status: { in: ['COMPLETED', 'MASTERED'] } },
            })
          : 0;
        Object.assign(data, { targetTopicCount: count, targetDate: date, targetStartDay: today, targetBaseline: baseline });
      }
    }
    return data;
  }

  async create(input: FieldInput & { name: string; color: string }) {
    await this.assertUniqueName(input.name);
    const data = await this.toData(input, null);
    const f = await this.prisma.studyField.create({ data: { ...(data as Prisma.StudyFieldUncheckedCreateInput), name: input.name, color: input.color } });
    return this.summary(f.id);
  }

  async update(id: string, input: FieldInput) {
    const existing = await this.find(id);
    if (input.name) await this.assertUniqueName(input.name, id);
    await this.prisma.studyField.update({ where: { id }, data: await this.toData(input, existing) });
    return this.summary(id);
  }

  async setArchived(id: string, archived: boolean) {
    await this.find(id);
    await this.prisma.$transaction(async (tx) => {
      if (archived) {
        const topics = await tx.topic.findMany({ where: { fieldId: id }, select: { id: true } });
        await this.timer.pauseIfOwnedBy(
          tx,
          topics.map((t) => t.id),
        );
      }
      await tx.studyField.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    });
    return this.summary(id);
  }

  async remove(id: string) {
    await this.find(id);
    await this.prisma.studyField.delete({ where: { id } });
  }
}
