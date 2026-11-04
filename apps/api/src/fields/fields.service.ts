import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { StudyField } from '@prisma/client';
import { addDays, FieldCreateInput, FieldSummary, FieldTile, FieldUpdateInput } from '@study/shared';
import { TimerService } from '../activities/timer.service';
import { OpenSegment } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../profile/settings.service';

interface TopicRow {
  id: string;
  fieldId: string;
  status: string;
  nextDueDay: string | null;
  archivedAt: Date | null;
  revisionCount: number;
}
interface ActRow {
  id: string;
  topicId: string;
  type: string;
  status: string;
  grade: string | null;
  isEarly: boolean;
  totalSeconds: number;
}

/** Aggregates for one field, shared by the landing tiles and the field header. */
function aggregate(field: StudyField, topics: TopicRow[], acts: ActRow[], open: OpenSegment | null, today: string) {
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
    completedCount: visible.filter((t) => t.status === 'COMPLETED' || t.status === 'MASTERED').length,
    masteredCount: visible.filter((t) => t.status === 'MASTERED').length,
    running: !!runningAct && live.has(runningAct.topicId),
    paused: ongoing.some((a) => a.id !== runningAct?.id),
    dueCount,
    upcomingCount,
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
    },
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
    const [topics, acts, open, today] = await Promise.all([
      this.prisma.topic.findMany({
        where: { fieldId: { in: fieldIds } },
        select: { id: true, fieldId: true, status: true, nextDueDay: true, archivedAt: true, revisionCount: true },
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
          topic: { select: { fieldId: true } },
        },
      }),
      this.timer.openSegment(),
      this.settings.today(),
    ]);
    return { topics, acts, open, today };
  }

  async list(archived: boolean): Promise<FieldTile[]> {
    const fields = await this.prisma.studyField.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      orderBy: { createdAt: 'asc' },
    });
    const { topics, acts, open, today } = await this.load(fields.map((f) => f.id));
    return fields.map(
      (f) =>
        aggregate(
          f,
          topics.filter((t) => t.fieldId === f.id),
          acts.filter((a) => a.topic.fieldId === f.id),
          open,
          today,
        ).tile,
    );
  }

  async find(id: string) {
    const field = await this.prisma.studyField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException('Study field not found');
    return field;
  }

  async summary(id: string): Promise<FieldSummary> {
    const field = await this.find(id);
    const { topics, acts, open, today } = await this.load([id]);
    return aggregate(field, topics, acts, open, today).summary;
  }

  private async assertUniqueName(name: string, exceptId?: string) {
    const all = await this.prisma.studyField.findMany({ select: { id: true, name: true } });
    if (all.some((f) => f.id !== exceptId && f.name.toLowerCase() === name.toLowerCase())) {
      throw new ConflictException(`A study field named "${name}" already exists`);
    }
  }

  async create(input: FieldCreateInput & { description: string | null }) {
    await this.assertUniqueName(input.name);
    const f = await this.prisma.studyField.create({ data: input });
    return this.summary(f.id);
  }

  async update(id: string, input: FieldUpdateInput) {
    await this.find(id);
    if (input.name) await this.assertUniqueName(input.name, id);
    await this.prisma.studyField.update({ where: { id }, data: input });
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
