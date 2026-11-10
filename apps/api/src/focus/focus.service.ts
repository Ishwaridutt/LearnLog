import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { FocusSession as FocusRow, Prisma } from '@prisma/client';
import {
  FocusCurrent,
  FocusHistoryQuery,
  FocusKind,
  FocusSession,
  FocusStartInput,
  FocusStatus,
  FocusTopicOption,
  focusEndsAt,
  focusUsed,
} from '@study/shared';
import { TimerService } from '../activities/timer.service';
import { PrismaService, Tx } from '../prisma/prisma.service';

const ACTIVE: FocusStatus[] = ['RUNNING', 'PAUSED'];
const include = { topic: { select: { name: true, fieldId: true, field: { select: { name: true } } } } } as const;
type Row = Prisma.FocusSessionGetPayload<{ include: typeof include }>;

function toSession(r: Row): FocusSession {
  return {
    id: r.id,
    kind: r.kind as FocusKind,
    status: r.status as FocusStatus,
    plannedSeconds: r.plannedSeconds,
    usedSeconds: r.usedSeconds,
    runningSince: r.runningSince?.toISOString() ?? null,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    topicId: r.topicId,
    topicName: r.topic?.name ?? null,
    fieldId: r.topic?.fieldId ?? null,
    fieldName: r.topic?.field.name ?? null,
  };
}

/** Local calendar day bounds for history filters (the API runs on the user's machine). */
const dayStart = (day: string) => new Date(`${day}T00:00:00`);
const nextDay = (day: string) => new Date(dayStart(day).getTime() + 86_400_000);

/**
 * Countdown (pomodoro) timer. The server owns the clock: a session that reaches 0 while no
 * page is open is closed at the exact moment it ran out, together with its linked topic's time.
 */
@Injectable()
export class FocusService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timer: TimerService,
  ) {}

  onModuleInit() {
    this.timer.registerSettler(() => this.settle());
  }

  /** Close a RUNNING session whose countdown has passed 0. */
  private async settleTx(tx: Tx, now = new Date()) {
    const running = await tx.focusSession.findFirst({ where: { status: 'RUNNING' } });
    if (!running) return;
    const endsAt = focusEndsAt(running);
    if (!endsAt || endsAt > now) return;
    await tx.focusSession.update({
      where: { id: running.id },
      data: { status: 'COMPLETED', usedSeconds: running.plannedSeconds, runningSince: null, endedAt: endsAt },
    });
    if (running.topicId) await this.timer.pauseTopicTx(tx, running.topicId, endsAt);
  }

  settle() {
    return this.prisma.$transaction((tx) => this.settleTx(tx));
  }

  async current(): Promise<FocusCurrent> {
    await this.settle();
    const [active, last] = await Promise.all([
      this.prisma.focusSession.findFirst({ where: { status: { in: ACTIVE } }, include }),
      this.prisma.focusSession.findFirst({
        where: { status: { notIn: ACTIVE } },
        orderBy: { endedAt: 'desc' },
        include,
      }),
    ]);
    return { active: active && toSession(active), last: last && toSession(last) };
  }

  private async activeRow(tx: Tx, id: string): Promise<FocusRow> {
    const row = await tx.focusSession.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Session not found');
    if (!ACTIVE.includes(row.status as FocusStatus)) throw new BadRequestException('This session has already ended');
    return row;
  }

  /** Run a mutation after settling, then return fresh state. */
  private async mutate(fn: (tx: Tx, now: Date) => Promise<unknown>): Promise<FocusCurrent> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.settleTx(tx, now);
      await fn(tx, now);
    });
    return this.current();
  }

  start(input: FocusStartInput) {
    return this.mutate(async (tx, now) => {
      const busy = await tx.focusSession.findFirst({ where: { status: { in: ACTIVE } } });
      if (busy) throw new BadRequestException('A session is already running. Stop it before starting another.');
      const topicId = input.kind === 'FOCUS' ? (input.topicId ?? null) : null;
      // Throws for archived/missing topics, which aborts the whole start.
      if (topicId) await this.timer.startTopicTx(tx, topicId, now);
      await tx.focusSession.create({
        data: {
          kind: input.kind,
          status: 'RUNNING',
          plannedSeconds: input.plannedSeconds,
          runningSince: now,
          startedAt: now,
          topicId,
        },
      });
    });
  }

  pause(id: string) {
    return this.mutate(async (tx, now) => {
      const row = await this.activeRow(tx, id);
      if (row.status !== 'RUNNING') return;
      await tx.focusSession.update({
        where: { id },
        data: { status: 'PAUSED', usedSeconds: Math.round(focusUsed(row, now)), runningSince: null },
      });
      if (row.topicId) await this.timer.pauseTopicTx(tx, row.topicId, now);
    });
  }

  resume(id: string) {
    return this.mutate(async (tx, now) => {
      const row = await this.activeRow(tx, id);
      if (row.status !== 'PAUSED') return;
      await tx.focusSession.update({ where: { id }, data: { status: 'RUNNING', runningSince: now } });
      if (row.topicId) await this.timer.resumeTopicTx(tx, row.topicId, now);
    });
  }

  /** End early. The used time is kept; the linked topic is paused, not ended. */
  stop(id: string) {
    return this.mutate(async (tx, now) => {
      const row = await this.activeRow(tx, id);
      await tx.focusSession.update({
        where: { id },
        data: { status: 'STOPPED', usedSeconds: Math.round(focusUsed(row, now)), runningSince: null, endedAt: now },
      });
      if (row.topicId) await this.timer.pauseTopicTx(tx, row.topicId, now);
    });
  }

  /** Change the countdown length of the current session. */
  edit(id: string, plannedSeconds: number) {
    return this.mutate(async (tx, now) => {
      const row = await this.activeRow(tx, id);
      const used = focusUsed(row, now);
      if (plannedSeconds <= used) {
        throw new BadRequestException(`Set more than the ${Math.ceil(used / 60)} min already used, or press Stop to end now.`);
      }
      await tx.focusSession.update({ where: { id }, data: { plannedSeconds } });
    });
  }

  /** Delete any session. Topic study time already logged is kept; a linked running topic is paused. */
  remove(id: string) {
    return this.mutate(async (tx, now) => {
      const row = await tx.focusSession.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Session not found');
      if (row.status === 'RUNNING' && row.topicId) await this.timer.pauseTopicTx(tx, row.topicId, now);
      await tx.focusSession.delete({ where: { id } });
    });
  }

  async history(q: FocusHistoryQuery): Promise<FocusSession[]> {
    await this.settle();
    const where: Prisma.FocusSessionWhereInput = {};
    if (q.kind) where.kind = q.kind;
    if (q.status) where.status = q.status;
    if (q.from || q.to) {
      where.startedAt = { ...(q.from ? { gte: dayStart(q.from) } : {}), ...(q.to ? { lt: nextDay(q.to) } : {}) };
    }
    const rows = await this.prisma.focusSession.findMany({ where, include, orderBy: { startedAt: 'desc' }, take: 1000 });
    return rows.map(toSession);
  }

  /** Topics that can be linked: not archived, in an active subject. In-progress ones first. */
  async topicOptions(): Promise<FocusTopicOption[]> {
    const rows = await this.prisma.topic.findMany({
      where: { archivedAt: null, field: { archivedAt: null } },
      select: { id: true, name: true, status: true, fieldId: true, field: { select: { name: true } } },
      orderBy: [{ field: { name: 'asc' } }, { name: 'asc' }],
    });
    const rank = (s: string) => (s === 'IN_PROGRESS' ? 0 : s === 'NOT_STARTED' ? 1 : 2);
    return rows
      .map((t) => ({ id: t.id, name: t.name, status: t.status, fieldId: t.fieldId, fieldName: t.field.name }))
      .sort((a, b) => a.fieldName.localeCompare(b.fieldName) || rank(a.status) - rank(b.status));
  }
}
